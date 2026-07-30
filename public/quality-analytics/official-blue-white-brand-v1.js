(()=>{
  "use strict";
  const BLUE="#056FEC";
  const WHITE_LOGO="./iSchool-logo-white.svg?v=20260730-12";

  function injectStyle(){
    if(document.getElementById("qa-official-blue-style"))return;
    const style=document.createElement("style");
    style.id="qa-official-blue-style";
    style.textContent=`
      html[data-qa-role] aside,
      aside{background:${BLUE}!important;color:#fff!important}
      aside .border-b{border-color:rgba(255,255,255,.22)!important}
      aside nav>p{color:rgba(255,255,255,.72)!important}
      aside nav button:not(.bg-white){color:rgba(255,255,255,.94)!important}
      aside nav button:not(.bg-white):hover{background:rgba(255,255,255,.14)!important;color:#fff!important}
      aside nav button.bg-white{background:#fff!important;color:${BLUE}!important;box-shadow:0 10px 28px rgba(0,48,122,.18)!important}
      aside nav button.bg-white svg{color:${BLUE}!important}
      aside .qae-logo.qa-fixed-sidebar-logo{
        display:block!important;
        flex:0 0 145px!important;
        width:145px!important;
        height:52px!important;
        padding:0!important;
        border:0!important;
        border-radius:0!important;
        background-color:transparent!important;
        background-image:url("${WHITE_LOGO}")!important;
        background-repeat:no-repeat!important;
        background-position:left center!important;
        background-size:contain!important;
        box-shadow:none!important;
      }
      aside .qae-logo.qa-fixed-sidebar-logo img{display:none!important}
      aside .qae-logo:not(.qa-fixed-sidebar-logo),
      aside .qa-old-sidebar-logo-hidden{display:none!important}
      aside .m-4.rounded-2xl{border-color:rgba(255,255,255,.24)!important;background:rgba(255,255,255,.12)!important}
      aside .m-4.rounded-2xl p,
      aside .m-4.rounded-2xl div{color:#fff!important}
      aside .text-blue-100,
      aside .text-blue-200,
      aside .text-blue-300{color:rgba(255,255,255,.82)!important}
      @media(max-width:1199px){aside{box-shadow:18px 0 50px rgba(0,58,150,.26)!important}}
    `;
    document.head.appendChild(style);
  }

  function preloadLogo(){
    if(document.querySelector('link[data-qa-white-logo="1"]'))return;
    const link=document.createElement("link");
    link.rel="preload";
    link.as="image";
    link.href=WHITE_LOGO;
    link.dataset.qaWhiteLogo="1";
    document.head.appendChild(link);
  }

  function ensureLogo(){
    const row=document.querySelector("aside .border-b .flex.items-center.gap-3");
    if(!row)return;
    let logo=row.querySelector(".qa-fixed-sidebar-logo");
    if(!logo){
      logo=row.querySelector(".qae-logo");
      if(logo){
        logo.classList.add("qa-fixed-sidebar-logo");
        logo.replaceChildren();
      }else{
        logo=document.createElement("div");
        logo.className="qae-logo qa-fixed-sidebar-logo";
        logo.setAttribute("role","img");
        logo.setAttribute("aria-label","iSchool");
        row.insertBefore(logo,row.firstChild||null);
      }
    }
    [...row.children].forEach(child=>{
      if(child===logo||child.tagName==="BUTTON")return;
      if(child.querySelector("p"))return;
      if(child.classList.contains("qae-logo"))child.classList.add("qa-old-sidebar-logo-hidden");
      else if(child.textContent?.trim()==="iS")child.classList.add("qa-old-sidebar-logo-hidden");
    });
  }

  function apply(){injectStyle();ensureLogo()}
  preloadLogo();
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",apply,{once:true}):apply();
  window.addEventListener("qa-auth-ready",apply);
  let queued=false;
  new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;ensureLogo()});
  }).observe(document.documentElement,{childList:true,subtree:true});
})();