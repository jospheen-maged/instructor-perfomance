(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets",PANEL="qa-qc-deep",LIMIT=24;
  let reviews=[],objections=[],loaded=false,queued=false,lastSignature="";
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const number=v=>{const x=Number(clean(v).replace(/[% ,]/g,""));return Number.isFinite(x)?x:null};
  const score=v=>{const x=number(v);return x===null?null:(x<=5?x*20:x)};
  const average=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:0};
  const percent=(a,b)=>b?a/b*100:0;
  const fmtPct=v=>Number.isFinite(v)?`${v.toFixed(1)}%`:"—";
  const fmtNum=v=>new Intl.NumberFormat("en-GB").format(Number(v)||0);
  const role=()=>window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaAccessRole||window.__QA_ROLE__||document.documentElement.dataset.qaRole||"";
  const allowed=()=>["admin","management","quality"].includes(role());

  function parseDate(v){
    const x=clean(v);if(!x)return null;
    const m=x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0));
    const d=new Date(x.replace(" ","T"));return Number.isNaN(d.getTime())?null:d;
  }
  function workingHours(start,end){
    const from=parseDate(start),to=parseDate(end);if(!from||!to||to<from)return null;
    let total=0,cursor=new Date(from);
    while(cursor<to){
      const next=new Date(cursor);next.setHours(24,0,0,0);
      const segment=next<to?next:to;
      if(![5,6].includes(cursor.getDay()))total+=(segment-cursor)/36e5;
      cursor=segment;
    }
    return total;
  }
  function outcome(row){
    const x=clean(row["Review Objection Outcome"]||row["Objection Outcome"]||row["Objection Status"]||row.Status).toLowerCase();
    if(x.includes("partial"))return"Partially Approved";
    if(x.includes("reject"))return"Rejected";
    if(x.includes("approv")||x.includes("accept"))return"Approved";
    return"In Progress";
  }
  function flags(row){
    const raw=clean(row.Flags);if(!raw||raw==="--"||/^(none|no)$/i.test(raw))return[];
    return raw.split(/\r?\n|\s*\|\s*|\s*;\s*/).map(clean).filter(Boolean);
  }
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function read(kind){try{const db=await openDB();return await new Promise((ok,no)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}catch{return[]}}
  async function load(force=false){if(loaded&&!force)return;[reviews,objections]=await Promise.all([read("reviews"),read("objections")]);loaded=true}

  function globalFilters(){
    const f={cycle:"",org:"",qc:"",tl:""};
    document.querySelectorAll("main label").forEach(label=>{
      const select=label.querySelector("select"),name=clean(label.querySelector("span")?.textContent).toLowerCase();
      if(!select)return;
      if(name==="cycles")f.cycle=select.value;
      if(name==="organizations")f.org=select.value;
      if(name==="qcs"||name==="qc")f.qc=select.value;
      if(name==="tls")f.tl=select.value;
    });
    return f;
  }
  function deepFilters(){
    const f={from:"",to:"",tutor:"",flag:"",band:"",outcome:"",sla:""};
    document.querySelectorAll(`#${PANEL} [data-qcx]`).forEach(input=>{if(input.dataset.qcx in f)f[input.dataset.qcx]=input.value});
    return f;
  }
  function inRange(raw,f){
    const d=parseDate(raw);
    if(f.from&&(!d||d<new Date(`${f.from}T00:00:00`)))return false;
    if(f.to&&(!d||d>new Date(`${f.to}T23:59:59`)))return false;
    return true;
  }
  function bandMatch(v,band){
    if(!band)return true;const x=score(v);if(x===null)return false;
    if(band==="under80")return x<80;
    if(band==="80-89")return x>=80&&x<90;
    if(band==="90-94")return x>=90&&x<95;
    return x>=95;
  }
  function filteredData(){
    const g=globalFilters(),f=deepFilters();
    const selectedReviews=reviews.filter(row=>{
      if(g.cycle&&clean(row.Review_Cycle)!==g.cycle)return false;
      if(g.org&&clean(row.Organization_Name)!==g.org)return false;
      if(g.qc&&clean(row["QC Name"])!==g.qc)return false;
      if(g.tl&&clean(row.Educational_Team_Lead)!==g.tl)return false;
      if(f.tutor&&![clean(row["Tutor ID"]),clean(row.Tutor)].includes(f.tutor))return false;
      if(f.flag&&!flags(row).some(x=>x.toLowerCase().includes(f.flag.toLowerCase())))return false;
      if(!bandMatch(row["Overall Score %"],f.band))return false;
      return inRange(row["Review Date"]||row["Session Date"],f);
    });
    const selectedObjections=objections.filter(row=>{
      if(g.cycle&&clean(row["Review Cycle"])!==g.cycle)return false;
      if(g.org&&clean(row.Organization)!==g.org)return false;
      if(g.qc&&clean(row["QC Reviewer"])!==g.qc)return false;
      if(g.tl&&clean(row["Educational Team Lead (ETL)"])!==g.tl)return false;
      if(f.tutor&&![clean(row["Tutor ID"]),clean(row["Tutor Name"])].includes(f.tutor))return false;
      if(f.outcome&&outcome(row)!==f.outcome)return false;
      if(!inRange(row["QC Response At"]||row["Objection Created At"],f))return false;
      const h=workingHours(row["ETL Decision At"],row["QC Response At"]);
      if(f.sla==="within"&&(h===null||h>LIMIT))return false;
      if(f.sla==="breached"&&(h===null||h<=LIMIT))return false;
      if(f.sla==="pending"&&h!==null)return false;
      return true;
    });
    return{selectedReviews,selectedObjections,g,f};
  }
  function buildRows(selectedReviews,selectedObjections){
    const names=[...new Set([
      ...selectedReviews.map(r=>clean(r["QC Name"])),
      ...selectedObjections.map(r=>clean(r["QC Reviewer"]))
    ].filter(x=>x&&x!=="--"))].sort((a,b)=>a.localeCompare(b));
    return names.map(name=>{
      const rr=selectedReviews.filter(r=>clean(r["QC Name"])===name);
      const oo=selectedObjections.filter(r=>clean(r["QC Reviewer"])===name);
      const outcomes=oo.map(outcome);
      const hours=oo.map(r=>workingHours(r["ETL Decision At"],r["QC Response At"]));
      const valid=hours.filter(Number.isFinite),within=valid.filter(h=>h<=LIMIT).length,late=valid.filter(h=>h>LIMIT).length,pending=hours.length-valid.length;
      const scores=rr.map(r=>score(r["Overall Score %"])).filter(Number.isFinite);
      const approved=outcomes.filter(x=>x==="Approved").length;
      const partial=outcomes.filter(x=>x==="Partially Approved").length;
      const rejected=outcomes.filter(x=>x==="Rejected").length;
      const inProgress=outcomes.filter(x=>x==="In Progress").length;
      return{
        QC:name,
        "Session Reviews":rr.length,
        "Unique Tutors":new Set(rr.map(r=>clean(r["Tutor ID"])||clean(r.Tutor)).filter(Boolean)).size,
        "Average Score":scores.length?Number(average(scores).toFixed(1)):"",
        "Flagged Reviews":rr.filter(r=>flags(r).length).length,
        "Total Objections":oo.length,
        Approved:approved,
        "Partially Approved":partial,
        Rejected:rejected,
        "In Progress":inProgress,
        "SLA Evaluated":valid.length,
        "Within 24h":within,
        "Late / Breached":late,
        "Pending Timestamp":pending,
        "QC SLA %":valid.length?Number(percent(within,valid.length).toFixed(1)):"",
        "Average Response Hours":valid.length?Number(average(valid).toFixed(1)):""
      };
    }).sort((a,b)=>b["Session Reviews"]-a["Session Reviews"]||a.QC.localeCompare(b.QC));
  }
  function csv(rows){
    if(!rows.length)return"";const headers=Object.keys(rows[0]);
    const q=v=>{const x=clean(v);return/[",\n\r]/.test(x)?`"${x.replaceAll('"','""')}"`:x};
    return[headers.join(","),...rows.map(r=>headers.map(h=>q(r[h])).join(","))].join("\n");
  }
  function download(rows){
    const blob=new Blob([csv(rows)],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="qc-outcomes-and-sla-summary.csv";a.click();URL.revokeObjectURL(url);
  }
  function totalCards(rows){
    const total=k=>rows.reduce((s,r)=>s+(Number(r[k])||0),0);
    const valid=total("SLA Evaluated"),within=total("Within 24h"),late=total("Late / Breached");
    const card=(label,value,note,tone="")=>`<div class="qca-card ${tone}"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(note)}</span></div>`;
    return `<div class="qca-cards">
      ${card("Approved",fmtNum(total("Approved")),"Fully approved objection records","ok")}
      ${card("Partially Approved",fmtNum(total("Partially Approved")),"Partially accepted records","partial")}
      ${card("Rejected",fmtNum(total("Rejected")),"Rejected objection records","bad")}
      ${card("Within QC SLA",fmtNum(within),`Completed within ${LIMIT} working hours`,"ok")}
      ${card("Late QC Responses",fmtNum(late),`Completed after ${LIMIT} working hours`,late?"bad":"ok")}
      ${card("QC SLA Compliance",valid?fmtPct(percent(within,valid)):"—",`${valid} evaluated • pending excluded`,valid&&late?"bad":"ok")}
    </div>`;
  }
  function table(rows){
    return `<table><thead><tr>
      <th>QC</th><th>Session Reviews</th><th>Unique Tutors</th><th>Avg Score</th><th>Flagged Reviews</th>
      <th>Total Objections</th><th>Approved</th><th>Partially Approved</th><th>Rejected</th><th>In Progress</th>
      <th>SLA Evaluated</th><th>Within 24h</th><th>Late / Breached</th><th>Pending</th><th>QC SLA %</th><th>Avg Response</th>
    </tr></thead><tbody>${rows.map(r=>`<tr>
      <td><b>${esc(r.QC)}</b></td>
      <td><b>${fmtNum(r["Session Reviews"])}</b></td>
      <td>${fmtNum(r["Unique Tutors"])}</td>
      <td>${r["Average Score"]===""?"—":fmtPct(Number(r["Average Score"]))}</td>
      <td>${fmtNum(r["Flagged Reviews"])}</td>
      <td><b>${fmtNum(r["Total Objections"])}</b></td>
      <td class="qca-ok">${fmtNum(r.Approved)}</td>
      <td class="qca-partial">${fmtNum(r["Partially Approved"])}</td>
      <td class="qca-bad">${fmtNum(r.Rejected)}</td>
      <td>${fmtNum(r["In Progress"])}</td>
      <td>${fmtNum(r["SLA Evaluated"])}</td>
      <td class="qca-ok">${fmtNum(r["Within 24h"])}</td>
      <td class="${Number(r["Late / Breached"])?"qca-bad":"qca-ok"}">${fmtNum(r["Late / Breached"])}</td>
      <td class="${Number(r["Pending Timestamp"])?"qca-partial":""}">${fmtNum(r["Pending Timestamp"])}</td>
      <td><b>${r["QC SLA %"]===""?"—":fmtPct(Number(r["QC SLA %"]))}</b></td>
      <td>${r["Average Response Hours"]===""?"—":`${Number(r["Average Response Hours"]).toFixed(1)}h`}</td>
    </tr>`).join("")||`<tr><td colspan="16" class="qca-empty">No QC records match the current filters.</td></tr>`}</tbody></table>`;
  }
  function injectStyle(){
    if(document.getElementById("qca-style"))return;
    const style=document.createElement("style");style.id="qca-style";style.textContent=`
      .qca-cards{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:14px 0}
      .qca-card{min-width:0;padding:13px;border:1px solid #e3eaf3;border-left:4px solid #056FEC;border-radius:14px;background:#fff}
      .qca-card small,.qca-card span{display:block}.qca-card small{color:#718096;font-size:9px;font-weight:900;text-transform:uppercase}.qca-card b{display:block;margin:7px 0 5px;color:#1F2A55;font-size:20px}.qca-card span{color:#8494a7;font-size:9px;line-height:1.35}.qca-card.ok{border-left-color:#16A66A}.qca-card.partial{border-left-color:#FF8A1F}.qca-card.bad{border-left-color:#E84C4F}
      .qca-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px}.qca-toolbar p{max-width:720px}.qca-export{height:36px;padding:0 12px;border:1px solid #cfe0f5;border-radius:10px;background:#fff;color:#056FEC;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap}
      .qca-ok{color:#128157!important;font-weight:850}.qca-partial{color:#b66b00!important;font-weight:850}.qca-bad{color:#b42318!important;font-weight:850}.qca-empty{padding:28px!important;text-align:center;color:#718096!important}
      @media(max-width:1399px){.qca-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:800px){.qca-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.qca-toolbar{align-items:flex-start;flex-direction:column}}@media(max-width:520px){.qca-cards{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }
  async function apply(){
    if(!allowed()||clean(document.querySelector("main header h1")?.textContent)!=="QC Analytics")return;
    const panel=document.getElementById(PANEL);if(!panel)return;
    await load();
    const {selectedReviews,selectedObjections,g,f}=filteredData(),rows=buildRows(selectedReviews,selectedObjections);
    const signature=JSON.stringify({g,f,reviewCount:selectedReviews.length,objCount:selectedObjections.length,rows});
    const article=[...panel.querySelectorAll(".qcx-box")].find(x=>/^Full QC Comparison$/i.test(clean(x.querySelector("h3")?.textContent))||/^QC Productivity, Outcomes & SLA by Coordinator$/i.test(clean(x.querySelector("h3")?.textContent)));
    if(!article)return;
    if(signature===lastSignature&&article.dataset.qcaReady==="1")return;
    lastSignature=signature;article.dataset.qcaReady="1";
    const heading=article.querySelector("h3");if(heading)heading.textContent="QC Productivity, Outcomes & SLA by Coordinator";
    const paragraph=article.querySelector("p");if(paragraph)paragraph.textContent="Session review volume is separate from objection outcomes. QC SLA measures ETL Decision At → QC Response At, excluding Friday and Saturday; pending timestamps are not counted in the SLA percentage.";
    article.querySelector(".qca-cards")?.remove();article.querySelector(".qca-toolbar")?.remove();
    const toolbar=document.createElement("div");toolbar.className="qca-toolbar";toolbar.innerHTML=`<p>Approved, partially approved, rejected and SLA counts are shown as totals for each QC after the current filters.</p><button type="button" class="qca-export">Export QC Outcomes & SLA</button>`;
    const scroll=article.querySelector(".qcx-scroll");if(!scroll)return;
    scroll.insertAdjacentHTML("beforebegin",totalCards(rows));scroll.insertAdjacentElement("beforebegin",toolbar);scroll.innerHTML=table(rows);
    toolbar.querySelector("button").onclick=()=>download(rows);
  }
  function queue(force=false){if(force)loaded=false;if(queued)return;queued=true;setTimeout(async()=>{queued=false;await apply()},100)}
  injectStyle();
  window.addEventListener("qa-auth-ready",()=>queue(true));
  window.addEventListener("qa-cloud-data-ready",()=>queue(true));
  document.addEventListener("change",()=>queue(false));
  document.addEventListener("click",()=>queue(false));
  new MutationObserver(()=>queue(false)).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>queue(true),{once:true}):queue(true);
  setInterval(()=>queue(false),1400);
})();