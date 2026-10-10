import {buildCommunitySheet,collectCommunityScores} from './community-rating-model.js';
// R27: Community reuses the exact Home base/index.html scoring engine.
// A separate in-memory sheet is mounted; Home localStorage is never changed.
const query=new URLSearchParams(location.search);
const topicId=query.get('community')||'';
const siteLanguage=()=>String(localStorage.getItem('statsMaker.locale')||'ja').toLowerCase().startsWith('en')?'en':'ja';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if(uuid.test(topicId)){
  const $=id=>document.getElementById(id);
  const frame=$('basicFrame'),panel=$('communityControls'),loading=$('communityLoading');
  let context=null,busy=false;
  const msg=(text,kind='')=>{const el=$('communityMessage');el.textContent=text;el.className='communityMessage'+(kind?' '+kind:'')};
  const numberOrNull=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
  const loadScript=url=>new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=url;
    el.onload=resolve;el.onerror=()=>reject(new Error('Could not load security client.'));
    document.head.appendChild(el);
  });
  async function ensureUser(sb){
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    if(data?.session?.user)return data.session.user;
    const {data:anon,error:anonError}=await sb.auth.signInAnonymously();
    if(anonError||!anon?.user)throw anonError||new Error('Anonymous login unavailable.');
    return anon.user;
  }
  async function loadData(sb){
    const {data:topic,error}=await sb.from('topics')
      .select('id,title,description,language_code,score_scale,weighted,allow_ratings,visibility,topic_items(id,name,position),criteria(id,name,weight,position)')
      .eq('id',topicId).single();
    if(error)throw error;
    if(!topic.allow_ratings)throw new Error('This work is not accepting Community ratings.');
    const items=[...(topic.topic_items||[])].sort((a,b)=>a.position-b.position);
    const criteria=[...(topic.criteria||[])].sort((a,b)=>a.position-b.position);
    if(!items.length||!criteria.length||items.length>40||criteria.length>10)
      throw new Error('Unsupported rating sheet size.');
    const {data:existing,error:ownError}=await sb.from('rating_sets')
      .select('id,status,submitted_at').eq('topic_id',topicId).maybeSingle();
    if(ownError)throw ownError;
    let existingScores=[];
    if(existing){
      const {data,error:scoreError}=await sb.from('scores')
        .select('item_id,criterion_id,score').eq('rating_set_id',existing.id);
      if(scoreError)throw scoreError;
      existingScores=data||[];
    }
    const sheet=buildCommunitySheet(topic,items,criteria,existingScores);
    const {data:count,error:countError}=await sb.rpc('get_topic_participant_count',{p_topic_id:topicId});
    return {topic,items,criteria,sheet,existing,participant:countError?null:Number(count||0)};
  }
  async function mountSheet(sheet){
    for(let tries=0;tries<75;tries++){
      const mount=frame.contentWindow?.__statsMakerMountCommunitySheet;
      if(typeof mount==='function'){
        if(!mount(sheet))throw new Error('Community sheet binding failed.');
        return;
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('The Home editor did not initialize.');
  }
  function collectScores(){
    const sheet=frame.contentWindow?.__statsMakerGetActiveSheet?.();
    return collectCommunityScores(sheet,context);
  }
  function syncButtons(){
    $('communitySubmit').textContent=context?.existing?.status==='submitted'
      ?(siteLanguage()==='en'?'Update rating':'評価を更新')
      :(siteLanguage()==='en'?'Submit to Community':'Communityへ投稿');
    const count=context?.participant;
    $('communityParticipant').textContent=count===null?'Community':
      siteLanguage()==='en'?count+' participants':'参加者 '+count+'人';
  }
  async function save(submit){
    if(busy)return;
    busy=true;$('communityDraft').disabled=$('communitySubmit').disabled=true;
    try{
      const {entries,completed}=collectScores();
      if(submit&&completed<1)throw new Error(
        siteLanguage()==='en'?
        'Complete every metric for at least one target.':'最低1つの対象の全評価項目を入力してください。'
      );
      msg(siteLanguage()==='en'?'Saving…':'保存中…');
      const {data,error}=await window.SM_COMMUNITY_GATEWAY.save(window.SM_SUPABASE.client,{
        p_topic_id:topicId,p_scores:entries,p_submit:submit
      });
      if(error)throw error;
      const saved=Array.isArray(data)?data[0]:data;
      if(!saved?.rating_set_id)throw new Error('Save confirmation unavailable.');
      context.existing={id:saved.rating_set_id,status:saved.rating_status,submitted_at:saved.submitted_at};
      if(submit){
        const result=await window.SM_SUPABASE.client.rpc('get_topic_participant_count',{p_topic_id:topicId});
        if(!result.error)context.participant=Number(result.data||0);
      }
      syncButtons();
      msg(submit?
        (siteLanguage()==='en'?'Community updated successfully.':'Communityへ反映しました。'):
        (siteLanguage()==='en'?'Draft saved.':'下書きを保存しました。'),'ok');
    }catch(error){
      console.error('[Stats Maker] Community save rejected',error);
      msg((siteLanguage()==='en'?'Save error: ':'保存エラー：')+
        (error?.message||String(error)),'error');
    }finally{
      busy=false;$('communityDraft').disabled=$('communitySubmit').disabled=false;
    }
  }
  // Show whether Home-style edits are merely local or actually submitted.
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow||
      event.data?.type!=='statsmaker:community-score-dirty')return;
    msg(siteLanguage()==='en'
      ?'Unsaved changes — tap Update rating to publish.'
      :'未保存の変更があります。「評価を更新」でCommunityに反映できます。');
  });
  window.addEventListener('statsmaker:site-languagechange',()=>{
    $('communityBackLink').textContent=siteLanguage()==='en'?'← Back to public work':'← 公開ページへ戻る';
    $('communityDraft').textContent=siteLanguage()==='en'?'Save draft':'下書き保存';
    if(context)syncButtons();
  });
  $('communityDraft').onclick=()=>save(false);
  $('communitySubmit').onclick=()=>save(true);
  $('communityBackLink').href='public.html?id='+encodeURIComponent(topicId);
  (async()=>{
    try{
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      await loadScript('cloud/supabase.js?v=r27h1');
      await loadScript('cloud/community-gateway.js?v=r26p3');
      const sb=window.SM_SUPABASE?.client;
      if(!sb)throw new Error('Supabase is not available.');
      await ensureUser(sb);
      context=await loadData(sb);
      await mountSheet(context.sheet);
      syncButtons();
      $('communityBackLink').textContent=siteLanguage()==='en'?'← Back to public work':'← 公開ページへ戻る';
      $('communityDraft').textContent=siteLanguage()==='en'?'Save draft':'下書き保存';
      panel.classList.remove('hidden');
      loading.classList.add('hidden');
    }catch(error){
      console.error('[Stats Maker] Community home failed',error);
      loading.textContent='Communityを開けませんでした：'+(error?.message||String(error));
      loading.classList.add('error');
    }
  })();
}
