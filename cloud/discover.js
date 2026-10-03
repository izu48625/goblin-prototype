(async()=>{
  'use strict';

  const sb=window.SM_SUPABASE?.client;
  const grid=document.getElementById('grid');
  const status=document.getElementById('status');
  const searchInput=document.getElementById('searchInput');
  const resultMeta=document.getElementById('resultMeta');
  const moreBtn=document.getElementById('moreBtn');
  const refreshBtn=document.getElementById('refreshBtn');

  const locale=localStorage.getItem('statsMaker.locale')==='en'?'en':'ja';
  const copy={
    ja:{
      title:'みんなのStatsを見つける',
      subtitle:'公開された評価シートを検索して、結果を見たりRemixしたりできます。',
      privacy:'Public作品のみ掲載。URL限定（Unlisted）はここには表示されません。',
      search:'タイトル・説明・対象・評価項目を検索',
      newest:'新着',popular:'人気',community:'Community',remix:'Remix',
      works:'公開作品',loading:'公開作品を読み込んでいます…',refresh:'更新',
      participants:'参加者',remixes:'Remix',targets:'対象',metrics:'項目',
      public:'PUBLIC',open:'見る →',more:'さらに表示',
      empty:'条件に合う公開作品がありません。',
      error:'公開作品を読み込めませんでした。',
      result:n=>`${n}件のPublic作品`,
      updated:'更新',
      create:'＋ 作る',footer:'自分のStatsを作る',
      lineageRemix:'REMIX',lineageVersion:'VERSION'
    },
    en:{
      title:'Discover public Stats',
      subtitle:'Search public rating sheets, explore results, and Remix them.',
      privacy:'Only Public works appear here. Unlisted works are never listed.',
      search:'Search title, description, targets, or metrics',
      newest:'Newest',popular:'Popular',community:'Community',remix:'Remix',
      works:'Public works',loading:'Loading public works…',refresh:'Refresh',
      participants:'Participants',remixes:'Remix',targets:'Targets',metrics:'Metrics',
      public:'PUBLIC',open:'Open →',more:'Show more',
      empty:'No public works match these filters.',
      error:'Could not load public works.',
      result:n=>`${n} Public work${n===1?'':'s'}`,
      updated:'Updated',
      create:'＋ Create',footer:'Create your own Stats',
      lineageRemix:'REMIX',lineageVersion:'VERSION'
    }
  }[locale];

  const state={
    works:[],
    sort:'newest',
    query:'',
    visible:12,
    loading:false
  };

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function setCopy(){
    document.documentElement.lang=locale;
    document.title=(locale==='ja'?'Discover - Stats Maker':'Discover - Stats Maker');
    document.querySelector('.hero h1').textContent=copy.title;
    document.querySelector('.hero p').textContent=copy.subtitle;
    document.querySelector('.privacyNote').textContent=copy.privacy;
    searchInput.placeholder=copy.search;
    document.querySelector('[data-sort="newest"]').textContent=copy.newest;
    document.querySelector('[data-sort="popular"]').textContent=copy.popular;
    document.querySelector('[data-sort="community"]').textContent=copy.community;
    document.querySelector('[data-sort="remix"]').textContent=copy.remix;
    document.querySelector('.sectionTitle').textContent=copy.works;
    refreshBtn.textContent=copy.refresh;
    moreBtn.textContent=copy.more;
    document.querySelector('.createLink').textContent=copy.create;
    document.querySelector('.footer a').textContent=copy.footer;
  }

  function fmtDate(value){
    if(!value)return '';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return '';
    try{
      return new Intl.DateTimeFormat(locale==='ja'?'ja-JP':'en-US',{
        year:'numeric',month:'short',day:'numeric'
      }).format(d);
    }catch{return d.toLocaleDateString()}
  }

  function snapshotOf(topic){
    return topic?.snapshot&&typeof topic.snapshot==='object'&&!Array.isArray(topic.snapshot)
      ?topic.snapshot:{};
  }

  function relationOf(topic){
    return String(snapshotOf(topic)?.lineage?.relation||'').toLowerCase();
  }

  function searchableText(topic){
    const snap=snapshotOf(topic);
    const rows=Array.isArray(snap.rows)?snap.rows:[];
    const criteria=Array.isArray(snap.criteria)?snap.criteria:[];
    return [
      topic.title,topic.description,
      ...rows.map(row=>row?.name),
      ...criteria.map(item=>item?.name)
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function topicStats(topic){
    const snap=snapshotOf(topic);
    const rows=Array.isArray(snap.rows)?snap.rows:[];
    const criteria=Array.isArray(snap.criteria)?snap.criteria:[];
    return {targets:rows.length,metrics:criteria.length};
  }

  function sortWorks(list){
    const newest=(a,b)=>new Date(b.published_at||b.snapshot_updated_at||0)-new Date(a.published_at||a.snapshot_updated_at||0);
    const out=[...list];
    if(state.sort==='community'){
      out.sort((a,b)=>b.participants-a.participants||newest(a,b));
    }else if(state.sort==='remix'){
      out.sort((a,b)=>b.remixCount-a.remixCount||newest(a,b));
    }else if(state.sort==='popular'){
      out.sort((a,b)=>{
        const scoreA=a.participants+a.remixCount;
        const scoreB=b.participants+b.remixCount;
        return scoreB-scoreA||b.participants-a.participants||b.remixCount-a.remixCount||newest(a,b);
      });
    }else{
      out.sort(newest);
    }
    return out;
  }

  function filteredWorks(){
    const q=state.query.trim().toLowerCase();
    const filtered=q
      ?state.works.filter(topic=>searchableText(topic).includes(q))
      :state.works;
    return sortWorks(filtered);
  }

  function render(){
    const list=filteredWorks();
    resultMeta.textContent=copy.result(list.length);

    const visible=list.slice(0,state.visible);
    if(!visible.length){
      grid.innerHTML=`<div class="empty">${esc(copy.empty)}</div>`;
      grid.classList.remove('hidden');
      status.classList.add('hidden');
      moreBtn.classList.add('hidden');
      return;
    }

    grid.innerHTML=visible.map(topic=>{
      const stats=topicStats(topic);
      const relation=relationOf(topic);
      const updated=fmtDate(topic.snapshot_updated_at||topic.published_at);
      const description=topic.description||'';
      const lang=topic.language_code==='en'?'EN':'JA';
      const lineage=relation==='remix'
        ?`<span class="metaChip lineageChip">${copy.lineageRemix}</span>`
        :relation==='version'
          ?`<span class="metaChip lineageChip">${copy.lineageVersion}</span>`
          :'';

      return `<a class="workCard" href="public.html?id=${encodeURIComponent(topic.id)}&v=r22p1">
        <div class="cardTop">
          <div class="visibility">${copy.public}</div>
          <div class="languageBadge">${lang}</div>
        </div>
        <div class="workTitle">${esc(topic.title||'Untitled')}</div>
        <div class="workDesc">${esc(description)}</div>
        <div class="cardMeta">
          <span class="metaChip">${stats.targets||'—'} ${copy.targets}</span>
          <span class="metaChip">${stats.metrics||'—'} ${copy.metrics}</span>
          <span class="metaChip">${Number(topic.score_scale||100)} pt</span>
          ${lineage}
        </div>
        <div class="cardStats">
          <div class="stat">
            <div class="statValue accent">${topic.participants}</div>
            <div class="statLabel">${copy.participants}</div>
          </div>
          <div class="stat">
            <div class="statValue purple">${topic.remixCount}</div>
            <div class="statLabel">${copy.remixes}</div>
          </div>
          <div class="stat">
            <div class="statValue">${stats.targets||'—'}</div>
            <div class="statLabel">${copy.targets}</div>
          </div>
        </div>
        <div class="cardFoot">
          <span>${updated?`${copy.updated} ${esc(updated)}`:''}</span>
          <span class="openLabel">${copy.open}</span>
        </div>
      </a>`;
    }).join('');

    grid.classList.remove('hidden');
    status.classList.add('hidden');
    moreBtn.classList.toggle('hidden',state.visible>=list.length);
  }

  async function participantCounts(topics){
    const map=new Map();
    const batchSize=8;
    for(let i=0;i<topics.length;i+=batchSize){
      const batch=topics.slice(i,i+batchSize);
      const rows=await Promise.all(batch.map(async topic=>{
        try{
          const {data,error}=await sb.rpc('get_topic_participant_count',{p_topic_id:topic.id});
          if(error)return [topic.id,0];
          return [topic.id,Number(data||0)];
        }catch{return [topic.id,0]}
      }));
      rows.forEach(([id,count])=>map.set(id,count));
    }
    return map;
  }

  async function load(){
    if(state.loading)return;
    state.loading=true;
    refreshBtn.disabled=true;
    status.textContent=copy.loading;
    status.classList.remove('hidden');
    grid.classList.add('hidden');
    moreBtn.classList.add('hidden');

    try{
      if(!sb)throw new Error('Supabase not ready');

      const [{data:topics,error:topicError},{data:lineageRows,error:lineageError}]=await Promise.all([
        sb.from('topics')
          .select('id,title,description,language_code,score_scale,weighted,published_at,snapshot_updated_at,snapshot,source_topic_id,show_community')
          .eq('visibility','public')
          .order('published_at',{ascending:false})
          .limit(60),
        sb.from('topics')
          .select('id,source_topic_id,snapshot')
          .eq('visibility','public')
          .not('source_topic_id','is',null)
          .limit(500)
      ]);

      if(topicError)throw topicError;
      if(lineageError)console.warn('[Stats Maker] Discover lineage query failed',lineageError);

      // Discover is intentionally Public-only. Never merge Unlisted rows into this collection.
      const publicTopics=(topics||[]).filter(topic=>topic&&topic.id);
      const remixCounts=new Map();
      (lineageRows||[]).forEach(child=>{
        if(String(child?.snapshot?.lineage?.relation||'').toLowerCase()!=='remix')return;
        const sourceId=child.source_topic_id;
        if(!sourceId)return;
        remixCounts.set(sourceId,(remixCounts.get(sourceId)||0)+1);
      });

      const counts=await participantCounts(publicTopics);
      state.works=publicTopics.map(topic=>({
        ...topic,
        participants:counts.get(topic.id)||0,
        remixCount:remixCounts.get(topic.id)||0
      }));
      state.visible=12;
      render();
    }catch(error){
      console.error('[Stats Maker] Discover load failed',error);
      status.textContent=`${copy.error}\n${error?.message||String(error)}`;
      status.classList.remove('hidden');
      grid.classList.add('hidden');
    }finally{
      state.loading=false;
      refreshBtn.disabled=false;
    }
  }

  searchInput.addEventListener('input',()=>{
    state.query=searchInput.value;
    state.visible=12;
    render();
  });

  document.querySelectorAll('.sortBtn').forEach(button=>{
    button.addEventListener('click',()=>{
      state.sort=button.dataset.sort||'newest';
      state.visible=12;
      document.querySelectorAll('.sortBtn').forEach(btn=>btn.classList.toggle('active',btn===button));
      render();
    });
  });

  moreBtn.addEventListener('click',()=>{
    state.visible+=12;
    render();
  });
  refreshBtn.addEventListener('click',load);

  setCopy();
  await load();
})();
