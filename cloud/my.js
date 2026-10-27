(() => {
  'use strict';
  // Public-work management intentionally has no OAuth or guest-ID UI.
  // Existing Supabase sessions, RLS owner checks and published records remain intact.
  const sb=window.SM_SUPABASE?.client||null;
  const LOCALE_KEY='statsMaker.locale';
  const OGP_ORIGIN=String(window.SM_RUNTIME?.ogShareOrigin||'').replace(/\/+$/,'');
  const state={user:null,works:[],filter:'all',loading:false,locale:detectLocale()};
  const copy={
    ja:{
      brandSub:'公開作品',back:'編集へ戻る',title:'自分の公開作品',
      lead:'このブラウザから公開した作品を確認・管理できます。',refresh:'更新',
      notice:'作品の管理情報はこのブラウザに保存されます。ブラウザデータを削除すると、以前の作品を編集できなくなる場合があります。大切な元データはJSONでバックアップしてください。',
      allWorks:'全作品',worksTitle:'公開作品の管理',
      loading:'作品を確認中…',empty:'管理できる作品はまだありません',
      emptyHelp:'Homeから作品を公開すると、ここで公開範囲の変更などができます。',
      openStats:'Stats Makerを開く',
      noSession:'このブラウザには公開作品の管理情報がありません。作品の作成やグラフ保存はそのまま利用できます。',
      loadError:'作品の読み込みに失敗しました：',
      public:'Public',unlisted:'Unlisted',private:'Private',targets:'対象',metrics:'項目',scale:'点',updated:'更新',
      visibility:'公開範囲',open:'開く',copy:'共有URL',copied:'共有URLをコピーしました。',copyFailed:'URLをコピーできませんでした。',
      privateNoShare:'Private作品は共有URLを発行しません。',saving:'公開範囲を更新中…',saved:'公開範囲を更新しました。',saveError:'公開範囲を更新できませんでした：',
      category:'カテゴリ',categorySave:'分類を保存',categorySaving:'カテゴリを保存中…',
      categorySaved:'カテゴリを更新しました。採点・公開設定は変更していません。',
      categoryUnchanged:'カテゴリは変更されていません。',categoryStale:'他の端末で作品が更新されています。再読込してから操作してください。',
      categoryError:'カテゴリを更新できませんでした：',categoryUnset:'未設定',
      categoryHelp:'カテゴリは作品の持ち主だけが変更できます。同じ採点内容の作品は確認用に表示します（自動削除しません）。',
      duplicate:'同じ採点データあり',
      categoryNames:{sports:'スポーツ',manga_anime:'漫画・アニメ',movie_tv:'映画・ドラマ',food:'フード',game:'ゲーム',music:'音楽',books:'本・文学',travel:'旅行・場所',tech:'テクノロジー',lifestyle:'ライフ・趣味',other:'その他'}
    },
    en:{
      brandSub:'My Works',back:'Back to editor',title:'My Published Works',
      lead:'View and manage works published from this browser.',refresh:'Refresh',
      notice:'Work management access is stored in this browser. Clearing browser data may prevent editing past publications. Keep a JSON backup of important original data.',
      allWorks:'All works',worksTitle:'Manage published works',
      loading:'Loading works…',empty:'No manageable works yet',
      emptyHelp:'Publish a work from Home to manage its visibility here.',
      openStats:'Open Stats Maker',
      noSession:'This browser has no saved publication access. You can still create charts and save images normally.',
      loadError:'Could not load works: ',
      public:'Public',unlisted:'Unlisted',private:'Private',targets:'targets',metrics:'metrics',scale:'pt',updated:'Updated',
      visibility:'Visibility',open:'Open',copy:'Share URL',copied:'Share URL copied.',copyFailed:'Could not copy the URL.',
      privateNoShare:'Private works do not expose a share URL.',saving:'Updating visibility…',saved:'Visibility updated.',saveError:'Could not update visibility: ',
      category:'Category',categorySave:'Save category',categorySaving:'Saving category…',
      categorySaved:'Category updated. Ratings and visibility are unchanged.',
      categoryUnchanged:'Category is already up to date.',categoryStale:'This work changed on another device. Refresh and try again.',
      categoryError:'Could not update category: ',categoryUnset:'Uncategorized',
      categoryHelp:'Only the owner can update categories. Duplicate scoring data is highlighted for review; nothing is removed automatically.',
      duplicate:'Same scoring data',
      categoryNames:{sports:'Sports',manga_anime:'Manga / Anime',movie_tv:'Movies / TV',food:'Food',game:'Games',music:'Music',books:'Books',travel:'Travel / Places',tech:'Technology',lifestyle:'Lifestyle / Hobbies',other:'Other'}
    }
  };

  // R90: owner-mediated classification; never infer a category or modify another creator's work.
  const CATEGORY_KEYS=['sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other'];
  const categoriesAllowed=new Set(CATEGORY_KEYS);
  function categoryKey(topic){
    const key=String(topic?.snapshot?.metadata?.category||'');
    return categoriesAllowed.has(key)?key:'';
  }
  function categoryOptions(selected){
    const choices=[['',c().categoryUnset],...CATEGORY_KEYS.map(key=>[key,c().categoryNames[key]])];
    return choices.map(([key,label])=>`<option value="${key}" ${selected===key?'selected':''}>${esc(label)}</option>`).join('');
  }
  function stableSnapshot(topic){
    if(!topic?.snapshot||typeof topic.snapshot!=='object'||Array.isArray(topic.snapshot))return null;
    // jsonb keys have deterministic order in PostgREST; no hashes or scores leave the browser.
    return JSON.stringify(topic.snapshot);
  }
  function duplicatesAmongOwnedWorks(){
    const seen=new Map(),matches=new Set();
    for(const topic of state.works){
      const fingerprint=stableSnapshot(topic);
      if(!fingerprint)continue;
      const first=seen.get(fingerprint);
      if(first){matches.add(first);matches.add(topic.id)}
      else seen.set(fingerprint,topic.id);
    }
    return matches;
  }

  function $(id){return document.getElementById(id)}
  function c(){return copy[state.locale]||copy.ja}
  function detectLocale(){
    const urlLang=new URLSearchParams(location.search).get('lang');
    if(urlLang)return String(urlLang).toLowerCase().startsWith('en')?'en':'ja';
    const stored=localStorage.getItem(LOCALE_KEY);
    if(stored)return String(stored).toLowerCase().startsWith('en')?'en':'ja';
    return String(navigator.language||'ja').toLowerCase().startsWith('en')?'en':'ja';
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function setStatus(message='',kind=''){
    const el=$('myStatus'); if(!el)return;
    el.textContent=message; el.className='status'+(kind?' '+kind:'');
  }
  function dateText(value){
    if(!value)return '—';
    const d=new Date(value); if(Number.isNaN(d.getTime()))return '—';
    return d.toLocaleDateString(state.locale==='ja'?'ja-JP':'en-US',{year:'numeric',month:'short',day:'numeric'});
  }
  function publicPageUrl(id){return `public.html?id=${encodeURIComponent(id)}&v=r24p2`}
  function shareUrl(id){return OGP_ORIGIN?`${OGP_ORIGIN}/p/${encodeURIComponent(id)}`:publicPageUrl(id)}
  
  function applyCopy(){
    document.documentElement.lang=state.locale;
    document.title=c().title+' - Stats Maker';
    $('brandSub').textContent=c().brandSub;
    $('backBtn').textContent=c().back;
    $('pageTitle').textContent=c().title;
    $('pageLead').textContent=c().lead;
    $('refreshBtn').textContent=c().refresh;
    $('browserNotice').textContent=c().notice;
    $('countAllLabel').textContent=c().allWorks;
    $('worksTitle').textContent=c().worksTitle;
    $('emptyTitle').textContent=c().empty;
    $('emptyHelp').textContent=c().emptyHelp;
    $('emptyBackBtn').textContent=c().openStats;
    $('r90CategoryHelp').textContent=c().categoryHelp;
    renderWorks();
  }
  function setLocale(next){
    state.locale=next==='en'?'en':'ja';
    localStorage.setItem(LOCALE_KEY,state.locale);
    applyCopy();
  }

  function counts(){
    return {
      all:state.works.length,
      public:state.works.filter(w=>w.visibility==='public').length,
      unlisted:state.works.filter(w=>w.visibility==='unlisted').length,
      private:state.works.filter(w=>w.visibility==='private').length
    };
  }

  function renderSummary(){
    const n=counts();
    $('countAll').textContent=n.all;
    $('countPublic').textContent=n.public;
    $('countUnlisted').textContent=n.unlisted;
    $('countPrivate').textContent=n.private;
  }

  function workStats(topic){
    const snap=topic?.snapshot&&typeof topic.snapshot==='object'?topic.snapshot:{};
    return {
      targets:Array.isArray(snap.rows)?snap.rows.length:0,
      metrics:Array.isArray(snap.criteria)?snap.criteria.length:0,
      category:categoryKey(topic)?c().categoryNames[categoryKey(topic)]:c().categoryUnset
    };
  }

  function renderWorks(){
    renderSummary();
    const grid=$('worksGrid'),empty=$('emptyState'),status=$('worksStatus');
    if(state.loading){
      status.textContent=c().loading; status.classList.remove('hidden');
      grid.classList.add('hidden'); empty.classList.add('hidden'); return;
    }
    if(!state.user){
      status.textContent=c().noSession; status.classList.remove('hidden');
      grid.classList.add('hidden'); empty.classList.add('hidden'); return;
    }

    const list=state.filter==='all'?state.works:state.works.filter(w=>w.visibility===state.filter);
    if(!list.length){
      status.classList.add('hidden'); grid.classList.add('hidden'); empty.classList.remove('hidden'); return;
    }

    empty.classList.add('hidden'); status.classList.add('hidden'); grid.classList.remove('hidden');
    const duplicated=duplicatesAmongOwnedWorks();
    grid.innerHTML=list.map(topic=>{
      const stats=workStats(topic);
      const vis=String(topic.visibility||'private');
      const description=String(topic.description||'').trim();
      const updated=topic.snapshot_updated_at||topic.published_at;
      const canShare=vis!=='private';
      return `<article class="workCard" data-topic-id="${esc(topic.id)}">
        <div class="workTop">
          <span class="visibilityBadge ${esc(vis)}">${esc(vis)}</span>
          <span class="metaChip">${esc(stats.category)}</span>
          ${duplicated.has(topic.id)?`<span class="metaChip r90Duplicate">${esc(c().duplicate)}</span>`:''}
        </div>
        <div class="workTitle">${esc(topic.title||'Untitled')}</div>
        <div class="workDesc">${esc(description||'—')}</div>
        <div class="workMeta">
          <span class="metaChip">${stats.targets} ${esc(c().targets)}</span>
          <span class="metaChip">${stats.metrics} ${esc(c().metrics)}</span>
          <span class="metaChip">${Number(topic.score_scale||100)} ${esc(c().scale)}</span>
        </div>
        <div class="workDate">${esc(c().updated)} ${esc(dateText(updated))}</div>
        <div class="r90CategoryControls">
          <label for="r90-cat-${esc(topic.id)}">${esc(c().category)}</label>
          <select id="r90-cat-${esc(topic.id)}" class="visibilitySelect r90CategorySelect" data-category-for="${esc(topic.id)}">
            ${categoryOptions(categoryKey(topic))}
          </select>
          <button class="btn" type="button" data-save-category="${esc(topic.id)}">${esc(c().categorySave)}</button>
        </div>
        <div class="workControls">
          <select class="visibilitySelect" data-visibility-for="${esc(topic.id)}" aria-label="${esc(c().visibility)}">
            <option value="public" ${vis==='public'?'selected':''}>Public</option>
            <option value="unlisted" ${vis==='unlisted'?'selected':''}>Unlisted</option>
            <option value="private" ${vis==='private'?'selected':''}>Private</option>
          </select>
          <button class="btn" type="button" data-save-visibility="${esc(topic.id)}">${esc(c().visibility)}</button>
        </div>
        <div class="cardActions">
          <a class="btn primary ${canShare?'':'hidden'}" href="${canShare?esc(publicPageUrl(topic.id)):'#'}">${esc(c().open)}</a>
          <button class="btn ${canShare?'':'hidden'}" type="button" data-copy-share="${esc(topic.id)}">${esc(c().copy)}</button>
          <span class="metaChip ${canShare?'hidden':''}">${esc(c().privateNoShare)}</span>
        </div>
      </article>`;
    }).join('');
  }

  
  async function loadUser(){
    if(!sb){state.user=null;return;}
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    state.user=data?.session?.user||null;
  }

  async function loadWorks(){
    if(!sb||!state.user){state.works=[];state.loading=false;renderWorks();return;}
    state.loading=true; renderWorks();
    const {data,error}=await sb.from('topics')
      .select('id,title,description,visibility,language_code,score_scale,published_at,snapshot_updated_at,updated_at,snapshot,show_community,allow_ratings')
      .eq('owner_id',state.user.id)
      .order('snapshot_updated_at',{ascending:false,nullsFirst:false})
      .limit(200);
    state.loading=false;
    if(error){
      $('worksStatus').textContent=c().loadError+(error.message||String(error));
      $('worksStatus').classList.remove('hidden');
      $('worksGrid').classList.add('hidden');
      throw error;
    }
    state.works=Array.isArray(data)?data:[];
    renderWorks();
  }

  
  async function refresh(){
    try{
      setStatus('');
      await loadUser();
      await loadWorks();
    }catch(error){
      console.error('[Stats Maker] works refresh failed',error);
      setStatus(c().loadError+(error?.message||String(error)),'error');
    }
  }
  async function updateVisibility(topicId){
    if(!sb||!state.user)return;
    const select=document.querySelector(`[data-visibility-for="${CSS.escape(topicId)}"]`);
    const button=document.querySelector(`[data-save-visibility="${CSS.escape(topicId)}"]`);
    const visibility=select?.value;
    if(!['public','unlisted','private'].includes(visibility))return;
    button.disabled=true; setStatus(c().saving);
    try{
      const {data,error}=await sb.from('topics')
        .update({visibility})
        .eq('id',topicId)
        .eq('owner_id',state.user.id)
        .select('id,visibility')
        .single();
      if(error)throw error;
      const work=state.works.find(item=>item.id===topicId);
      if(work)work.visibility=data.visibility;
      setStatus(c().saved,'ok');
      renderWorks();
    }catch(error){
      setStatus(c().saveError+(error?.message||String(error)),'error');
    }finally{
      if(button)button.disabled=false;
    }
  }

  async function updateCategory(topicId){
    if(!sb||!state.user)return;
    const work=state.works.find(item=>item.id===topicId);
    const select=document.querySelector(`[data-category-for="${CSS.escape(topicId)}"]`);
    const button=document.querySelector(`[data-save-category="${CSS.escape(topicId)}"]`);
    if(!work||!select||!button)return;
    const next=select.value;
    if(!categoriesAllowed.has(next)){setStatus(c().categoryError+c().categoryUnset,'error');return}
    if(categoryKey(work)===next){setStatus(c().categoryUnchanged);return}
    button.disabled=true;setStatus(c().categorySaving);
    try{
      // Fetch fresh owner-scoped snapshot before the edit; never use a stale local copy.
      const {data:fresh,error:readError}=await sb.from('topics')
        .select('id,snapshot,updated_at').eq('id',topicId).eq('owner_id',state.user.id).single();
      if(readError)throw readError;
      if(!fresh||!fresh.snapshot||Array.isArray(fresh.snapshot)||typeof fresh.snapshot!=='object')
        throw Error('Invalid topic snapshot');
      if(fresh.updated_at!==work.updated_at||JSON.stringify(fresh.snapshot)!==stableSnapshot(work)){
        await loadWorks();setStatus(c().categoryStale,'error');return;
      }
      // Restrict the mutation to snapshot metadata plus its update timestamp.
      // The original title, scores, criteria, lineage, publication state and shares persist.
      const snapshot={...fresh.snapshot,metadata:{...(fresh.snapshot.metadata||{}),category:next}};
      const {data:saved,error:writeError}=await sb.from('topics')
        .update({snapshot,snapshot_updated_at:new Date().toISOString()})
        .eq('id',topicId).eq('owner_id',state.user.id)
        .eq('updated_at',fresh.updated_at)
        .select('id,snapshot,snapshot_updated_at,updated_at')
        .maybeSingle();
      if(writeError)throw writeError;
      if(!saved){await loadWorks();setStatus(c().categoryStale,'error');return}
      work.snapshot=saved.snapshot;
      work.snapshot_updated_at=saved.snapshot_updated_at;
      work.updated_at=saved.updated_at;
      renderWorks();setStatus(c().categorySaved,'ok');
    }catch(error){setStatus(c().categoryError+(error?.message||String(error)),'error')}
    finally{button.disabled=false}
  }

  async function copyShare(topicId){
    const work=state.works.find(item=>item.id===topicId);
    if(!work||work.visibility==='private'){setStatus(c().privateNoShare,'error');return;}
    try{
      await navigator.clipboard.writeText(shareUrl(topicId));
      setStatus(c().copied,'ok');
    }catch{setStatus(c().copyFailed,'error')}
  }

  
  document.querySelectorAll('.filterBtn').forEach(btn=>btn.addEventListener('click',()=>{
    state.filter=btn.dataset.filter||'all';
    document.querySelectorAll('.filterBtn').forEach(item=>item.classList.toggle('active',item===btn));
    renderWorks();
  }));
  $('refreshBtn').addEventListener('click',refresh);
  $('worksGrid').addEventListener('click',event=>{
    const save=event.target.closest('[data-save-visibility]');
    if(save){updateVisibility(save.dataset.saveVisibility);return;}
    const saveCategory=event.target.closest('[data-save-category]');
    if(saveCategory){updateCategory(saveCategory.dataset.saveCategory);return;}
    const copyBtn=event.target.closest('[data-copy-share]');
    if(copyBtn)copyShare(copyBtn.dataset.copyShare);
  });
  if(sb){
    sb.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user||null;
      const changed=next?.id!==state.user?.id;
      state.user=next;
      if(changed)setTimeout(()=>refresh(),0);
    });
  }
  applyCopy();
  refresh();
})();
