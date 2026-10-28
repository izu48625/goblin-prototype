/* R81: scoring-first menus without hiding essential actions. Original actions
 * are called through app.js and continue to persist/grade as before. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const menuBtn=$('mobileHeaderMoreBtn'),menu=$('mobileHeaderMoreMenu');
  const optionsBtn=$('r80OptionsBtn'),options=$('r80OptionsPanel');
  const filter=$('filterBar'),search=$('searchInput');
  const searchAction=$('r81SearchAction');
  const isEnglish=()=>String(window.SM_I18N?.getLanguage?.()||document.documentElement.lang||'ja').startsWith('en');
  const closeOptions=()=>{
    options.classList.add('hidden');
    optionsBtn.setAttribute('aria-expanded','false');
  };
  const closeActions=()=>{
    menu?.classList.add('hidden');
    menuBtn?.setAttribute('aria-expanded','false');
  };
  const setSearchVisible=show=>{
    filter.classList.toggle('r80-search-open',show);
    searchAction.setAttribute('aria-expanded',String(show));
    $('r81SearchStatus').textContent=show?(isEnglish()?'Shown':'表示中'):(isEnglish()?'Open ›':'開く ›');
    if(show)search.focus();
  };
  const closeSearch=({clear=false}={})=>{
    if(clear&&search.value){
      search.value='';
      search.dispatchEvent(new Event('input',{bubbles:true}));
    }
    /* Keep a nonempty active filter visible until the user clears it. */
    if(!search.value)setSearchVisible(false);
  };
  const updateScale=()=>{
    $('r80ScaleStatus').textContent=$('currentScaleBadge')?.textContent||'100点満点';
  };
  const updateColor=()=>{
    const on=$('scoreColorToggleBtn')?.getAttribute('aria-pressed')!=='false';
    $('r81ColorStatus').textContent=on?'ON':'OFF';
    $('r81ColorStatus').setAttribute('aria-label',on?'ON':'OFF');
    $('r80ColorAction').setAttribute('aria-pressed',String(on));
  };
  const updateLabels=()=>{
    const en=isEnglish();
    menuBtn.setAttribute('aria-label',en?'Other sheet actions':'シートのその他の操作');
    menuBtn.textContent='⋯';
    optionsBtn.textContent=en?'Settings':'設定';
    $('r80VisualsBtn').textContent=en?'Data & Charts':'データやグラフ';
    $('r80VisualsBtn').setAttribute('aria-label',en?'Open Data & Charts':'データやグラフを開く');
    $('r81OptionsTitle').textContent=en?'View & score settings':'表示・採点の設定';
    $('r81OptionsClose').textContent=en?'Close ×':'閉じる ×';
    $('r81OptionsClose').setAttribute('aria-label',en?'Close settings':'設定を閉じる');
    $('r80ScaleAction').querySelector('.r81-option-title').textContent=en?'Score scale':'点数の設定';
    $('r80ColorAction').querySelector('.r81-option-title').textContent=en?'Score cell colors':'採点セルの色';
    searchAction.querySelector('.r81-option-title').textContent=en?'Search subjects':'対象を検索';
    $('r80MoreAction').querySelector('.r81-option-title').textContent=en?'More tools':'その他の機能';
    $('r80MoreAction').querySelector('.r81-option-value').textContent=en?'Backup, export ›':'バックアップ・画像出力 ›';
    $('r81SearchClose').textContent=en?'Close ×':'閉じる ×';
    $('r81SearchStatus').textContent=filter.classList.contains('r80-search-open')?(en?'Shown':'表示中'):(en?'Open ›':'開く ›');
    updateScale();updateColor();
  };
  optionsBtn.addEventListener('click',()=>{
    const opening=options.classList.contains('hidden');
    options.classList.toggle('hidden',!opening);
    optionsBtn.setAttribute('aria-expanded',String(opening));
    if(opening)closeSearch();
  });
  $('r81OptionsClose').addEventListener('click',closeOptions);
  $('r80ScaleAction').addEventListener('click',()=>{
    closeOptions();$('scoreSettingsBtn')?.click();
  });
  $('r80ColorAction').addEventListener('click',()=>{
    $('scoreColorToggleBtn')?.click();updateColor();
  });
  searchAction.addEventListener('click',()=>{
    const opening=!filter.classList.contains('r80-search-open');
    closeOptions();
    if(opening)setSearchVisible(true);
    else closeSearch({clear:true});
  });
  $('r81SearchClose').addEventListener('click',()=>closeSearch({clear:true}));
  $('r80MoreAction').addEventListener('click',()=>{
    closeOptions();$('moreToolsBtn')?.click();
  });
  $('r80VisualsBtn').addEventListener('click',()=>{
    try{window.parent.postMessage({type:'statsmaker:open-extensions'},location.origin)}catch{}
  });
  document.addEventListener('click',e=>{
    if(!e.isTrusted)return;
    if(!options.contains(e.target)&&e.target!==optionsBtn)closeOptions();
    if(!menu?.contains(e.target)&&e.target!==menuBtn)closeActions();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeOptions();closeActions();if(!search.value)closeSearch();}
  });
  const scale=$('currentScaleBadge'),color=$('scoreColorToggleBtn');
  if(scale&&typeof MutationObserver!=='undefined')
    new MutationObserver(updateScale).observe(scale,{childList:true,subtree:true,characterData:true});
  if(color&&typeof MutationObserver!=='undefined')
    new MutationObserver(updateColor).observe(color,{attributes:true,attributeFilter:['aria-pressed']});
  if(search.value)setSearchVisible(true);
  window.addEventListener('statsmaker:languagechange',updateLabels);
  updateLabels();
})();
