(() => {
  'use strict';

  const sb=window.SM_SUPABASE?.client||null;
  const LOCALE_KEY='statsMaker.locale';
  const OGP_ORIGIN=String(window.SM_RUNTIME?.ogShareOrigin||'').replace(/\/+$/,'');
  const state={user:null,works:[],filter:'all',loading:false,locale:detectLocale()};

  const copy={
    ja:{
      brandSub:'My Page',back:'編集へ戻る',title:'My Page',lead:'アカウント状態と、自分が公開した作品をまとめて管理します。',refresh:'更新',
      checking:'確認中…',checkingDetail:'Supabaseセッションを確認しています。',
      signedOut:'未ログイン',signedOutDetail:'クラウド作品を管理するにはGoogle / Appleでログインしてください。',
      guest:'ゲストアカウント',guestDetail:'このブラウザに保存された匿名IDで公開作品を管理しています。',
      permanent:'アカウント接続済み',unknownAccount:'接続済みアカウント',
      guestWarning:'この端末のゲストIDで公開作品を管理しています。ブラウザデータを消す前にGoogleまたはAppleへ連携すると、同じ所有者IDを維持できます。',
      signedOutNotice:'ログインしなくてもStats Makerの作成・編集は使えます。My Pageのクラウド作品管理だけログインが必要です。',
      googleProtect:'Googleで保護',appleProtect:'Appleで保護',googleLogin:'Googleでログイン',appleLogin:'Appleでログイン',googleAdd:'Googleを追加',appleAdd:'Appleを追加',
      linked:'連携済み',signOut:'ログアウト',providerHelp:'Google / Apple連携にはSupabase側で各ProviderとManual Linkingの有効化が必要です。',
      allWorks:'全作品',worksTitle:'自分の公開作品',loading:'作品を読み込み中…',empty:'まだ作品がありません',emptyHelp:'Stats Makerから作品を公開すると、ここで管理できます。',openStats:'Stats Makerを開く',
      noSession:'このブラウザには管理可能なクラウドセッションがありません。',loadError:'作品の読み込みに失敗しました：',
      public:'Public',unlisted:'Unlisted',private:'Private',targets:'対象',metrics:'項目',scale:'点',updated:'更新',
      visibility:'公開範囲',open:'開く',copy:'共有URL',copied:'共有URLをコピーしました。',copyFailed:'URLをコピーできませんでした。',
      privateNoShare:'Private作品は共有URLを発行しません。',saving:'公開範囲を更新中…',saved:'公開範囲を更新しました。',saveError:'公開範囲を更新できませんでした：',
      authStart:'認証画面を開きます…',authLinked:'アカウント連携を確認しました。',authError:'認証エラー：',signOutDone:'ログアウトしました。',
      providerConfig:'Providerが無効、またはManual Linking / Redirect URL設定が未完了の可能性があります。',
      identityGoogle:'Google',identityApple:'Apple',identityEmail:'Email',identityOther:'Identity'
    },
    en:{
      brandSub:'My Page',back:'Back to editor',title:'My Page',lead:'Manage your account status and the works you have published.',refresh:'Refresh',
      checking:'Checking…',checkingDetail:'Checking your Supabase session.',
      signedOut:'Signed out',signedOutDetail:'Sign in with Google or Apple to manage cloud works.',
      guest:'Guest account',guestDetail:'Your published works are owned by the anonymous ID stored in this browser.',
      permanent:'Account connected',unknownAccount:'Connected account',
      guestWarning:'Your published works are currently owned by this browser guest ID. Link Google or Apple before clearing browser data to keep the same owner ID.',
      signedOutNotice:'You can keep creating and editing without an account. Sign-in is only required for cloud work management in My Page.',
      googleProtect:'Protect with Google',appleProtect:'Protect with Apple',googleLogin:'Sign in with Google',appleLogin:'Sign in with Apple',googleAdd:'Add Google',appleAdd:'Add Apple',
      linked:'Linked',signOut:'Sign out',providerHelp:'Google / Apple requires the provider and Manual Linking to be enabled in Supabase.',
      allWorks:'All works',worksTitle:'My published works',loading:'Loading your works…',empty:'No works yet',emptyHelp:'Publish a work from Stats Maker and it will appear here.',openStats:'Open Stats Maker',
      noSession:'There is no cloud session to manage in this browser.',loadError:'Could not load works: ',
      public:'Public',unlisted:'Unlisted',private:'Private',targets:'targets',metrics:'metrics',scale:'pt',updated:'Updated',
      visibility:'Visibility',open:'Open',copy:'Share URL',copied:'Share URL copied.',copyFailed:'Could not copy the URL.',
      privateNoShare:'Private works do not expose a share URL.',saving:'Updating visibility…',saved:'Visibility updated.',saveError:'Could not update visibility: ',
      authStart:'Opening authentication…',authLinked:'Account connection confirmed.',authError:'Authentication error: ',signOutDone:'Signed out.',
      providerConfig:'The provider may be disabled, or Manual Linking / Redirect URL configuration may be incomplete.',
      identityGoogle:'Google',identityApple:'Apple',identityEmail:'Email',identityOther:'Identity'
    }
  };

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
    const el=$('authStatus'); if(!el)return;
    el.textContent=message; el.className='status'+(kind?' '+kind:'');
  }
  function dateText(value){
    if(!value)return '—';
    const d=new Date(value); if(Number.isNaN(d.getTime()))return '—';
    return d.toLocaleDateString(state.locale==='ja'?'ja-JP':'en-US',{year:'numeric',month:'short',day:'numeric'});
  }
  function publicPageUrl(id){return `public.html?id=${encodeURIComponent(id)}&v=r24p1`}
  function shareUrl(id){return OGP_ORIGIN?`${OGP_ORIGIN}/p/${encodeURIComponent(id)}`:publicPageUrl(id)}
  function providerNames(user){
    const identities=Array.isArray(user?.identities)?user.identities:[];
    return [...new Set(identities.map(identity=>String(identity?.provider||'').toLowerCase()).filter(Boolean))];
  }
  function providerLabel(provider){
    if(provider==='google')return c().identityGoogle;
    if(provider==='apple')return c().identityApple;
    if(provider==='email')return c().identityEmail;
    return c().identityOther;
  }

  function applyCopy(){
    document.documentElement.lang=state.locale;
    document.title=`${c().title} - Stats Maker`;
    $('brandSub').textContent=c().brandSub;
    $('backBtn').textContent=c().back;
    $('pageTitle').textContent=c().title;
    $('pageLead').textContent=c().lead;
    $('refreshBtn').textContent=c().refresh;
    $('guestWarning').textContent=c().guestWarning;
    $('signedOutNotice').textContent=c().signedOutNotice;
    $('signOutBtn').textContent=c().signOut;
    $('providerHelp').textContent=c().providerHelp;
    $('countAllLabel').textContent=c().allWorks;
    $('worksTitle').textContent=c().worksTitle;
    $('emptyTitle').textContent=c().empty;
    $('emptyHelp').textContent=c().emptyHelp;
    $('emptyBackBtn').textContent=c().openStats;
    document.querySelectorAll('[data-lang]').forEach(btn=>btn.classList.toggle('active',btn.dataset.lang===state.locale));
    renderAccount();
    renderWorks();
  }

  function setLocale(next){
    state.locale=next==='en'?'en':'ja';
    localStorage.setItem(LOCALE_KEY,state.locale);
    applyCopy();
  }

  function renderAccount(){
    const user=state.user;
    const providers=providerNames(user);
    const googleLinked=providers.includes('google');
    const appleLinked=providers.includes('apple');

    $('guestWarning').classList.toggle('hidden',!user?.is_anonymous);
    $('signedOutNotice').classList.toggle('hidden',!!user);
    $('signOutBtn').classList.toggle('hidden',!user);

    if(!user){
      $('avatar').textContent='?';
      $('accountState').textContent=c().signedOut;
      $('accountDetail').textContent=c().signedOutDetail;
      $('identityList').innerHTML='';
      $('googleLabel').textContent=c().googleLogin;
      $('appleLabel').textContent=c().appleLogin;
      $('googleBtn').disabled=false;
      $('appleBtn').disabled=false;
      return;
    }

    const detail=user.is_anonymous
      ?c().guestDetail
      :(user.email||providers.map(providerLabel).join(' · ')||c().unknownAccount);
    $('avatar').textContent=user.is_anonymous?'G':String(user.email||providers[0]||'A').slice(0,1).toUpperCase();
    $('accountState').textContent=user.is_anonymous?c().guest:c().permanent;
    $('accountDetail').textContent=detail;
    $('identityList').innerHTML=providers.map(p=>`<span class="identityChip">${esc(providerLabel(p))}</span>`).join('');

    $('googleLabel').textContent=googleLinked?c().linked:(user.is_anonymous?c().googleProtect:c().googleAdd);
    $('appleLabel').textContent=appleLinked?c().linked:(user.is_anonymous?c().appleProtect:c().appleAdd);
    $('googleBtn').disabled=googleLinked;
    $('appleBtn').disabled=appleLinked;
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
      category:String(snap?.metadata?.category||'other').replace(/_/g,' ')
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
        </div>
        <div class="workTitle">${esc(topic.title||'Untitled')}</div>
        <div class="workDesc">${esc(description||'—')}</div>
        <div class="workMeta">
          <span class="metaChip">${stats.targets} ${esc(c().targets)}</span>
          <span class="metaChip">${stats.metrics} ${esc(c().metrics)}</span>
          <span class="metaChip">${Number(topic.score_scale||100)} ${esc(c().scale)}</span>
        </div>
        <div class="workDate">${esc(c().updated)} ${esc(dateText(updated))}</div>
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
    if(!sb)throw new Error('Supabase client is not ready');
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    state.user=data?.session?.user||null;
    renderAccount();
  }

  async function loadWorks(){
    if(!sb||!state.user){state.works=[];state.loading=false;renderWorks();return;}
    state.loading=true; renderWorks();
    const {data,error}=await sb.from('topics')
      .select('id,title,description,visibility,language_code,score_scale,published_at,snapshot_updated_at,snapshot,show_community,allow_ratings')
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
    setStatus('');
    try{
      await loadUser();
      await loadWorks();
    }catch(error){
      console.error('[Stats Maker] My Page refresh failed',error);
      setStatus((error?.message||String(error)),'error');
    }
  }

  async function startProvider(provider){
    if(!sb)return;
    const button=provider==='google'?$('googleBtn'):$('appleBtn');
    const redirectTo=new URL('my.html?v=r24p1',location.href).href;
    button.disabled=true;
    setStatus(c().authStart);
    try{
      const user=(await sb.auth.getUser()).data?.user||null;
      if(user){
        const {data,error}=await sb.auth.linkIdentity({
          provider,
          options:{redirectTo}
        });
        if(error)throw error;
        if(data?.url){location.assign(data.url);return;}
      }else{
        const {data,error}=await sb.auth.signInWithOAuth({
          provider,
          options:{redirectTo}
        });
        if(error)throw error;
        if(data?.url){location.assign(data.url);return;}
      }
      setStatus(c().authLinked,'ok');
      await refresh();
    }catch(error){
      console.error('[Stats Maker] provider auth failed',error);
      setStatus(c().authError+(error?.message||String(error))+'\n'+c().providerConfig,'error');
    }finally{
      button.disabled=false;
      renderAccount();
    }
  }

  async function signOut(){
    if(!sb)return;
    try{
      const {error}=await sb.auth.signOut();
      if(error)throw error;
      state.user=null; state.works=[];
      setStatus(c().signOutDone,'ok');
      renderAccount(); renderWorks();
    }catch(error){setStatus(c().authError+(error?.message||String(error)),'error')}
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

  async function copyShare(topicId){
    const work=state.works.find(item=>item.id===topicId);
    if(!work||work.visibility==='private'){setStatus(c().privateNoShare,'error');return;}
    try{
      await navigator.clipboard.writeText(shareUrl(topicId));
      setStatus(c().copied,'ok');
    }catch{setStatus(c().copyFailed,'error')}
  }

  document.querySelectorAll('[data-lang]').forEach(btn=>btn.addEventListener('click',()=>setLocale(btn.dataset.lang)));
  document.querySelectorAll('.filterBtn').forEach(btn=>btn.addEventListener('click',()=>{
    state.filter=btn.dataset.filter||'all';
    document.querySelectorAll('.filterBtn').forEach(item=>item.classList.toggle('active',item===btn));
    renderWorks();
  }));
  $('refreshBtn').addEventListener('click',refresh);
  $('googleBtn').addEventListener('click',()=>startProvider('google'));
  $('appleBtn').addEventListener('click',()=>startProvider('apple'));
  $('signOutBtn').addEventListener('click',signOut);
  $('worksGrid').addEventListener('click',event=>{
    const save=event.target.closest('[data-save-visibility]');
    if(save){updateVisibility(save.dataset.saveVisibility);return;}
    const copyBtn=event.target.closest('[data-copy-share]');
    if(copyBtn)copyShare(copyBtn.dataset.copyShare);
  });

  if(sb){
    sb.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user||null;
      const changed=next?.id!==state.user?.id||next?.is_anonymous!==state.user?.is_anonymous;
      state.user=next;
      renderAccount();
      if(changed)loadWorks().catch(error=>console.error(error));
    });
  }

  applyCopy();
  refresh();
})();
