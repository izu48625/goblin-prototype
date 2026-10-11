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
  const rawPath=location.pathname.replace(/\/+$/,'');
  const routeName=rawPath.split('/').pop()?.replace(/\.html$/i,'')||'';
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
  // R32 candidate placements: visible ONLY to the developer in explicit
  // adPreview mode. This is not Google AdSense or a live ad implementation.
  // Never add these to exported image/canvas, form controls or real customers.
  function slot(id,label){
    if(document.querySelector('[data-sm-slot="'+id+'"]'))return null;
    const el=document.createElement('aside');
    el.className='sm-ad-preview';
    el.dataset.smSlot=id;
    el.setAttribute('aria-label','広告位置プレビュー：'+label);
    const title=document.createElement('strong');
    title.textContent=label;
    const note=document.createElement('small');
    note.textContent='配置確認用 · 広告未配信';
    el.append(title,note);
    return el;
  }
  function add(target,pos,id,label){
    if(!target)return null;
    const el=slot(id,label);
    if(!el)return document.querySelector('[data-sm-slot="'+id+'"]');
    target.insertAdjacentElement(pos,el);
    return el;
  }
  function desktopRail(){
    if(!['home','discover','public'].includes(page))return;
    const id=inCommunity?'community-desktop-rail':page+'-desktop-rail';
    add(document.body,'beforeend',id,
      inCommunity?'Community · PC右サイド':
      page==='home'?'Home · PC右サイド':
      page==='discover'?'Discover · PC右サイド':'公開作品 · PC右サイド');
  }
  function browseAnchor(){
    if(!['discover','public'].includes(page))return;
    const el=add(document.body,'beforeend',page+'-anchor',
      page==='discover'?'Discover · 閉じられるアンカー広告':'公開作品 · 閉じられるアンカー広告');
    if(!el||el.querySelector('button'))return;
    const close=document.createElement('button');
    close.type='button';
    close.className='sm-ad-preview-close';
    close.textContent='×';
    close.setAttribute('aria-label','広告配置プレビューを閉じる');
    close.addEventListener('click',()=>el.remove());
    el.appendChild(close);
  }
  function discoverInfeed(){
    const grid=document.getElementById('grid');
    if(!grid)return;
    const refresh=()=>{
      const cards=Array.from(grid.querySelectorAll(':scope > .workCard'));
      // Small listings should not be crowded with filler ad slots.
      if(cards.length<3)return;
      const after=cards[Math.min(6,cards.length)-1];
      if(!grid.querySelector('[data-sm-slot="discover-infeed"]'))
        add(after,'afterend','discover-infeed','Discover · 作品カード間の広告候補');
    };
    refresh();
    const observer=new MutationObserver(refresh);
    observer.observe(grid,{childList:true});
  }
  function publicSections(){
    const content=document.getElementById('content');
    if(!content)return;
    const refresh=()=>{
      const community=document.getElementById('communitySection');
      if(community)
        add(community,'beforebegin','public-between-rankings',
          '公開作品 · 作成者ランキングとCommunityの間');
      const shareDialog=document.querySelector('#shareImageBackdrop .shareImageDialog');
      if(shareDialog){
        const buttons=shareDialog.querySelector('.shareImageCreateBtn');
        if(buttons)
          add(buttons,'beforebegin','public-share',
            '公開作品 · 画像で共有する前の広告候補');
      }
    };
    refresh();
    const observer=new MutationObserver(refresh);
    observer.observe(content,{childList:true,subtree:false});
  }
  function editorShare(){
    const modal=document.getElementById('exportPreviewModal');
    const row=modal?.querySelector('.export-preview-actions');
    if(row)add(row,'beforebegin','editor-share','グラフ完成後 · 共有・保存前の広告候補');
  }
  function previewFullscreenCandidate(){
    if(!['discover','public'].includes(page))return;
    // Fullscreen ads are intentionally NOT displayed on navigation.
    // An explicit developer-only button lets us inspect the concept.
    const launcher=document.createElement('button');
    launcher.className='sm-ad-fullscreen-launch';
    launcher.type='button';
    launcher.textContent='全画面広告の候補を確認';
    launcher.addEventListener('click',()=>{
      if(document.getElementById('sm-ad-fullscreen-demo'))return;
      const dialog=document.createElement('div');
      dialog.id='sm-ad-fullscreen-demo';
      dialog.className='sm-ad-fullscreen-demo';
      dialog.setAttribute('role','dialog');
      dialog.setAttribute('aria-label','全画面広告の配置案');
      const example=slot('fullscreen-demo','ページ移動時の全画面広告 · プレビューのみ');
      const dismiss=document.createElement('button');
      dismiss.textContent='閉じて戻る';
      dismiss.type='button';
      dismiss.className='sm-ad-demo-dismiss';
      dismiss.addEventListener('click',()=>{dialog.remove();launcher.focus()});
      example.appendChild(dismiss);
      dialog.appendChild(example);
      document.body.appendChild(dialog);
      dismiss.focus();
    });
    const footer=document.querySelector('footer');
    (footer||document.body).appendChild(launcher);
  }
  function mountAdditional(){
    desktopRail();
    browseAnchor();
    if(page==='discover')discoverInfeed();
    if(page==='public')publicSections();
    if(page==='editor')editorShare();
    previewFullscreenCandidate();
  }
  function mountAll(){
    mount();
    mountAdditional();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountAll,{once:true});
  else mountAll();
})();
