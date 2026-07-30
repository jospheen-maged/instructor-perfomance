(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets";
  let names=[],signature="",queued=false;
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const role=()=>window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaAccessRole||window.__QA_ROLE__||document.documentElement.dataset.qaRole||"";
  const allowed=()=>["admin","management","quality"].includes(role());
  const pick=(row,keys)=>{
    const source=row?.payload&&typeof row.payload==="object"?row.payload:row||{};
    for(const key of keys){const value=clean(source[key]);if(value&&value!=="--")return value}
    return "";
  };
  function openDB(){return new Promise((ok,no)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE)};request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error)})}
  async function read(kind){try{const db=await openDB();return await new Promise((ok,no)=>{const request=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);request.onsuccess=()=>ok(Array.isArray(request.result)?request.result:[]);request.onerror=()=>no(request.error)})}catch{return[]}}
  async function loadNames(){
    if(!allowed())return;
    const [reviews,objections]=await Promise.all([read("reviews"),read("objections")]);
    const found=[
      ...reviews.map(row=>pick(row,["QC Name","QC_Name","QC","QC Reviewer","Reviewer Name","Quality Controller"])),
      ...objections.map(row=>pick(row,["QC Reviewer","QC Name","QC_Name","QC","Reviewer Name","Quality Controller"]))
    ].filter(Boolean);
    names=[...new Map(found.map(value=>[value.toLocaleLowerCase(),value])).values()].sort((a,b)=>a.localeCompare(b));
    signature=names.join("|");
    apply();
  }
  function qcSelects(){
    return [...document.querySelectorAll("main label")].map(label=>({label,span:label.querySelector("span"),select:label.querySelector("select")})).filter(item=>item.select&&/^QCs?$/i.test(clean(item.span?.textContent)));
  }
  function apply(){
    if(!allowed()||!names.length)return;
    qcSelects().forEach(({select})=>{
      const current=select.value;
      const existing=new Set([...select.options].map(option=>clean(option.value).toLocaleLowerCase()));
      names.forEach(name=>{
        if(existing.has(name.toLocaleLowerCase()))return;
        const option=document.createElement("option");
        option.value=name;option.textContent=name;option.dataset.qaQcOption="1";
        select.appendChild(option);
      });
      if(current&&names.some(name=>name===current))select.value=current;
      select.dataset.qaQcNames=String(names.length);
    });
  }
  function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
  window.addEventListener("qa-auth-ready",()=>setTimeout(loadNames,250));
  window.addEventListener("qa-cloud-data-ready",()=>setTimeout(loadNames,100));
  document.addEventListener("change",event=>{if(event.target instanceof HTMLSelectElement)setTimeout(queue,0)});
  new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(loadNames,600),{once:true}):setTimeout(loadNames,600);
  setInterval(()=>{if(allowed()){apply();if(!names.length)loadNames()}},1500);
})();