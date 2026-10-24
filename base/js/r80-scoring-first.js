/* R80 — mobile-only scoring-first progressive disclosure.
 * All existing actions remain in app.js; call their established click handlers.
 * No saves, sorting, score colors, grades or visibility privacy logic here. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const actionBtn=$('mobileHeaderMoreBtn'), actionMenu=$('mobileHeaderMoreMenu');
  const searchBtn=$('r80SearchBtn'),searchBar=$('filterBar');
  const optionsBtn=$('r80OptionsBtn'),optionsPanel=$('r80OptionsPanel');
  const lang=()=>window.SM_I18N?.getLanguage?.()||document.documentElement.lang||'ja';
  const isEnglish=()=>String(lang()).toLowerCase().startsWith('en');
  const closeOptions=()=>{
    optionsPanel.classList.add('hidden');
    optionsBtn.setAttribute('aria-expanded','false');
  };
  const closeSearch=()=>{
    searchBar.classList.remove('r80-search-open');
    searchBtn.setAttribute('aria-expanded','false');
  };
  const closeActionMenu=()=>{
    actionMenu?.classList.add('hidden');
    actionBtn?.setAttribute('aria-expanded','false');
  };
  const updateScaleStatus=()=>{
    const label=$('currentScaleBadge')?.textContent||'100点満点';
    $('r80ScaleStatus').textContent=label;
  };
  const updateColorStatus=()=>{
    const enabled=$('scoreColorToggleBtn')?.getAttribute('aria-pressed')!=='false';
    $('r80ColorAction').textContent=(isEnglish()?'Score colors: ':'採点の色：')+(enabled?'ON':'OFF');
    $('r80ColorAction').setAttribute('aria-pressed',String(enabled));
  };
  const updateLabels=()=>{
    actionBtn?.setAttribute('aria-label',isEnglish()?'Actions menu':'操作メニュー');
    actionBtn.textContent=isEnglish()?'Actions ⋯':'操作 ⋯';
    searchBtn.setAttribute('aria-label',isEnglish()?'Search subjects':'対象を検索');
    optionsBtn.textContent=isEnglish()?'Settings':'設定';
    $('r80VisualsBtn').textContent=isEnglish()?'+ Visuals':'＋ 拡張';
    $('r80ScaleAction').firstChild.textContent=isEnglish()?'Scoring settings ':'採点設定 ';
    $('r80MoreAction').textContent=isEnglish()?'Other tools':'その他の操作';
    updateScaleStatus();updateColorStatus();
  };
  $('r80PublishAction').addEventListener('click',()=>{
    closeActionMenu();$('publishBtn')?.click();
  });
  $('r80NewAction').addEventListener('click',()=>{
    closeActionMenu();$('newSheetBtn')?.click();
  });
  searchBtn.addEventListener('click',()=>{
    const opening=!searchBar.classList.contains('r80-search-open');
    if(opening){searchBar.classList.add('r80-search-open');searchBtn.setAttribute('aria-expanded','true');closeOptions();$('searchInput')?.focus();}
    else{closeSearch();}
  });
  optionsBtn.addEventListener('click',()=>{
    const opening=optionsPanel.classList.contains('hidden');
    optionsPanel.classList.toggle('hidden',!opening);
    optionsBtn.setAttribute('aria-expanded',String(opening));
    if(opening)closeSearch();
  });
  $('r80ScaleAction').addEventListener('click',()=>{
    closeOptions();$('scoreSettingsBtn')?.click();
  });
  $('r80ColorAction').addEventListener('click',()=>{
    $('scoreColorToggleBtn')?.click();updateColorStatus();
  });
  $('r80MoreAction').addEventListener('click',()=>{
    closeOptions();$('moreToolsBtn')?.click();
  });
  $('r80VisualsBtn').addEventListener('click',()=>{
    try{window.parent.postMessage({type:'statsmaker:open-extensions'},location.origin)}catch{}
  });
  document.addEventListener('click',e=>{
    /* Proxy clicks on the original hidden Color button are synthetic: keep
       this settings panel open after toggling the preference. */
    if(!e.isTrusted)return;
    if(!optionsPanel.contains(e.target)&&e.target!==optionsBtn)closeOptions();
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      closeOptions();closeActionMenu();
      if(!$('searchInput')?.value)closeSearch();
    }
  });
  const scale=$('currentScaleBadge');
  if(scale&&typeof MutationObserver!=='undefined'){
    new MutationObserver(updateScaleStatus).observe(scale,{childList:true,subtree:true,characterData:true});
  }
  const col=$('scoreColorToggleBtn');
  if(col&&typeof MutationObserver!=='undefined'){
    new MutationObserver(updateColorStatus).observe(col,{attributes:true,attributeFilter:['aria-pressed']});
  }
  if($('searchInput')?.value){searchBar.classList.add('r80-search-open');searchBtn.setAttribute('aria-expanded','true');}
  window.addEventListener('statsmaker:languagechange',updateLabels);
  updateLabels();
})();
