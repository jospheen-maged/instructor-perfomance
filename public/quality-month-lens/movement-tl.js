(()=>{
  'use strict';
  const SUPABASE_URL='https://jpewcvzummlwiplbojip.supabase.co';
  const SUPABASE_KEY='sb_publishable_BKcXs7kCaFlZ2JKnBclV4Q_qyRKKPKD';
  const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
  const esc=v=>String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  let client=null, tlByName=new Map(), requestId=0;

  const style=document.createElement('style');
  style.textContent=`
    #declines .person small.with-tl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
    #declines .tl-line{color:#587898;font-weight:750}
    #declines .score-route{color:#9aabba;font-weight:500}
  `;
  document.head.appendChild(style);

  function decorate(){
    const box=document.querySelector('#declines');
    if(!box)return;
    box.querySelectorAll('.list-row').forEach(row=>{
      const name=row.querySelector('.person strong');
      const small=row.querySelector('.person small');
      if(!name||!small)return;
      const tl=tlByName.get(norm(name.textContent));
      const base=small.dataset.scoreRoute || small.textContent.replace(/^TL\s*·.*?\s*\|\s*/,'').trim();
      small.dataset.scoreRoute=base;
      if(!tl){
        if(small.classList.contains('with-tl')){
          small.classList.remove('with-tl');
          small.textContent=base;
        }
        return;
      }
      const target=`<span class="tl-line">TL · ${esc(tl)}</span><span class="score-route">${esc(base)}</span>`;
      if(small.innerHTML!==target){
        small.classList.add('with-tl');
        small.innerHTML=target;
      }
    });
  }

  async function loadTLs(){
    const cycle=document.querySelector('#cycleSelect')?.value;
    if(!cycle||!client)return;
    const id=++requestId;
    const map=new Map();
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session)return;
      let from=0;
      const step=1000;
      for(;;){
        const {data,error}=await client.from('quality_month_lens_reviews').select('payload').eq('cycle',cycle).range(from,from+step-1);
        if(error)throw error;
        for(const row of data||[]){
          const p=row.payload||{};
          const tutor=p.tutor||p.Tutor||'';
          const tl=p.etl||p.Educational_Team_Lead||p['Educational_Team_Lead']||'';
          if(tutor&&tl)map.set(norm(tutor),String(tl).trim());
        }
        if(!data||data.length<step)break;
        from+=step;
      }
      if(id!==requestId)return;
      tlByName=map;
      decorate();
    }catch(e){
      console.warn('Quality Month Lens TL enrichment:',e);
    }
  }

  function init(){
    if(!window.supabase?.createClient)return;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const cycle=document.querySelector('#cycleSelect');
    const declines=document.querySelector('#declines');
    if(cycle){
      cycle.addEventListener('change',()=>setTimeout(loadTLs,0));
      new MutationObserver(()=>{ if(cycle.value) loadTLs(); }).observe(cycle,{childList:true});
    }
    if(declines)new MutationObserver(decorate).observe(declines,{childList:true,subtree:true});
    setTimeout(loadTLs,700);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();