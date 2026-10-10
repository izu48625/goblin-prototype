(async()=>{
  'use strict';
  const status=document.getElementById('status'),content=document.getElementById('content');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
  let state={topic:null,items:[],criteria:[],ratingSet:null,scoreMap:new Map(),user:null,ja:true,participant:0};
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

  async function loadParticipant(sb,topicId){
    const {data,error}=await sb.rpc('get_topic_participant_count',{p_topic_id:topicId});
    if(error)throw error;
    state.participant=Number(data||0);
    return state.participant;
  }

  function syncParticipant(){
    const pill=document.getElementById('participantPill');
    if(pill)pill.textContent=state.ja?`参加者 ${state.participant}人`:`${state.participant} participant${state.participant===1?'':'s'}`;
  }

  function render(){
    const {topic,items,criteria,ja}=state;const scale=Number(topic.score_scale||100);const step=scale===10?'0.1':'1';
    content.innerHTML=`<section class="hero"><h1>${esc(topic.title)}${state.ratingSet?.status==='submitted'?`<span class="submittedBadge">${ja?'投稿済み':'SUBMITTED'}</span>`:''}</h1><p>${ja?'登録なしで参加できます。各項目を採点し、最低1つの対象について全項目を埋めるとCommunityへ投稿できます。':'No account required. Score the metrics below and complete every metric for at least one target to submit to Community.'}</p><div class="meta"><span class="pill">${scale}${ja?'点満点':'-point scale'}</span><span class="pill">${items.length}${ja?'対象':' targets'}</span><span class="pill">${criteria.length}${ja?'項目':' metrics'}</span><span id="participantPill" class="pill participantPill">${ja?`参加者 ${state.participant}人`:`${state.participant} participant${state.participant===1?'':'s'}`}</span></div></section>
    <section class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2>${ja?'あなたの評価':'Your Ratings'}</h2><div id="progress" class="progress"></div></div><div class="tableWrap"><table><thead><tr><th class="nameHead">${ja?'対象':'Target'}</th>${criteria.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${items.map(item=>`<tr><td class="targetCell"><span class="targetName">${esc(item.name)}</span></td>${criteria.map(c=>{const value=state.scoreMap.get(`${item.id}|${c.id}`);return `<td><input class="scoreInput" inputmode="decimal" type="number" min="0" max="${scale}" step="${step}" data-item="${item.id}" data-criterion="${c.id}" value="${value??''}"></td>`}).join('')}</tr>`).join('')}</tbody></table></div><div class="privacy">${ja?'評価データはあなた自身以外には個別表示されません。Communityでは5人以上集まった対象だけ平均値を表示します。':'Individual ratings stay private. Community averages are shown only when at least 5 eligible participants have rated an item.'}</div><div id="message" class="message"></div><div class="actions"><button id="draftBtn" class="btn">${ja?'下書き保存':'Save Draft'}</button><button id="submitBtn" class="btn primary">${state.ratingSet?.status==='submitted'?(ja?'評価を更新':'Update Rating'):(ja?'Communityへ投稿':'Submit to Community')}</button></div></section>`;
    document.querySelectorAll('.scoreInput').forEach(input=>input.addEventListener('input',updateProgress));
    document.getElementById('draftBtn').onclick=()=>save(false);document.getElementById('submitBtn').onclick=()=>save(true);updateProgress();if(new URLSearchParams(location.search).get('workspace')==='1')setupRatingWorkspace();
  }

  function communitySheetSnapshot(){
    const rows=state.items.map(item=>({
      name:item.name,image:'',note:'',
      scores:state.criteria.map(c=>{
        const field=document.querySelector(`.scoreInput[data-item="${item.id}"][data-criterion="${c.id}"]`);
        return num(field?.value);
      })
    }));
    const compare=rows.flatMap((row,i)=>row.scores.some(Number.isFinite)?[i]:[]).slice(0,3);
    return {
      id:'community_'+state.topic.id,title:state.topic.title,
      desc:state.ja?'Community・あなたの評価':'Community / Your ratings',
      cols:state.criteria.map(c=>c.name),
      rows,compare,scale:Number(state.topic.score_scale||100),
      weighted:!!state.topic.weighted,
      weights:state.criteria.map(c=>Math.max(0,Number(c.weight)||0))
    };
  }
  
  function paintCommunityInput(field){
    const v=num(field.value),scale=Number(state.topic.score_scale||100);
    const cell=field.closest('td');
    if(!cell)return;
    cell.classList.toggle('hasScore',v!==null&&v>=0&&v<=scale);
    cell.style.setProperty('--score-strength',v===null?0:Math.max(0,Math.min(1,v/scale)));
  }
  
  function showCommunityOverview(container){
    const sheet=communitySheetSnapshot();
    const total=sheet.cols.length;
    const rows=sheet.rows.map((r,i)=>{
      const valid=r.scores.filter(Number.isFinite);
      const avg=valid.length?(()=>{let n=0,d=0;r.scores.forEach((v,i)=>{if(!Number.isFinite(v))return;const w=sheet.weighted?sheet.weights[i]:1;n+=v*w;d+=w;});return d?n/d:null;})():null;
      return {...r,index:i,avg,filled:valid.length};
    }).sort((a,b)=>(b.avg??-1)-(a.avg??-1));
    container.replaceChildren();
    const heading=document.createElement('h3');heading.textContent=state.ja?'あなたの評価・全体表示':'Your scores / Overview';
    container.appendChild(heading);
    if(rows.every(r=>r.avg===null)){
      const empty=document.createElement('p');empty.className='emptyChart';empty.textContent=state.ja?'点数を入力すると総合平均が表示されます。':'Enter some scores to see the averages.';container.appendChild(empty);return;
    }
    for(const row of rows){
      const line=document.createElement('div');line.className='overviewLine';
      const label=document.createElement('span');label.className='overviewName';label.textContent=row.name;
      const score=document.createElement('b');score.textContent=row.avg===null?'—':row.avg.toFixed(1);
      const count=document.createElement('small');count.textContent=`${row.filled}/${total}`;
      const bar=document.createElement('div');bar.className='overviewTrack';
      const fill=document.createElement('div');fill.className='overviewFill';fill.style.width=(row.avg===null?0:100*row.avg/sheet.scale)+'%';bar.appendChild(fill);
      line.append(label,score,count,bar);container.appendChild(line);
    }
  }
  
  function showCommunityGraph(container,kind){
    const sheet=communitySheetSnapshot();
    const subjects=sheet.rows.map((r,i)=>({...r,index:i,valid:r.scores.filter(Number.isFinite)})).filter(r=>r.valid.length);
    container.replaceChildren();
    if(!subjects.length){const p=document.createElement('p');p.className='emptyChart';p.textContent=state.ja?'点数を入力するとグラフを表示できます。':'Enter scores to preview graphs.';container.appendChild(p);return;}
    if(kind==='bar'){
      showCommunityOverview(container);
      container.querySelector('h3').textContent=state.ja?'総合平均・棒グラフ':'Overall average / Bar chart';
      return;
    }
    const top=subjects.slice(0,3),axes=sheet.cols.map((_,i)=>i).filter(i=>top.some(r=>Number.isFinite(r.scores[i]))).slice(0,10);
    if(axes.length<3){const p=document.createElement('p');p.className='emptyChart';p.textContent=state.ja?'レーダー表示には3項目以上の採点が必要です。':'Radar preview requires three scored metrics.';container.appendChild(p);return;}
    const NS='http://www.w3.org/2000/svg',size=320,cx=160,cy=152,radius=104;
    const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 320 320');svg.setAttribute('role','img');svg.setAttribute('aria-label',state.ja?'あなたの評価レーダー':'Your rating radar');svg.classList.add('ratingRadar');
    const point=(i,p)=>{const a=-Math.PI/2+Math.PI*2*i/axes.length;return [cx+Math.cos(a)*radius*p,cy+Math.sin(a)*radius*p]};
    const poly=(values,fill,stroke,opacity)=>{
      const el=document.createElementNS(NS,'polygon');
      el.setAttribute('points',values.map(v=>v.join(',')).join(' '));
      el.setAttribute('fill',fill);el.setAttribute('stroke',stroke);el.setAttribute('fill-opacity',String(opacity));el.setAttribute('stroke-width','2.5');
      svg.appendChild(el);
    };
    for(let level=1;level<=4;level++)poly(axes.map((_,i)=>point(i,level/4)),'none','#334c6d',0);
    axes.forEach((idx,i)=>{
      const end=point(i,1),line=document.createElementNS(NS,'line');line.setAttribute('x1',cx);line.setAttribute('y1',cy);line.setAttribute('x2',end[0]);line.setAttribute('y2',end[1]);line.setAttribute('stroke','#334c6d');svg.appendChild(line);
      const name=document.createElementNS(NS,'text'),t=point(i,1.2);
      name.setAttribute('x',t[0]);name.setAttribute('y',t[1]);name.setAttribute('fill','#b9d0ea');name.setAttribute('font-size','9');name.setAttribute('font-weight','700');name.setAttribute('text-anchor','middle');name.textContent=sheet.cols[idx].length>12?sheet.cols[idx].slice(0,12)+'…':sheet.cols[idx];svg.appendChild(name);
    });
    const palette=['#79a7ff','#55dda2','#e9b561'];
    top.forEach((row,i)=>poly(axes.map((idx,j)=>point(j,Number.isFinite(row.scores[idx])?Math.max(0,Math.min(1,row.scores[idx]/sheet.scale)):0)),palette[i],palette[i],.17));
    const key=document.createElement('div');key.className='radarLegend';
    top.forEach((row,i)=>{
      const label=document.createElement('span'),dot=document.createElement('i');dot.style.background=palette[i];label.append(dot,document.createTextNode(row.name));key.appendChild(label);
    });
    container.append(svg,key);
  }
  
  function setupRatingWorkspace(){
    const panel=content.querySelector('.card'),tableWrap=panel?.querySelector('.tableWrap');
    if(!panel||!tableWrap)return;
    panel.classList.add('ratingWorkspace');
    tableWrap.classList.add('ratingTableWrap');
    const heading=panel.querySelector('h2');
    const switcher=document.createElement('div');switcher.className='workspaceModes';switcher.setAttribute('role','tablist');switcher.setAttribute('aria-label',state.ja?'表示モード':'Display mode');
    const options=[['table',state.ja?'表':'Table'],['overview',state.ja?'全体表示':'Overview'],['graph',state.ja?'グラフ':'Graph']];
    const overview=document.createElement('section');overview.className='ratingOverview hidden';
    const chart=document.createElement('section');chart.className='ratingGraph hidden';
    const graphOptions=document.createElement('div');graphOptions.className='chartModes';
    let currentGraph='radar';
    for(const [key,label] of [['radar',state.ja?'レーダー':'Radar'],['bar',state.ja?'棒グラフ':'Bars']]){
      const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.className='modeBtn'+(key==='radar'?' active':'');
      btn.onclick=()=>{currentGraph=key;graphOptions.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));showCommunityGraph(chartBody,key)};
      graphOptions.appendChild(btn);
    }
    const chartBody=document.createElement('div');chart.append(graphOptions,chartBody);
    let active='table';
    for(const [key,label] of options){
      const btn=document.createElement('button');btn.type='button';btn.className='modeBtn'+(key==='table'?' active':'');btn.textContent=label;
      btn.setAttribute('role','tab');btn.setAttribute('aria-selected',String(key==='table'));
      btn.onclick=()=>{
        active=key;
        switcher.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-selected',String(b===btn))});
        tableWrap.classList.toggle('hidden',key!=='table');
        overview.classList.toggle('hidden',key!=='overview');chart.classList.toggle('hidden',key!=='graph');
        if(key==='overview')showCommunityOverview(overview);
        if(key==='graph')showCommunityGraph(chartBody,currentGraph);
      };
      switcher.appendChild(btn);
    }
    const controls=document.createElement('div');controls.className='communityToolbar';
    const label=document.createElement('span');label.textContent=state.ja?'採点する項目は公開作品に固定されています':'Targets and metrics follow the published work';
    const visualButton=document.createElement('button');visualButton.type='button';visualButton.className='btn primary visualLaunch';visualButton.textContent=state.ja?'＋ 拡張機能':'＋ Visual tools';
    visualButton.onclick=()=>{
      const sheet=communitySheetSnapshot();
      if(!sheet.rows.some(row=>row.scores.some(Number.isFinite))){msg(state.ja?'点数を入力してからグラフを作成してください。':'Enter scores before creating a chart.','error');return;}
      let existing=document.getElementById('communityVisualPicker');if(existing)existing.remove();
      const modal=document.createElement('div');modal.id='communityVisualPicker';modal.className='communityVisualPicker';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
      const inner=document.createElement('div');inner.className='communityVisualInner';
      const title=document.createElement('h3');title.textContent=state.ja?'自分の評価からグラフを作る':'Create a chart from your ratings';
      const sub=document.createElement('p');sub.textContent=state.ja?'グラフは端末内に作成。Communityへの投稿とは別です。':'Charts are local drafts, separate from Community submissions.';
      const close=document.createElement('button');close.className='pickerClose';close.type='button';close.textContent='×';close.setAttribute('aria-label','Close');close.onclick=()=>modal.remove();
      const grid=document.createElement('div');grid.className='communityVisualGrid';
      const types=[['ranking-card','Ranking Card'],['stat-card','Stat Card'],['bar','Bar Chart'],['radar','Radar Chart'],['dot','Dot Chart'],['scatter','Scatter'],['quadrant','Quadrant'],['range','Range'],['tier-list','Tier List'],['ring','Ring Gauge']];
      for(const [type,name] of types){
        const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>{
          window.dispatchEvent(new CustomEvent('statsmaker:communityVisual',{detail:{type,sheet,topicId:state.topic.id}}));
          modal.remove();
        };
        grid.appendChild(b);
      }
      inner.append(title,close,sub,grid);modal.appendChild(inner);modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});document.body.appendChild(modal);
    };
    controls.append(label,visualButton);
    tableWrap.before(switcher,controls);tableWrap.after(overview,chart);
    panel.querySelectorAll('.scoreInput').forEach(field=>{
      paintCommunityInput(field);
      field.addEventListener('input',()=>{paintCommunityInput(field)});
    });
    // Published topic structure is immutable here; users edit only their own scores.
    panel.querySelectorAll('th').forEach(th=>th.classList.add('ratingColumnHead'));
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
      const {data,error}=await window.SM_COMMUNITY_GATEWAY.save(window.SM_SUPABASE.client,{p_topic_id:state.topic.id,p_scores:c.payload,p_submit:submit});
      if(error)throw error;const row=Array.isArray(data)?data[0]:data;
      state.ratingSet={id:row?.rating_set_id,status:row?.rating_status||state.ratingSet?.status||'draft',submitted_at:row?.submitted_at||null};
      if(submit){
        try{await loadParticipant(window.SM_SUPABASE.client,state.topic.id);syncParticipant()}
        catch(countError){console.warn('[Stats Maker] Could not refresh participant count',countError)}
      }
      msg(submit?(state.ja?`Communityへ反映しました。現在の参加者は${state.participant}人です。`:`Rating submitted to Community. Participants: ${state.participant}.`):(state.ja?'下書きを保存しました。':'Draft saved.'),'ok');
      document.getElementById('submitBtn').textContent=state.ratingSet.status==='submitted'?(state.ja?'評価を更新':'Update Rating'):(state.ja?'Communityへ投稿':'Submit to Community');
      if(state.ratingSet.status==='submitted'&&!document.querySelector('.submittedBadge')){const b=document.createElement('span');b.className='submittedBadge';b.textContent=state.ja?'投稿済み':'SUBMITTED';document.querySelector('.hero h1').appendChild(b)}
    }catch(e){console.error(e);msg((state.ja?'保存エラー：':'Save error: ')+(e?.message||String(e)),'error')}
    finally{draftBtn.disabled=submitBtn.disabled=false}
  }

  try{
    const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('Topic ID is missing.');const sb=window.SM_SUPABASE?.client;if(!sb)throw new Error('Supabase is not ready.');
    const {data,error}=await sb.from('topics').select('id,title,description,language_code,score_scale,weighted,allow_ratings,visibility,topic_items(id,name,position),criteria(id,name,weight,position)').eq('id',id).single();if(error)throw error;if(!data.allow_ratings)throw new Error('This topic is not accepting ratings.');
    state.topic=data;state.ja=!String(localStorage.getItem('statsMaker.locale')||localStorage.getItem('statsMakerV2Language')||navigator.language||'ja').toLowerCase().startsWith('en');state.items=(data.topic_items||[]).sort((a,b)=>a.position-b.position);state.criteria=(data.criteria||[]).sort((a,b)=>a.position-b.position);document.documentElement.lang=state.ja?'ja':'en';document.title=`${data.title} - ${state.ja?'採点':'Rate'}`;document.getElementById('backLink').href=`public.html?id=${encodeURIComponent(id)}&v=r25p3`;document.getElementById('backLink').textContent=state.ja?'← 公開ページへ':'← Public page';
    state.user=await ensureParticipant(sb);await Promise.all([loadOwn(sb,id),loadParticipant(sb,id)]);render();status.classList.add('hidden');content.classList.remove('hidden');
  }catch(e){console.error(e);status.textContent=(e?.message||String(e));}
})();
