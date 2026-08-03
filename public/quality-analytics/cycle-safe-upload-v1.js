(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets",BTN="qa-replace-cycle",MODAL="qa-replace-cycle-modal";
  let pending=null,busy=false;
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
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function read(kind){const db=await openDB();return await new Promise((ok,no)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}
  async function write(kind,rows){const db=await openDB();return await new Promise((ok,no)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(rows,kind);tx.oncomplete=()=>ok();tx.onerror=()=>no(tx.error)})}
  function styles(){
    if(document.getElementById("qa-cycle-style"))return;
    const s=document.createElement("style");s.id="qa-cycle-style";s.textContent=`
      #${BTN}{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 14px;border:1px solid #b9d5f7;border-radius:12px;background:#fff;color:#056FEC;font-size:13px;font-weight:850;box-shadow:0 6px 18px rgba(31,42,85,.06);cursor:pointer}#${BTN}:hover{background:#f3f8ff}#${BTN} svg{width:17px;height:17px}
      #${MODAL}{position:fixed;inset:0;z-index:1000001;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.58);backdrop-filter:blur(8px)}#${MODAL}[hidden]{display:none}
      .qrc-box{width:min(720px,100%);max-height:90vh;overflow:auto;border-radius:24px;background:#fff;box-shadow:0 30px 90px rgba(15,23,42,.28)}.qrc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid #e5edf6}.qrc-head small{color:#056FEC;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.15em}.qrc-head h2{margin:5px 0 4px;color:#1F2A55;font-size:22px;font-weight:900}.qrc-head p{margin:0;color:#718096;font-size:12px;line-height:1.5}.qrc-x{width:38px;height:38px;border:0;border-radius:11px;background:#f1f5f9;color:#1F2A55;font-size:20px;cursor:pointer}.qrc-body{padding:22px 24px}.qrc-alert{padding:13px 14px;border:1px solid #cfe0f5;border-radius:14px;background:#f7fbff;color:#42526b;font-size:12px;line-height:1.55}.qrc-alert b{color:#1F2A55}.qrc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:16px}.qrc-stat{padding:14px;border:1px solid #e3eaf3;border-radius:15px}.qrc-stat small{display:block;color:#8494a7;font-size:9px;font-weight:900;text-transform:uppercase}.qrc-stat b{display:block;margin-top:7px;color:#1F2A55;font-size:21px}.qrc-cycles{display:flex;flex-wrap:wrap;gap:7px;margin-top:16px}.qrc-cycle{padding:6px 9px;border-radius:999px;background:#eaf3ff;color:#056FEC;font-size:10px;font-weight:850}.qrc-foot{display:flex;justify-content:flex-end;gap:9px;padding:17px 24px;border-top:1px solid #e5edf6}.qrc-foot button{height:40px;padding:0 15px;border-radius:11px;font-size:12px;font-weight:850;cursor:pointer}.qrc-cancel{border:1px solid #d8e1ec;background:#fff;color:#526477}.qrc-confirm{border:0;background:#056FEC;color:#fff}.qrc-confirm:disabled{opacity:.55;cursor:not-allowed}.qrc-error{margin-top:12px;color:#b42318;font-size:12px;font-weight:750}
      @media(max-width:650px){.qrc-grid{grid-template-columns:1fr 1fr}.qrc-box{border-radius:18px}.qrc-head,.qrc-body,.qrc-foot{padding-left:16px;padding-right:16px}#${BTN}{padding:0 11px;font-size:12px}}
    `;document.head.appendChild(s);
  }
  function modal(){
    let m=document.getElementById(MODAL);if(m)return m;
    m=document.createElement("div");m.id=MODAL;m.hidden=true;m.innerHTML=`<div class="qrc-box" role="dialog" aria-modal="true"><div class="qrc-head"><div><small>Safe Cycle Upload</small><h2>Replace Selected Cycle</h2><p>Only the cycles inside the selected CSV will be replaced. Other months remain untouched.</p></div><button class="qrc-x" data-close aria-label="Close">×</button></div><div class="qrc-body" data-body></div><div class="qrc-foot"><button class="qrc-cancel" data-close>Cancel</button><button class="qrc-confirm" data-confirm>Confirm & Replace Cycle</button></div></div>`;
    m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-close]")){m.hidden=true;pending=null}});
    m.querySelector("[data-confirm]").addEventListener("click",confirmReplace);
    document.body.appendChild(m);return m;
  }
  function showPreview(data){
    pending=data;const m=modal(),b=m.querySelector("[data-body]");m.hidden=false;
    b.innerHTML=`<div class="qrc-alert"><b>${esc(data.kind==="reviews"?"Reviews":"Objections")} file detected.</b> Existing rows from <b>${esc(data.cycles.join(", "))}</b> will be removed and replaced by the deduplicated rows in this file.</div><div class="qrc-grid"><div class="qrc-stat"><small>Rows in file</small><b>${data.rawCount}</b></div><div class="qrc-stat"><small>Duplicates removed</small><b>${data.duplicates}</b></div><div class="qrc-stat"><small>Clean incoming rows</small><b>${data.incoming.length}</b></div><div class="qrc-stat"><small>Old cycle rows removed</small><b>${data.removed}</b></div><div class="qrc-stat"><small>Other cycles kept</small><b>${data.kept.length}</b></div><div class="qrc-stat"><small>Final dataset</small><b>${data.finalRows.length}</b></div></div><div class="qrc-cycles">${data.cycles.map(x=>`<span class="qrc-cycle">${esc(x)}</span>`).join("")}</div><div class="qrc-error" data-error></div>`;
  }
  async function choose(file){
    if(!file)return;
    try{
      const text=await file.text(),raw=parseCSV(text);if(!raw.length)throw new Error("The CSV file is empty.");
      const kind=detectKind(raw);validate(kind,raw);
      const incoming=dedupe(kind,raw),cycles=[...new Set(incoming.map(r=>kindCycle(kind,r)).filter(Boolean))].sort();
      const current=await read(kind),cycleSet=new Set(cycles.map(norm)),kept=current.filter(r=>!cycleSet.has(norm(kindCycle(kind,r)))),removed=current.length-kept.length;
      const finalRows=dedupe(kind,[...kept,...incoming]);
      showPreview({kind,rawCount:raw.length,incoming,duplicates:raw.length-incoming.length,cycles,current,kept,removed,finalRows});
    }catch(error){alert(error?.message||"Could not process this file.")}
  }
  async function confirmReplace(){
    if(!pending||busy)return;busy=true;
    const m=modal(),btn=m.querySelector("[data-confirm]"),error=m.querySelector("[data-error]");btn.disabled=true;btn.textContent="Saving…";error.textContent="";
    try{
      await write(pending.kind,pending.finalRows);
      btn.textContent="Saved — syncing cloud…";
      setTimeout(()=>{location.reload()},3200);
    }catch(err){error.textContent=err?.message||"Save failed.";btn.disabled=false;btn.textContent="Confirm & Replace Cycle";busy=false}
  }
  function inject(){
    if(!isAdmin()){document.getElementById(BTN)?.remove();return}
    if(document.getElementById(BTN))return;
    const upload=[...document.querySelectorAll("button")].find(b=>/^upload data$/i.test(clean(b.textContent)));if(!upload)return;
    const b=document.createElement("button");b.id=BTN;b.type="button";b.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0-12 4 4m-4-4-4 4"/><path d="M5 21h14a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2"/></svg><span>Replace Cycle</span>`;
    b.title="Safely replace only the cycle(s) included in a CSV";
    b.addEventListener("click",()=>{const input=document.createElement("input");input.type="file";input.accept=".csv,text/csv";input.hidden=true;input.addEventListener("change",()=>choose(input.files?.[0]),{once:true});document.body.appendChild(input);input.click();setTimeout(()=>input.remove(),60000)});
    upload.insertAdjacentElement("beforebegin",b);
  }
  styles();modal();
  window.addEventListener("qa-auth-ready",()=>setTimeout(inject,800));
  new MutationObserver(()=>inject()).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(inject,1200),{once:true}):setTimeout(inject,1200);
})();