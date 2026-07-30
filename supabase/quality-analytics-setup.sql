-- Quality Intelligence shared cloud setup
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'quality_role') then
    create type public.quality_role as enum ('admin', 'viewer');
  end if;
end $$;

create table if not exists public.quality_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.quality_role not null default 'viewer',
  created_at timestamptz not null default now()
);

create table if not exists public.quality_data (
  kind text not null check (kind in ('reviews', 'objections')),
  record_key text not null,
  cycle text,
  payload jsonb not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (kind, record_key)
);

create table if not exists public.quality_dataset_versions (
  kind text primary key check (kind in ('reviews', 'objections')),
  row_count integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_quality_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quality_data_updated_at on public.quality_data;
create trigger quality_data_updated_at
before update on public.quality_data
for each row execute function public.set_quality_updated_at();

drop trigger if exists quality_dataset_versions_updated_at on public.quality_dataset_versions;
create trigger quality_dataset_versions_updated_at
before insert or update on public.quality_dataset_versions
for each row execute function public.set_quality_updated_at();

create or replace function public.handle_quality_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.quality_profiles (user_id, role)
  values (
    new.id,
    case
      when lower(coalesce(new.email, '')) = 'quality.admin@internal.example.com' then 'admin'::public.quality_role
      else 'viewer'::public.quality_role
    end
  )
  on conflict (user_id) do update set role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_quality_user_created on auth.users;
create trigger on_quality_user_created
after insert or update of email on auth.users
for each row execute function public.handle_quality_user();

insert into public.quality_profiles (user_id, role)
select id,
       case when lower(coalesce(email, '')) = 'quality.admin@internal.example.com'
            then 'admin'::public.quality_role
            else 'viewer'::public.quality_role
       end
from auth.users
on conflict (user_id) do update set role = excluded.role;

alter table public.quality_profiles enable row level security;
alter table public.quality_data enable row level security;
alter table public.quality_dataset_versions enable row level security;

grant select on public.quality_profiles to authenticated;
grant select, insert, update, delete on public.quality_data to authenticated;
grant select, insert, update, delete on public.quality_dataset_versions to authenticated;

create or replace function public.is_quality_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quality_profiles
    where user_id = (select auth.uid())
      and role = 'admin'::public.quality_role
  );
$$;

grant execute on function public.is_quality_admin() to authenticated;

drop policy if exists "Users read own quality profile" on public.quality_profiles;
create policy "Users read own quality profile"
on public.quality_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Authenticated users read quality data" on public.quality_data;
create policy "Authenticated users read quality data"
on public.quality_data
for select
to authenticated
using (true);

drop policy if exists "Admins insert quality data" on public.quality_data;
create policy "Admins insert quality data"
on public.quality_data
for insert
to authenticated
with check ((select public.is_quality_admin()));

drop policy if exists "Admins update quality data" on public.quality_data;
create policy "Admins update quality data"
on public.quality_data
for update
to authenticated
using ((select public.is_quality_admin()))
with check ((select public.is_quality_admin()));

drop policy if exists "Admins delete quality data" on public.quality_data;
create policy "Admins delete quality data"
on public.quality_data
for delete
to authenticated
using ((select public.is_quality_admin()));

drop policy if exists "Authenticated users read dataset versions" on public.quality_dataset_versions;
create policy "Authenticated users read dataset versions"
on public.quality_dataset_versions
for select
to authenticated
using (true);

drop policy if exists "Admins insert dataset versions" on public.quality_dataset_versions;
create policy "Admins insert dataset versions"
on public.quality_dataset_versions
for insert
to authenticated
with check ((select public.is_quality_admin()));

drop policy if exists "Admins update dataset versions" on public.quality_dataset_versions;
create policy "Admins update dataset versions"
on public.quality_dataset_versions
for update
to authenticated
using ((select public.is_quality_admin()))
with check ((select public.is_quality_admin()));

drop policy if exists "Admins delete dataset versions" on public.quality_dataset_versions;
create policy "Admins delete dataset versions"
on public.quality_dataset_versions
for delete
to authenticated
using ((select public.is_quality_admin()));

insert into public.quality_dataset_versions (kind, row_count)
values ('reviews', 0), ('objections', 0)
on conflict (kind) do nothing;

-- Create these two users in Authentication > Users > Add user (Auto Confirm ON):
-- quality.admin@internal.example.com  -> admin role
-- quality.viewer@internal.example.com -> viewer role
-- The website maps the usernames quality.admin and quality.viewer to those emails.
