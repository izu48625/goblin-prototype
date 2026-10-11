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

  // Workers Static Assets may rewrite /discover.html to /discover and
  // similar extensionless routes. Never depend on the public URL spelling.
  // Each page declares its layout identity in a static <body> data attribute.
  const rawPath=location.pathname.replace(/\\/+$/,'');
  const routeName=rawPath.split('/').pop()?.replace(/\\.html$/i,'')||'';
  const page=document.body?.dataset.smAdPage
    ||({discover:'discover',public:'public',my:'works',rate:'rate',editor:'editor',
         base:'home'}[routeName]||'');
  const inCommunity=window.parent!==window
    ?(()=>{try{return new URLSearchParams(window.parent.location.search).has('community')}catch{return false}})()
    :new URLSearchParams(location.search).has('community');

  const zones=page==='discover'?[
      ['.browseTabs','afterend','discover-primary','Discover · 作品一覧前の広告候補'],
      ['#grid','afterend','discover-secondary','Discover · 作品一覧後の広告候補']
    ]:page==='public'?[
      ['.top','afterend','public-primary','公開作品 · 作品概要の前'],
      ['#content','afterend','public-secondary','公開作品 · 評価とランキングの後']
    ]:page==='works'?[
      ['.hero','afterend','works-inline','自分の公開作品 · 一覧前']
    ]:page==='rate'?[
      ['.top','afterend','rate-inline','Community · 採点内容の前']
    ]:page==='editor'?[
      ['.editor-header','afterend','editor-top','グラフ編集 · 広告候補位置（確認用）'],
      ['#panelContent','afterend','editor-sidebar','グラフ編集 · PC設定パネル末尾'],
      ['#mobilePanelContent','afterend','editor-mobile','グラフ編集 · モバイル設定パネル末尾']
    ]:page==='home'?[
      ['header.topbar','afterend','home-inline',inCommunity
        ?'Community · 採点操作の前の広告候補'
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
