(()=>{
  "use strict";
  const TAB_KEY="trends",NAV_ID="qct-nav";
  let lastEnabled=null,checking=false;
  const role=()=>window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaAccessRole||window.__QA_ROLE__||document.documentElement.dataset.qaRole||"";
  const known=new Set(["management","quality","supervisors","teamleaders"]);
  const css=document.createElement("style");
  css.textContent=`html[data-qa-trends-disabled="1"] #${NAV_ID}{display:none!important}`;
  document.head.appendChild(css);

  function leaveTrends(){
    if(!document.body.classList.contains("qct-active"))return;
    const fallback=[...document.querySelectorAll("aside nav button,aside button")].find(b=>b.id!==NAV_ID&&/Executive Overview/i.test(b.textContent||"")&&!b.classList.contains("qa-role-hidden"));
    fallback?.click();
  }
  function apply(enabled){
    lastEnabled=enabled;
    if(enabled){
      document.documentElement.removeAttribute("data-qa-trends-disabled");
    }else{
      document.documentElement.setAttribute("data-qa-trends-disabled","1");
      leaveTrends();
    }
  }
  async function refresh(){
    if(checking)return;
    checking=true;
    try{
      const r=role();
      if(r==="admin"){apply(true);return}
      if(!known.has(r)){apply(false);return}
      const client=window.__QA_SUPABASE__;
      if(!client){apply(true);return}
      const {data,error}=await client.from("quality_role_tabs").select("is_enabled").eq("role",r).eq("tab_key",TAB_KEY).maybeSingle();
      if(error){console.warn("Cycle Trends permission check failed",error);apply(true);return}
      apply(data?.is_enabled!==false);
    }finally{checking=false}
  }
  function keepApplied(){
    if(lastEnabled===false)document.documentElement.setAttribute("data-qa-trends-disabled","1");
  }
  window.addEventListener("qa-auth-ready",()=>setTimeout(refresh,120));
  window.addEventListener("qa-permissions-updated",()=>setTimeout(refresh,80));
  window.addEventListener("qa-role-ready",()=>setTimeout(refresh,120));
  new MutationObserver(keepApplied).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(refresh,900),{once:true}):setTimeout(refresh,900);
})();