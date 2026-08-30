(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets",BTN="qa-import-cycle",MODAL="qa-import-cycle-modal";
  let state=null,busy=false;
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const norm=v=>clean(v).toLowerCase();
  const esc=v=>clean(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const role=()=>window.__QA_ROLE__||window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaRole||document.documentElement.dataset.qaAccessRole||"";
  const isAdmin=()=>role()==="admin";
  const kindCycle=(kind,row)=>clean(kind==="reviews"?row.Review_Cycle:row["Review Cycle"]);
  function reviewKey(row){return [row["Tutor ID"],row["Session Recording"]||row["Lesson Name"],row["Review Date"],row["QC Name"]].map(norm).join("|")}
  function objectionKey(row){return norm(row["Objection ID"]||`${row["Quality Review ID"]}|${row["Objected Item"]}|${row["Objection Created At"]}`)}
  const keyFn=kind=>kind==="reviews"?reviewKey:objectionKey;
  function parseCSV(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(ch==='"'){
        if(quoted&&next==='"'){field+='"';i++}else quoted=!quoted;
      }else if(ch===","&&!quoted){row.push(field);field=""}
      else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&next==="\n")i++;row.push(field);if(row.some(x=>clean(x)))rows.push(row);row=[];field=""}
      else field+=ch;
    }
    row.push(field);if(row.some(x=>clean(x)))rows.push(row);
    if(!rows.length)return[];
    const headers=rows[0].map((h,i)=>clean(h.replace(/^\uFEFF/,""))||`Column ${i+1}`);
    return rows.slice(1).map(cells=>Object.fromEntries(headers.map((h,i)=>[h,clean(cells[i]??"")])));
  }
  function detectKind(rows){
    const h=new Set(Object.keys(rows[0]||{}));
    if(h.has("Review_Cycle")&&h.has("QC Name")&&h.has("Tutor ID"))return"reviews";
    if(h.has("Review Cycle")&&h.has("QC Reviewer")&&h.has("Objection ID"))return"objections";
    throw new Error("Could not identify the file. Upload a Quality Reviews or Quality Objections CSV.");
  }
  function validate(kind,rows){
    const required=kind==="reviews"?["Tutor ID","QC Name","Review Date","Review_Cycle"]:["Objection ID","QC Reviewer","Objection Created At","Review Cycle"];
    const headers=new Set(Object.keys(rows[0]||{})),missing=required.filter(x=>!headers.has(x));
    if(missing.length)throw new Error(`Missing columns: ${missing.join(", ")}`);
    const blankCycles=rows.filter(r=>!kindCycle(kind,r)).length;
    if(blankCycles)throw new Error(`${blankCycles} row(s) have no review cycle. Add the cycle before uploading.`);
  }
  function dedupe(kind,rows){
    const key=keyFn(kind),map=new Map(),blank=[];
    rows.forEach((row,index)=>{const k=key(row);if(!k||/^\|+$/.test(k))blank.push(index+2);else map.set(k,row)});
    if(blank.length)throw new Error(`Could not create a unique key for row(s): ${blank.slice(0,8).join(", ")}${blank.length>8?"…":""}`);
    return[...map.values()];
  }
  function cycleRank(value){
    const m=clean(value).match(/^([A-Za-z]+)\s+(\d{4})$/);if(!m)return 0;
    const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
    const month=months.indexOf(m[1].toLowerCase());return month<0?0:Number(m[2])*12+month;
  }
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function read(kind){const db=await openDB();return await new Promise((ok,no)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}
  async function write(kind,rows){const db=await openDB();return await new Promise((ok,no)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(rows,kind);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error)})}
  function styles(){
    if(document.getElementById("qa-cycle-import-style"))return;
    const s=document.createElement("style");s.id="qa-cycle-import-style";s.textContent=`
      #${BTN}{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 14px;border:1px solid #b9d5f7;border-radius:12px;background:#fff;color:#056FEC;font-size:13px;font-weight:850;box-shadow:0 6px 18px rgba(31,42,85,.06);cursor:pointer}#${BTN}:hover{background:#f3f8ff}#${BTN} svg{width:17px;height:17px}
      #${MODAL}{position:fixed;inset:0;z-index:1000001;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.58);backdrop-filter:blur(8px)}#${MODAL}[hidden]{display:none}
      .qci-box{width:min(780px,100%);max-height:90vh;overflow:auto;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(15,23,42,.28)}.qci-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid #e5edf6}.qci-head small{color:#056FEC;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.15em}.qci-head h2{margin:5px 0 4px;color:#1F2A55;font-size:22px;font-weight:900}.qci-head p{margin:0;color:#718096;font-size:12px;line-height:1.5}.qci-x{width:38px;height:38px;border:0;border-radius:11px;background:#f1f5f9;color:#1F2A55;font-size:20px;cursor:pointer}.qci-body{padding:22px 24px}.qci-alert{padding:13px 14px;border:1px solid #cfe0f5;border-radius:14px;background:#f7fbff;color:#42526b;font-size:12px;line-height:1.55}.qci-mode{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.qci-mode label{display:flex;gap:10px;align-items:flex-start;padding:13px;border:1px solid #e1e8f0;border-radius:14px;cursor:pointer}.qci-mode label:has(input:checked){border-color:#7ab5ff;background:#f2f8ff}.qci-mode b{display:block;color:#1F2A55;font-size:12px}.qci-mode span{display:block;margin-top:3px;color:#718096;font-size:10px;line-height:1.45}.qci-cycles{display:grid;gap:8px;margin-top:16px}.qci-cycle{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:11px 12px;border:1px solid #e3eaf3;border-radius:13px}.qci-cycle b{color:#1F2A55;font-size:12px}.qci-cycle small{color:#718096;font-size:10px}.qci-pill{padding:5px 8px;border-radius:999px;background:#eef4fb;color:#526477;font-size:9px;font-weight:850}.qci-pill.exists{background:#fff1f1;color:#b42318}.qci-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.qci-stat{padding:12px;border:1px solid #e3eaf3;border-radius:14px}.qci-stat small{display:block;color:#8494a7;font-size:9px;font-weight:900;text-transform:uppercase}.qci-stat b{display:block;margin-top:6px;color:#1F2A55;font-size:20px}.qci-error{margin-top:12px;color:#b42318;font-size:12px;font-weight:750;min-height:18px}.qci-foot{display:flex;justify-content:flex-end;gap:9px;padding:17px 24px;border-top:1px solid #e5edf6}.qci-foot button{height:40px;padding:0 15px;border-radius:11px;font-size:12px;font-weight:850;cursor:pointer}.qci-cancel{border:1px solid #d8e1ec;background:#fff;color:#526477}.qci-confirm{border:0;background:#056FEC;color:#fff}.qci-confirm:disabled{opacity:.55;cursor:not-allowed}
      @media(max-width:680px){.qci-grid{grid-template-columns:1fr 1fr}.qci-mode{grid-template-columns:1fr}.qci-box{border-radius:18px}.qci-head,.qci-body,.qci-foot{padding-left:16px;padding-right:16px}#${BTN}{padding:0 11px;font-size:12px}}
    `;document.head.appendChild(s);
  }
  function modal(){
    let m=document.getElementById(MODAL);if(m)return m;
    m=document.createElement("div");m.id=MODAL;m.hidden=true;m.innerHTML=`<div class="qci-box" role="dialog" aria-modal="true"><div class="qci-head"><div><small>Cycle Data Manager</small><h2>Import Cycle</h2><p>Add a new cycle without deleting previous months, or replace only a selected existing cycle.</p></div><button class="qci-x" data-close aria-label="Close">×</button></div><div class="qci-body" data-body></div><div class="qci-foot"><button class="qci-cancel" data-close>Cancel</button><button class="qci-confirm" data-confirm>Import Selected Cycle</button></div></div>`;
    m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-close]")){m.hidden=true;state=null}});
    m.querySelector("[data-confirm]").addEventListener("click",confirmImport);
    document.body.appendChild(m);return m;
  }
  function selectedMode(){return modal().querySelector('input[name="qci-mode"]:checked')?.value||"add"}
  function selectedCycles(){return [...modal().querySelectorAll('[data-cycle-check]:checked')].map(x=>x.value)}
  function updatePreview(){
    if(!state)return;
    const m=modal(),selected=selectedCycles(),mode=selectedMode(),set=new Set(selected.map(norm));
    const incoming=state.incoming.filter(r=>set.has(norm(kindCycle(state.kind,r))));
    const existingSet=new Set(state.current.map(r=>norm(kindCycle(state.kind,r))).filter(Boolean));
    const conflicts=selected.filter(c=>existingSet.has(norm(c)));
    let kept=state.current,removed=0,error="";
    if(!selected.length)error="Select at least one cycle.";
    if(mode==="add"&&conflicts.length)error=`Already saved: ${conflicts.join(", ")}. Use “Replace existing cycle” for those cycles.`;
    if(mode==="replace"){
      kept=state.current.filter(r=>!set.has(norm(kindCycle(state.kind,r))));
      removed=state.current.length-kept.length;
    }
    const finalRows=error?[]:dedupe(state.kind,[...kept,...incoming]);
    state.preview={selected,mode,incoming,kept,removed,finalRows,error};
    m.querySelector("[data-selected-rows]").textContent=String(incoming.length);
    m.querySelector("[data-removed]").textContent=String(removed);
    m.querySelector("[data-kept]").textContent=String(kept.length);
    m.querySelector("[data-final]").textContent=error?"—":String(finalRows.length);
    m.querySelector("[data-error]").textContent=error;
    const btn=m.querySelector("[data-confirm]");btn.disabled=!!error||busy;btn.textContent=mode==="replace"?"Replace Selected Cycle":"Import Selected Cycle";
  }
  function showPreview(data){
    state=data;const m=modal(),b=m.querySelector("[data-body]");m.hidden=false;
    const latest=[...data.cycles].sort((a,b)=>cycleRank(b)-cycleRank(a))[0]||data.cycles[0];
    const existingSet=new Set(data.current.map(r=>norm(kindCycle(data.kind,r))).filter(Boolean));
    b.innerHTML=`<div class="qci-alert"><b>${data.kind==="reviews"?"Reviews":"Objections"} file detected.</b> Choose exactly which cycle(s) to import. Previous cycles stay saved unless you explicitly choose Replace.</div><div class="qci-mode"><label><input type="radio" name="qci-mode" value="add" checked><div><b>Add as new cycle</b><span>Keeps every saved cycle. Existing cycle names are blocked to prevent accidental overwrite.</span></div></label><label><input type="radio" name="qci-mode" value="replace"><div><b>Replace existing cycle</b><span>Deletes only the selected cycle(s), then inserts the rows from this CSV.</span></div></label></div><div class="qci-cycles">${data.cycles.map(c=>{const count=data.incoming.filter(r=>norm(kindCycle(data.kind,r))===norm(c)).length,exists=existingSet.has(norm(c));return `<label class="qci-cycle"><input data-cycle-check type="checkbox" value="${esc(c)}" ${c===latest?"checked":""}><div><b>${esc(c)}</b><br><small>${count} clean row${count===1?"":"s"} in file</small></div><span class="qci-pill ${exists?"exists":""}">${exists?"Already saved":"New cycle"}</span></label>`}).join("")}</div><div class="qci-grid"><div class="qci-stat"><small>Rows in file</small><b>${data.rawCount}</b></div><div class="qci-stat"><small>Duplicates removed</small><b>${data.duplicates}</b></div><div class="qci-stat"><small>Selected rows</small><b data-selected-rows>0</b></div><div class="qci-stat"><small>Old rows removed</small><b data-removed>0</b></div><div class="qci-stat"><small>Existing rows kept</small><b data-kept>0</b></div><div class="qci-stat"><small>Final dataset</small><b data-final>0</b></div></div><div class="qci-error" data-error></div>`;
    b.querySelectorAll('input[name="qci-mode"],[data-cycle-check]').forEach(el=>el.addEventListener("change",updatePreview));
    updatePreview();
  }
  async function choose(file){
    if(!file)return;
    try{
      const text=await file.text(),raw=parseCSV(text);if(!raw.length)throw new Error("The CSV file is empty.");
      const kind=detectKind(raw);validate(kind,raw);
      const incoming=dedupe(kind,raw),cycles=[...new Set(incoming.map(r=>kindCycle(kind,r)).filter(Boolean))].sort((a,b)=>cycleRank(b)-cycleRank(a)||a.localeCompare(b));
      const current=await read(kind);
      showPreview({kind,rawCount:raw.length,incoming,duplicates:raw.length-incoming.length,cycles,current});
    }catch(error){alert(error?.message||"Could not process this file.")}
  }
  async function confirmImport(){
    if(!state||busy)return;updatePreview();if(state.preview?.error)return;
    busy=true;const m=modal(),btn=m.querySelector("[data-confirm]"),error=m.querySelector("[data-error]");btn.disabled=true;btn.textContent="Saving…";error.textContent="";
    try{
      await write(state.kind,state.preview.finalRows);
      btn.textContent="Saved — syncing cloud…";
      setTimeout(()=>location.reload(),3200);
    }catch(err){error.textContent=err?.message||"Save failed.";btn.disabled=false;btn.textContent="Import Selected Cycle";busy=false}
  }
  function inject(){
    if(!isAdmin()){document.getElementById(BTN)?.remove();return}
    if(document.getElementById(BTN))return;
    const upload=[...document.querySelectorAll("button")].find(b=>/^upload data$/i.test(clean(b.textContent)));if(!upload)return;
    const b=document.createElement("button");b.id=BTN;b.type="button";b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0-12 4 4m-4-4-4 4"/><path d="M5 21h14a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2"/></svg><span>Import Cycle</span>`;
    b.title="Import a new cycle or safely replace one existing cycle";
    b.addEventListener("click",()=>{const input=document.createElement("input");input.type="file";input.accept=".csv,text/csv";input.hidden=true;input.addEventListener("change",()=>choose(input.files?.[0]),{once:true});document.body.appendChild(input);input.click();setTimeout(()=>input.remove(),60000)});
    upload.insertAdjacentElement("beforebegin",b);
  }
  styles();modal();
  window.addEventListener("qa-auth-ready",()=>setTimeout(inject,800));
  new MutationObserver(()=>inject()).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,1200),{once:true}):setTimeout(inject,1200);
})();