(()=>{
  'use strict';
  const $=id=>document.getElementById(id);

  function showFallbackError(message){
    const status=$('publishStatus');
    if(status){
      status.textContent=message;
      status.className='publishStatus error';
    }
  }

  function forceOpen(){
    const backdrop=$('publishDialogBackdrop');
    if(!backdrop)return;
    backdrop.classList.remove('hidden');
    $('publishResult')?.classList.add('hidden');

    const open=window.SM_PUBLISH_UI?.open;
    if(typeof open==='function'){
      Promise.resolve()
        .then(()=>open())
        .catch(error=>{
          console.error('[Stats Maker] Publish open failed',error);
          showFallbackError('Publish Error: '+(error?.message||String(error)));
        });
    }else{
      showFallbackError('Publish UI failed to start. Reload this page once. Build: R18 Complete C3');
    }
  }

  function bind(){
    const button=$('publishBtn');
    if(!button)return;

    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      forceOpen();
    },true);

    $('publishCloseBtn')?.addEventListener('click',event=>{
      event.preventDefault();
      window.SM_PUBLISH_UI?.close?.();
      $('publishDialogBackdrop')?.classList.add('hidden');
    },true);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bind,{once:true});
  }else{
    bind();
  }

  window.__SM_R18_COMPLETE_BUILD__='R18-COMPLETE-C7';
})();