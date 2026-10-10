(async()=>{
  'use strict';
  const status=document.getElementById('status'),content=document.getElementById('content');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
  let state={topic:null,items:[],criteria:[],ratingSet:null,scoreMap:new Map(),user:null,ja:true};
  const msg=(text,type='')=>{const el=document.getElementById('message');if(el){el.textContent=text;el.className='message'+(type?' '+type:'')}};

  async function ensureParticipant(sb){
    let {data}=await sb.auth.getSession();
    if(data.session)return data.session.user;
    const {data:anon,error}=await sb.auth.signInAnonymously();
    if(error)throw new Error((state.ja?'匿名参加を開始できません。Supabaseで Anonymous Sign-Ins を有効にしてください。\n':'Could not start anonymous participation. Enable Anonymous Sign-Ins in Supabase.\n')+error.message);
    return anon.user;
  }

  async function loadOwn(sb,topicId){
    const {data:rs,error:rsError}=await sb.from('rating_sets').select('id,status,submitted_at').eq('topic_id',topicId).maybeSingle();
    if(rsError)throw rsError;state.ratingSet=rs||null;
    state.scoreMap=new Map();
    if(rs){const {data:scores,error}=await sb.from('scores').select('item_id,criterion_id,score').eq('rating_set_id',rs.id);if(error)throw error;(scores||[]).forEach(s=>state.scoreMap.set(`${s.item_id}|${s.criterion_id}`,num(s.score)))}
  }

  function render(){
    const {topic,items,criteria,ja}=state;const scale=Number(topic.score_scale||100);const step=scale===10?'0.1':'1';
    content.innerHTML=`<section class="hero"><h1>${esc(topic.title)}${state.ratingSet?.status==='submitted'?`<span class="submittedBadge">${ja?'投稿済み':'SUBMITTED'}</span>`:''}</h1><p>${ja?'登録なしで参加できます。各項目を採点し、最低1つの対象について全項目を埋めるとCommunityへ投稿できます。':'No account required. Score the metrics below and complete every metric for at least one target to submit to Community.'}</p><div class="meta"><span class="pill">${scale}${ja?'点満点':'-point scale'}</span><span class="pill">${items.length}${ja?'対象':' targets'}</span><span class="pill">${criteria.length}${ja?'項目':' metrics'}</span></div></section>
    <section class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>${ja?'あなたの評価':'Your Ratings'}</h2><div id="progress" class="progress"></div></div><div class="tableWrap"><table><thead><tr><th>${ja?'対象':'Target'}</th>${criteria.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>`<tr><td>${esc(item.name)}</td>${criteria.map(c=>{const value=state.scoreMap.get(`${item.id}|${c.id}`);return `<td><input class="scoreInput" inputmode="decimal" type="number" min="0" max="${scale}" step="${step}" data-item="${item.id}" data-criterion="${c.id}" value="${value??''}"></td>`}).join('')}</tr>`).join('')}</tbody></table></div><div class="privacy">${ja?'評価データはあなた自身以外には個別表示されません。Communityでは5人以上集まった対象だけ平均値を表示します。':'Individual ratings stay private. Community averages are shown only when at least 5 eligible participants have rated an item.'}</div><div id="message" class="message"></div><div class="actions"><button id="draftBtn" class="btn">${ja?'下書き保存':'Save Draft'}</button><button id="submitBtn" class="btn primary">${state.ratingSet?.status==='submitted'?(ja?'評価を更新':'Update Rating'):(ja?'Communityへ投稿':'Submit to Community')}</button></div></section>`;
    document.querySelectorAll('.scoreInput').forEach(input=>input.addEventListener('input',updateProgress));
    document.getElementById('draftBtn').onclick=()=>save(false);document.getElementById('submitBtn').onclick=()=>save(true);updateProgress();
  }

  function collect(){
    const scale=Number(state.topic.score_scale||100),payload=[];let completeItems=0,filled=0;
    for(const item of state.items){let complete=true;for(const criterion of state.criteria){const input=document.querySelector(`.scoreInput[data-item="${item.id}"][data-criterion="${criterion.id}"]`);const v=num(input?.value);if(v===null){complete=false;continue}if(v<0||v>scale)throw new Error(`${state.ja?'点数は':'Scores must be between'} 0–${scale}${state.ja?' の範囲で入力してください。':'.'}`);payload.push({item_id:item.id,criterion_id:criterion.id,score:v});filled++}if(complete&&state.criteria.length)completeItems++}
    return {payload,completeItems,filled,total:state.items.length*state.criteria.length};
  }

  function updateProgress(){try{const c=collect();document.getElementById('progress').textContent=`${c.filled}/${c.total}`;}catch{}}

  async function save(submit){
    const draftBtn=document.getElementById('draftBtn'),submitBtn=document.getElementById('submitBtn');
    try{
      const c=collect();if(submit&&c.completeItems<1)throw new Error(state.ja?'最低1つの対象について、全項目を入力してください。':'Complete every metric for at least one target.');
      draftBtn.disabled=submitBtn.disabled=true;msg(state.ja?'保存中…':'Saving…');
      const {data,error}=await window.SM_SUPABASE.client.rpc('save_my_topic_rating',{p_topic_id:state.topic.id,p_scores:c.payload,p_submit:submit});
      if(error)throw error;const row=Array.isArray(data)?data[0]:data;
      state.ratingSet={id:row?.rating_set_id,status:row?.rating_status||state.ratingSet?.status||'draft',submitted_at:row?.submitted_at||null};
      msg(submit?(state.ja?'Communityへ反映しました。':'Rating submitted to Community.'):(state.ja?'下書きを保存しました。':'Draft saved.'),'ok');
      document.getElementById('submitBtn').textContent=state.ratingSet.status==='submitted'?(state.ja?'評価を更新':'Update Rating'):(state.ja?'Communityへ投稿':'Submit to Community');
      if(state.ratingSet.status==='submitted'&&!document.querySelector('.submittedBadge')){const b=document.createElement('span');b.className='submittedBadge';b.textContent=state.ja?'投稿済み':'SUBMITTED';document.querySelector('.hero h1').appendChild(b)}
    }catch(e){console.error(e);msg((state.ja?'保存エラー：':'Save error: ')+(e?.message||String(e)),'error')}
    finally{draftBtn.disabled=submitBtn.disabled=false}
  }

  try{
    const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('Topic ID is missing.');const sb=window.SM_SUPABASE?.client;if(!sb)throw new Error('Supabase is not ready.');
    const {data,error}=await sb.from('topics').select('id,title,description,language_code,score_scale,weighted,allow_ratings,visibility,topic_items(id,name,position),criteria(id,name,weight,position)').eq('id',id).single();if(error)throw error;if(!data.allow_ratings)throw new Error('This topic is not accepting ratings.');
    state.topic=data;state.ja=data.language_code!=='en';state.items=(data.topic_items||[]).sort((a,b)=>a.position-b.position);state.criteria=(data.criteria||[]).sort((a,b)=>a.position-b.position);document.documentElement.lang=state.ja?'ja':'en';document.title=`${data.title} - ${state.ja?'採点':'Rate'}`;document.getElementById('backLink').href=`public.html?id=${encodeURIComponent(id)}&v=r25p2`;document.getElementById('backLink').textContent=state.ja?'← 公開ページへ':'← Public page';
    state.user=await ensureParticipant(sb);await loadOwn(sb,id);render();status.classList.add('hidden');content.classList.remove('hidden');
  }catch(e){console.error(e);status.textContent=(e?.message||String(e));}
})();
