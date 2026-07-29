const sections=[...document.querySelectorAll('.section')];
const nav=[...document.querySelectorAll('[data-section]')];
const titles={overview:['Overview','Student-centric quality model and pilot workspace'],evaluation:['New Evaluation','Five metrics, evidence, compliance and continuity'],session12:['Session 12','Final showcase scoring and eligibility'],continuity:['Continuity Analytics','Predictive signal reported outside the tutor score'],reconsideration:['Reconsideration','Independent evidence-based response path'],capacity:['Pilot Capacity','Coverage and safeguards calculator'],governance:['Governance','Reviewer scope and security boundaries']};
function openSection(id){const title=titles[id];if(!title)return;sections.forEach(x=>x.classList.toggle('active',x.id===id));nav.forEach(x=>x.classList.toggle('active',x.dataset.section===id));document.getElementById('pageTitle').textContent=title[0];document.getElementById('pageSub').textContent=title[1];window.scrollTo({top:0,behavior:'smooth'})}
nav.forEach(x=>x.addEventListener('click',()=>openSection(x.dataset.section)));document.querySelectorAll('[data-jump]').forEach(x=>x.addEventListener('click',()=>openSection(x.dataset.jump)));

const evaluationTabs=[...document.querySelectorAll('#evaluation .tabs .tab')];
const reviewTabs=evaluationTabs.filter(x=>!x.dataset.jump);
const reviewModes={
  sampling:{label:'Session Sampling',subtitle:'Focused evidence sampling with escalation when needed.',notice:'Review the selected evidence windows first. Escalate to a Full Review when a possible flag, missing evidence or unclear context could affect the result.'},
  full:{label:'Full Review',subtitle:'Complete-session evaluation across all five metrics.',notice:'Review the full recording from start to finish and document timestamped evidence for every scored metric, compliance issue and flag.'}
};
if(reviewTabs.length>=2){
  reviewTabs[0].dataset.reviewMode='sampling';reviewTabs[0].textContent=reviewModes.sampling.label;
  reviewTabs[1].dataset.reviewMode='full';reviewTabs[1].textContent=reviewModes.full.label;
  const tabsBar=document.querySelector('#evaluation .tabs');
  const modeNotice=document.createElement('div');modeNotice.id='reviewModeNotice';modeNotice.className='notice';modeNotice.style.marginBottom='18px';tabsBar.insertAdjacentElement('afterend',modeNotice);
  const triggerCard=document.querySelector('#evaluation aside .card:last-child');
  const triggerTitle=triggerCard?.querySelector('h3');const triggerSub=triggerCard?.querySelector('.card-head p');const triggerNotice=triggerCard?.querySelector('.notice');
  function setReviewMode(mode){const config=reviewModes[mode]||reviewModes.sampling;reviewTabs.forEach(tab=>tab.classList.toggle('active',tab.dataset.reviewMode===mode));modeNotice.innerHTML=`<b>${config.label}</b><br>${config.notice}`;if(document.getElementById('evaluation').classList.contains('active'))document.getElementById('pageSub').textContent=config.subtitle;if(triggerTitle)triggerTitle.textContent=mode==='sampling'?'Full Review trigger':'Full Review mode';if(triggerSub)triggerSub.textContent=mode==='sampling'?'Use when sampling is insufficient.':'Complete-session evidence review is active.';if(triggerNotice)triggerNotice.textContent=mode==='sampling'?'Possible flag, missing evidence, unclear context or score-impacting uncertainty.':'Review the entire recording and capture complete timestamped evidence before finalising.'}
  reviewTabs.forEach(tab=>tab.addEventListener('click',()=>setReviewMode(tab.dataset.reviewMode)));
  const evaluationNav=document.querySelector('[data-section="evaluation"]');evaluationNav?.addEventListener('click',()=>setReviewMode(document.querySelector('#evaluation .tab.active[data-review-mode]')?.dataset.reviewMode||'sampling'));
  setReviewMode('sampling');
}

const core=[
{id:'concept',title:'Concept Understanding',q:'Did the student understand the concept, or only repeat steps?',o:'Answers concept-check questions, explains in their own words and predicts why something works.',labels:['Not Demonstrated','With Support','Independently']},
{id:'application',title:'Independent Application',q:'Did the student apply and solve, or did the tutor lead the work?',o:'Who controls the screen, whether the student tries first, and whether hints replace direct instructions.',labels:['Tutor-Led','Guided','Student-Led']},
{id:'project',title:'Project Progress & Completion',q:'Was the expected milestone completed, tested and uploaded when required?',o:'Required output is visible, runs successfully and matches the course plan.',labels:['Not Achieved','Partially Achieved','Achieved']},
{id:'explanation',title:'Student Explanation',q:'Can the student explain the project, learning and next step?',o:'Summarises the project, explains a decision and reflects on a challenge.',labels:['Unable to Explain','With Prompts','Independently']}
];
const experience=[
{id:'participation',title:'Student Participation & Involvement',d:'Answers, questions, task contribution and voluntary participation.'},
{id:'comfort',title:'Student Comfort & Interaction',d:'Asks for help, expresses confusion and interacts comfortably.'},
{id:'motivation',title:'Learning Motivation',d:'Curiosity, persistence and willingness to explore.'},
{id:'responsiveness',title:'Responsiveness to Student Needs',d:'Tutor changes pace, support or approach based on student signals.'}
];
const showcase=[
{id:'readiness',title:'Showcase Readiness & Portfolio',w:5,o:'Project links, portfolio QR, parent invitation and presentation readiness.'},
{id:'ownership',title:'Student Ownership Facilitation',w:8,o:'Student leads; tutor does not answer instead of the student.'},
{id:'adaptation',title:'Adaptation & Learning Support',w:7,o:'Support matches student level, absences and learning needs.'},
{id:'reflection',title:'Questioning & Reflection',w:5,o:'Open-ended prompts, challenge discussion and student explanation.'},
{id:'parent',title:'Parent Communication & Next Step',w:5,o:'Clear progress summary and personalised next-course recommendation.'}
];
function choices(prefix,id,labels){return `<div class="choices">${labels.map((l,i)=>`<div class="choice"><input type="radio" name="${prefix}-${id}" id="${prefix}-${id}-${i}" value="${i}"><label for="${prefix}-${id}-${i}">${l}</label></div>`).join('')}</div>`}
function metric(d,prefix,weight){return `<div class="metric"><div class="metric-top"><div><h4>${d.title}</h4><p>${d.q||''}</p></div><span class="weight">${weight}</span></div><div class="observe"><b>QC observes:</b> ${d.o}</div><div class="metric-row">${choices(prefix,d.id,d.labels)}<div class="field"><label>Timestamp</label><input placeholder="00:00"></div><div class="field"><label>Evidence note</label><input placeholder="Observable behaviour"></div></div></div>`}
function expRow(d,prefix){return `<div class="experience-row"><div class="experience-title"><strong>${d.title}</strong><span>${d.d}</span></div>${choices(prefix,d.id,['Limited','Developing','Strong'])}<div class="field"><label>Timestamp</label><input placeholder="00:00"></div><div class="field"><label>Evidence note</label><input placeholder="Observable behaviour"></div></div>`}
document.getElementById('regularCore').innerHTML=core.map(d=>metric(d,'regular','20%')).join('');
document.getElementById('s12Core').innerHTML=core.map(d=>metric(d,'s12','14 pts')).join('');
document.getElementById('regularExperience').innerHTML=experience.map(d=>expRow(d,'rexp')).join('');
document.getElementById('s12Experience').innerHTML=experience.map(d=>expRow(d,'sexp')).join('');
document.getElementById('showcaseMetrics').innerHTML=showcase.map(d=>metric({...d,q:'',labels:['Low','Medium','High']},'show',d.w+'%')).join('');
const compliance=['Camera on','Clear sound','Professional dress','Correct logo/background','Correct language','No prohibited behaviour'];document.getElementById('compliance').innerHTML=compliance.map((x,i)=>`<label class="check"><input type="checkbox" checked id="c${i}"> ${x}</label>`).join('');
function value(name){const x=document.querySelector(`input[name="${name}"]:checked`);return x?Number(x.value):0}function avg(prefix){return experience.reduce((s,d)=>s+value(`${prefix}-${d.id}`),0)/experience.length}
function ring(id,total){document.getElementById(id).style.background=`conic-gradient(var(--orange) ${total*3.6}deg,rgba(255,255,255,.14) 0)`}
function regularScore(){const coreScore=core.reduce((s,d)=>s+value(`regular-${d.id}`)*10,0);const expScore=Math.round(avg('rexp')*10);const total=coreScore+expScore;document.getElementById('regularTotal').textContent=total;document.getElementById('coreLine').textContent=coreScore+' / 80';document.getElementById('experienceLine').textContent=expScore+' / 20';document.getElementById('regularExperienceScore').textContent=Math.round(avg('rexp')*50)+' / 100';document.getElementById('regularExperienceContribution').textContent=expScore+' / 20';ring('regularRing',total)}
function s12Score(){const coreScore=core.reduce((s,d)=>s+value(`s12-${d.id}`)*7,0);const expScore=Math.round(avg('sexp')*7);const tutor=showcase.reduce((s,d)=>s+value(`show-${d.id}`)*(d.w/2),0);const student=coreScore+expScore,total=Math.round(student+tutor);document.getElementById('s12Total').textContent=total;document.getElementById('studentLine').textContent=Math.round(student)+' / 70';document.getElementById('s12ExperienceLine').textContent=expScore+' / 14';document.getElementById('showcaseLine').textContent=Math.round(tutor)+' / 30';document.getElementById('s12ExperienceScore').textContent=Math.round(avg('sexp')*50)+' / 100';document.getElementById('s12ExperienceContribution').textContent=expScore+' / 14';ring('s12Ring',total)}
['regularCore','regularExperience'].forEach(id=>document.getElementById(id).addEventListener('change',regularScore));['s12Core','s12Experience','showcaseMetrics'].forEach(id=>document.getElementById(id).addEventListener('change',s12Score));
document.querySelectorAll('input[name="continuity"]').forEach(x=>x.addEventListener('change',()=>document.getElementById('continuityLine').textContent=x.value));
const gate=['attendance','session11','owner6','ownerFinal','recovery','evidence'];function gateScore(){const v=gate.map(id=>document.getElementById(id).value),badge=document.getElementById('gateBadge'),line=document.getElementById('gateLine');if(v.some(x=>x==='')){badge.textContent='Check required';badge.className='badge yellow';line.textContent='Pending'}else if(v.every(x=>x==='1')){badge.textContent='Eligible';badge.className='badge green';line.textContent='Eligible'}else{badge.textContent='Ineligible';badge.className='badge red';line.textContent='Select another case'}}gate.forEach(id=>document.getElementById(id).addEventListener('change',gateScore));
const feedback={concept:['The student demonstrated clear conceptual understanding.','Use more concept-check questions before implementation.'],application:['The student applied the task independently.','Allow the student to attempt before receiving hints.'],project:['The project milestone was completed and tested.','Protect implementation time so the milestone is completed.'],explanation:['The student clearly explained the project and learning.','Add a structured closing Q&A for student explanation.']};
document.getElementById('generateFeedback').addEventListener('click',()=>{const s=[],d=[];core.forEach(m=>value(`regular-${m.id}`)===2?s.push(feedback[m.id][0]):d.push(feedback[m.id][1]));avg('rexp')>=1.5?s.push('The tutor enabled a strong, responsive learning experience.'):d.push('Strengthen participation, comfort, motivation and responsiveness to student signals.');document.getElementById('strengths').innerHTML=s.map(x=>`<div class="comment">${x}</div>`).join('');document.getElementById('developments').innerHTML=d.map(x=>`<div class="comment">${x}</div>`).join('');toast('Feedback generated')});
function capacity(){const q=+document.getElementById('qcs').value||0,days=+document.getElementById('days').value||0,daily=+document.getElementById('daily').value||0,sessions=+document.getElementById('sessions').value||1,total=q*days*daily,base=q*days*7;document.getElementById('monthlyReviews').textContent=total.toLocaleString();document.getElementById('capacityResult').textContent=`${total.toLocaleString()} reviews · ${(total/sessions*100).toFixed(1)}% coverage · ${total-base>=0?'+':''}${(total-base).toLocaleString()} vs baseline`}
['qcs','days','daily','sessions'].forEach(id=>document.getElementById(id).addEventListener('input',capacity));
function toast(t){const x=document.getElementById('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1700)}document.querySelectorAll('[data-toast]').forEach(x=>x.addEventListener('click',()=>toast(x.dataset.toast)));regularScore();s12Score();capacity();
