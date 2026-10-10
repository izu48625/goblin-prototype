(() => {
  'use strict';
  const KEY='statsMaker.locale', LEGACY='statsMakerV2Language';
  const normalize=value=>String(value||'').toLowerCase().startsWith('en')?'en':'ja';
  const current=()=>normalize(localStorage.getItem(KEY)||localStorage.getItem(LEGACY)||navigator.language||'ja');
  const isEmbeddedBase=/\/base\/index\.html$/.test(location.pathname)&&window.parent!==window;
  if(isEmbeddedBase)return; // The parent Home has the shared bar above its iframe.
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
    bar.setAttribute('aria-label',lang==='ja'?'表示言語を切り替える':'Choose display language');
  }
  function set(next){
    const lang=normalize(next);
    if(lang===current()){paint();return;}
    localStorage.setItem(KEY,lang);
    localStorage.setItem(LEGACY,lang);
    if(window.SM_I18N?.setLanguage){window.SM_I18N.setLanguage(lang);paint();return;}
    if(window.SM_APP_SET_LANGUAGE){window.SM_APP_SET_LANGUAGE(lang);paint();return;}
    if(window.SM_LAUNCHER_SET_LANGUAGE){window.SM_LAUNCHER_SET_LANGUAGE(lang);paint();return;}
    // Pages that render from a topic snapshot use a fresh read-only render.
    // No scoring or public-data writes happen on a display-language change.
    location.reload();
  }
  function mount(){
    if(document.querySelector('.globalLocaleBar'))return;
    document.body.classList.add('hasGlobalLocaleBar');
    bar=document.createElement('div');
    bar.className='globalLocaleBar';
    bar.setAttribute('role','group');
    bar.innerHTML='<span class="globalLocaleLabel">表示言語</span><div class="globalLocaleSwitch"><button type="button" data-global-lang="ja" aria-label="日本語">JA</button><button type="button" data-global-lang="en" aria-label="English">EN</button></div>';
    document.body.prepend(bar);
    bar.querySelectorAll('[data-global-lang]').forEach(btn=>btn.addEventListener('click',()=>set(btn.dataset.globalLang)));
    paint();
  }
  window.SM_SITE_LANGUAGE={get:current,set,paint};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
  window.addEventListener('pageshow',paint);
  window.addEventListener('storage',event=>{if(event.key===KEY||event.key===LEGACY)paint();});
})();