(() => {
  'use strict';
  /*
   * R33, optional GA4 journey analytics on the FREE tier.
   * Default: 0 network requests, 0 third-party scripts, 0 stored event data.
   * No visitor identifier, work title, search terms, scores, URL queries,
   * publication IDs, account IDs, or raw event payloads are ever transmitted.
   * GDPR-friendly BASIC consent: no Google script until explicit opt-in.
   */
  const cfg=window.SM_ANALYTICS_CONFIG||{};
  const valid=cfg.enabled===true&&/^G-[A-Z0-9]{6,16}$/.test(cfg.measurementId||'');
  const framed=window.parent!==window;
  const consentKey='sm-analytics-consent-v1';
  const debug=new URLSearchParams(location.search).get('analyticsDebug')==='1';
  const debugEvents=[];
  const events=new Set([
    'page_view','discover_filter','discover_search','discover_open_work',
    'home_action','template_selected','editor_export_started',
    'editor_export_completed','share_action','publish_attempt',
    'publish_success','publish_failure','rating_attempt','rating_success',
    'rating_failure','remix_started','work_view','scroll_depth',
    'ad_slot_viewable'
  ]);
  const paramsAllowed={
    page_group:['home','community','discover','published','my_works','editor','rating_legacy','landing_ja','landing_en','unknown'],
    template_type:['bar','radar','dot','range','scatter','quadrant','ring','ranking-card','stat-card','tier-list','unknown'],
    filter_type:['all','community','category','newest','popular','remix','other'],
    visibility:['public','private','unlisted','unknown'],
    action_type:['publish_open','new_sheet','new_project','template_open','discover_open','rating_open','share_image','share_url','share_file','my_works_open','backup_export','other'],
    outcome:['success','failure','open','started','unknown'],
    slot_id:['home-inline','editor-top','editor-sidebar','editor-mobile','editor-share','discover-primary','discover-secondary','discover-infeed','discover-anchor','public-primary','public-secondary','public-between-rankings','public-share','public-anchor','works-inline','rate-inline','home-desktop-rail','community-desktop-rail','discover-desktop-rail','public-desktop-rail'],
    depth:['25','50','75','90'],
    origin_type:['card','button','nav','other'],
    eligible:['yes','no'],
    amount_bucket:['0','1-3','4-10','11-20','21+'],
    work_code:[]
  };
  const pageMap={discover:'discover',public:'published',my:'my_works',works:'my_works',rate:'rating_legacy',
    editor:'editor',base:'home'};
  function group(){
    if(document.body?.dataset.smLocalizedLanding==='ja')return 'landing_ja';
    if(document.body?.dataset.smLocalizedLanding==='en')return 'landing_en';
    if(document.body?.dataset.smAdPage)return pageMap[document.body.dataset.smAdPage]||'unknown';
    if(location.pathname.startsWith('/app/editor'))return 'editor';
    if(location.pathname==='/index.html'||location.pathname==='/')
      return new URLSearchParams(location.search).has('community')?'community':'home';
    const key=location.pathname.split('/').pop().replace(/\.html$/,'');
    return pageMap[key]||'unknown';
  }
  // Only known page paths are sent. Queries may contain private/unlisted URLs.
  function safePath(){
    const name=group();
    return ({home:'/home',community:'/community',discover:'/discover',
      published:'/public',my_works:'/my',editor:'/app/editor',
      rating_legacy:'/rate',landing_ja:'/ja/',landing_en:'/en/',unknown:'/other'})[name];
  }
  function safePageLocation(){
    // Whitelist only short, benign campaign tags. Never send topic IDs,
    // unlisted access URLs, search queries, free-text fields or adPreview.
    const tags=new URLSearchParams(location.search);
    const campaign=new URLSearchParams();
    for(const key of ['utm_source','utm_medium','utm_campaign']){
      const value=tags.get(key)||'';
      if(/^[a-z0-9_-]{1,48}$/i.test(value))campaign.set(key,value.toLowerCase());
    }
    const suffix=campaign.toString();
    return location.origin+safePath()+(suffix?'?'+suffix:'');
  }
  function safeReferrer(){
    try{
      if(!document.referrer)return '';
      const from=new URL(document.referrer);
      if(from.origin===location.origin){
        const p=from.pathname.replace(/\.html$/,'');
        return location.origin+(/^\/(?:app\/editor|discover|public|my|rate|index|base\/index)$/.test(p)?p:'/other');
      }
      // Keep referral domain for acquisition channels, discard its path/query.
      return ['https:','http:'].includes(from.protocol)?from.origin+'/':'';
    }catch{return ''}
  }
  function sanitize(properties){
    const out={page_group:group()};
    if(!properties||typeof properties!=='object')return out;
    for(const [k,options] of Object.entries(paramsAllowed)){
      if(k==='page_group')continue;
      if(k==='work_code'){
        const code=String(properties.work_code||'').toLowerCase();
        if(/^[a-f0-9]{8}$/.test(code))out.work_code=code;
        continue;
      }
      const value=String(properties[k]??'');
      if(options.includes(value))out[k]=value;
    }
    return out;
  }
  function entry(eventName,properties){
    if(!events.has(eventName))return null;
    return {name:eventName,params:sanitize(properties)};
  }
  let loaded=false;
  let consent='unset';
  try{
    const stored=localStorage.getItem(consentKey);
    if(stored==='granted'||stored==='denied')consent=stored;
  }catch{}
  function pushGoogle(item){
    if(!loaded||consent!=='granted'||typeof window.gtag!=='function')return;
    const fields={...item.params};
    if(item.name==='page_view'){
      fields.page_title='Stats Maker · '+fields.page_group;
      fields.page_location=safePageLocation();
      fields.page_referrer=safeReferrer();
    }
    window.gtag('event',item.name,fields);
  }
  function dispatch(eventName,properties){
    const item=entry(eventName,properties);
    if(!item)return;
    if(framed){
      try{
        if(window.parent.SM_ANALYTICS){
          window.parent.SM_ANALYTICS.event(item.name,item.params);
          return;
        }
      }catch{}
    }
    if(debug){
      debugEvents.push(item);
      if(debugEvents.length>200)debugEvents.shift();
    }
    pushGoogle(item);
  }
  function loadGA4(){
    if(!valid||loaded||consent!=='granted'||(framed&&window.parent.SM_ANALYTICS))return;
    loaded=true;
    window.dataLayer=window.dataLayer||[];
    window.gtag=function(){window.dataLayer.push(arguments)};
    window.gtag('consent','default',{
      analytics_storage:'granted',ad_storage:'denied',
      ad_user_data:'denied',ad_personalization:'denied'
    });
    window.gtag('js',new Date());
    window.gtag('config',cfg.measurementId,{
      send_page_view:false,allow_google_signals:false,
      allow_ad_personalization_signals:false,
      page_location:safePageLocation(),
      page_referrer:safeReferrer()
    });
    const script=document.createElement('script');
    script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(cfg.measurementId);
    document.head.appendChild(script);
    dispatch('page_view');
  }
  function setConsent(value){
    if(value!=='granted'&&value!=='denied')return;
    consent=value;
    try{localStorage.setItem(consentKey,value)}catch{}
    document.querySelector('#sm-analytics-consent')?.remove();
    document.querySelector('#basicRoot')?.style.removeProperty('top');
    if(value==='granted')loadGA4();
    else if(loaded&&typeof window.gtag==='function'){
      window.gtag('consent','update',{
        analytics_storage:'denied',ad_storage:'denied',
        ad_user_data:'denied',ad_personalization:'denied'
      });
    }
  }
  function notice(){
    if(!valid||framed||consent!=='unset'||document.getElementById('sm-analytics-consent'))return;
    const container=document.createElement('section');
    container.id='sm-analytics-consent';
    container.setAttribute('role','region');
    container.setAttribute('aria-label','アクセス解析の同意');
    // In-flow consent notice: never cover mobile save/export/rating controls.
    Object.assign(container.style,{position:'relative',zIndex:'109',width:'calc(100% - 16px)',
      maxWidth:'630px',margin:'8px auto',
      padding:'12px',border:'1px solid #5278a6',borderRadius:'13px',
      background:'#11233b',color:'#eaf2ff',boxShadow:'0 12px 34px #0009',
      fontFamily:'system-ui,sans-serif',fontSize:'12px',lineHeight:'1.6'});
    const english=document.documentElement.lang==='en'||location.pathname.startsWith('/en/')||
      new URLSearchParams(location.search).get('lang')==='en'||
      (()=>{try{return localStorage.getItem('statsMaker.locale')==='en'}catch{return false}})();
    const msg=document.createElement('div');
    msg.textContent=english
      ?'May we use Google Analytics to improve Stats Maker by counting page views and types of actions? We do not send your work titles, ratings, search words or user IDs. You can decline and keep using all features.'
      :'サイトの改善のため、Google Analyticsで画面の閲覧や操作の種類を集計してもよいですか？作品の名前・入力した点数・検索語・個人IDは送信しません。拒否しても全機能を利用できます。';
    container.appendChild(msg);
    const privacy=document.createElement('a');
    privacy.href=english?'/en/legal.html#privacy':'/ja/legal.html#privacy';
    privacy.textContent=english?'Privacy policy':'プライバシーポリシー';
    Object.assign(privacy.style,{display:'inline-block',marginTop:'5px',color:'#c6dcff'});
    container.appendChild(privacy);
    const row=document.createElement('div');
    Object.assign(row.style,{display:'flex',gap:'8px',marginTop:'10px'});
    for(const [label,value] of (english?[['Decline','denied'],['Allow analytics','granted']]:[['拒否する','denied'],['許可する','granted']])){
      const button=document.createElement('button');
      button.type='button';button.textContent=label;
      Object.assign(button.style,{flex:'1',minHeight:'44px',borderRadius:'8px',
        border:'1px solid #5278a6',background:value==='granted'?'#3e67b5':'#23374e',
        color:'#fff',fontSize:'13px'});
      button.addEventListener('click',()=>setConsent(value));
      row.append(button);
    }
    container.append(row);
    const nav=document.querySelector('.globalLocaleBar');
    if(nav)nav.insertAdjacentElement('afterend',container);
    else document.body.prepend(container);
    // The Home iframe shell is position:fixed; reserve the in-flow notice's
    // actual height so its buttons never appear under the consent notice.
    const adjust=()=>{
      const root=document.getElementById('basicRoot');
      if(root&&document.getElementById('sm-analytics-consent')){
        const navHeight=document.querySelector('.globalLocaleBar')?.getBoundingClientRect().height||0;
        root.style.top=Math.ceil(navHeight+container.getBoundingClientRect().height+8)+'px';
      }
    };
    adjust();
    requestAnimationFrame(adjust);
  }
  function settings(){
    if(!valid||framed||document.getElementById('sm-analytics-settings'))return;
    // Keep the 320px-wide global bar intact; add consent settings to HELP.
    const panel=document.querySelector('.globalSupportPanel');
    if(!panel)return;
    const button=document.createElement('button');
    button.type='button';button.id='sm-analytics-settings';
    const english=document.documentElement.lang==='en'||new URLSearchParams(location.search).get('lang')==='en'||(()=>{try{return localStorage.getItem('statsMaker.locale')==='en'}catch{return false}})();
    button.textContent=english?'Analytics':'解析設定';button.title=english?'Change analytics consent':'アクセス解析の同意を変更';
    Object.assign(button.style,{display:'block',width:'100%',textAlign:'left',padding:'9px 10px',fontSize:'12px',minHeight:'42px',fontWeight:'800',
      border:'0',borderRadius:'8px',background:'transparent',color:'#d4e6fc',cursor:'pointer'});
    button.addEventListener('click',()=>{
      document.querySelector('.globalSupportMenu')?.removeAttribute('open');
      consent='unset';
      notice();
    });
    panel.append(button);
  }
  // A general, privacy-constrained DOM event bridge: never include user text,
  // typed fields, full URLs, titles, IDs or score values in a GA4 event.
  function clickTracking(){
    const search=document.getElementById('searchInput');
    if(search){
      search.addEventListener('change',()=>{
        if(String(search.value||'').trim())dispatch('discover_search',{amount_bucket:'1-3'});
      });
    }
    document.addEventListener('click',ev=>{
      const e=ev.target?.closest?.('button,a');
      if(!e)return;
      if(e.matches('.sortBtn'))dispatch('discover_filter',{filter_type:['newest','popular','remix'].includes(e.dataset.sort)?e.dataset.sort:'other'});
      else if(e.matches('.workMainLink,.openLabel'))dispatch('discover_open_work',{origin_type:e.matches('.workMainLink')?'card':'button'});
      else if(e.id==='extLauncher')dispatch('home_action',{action_type:'template_open'});
      else if(e.id==='publishBtn')dispatch('home_action',{action_type:'publish_open'});
      else if(e.id==='newSheetBtn')dispatch('home_action',{action_type:'new_sheet'});
      else if(e.id==='publishExecuteBtn')dispatch('publish_attempt',{});
      else if(e.id==='communitySubmit'||e.id==='communityJoinBtn')dispatch('rating_attempt',{});
      else if(e.id==='shareImageBtn'||e.id==='shareBtn')dispatch('share_action',{action_type:e.id==='shareBtn'?'share_url':'share_image'});
      else if(['shareImageCreateBtn','sharePreviewSaveBtn','exportPreviewShare'].includes(e.id))
        dispatch('share_action',{action_type:'share_file'});
      else if(e.id==='remixBtn')dispatch('remix_started',{});
      else if(e.id==='exportJsonBtn')dispatch('home_action',{action_type:'backup_export'});
    },{passive:true});
  }
  function scrollTracking(){
    let last=0;
    const seen=new Set();
    addEventListener('scroll',()=>{
      const now=Date.now();
      if(now-last<500)return;
      last=now;
      const doc=document.documentElement;
      const possible=doc.scrollHeight-innerHeight;
      if(possible<150)return;
      const pct=Math.round(scrollY/possible*100);
      for(const threshold of [25,50,75,90]){
        if(pct>=threshold&&!seen.has(threshold)){
          seen.add(threshold);
          dispatch('scroll_depth',{depth:String(threshold)});
        }
      }
    },{passive:true});
  }
  function observeLiveAds(){
    if(!('IntersectionObserver' in window))return;
    // Real ad slots only; design-only dotted previews must NEVER count.
    const tracked=new WeakSet();
    const observer=new IntersectionObserver(entries=>{
      for(const item of entries){
        if(!item.isIntersecting||item.intersectionRatio<.5)return;
        const id=item.target.dataset.smAdLiveSlot;
        if(!paramsAllowed.slot_id.includes(id))continue;
        observer.unobserve(item.target);
        dispatch('ad_slot_viewable',{slot_id:id});
      }
    },{threshold:[.5]});
    const scan=()=>{
      document.querySelectorAll('[data-sm-ad-live-slot]').forEach(el=>{
        if(tracked.has(el))return;
        tracked.add(el);
        observer.observe(el);
      });
    };
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }
  window.SM_ANALYTICS={
    event:dispatch,consent:()=>consent,
    state:()=>({configured:valid,consent,loaded,debug,events:debugEvents.slice()}),
    setConsent
  };
  function start(){
    clickTracking();
    scrollTracking();
    if(valid||debug)observeLiveAds();
    // Prevent duplicate page views for Home's same-origin editable iframe.
    if(!framed){
      if(valid&&consent==='granted')loadGA4();
      else if(valid&&consent==='unset')notice();
      if(valid){
        const observer=new MutationObserver(()=>{settings();if(document.getElementById('sm-analytics-settings'))observer.disconnect()});
        observer.observe(document.body,{childList:true,subtree:true});
        settings();
      }
      if(debug&&!valid)dispatch('page_view');
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
