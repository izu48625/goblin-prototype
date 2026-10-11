(() => {
  'use strict';
  /* R31 planning only:
   * No AdSense account, advertiser script, tracking, impression or cookie.
   * ?adPreview=1 opts into a visual layout demo. No normal visitor sees it.
   * Never put an ad inside a chart canvas, screenshot/export, editable table,
   * Community submit controls, or the iPhone Safari bottom toolbar.
   */
  function requestedPreview(){
    try{
      if(new URLSearchParams(location.search).get('adPreview')==='1')return true;
      // Home uses a same-origin frame: inherit the opt-in query without
      // adding any visible controls or changing frame URLs.
      return window.parent!==window&&
        new URLSearchParams(window.parent.location.search).get('adPreview')==='1';
    }catch{return false}
  }
  if(!requestedPreview())return;

  const path=location.pathname.replace(/\/+$/,'');
  const inCommunity=(window.parent!==window
    ?(()=>{
      try{return new URLSearchParams(window.parent.location.search).has('community')}
      catch{return false}
    })()
    :new URLSearchParams(location.search).has('community'));

  const zones=path.endsWith('/discover.html')?[
      ['.controls','afterend','discover-primary','Discover · 作品一覧前のインライン枠'],
      ['#grid','afterend','discover-secondary','Discover · 作品一覧後のインライン枠']
    ]:path.endsWith('/public.html')?[
      ['.top','afterend','public-primary','公開作品 · 概要前のインライン枠'],
      ['#content','afterend','public-secondary','公開作品 · 評価・ランキング後のインライン枠']
    ]:path.endsWith('/my.html')?[
      ['.summaryGrid','afterend','works-inline','公開作品の管理 · 一覧前のインライン枠']
    ]:path.endsWith('/rate.html')?[
      ['#content','afterend','rate-inline','旧Community画面 · 採点エリアの後']
    ]:path.endsWith('/app/editor.html')?[
      ['#panelContent','afterend','editor-sidebar','グラフ編集 · PCサイドパネル下部'],
      ['#mobilePanelContent','afterend','editor-mobile','グラフ編集 · モバイル詳細パネル末尾']
    ]:(path.endsWith('/base/index.html')||path.endsWith('/base'))?[
      [inCommunity?'main.app':'header.topbar',inCommunity?'beforeend':'afterend','home-inline',inCommunity
        ?'Community · 採点表の後のインライン枠'
        :'Home · メイン操作直下のインライン枠']
    ]:[];
  function mount(){
    for(const [selector,position,id,label] of zones){
      const target=document.querySelector(selector);
      if(!target||document.querySelector('[data-sm-slot="'+id+'"]'))continue;
      const box=document.createElement('aside');
      box.className='sm-ad-preview';
      box.dataset.smSlot=id;
      box.setAttribute('aria-label','広告配置プレビュー');
      box.innerHTML='<strong></strong><small>本番では広告非表示 · 広告審査後に別途配信</small>';
      box.querySelector('strong').textContent=label;
      target.insertAdjacentElement(position,box);
    }
    document.documentElement.dataset.smAdPreview='true';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
