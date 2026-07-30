(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets";
  const CORE=["Setup","Attitude","Preparation","Curriculum","Teaching"];
  let running=false,lastSignature="";
  const text=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
  const clean=v=>String(v??"").trim();
  const number=v=>{const x=Number(clean(v).replace(/[% ,]/g,""));return Number.isFinite(x)?x:null};
  const mean=a=>{a=a.filter(Number.isFinite);return a.length?a.reduce((s,x)=>s+x,0)/a.length:0};
  const format=v=>`${Number(v||0).toFixed(1)}%`;
  const metricPct=v=>{const x=number(v);return x===null?null:(x<=5?x*20:x)};
  function sessionScore(row){
    const values=CORE.map(k=>metricPct(row[k])).filter(Number.isFinite);
    if(values.length===CORE.length)return mean(values);
    return metricPct(row["Overall Score %"]);
  }
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{const d=q.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function readReviews(){try{const d=await openDB();return await new Promise((ok,no)=>{const q=d.transaction(STORE,"readonly").objectStore(STORE).get("reviews");q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}catch{return[]}}
  function hideReviewSources(){
    document.querySelectorAll("h1,h2,h3,h4,p.font-bold,p.font-semibold").forEach(h=>{
      if(!/^Review sources$/i.test(text(h)))return;
      const card=h.closest("section")||h.closest("article")||h.parentElement?.parentElement;
      if(card)card.style.setProperty("display","none","important");
    });
    document.querySelectorAll("main label").forEach(label=>{
      const title=text(label.querySelector("span"));
      if(/^Sources$|^Review Source$/i.test(title))label.style.setProperty("display","none","important");
    });
  }
  function hideFeedbackColumns(root=document){
    root.querySelectorAll("table").forEach(table=>{
      const headers=[...table.querySelectorAll("thead th")];
      const indexes=headers.map((h,i)=>/^Feedback$/i.test(text(h))?i:-1).filter(i=>i>=0);
      if(!indexes.length)return;
      table.querySelectorAll("tr").forEach(row=>[...row.children].forEach((cell,i)=>{if(indexes.includes(i))cell.style.setProperty("display","none","important")}));
    });
    root.querySelectorAll(".qti-bar").forEach(row=>{if(/^Feedback$/i.test(text(row.querySelector("span"))))row.style.setProperty("display","none","important")});
  }
  function group(rows,key){const map=new Map();rows.forEach(r=>{const k=key(r);if(!k)return;if(!map.has(k))map.set(k,[]);map.get(k).push(r)});return map}
  function tutorStats(rows){
    const byId=group(rows,r=>clean(r["Tutor ID"])||clean(r.Tutor));
    const result=new Map();
    byId.forEach((items,id)=>result.set(id,{id,name:clean(items[0]?.Tutor)||id,team:clean(items[0]?.Educational_Team_Lead)||"Unassigned",org:clean(items[0]?.Organization_Name)||"—",average:mean(items.map(sessionScore).filter(Number.isFinite)),reviews:items.length}));
    return result;
  }
  function teamStats(rows,tutors){
    const byTeam=group(rows,r=>clean(r.Educational_Team_Lead)||"Unassigned"),result=new Map();
    byTeam.forEach((items,name)=>{const ids=[...new Set(items.map(r=>clean(r["Tutor ID"])||clean(r.Tutor)).filter(Boolean))],values=ids.map(id=>tutors.get(id)?.average).filter(Number.isFinite);result.set(name,{average:mean(values),sessionAverage:mean(items.map(sessionScore).filter(Number.isFinite)),tutors:ids.length,reviews:items.length})});
    return result;
  }
  function orgStats(rows,tutors){
    const byOrg=group(rows,r=>clean(r.Organization_Name)||"Unassigned"),result=new Map();
    byOrg.forEach((items,name)=>{const ids=[...new Set(items.map(r=>clean(r["Tutor ID"])||clean(r.Tutor)).filter(Boolean))],values=ids.map(id=>tutors.get(id)?.average).filter(Number.isFinite);result.set(name,{average:mean(values)})});
    return result;
  }
  function cycleStats(rows){
    const byCycle=group(rows,r=>clean(r.Review_Cycle)||"Unassigned"),result=new Map();
    byCycle.forEach((items,name)=>{const t=tutorStats(items);result.set(name,{average:mean([...t.values()].map(x=>x.average).filter(Number.isFinite))})});
    return result;
  }
  function article(title){return [...document.querySelectorAll(".qti-box")].find(x=>text(x.querySelector("h3"))===title)}
  function setCell(row,index,value){const cells=[...row.children];if(cells[index])cells[index].textContent=value}
  function fixTeamTable(teams){
    const box=article("Full Team Performance"),table=box?.querySelector("table");if(!table)return;
    const headers=[...table.querySelectorAll("thead th")],avgIndex=headers.findIndex(h=>/^Avg Score$|^Team Avg/i.test(text(h)));
    if(avgIndex>=0)headers[avgIndex].textContent="Team Avg (per Tutor)";
    table.querySelectorAll("tbody tr").forEach(row=>{const name=text(row.querySelector("td:first-child b")),stat=teams.get(name);if(stat&&avgIndex>=0)setCell(row,avgIndex,format(stat.average))});
    const p=box.querySelector("p");if(p)p.textContent="Team average gives every tutor equal weight. Feedback is separate and is not included in the quality score.";
  }
  function fixTutorTable(tutors){
    const box=article("Average Score per Tutor"),table=box?.querySelector("table");if(!table)return;
    const headers=[...table.querySelectorAll("thead th")],avgIndex=headers.findIndex(h=>/^Avg Score$|^Tutor Average$/i.test(text(h)));
    if(avgIndex>=0)headers[avgIndex].textContent="Tutor Average";
    table.querySelectorAll("tbody tr").forEach(row=>{const id=text(row.querySelector("td:first-child small")).split("•")[0].trim(),stat=tutors.get(id);if(stat&&avgIndex>=0)setCell(row,avgIndex,format(stat.average))});
    const p=box.querySelector("p");if(p)p.textContent="Average of the five scored metrics across the tutor’s reviewed sessions. Feedback does not affect this score.";
  }
  function fixTutorRanking(title,tutors){
    const box=article(title),table=box?.querySelector("table");if(!table)return;
    const headers=[...table.querySelectorAll("thead th")],avgIndex=headers.findIndex(h=>/^Average$/i.test(text(h)));
    table.querySelectorAll("tbody tr").forEach(row=>{const id=text(row.querySelector("td:first-child small")),stat=tutors.get(id);if(stat&&avgIndex>=0)setCell(row,avgIndex,format(stat.average))});
  }
  function fixSimpleTable(title,map){
    const box=article(title),table=box?.querySelector("table");if(!table)return;
    const headers=[...table.querySelectorAll("thead th")],avgIndex=headers.findIndex(h=>/^Average$|^Tutor-weighted Avg$/i.test(text(h)));
    if(avgIndex>=0)headers[avgIndex].textContent="Tutor-weighted Avg";
    table.querySelectorAll("tbody tr").forEach(row=>{const name=text(row.querySelector("td:first-child b")||row.querySelector("td:first-child")),stat=map.get(name);if(stat&&avgIndex>=0)setCell(row,avgIndex,format(stat.average))});
  }
  function fixKpi(tutors){
    const panel=document.getElementById("qa-team-intelligence");if(!panel)return;
    const card=[...panel.querySelectorAll(".qti-kpi")].find(x=>/^Overall Average$|^Whole Team Average$/i.test(text(x.querySelector("small"))));
    if(!card)return;
    const value=mean([...tutors.values()].map(x=>x.average).filter(Number.isFinite));
    card.querySelector("small").textContent="Whole Team Average";
    card.querySelector("strong").textContent=format(value);
    card.querySelector("p").textContent="Each tutor has equal weight • Setup, Attitude, Preparation, Curriculum and Teaching";
  }
  function fixMetricCopy(){
    const box=article("Quality Metric Averages")||article("Five Quality Metric Averages");if(!box)return;
    const h=box.querySelector("h3"),p=box.querySelector("p");if(h)h.textContent="Five Quality Metric Averages";if(p)p.textContent="Feedback is a separate measure and is not included in the quality score.";
  }
  async function apply(){
    if(running)return;running=true;
    try{
      hideReviewSources();hideFeedbackColumns();
      const panel=document.getElementById("qa-team-intelligence");if(!panel)return;
      const rows=Array.isArray(window.__QTI_CURRENT__?.R)?window.__QTI_CURRENT__.R:await readReviews();if(!rows.length)return;
      const signature=`${rows.length}|${rows.map(r=>clean(r["Tutor ID"])+clean(r["Review Date"])).slice(0,8).join("|")}|${panel.querySelectorAll("tbody tr").length}|${text(document.querySelector("main header h1"))}`;
      if(signature===lastSignature){hideFeedbackColumns(panel);return}lastSignature=signature;
      const tutors=tutorStats(rows),teams=teamStats(rows,tutors),orgs=orgStats(rows,tutors),cycles=cycleStats(rows);
      fixKpi(tutors);fixMetricCopy();fixTeamTable(teams);fixTutorTable(tutors);fixTutorRanking("Top Tutors",tutors);fixTutorRanking("Lowest Tutors",tutors);fixSimpleTable("Organization Performance",orgs);fixSimpleTable("Cycle Performance Trend",cycles);hideFeedbackColumns(panel);
    }finally{running=false}
  }
  const start=()=>{apply();new MutationObserver(()=>setTimeout(apply,40)).observe(document.documentElement,{childList:true,subtree:true});setInterval(apply,1200)};
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",start,{once:true}):start();
})();