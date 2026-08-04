(()=>{
  "use strict";
  const VIEW="#qdf-view",FILTER=".qdf-filters",KEY="qa-qc-daily-filters-collapsed";
  const icon=()=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  function style(){
    if(document.getElementById("qdf-filter-visibility-style"))return;
    const s=document.createElement("style");s.id="qdf-filter-visibility-style";s.textContent=`
      body.qdf-active ${VIEW} ${FILTER}{display:block!important;visibility:visible!important;opacity:1!important;overflow:visible!important;border:1px solid #cfe0f5!important;background:#f8fbff!important}
      body.qdf-active ${VIEW} ${FILTER}>summary{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;min-height:58px!important;padding:15px 16px!important;list-style:none!important;cursor:pointer!important}
      body.qdf-active ${VIEW} ${FILTER}>summary::-webkit-details-marker{display:none!important}
      body.qdf-active ${VIEW} ${FILTER}[open]>.qdf-grid{display:grid!important;visibility:visible!important;opacity:1!important}
      body.qdf-active ${VIEW} ${FILTER}:not([open])>.qdf-grid{display:none!important}
      .qdf-filter-chevron{display:grid;width:36px;height:36px;flex:0 0 auto;place-items:center;border:1px solid #cfe0f5;border-radius:10px;background:#fff;color:#056fec}
      .qdf-filter-chevron svg{width:18px;height:18px;transition:transform .2s ease}
      ${FILTER}:not([open]) .qdf-filter-chevron svg{transform:rotate(-90deg)}
      .qdf-filter-count{display:inline-flex;margin-left:8px;padding:3px 7px;border-radius:999px;background:#eaf3ff;color:#056fec;font-size:9px;font-weight:900;vertical-align:middle}
      @media(max-width:760px){body.qdf-active ${VIEW} ${FILTER}>summary{padding:13px 14px!important}.qdf-filter-chevron{width:34px;height:34px}}
    `;document.head.appendChild(s);
  }
  function apply(){
    style();
    const panel=document.querySelector(`${VIEW} ${FILTER}`);if(!panel)return;
    panel.hidden=false;
    if(panel.dataset.qdfFixed!=="1"){
      panel.dataset.qdfFixed="1";
      let collapsed=false;try{collapsed=localStorage.getItem(KEY)==="1"}catch{}
      panel.open=!collapsed;
      const summary=panel.querySelector(":scope > summary");
      if(summary&&!summary.querySelector(".qdf-filter-chevron")){
        const controls=panel.querySelectorAll("select,input").length;
        const title=summary.querySelector("b");
        if(title&&!summary.querySelector(".qdf-filter-count"))title.insertAdjacentHTML("afterend",`<span class="qdf-filter-count">${controls} filters</span>`);
        summary.insertAdjacentHTML("beforeend",`<span class="qdf-filter-chevron">${icon()}</span>`);
      }
      panel.addEventListener("toggle",()=>{try{localStorage.setItem(KEY,panel.open?"0":"1")}catch{}});
    }
    const grid=panel.querySelector(":scope > .qdf-grid");
    if(grid){grid.hidden=false;if(panel.open)grid.style.removeProperty("display")}
  }
  window.addEventListener("qa-auth-ready",()=>setTimeout(apply,700));
  window.addEventListener("qa-cloud-data-ready",()=>setTimeout(apply,300));
  document.addEventListener("click",()=>setTimeout(apply,80));
  new MutationObserver(()=>setTimeout(apply,40)).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(apply,1000),{once:true}):setTimeout(apply,1000);
  setInterval(apply,1200);
})();