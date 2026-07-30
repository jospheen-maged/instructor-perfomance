(()=>{
  "use strict";
  const BLUE="#056FEC";
  const WHITE_LOGO="./iSchool-logo-white.svg?v=20260730-10";

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
      aside .qae-logo{display:flex!important;width:145px!important;height:auto!important;padding:0!important;align-items:center!important;justify-content:flex-start!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
      aside .qae-logo img{display:block!important;width:145px!important;max-width:100%!important;height:auto!important;background:transparent!important;filter:none!important}
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

  function applyLogo(){
    document.querySelectorAll("aside .qae-logo img").forEach(img=>{
      if(!img.src.includes("iSchool-logo-white.svg"))img.src=WHITE_LOGO;
      img.alt="iSchool";
    });
  }

  function apply(){injectStyle();applyLogo()}
  new MutationObserver(()=>setTimeout(apply,20)).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",apply,{once:true}):apply();
  setInterval(apply,1000);
})();