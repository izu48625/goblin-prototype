(() => {
  'use strict';
  const KEY='statsMaker.locale', LEGACY='statsMakerV2Language';
  const normalize=value=>String(value||'').toLowerCase().startsWith('ja')?'ja':'en';
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
  // Article language is authoritative, just like /ja/ and /en/ introductions.
  // The original article text must not silently flip language in-place.
  const readingLang=()=>['en','ja'].includes(document.body?.dataset.smReadingPage)
    ?document.body.dataset.smReadingPage:'';
  const articleName=()=>{
    const name=location.pathname.split('/').pop();
    return ['chart-guide.html','png-guide.html','examples.html','scoring-guide.html','use-cases.html'].includes(name)?name:null;
  };
  const current=()=>landingLang()||legalLang()||readingLang()||normalize(localStorage.getItem(KEY)||localStorage.getItem(LEGACY)||navigator.language||'ja');

  /* R81: local preference only; no account, cookie, analytics or network calls.
     Shared by Home iframe, extensions, Discover and guides. */
  const THEME_KEY='statsMaker.uiTheme';
  const themeRead=()=>{try{return localStorage.getItem(THEME_KEY)==='dark'?'dark':'light'}catch{return 'light'}};
  const themeCurrent=()=>document.documentElement.dataset.smTheme==='dark'?'dark':'light';
  const themeButtons=()=>{
    const dark=themeCurrent()==='dark';
    const en=current()==='en';
    document.querySelectorAll('[data-sm-theme-toggle]').forEach(b=>{
      b.setAttribute('aria-pressed',String(dark));
      b.setAttribute('aria-label',dark?(en?'Switch to light mode':'ライトモードに切替'):(en?'Switch to dark mode':'ダークモードに切替'));
      b.title=b.getAttribute('aria-label');
      b.textContent=b.dataset.smThemeToggle==='icon'?(dark?'☼':'☾')
        :dark?(en?'☼ Light mode':'☼ ライトモード'):en?'☾ Dark mode':'☾ ダークモード';
    });
  };
  const themeApply=(value,persist=false)=>{
    const mode=value==='dark'?'dark':'light';
    if(persist){try{localStorage.setItem(THEME_KEY,mode)}catch{}}
    document.documentElement.dataset.smTheme=mode;
    themeButtons();
    window.dispatchEvent(new CustomEvent('statsmaker:themechange',{detail:{theme:mode}}));
  };
  window.SM_THEME={
    get:themeCurrent,
    set:mode=>themeApply(mode,true),
    toggle:()=>themeApply(themeCurrent()==='dark'?'light':'dark',true)
  };
  themeApply(themeRead());
  if(!document.querySelector('link[data-sm-theme-style]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='/cloud/r81-theme.css?v=r81p1';
    link.dataset.smThemeStyle='r81';
    document.head.appendChild(link);
  }
  /* Load R82 AFTER the original theme layer; keeps the light design and all
     saved chart artwork untouched while repairing the night-mode score grid. */
  if(!document.querySelector('link[data-sm-theme-harmony]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='/cloud/r82-dark-harmony.css?v=r82p1';
    link.dataset.smThemeHarmony='r82';
    document.head.appendChild(link);
  }
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-sm-theme-toggle]');
    if(button){event.preventDefault();window.SM_THEME.toggle();}
  });
  window.addEventListener('storage',event=>{
    if(event.key===THEME_KEY)themeApply(themeRead());
  });

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
    // The first-party worked examples are reachable in one tap from every screen.
    // Reuse the former About slot to keep iPhone header width unchanged.
    const examples=bar.querySelector('.globalExamplesBtn');
    if(examples){
      examples.textContent=lang==='ja'?'作例':'Demos';
      examples.title=lang==='ja'?'作例集（グラフ8種類）を見る':'View eight real chart examples';
      examples.setAttribute('aria-label',examples.title);
      examples.href=previewUrl(new URL('/'+lang+'/use-cases.html',location.origin).href);
    }
    const home=bar.querySelector('.globalHomeBtn');
    if(home){
      home.title=lang==='ja'?'ホームへ':'Home';
      home.setAttribute('aria-label',lang==='ja'?'ホームを開く':'Open Home');
    }
    const introLink=bar.querySelector('[data-global-intro]');
    if(introLink){
      introLink.textContent=lang==='ja'?'ホーム案内を再表示':'Show Home introduction';
      introLink.href='/index.html?intro=1';
    }
    const help=bar.querySelector('.globalSupportMenu');
    if(help){
      const summary=help.querySelector('summary');
      summary.textContent=lang==='ja'?'ヘルプ':'Help';
      summary.title=lang==='ja'?'グラフの作り方・PNG保存・利用規約など':'Chart guides, PNG export, terms and contact';
      help.setAttribute('aria-label',lang==='ja'?'サポートメニュー':'Support menu');
      const guides={chart:['比較グラフの作り方','Charts & comparisons'],png:['PNG保存・共有','Save & share PNG'],examples:['完成グラフの作例','Finished chart examples'],scoring:['採点と重み付け','Fair ratings and weights'],usecases:['5つの実践作例','Five practical use cases']};
      // Owner-only My Works is reached from the shared Help menu without
      // widening the 320px iPhone navigation or exposing private work data.
      const myWorks=help.querySelector('[data-global-myworks]');
      if(myWorks){
        myWorks.textContent=lang==='ja'?'自分の作品を管理':'My Works';
        myWorks.href=previewUrl(new URL('/my.html?lang='+lang,location.origin).href);
      }
      const about=help.querySelector('[data-global-about]');
      if(about){
        about.textContent=lang==='ja'?'サービス紹介':'About Stats Maker';
        about.href=previewUrl(new URL('/'+lang+'/',location.origin).href);
      }
      for(const link of help.querySelectorAll('[data-global-guide]')){
        const kind=link.dataset.globalGuide;
        link.textContent=guides[kind][lang==='ja'?0:1];
        link.href=previewUrl(new URL('/'+lang+'/'+(kind==='chart'?'chart-guide.html':kind==='png'?'png-guide.html':kind==='scoring'?'scoring-guide.html':kind==='usecases'?'use-cases.html':'examples.html'),location.origin).href);
      }
      const items={terms:['利用規約','Terms'],privacy:['プライバシー','Privacy'],contact:['お問い合わせ','Contact']};
      for(const link of help.querySelectorAll('[data-global-support]')){
        const section=link.dataset.globalSupport;
        link.textContent=items[section][lang==='ja'?0:1];
        link.href=previewUrl(new URL('/'+lang+'/legal.html#'+section,location.origin).href);
      }
    }
    themeButtons();
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
    if(readingLang()&&articleName()){
      // Switch to the exact JA/EN counterpart of the current guide/example.
      // Keep in-page anchors; never convert an article into a mismatched language.
      location.assign(previewUrl(new URL('/'+lang+'/'+articleName()+location.hash,location.origin).href));
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
  const homePath=()=>legalLang()||readingLang()?'/index.html?lang='+current():(location.pathname.startsWith('/app/')?'../index.html?fresh=1':'index.html?fresh=1');
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
  document.addEventListener('click',event=>{
    const link=event.target?.closest?.('[data-global-intro]');
    if(!link)return;
    if(document.getElementById('r89HomeIntro')&&!document.body.classList.contains('communityShell')){
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('statsmaker:home-intro-show'));
      link.closest('details')?.removeAttribute('open');
    }
  });
  function mount(){
    if(document.querySelector('.globalLocaleBar'))return;
    if(landingLang()||legalLang()||readingLang()){
      try{
        localStorage.setItem(KEY,landingLang()||legalLang()||readingLang());
        localStorage.setItem(LEGACY,landingLang()||legalLang()||readingLang());
      }catch{}
    }
    document.body.classList.add('hasGlobalLocaleBar');
    bar=document.createElement('div');
    bar.className='globalLocaleBar';
    bar.setAttribute('role','group');
    bar.innerHTML='<nav class="globalNavLinks" aria-label="Site navigation"><a class="globalHomeBtn" href="index.html?fresh=1" aria-label="ホームを開く">HOME</a><a class="globalDiscoverBtn" href="discover.html" aria-label="Discoverを開く">Discover</a><a class="globalIntroBtn globalExamplesBtn" href="/ja/use-cases.html" aria-label="作例集（グラフ8種類）を見る">作例</a><details class="globalSupportMenu"><summary>ヘルプ</summary><div class="globalSupportPanel"><a data-global-myworks href="/my.html?lang=ja">自分の作品を管理</a><a data-global-about href="/ja/">サービス紹介</a><a data-global-guide="chart" href="/ja/chart-guide.html">グラフの作り方・能力比較</a><a data-global-guide="png" href="/ja/png-guide.html">PNG保存・共有</a><a data-global-guide="scoring" href="/ja/scoring-guide.html">公平な採点と重み付け</a><div class="globalSupportDivider" aria-hidden="true"></div><a data-global-support="terms" href="/ja/legal.html#terms">利用規約</a><a data-global-support="privacy" href="/ja/legal.html#privacy">プライバシー</a><a data-global-support="contact" href="/ja/legal.html#contact">お問い合わせ</a><button type="button" class="r81-help-theme" data-sm-theme-toggle="menu" aria-pressed="false">☾ ダークモード</button></div></details></nav><div class="globalLocaleControls"><span class="globalLocaleLabel">表示言語</span><div class="globalLocaleSwitch"><button type="button" data-global-lang="ja" aria-label="日本語">JA</button><button type="button" data-global-lang="en" aria-label="English">EN</button></div></div>';
    document.body.prepend(bar);
    bar.querySelector('.globalHomeBtn').href=previewUrl(new URL(landingLang()?'/index.html?lang='+current():homePath(),location.href).href);
    bar.querySelector('.globalDiscoverBtn').href=previewUrl(new URL((landingLang()||legalLang()||readingLang())?'/discover.html?lang='+current():(legalLang()?'/discover.html':(location.pathname.startsWith('/app/')?'../discover.html':'discover.html')),location.href).href);
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