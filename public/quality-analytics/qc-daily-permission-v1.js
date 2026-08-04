(()=>{
  "use strict";
  const NAV_ID="qdf-nav",HIDDEN="qa-daily-hidden";
  let enabled=null,loading=false;
  const role=()=>window.__QA_ACCESS_ROLE__||window.__QA_ROLE__||document.documentElement.dataset.qaAccessRole||document.documentElement.dataset.qaRole||"";
  const defaultEnabled=r=>["admin","management","quality"].includes(r);
  const style=document.createElement("style");style.textContent=`#${NAV_ID}.${HIDDEN}{display:none!important}`;document.head.appendChild(style);
  async function load(){
    if(loading)return;loading=true;
    const r=role();enabled=defaultEnabled(r);
    if(r!=="admin"&&window.__QA_SUPABASE__){
      try{
        const {data,error}=await window.__QA_SUPABASE__.from("quality_role_tabs").select("is_enabled").eq("role",r).eq("tab_key","daily").maybeSingle();
        if(!error&&data)enabled=Boolean(data.is_enabled);
      }catch{}
    }
    loading=false;apply();
  }
  function leaveDaily(){
    if(!document.body.classList.contains("qdf-active"))return;
    const fallback=[...document.querySelectorAll("aside nav button")].find(b=>b.id!==NAV_ID&&!b.classList.contains("qa-role-hidden")&&getComputedStyle(b).display!=="none");
    fallback?.click();
  }
  function apply(){
    const nav=document.getElementById(NAV_ID);if(!nav)return;
    const show=role()==="admin"||Boolean(enabled);
    nav.classList.toggle(HIDDEN,!show);
    nav.setAttribute("aria-hidden",show?"false":"true");
    if(!show)leaveDaily();
  }
  async function refresh(){enabled=null;await load()}
  window.addEventListener("qa-auth-ready",()=>setTimeout(refresh,500));
  window.addEventListener("qa-permissions-updated",refresh);
  new MutationObserver(()=>{if(enabled===null)load();else apply()}).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(refresh,900),{once:true}):setTimeout(refresh,900);
})();