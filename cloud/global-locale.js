(() => {
  'use strict';
  const KEY='statsMaker.locale', LEGACY='statsMakerV2Language';
  const normalize=value=>String(value||'').toLowerCase().startsWith('en')?'en':'ja';
  // Explicit preview mode belongs to the current navigation chain only:
  // no storage flag, cookie, tracking, ad request or default visitor changes.
  const adPreviewActive=()=>new URLSearchParams(location.search).get('adPreview')==='1';
  function previewUrl(href){
    if(!adPreviewActive())return href;
    try{
      const url=new URL(href,location.href);
      if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol))return href;
      url.searchParams.set('adPreview','1');
      return url.href;
    }catch{return href}
  }
  // Works with links added asynchronously (Discover cards, Community links),
  // but never rewrites copy/share URLs or changes a visitor's normal links.
  document.addEventListener('click',event=>{
    if(!adPreviewActive())return;
    const link=event.target?.closest?.('a[href]');
    if(!link||link.hasAttribute('download')||link.getAttribute('href')?.startsWith('#'))return;
    const updated=previewUrl(link.href);
    if(updated!==link.href)link.href=updated;
  },true);
  window.SM_AD_PREVIEW_NAV={active:adPreviewActive,url:previewUrl};
  // Localized R34 landing pages share the same fixed navigation as Home.
  // The page language is authoritative when arriving from a search engine.
  const landingLang=()=>['en','ja'].includes(document.body?.dataset.smLocalizedLanding)
    ?document.body.dataset.smLocalizedLanding:'';
  const current=()=>landingLang()||normalize(localStorage.getItem(KEY)||localStorage.getItem(LEGACY)||navigator.language||'ja');
  // Browser/CDN rewrites may expose an embedded Home as /base/ instead of
  // /base/index.html. Check the frame relationship, never the URL spelling.
  // All embedded views borrow the parent's single fixed language/Home bar.
  if(window.parent!==window){
    document.documentElement.classList.add('embeddedSiteFrame');
    return;
  }
  let bar;
  function paint(){
    if(!bar)return;
    const lang=current();
    document.documentElement.lang=lang;
    bar.querySelectorAll('[data-global-lang]').forEach(btn=>{
      const active=btn.dataset.globalLang===lang;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    const label=bar.querySelector('.globalLocaleLabel');
    label.textContent=lang==='ja'?'表示言語':'Language';
    const discover=bar.querySelector('.globalDiscoverBtn');
    if(discover){
      discover.title=lang==='ja'?'公開作品を探す':'Explore published works';
      discover.setAttribute('aria-label',lang==='ja'?'Discoverを開く':'Open Discover');
    }
    const home=bar.querySelector('.globalHomeBtn');
    if(home){
      home.title=lang==='ja'?'ホームへ':'Home';
      home.setAttribute('aria-label',lang==='ja'?'ホームを開く':'Open Home');
    }
    bar.setAttribute('aria-label',lang==='ja'?'表示言語を切り替える':'Choose display language');
  }
  function set(next){
    const lang=normalize(next);
    if(lang===current()){paint();return;}
    localStorage.setItem(KEY,lang);
    localStorage.setItem(LEGACY,lang);
    if(landingLang()){
      // Selecting JA or EN on an intro page opens the corresponding real
      // localized page, not a reload of the previous language.
      location.assign(previewUrl(new URL('/'+lang+'/',location.origin).href));
      return;
    }
    // Once the visitor explicitly changes languages, it overrides an old
    // per-page ?lang=... parameter (My Page previously prioritized it).
    const u=new URL(location.href);
    if(u.searchParams.has('lang')){
      u.searchParams.delete('lang');
      history.replaceState(history.state,'',u.pathname+u.search+u.hash);
    }
    const announce=()=>window.dispatchEvent(new CustomEvent('statsmaker:site-languagechange',{detail:{locale:lang}}));
    if(window.SM_I18N?.setLanguage){window.SM_I18N.setLanguage(lang);paint();announce();return;}
    if(window.SM_APP_SET_LANGUAGE){window.SM_APP_SET_LANGUAGE(lang);paint();announce();return;}
    if(window.SM_LAUNCHER_SET_LANGUAGE){window.SM_LAUNCHER_SET_LANGUAGE(lang);paint();announce();return;}
    // Pages that render from a topic snapshot use a fresh read-only render.
    // No scoring or public-data writes happen on a display-language change.
    location.reload();
  }
  const homePath=()=>location.pathname.startsWith('/app/')?'../index.html?fresh=1':'index.html?fresh=1';
  function openHome(event){
    event.preventDefault();
    const frame=document.getElementById('basicFrame');
    const community=new URLSearchParams(location.search).has('community');
    if(frame&&!community){
      try{
        const nativeHome=frame.contentWindow?.document?.getElementById('editorHomeBtn');
        if(nativeHome){nativeHome.click();return;}
      }catch(error){console.warn('Embedded HOME unavailable',error);}
    }
    if(community&&!confirm(current()==='ja'
      ?'未投稿の評価は保存されません。ホームへ戻りますか？'
      :'Unsubmitted scores will not be saved. Return Home?'))return;
    location.assign(previewUrl(new URL(landingLang()?'/index.html?lang='+current():homePath(),location.href).href));
  }
  function mount(){
    if(document.querySelector('.globalLocaleBar'))return;
    if(landingLang()){
      try{
        localStorage.setItem(KEY,landingLang());
        localStorage.setItem(LEGACY,landingLang());
      }catch{}
    }
    document.body.classList.add('hasGlobalLocaleBar');
    bar=document.createElement('div');
    bar.className='globalLocaleBar';
    bar.setAttribute('role','group');
    bar.innerHTML='<nav class="globalNavLinks" aria-label="Site navigation"><a class="globalHomeBtn" href="index.html?fresh=1" aria-label="ホームを開く">HOME</a><a class="globalDiscoverBtn" href="discover.html" aria-label="Discoverを開く">Discover</a></nav><div class="globalLocaleControls"><span class="globalLocaleLabel">表示言語</span><div class="globalLocaleSwitch"><button type="button" data-global-lang="ja" aria-label="日本語">JA</button><button type="button" data-global-lang="en" aria-label="English">EN</button></div></div>';
    document.body.prepend(bar);
    bar.querySelector('.globalHomeBtn').href=previewUrl(new URL(landingLang()?'/index.html?lang='+current():homePath(),location.href).href);
    bar.querySelector('.globalDiscoverBtn').href=previewUrl(new URL(landingLang()?'/discover.html?lang='+current():(location.pathname.startsWith('/app/')?'../discover.html':'discover.html'),location.href).href);
    bar.querySelector('.globalHomeBtn').addEventListener('click',openHome);
    bar.querySelectorAll('[data-global-lang]').forEach(btn=>btn.addEventListener('click',()=>set(btn.dataset.globalLang)));
    paint();
  }
  window.SM_SITE_LANGUAGE={get:current,set,paint};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  window.addEventListener('pageshow',paint);
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===LEGACY)paint();});
})();