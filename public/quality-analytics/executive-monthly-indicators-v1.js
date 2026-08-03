(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets",PANEL="#qa-executive-intelligence";
  const CORE=["Setup","Attitude","Preparation","Curriculum","Teaching"];
  let reviews=[],objections=[],loaded=false,queued=false;
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const num=v=>{const n=Number(clean(v).replace(/[% ,]/g,""));return Number.isFinite(n)?n:null};
  const score=v=>{const n=num(v);return n===null?null:(n<=5?n*20:n)};
  const avg=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:0};
  const pct=(a,b)=>b?a/b*100:0;
  const uniq=a=>[...new Set(a.map(clean).filter(v=>v&&v!=="--"))];
  const role=()=>window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaAccessRole||window.__QA_ROLE__||"";
  const fullRole=()=>["admin","management","quality"].includes(role());

  function reviewScore(row){
    const values=CORE.map(k=>score(row[k])).filter(Number.isFinite);
    return values.length?avg(values):score(row["Overall Score %"]);
  }
  function flags(row){
    const raw=clean(row.Flags);if(!raw||raw==="--"||/^(none|no)$/i.test(raw))return[];
    const list=raw.split(/\r?\n|\s*\|\s*|\s*;\s*/).map(clean).filter(Boolean);
    return list.length?list:[raw];
  }
  function outcome(row){
    const x=clean(row["Review Objection Outcome"]||row["Objection Outcome"]||row["Objection Status"]||row.Status).toLowerCase();
    if(x.includes("partial"))return"Partially Approved";
    if(x.includes("reject"))return"Rejected";
    if(x.includes("approv")||x.includes("accept"))return"Approved";
    return"In Progress";
  }
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function read(kind){try{const db=await openDB();return await new Promise((ok,no)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}catch{return[]}}
  async function load(force=false){if(loaded&&!force)return;[reviews,objections]=await Promise.all([read("reviews"),read("objections")]);loaded=true}

  function labelledSelect(labelNames){
    const names=labelNames.map(x=>x.toLowerCase());
    for(const label of document.querySelectorAll("main label")){
      const text=clean(label.querySelector("span")?.textContent).toLowerCase();
      const select=label.querySelector("select");
      if(select&&names.includes(text))return select;
    }
    return null;
  }
  function globals(){
    const f={cycle:labelledSelect(["Cycles"])?.value||"",org:labelledSelect(["Organizations"])?.value||"",qc:labelledSelect(["QCs","QC"])?.value||"",tl:labelledSelect(["TLs"])?.value||""};
    if(!fullRole())f.qc="";
    return f;
  }
  function deep(){
    const f={from:"",to:"",band:"",flag:"",outcome:""};
    document.querySelectorAll(`${PANEL} [data-qei]`).forEach(el=>{if(el.dataset.qei in f)f[el.dataset.qei]=el.value});
    return f;
  }
  function parseCycle(value){
    const months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
    const m=clean(value).toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/);
    return m?new Date(Number(m[2]),months[m[1]],1):null;
  }
  function previousCycle(current){
    const currentDate=parseCycle(current);if(!currentDate)return null;
    const cycles=uniq([...reviews.map(r=>r.Review_Cycle),...objections.map(o=>o["Review Cycle"])]).map(name=>({name,date:parseCycle(name)})).filter(x=>x.date&&x.date<currentDate).sort((a,b)=>b.date-a.date);
    return cycles[0]?.name||null;
  }
  function bandMatch(row,band){
    if(!band)return true;const x=reviewScore(row);if(!Number.isFinite(x))return false;
    if(band==="under80")return x<80;
    if(band==="80-89")return x>=80&&x<90;
    if(band==="90-94")return x>=90&&x<95;
    return x>=95;
  }
  function period(cycle,g,d){
    const R=reviews.filter(r=>{
      if(clean(r.Review_Cycle)!==cycle)return false;
      if(g.org&&clean(r.Organization_Name)!==g.org)return false;
      if(g.qc&&clean(r["QC Name"])!==g.qc)return false;
      if(g.tl&&clean(r.Educational_Team_Lead)!==g.tl)return false;
      if(d.flag&&!flags(r).some(x=>x.toLowerCase().includes(d.flag.toLowerCase())))return false;
      return bandMatch(r,d.band);
    });
    const O=objections.filter(o=>{
      if(clean(o["Review Cycle"])!==cycle)return false;
      if(g.org&&clean(o.Organization)!==g.org)return false;
      if(g.qc&&clean(o["QC Reviewer"])!==g.qc)return false;
      if(g.tl&&clean(o["Educational Team Lead (ETL)"])!==g.tl)return false;
      if(d.outcome&&outcome(o)!==d.outcome)return false;
      return true;
    });
    const tutorMap=new Map();
    R.forEach(r=>{const id=clean(r["Tutor ID"])||clean(r.Tutor);if(!id)return;if(!tutorMap.has(id))tutorMap.set(id,[]);tutorMap.get(id).push(reviewScore(r))});
    const tutorAverages=[...tutorMap.values()].map(avg);
    const scores=R.map(reviewScore).filter(Number.isFinite),flagged=R.filter(r=>flags(r).length),resolved=O.filter(o=>outcome(o)!=="In Progress"),approved=resolved.filter(o=>["Approved","Partially Approved"].includes(outcome(o))).length;
    return{
      reviews:R.length,
      tutors:tutorMap.size,
      tutorAverage:avg(tutorAverages),
      sessionAverage:avg(scores),
      flaggedRate:pct(flagged.length,R.length),
      flagsPer100:pct(R.reduce((s,r)=>s+flags(r).length,0),R.length),
      objectionRate:pct(O.length,R.length),
      approvalRate:pct(approved,resolved.length),
      teams:new Set(R.map(r=>clean(r.Educational_Team_Lead)).filter(Boolean)).size,
      organizations:new Set(R.map(r=>clean(r.Organization_Name)).filter(Boolean)).size,
      reviewDays:new Set(R.map(r=>clean(r["Review Date"])).filter(Boolean)).size,
      dataIssues:R.filter(r=>!clean(r.Educational_Team_Lead)||!clean(r["QC Name"])||!Number.isFinite(reviewScore(r))||!clean(r["Review Date"])).length
    };
  }
  const map={
    "reviewed sessions":{key:"reviews",unit:"count",direction:"higher"},
    "unique tutors":{key:"tutors",unit:"count",direction:"higher"},
    "tutor-weighted average":{key:"tutorAverage",unit:"pp",direction:"higher"},
    "session average":{key:"sessionAverage",unit:"pp",direction:"higher"},
    "flagged reviews":{key:"flaggedRate",unit:"pp",direction:"lower",suffix:" flag rate"},
    "individual flags":{key:"flagsPer100",unit:"per100",direction:"lower"},
    "objections":{key:"objectionRate",unit:"pp",direction:"lower",suffix:" objection rate"},
    "approval rate":{key:"approvalRate",unit:"pp",direction:"neutral"},
    "teams / tls":{key:"teams",unit:"count",direction:"neutral"},
    "organizations":{key:"organizations",unit:"count",direction:"neutral"},
    "review days":{key:"reviewDays",unit:"count",direction:"higher"},
    "data issues":{key:"dataIssues",unit:"count",direction:"lower"}
  };
  function formatDelta(diff,unit){
    const n=Math.abs(diff);
    if(unit==="pp")return `${n.toFixed(1)} pp`;
    if(unit==="per100")return `${n.toFixed(1)} per 100`;
    return new Intl.NumberFormat("en-GB",{maximumFractionDigits:1}).format(n);
  }
  function tone(diff,direction){
    if(Math.abs(diff)<0.0001)return"same";
    if(direction==="neutral")return"neutral";
    const favorable=direction==="higher"?diff>0:diff<0;
    return favorable?"good":"bad";
  }
  function apply(){
    const panel=document.querySelector(PANEL);if(!panel)return;
    const g=globals(),d=deep();
    panel.querySelectorAll(".qmi-indicator").forEach(x=>x.remove());
    if(!g.cycle)return;
    const previous=previousCycle(g.cycle);
    const dateFiltered=Boolean(d.from||d.to);
    const current=period(g.cycle,g,d),prior=previous?period(previous,g,d):null;
    panel.querySelectorAll(".qei-kpi").forEach(card=>{
      const label=clean(card.querySelector("small")?.textContent).toLowerCase(),cfg=map[label];if(!cfg)return;
      const el=document.createElement("div");el.className="qmi-indicator";
      if(dateFiltered){el.classList.add("qmi-muted");el.textContent="— Comparison paused while a date range is active"}
      else if(!previous){el.classList.add("qmi-muted");el.textContent="— Previous cycle data is not uploaded"}
      else{
        const a=Number(current[cfg.key]),b=Number(prior[cfg.key]);
        if(!Number.isFinite(a)||!Number.isFinite(b)||(prior.reviews===0&&!["approvalRate"].includes(cfg.key))){el.classList.add("qmi-muted");el.textContent=`— No comparable ${previous} data`}
        else{
          const diff=a-b,arrow=diff>0?"↑":diff<0?"↓":"→",cls=tone(diff,cfg.direction);
          el.classList.add(`qmi-${cls}`);el.innerHTML=`<b>${arrow} ${formatDelta(diff,cfg.unit)}</b><span>vs ${previous}${cfg.suffix||""}</span>`;
          el.title=`${g.cycle}: ${a.toFixed(2)} | ${previous}: ${b.toFixed(2)}`;
        }
      }
      card.appendChild(el);
    });
  }
  function styles(){if(document.getElementById("qmi-style"))return;const s=document.createElement("style");s.id="qmi-style";s.textContent=`
    .qmi-indicator{display:flex;align-items:center;gap:6px;margin-top:9px;padding-top:8px;border-top:1px solid #edf2f7;font-size:9px;line-height:1.3}.qmi-indicator b{font-size:10px}.qmi-indicator span{color:#7b8ba1}.qmi-good b{color:#128157}.qmi-bad b{color:#b42318}.qmi-neutral b{color:#056FEC}.qmi-same b,.qmi-muted{color:#8494a7}.qmi-muted{display:block;font-weight:700}
  `;document.head.appendChild(s)}
  async function schedule(force=false){if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;await load(force);apply()})}
  styles();
  window.addEventListener("qa-auth-ready",()=>setTimeout(()=>schedule(true),600));
  window.addEventListener("qa-cloud-data-ready",()=>setTimeout(()=>schedule(true),200));
  document.addEventListener("change",()=>setTimeout(()=>schedule(false),120));
  document.addEventListener("click",()=>setTimeout(()=>schedule(false),160));
  new MutationObserver(()=>setTimeout(()=>schedule(false),80)).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>schedule(true),1100),{once:true}):setTimeout(()=>schedule(true),1100);
  setInterval(()=>schedule(false),1800);
})();