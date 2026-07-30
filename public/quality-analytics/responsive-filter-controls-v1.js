(()=>{
  "use strict";
  const GLOBAL_KEY="qa-global-filters-collapsed";
  const ADVANCED_KEY="qa-advanced-filters-collapsed";
  const text=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
  const stored=(key)=>{const v=localStorage.getItem(key);return v===null?window.matchMedia("(max-width: 700px)").matches:v==="1"};
  const save=(key,value)=>localStorage.setItem(key,value?"1":"0");

  function style(){
    if(document.getElementById("qa-responsive-filter-style"))return;
    const s=document.createElement("style");
    s.id="qa-responsive-filter-style";
    s.textContent=`
      html,body,#root{max-width:100%;overflow-x:hidden!important}
      main{min-width:0!important}
      main>div,main .space-y-6,.qti-panel,#qae-panel,.qti-box,.qae-box{min-width:0!important;max-width:100%!important}
      #qae-panel>header>img{display:none!important}
      #qae-panel>header{align-items:flex-start!important}
      .qa-filter-toggle{display:inline-grid!important;width:38px!important;height:38px!important;padding:0!important;place-items:center!important;flex:0 0 auto!important;border:1px solid #cfe0f5!important;border-radius:11px!important;background:#fff!important;color:#056FEC!important;cursor:pointer!important;box-shadow:none!important}
      .qa-filter-toggle svg{width:18px;height:18px;transition:transform .2s ease}
      .qa-filter-collapsed .qa-filter-toggle svg{transform:rotate(-90deg)}
      .qa-filter-collapsed>.qa-filter-body{display:none!important}
      .qa-filter-header-actions{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important}
      .qa-filter-header>button:not(.qa-filter-toggle){margin-left:auto!important}
      .qa-global-filter-card>.qa-filter-header{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important}
      .qti-filter-head{gap:10px!important}
      .qti-scroll,.qae-scroll{display:block!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overscroll-behavior-inline:contain;scrollbar-gutter:stable}
      .qti-scroll table,.qae-scroll table{width:max-content!important;min-width:100%!important;max-width:none!important}
      .qti-scroll th,.qti-scroll td,.qae-scroll th,.qae-scroll td{white-space:nowrap!important}
      .qti-panel,.qae-panel{overflow:hidden!important}
      .qti-filter-grid{grid-template-columns:repeat(4,minmax(150px,1fr))!important}
      .qti-kpis,.qae-cards{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      .qti-grid,.qae-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      @media(min-width:1200px){
        aside{width:248px!important}
        main{padding-left:248px!important}
      }
      @media(max-width:1399px){
        .qti-filter-grid{grid-template-columns:repeat(3,minmax(150px,1fr))!important}
        .qti-kpis,.qae-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}
        .qti-grid,.qae-grid{grid-template-columns:1fr!important}
        .qti-panel,#qae-panel{padding:18px!important}
      }
      @media(max-width:1199px){
        aside{width:280px!important}
        aside.-translate-x-full{transform:translateX(-100%)!important}
        aside.translate-x-0{transform:translateX(0)!important}
        main{padding-left:0!important}
        main header button.lg\\:hidden{display:inline-flex!important}
        .qti-filter-grid{grid-template-columns:repeat(2,minmax(145px,1fr))!important}
      }
      @media(max-width:760px){
        main>header{padding:12px 14px!important}
        main>header h1{font-size:20px!important}
        main .space-y-6{padding:12px!important;gap:14px!important}
        .qti-panel,#qae-panel{padding:14px!important;border-radius:18px!important;gap:14px!important}
        .qti-panel>header,#qae-panel>header{flex-direction:column!important;align-items:stretch!important}
        .qti-actions{justify-content:flex-start!important}
        .qti-filter{padding:13px!important}
        .qti-filter-grid{grid-template-columns:1fr!important}
        .qti-kpis,.qae-cards{grid-template-columns:1fr!important}
        .qti-grid,.qae-grid{grid-template-columns:1fr!important}
        .qti-box,.qae-box{padding:14px!important}
        .qti-scroll table,.qae-scroll table{min-width:850px!important}
        #qa-access-controls{right:8px!important;bottom:8px!important;max-width:calc(100vw - 16px)!important}
        #qa-role-badge{display:none!important}
      }
      @media(max-width:480px){
        .qa-global-filter-card>.qa-filter-header,.qti-filter-head{align-items:flex-start!important}
        .qa-filter-header-actions{flex-shrink:0!important}
        .qti-panel h2,#qae-panel h2{font-size:19px!important}
        .qti-actions button{width:100%!important}
      }
    `;
    document.head.appendChild(s);
  }

  function icon(){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`}

  function setCollapsed(card,body,button,key,value){
    card.classList.toggle("qa-filter-collapsed",value);
    body.classList.add("qa-filter-body");
    button.setAttribute("aria-expanded",String(!value));
    button.title=value?"Open filters":"Close filters";
    save(key,value);
  }

  function makeToggle(card,header,body,key){
    if(!card||!header||!body||card.dataset.qaCollapsible==="1")return;
    card.dataset.qaCollapsible="1";
    card.classList.add("qa-filter-section");
    header.classList.add("qa-filter-header");
    body.classList.add("qa-filter-body");
    const actions=document.createElement("div");
    actions.className="qa-filter-header-actions";
    const button=document.createElement("button");
    button.type="button";button.className="qa-filter-toggle";button.innerHTML=icon();
    actions.appendChild(button);header.appendChild(actions);
    const initial=stored(key);
    setCollapsed(card,body,button,key,initial);
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();setCollapsed(card,body,button,key,!card.classList.contains("qa-filter-collapsed"))});
  }

  function globalCard(){
    const candidates=[...document.querySelectorAll("main .rounded-2xl")].filter(el=>/Global filters/i.test(text(el))&&/Reset all/i.test(text(el)));
    candidates.sort((a,b)=>a.querySelectorAll("*").length-b.querySelectorAll("*").length);
    return candidates[0]||null;
  }

  function enhanceGlobal(){
    const card=globalCard();if(!card)return;
    card.classList.add("qa-global-filter-card");
    const title=[...card.querySelectorAll("div,p,span")].find(el=>/^Global filters$/i.test(text(el)));
    if(!title)return;
    let header=title;
    while(header.parentElement&&header.parentElement!==card)header=header.parentElement;
    const body=[...card.children].find(el=>el!==header&&el.querySelector("select"));
    makeToggle(card,header,body,GLOBAL_KEY);
  }

  function enhanceAdvanced(){
    document.querySelectorAll(".qti-filter").forEach(card=>{
      const header=card.querySelector(":scope > .qti-filter-head");
      const body=card.querySelector(":scope > .qti-filter-grid");
      makeToggle(card,header,body,ADVANCED_KEY);
    });
  }

  function removeInnerLogo(){document.querySelectorAll("#qae-panel>header>img").forEach(img=>img.remove())}

  function apply(){style();enhanceGlobal();enhanceAdvanced();removeInnerLogo()}
  new MutationObserver(()=>setTimeout(apply,30)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("resize",()=>setTimeout(apply,50));
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",apply,{once:true}):apply();
  setInterval(apply,1200);
})();