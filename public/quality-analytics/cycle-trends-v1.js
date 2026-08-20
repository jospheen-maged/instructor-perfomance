(()=>{
  "use strict";
  const DB="quality-operations-analytics",STORE="datasets",NAV="qct-nav",VIEW="qct-view",ACTIVE="qct-active";
  const CORE=["Setup","Attitude","Preparation","Curriculum","Teaching"];
  let reviews=[],loaded=false,renderQueued=false;
  const state={endCycle:"",lookback:"3",org:"",tl:"",rank:"overall",search:""};

  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const esc=v=>clean(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const num=v=>{const n=Number(clean(v).replace(/[% ,]/g,""));return Number.isFinite(n)?n:null};
  const metricScore=v=>{const n=num(v);return n===null?null:(n<=5?n*20:n)};
  const avg=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
  const pct=(a,b)=>b?a/b*100:0;
  const fmt=v=>Number.isFinite(v)?`${v.toFixed(1)}%`:"—";
  const signed=v=>Number.isFinite(v)?`${v>0?"+":""}${v.toFixed(1)} pp`:"—";
  const fnum=v=>new Intl.NumberFormat("en-GB").format(Number(v)||0);
  const uniq=a=>[...new Set(a.map(clean).filter(v=>v&&v!=="--"))].sort((a,b)=>a.localeCompare(b));
  const role=()=>window.__QA_ACCESS_ROLE__||window.__QA_ROLE__||document.documentElement.dataset.qaAccessRole||document.documentElement.dataset.qaRole||"";
  const allowed=()=>["admin","management","quality","supervisors","teamleaders"].includes(role());

  function reviewScore(row){
    const values=CORE.map(k=>metricScore(row[k])).filter(Number.isFinite);
    return values.length?avg(values):metricScore(row["Overall Score %"]);
  }
  function flags(row){
    const raw=clean(row.Flags);if(!raw||raw==="--"||/^(none|no)$/i.test(raw))return[];
    const list=raw.split(/\r?\n|\s*\|\s*|\s*;\s*/).map(clean).filter(v=>v&&v!=="--");
    return list.length?list:[raw];
  }
  function tutorKey(row){return clean(row["Tutor ID"])||clean(row.Tutor)||"Unknown Tutor"}
  function cycleDate(name){
    const months={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
    const m=clean(name).toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/);
    return m?new Date(Number(m[2]),months[m[1]],1):null;
  }
  function sortedCycles(rows=reviews){
    return uniq(rows.map(r=>r.Review_Cycle)).sort((a,b)=>{
      const da=cycleDate(a),db=cycleDate(b);if(da&&db)return da-db;return a.localeCompare(b);
    });
  }
  function openDB(){return new Promise((ok,no)=>{const q=indexedDB.open(DB,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE)};q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
  async function read(kind){try{const db=await openDB();return await new Promise((ok,no)=>{const q=db.transaction(STORE,"readonly").objectStore(STORE).get(kind);q.onsuccess=()=>ok(Array.isArray(q.result)?q.result:[]);q.onerror=()=>no(q.error)})}catch{return[]}}
  async function load(force=false){if(loaded&&!force)return;reviews=await read("reviews");loaded=true;if(!state.endCycle){const c=sortedCycles();state.endCycle=c.at(-1)||""}}

  function windowCycles(){
    const all=sortedCycles(),end=state.endCycle||all.at(-1)||"";let idx=all.indexOf(end);if(idx<0)idx=all.length-1;
    const count=state.lookback==="all"?all.length:Math.max(2,Number(state.lookback)||3);
    return all.slice(Math.max(0,idx-count+1),idx+1);
  }
  function baseRows(){return reviews.filter(r=>(!state.org||clean(r.Organization_Name)===state.org)&&(!state.tl||clean(r.Educational_Team_Lead)===state.tl))}
  function rowsForCycle(cycle,rows=baseRows()){return rows.filter(r=>clean(r.Review_Cycle)===cycle)}
  function tutorSummary(rows){
    const map=new Map();
    rows.forEach(r=>{const id=tutorKey(r);if(!map.has(id))map.set(id,[]);map.get(id).push(r)});
    return [...map.entries()].map(([id,rr])=>({id,score:avg(rr.map(reviewScore).filter(Number.isFinite)),reviews:rr.length,rows:rr}));
  }
  function cycleSummary(cycle,rows=baseRows()){
    const rr=rowsForCycle(cycle,rows),tutors=tutorSummary(rr),scores=rr.map(reviewScore).filter(Number.isFinite);
    return{cycle,reviews:rr.length,tutors:tutors.length,tutorAvg:avg(tutors.map(t=>t.score).filter(Number.isFinite)),sessionAvg:avg(scores),flagged:rr.filter(r=>flags(r).length).length,flags:rr.reduce((s,r)=>s+flags(r).length,0),tls:new Set(rr.map(r=>clean(r.Educational_Team_Lead)).filter(v=>v&&v!=="--")).size,orgs:new Set(rr.map(r=>clean(r.Organization_Name)).filter(Boolean)).size};
  }
  function movementRows(cycles,rows=baseRows()){
    const tutorMap=new Map();
    rows.filter(r=>cycles.includes(clean(r.Review_Cycle))).forEach(r=>{const id=tutorKey(r);if(!tutorMap.has(id))tutorMap.set(id,{id,rows:[]});tutorMap.get(id).rows.push(r)});
    return [...tutorMap.values()].map(t=>{
      const by={};cycles.forEach(c=>{const rr=t.rows.filter(r=>clean(r.Review_Cycle)===c),scores=rr.map(reviewScore).filter(Number.isFinite);by[c]={score:avg(scores),reviews:rr.length}});
      const latestRow=[...t.rows].sort((a,b)=>cycles.indexOf(clean(b.Review_Cycle))-cycles.indexOf(clean(a.Review_Cycle)))[0]||{};
      const deltas=cycles.slice(1).map((c,i)=>{const a=by[cycles[i]]?.score,b=by[c]?.score;return Number.isFinite(a)&&Number.isFinite(b)?b-a:null});
      const first=by[cycles[0]]?.score,last=by[cycles.at(-1)]?.score;
      const overall=Number.isFinite(first)&&Number.isFinite(last)?last-first:null;
      const latest=deltas.at(-1)??null;
      const validDeltas=deltas.filter(Number.isFinite),worst=validDeltas.length?Math.min(...validDeltas):null;
      return{id:t.id,name:clean(latestRow.Tutor)||t.id,tl:clean(latestRow.Educational_Team_Lead)||"Unassigned",org:clean(latestRow.Organization_Name)||"Unassigned",by,deltas,overall,latest,worst,flags:t.rows.reduce((s,r)=>s+flags(r).length,0)};
    });
  }
  function rankValue(row){return state.rank==="latest"?row.latest:state.rank==="worst"?row.worst:row.overall}
  function rankedMovements(cycles,rows){
    const all=movementRows(cycles,rows).filter(r=>Number.isFinite(rankValue(r)));
    const search=state.search.toLowerCase();
    const filtered=search?all.filter(r=>[r.id,r.name,r.tl,r.org].some(v=>clean(v).toLowerCase().includes(search))):all;
    return{
      downgraded:[...filtered].filter(r=>rankValue(r)<0).sort((a,b)=>rankValue(a)-rankValue(b)).slice(0,20),
      improved:[...filtered].filter(r=>rankValue(r)>0).sort((a,b)=>rankValue(b)-rankValue(a)).slice(0,20),
      all:filtered
    };
  }
  function transitionStats(cycles,rows){
    const moves=movementRows(cycles,rows);
    return cycles.slice(1).map((cycle,i)=>{
      const prev=cycles[i],vals=moves.map(m=>{const a=m.by[prev]?.score,b=m.by[cycle]?.score;return Number.isFinite(a)&&Number.isFinite(b)?b-a:null}).filter(Number.isFinite);
      return{from:prev,to:cycle,matched:vals.length,avgDelta:avg(vals),down:vals.filter(v=>v<-.05).length,up:vals.filter(v=>v>.05).length,flat:vals.filter(v=>Math.abs(v)<=.05).length};
    });
  }
  function entityMovement(kind,cycles,rows){
    if(cycles.length<2)return[];const prev=cycles.at(-2),cur=cycles.at(-1),key=kind==="tl"?r=>clean(r.Educational_Team_Lead)||"Unassigned":r=>clean(r.Organization_Name)||"Unassigned";
    const names=uniq(rows.map(key));
    return names.map(name=>{
      const p=rows.filter(r=>clean(r.Review_Cycle)===prev&&key(r)===name),c=rows.filter(r=>clean(r.Review_Cycle)===cur&&key(r)===name);
      const ps=tutorSummary(p),cs=tutorSummary(c),pa=avg(ps.map(x=>x.score).filter(Number.isFinite)),ca=avg(cs.map(x=>x.score).filter(Number.isFinite));
      return{name,previous:pa,current:ca,delta:Number.isFinite(pa)&&Number.isFinite(ca)?ca-pa:null,reviews:c.length,tutors:cs.length,flags:c.reduce((s,r)=>s+flags(r).length,0)};
    }).filter(x=>Number.isFinite(x.current)||Number.isFinite(x.previous)).sort((a,b)=>(a.delta??999)-(b.delta??999));
  }

  function trendChart(data){
    if(!data.length)return`<div class="qct-empty">No trend data.</div>`;
    const vals=data.flatMap(d=>[d.tutorAvg,d.sessionAvg]).filter(Number.isFinite);if(!vals.length)return`<div class="qct-empty">No valid scores.</div>`;
    const min=Math.max(0,Math.floor((Math.min(...vals)-4)/5)*5),max=Math.min(100,Math.max(100,Math.ceil((Math.max(...vals)+2)/5)*5)),w=900,h=250,pad={l:48,r:22,t:20,b:48},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
    const x=i=>pad.l+(data.length===1?iw/2:i*iw/(data.length-1)),y=v=>pad.t+(max-v)/(max-min||1)*ih;
    const tutorPts=data.map((d,i)=>Number.isFinite(d.tutorAvg)?`${x(i)},${y(d.tutorAvg)}`:null).filter(Boolean).join(" "),sessionPts=data.map((d,i)=>Number.isFinite(d.sessionAvg)?`${x(i)},${y(d.sessionAvg)}`:null).filter(Boolean).join(" ");
    const ticks=[min,min+(max-min)/2,max];
    return`<div class="qct-chart-wrap"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Cycle quality score trend">${ticks.map(v=>`<line x1="${pad.l}" x2="${w-pad.r}" y1="${y(v)}" y2="${y(v)}" class="qct-gridline"/><text x="${pad.l-8}" y="${y(v)+4}" text-anchor="end" class="qct-axis">${v.toFixed(0)}%</text>`).join("")}<polyline points="${tutorPts}" class="qct-line qct-line-a"/><polyline points="${sessionPts}" class="qct-line qct-line-b"/>${data.map((d,i)=>`<text x="${x(i)}" y="${h-17}" text-anchor="middle" class="qct-axis">${esc(d.cycle.replace(/\s+20\d\d$/,""))}</text>${Number.isFinite(d.tutorAvg)?`<circle cx="${x(i)}" cy="${y(d.tutorAvg)}" r="5" class="qct-dot-a"><title>${esc(d.cycle)} tutor avg ${fmt(d.tutorAvg)}</title></circle>`:""}${Number.isFinite(d.sessionAvg)?`<circle cx="${x(i)}" cy="${y(d.sessionAvg)}" r="4" class="qct-dot-b"><title>${esc(d.cycle)} session avg ${fmt(d.sessionAvg)}</title></circle>`:""}`).join("")}</svg><div class="qct-legend"><span><i class="a"></i>Tutor-weighted average</span><span><i class="b"></i>Session average</span></div></div>`;
  }
  const deltaClass=v=>!Number.isFinite(v)?"":v<-.05?"qct-bad":v>.05?"qct-good":"qct-neutral";
  const card=(label,value,note,tone="")=>`<article class="qct-kpi ${tone&&`qct-${tone}`}\"><small>${esc(label)}</small><strong>${esc(value)}</strong><p>${esc(note)}</p></article>`;
  const select=(key,label,items)=>`<label><span>${esc(label)}</span><select data-qct="${key}">${items.map(x=>{const value=Array.isArray(x)?x[0]:x,text=Array.isArray(x)?x[1]:x;return`<option value="${esc(value)}" ${state[key]===value?"selected":""}>${esc(text)}</option>`}).join("")}</select></label>`;
  function movementTable(rows,cycles,kind){
    const headers=cycles.map(c=>`<th>${esc(c)}<small>Score / reviews</small></th>`).join("");
    const deltaHeads=cycles.slice(1).map((c,i)=>`<th>${esc(cycles[i].replace(/\s+20\d\d$/,""))} → ${esc(c.replace(/\s+20\d\d$/,""))}</th>`).join("");
    return`<div class="qct-scroll qct-tall"><table><thead><tr><th>Tutor</th><th>TL / Team</th><th>Organization</th>${headers}${deltaHeads}<th>${state.rank==="latest"?"Latest Δ":state.rank==="worst"?"Worst Step":"Overall Δ"}</th><th>Flags</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b><small>${esc(r.id)}</small></td><td>${esc(r.tl)}</td><td>${esc(r.org)}</td>${cycles.map(c=>`<td><b>${fmt(r.by[c]?.score)}</b><small>${r.by[c]?.reviews||0} review${r.by[c]?.reviews===1?"":"s"}</small></td>`).join("")}${r.deltas.map(d=>`<td class="${deltaClass(d)}"><b>${signed(d)}</b></td>`).join("")}<td class="${deltaClass(rankValue(r))}"><b>${signed(rankValue(r))}</b></td><td>${r.flags}</td></tr>`).join("")||`<tr><td colspan="${6+cycles.length*2}" class="qct-empty">No ${kind} tutors match this period and filter.</td></tr>`}</tbody></table></div>`;
  }
  function entityTable(rows,label){return`<div class="qct-scroll"><table><thead><tr><th>${label}</th><th>Previous</th><th>Current</th><th>Change</th><th>Current Reviews</th><th>Tutors</th><th>Flags</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${fmt(r.previous)}</td><td><b>${fmt(r.current)}</b></td><td class="${deltaClass(r.delta)}"><b>${signed(r.delta)}</b></td><td>${r.reviews}</td><td>${r.tutors}</td><td>${r.flags}</td></tr>`).join("")||`<tr><td colspan="7" class="qct-empty">No comparable ${label.toLowerCase()} data.</td></tr>`}</tbody></table></div>`}
  function csv(rows){if(!rows.length)return"";const headers=uniq(rows.flatMap(Object.keys)),q=v=>{const x=clean(v);return/[",\n\r]/.test(x)?`"${x.replaceAll('"','""')}"`:x};return[headers.join(","),...rows.map(r=>headers.map(h=>q(r[h])).join(","))].join("\n")}
  function download(name,rows){const blob=new Blob([csv(rows)],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}

  function render(){
    const view=document.getElementById(VIEW);if(!view||!document.body.classList.contains(ACTIVE))return;
    const allCycles=sortedCycles(),cycles=windowCycles(),rows=baseRows(),summaries=cycles.map(c=>cycleSummary(c,rows)),ranked=rankedMovements(cycles,rows),transitions=transitionStats(cycles,rows),current=summaries.at(-1)||{},prev=summaries.at(-2)||{},currentDelta=Number.isFinite(current.tutorAvg)&&Number.isFinite(prev.tutorAvg)?current.tutorAvg-prev.tutorAvg:null,first=summaries[0]||{},periodDelta=Number.isFinite(current.tutorAvg)&&Number.isFinite(first.tutorAvg)?current.tutorAvg-first.tutorAvg:null;
    const orgs=uniq(reviews.map(r=>r.Organization_Name)),tls=uniq(reviews.map(r=>r.Educational_Team_Lead));
    const tlMoves=entityMovement("tl",cycles,rows),orgMoves=entityMovement("org",cycles,rows);
    const currentRows=current.cycle?rowsForCycle(current.cycle,rows):[],currentFlags=currentRows.reduce((s,r)=>s+flags(r).length,0);
    const availability=cycles.length<3?`Only ${cycles.length} cycle${cycles.length===1?" is":"s are"} available in this window. When the missing earlier cycle is uploaded, it will appear here automatically.`:`Showing ${cycles.length} cycles ending with ${current.cycle}.`;
    view.innerHTML=`
      <header class="qct-head"><div><small>Longitudinal Quality Intelligence</small><h1>Cycle Trends & Tutor Movement</h1><p>Compare quality across cycles and identify tutors, teams and organizations that are improving or declining.</p></div><div class="qct-actions"><button data-export="trend">Export Cycle Trend</button><button data-export="down">Export Tutor Downgrades</button></div></header>
      <section class="qct-filter"><div class="qct-filter-grid">${select("endCycle","Reference Cycle",allCycles.map(c=>[c,c]))}${select("lookback","Lookback",[["3","Last 3 cycles"],["6","Last 6 cycles"],["12","Last 12 cycles"],["all","All uploaded cycles"]])}<label><span>Organization</span><select data-qct="org"><option value="">All</option>${orgs.map(v=>`<option ${state.org===v?"selected":""}>${esc(v)}</option>`).join("")}</select></label><label><span>TL / Team</span><select data-qct="tl"><option value="">All</option>${tls.map(v=>`<option ${state.tl===v?"selected":""}>${esc(v)}</option>`).join("")}</select></label>${select("rank","Tutor Ranking",[["overall","Overall period drop"],["latest","Latest cycle drop"],["worst","Worst cycle-to-cycle drop"]])}<label><span>Tutor Search</span><input data-qct="search" value="${esc(state.search)}" placeholder="Name or ID"></label><button data-reset>Reset Filters</button></div><p class="qct-availability">${esc(availability)}</p></section>
      <section class="qct-kpis">${card("Current Tutor Average",fmt(current.tutorAvg),current.cycle||"No cycle","green")}${card("vs Previous Cycle",signed(currentDelta),prev.cycle?`${prev.cycle} → ${current.cycle}`:"No previous cycle",currentDelta<0?"red":"green")}${card("Period Movement",signed(periodDelta),cycles.length>1?`${cycles[0]} → ${cycles.at(-1)}`:"Need another cycle",periodDelta<0?"red":"green")}${card("Current Reviews",fnum(current.reviews),`${fnum(current.tutors)} unique tutors`)}${card("Current Flag Rate",fmt(pct(current.flagged,current.reviews)),`${currentFlags} individual flags`,current.flagged?"orange":"green")}${card("Comparable Tutors",fnum(ranked.all.length),"Tutors with enough cycle data")}</section>
      <section class="qct-box"><div class="qct-title"><div><h2>Quality Score Trend</h2><p>Tutor-weighted average gives every tutor equal weight; session average gives every review equal weight.</p></div></div>${trendChart(summaries)}</section>
      <section class="qct-box"><div class="qct-title"><div><h2>Cycle Performance Summary</h2><p>Coverage, score and flag movement by uploaded cycle.</p></div></div><div class="qct-scroll"><table><thead><tr><th>Cycle</th><th>Reviews</th><th>Unique Tutors</th><th>Tutor Avg</th><th>Session Avg</th><th>Flagged Reviews</th><th>Flag Rate</th><th>Individual Flags</th><th>TLs</th><th>Organizations</th></tr></thead><tbody>${summaries.map(x=>`<tr><td><b>${esc(x.cycle)}</b></td><td>${x.reviews}</td><td>${x.tutors}</td><td><b>${fmt(x.tutorAvg)}</b></td><td>${fmt(x.sessionAvg)}</td><td>${x.flagged}</td><td>${fmt(pct(x.flagged,x.reviews))}</td><td>${x.flags}</td><td>${x.tls}</td><td>${x.orgs}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="qct-box"><div class="qct-title"><div><h2>Between-Cycle Movement</h2><p>Only tutors present in both adjacent cycles are included in each transition.</p></div></div><div class="qct-transition-grid">${transitions.map(t=>`<article><small>${esc(t.from)} → ${esc(t.to)}</small><strong class="${deltaClass(t.avgDelta)}">${signed(t.avgDelta)}</strong><p>${t.matched} matched tutors</p><div><span class="qct-good">↑ ${t.up} improved</span><span class="qct-bad">↓ ${t.down} downgraded</span><span>${t.flat} stable</span></div></article>`).join("")||`<p class="qct-empty">Upload at least two cycles to calculate movement.</p>`}</div></section>
      <section class="qct-box"><div class="qct-title"><div><h2>Top 20 Tutors Who Downgraded</h2><p>Ranked by ${state.rank==="latest"?"the latest cycle-to-cycle change":state.rank==="worst"?"their worst single cycle-to-cycle drop":"the total change from the first to last cycle in the selected window"}.</p></div><span>${ranked.downgraded.length} shown</span></div>${movementTable(ranked.downgraded,cycles,"downgraded")}</section>
      <section class="qct-box"><div class="qct-title"><div><h2>Top 20 Tutors Who Improved</h2><p>The positive side of the same ranking method, useful for recognition and follow-up validation.</p></div><span>${ranked.improved.length} shown</span></div>${movementTable(ranked.improved,cycles,"improved")}</section>
      <div class="qct-two"><section class="qct-box"><div class="qct-title"><div><h2>TL / Team Movement</h2><p>Current reference cycle compared with the immediately previous uploaded cycle.</p></div></div>${entityTable(tlMoves,"TL / Team")}</section><section class="qct-box"><div class="qct-title"><div><h2>Organization Movement</h2><p>Current reference cycle compared with the immediately previous uploaded cycle.</p></div></div>${entityTable(orgMoves,"Organization")}</section></div>`;

    view.querySelectorAll("[data-qct]").forEach(el=>{const evt=el.tagName==="INPUT"&&el.dataset.qct==="search"?"input":"change";el.addEventListener(evt,()=>{state[el.dataset.qct]=el.value;schedule(false)})});
    view.querySelector("[data-reset]")?.addEventListener("click",()=>{state.org="";state.tl="";state.rank="overall";state.search="";state.lookback="3";state.endCycle=sortedCycles().at(-1)||"";schedule(false)});
    view.querySelector('[data-export="trend"]')?.addEventListener("click",()=>download("cycle-trend-summary.csv",summaries.map(x=>({Cycle:x.cycle,Reviews:x.reviews,"Unique Tutors":x.tutors,"Tutor Weighted Average":x.tutorAvg?.toFixed(2)||"","Session Average":x.sessionAvg?.toFixed(2)||"","Flagged Reviews":x.flagged,"Flag Rate":pct(x.flagged,x.reviews).toFixed(2),"Individual Flags":x.flags,TLs:x.tls,Organizations:x.orgs}))));
    view.querySelector('[data-export="down"]')?.addEventListener("click",()=>download("top-tutor-downgrades.csv",ranked.downgraded.map(r=>{const out={"Tutor ID":r.id,"Tutor Name":r.name,"TL / Team":r.tl,Organization:r.org,Flags:r.flags,"Ranking Change":rankValue(r)?.toFixed(2)||""};cycles.forEach((c,i)=>{out[`${c} Score`]=r.by[c]?.score?.toFixed(2)||"";out[`${c} Reviews`]=r.by[c]?.reviews||0;if(i>0)out[`${cycles[i-1]} to ${c} Delta`]=r.deltas[i-1]?.toFixed(2)||""});return out})));
  }

  function styles(){if(document.getElementById("qct-style"))return;const s=document.createElement("style");s.id="qct-style";s.textContent=`
    #${VIEW}{display:none;padding:26px;max-width:1600px;margin:0 auto}body.${ACTIVE} main>header,body.${ACTIVE} main>.space-y-6{display:none!important}body.${ACTIVE} #${VIEW}{display:block}.qct-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:18px;padding:24px;border-radius:22px;background:linear-gradient(135deg,#0B234A,#1769E0);color:#fff}.qct-head small{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#bfdbfe}.qct-head h1{margin:6px 0 7px;font-size:27px;font-weight:900}.qct-head p{margin:0;color:#dbeafe;font-size:12px}.qct-actions{display:flex;gap:8px;flex-wrap:wrap}.qct-actions button,.qct-filter button{height:40px;padding:0 13px;border:1px solid #cfe0f5;border-radius:11px;background:#fff;color:#056FEC;font-size:11px;font-weight:850;cursor:pointer}.qct-box,.qct-filter{margin-top:16px;padding:18px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 8px 24px rgba(31,42,85,.05)}.qct-filter{margin-top:0}.qct-filter-grid{display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));gap:10px;align-items:end}.qct-filter label span{display:block;margin-bottom:5px;color:#718096;font-size:9px;font-weight:900;text-transform:uppercase}.qct-filter input,.qct-filter select{width:100%;height:40px;padding:0 10px;border:1px solid #dbe4ef;border-radius:10px;background:#fff;color:#334155;font-size:11px}.qct-availability{margin:11px 0 0;color:#718096;font-size:11px}.qct-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:11px;margin-top:16px}.qct-kpi{padding:15px;border:1px solid #e4ebf4;border-left:5px solid #056FEC;border-radius:16px;background:#fff}.qct-kpi small{font-size:9px;font-weight:900;text-transform:uppercase;color:#718096}.qct-kpi strong{display:block;margin-top:8px;font-size:23px;color:#1F2A55}.qct-kpi p{margin:7px 0 0;color:#718096;font-size:10px;line-height:1.4}.qct-green{border-left-color:#16A66A}.qct-red{border-left-color:#E84C4F}.qct-orange{border-left-color:#FF8A1F}.qct-title{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.qct-title h2{margin:0;color:#1F2A55;font-size:16px;font-weight:900}.qct-title p{margin:4px 0 0;color:#718096;font-size:11px}.qct-title>span{padding:6px 9px;border-radius:999px;background:#edf5ff;color:#056FEC;font-size:10px;font-weight:850}.qct-chart-wrap{margin-top:12px;overflow-x:auto}.qct-chart-wrap svg{display:block;width:100%;min-width:700px;height:auto}.qct-gridline{stroke:#e6edf5;stroke-width:1}.qct-axis{fill:#8494a7;font-size:10px}.qct-line{fill:none;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.qct-line-a{stroke:#056FEC}.qct-line-b{stroke:#16A66A}.qct-dot-a{fill:#fff;stroke:#056FEC;stroke-width:3}.qct-dot-b{fill:#fff;stroke:#16A66A;stroke-width:3}.qct-legend{display:flex;justify-content:center;gap:18px;font-size:10px;color:#64748b}.qct-legend span{display:flex;align-items:center;gap:6px}.qct-legend i{width:16px;height:3px;border-radius:999px}.qct-legend i.a{background:#056FEC}.qct-legend i.b{background:#16A66A}.qct-scroll{width:100%;margin-top:12px;overflow:auto}.qct-tall{max-height:540px}.qct-scroll table{width:max-content;min-width:100%;border-collapse:collapse;font-size:11px}.qct-scroll th{position:sticky;top:0;z-index:1;padding:10px 11px;background:#f7f9fc;color:#718096;text-align:left;text-transform:uppercase;font-size:9px;white-space:nowrap}.qct-scroll th small{display:block;margin-top:3px;font-size:8px;text-transform:none}.qct-scroll td{padding:10px 11px;border-top:1px solid #edf1f6;color:#42526b;white-space:nowrap}.qct-scroll td small{display:block;margin-top:3px;color:#94a3b8}.qct-scroll td b{color:#1F2A55}.qct-good{color:#128157!important}.qct-bad{color:#b42318!important}.qct-neutral{color:#64748b!important}.qct-empty{padding:24px!important;text-align:center;color:#8494a7}.qct-transition-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:13px}.qct-transition-grid article{padding:14px;border:1px solid #e5ebf3;border-radius:15px}.qct-transition-grid small{color:#718096;font-size:9px;font-weight:900;text-transform:uppercase}.qct-transition-grid strong{display:block;margin:7px 0;font-size:22px}.qct-transition-grid p{margin:0;color:#8494a7;font-size:10px}.qct-transition-grid div{display:flex;gap:9px;flex-wrap:wrap;margin-top:8px;color:#64748b;font-size:9px;font-weight:750}.qct-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.qct-two .qct-box{min-width:0}
    @media(max-width:1450px){.qct-filter-grid{grid-template-columns:repeat(4,minmax(130px,1fr))}.qct-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:1000px){.qct-two{grid-template-columns:1fr}.qct-transition-grid{grid-template-columns:1fr 1fr}}
    @media(max-width:700px){#${VIEW}{padding:14px}.qct-head{flex-direction:column}.qct-actions{width:100%}.qct-actions button{flex:1}.qct-filter-grid,.qct-kpis,.qct-transition-grid{grid-template-columns:1fr}.qct-scroll table{min-width:900px}.qct-head h1{font-size:22px}}
  `;document.head.appendChild(s)}
  function ensureView(){let v=document.getElementById(VIEW);if(v)return v;const main=document.querySelector("main");if(!main)return null;v=document.createElement("section");v.id=VIEW;main.appendChild(v);return v}
  function setNavActive(on){const b=document.getElementById(NAV);if(!b)return;b.style.background=on?"#fff":"transparent";b.style.color=on?"#1e3a8a":"#dbeafe";b.style.boxShadow=on?"0 10px 20px rgba(0,0,0,.12)":"none"}
  function on(){if(!allowed())return;document.body.classList.add(ACTIVE);setNavActive(true);load(true).then(()=>schedule(false));window.scrollTo({top:0,behavior:"smooth"})}
  function off(){document.body.classList.remove(ACTIVE);setNavActive(false)}
  function injectNav(){
    if(!allowed()){document.getElementById(NAV)?.remove();off();return}
    if(document.getElementById(NAV))return;
    const nav=document.querySelector("aside nav");if(!nav)return;
    const b=document.createElement("button");b.id=NAV;b.type="button";b.className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition";b.style.color="#dbeafe";b.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/></svg><span>Cycle Trends</span>';
    b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();on()});
    const first=[...nav.querySelectorAll("button")].find(x=>/Executive Overview/i.test(clean(x.textContent)));first?.insertAdjacentElement("afterend",b)||nav.appendChild(b);
  }
  function schedule(force=false){if(renderQueued)return;renderQueued=true;requestAnimationFrame(async()=>{renderQueued=false;await load(force);ensureView();render()})}
  styles();ensureView();injectNav();
  window.addEventListener("qa-auth-ready",()=>{loaded=false;setTimeout(()=>{injectNav();if(document.body.classList.contains(ACTIVE))schedule(true)},350)});
  window.addEventListener("qa-cloud-data-ready",()=>{loaded=false;if(document.body.classList.contains(ACTIVE))setTimeout(()=>schedule(true),150)});
  document.addEventListener("click",e=>{const btn=e.target.closest?.("aside button");if(btn&&btn.id!==NAV)off()});
  new MutationObserver(()=>{injectNav();ensureView()}).observe(document.documentElement,{childList:true,subtree:true});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{injectNav();ensureView()},{once:true}):null;
})();