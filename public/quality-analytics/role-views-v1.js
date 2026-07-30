(()=>{
  "use strict";
  const HIDE="qa-role-hidden";
  const txt=e=>String(e?.textContent||"").replace(/\s+/g," ").trim();
  const style=document.createElement("style");style.textContent=`.${HIDE}{display:none!important}html[data-qa-role="viewer"] aside{background:#1F2A55!important}html[data-qa-role="viewer"] #qae-panel header small{color:#056FEC!important}`;document.head.appendChild(style);
  function role(){try{return window.__QA_ROLE__||JSON.parse(localStorage.getItem("quality-analytics-auth-v2")||"null")?.role||""}catch{return""}}
  function hide(el){if(el)el.classList.add(HIDE)}
  function cardFor(el){if(!el)return null;let n=el;while(n&&n!==document.body){const t=txt(n),c=n.className?.toString?.()||"";if((n.tagName==="SECTION"||n.tagName==="ARTICLE"||/rounded-2xl/.test(c))&&t.length<3500)return n;n=n.parentElement}return el.parentElement}
  function headings(){return [...document.querySelectorAll("h1,h2,h3,h4,p.font-bold,p.font-semibold")]} 
  function removeInterpretation(){headings().filter(e=>/^SLA interpretation$/i.test(txt(e))).forEach(e=>hide(cardFor(e)))}
  function replaceYou(){const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(n.nodeValue?.includes("QTL (You)"))n.nodeValue=n.nodeValue.replaceAll("QTL (You)","QTL")}}
  function hideCardsByTitle(titles){headings().forEach(e=>{const v=txt(e).toLowerCase();if(titles.some(x=>v===x.toLowerCase()||v.startsWith(x.toLowerCase()))){const c=cardFor(e);if(c)hide(c)}})}
  function hideViewerNav(){document.querySelectorAll("aside button").forEach(b=>{const v=txt(b);if(["QC Analytics","Data Explorer","Settings"].includes(v))hide(b)});const title=txt(document.querySelector("main header h1"));if(["QC Analytics","Data Explorer","Workspace Settings"].includes(title)){[...document.querySelectorAll("aside button")].find(b=>txt(b)==="Executive Overview")?.click()}}
  function hideQCFilter(){document.querySelectorAll("main label").forEach(l=>{const s=txt(l.querySelector("span"));if(/^QCs$/i.test(s))hide(l)})}
  function hideUpload(){document.querySelectorAll("button").forEach(b=>{if(/^Upload data$/i.test(txt(b)))hide(b)})}
  function hideStageCards(){document.querySelectorAll("main .rounded-2xl,main section,main article").forEach(c=>{const t=txt(c);if(t.length>700)return;const hasMetric=/Average\s+[^·]+·\s*target\s*\d+h/i.test(t)||/within\s+\d+h.*breached/i.test(t);if(hasMetric&&(/(^|\s)QC(\s|$)/.test(t)||/(^|\s)QTL(\s|$)/.test(t)))hide(c)})}
  function hideColumns(table){const headers=[...table.querySelectorAll("thead th")],bad=[];headers.forEach((th,i)=>{const h=txt(th).toLowerCase();if(h==="qc"||h.includes("qc reviewer")||h.includes("qc sla")||h.includes("qc hours")||h.includes("qtl sla")||h.includes("qtl hours")||h.includes("qtl decision"))bad.push(i)});if(!bad.length)return;table.querySelectorAll("tr").forEach(tr=>{[...tr.children].forEach((cell,i)=>{if(bad.includes(i))hide(cell)})})}
  function hideViewerTables(){document.querySelectorAll("main table").forEach(hideColumns)}
  function cleanViewerOverview(){hideCardsByTitle(["Review volume by QC","SLA snapshot","Workload balance","Flag concentration","SLA priority"]);const h=txt(document.querySelector("main header h1")),sub=document.querySelector("main header h1")?.nextElementSibling;if(h==="Executive Overview"&&sub)sub.textContent="Tutor, TL, team and objection performance";if(h==="Objections & SLA"&&sub)sub.textContent="Objection volumes, outcomes and TL follow-up"}
  function cleanViewerText(){document.querySelectorAll("main p,main small,main span").forEach(e=>{const v=txt(e);if(v==="QC productivity & accuracy")hide(e.parentElement);if(v.includes("QC records")||v.includes("QC names"))hide(e)})}
  function apply(){replaceYou();removeInterpretation();if(role()!=="viewer")return;document.documentElement.dataset.qaRole="viewer";hideViewerNav();hideQCFilter();hideUpload();cleanViewerOverview();hideStageCards();hideViewerTables();cleanViewerText()}
  window.addEventListener("qa-role-ready",apply);document.addEventListener("click",()=>setTimeout(apply,80));document.addEventListener("change",()=>setTimeout(apply,80));new MutationObserver(()=>setTimeout(apply,20)).observe(document.documentElement,{childList:true,subtree:true});document.readyState==="loading"?document.addEventListener("DOMContentLoaded",apply,{once:true}):apply();setInterval(apply,1000);
})();
