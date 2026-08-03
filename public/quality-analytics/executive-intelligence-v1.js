(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets",PANEL="qa-executive-intelligence";
  const CORE=["Setup","Attitude","Preparation","Curriculum","Teaching"];
  const state={from:"",to:"",band:"",flag:"",outcome:""};
  let reviews=[],objections=[],loaded=false,queued=false,lastSignature="";

  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const number=v=>{const x=Number(clean(v).replace(/[% ,]/g,""));return Number.isFinite(x)?x:null};
  const metricScore=v=>{const x=number(v);return x===null?null:(x<=5?x*20:x)};
  const average=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:0};
  const percent=(a,b)=>b?a/b*100:0;
  const fmtPct=v=>Number.isFinite(v)?`${Number(v).toFixed(1)}%`:"—";
  const fmtNum=v=>new Intl.NumberFormat("en-GB").format(Number(v)||0);
  const fmtHours=v=>Number.isFinite(v)?`${Number(v).toFixed(1)}h`:"—";
  const uniq=a=>[...new Set(a.map(clean).filter(x=>x&&x!=="--"))].sort((a,b)=>a.localeCompare(b));
  const role=()=>window.__QA_ACCESS_ROLE__||document.documentElement.dataset.qaAccessRole||window.__QA_ROLE__||document.documentElement.dataset.qaRole||"";
  const fullRole=()=>["admin","management","quality"].includes(role());

  function parseDate(v){
    const x=clean(v);if(!x)return null;
    const m=x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if(m)return new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0));
    const d=new Date(x.replace(" ","T"));return Number.isNaN(d.getTime())?null:d;
  }
  function workingHours(start,end,excluded){
    const from=parseDate(start),to=parseDate(end);if(!from||!to||to<from)return null;
    let total=0,cursor=new Date(from);
    while(cursor<to){
      const next=new Date(cursor);next.setHours(24,0,0,0);
      const segment=next<to?next:to;
      if(!excluded.includes(cursor.getDay()))total+=(segment-cursor)/36e5;
      cursor=segment;
    }
    return total;
  }
  function reviewScore(row){
    const values=CORE.map(m=>metricScore(row[m])).filter(Number.isFinite);
    if(values.length)return average(values);
    return metricScore(row["Overall Score %"]);
  }
  function flags(row){
    const raw=clean(row.Flags);if(!raw||raw==="--"||/^(none|no)$/i.test(raw))return[];
    const list=raw.split(/\r?\n|\s*\|\s*|\s*;\s*/).map(clean).filter(x=>x&&x!=="--");
    return list.length?list:[raw];
  }
  function outcome(row){
    const x=clean(row["Review Objection Outcome"]||row["Objection Outcome"]||row["Objection Status"]||row.Status).toLowerCase();
    if(x.includes("partial"))return"Partially Approved";
    if(x.includes("reject"))return"Rejected";
    if(x.includes("approv")||x.includes("accept"))return"Approved";
    return"In Progress";
  }
  function tutorKey(row){return clean(row["Tutor ID"])||clean(row.Tutor)||clean(row["Tutor Name"])||"Unknown Tutor"}
  function group(rows,key){const map=new Map();rows.forEach(row=>{const k=key(row)||"Unassigned";if(!map.has(k))map.set(k,[]);map.get(k).push(row)});return map}
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function read(kind){try{const db=await openDB();return await new Promise((ok,no)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}catch{return[]}}
  async function load(force=false){if(loaded&&!force)return;[reviews,objections]=await Promise.all([read("reviews"),read("objections")]);loaded=true}

  function slaLimits(){
    try{return{etl:24,qc:24,qtl:24,...JSON.parse(localStorage.getItem("quality-sla-settings")||"{}")}}catch{return{etl:24,qc:24,qtl:24}}
  }
  function stageHours(row,stage){
    if(stage==="etl")return workingHours(row["Objection Created At"],row["ETL Decision At"],[4,5]);
    if(stage==="qc")return workingHours(row["ETL Decision At"],row["QC Response At"],[5,6]);
    return workingHours(row["QC Response At"],row["QTL Decision At"],[5,6]);
  }
  function slaStats(rows,stage,limit){
    const values=rows.map(r=>stageHours(r,stage)),valid=values.filter(Number.isFinite),within=valid.filter(v=>v<=limit).length,late=valid.filter(v=>v>limit).length,sorted=[...valid].sort((a,b)=>a-b);
    return{evaluated:valid.length,within,late,pending:values.length-valid.length,rate:percent(within,valid.length),avg:average(valid),median:sorted.length?sorted[Math.floor(sorted.length/2)]:0};
  }
  function globalFilters(){
    const f={cycle:"",org:"",qc:"",tl:""};
    document.querySelectorAll("main label").forEach(label=>{
      const select=label.querySelector("select"),name=clean(label.querySelector("span")?.textContent).toLowerCase();if(!select)return;
      if(name==="cycles")f.cycle=select.value;
      if(name==="organizations")f.org=select.value;
      if(name==="qcs"||name==="qc")f.qc=select.value;
      if(name==="tls")f.tl=select.value;
    });
    if(!fullRole())f.qc="";
    return f;
  }
  function inRange(raw){
    const d=parseDate(raw);
    if(state.from&&(!d||d<new Date(`${state.from}T00:00:00`)))return false;
    if(state.to&&(!d||d>new Date(`${state.to}T23:59:59`)))return false;
    return true;
  }
  function bandMatch(v){
    if(!state.band)return true;const x=reviewScore(v);if(x===null)return false;
    if(state.band==="under80")return x<80;
    if(state.band==="80-89")return x>=80&&x<90;
    if(state.band==="90-94")return x>=90&&x<95;
    return x>=95;
  }
  function filteredData(){
    const g=globalFilters();
    const R=reviews.filter(row=>{
      if(g.cycle&&clean(row.Review_Cycle)!==g.cycle)return false;
      if(g.org&&clean(row.Organization_Name)!==g.org)return false;
      if(g.qc&&clean(row["QC Name"])!==g.qc)return false;
      if(g.tl&&clean(row.Educational_Team_Lead)!==g.tl)return false;
      if(state.flag&&!flags(row).some(x=>x.toLowerCase().includes(state.flag.toLowerCase())))return false;
      if(!bandMatch(row))return false;
      return inRange(row["Review Date"]||row["Session Date"]);
    });
    const O=objections.filter(row=>{
      if(g.cycle&&clean(row["Review Cycle"])!==g.cycle)return false;
      if(g.org&&clean(row.Organization)!==g.org)return false;
      if(g.qc&&clean(row["QC Reviewer"])!==g.qc)return false;
      if(g.tl&&clean(row["Educational Team Lead (ETL)"])!==g.tl)return false;
      if(state.outcome&&outcome(row)!==state.outcome)return false;
      return inRange(row["Objection Created At"]||row["Session Date"]);
    });
    return{R,O,g};
  }

  function tutorSummary(R){
    return[...group(R,tutorKey).entries()].map(([id,rows])=>{
      const scores=rows.map(reviewScore).filter(Number.isFinite),first=rows[0]||{};
      return{id,name:clean(first.Tutor)||id,team:clean(first.Educational_Team_Lead)||"Unassigned",org:clean(first.Organization_Name)||"Unassigned",reviews:rows.length,avg:average(scores),flags:rows.reduce((s,r)=>s+flags(r).length,0),flagged:rows.filter(r=>flags(r).length).length,latest:rows.map(r=>parseDate(r["Review Date"]||r["Session Date"])).filter(Boolean).sort((a,b)=>b-a)[0]};
    }).sort((a,b)=>b.avg-a.avg);
  }
  function outcomeCounts(rows){const a=rows.map(outcome);return{approved:a.filter(x=>x==="Approved").length,partial:a.filter(x=>x==="Partially Approved").length,rejected:a.filter(x=>x==="Rejected").length,pending:a.filter(x=>x==="In Progress").length}}
  function teamSummary(R,O,limits){
    const tutors=tutorSummary(R);
    return[...group(R,r=>clean(r.Educational_Team_Lead)).entries()].map(([name,rows])=>{
      const ids=new Set(rows.map(tutorKey)),teamTutors=tutors.filter(t=>ids.has(t.id)),rel=O.filter(o=>clean(o["Educational Team Lead (ETL)"])===name),co=outcomeCounts(rel),sl=slaStats(rel,"etl",limits.etl);
      return{name,reviews:rows.length,tutors:teamTutors.length,tutorAvg:average(teamTutors.map(t=>t.avg)),sessionAvg:average(rows.map(reviewScore).filter(Number.isFinite)),flagged:rows.filter(r=>flags(r).length).length,flags:rows.reduce((s,r)=>s+flags(r).length,0),objections:rel.length,...co,...sl};
    }).sort((a,b)=>b.tutorAvg-a.tutorAvg);
  }
  function orgSummary(R,O){
    const tutors=tutorSummary(R);
    return[...group(R,r=>clean(r.Organization_Name)).entries()].map(([name,rows])=>{
      const ids=new Set(rows.map(tutorKey)),ot=tutors.filter(t=>ids.has(t.id)),rel=O.filter(o=>clean(o.Organization)===name),co=outcomeCounts(rel);
      return{name,reviews:rows.length,tutors:ot.length,teams:new Set(rows.map(r=>clean(r.Educational_Team_Lead)).filter(Boolean)).size,tutorAvg:average(ot.map(t=>t.avg)),sessionAvg:average(rows.map(reviewScore).filter(Number.isFinite)),flags:rows.reduce((s,r)=>s+flags(r).length,0),objections:rel.length,...co};
    }).sort((a,b)=>b.reviews-a.reviews);
  }
  function qcSummary(R,O,limits){
    const names=uniq([...R.map(r=>r["QC Name"]),...O.map(o=>o["QC Reviewer"])]);
    return names.map(name=>{
      const rr=R.filter(r=>clean(r["QC Name"])===name),oo=O.filter(o=>clean(o["QC Reviewer"])===name),co=outcomeCounts(oo),sl=slaStats(oo,"qc",limits.qc);
      return{name,reviews:rr.length,tutors:new Set(rr.map(tutorKey)).size,avg:average(rr.map(reviewScore).filter(Number.isFinite)),flagged:rr.filter(r=>flags(r).length).length,flags:rr.reduce((s,r)=>s+flags(r).length,0),objections:oo.length,...co,...sl};
    }).sort((a,b)=>b.reviews-a.reviews);
  }
  function cycleSummary(R,O){
    const names=uniq([...R.map(r=>r.Review_Cycle),...O.map(o=>o["Review Cycle"])]);
    return names.map(name=>{
      const rr=R.filter(r=>clean(r.Review_Cycle)===name),oo=O.filter(o=>clean(o["Review Cycle"])===name),ts=tutorSummary(rr),co=outcomeCounts(oo);
      return{name,reviews:rr.length,tutors:ts.length,tutorAvg:average(ts.map(t=>t.avg)),sessionAvg:average(rr.map(reviewScore).filter(Number.isFinite)),flags:rr.reduce((s,r)=>s+flags(r).length,0),objections:oo.length,...co};
    });
  }
  function dailySummary(R){
    return[...group(R,r=>{const d=parseDate(r["Review Date"]||r["Session Date"]);return d?d.toISOString().slice(0,10):"Unknown"}).entries()].map(([key,rows])=>({key,name:key==="Unknown"?key:new Date(`${key}T00:00:00`).toLocaleDateString("en-GB"),reviews:rows.length,tutors:new Set(rows.map(tutorKey)).size,avg:average(rows.map(reviewScore).filter(Number.isFinite)),flags:rows.reduce((s,r)=>s+flags(r).length,0)})).sort((a,b)=>a.key.localeCompare(b.key));
  }
  function flagSummary(R){const map=new Map();R.flatMap(flags).forEach(x=>map.set(x,(map.get(x)||0)+1));return[...map].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count)}
  function bars(rows,value,format=fmtNum,limit=10){
    const a=rows.slice(0,limit),max=Math.max(1,...a.map(value));
    return a.map(x=>`<div class="qei-bar"><span title="${esc(x.name)}">${esc(x.name)}</span><i><em style="width:${Math.max(2,value(x)/max*100)}%"></em></i><b>${esc(format(value(x)))}</b></div>`).join("")||`<p class="qei-empty">No matching data.</p>`;
  }
  function csv(rows){if(!rows.length)return"";const headers=uniq(rows.flatMap(Object.keys)),q=v=>{const x=clean(v);return/[",\n\r]/.test(x)?`"${x.replaceAll('"','""')}"`:x};return[headers.join(","),...rows.map(r=>headers.map(h=>q(r[h])).join(","))].join("\n")}
  function download(name,rows){const blob=new Blob([csv(rows)],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
  const card=(label,value,note,tone="blue")=>`<article class="qei-kpi qei-${tone}"><small>${esc(label)}</small><strong>${esc(value)}</strong><p>${esc(note)}</p></article>`;
  const select=(key,label,items)=>`<label><span>${esc(label)}</span><select data-qei="${key}"><option value="">All</option>${items.map(x=>{const value=Array.isArray(x)?x[0]:x,text=Array.isArray(x)?x[1]:x;return`<option value="${esc(value)}" ${state[key]===value?"selected":""}>${esc(text)}</option>`}).join("")}</select></label>`;

  function base(){
    const content=document.querySelector("main .space-y-6");if(!content)return null;
    let panel=document.getElementById(PANEL);
    if(!panel){
      panel=document.createElement("section");panel.id=PANEL;panel.className="qei-panel";
      const global=[...content.children].find(x=>/Global filters/i.test(clean(x.textContent)));
      global?.after(panel);
      [...content.children].forEach(x=>{if(x!==global&&x!==panel)x.classList.add("qei-old")});
    }
    return panel;
  }
  function cleanup(){document.getElementById(PANEL)?.remove();document.querySelectorAll(".qei-old").forEach(x=>x.classList.remove("qei-old"));lastSignature=""}

  function render(){
    if(clean(document.querySelector("main header h1")?.textContent)!=="Executive Overview")return cleanup();
    const panel=base();if(!panel)return;
    const {R,O,g}=filteredData(),limits=slaLimits(),tutors=tutorSummary(R),teams=teamSummary(R,O,limits),orgs=orgSummary(R,O),qcs=fullRole()?qcSummary(R,O,limits):[],cycles=cycleSummary(R,O),daily=dailySummary(R),flagRows=flagSummary(R),co=outcomeCounts(O),etl=slaStats(O,"etl",limits.etl),qc=slaStats(O,"qc",limits.qc),qtl=slaStats(O,"qtl",limits.qtl);
    const scores=R.map(reviewScore).filter(Number.isFinite),tutorAvg=average(tutors.map(t=>t.avg)),sessionAvg=average(scores),flagged=R.filter(r=>flags(r).length),activeDays=daily.filter(x=>x.key!=="Unknown").length,repeatRate=percent(Math.max(0,R.length-tutors.length),R.length),resolved=co.approved+co.partial+co.rejected,approvalRate=percent(co.approved+co.partial,resolved);
    const metrics=CORE.map(name=>({name,value:average(R.map(r=>metricScore(r[name])).filter(Number.isFinite))}));
    const scoreBands=[{name:"Below 80",count:scores.filter(x=>x<80).length},{name:"80–89",count:scores.filter(x=>x>=80&&x<90).length},{name:"90–94",count:scores.filter(x=>x>=90&&x<95).length},{name:"95–100",count:scores.filter(x=>x>=95).length}];
    const topTutors=[...tutors].sort((a,b)=>b.avg-a.avg||b.reviews-a.reviews).slice(0,15),riskTutors=[...tutors].filter(t=>t.avg<90||t.flags).sort((a,b)=>a.avg-b.avg||b.flags-a.flags).slice(0,50);
    const visibleStages=[{name:"TL / ETL",key:"etl",limit:limits.etl,data:etl},...(fullRole()?[{name:"QC",key:"qc",limit:limits.qc,data:qc},{name:"QTL",key:"qtl",limit:limits.qtl,data:qtl}]:[])];
    const lowestMetric=[...metrics].sort((a,b)=>a.value-b.value)[0],riskTeam=[...teams].sort((a,b)=>a.tutorAvg-b.tutorAvg||b.flags-a.flags)[0],topFlag=flagRows[0],slaRisk=[...visibleStages].sort((a,b)=>a.data.rate-b.data.rate)[0];
    const missingTL=R.filter(r=>!clean(r.Educational_Team_Lead)||clean(r.Educational_Team_Lead)==="--").length,missingQC=R.filter(r=>!clean(r["QC Name"])).length,invalidScore=R.filter(r=>reviewScore(r)===null).length,missingDate=R.filter(r=>!parseDate(r["Review Date"]||r["Session Date"])).length;
    const slaIssues=O.map(o=>{
      const stages=visibleStages.map(s=>({name:s.name,h:stageHours(o,s.key),limit:s.limit})),late=stages.filter(s=>Number.isFinite(s.h)&&s.h>s.limit),pending=stages.filter(s=>s.h===null);
      return{row:o,late,pending,worst:late.length?Math.max(...late.map(s=>s.h-s.limit)):0};
    }).filter(x=>x.late.length||x.pending.length).sort((a,b)=>b.worst-a.worst).slice(0,80);
    const summaryRows=[{Metric:"Reviewed Sessions",Value:R.length},{Metric:"Unique Tutors",Value:tutors.length},{Metric:"Tutor-Weighted Average",Value:Number(tutorAvg.toFixed(1))},{Metric:"Session Average",Value:Number(sessionAvg.toFixed(1))},{Metric:"Flagged Reviews",Value:flagged.length},{Metric:"Individual Flags",Value:R.reduce((s,r)=>s+flags(r).length,0)},{Metric:"Objections",Value:O.length},{Metric:"Approved",Value:co.approved},{Metric:"Partially Approved",Value:co.partial},{Metric:"Rejected",Value:co.rejected},{Metric:"In Progress",Value:co.pending},{Metric:"Approval Rate",Value:Number(approvalRate.toFixed(1))}];
    const signature=JSON.stringify({role:role(),g,state,l:R.length,o:O.length,first:R[0]?.["Review Date"],last:R.at(-1)?.["Review Date"]});
    if(signature===lastSignature&&panel.dataset.ready==="1")return;lastSignature=signature;

    panel.innerHTML=`
      <header><div><small>Executive Intelligence Board</small><h2>Quality Performance, Risk & Operational Health</h2><p>Complete view of review coverage, tutor-weighted quality, teams, organizations, flags, objections, SLA and data reliability. Every figure follows the active filters.</p></div><div class="qei-actions"><button data-export="summary">Export Executive Summary</button><button data-export="reviews">Export Reviews</button><button data-export="objections">Export Objections</button></div></header>
      <details class="qei-filter" open><summary><span><b>Executive Deep-Dive Filters</b><small>Date, score, flag and objection filters applied in addition to the global filters.</small></span><i>⌄</i></summary><div class="qei-filter-grid"><label><span>Date From</span><input data-qei="from" type="date" value="${esc(state.from)}"></label><label><span>Date To</span><input data-qei="to" type="date" value="${esc(state.to)}"></label>${select("band","Score Band",[["under80","Below 80"],["80-89","80–89"],["90-94","90–94"],["95+","95–100"]])}${select("flag","Flag Type",uniq(reviews.flatMap(flags)))}${select("outcome","Objection Outcome",["Approved","Partially Approved","Rejected","In Progress"])}<button data-reset>Reset deep-dive filters</button></div></details>
      <div class="qei-kpis">${card("Reviewed Sessions",fmtNum(R.length),`${activeDays? (R.length/activeDays).toFixed(1):0} reviews per active day`)}${card("Unique Tutors",fmtNum(tutors.length),`${fmtPct(repeatRate)} repeat-review share`)}${card("Tutor-Weighted Average",fmtPct(tutorAvg),"Every tutor has equal weight","green")}${card("Session Average",fmtPct(sessionAvg),"Average across reviewed sessions","green")}${card("Flagged Reviews",fmtNum(flagged.length),`${fmtPct(percent(flagged.length,R.length))} of reviewed sessions`,flagged.length?"orange":"green")}${card("Individual Flags",fmtNum(R.reduce((s,r)=>s+flags(r).length,0)),"Every listed flag counted","orange")}${card("Objections",fmtNum(O.length),`${fmtPct(percent(O.length,R.length))} per reviewed session`)}${card("Approval Rate",fmtPct(approvalRate),`${co.approved} approved • ${co.partial} partial`,approvalRate>50?"orange":"green")}${card("Teams / TLs",fmtNum(teams.length),"Matching educational teams")}${card("Organizations",fmtNum(orgs.length),"Matching organizations")}${card("Review Days",fmtNum(activeDays),"Days with completed reviews")}${card("Data Issues",fmtNum(missingTL+missingQC+invalidScore+missingDate),"Missing ownership, score or date",missingTL+missingQC+invalidScore+missingDate?"red":"green")}</div>
      <div class="qei-insights">${lowestMetric?`<article><small>Development Priority</small><b>${esc(lowestMetric.name)} • ${fmtPct(lowestMetric.value)}</b><p>Lowest core metric across the selected reviews.</p></article>`:""}${riskTeam?`<article><small>Team Watch</small><b>${esc(riskTeam.name)} • ${fmtPct(riskTeam.tutorAvg)}</b><p>${riskTeam.flags} flags across ${riskTeam.reviews} reviews.</p></article>`:""}${topFlag?`<article><small>Most Frequent Flag</small><b>${esc(topFlag.name)}</b><p>${topFlag.count} individual occurrences.</p></article>`:""}${slaRisk?`<article><small>SLA Priority</small><b>${esc(slaRisk.name)} • ${fmtPct(slaRisk.data.rate)}</b><p>${slaRisk.data.late} late and ${slaRisk.data.pending} pending cases.</p></article>`:""}</div>
      <div class="qei-grid"><article class="qei-box"><h3>Core Metric Averages</h3><p>Setup, Attitude, Preparation, Curriculum and Teaching only.</p><div class="qei-bars">${bars(metrics,x=>x.value,fmtPct)}</div></article><article class="qei-box"><h3>Score Distribution</h3><p>Quality distribution across the selected sessions.</p><div class="qei-bars">${bars(scoreBands,x=>x.count)}</div></article><article class="qei-box"><h3>Individual Flag Patterns</h3><p>Highest-frequency compliance and quality issues.</p><div class="qei-bars qei-orange-bars">${bars(flagRows,x=>x.count,fmtNum,12)}</div></article><article class="qei-box"><h3>Objection Outcomes</h3><div class="qei-outcomes"><b class="ok">${co.approved}</b><span>Approved</span><b class="partial">${co.partial}</b><span>Partially Approved</span><b class="bad">${co.rejected}</b><span>Rejected</span><b>${co.pending}</b><span>In Progress</span></div></article></div>
      <section class="qei-box"><h3>Stage-by-Stage SLA Health</h3><p>SLA uses working hours and the configured targets. Pending timestamps are excluded from compliance percentages.</p><div class="qei-sla-grid">${visibleStages.map(s=>`<article><small>${esc(s.name)} SLA • ${s.limit}h target</small><strong>${fmtPct(s.data.rate)}</strong><div><span class="ok">${s.data.within} within</span><span class="bad">${s.data.late} late</span><span class="partial">${s.data.pending} pending</span></div><p>Avg ${fmtHours(s.data.avg)} • Median ${fmtHours(s.data.median)} • ${s.data.evaluated} evaluated</p></article>`).join("")}</div></section>
      <div class="qei-grid"><article class="qei-box"><h3>Daily Review Trend</h3><p>Volume, tutor coverage, score and flags by review day.</p><div class="qei-scroll qei-tall"><table><thead><tr><th>Date</th><th>Reviews</th><th>Tutors</th><th>Avg Score</th><th>Flags</th></tr></thead><tbody>${daily.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.reviews}</td><td>${x.tutors}</td><td>${fmtPct(x.avg)}</td><td>${x.flags}</td></tr>`).join("")}</tbody></table></div></article><article class="qei-box"><h3>Top Tutor Performance</h3><p>Highest tutor averages after equal weighting per tutor.</p><div class="qei-scroll qei-tall"><table><thead><tr><th>Tutor</th><th>Team</th><th>Reviews</th><th>Average</th><th>Flags</th></tr></thead><tbody>${topTutors.map(x=>`<tr><td><b>${esc(x.name)}</b><small>${esc(x.id)}</small></td><td>${esc(x.team)}</td><td>${x.reviews}</td><td class="ok">${fmtPct(x.avg)}</td><td>${x.flags}</td></tr>`).join("")}</tbody></table></div></article></div>
      <section class="qei-box"><h3>Team / TL Performance</h3><p>Tutor-weighted team average, session average, flags, objection outcomes and TL SLA.</p><div class="qei-scroll"><table><thead><tr><th>Team / TL</th><th>Reviews</th><th>Tutors</th><th>Tutor Avg</th><th>Session Avg</th><th>Flagged</th><th>Flags</th><th>Objections</th><th>Approved</th><th>Partial</th><th>Rejected</th><th>TL Within</th><th>TL Late</th><th>TL Pending</th><th>TL SLA</th></tr></thead><tbody>${teams.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.reviews}</td><td>${x.tutors}</td><td><b>${fmtPct(x.tutorAvg)}</b></td><td>${fmtPct(x.sessionAvg)}</td><td>${x.flagged}</td><td>${x.flags}</td><td>${x.objections}</td><td class="ok">${x.approved}</td><td class="partial">${x.partial}</td><td class="bad">${x.rejected}</td><td class="ok">${x.within}</td><td class="${x.late?"bad":"ok"}">${x.late}</td><td class="${x.pending?"partial":""}">${x.pending}</td><td><b>${fmtPct(x.rate)}</b></td></tr>`).join("")}</tbody></table></div></section>
      ${fullRole()?`<section class="qei-box"><h3>QC Operational Performance</h3><p>Session reviews, tutor coverage, quality, flags, objection decisions and QC SLA per coordinator.</p><div class="qei-scroll"><table><thead><tr><th>QC</th><th>Reviews</th><th>Tutors</th><th>Avg Score</th><th>Flagged</th><th>Flags</th><th>Objections</th><th>Approved</th><th>Partial</th><th>Rejected</th><th>In Progress</th><th>Within</th><th>Late</th><th>Pending</th><th>QC SLA</th><th>Avg Response</th></tr></thead><tbody>${qcs.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td><b>${x.reviews}</b></td><td>${x.tutors}</td><td>${fmtPct(x.avg)}</td><td>${x.flagged}</td><td>${x.flags}</td><td>${x.objections}</td><td class="ok">${x.approved}</td><td class="partial">${x.partial}</td><td class="bad">${x.rejected}</td><td>${x.pending}</td><td class="ok">${x.within}</td><td class="${x.late?"bad":"ok"}">${x.late}</td><td class="${x.pending?"partial":""}">${x.pending}</td><td><b>${fmtPct(x.rate)}</b></td><td>${fmtHours(x.avg)}</td></tr>`).join("")}</tbody></table></div></section>`:""}
      <div class="qei-grid"><article class="qei-box"><h3>Organization Performance</h3><div class="qei-scroll qei-tall"><table><thead><tr><th>Organization</th><th>Reviews</th><th>Tutors</th><th>Teams</th><th>Tutor Avg</th><th>Session Avg</th><th>Flags</th><th>Objections</th></tr></thead><tbody>${orgs.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.reviews}</td><td>${x.tutors}</td><td>${x.teams}</td><td><b>${fmtPct(x.tutorAvg)}</b></td><td>${fmtPct(x.sessionAvg)}</td><td>${x.flags}</td><td>${x.objections}</td></tr>`).join("")}</tbody></table></div></article><article class="qei-box"><h3>Cycle Comparison</h3><div class="qei-scroll qei-tall"><table><thead><tr><th>Cycle</th><th>Reviews</th><th>Tutors</th><th>Tutor Avg</th><th>Session Avg</th><th>Flags</th><th>Objections</th><th>Approved</th><th>Rejected</th></tr></thead><tbody>${cycles.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${x.reviews}</td><td>${x.tutors}</td><td>${fmtPct(x.tutorAvg)}</td><td>${fmtPct(x.sessionAvg)}</td><td>${x.flags}</td><td>${x.objections}</td><td class="ok">${x.approved+x.partial}</td><td class="bad">${x.rejected}</td></tr>`).join("")}</tbody></table></div></article></div>
      <section class="qei-box"><h3>Tutor Risk & Development Watchlist</h3><p>Tutors below 90% or with one or more flags, ordered by lowest tutor average.</p><div class="qei-scroll qei-tall"><table><thead><tr><th>Tutor</th><th>Team</th><th>Organization</th><th>Reviews</th><th>Average</th><th>Flagged Reviews</th><th>Individual Flags</th><th>Latest Review</th></tr></thead><tbody>${riskTutors.map(x=>`<tr><td><b>${esc(x.name)}</b><small>${esc(x.id)}</small></td><td>${esc(x.team)}</td><td>${esc(x.org)}</td><td>${x.reviews}</td><td class="${x.avg<80?"bad":x.avg<90?"partial":""}"><b>${fmtPct(x.avg)}</b></td><td>${x.flagged}</td><td>${x.flags}</td><td>${x.latest?x.latest.toLocaleDateString("en-GB"):"—"}</td></tr>`).join("")||`<tr><td colspan="8" class="qei-empty">No tutors meet the current risk criteria.</td></tr>`}</tbody></table></div></section>
      <section class="qei-box"><h3>SLA Breach & Pending Watchlist</h3><p>${fullRole()?"TL, QC and QTL":"TL"} cases requiring follow-up. Late means completed after the target; pending means a required timestamp is missing.</p><div class="qei-scroll qei-tall"><table><thead><tr><th>ID</th><th>Tutor</th><th>Team Leader</th><th>Outcome</th><th>Late Stages</th><th>Pending Stages</th></tr></thead><tbody>${slaIssues.map(x=>`<tr><td><b>#${esc(x.row["Objection ID"])}</b></td><td>${esc(x.row["Tutor Name"]||x.row["Tutor ID"])}</td><td>${esc(x.row["Educational Team Lead (ETL)"])}</td><td>${esc(outcome(x.row))}</td><td class="${x.late.length?"bad":""}">${esc(x.late.map(s=>`${s.name} ${s.h.toFixed(1)}h`).join(" • ")||"—")}</td><td class="${x.pending.length?"partial":""}">${esc(x.pending.map(s=>s.name).join(" • ")||"—")}</td></tr>`).join("")||`<tr><td colspan="6" class="qei-empty">No late or pending SLA cases.</td></tr>`}</tbody></table></div></section>
      <section class="qei-box"><h3>Data Reliability Check</h3><p>Records with missing or invalid fields that can affect analysis accuracy.</p><div class="qei-data-grid">${card("Missing TL",fmtNum(missingTL),"Review rows without an assigned educational team lead",missingTL?"red":"green")}${fullRole()?card("Missing QC",fmtNum(missingQC),"Review rows without a QC name",missingQC?"red":"green"):""}${card("Invalid Score",fmtNum(invalidScore),"Review rows without a usable quality score",invalidScore?"red":"green")}${card("Missing Review Date",fmtNum(missingDate),"Review rows excluded from date trends",missingDate?"red":"green")}</div></section>`;

    panel.dataset.ready="1";
    panel.querySelectorAll("[data-qei]").forEach(input=>input.addEventListener("change",()=>{state[input.dataset.qei]=input.value;lastSignature="";render()}));
    panel.querySelector("[data-reset]")?.addEventListener("click",()=>{Object.keys(state).forEach(k=>state[k]="");lastSignature="";render()});
    panel.querySelectorAll("[data-export]").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.export==="summary")download("executive-quality-summary.csv",summaryRows);if(button.dataset.export==="reviews")download("executive-filtered-reviews.csv",R);if(button.dataset.export==="objections")download("executive-filtered-objections.csv",O)}));
  }

  function styles(){
    if(document.getElementById("qei-style"))return;
    const s=document.createElement("style");s.id="qei-style";s.textContent=`
      .qei-old{display:none!important}.qei-panel{display:flex;flex-direction:column;gap:18px;min-width:0;padding:22px;border:1px solid #dbe7f5;border-radius:24px;background:#fff;box-shadow:0 12px 38px rgba(31,42,85,.07)}
      .qei-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:16px;border-bottom:1px solid #e7edf5}.qei-panel header small{color:#056FEC;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.15em}.qei-panel h2{margin:4px 0;color:#1F2A55;font-size:24px;font-weight:900}.qei-panel h3{margin:0 0 5px;color:#1F2A55;font-size:16px;font-weight:900}.qei-panel p{margin:0;color:#718096;font-size:11px;line-height:1.55}.qei-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.qei-actions button,.qei-filter button{height:38px;padding:0 12px;border:1px solid #cfe0f5;border-radius:11px;background:#fff;color:#056FEC;font-size:11px;font-weight:850;cursor:pointer}
      .qei-filter{padding:0;border:1px solid #dfe8f2;border-radius:18px;background:#f8fbff}.qei-filter summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;cursor:pointer;list-style:none}.qei-filter summary::-webkit-details-marker{display:none}.qei-filter summary b{color:#1F2A55}.qei-filter summary small{display:block;margin-top:3px;color:#8a9bad}.qei-filter summary i{color:#056FEC;font-size:18px;font-style:normal;transition:transform .2s}.qei-filter:not([open]) summary i{transform:rotate(-90deg)}.qei-filter-grid{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:10px;padding:0 16px 16px}.qei-filter label span{display:block;margin-bottom:5px;color:#718096;font-size:9px;font-weight:900;text-transform:uppercase}.qei-filter select,.qei-filter input{width:100%;height:40px;padding:0 10px;border:1px solid #dbe4ef;border-radius:10px;background:#fff;color:#334155;font-size:11px}.qei-filter button{align-self:end}
      .qei-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.qei-kpi{min-width:0;min-height:112px;padding:16px;border:1px solid #e4ebf4;border-left:5px solid #056FEC;border-radius:17px;background:#fff}.qei-kpi small{color:#718096;font-size:9px;font-weight:900;text-transform:uppercase}.qei-kpi strong{display:block;margin-top:9px;color:#1F2A55;font-size:24px}.qei-kpi p{margin-top:8px}.qei-green{border-left-color:#16A66A}.qei-orange{border-left-color:#FF8A1F}.qei-red{border-left-color:#E84C4F}
      .qei-insights{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.qei-insights article{padding:15px;border:1px solid #dfe8f2;border-radius:16px;background:#f8fbff}.qei-insights small{color:#056FEC;font-size:9px;font-weight:900;text-transform:uppercase}.qei-insights b{display:block;margin:7px 0;color:#1F2A55;font-size:14px}
      .qei-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.qei-box{min-width:0;padding:18px;border:1px solid #e4ebf4;border-radius:19px;background:#fff}.qei-bars{display:flex;flex-direction:column;gap:10px;margin-top:14px}.qei-bar{display:grid;grid-template-columns:minmax(110px,1.2fr) minmax(120px,2fr) 62px;align-items:center;gap:10px;font-size:11px}.qei-bar span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#42526b;font-weight:750}.qei-bar i{height:9px;overflow:hidden;border-radius:999px;background:#edf2f7}.qei-bar em{display:block;height:100%;border-radius:999px;background:#056FEC}.qei-orange-bars .qei-bar em{background:#FF8A1F}.qei-bar b{text-align:right;color:#1F2A55}.qei-outcomes{display:grid;grid-template-columns:auto 1fr;gap:12px 14px;margin-top:17px;align-items:center}.qei-outcomes b{font-size:23px;color:#1F2A55}.ok{color:#128157!important;font-weight:850}.partial{color:#b66b00!important;font-weight:850}.bad{color:#b42318!important;font-weight:850}
      .qei-sla-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:14px}.qei-sla-grid article{padding:16px;border:1px solid #e4ebf4;border-radius:16px}.qei-sla-grid small{color:#718096;font-size:9px;font-weight:900;text-transform:uppercase}.qei-sla-grid strong{display:block;margin:8px 0;color:#1F2A55;font-size:25px}.qei-sla-grid div{display:flex;flex-wrap:wrap;gap:8px;font-size:10px}.qei-sla-grid p{margin-top:9px}
      .qei-scroll{width:100%;max-width:100%;margin-top:13px;overflow:auto}.qei-scroll table{width:max-content;min-width:100%;border-collapse:collapse;font-size:11px}.qei-scroll th{padding:10px 12px;background:#f6f9fd;color:#718096;text-align:left;text-transform:uppercase;font-size:9px;white-space:nowrap}.qei-scroll td{padding:11px 12px;border-top:1px solid #edf1f6;color:#42526b;white-space:nowrap}.qei-scroll td small{display:block;margin-top:3px;color:#94a3b8}.qei-scroll b{color:#1F2A55}.qei-tall{max-height:440px}.qei-empty{padding:26px!important;text-align:center;color:#8494a7}.qei-data-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}.qei-data-grid .qei-kpi{min-height:105px}
      @media(max-width:1500px){.qei-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}.qei-filter-grid{grid-template-columns:repeat(3,minmax(130px,1fr))}}
      @media(max-width:1100px){.qei-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.qei-insights,.qei-data-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.qei-sla-grid{grid-template-columns:1fr}.qei-grid{grid-template-columns:1fr}}
      @media(max-width:700px){.qei-panel{padding:14px}.qei-panel>header{flex-direction:column}.qei-actions{width:100%}.qei-actions button{flex:1}.qei-kpis,.qei-insights,.qei-data-grid,.qei-filter-grid{grid-template-columns:1fr}.qei-scroll table{min-width:900px}.qei-bar{grid-template-columns:minmax(90px,1fr) minmax(90px,1.4fr) 55px}}
    `;document.head.appendChild(s);
  }
  function schedule(force=false){if(queued)return;queued=true;requestAnimationFrame(async()=>{queued=false;await load(force);render()})}
  styles();
  window.addEventListener("qa-auth-ready",()=>setTimeout(()=>schedule(true),500));
  document.addEventListener("click",()=>setTimeout(()=>schedule(false),80));
  document.addEventListener("change",event=>{if(!event.target.closest?.(`#${PANEL}`))setTimeout(()=>{lastSignature="";schedule(false)},80)});
  new MutationObserver(()=>setTimeout(()=>schedule(false),60)).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>schedule(true),900),{once:true}):setTimeout(()=>schedule(true),900);
  setInterval(()=>schedule(false),1500);
})();