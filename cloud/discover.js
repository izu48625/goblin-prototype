(async()=>{
  'use strict';

  const sb=window.SM_SUPABASE?.client;
  const grid=document.getElementById('grid');
  const status=document.getElementById('status');
  const searchInput=document.getElementById('searchInput');
  const resultMeta=document.getElementById('resultMeta');
  const sectionTitle=document.getElementById('sectionTitle');
  const moreBtn=document.getElementById('moreBtn');
  const refreshBtn=document.getElementById('refreshBtn');

  const locale=String(localStorage.getItem('statsMaker.locale')||localStorage.getItem('statsMakerV2Language')||navigator.language||'ja').toLowerCase().startsWith('en')?'en':'ja';
  const categories=['all','sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other'];
  const categoryLabels={
    ja:{
      all:'すべて',sports:'スポーツ',manga_anime:'漫画・アニメ',movie_tv:'映画・ドラマ',
      food:'フード',game:'ゲーム',music:'音楽',books:'本・文学',travel:'旅行・場所',
      tech:'テクノロジー',lifestyle:'ライフ・趣味',other:'その他'
    },
    en:{
      all:'All',sports:'Sports',manga_anime:'Manga / Anime',movie_tv:'Movies / TV',
      food:'Food',game:'Games',music:'Music',books:'Books',travel:'Travel / Places',
      tech:'Technology',lifestyle:'Lifestyle / Hobbies',other:'Other'
    }
  }[locale];

  const copy={
    ja:{
      title:'みんなのStatsを見つける',
      subtitle:'公開された評価シートを検索して、結果を見たりRemixしたりできます。',
      privacy:'Public作品のみ掲載。URL限定（Unlisted）はここには表示されません。',
      search:'タイトル・説明・対象・評価項目を部分一致で検索',
      allTab:'すべての作品',communityTab:'みんなで評価',
      newest:'新着',popular:'人気',community:'Community',remix:'Remix',
      works:'すべての作品',communityWorks:'みんなで評価できる作品',
      loading:'公開作品を読み込んでいます…',refresh:'更新',
      participants:'参加者',remixes:'Remix',targets:'対象',metrics:'項目',
      public:'PUBLIC',communityBadge:'参加型',open:'見る →',communityOpen:'作品を見て評価する →',statsOpen:'スタッツを見る',statsClose:'スタッツを閉じる',more:'さらに表示',
      empty:'条件に合う公開作品がありません。',
      communityEmpty:'みんなで評価できる作品がありません。',
      error:'公開作品を読み込めませんでした。',
      result:n=>`${n}件のPublic作品`,
      communityResult:n=>`${n}件の参加型作品`,
      updated:'更新',
      create:'＋ 作る',footer:'自分のStatsを作る',
      lineageRemix:'REMIX',lineageVersion:'VERSION'
    },
    en:{
      title:'Discover public Stats',
      subtitle:'Search public rating sheets, explore results, and Remix them.',
      privacy:'Only Public works appear here. Unlisted works are never listed.',
      search:'Partial-match search across title, description, targets, or metrics',
      allTab:'All Works',communityTab:'Rate Together',
      newest:'Newest',popular:'Popular',community:'Community',remix:'Remix',
      works:'All Works',communityWorks:'Works open to ratings',
      loading:'Loading public works…',refresh:'Refresh',
      participants:'Participants',remixes:'Remix',targets:'Targets',metrics:'Metrics',
      public:'PUBLIC',communityBadge:'COMMUNITY',open:'Open →',communityOpen:'View & Rate →',statsOpen:'Show stats',statsClose:'Hide stats',more:'Show more',
      empty:'No public works match these filters.',
      communityEmpty:'No Community works match these filters.',
      error:'Could not load public works.',
      result:n=>`${n} Public work${n===1?'':'s'}`,
      communityResult:n=>`${n} work${n===1?'':'s'} open to ratings`,
      updated:'Updated',
      create:'＋ Create',footer:'Create your own Stats',
      lineageRemix:'REMIX',lineageVersion:'VERSION'
    }
  }[locale];

  const state={
    works:[],
    view:'all',
    category:'all',
    sort:'newest',
    query:'',
    visible:12,
    loading:false,
    total:0,
    hasMore:false,
    offset:0,
    anchor:null,
    generation:0
  };

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));

  function setCopy(){
    document.documentElement.lang=locale;
    document.title='Discover - Stats Maker';
    document.querySelector('.hero h1').textContent=copy.title;
    document.querySelector('.hero p').textContent=copy.subtitle;
    document.querySelector('.privacyNote').textContent=copy.privacy;
    searchInput.placeholder=copy.search;

    document.querySelector('[data-view="all"]').textContent=copy.allTab;
    document.querySelector('[data-view="community"]').textContent=copy.communityTab;

    document.querySelectorAll('.categoryBtn').forEach(button=>{
      const key=button.dataset.category;
      button.textContent=categoryLabels[key]||categoryLabels.other;
    });

    document.querySelector('[data-sort="newest"]').textContent=copy.newest;
    document.querySelector('[data-sort="popular"]').textContent=copy.popular;
    document.querySelector('[data-sort="community"]').textContent=copy.community;
    document.querySelector('[data-sort="remix"]').textContent=copy.remix;
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

  function categoryOf(topic){
    const raw=String(snapshotOf(topic)?.metadata?.category||'other');
    return categories.includes(raw)&&raw!=='all'?raw:'other';
  }

  function isCommunityWork(topic){
    return topic?.show_community===true&&topic?.allow_ratings===true;
  }

  function normalizeSearchText(value){
    return String(value??'')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[・･／\\/,_-]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function searchTerms(value){
    const normalized=normalizeSearchText(value);
    return normalized?normalized.split(' ').filter(Boolean):[];
  }

  function searchableText(topic){
    const snap=snapshotOf(topic);
    const rows=Array.isArray(snap.rows)?snap.rows:[];
    const criteria=Array.isArray(snap.criteria)?snap.criteria:[];
    return normalizeSearchText([
      topic.title,topic.description,
      categoryLabels[categoryOf(topic)],
      ...rows.map(row=>row?.name),
      ...criteria.map(item=>item?.name)
    ].filter(Boolean).join(' '));
  }

  function topicStats(topic){
    const snap=snapshotOf(topic);
    const rows=Array.isArray(snap.rows)?snap.rows:[];
    const criteria=Array.isArray(snap.criteria)?snap.criteria:[];
    return {targets:rows.length,metrics:criteria.length};
  }

  function creatorPreview(topic){
    const snap=snapshotOf(topic);
    const rows=Array.isArray(snap.rows)?snap.rows:[];
    const criteria=Array.isArray(snap.criteria)?snap.criteria:[];
    const weighted=typeof snap.weighted==='boolean'?snap.weighted:!!topic.weighted;
    const scale=Number(snap.scale||topic.score_scale||100)===10?10:100;
    const values=rows.map((row,index)=>{
      const scores=Array.isArray(row?.scores)?row.scores:[];
      let total=0,den=0;
      criteria.forEach((criterion,i)=>{
        const raw=scores[i];
        const score=raw===null||raw===undefined||raw===''?null:Number(raw);
        if(score===null||!Number.isFinite(score))return;
        const weight=weighted?Math.max(0,Number(criterion?.weight??1)):1;
        total+=score*weight;den+=weight;
      });
      const value=den?Math.round(total/den*10)/10:null;
      return {index,name:String(row?.name||'').trim()||`Target ${index+1}`,value};
    }).filter(item=>item.value!==null)
      .sort((a,b)=>b.value-a.value||a.index-b.index)
      .slice(0,3);
    return {scale,items:values};
  }

  function creatorPreviewHtml(topic){
    const preview=creatorPreview(topic);
    const category=categoryOf(topic);
    if(!preview.items.length){
      return `<div class="workVisual visualCategory-${category} emptyVisual"><span>STATS MAKER</span><b>NO SCORE DATA</b></div>`;
    }
    return `<div class="workVisual visualCategory-${category}">
      <div class="visualTop"><span>STATS MAKER</span><span>TOP 3</span></div>
      <div class="visualRows">${preview.items.map((item,index)=>{
        const pct=Math.max(0,Math.min(100,Number(item.value||0)/preview.scale*100));
        return `<div class="visualRow">
          <div class="visualRank">${index+1}</div>
          <div class="visualMain">
            <div class="visualName">${esc(item.name)}</div>
            <div class="visualTrack"><i style="width:${pct}%"></i></div>
          </div>
          <div class="visualValue">${Number.isInteger(item.value)?item.value:item.value.toFixed(1)}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }

  function sortWorks(list){
    const newest=(a,b)=>new Date(b.published_at||b.snapshot_updated_at||0)-new Date(a.published_at||a.snapshot_updated_at||0)||String(a.id).localeCompare(String(b.id));
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

  // Results are already searched and ranked across ALL Public works by the DB.
  function filteredWorks(){return state.works;}

  function render(){
    const list=filteredWorks();
    const communityView=state.view==='community';
    sectionTitle.textContent=communityView?copy.communityWorks:copy.works;
    resultMeta.textContent=communityView?copy.communityResult(state.total):copy.result(state.total);

    const visible=list.slice(0,state.visible);
    if(!visible.length){
      grid.innerHTML=`<div class="empty">${esc(communityView?copy.communityEmpty:copy.empty)}</div>`;
      grid.classList.remove('hidden');
      status.classList.add('hidden');
      moreBtn.classList.add('hidden');
      return;
    }

    grid.innerHTML=visible.map(topic=>{
      const stats=topicStats(topic);
      const relation=relationOf(topic);
      const category=categoryOf(topic);
      const updated=fmtDate(topic.snapshot_updated_at||topic.published_at);
      const description=topic.description||'';
      const lang=topic.language_code==='en'?'EN':'JA';
      const community=isCommunityWork(topic);
      const href=`public.html?id=${encodeURIComponent(topic.id)}&v=r25p3`;
      const lineage=relation==='remix'
        ?`<span class="metaChip lineageChip">${copy.lineageRemix}</span>`
        :relation==='version'
          ?`<span class="metaChip lineageChip">${copy.lineageVersion}</span>`
          :'';

      return `<article class="workCard">
        <div class="cardTop">
          <div class="visibility">${copy.public}</div>
          <div class="languageBadge">${lang}</div>
        </div>

        <a class="workMainLink" href="${href}">
          <div class="workTitle">${esc(topic.title||'Untitled')}</div>
          <div class="workDesc">${esc(description)}</div>
        </a>

        <div class="cardMeta compactMeta">
          <span class="metaChip categoryChip">${esc(categoryLabels[category]||categoryLabels.other)}</span>
          ${community?`<span class="metaChip communityOnlyBadge">${copy.communityBadge}</span>`:''}
          ${lineage}
        </div>

        <div class="cardFoot compactFoot">
          <span>${updated?`${copy.updated} ${esc(updated)}`:''}</span>
          <a class="openLabel" href="${href}">${communityView&&community?copy.communityOpen:copy.open}</a>
        </div>

        <details class="statsDisclosure">
          <summary>
            <span class="statsDisclosureLabel">${copy.statsOpen}</span>
            <span class="statsDisclosureChevron">⌄</span>
          </summary>
          <div class="statsDisclosureBody">
            ${creatorPreviewHtml(topic)}
            <div class="cardMeta statsMeta">
              <span class="metaChip">${stats.targets||'—'} ${copy.targets}</span>
              <span class="metaChip">${stats.metrics||'—'} ${copy.metrics}</span>
              <span class="metaChip">${Number(topic.score_scale||100)} pt</span>
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
          </div>
        </details>
      </article>`;
    }).join('');

    grid.classList.remove('hidden');
    status.classList.add('hidden');
    moreBtn.classList.toggle('hidden',!state.hasMore);
  }

  // One network call per 12-card page. The read-only SECURITY INVOKER RPC
  // searches and ranks the full Public population before applying its limit.
  const PAGE_SIZE=12;
  let searchTimer=null;

  async function load(more=false,generation=state.generation){
    if(more&&(state.loading||!state.hasMore))return;
    if(generation!==state.generation)return;
    state.loading=true;
    refreshBtn.disabled=true;
    moreBtn.disabled=true;
    if(!more){
      state.works=[];
      state.total=0;
      state.offset=0;
      state.anchor=null;
      state.hasMore=false;
      status.textContent=copy.loading;
      status.classList.remove('hidden');
      grid.classList.add('hidden');
      moreBtn.classList.add('hidden');
    }
    try{
      if(!sb)throw new Error('Supabase not ready');
      const {data,error}=await sb.rpc('discover_public_works_v1',{
        p_query:state.query,
        p_category:state.category,
        p_view:state.view,
        p_sort:state.sort,
        p_locale:locale,
        p_offset:state.offset,
        p_limit:PAGE_SIZE,
        p_anchor:state.anchor
      });
      if(generation!==state.generation)return;
      if(error)throw error;
      if(!data||!Array.isArray(data.rows)||!Number.isFinite(Number(data.total))||
          !Number.isInteger(Number(data.total))||Number(data.total)<0||
          data.rows.length>PAGE_SIZE||typeof data.has_more!=='boolean'||
          !data.anchor)throw new Error('Invalid Discover response');
      // Even a compromised / misconfigured response cannot leak non-Public data.
      if(data.rows.some(topic=>!topic?.id||topic.visibility!=='public')){
        throw new Error('Discover received a non-Public record');
      }
      const known=new Set(state.works.map(topic=>topic.id));
      const unique=data.rows.filter(topic=>{
        if(known.has(topic.id))return false;
        known.add(topic.id);
        return true;
      });
      state.works=more?state.works.concat(unique):unique;
      state.offset+=data.rows.length;
      state.total=Number(data.total);
      state.anchor=data.anchor;
      state.hasMore=data.has_more&&data.rows.length>0;
      state.visible=state.works.length;
      render();
    }catch(error){
      if(generation!==state.generation)return;
      console.error('[Stats Maker] Discover load failed',error);
      status.textContent=copy.error;
      status.classList.remove('hidden');
      if(!more){
        grid.classList.add('hidden');
        moreBtn.classList.add('hidden');
      }else{
        grid.classList.remove('hidden');
        moreBtn.classList.toggle('hidden',!state.hasMore);
      }
    }finally{
      if(generation===state.generation){
        state.loading=false;
        refreshBtn.disabled=false;
        moreBtn.disabled=false;
      }
    }
  }

  function reload(delay=0){
    clearTimeout(searchTimer);
    const generation=++state.generation;
    if(delay)searchTimer=setTimeout(()=>load(false,generation),delay);
    else void load(false,generation);
  }

  searchInput.addEventListener('input',()=>{
    state.query=searchInput.value;
    reload(250);
  });

  document.querySelectorAll('.browseTab').forEach(button=>{
    button.addEventListener('click',()=>{
      state.view=button.dataset.view==='community'?'community':'all';
      window.SM_ANALYTICS?.event('discover_filter',{filter_type:state.view});
      document.querySelectorAll('.browseTab').forEach(btn=>btn.classList.toggle('active',btn===button));
      reload();
    });
  });

  document.querySelectorAll('.categoryBtn').forEach(button=>{
    button.addEventListener('click',()=>{
      const requested=button.dataset.category||'all';
      state.category=categories.includes(requested)?requested:'all';
      window.SM_ANALYTICS?.event('discover_filter',{filter_type:'category'});
      document.querySelectorAll('.categoryBtn').forEach(btn=>btn.classList.toggle('active',btn===button));
      reload();
    });
  });

  document.querySelectorAll('.sortBtn').forEach(button=>{
    button.addEventListener('click',()=>{
      state.sort=button.dataset.sort||'newest';
      document.querySelectorAll('.sortBtn').forEach(btn=>btn.classList.toggle('active',btn===button));
      reload();
    });
  });

  moreBtn.addEventListener('click',()=>{void load(true);});
  refreshBtn.addEventListener('click',()=>reload());

  setCopy();
  reload();
})();
