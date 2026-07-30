(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets";
  let names=[],selected="",queued=false,loading=false;
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const role=()=>window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaAccessRole||window.__QA_ROLE__||document.documentElement.dataset.qaRole||"";
  const allowed=()=>["admin","management","quality"].includes(role());
  const pick=(row,keys)=>{
    const source=row?.payload&&typeof row.payload==="object"?row.payload:row||{};
    for(const key of keys){const value=clean(source[key]);if(value&&value!=="--")return value}
    return "";
  };
  function style(){
    if(document.getElementById("qa-qc-filter-style"))return;
    const s=document.createElement("style");
    s.id="qa-qc-filter-style";
    s.textContent=`
      .qa-qc-original-wrap{display:none!important}
      .qa-qc-proxy-wrap{position:relative;width:100%}
      .qa-qc-proxy{width:100%!important;appearance:none!important;border:1px solid #dbe4ef!important;border-radius:12px!important;background:#fff!important;padding:10px 36px 10px 12px!important;color:#334155!important;font:600 14px Inter,system-ui!important;outline:none!important}
      .qa-qc-proxy:focus{border-color:#056FEC!important;box-shadow:0 0 0 3px rgba(5,111,236,.12)!important}
      .qa-qc-proxy-arrow{position:absolute;right:12px;top:50%;width:8px;height:8px;border-right:2px solid #94a3b8;border-bottom:2px solid #94a3b8;transform:translateY(-65%) rotate(45deg);pointer-events:none}
    `;
    document.head.appendChild(s);
  }
  function openDB(){return new Promise((ok,no)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error)})}
  async function read(kind){try{const db=await openDB();return await new Promise((ok,no)=>{const request=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);request.onsuccess=()=>ok(Array.isArray(request.result)?request.result:[]);request.onerror=()=>no(request.error)})}catch{return[]}}
  async function loadNames(){
    if(!allowed()||loading)return;loading=true;
    try{
      const [reviews,objections]=await Promise.all([read("reviews"),read("objections")]);
      const found=[
        ...reviews.map(row=>pick(row,["QC Name","QC_Name","QC","QC Reviewer","Reviewer Name","Quality Controller"])),
        ...objections.map(row=>pick(row,["QC Reviewer","QC Name","QC_Name","QC","Reviewer Name","Quality Controller"]))
      ].filter(Boolean);
      names=[...new Map(found.map(value=>[value.toLocaleLowerCase(),value])).values()].sort((a,b)=>a.localeCompare(b));
      apply();
    }finally{loading=false}
  }
  function qcFields(){
    return [...document.querySelectorAll("main label")].map(label=>({label,span:label.querySelector("span"),select:[...label.querySelectorAll("select")].find(x=>!x.classList.contains("qa-qc-proxy"))})).filter(item=>item.select&&/^QCs?$/i.test(clean(item.span?.textContent)));
  }
  function setReactValue(select,value){
    if(value&&!Array.from(select.options).some(option=>option.value===value)){
      const option=document.createElement("option");option.value=value;option.textContent=value;select.appendChild(option);
    }
    const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;
    setter?setter.call(select,value):(select.value=value);
    select.dispatchEvent(new Event("input",{bubbles:true}));
    select.dispatchEvent(new Event("change",{bubbles:true}));
  }
  function ensureProxy(label,original){
    const originalWrap=original.closest("div")||original;
    originalWrap.classList.add("qa-qc-original-wrap");
    let wrap=label.querySelector(":scope > .qa-qc-proxy-wrap");
    if(!wrap){
      wrap=document.createElement("div");wrap.className="qa-qc-proxy-wrap";
      const proxy=document.createElement("select");proxy.className="qa-qc-proxy";proxy.setAttribute("aria-label","QCs");
      const arrow=document.createElement("i");arrow.className="qa-qc-proxy-arrow";
      wrap.append(proxy,arrow);label.appendChild(wrap);
      proxy.addEventListener("change",()=>{selected=proxy.value;setReactValue(original,selected)});
    }
    const proxy=wrap.querySelector("select");
    const wanted=["",...names];
    const currentOptions=[...proxy.options].map(x=>x.value);
    if(currentOptions.join("|")!==wanted.join("|")){
      proxy.replaceChildren();
      const all=document.createElement("option");all.value="";all.textContent="All QCs";proxy.appendChild(all);
      names.forEach(name=>{const option=document.createElement("option");option.value=name;option.textContent=name;proxy.appendChild(option)});
    }
    proxy.value=names.includes(selected)?selected:"";
    proxy.disabled=!names.length;
  }
  function apply(){
    style();
    if(!allowed())return;
    qcFields().forEach(({label,select})=>ensureProxy(label,select));
  }
  function resetIfNeeded(event){
    const button=event.target?.closest?.("button");
    if(button&&/^Reset all$/i.test(clean(button.textContent))){selected="";setTimeout(()=>{qcFields().forEach(({select})=>setReactValue(select,""));apply()},0)}
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
  window.addEventListener("qa-auth-ready",()=>setTimeout(loadNames,200));
  window.addEventListener("qa-cloud-data-ready",()=>setTimeout(loadNames,80));
  document.addEventListener("click",resetIfNeeded);
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(loadNames,500),{once:true}):setTimeout(loadNames,500);
  setInterval(()=>{if(allowed()){apply();if(!names.length)loadNames()}},1200);
})();