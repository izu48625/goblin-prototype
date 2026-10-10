// Community gateway: inactive unless Cloudflare is explicitly configured.
// When enabled, never fall back to direct Supabase writes after an error.
(() => {
  'use strict';
  let configPromise;
  let scriptPromise;
  const config=()=>configPromise||(configPromise=fetch('/api/security/config',{cache:'no-store'})
    .then(r=>r.ok?r.json():{communityGatewayEnabled:false})
    .catch(()=>({communityGatewayEnabled:false})));

  function loadScript(){
    if(window.turnstile?.render)return Promise.resolve();
    if(scriptPromise)return scriptPromise;
    scriptPromise=new Promise((resolve,reject)=>{
      const el=document.createElement('script');
      el.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      el.async=true;
      el.onload=()=>window.turnstile?.render?resolve():reject(new Error('Turnstile failed to initialize.'));
      el.onerror=()=>reject(new Error('Turnstile could not be loaded.'));
      document.head.appendChild(el);
    });
    return scriptPromise;
  }

  async function getChallengeToken(siteKey){
    await loadScript();
    return new Promise((resolve,reject)=>{
      const layer=document.createElement('div');
      layer.setAttribute('role','dialog');
      layer.setAttribute('aria-modal','true');
      layer.setAttribute('aria-label','Security verification');
      layer.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(2,8,18,.85);display:grid;place-items:center;padding:12px;';
      const card=document.createElement('div');
      card.style.cssText='width:min(420px,100%);box-sizing:border-box;padding:19px;border:1px solid #415f86;border-radius:16px;background:#0e1c30;color:#edf4ff;text-align:center;font:600 14px system-ui,sans-serif;';
      const heading=document.createElement('p');
      heading.textContent=document.documentElement.lang==='en'?'Verify to submit your Community rating':'Community投稿前のセキュリティ確認';
      heading.style.margin='0 0 14px';
      const slot=document.createElement('div');
      slot.style.cssText='display:flex;justify-content:center;min-height:65px;';
      const cancel=document.createElement('button');
      cancel.type='button';cancel.textContent=document.documentElement.lang==='en'?'Cancel':'キャンセル';
      cancel.style.cssText='margin-top:14px;padding:10px 22px;background:#152945;color:#dceaff;border:1px solid #436083;border-radius:9px;font-weight:800;';
      card.append(heading,slot,cancel);layer.appendChild(card);document.body.appendChild(layer);
      let settled=false,widgetId;
      const cleanup=()=>{
        if(widgetId!==undefined){try{window.turnstile.remove(widgetId)}catch{}}
        layer.remove();
      };
      const finish=(error,token)=>{
        if(settled)return;
        settled=true;cleanup();
        if(error)reject(error);else resolve(token);
      };
      cancel.addEventListener('click',()=>finish(new Error('Verification cancelled.')));
      try{
        widgetId=window.turnstile.render(slot,{
          sitekey:siteKey,action:'community_submit',theme:'dark',size:'flexible',
          callback:token=>finish(null,token),
          'error-callback':()=>finish(new Error('Security verification failed.')),
          'expired-callback':()=>finish(new Error('Verification expired. Please retry.')),
          'timeout-callback':()=>finish(new Error('Verification timed out. Please retry.'))
        });
        if(settled)cleanup();
      }catch(error){finish(error)}
    });
  }

  async function save(client,params){
    try{
      const cfg=await config();
      if(!cfg.communityGatewayEnabled)return client.rpc('save_my_topic_rating',params);
      if(typeof cfg.siteKey!=='string'||cfg.siteKey.length<7)throw new Error('Security setup is incomplete.');
      const {data:{session},error}=await client.auth.getSession();
      if(error||!session?.access_token)throw new Error('Anonymous login is required.');
      const token=await getChallengeToken(cfg.siteKey);
      const resp=await fetch('/api/guard/community',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({...params,turnstile_token:token}),
        cache:'no-store'
      });
      const result=await resp.json().catch(()=>({error:'invalid_response'}));
      if(!resp.ok)throw new Error(result.message||result.error||'Community submission failed.');
      return {data:result.data,error:null};
    }catch(error){return {data:null,error}}
  }
  window.SM_COMMUNITY_GATEWAY={save};
})();
