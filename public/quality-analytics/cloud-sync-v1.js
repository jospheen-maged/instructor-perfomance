(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets";
  let suppress=false,appLoaded=false;
  const timers=new Map();
  const clean=v=>String(v??"").trim();
  function reviewKey(row){return [row["Tutor ID"],row["Session Recording"]||row["Lesson Name"],row["Review Date"],row["QC Name"]].map(clean).join("|")}
  function objectionKey(row){return clean(row["Objection ID"]||`${row["Quality Review ID"]}|${row["Objected Item"]}|${row["Objection Created At"]}`)}
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function readLocal(kind){try{const d=await openDB();return await new Promise((ok,no)=>{const q=d.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}catch{return[]}}
  async function writeLocal(kind,rows){const d=await openDB();suppress=true;try{await new Promise((ok,no)=>{const tx=d.transaction(STORE,"readwrite");tx.objectStore(STORE).put(rows,kind);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error)})}finally{suppress=false}}
  function status(text,tone="blue"){
    let b=document.getElementById("qa-cloud-status");if(!b){b=document.createElement("div");b.id="qa-cloud-status";b.style.cssText="position:fixed;right:18px;top:18px;z-index:999998;padding:8px 12px;border-radius:999px;background:#fff;box-shadow:0 8px 26px rgba(31,42,85,.14);font:700 11px Inter,system-ui;color:#1F2A55;border:1px solid #dbe7f5";document.body.appendChild(b)}
    b.textContent=text;b.style.color=tone==="red"?"#b42318":tone==="green"?"#128157":"#056FEC";
  }
  function packageRows(kind,rows){const key=kind==="reviews"?reviewKey:objectionKey;return rows.map(row=>({record_key:key(row),cycle:clean(kind==="reviews"?row.Review_Cycle:row["Review Cycle"]),payload:row})).filter(row=>row.record_key)}
  async function upload(kind,rows){
    if(window.__QA_ROLE__!=="admin")return;
    const client=window.__QA_SUPABASE__;if(!client)return;
    status(`Saving ${kind} to cloud…`);
    const {data,error}=await client.rpc("replace_quality_dataset",{p_kind:kind,p_rows:packageRows(kind,rows)});
    if(error){status("Cloud save failed — run the SQL upgrade", "red");console.error(error);return}
    status(`${Number(data)||rows.length} ${kind} saved to cloud`,"green");setTimeout(()=>document.getElementById("qa-cloud-status")?.remove(),3500);
  }
  function queueUpload(kind,rows){clearTimeout(timers.get(kind));timers.set(kind,setTimeout(()=>upload(kind,rows),900))}
  function patchIndexedDB(){
    if(window.__QA_IDB_PATCHED__)return;window.__QA_IDB_PATCHED__=true;
    const originalPut=IDBObjectStore.prototype.put,originalClear=IDBObjectStore.prototype.clear;
    IDBObjectStore.prototype.put=function(value,key){const request=originalPut.call(this,value,key);if(!suppress&&this.name===STORE&&["reviews","objections"].includes(String(key))&&Array.isArray(value)){request.addEventListener("success",()=>queueUpload(String(key),value))}return request};
    IDBObjectStore.prototype.clear=function(){const request=originalClear.call(this);if(!suppress&&this.name===STORE&&window.__QA_ROLE__==="admin"){request.addEventListener("success",()=>{queueUpload("reviews",[]);queueUpload("objections",[])})}return request};
  }
  async function cloudRows(client,fn){const {data,error}=await client.rpc(fn);if(error)throw error;return Array.isArray(data)?data:[]}
  async function syncBeforeApp(detail){
    patchIndexedDB();const {client,role}=detail;
    status("Loading shared cloud data…");
    const localReviews=await readLocal("reviews"),localObjections=await readLocal("objections");
    try{
      const [cloudReviews,cloudObjections]=await Promise.all([cloudRows(client,"get_quality_reviews"),cloudRows(client,"get_quality_objections")]);
      if(role==="admin"&&cloudReviews.length===0&&localReviews.length){await upload("reviews",localReviews)}else await writeLocal("reviews",cloudReviews);
      if(role==="admin"&&cloudObjections.length===0&&localObjections.length){await upload("objections",localObjections)}else await writeLocal("objections",cloudObjections);
      status("Cloud data ready","green");setTimeout(()=>document.getElementById("qa-cloud-status")?.remove(),2600);
    }catch(error){
      console.error(error);
      if(role!=="admin"){await writeLocal("reviews",[]);await writeLocal("objections",[])}
      status("Cloud setup incomplete — run the SQL upgrade","red");
    }
    if(!appLoaded){appLoaded=true;import(`./app.js?v=20260730-5`).catch(error=>{console.error(error);status("Dashboard failed to load","red")})}
  }
  function ready(){if(window.__QA_SESSION__&&window.__QA_SUPABASE__)syncBeforeApp({client:window.__QA_SUPABASE__,role:window.__QA_ROLE__});else window.addEventListener("qa-auth-ready",event=>syncBeforeApp(event.detail),{once:true})}
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",ready,{once:true}):ready();
})();