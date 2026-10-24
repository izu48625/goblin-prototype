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
  const legalLang=()=>['en','ja'].includes(document.body?.dataset.smLegalPage)
    ?document.body.dataset.smLegalPage:'';
  const current=()=>landingLang()||legalLang()||normalize(localStorage.getItem(KEY)||localStorage.getItem(LEGACY)||navigator.language||'ja');
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
    const intro=bar.querySelector('.globalIntroBtn');
    if(intro){
      intro.textContent=lang==='ja'?'紹介':'About';
      intro.title=lang==='ja'?'STATS MAKERの紹介ページ':'About Stats Maker';
      intro.setAttribute('aria-label',intro.title);
      intro.href=previewUrl(new URL('/'+lang+'/',location.origin).href);
    }
    const home=bar.querySelector('.globalHomeBtn');
    if(home){
      home.title=lang==='ja'?'ホームへ':'Home';
      home.setAttribute('aria-label',lang==='ja'?'ホームを開く':'Open Home');
    }
    const help=bar.querySelector('.globalSupportMenu');
    if(help){
      const summary=help.querySelector('summary');
      summary.textContent=lang==='ja'?'ヘルプ':'Help';
      summary.title=lang==='ja'?'グラフの作り方・PNG保存・利用規約など':'Chart guides, PNG export, terms and contact';
      help.setAttribute('aria-label',lang==='ja'?'サポートメニュー':'Support menu');
      const guides={chart:['グラフの作り方・能力比較','Charts & comparisons'],png:['PNG保存・共有','Save & share PNG'],examples:['完成グラフの作例','Finished chart examples']};
      for(const link of help.querySelectorAll('[data-global-guide]')){
        const kind=link.dataset.globalGuide;
        link.textContent=guides[kind][lang==='ja'?0:1];
        link.href=previewUrl(new URL('/'+lang+'/'+(kind==='chart'?'chart-guide.html':kind==='png'?'png-guide.html':'examples.html'),location.origin).href);
      }
      const items={terms:['利用規約','Terms'],privacy:['プライバシー','Privacy'],contact:['お問い合わせ','Contact']};
      for(const link of help.querySelectorAll('[data-global-support]')){
        const section=link.dataset.globalSupport;
        link.textContent=items[section][lang==='ja'?0:1];
        link.href=previewUrl(new URL('/'+lang+'/legal.html#'+section,location.origin).href);
      }
    }
    bar.setAttribute('aria-label',lang==='ja'?'表示言語を切り替える':'Choose display language');
    document.querySelectorAll('[data-sm-legal-link]').forEach(link=>{
      const section=link.dataset.smLegalLink;
      const labels={terms:['利用規約','Terms'],privacy:['プライバシー','Privacy'],contact:['問い合わせ','Contact']};
      if(!labels[section])return;
      link.textContent=labels[section][lang==='ja'?0:1];
      link.href='/'+lang+'/legal.html#'+section;
    });
  }
  function set(next){
    const lang=normalize(next);
    if(lang===current()){paint();return;}
    localStorage.setItem(KEY,lang);
    localStorage.setItem(LEGACY,lang);
    if(legalLang()){
      location.assign(previewUrl(new URL('/'+lang+'/legal.html'+location.hash,location.origin).href));
      return;
    }
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
  const homePath=()=>legalLang()?'/index.html?fresh=1':(location.pathname.startsWith('/app/')?'../index.html?fresh=1':'index.html?fresh=1');
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
    if(landingLang()||legalLang()){
      try{
        localStorage.setItem(KEY,landingLang()||legalLang());
        localStorage.setItem(LEGACY,landingLang()||legalLang());
      }catch{}
    }
    document.body.classList.add('hasGlobalLocaleBar');
    bar=document.createElement('div');
    bar.className='globalLocaleBar';
    bar.setAttribute('role','group');
    bar.innerHTML='<nav class="globalNavLinks" aria-label="Site navigation"><a class="globalHomeBtn" href="index.html?fresh=1" aria-label="ホームを開く">HOME</a><a class="globalDiscoverBtn" href="discover.html" aria-label="Discoverを開く">Discover</a><a class="globalIntroBtn" href="/ja/" aria-label="STATS MAKERの紹介ページ">紹介</a><details class="globalSupportMenu"><summary>ヘルプ</summary><div class="globalSupportPanel"><a data-global-guide="chart" href="/ja/chart-guide.html">グラフの作り方・能力比較</a><a data-global-guide="png" href="/ja/png-guide.html">PNG保存・共有</a><a data-global-guide="examples" href="/ja/examples.html">完成グラフの作例</a><div class="globalSupportDivider" aria-hidden="true"></div><a data-global-support="terms" href="/ja/legal.html#terms">利用規約</a><a data-global-support="privacy" href="/ja/legal.html#privacy">プライバシー</a><a data-global-support="contact" href="/ja/legal.html#contact">お問い合わせ</a></div></details></nav><div class="globalLocaleControls"><span class="globalLocaleLabel">表示言語</span><div class="globalLocaleSwitch"><button type="button" data-global-lang="ja" aria-label="日本語">JA</button><button type="button" data-global-lang="en" aria-label="English">EN</button></div></div>';
    document.body.prepend(bar);
    bar.querySelector('.globalHomeBtn').href=previewUrl(new URL(landingLang()?'/index.html?lang='+current():homePath(),location.href).href);
    bar.querySelector('.globalDiscoverBtn').href=previewUrl(new URL(landingLang()?'/discover.html?lang='+current():(legalLang()?'/discover.html':(location.pathname.startsWith('/app/')?'../discover.html':'discover.html')),location.href).href);
    // Preserve a compact navigation bar on iPhone; close the dropdown on
    // outside click or Escape, rather than adding another wide fixed tab.
    document.addEventListener('click',event=>{
      const open=bar?.querySelector('.globalSupportMenu[open]');
      if(open&&!open.contains(event.target))open.removeAttribute('open');
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape')bar?.querySelector('.globalSupportMenu[open]')?.removeAttribute('open');
    });
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