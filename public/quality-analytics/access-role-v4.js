(()=>{
  "use strict";
  const SUPABASE_URL="https://jpewcvzummlwiplbojip.supabase.co";
  const SUPABASE_KEY="sb_publishable_BKcXs7kCaFlZ2JKnBclV4Q_qyRKKPKD";
  const BLUE="#056FEC", LIGHT="#05ACFF", LOGO="./iSchool-logo-colors-20260730.svg?v=20260730-5";
  const EMAILS={
    "quality.admin":"quality.system@ischooltech.com",
    "quality.system":"quality.system@ischooltech.com",
    "quality.management":"quality.management@ischooltech.com",
    "quality.supervisors":"quality.supervisors@ischooltech.com",
    "quality.teamleaders":"quality.teamleaders@ischooltech.com"
  };
  const ROLE_BY_EMAIL={
    "quality.system@ischooltech.com":"admin",
    "quality.admin@internal.example.com":"admin",
    "quality.management@ischooltech.com":"management",
    "quality.supervisors@ischooltech.com":"supervisors",
    "quality.viewer@internal.example.com":"supervisors",
    "quality.teamleaders@ischooltech.com":"teamleaders"
  };
  const LABELS={admin:"System Admin",management:"Management Analytics",supervisors:"Supervisors View",teamleaders:"Team Leaders Analytics"};
  if(!window.supabase?.createClient){document.body.innerHTML="<div style='padding:40px;font-family:sans-serif'>Unable to load secure login. Please refresh.</div>";return;}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  window.__QA_SUPABASE__=client;
  document.documentElement.classList.add("qa-locked");
  const style=document.createElement("style");
  style.textContent=`:root{--brand-blue:${BLUE};--brand-light:${LIGHT};--brand-yellow:#FFD700;--brand-orange:#FF7F1C}html.qa-locked,html.qa-locked body{overflow:hidden!important}html.qa-locked #root{visibility:hidden!important}#qa-login{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 10% 10%,rgba(5,111,236,.14),transparent 34%),radial-gradient(circle at 90% 85%,rgba(255,215,0,.17),transparent 32%),#f5f8fc;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#qa-login-card{width:min(440px,100%);padding:34px;border:1px solid rgba(5,111,236,.15);border-radius:28px;background:#fff;box-shadow:0 28px 80px rgba(31,42,85,.16)}#qa-login-logo{display:flex;min-height:92px;margin-bottom:22px;padding:15px 20px;align-items:center;justify-content:center;border-radius:20px;background:#fff;box-shadow:0 10px 34px rgba(31,42,85,.08)}#qa-login-logo img{display:block;width:260px;max-width:100%;height:auto}#qa-login h1{margin:0;color:#1F2A55;text-align:center;font-size:26px;font-weight:850}#qa-login p{margin:9px 0 25px;color:#597587;text-align:center;font-size:14px;line-height:1.55}.qa-field{margin-top:15px}.qa-field label{display:block;margin-bottom:7px;color:#334155;font-size:13px;font-weight:750}.qa-field input{box-sizing:border-box;width:100%;height:48px;padding:0 14px;border:1px solid #dbe4ef;border-radius:14px;outline:none;background:#fff;color:#0f172a}.qa-field input:focus{border-color:${BLUE};box-shadow:0 0 0 4px rgba(5,111,236,.12)}#qa-login-submit{width:100%;height:50px;margin-top:22px;border:0;border-radius:15px;background:${BLUE};color:#fff;font-weight:850;cursor:pointer;box-shadow:0 12px 28px rgba(5,111,236,.24)}#qa-login-submit:disabled{opacity:.65;cursor:wait}#qa-login-error{min-height:20px;margin-top:12px;color:#AA1818;text-align:center;font-size:13px;font-weight:750}#qa-login-note{margin-top:18px;color:#85A5B9;text-align:center;font-size:11px}#qa-access-controls{position:fixed;right:17px;bottom:17px;z-index:999999;display:flex;align-items:center;gap:8px}#qa-role-badge,#qa-logout{height:38px;padding:0 13px;border:1px solid rgba(5,111,236,.18);border-radius:999px;background:rgba(255,255,255,.97);box-shadow:0 10px 30px rgba(31,42,85,.12);font-size:12px;font-weight:850;backdrop-filter:blur(12px)}#qa-role-badge{display:flex;align-items:center;color:${BLUE}}#qa-logout{color:#1F2A55;cursor:pointer}.text-blue-500,.text-blue-600,.text-blue-700,.text-blue-800,.text-blue-900,.text-sky-500,.text-sky-600{color:${BLUE}!important}.bg-blue-500,.bg-blue-600,.bg-blue-700,.bg-blue-800,.bg-sky-500,.bg-sky-600{background-color:${BLUE}!important}.border-blue-400,.border-blue-500,.border-blue-600,.border-sky-400,.border-sky-500{border-color:${BLUE}!important}@media(max-width:768px){#qa-login-card{padding:27px 21px}#qa-access-controls{right:10px;bottom:10px}#qa-role-badge{display:none}}`;
  document.head.appendChild(style);
  const emailFor=value=>{const v=String(value||"").trim().toLowerCase();return EMAILS[v]||v};
  const fallbackRole=email=>ROLE_BY_EMAIL[String(email||"").toLowerCase()]||"supervisors";
  async function resolveRole(user){
    let role=fallbackRole(user?.email);
    try{
      let result=await client.from("quality_profiles").select("access_role,role").eq("user_id",user.id).maybeSingle();
      if(result.error&&/access_role/i.test(result.error.message||""))result=await client.from("quality_profiles").select("role").eq("user_id",user.id).maybeSingle();
      if(!result.error&&result.data)role=result.data.access_role||result.data.role||role;
    }catch{}
    return ["admin","management","supervisors","teamleaders"].includes(role)?role:fallbackRole(user?.email);
  }
  function controls(role){
    document.getElementById("qa-access-controls")?.remove();
    const w=document.createElement("div");w.id="qa-access-controls";
    w.innerHTML=`<div id="qa-role-badge">${LABELS[role]||role}</div><button id="qa-logout" type="button">Log out</button>`;
    w.querySelector("button").onclick=async()=>{await client.auth.signOut();location.reload()};document.body.appendChild(w);
  }
  async function activate(session){
    if(!session?.user)return showLogin();
    const role=await resolveRole(session.user);
    window.__QA_SESSION__=session;window.__QA_ROLE__=role;
    document.documentElement.dataset.qaRole=role;document.documentElement.classList.remove("qa-locked");document.getElementById("qa-login")?.remove();controls(role);
    const detail={session,user:session.user,role,label:LABELS[role]||role,client};
    window.dispatchEvent(new CustomEvent("qa-auth-ready",{detail}));window.dispatchEvent(new CustomEvent("qa-role-ready",{detail}));
  }
  function showLogin(message=""){
    document.documentElement.classList.add("qa-locked");document.getElementById("qa-access-controls")?.remove();if(document.getElementById("qa-login"))return;
    const g=document.createElement("div");g.id="qa-login";
    g.innerHTML=`<form id="qa-login-card" autocomplete="off"><div id="qa-login-logo"><img src="${LOGO}" alt="iSchool"></div><h1>Quality Intelligence</h1><p>Sign in to open your authorised cloud analytics view.</p><div class="qa-field"><label for="qa-user">Username or email</label><input id="qa-user" autocomplete="username" required></div><div class="qa-field"><label for="qa-pass">Password</label><input id="qa-pass" type="password" autocomplete="current-password" required></div><button id="qa-login-submit">Sign in</button><div id="qa-login-error" role="alert">${message}</div><div id="qa-login-note">Secure Supabase account • Shared data across authorised devices</div></form>`;
    document.body.appendChild(g);const f=g.querySelector("form"),u=g.querySelector("#qa-user"),p=g.querySelector("#qa-pass"),e=g.querySelector("#qa-login-error"),b=g.querySelector("button");
    f.onsubmit=async ev=>{ev.preventDefault();e.textContent="";b.disabled=true;b.textContent="Checking…";try{const email=emailFor(u.value);const {data,error}=await client.auth.signInWithPassword({email,password:p.value});if(error)throw error;await activate(data.session)}catch(error){e.textContent=error?.message?.includes("Invalid login")?"Incorrect username or password.":(error?.message||"Unable to sign in.");p.value="";p.focus()}finally{b.disabled=false;b.textContent="Sign in"}};setTimeout(()=>u.focus(),0);
  }
  async function start(){
    try{const {data,error}=await client.auth.getSession();if(error)throw error;data.session?await activate(data.session):showLogin()}catch(error){showLogin(error?.message||"Unable to connect to secure login.")}
  }
  client.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT")showLogin();else if(event==="SIGNED_IN"&&session&&!window.__QA_SESSION__)activate(session)});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();