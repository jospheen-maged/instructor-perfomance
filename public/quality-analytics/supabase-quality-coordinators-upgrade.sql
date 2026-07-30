-- Quality Coordinators shared account upgrade
-- Run once in Supabase Dashboard > SQL Editor.

-- The Quality Coordinators account receives the same protected data access as Management.
update public.quality_profiles p
set access_role = 'management',
    role = 'viewer'::public.quality_role
from auth.users u
where p.user_id = u.id
  and lower(coalesce(u.email, '')) = 'quality@ischooltech.com';

-- Ensure the existing account has a profile even if it was created before the profile trigger.
insert into public.quality_profiles (user_id, role, access_role)
select u.id, 'viewer'::public.quality_role, 'management'
from auth.users u
where lower(coalesce(u.email, '')) = 'quality@ischooltech.com'
on conflict (user_id) do update
set role = excluded.role,
    access_role = excluded.access_role;

-- Keep future users with this email mapped to Management-level data access.
create or replace function public.handle_quality_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_access_role text;
  resolved_legacy_role public.quality_role;
begin
  resolved_access_role := case
    when lower(coalesce(new.email, '')) in ('quality.system@ischooltech.com', 'quality.admin@internal.example.com') then 'admin'
    when lower(coalesce(new.email, '')) in ('quality.management@ischooltech.com', 'quality@ischooltech.com') then 'management'
    when lower(coalesce(new.email, '')) in ('quality.supervisors@ischooltech.com', 'quality.viewer@internal.example.com') then 'supervisors'
    when lower(coalesce(new.email, '')) = 'quality.teamleaders@ischooltech.com' then 'teamleaders'
    else 'supervisors'
  end;

  resolved_legacy_role := case
    when resolved_access_role = 'admin' then 'admin'::public.quality_role
    else 'viewer'::public.quality_role
  end;

  insert into public.quality_profiles (user_id, role, access_role)
  values (new.id, resolved_legacy_role, resolved_access_role)
  on conflict (user_id) do update
    set role = excluded.role,
        access_role = excluded.access_role;

  return new;
end;
$$;

-- Add an independent UI permissions row for Quality Coordinators.
alter table public.quality_role_tabs
  drop constraint if exists quality_role_tabs_role_check;

alter table public.quality_role_tabs
  add constraint quality_role_tabs_role_check
  check (role in ('management', 'quality', 'supervisors', 'teamleaders'));

insert into public.quality_role_tabs (role, tab_key, is_enabled)
values
  ('quality', 'overview', true),
  ('quality', 'qc', true),
  ('quality', 'teams', true),
  ('quality', 'objections', true),
  ('quality', 'explorer', true)
on conflict (role, tab_key) do nothing;
