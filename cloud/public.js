(async()=>{
  'use strict';
  const status=document.getElementById('status');
  const content=document.getElementById('content');
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null};
  const fmt=value=>{const n=num(value);return n===null?'—':(Number.isInteger(n)?String(n):n.toFixed(1))};
  const fmtDate=(value,ja)=>{if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';try{return new Intl.DateTimeFormat(ja?'ja-JP':'en-US',{year:'numeric',month:'short',day:'numeric'}).format(d)}catch{return d.toLocaleDateString()}};
  const average=(scores,criteria,weighted)=>{let total=0,den=0;scores.forEach((raw,i)=>{const score=num(raw);if(score===null)return;const w=weighted?Math.max(0,Number(criteria[i]?.weight??1)):1;total+=score*w;den+=w});return den?Math.round(total/den*10)/10:null};

  function socialCategoryLabel(key,ja){
    const labels={
      sports:['スポーツ','Sports'],
      manga_anime:['漫画・アニメ','Manga / Anime'],
      movie_tv:['映画・ドラマ','Movies / TV'],
      food:['フード','Food'],
      game:['ゲーム','Games'],
      music:['音楽','Music'],
      books:['本・文学','Books'],
      travel:['旅行・場所','Travel / Places'],
      tech:['テクノロジー','Technology'],
      lifestyle:['ライフ・趣味','Lifestyle / Hobbies'],
      other:['その他','Other']
    };
    const pair=labels[String(key||'other')]||labels.other;
    return ja?pair[0]:pair[1];
  }

  function canvasBlob(canvas,type='image/png',quality=.95){
    return new Promise((resolve,reject)=>{
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image encoding failed')),type,quality);
    });
  }

  function truncateCanvasText(ctx,text,maxWidth){
    const value=String(text||'');
    if(ctx.measureText(value).width<=maxWidth)return value;
    let out=value;
    while(out.length>1&&ctx.measureText(out+'…').width>maxWidth)out=out.slice(0,-1);
    return out+'…';
  }

  function wrapCanvasText(ctx,text,maxWidth,maxLines=2){
    const source=String(text||'').trim();
    if(!source)return [];
    const chars=[...source];
    const lines=[];
    let current='';
    for(const ch of chars){
      const test=current+ch;
      if(current&&ctx.measureText(test).width>maxWidth){
        lines.push(current);
        current=ch;
        if(lines.length===maxLines)break;
      }else current=test;
    }
    if(lines.length<maxLines&&current)lines.push(current);
    if(lines.length===maxLines){
      lines[maxLines-1]=truncateCanvasText(ctx,lines[maxLines-1],maxWidth);
    }
    return lines.slice(0,maxLines);
  }

  function roundRectPath(ctx,x,y,w,h,r){
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
  }

  function shareCanvasSize(aspect){
    if(aspect==='square')return {width:1080,height:1080,label:'1:1'};
    if(aspect==='portrait')return {width:1080,height:1350,label:'4:5'};
    return {width:1200,height:675,label:'16:9'};
  }

  function shareTitleFont(width,title,portrait){
    const length=[...String(title||'')].length;
    const base=portrait?width*.064:width*.049;
    if(length>48)return base*.72;
    if(length>32)return base*.82;
    if(length>20)return base*.9;
    return base;
  }

  async function buildPublicShareCard({
    title,description,category,creatorRanking,communityRanking,participant,
    targets,metrics,scale,ja,aspect='landscape',template='creator'
  }){
    const {width,height}=shareCanvasSize(aspect);
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas unavailable');

    const portrait=height>width*1.08;
    const square=Math.abs(height-width)<40;
    const pad=Math.round(width*.06);
    const innerW=width-pad*2;

    const bg=ctx.createLinearGradient(0,0,width,height);
    bg.addColorStop(0,'#07101f');
    bg.addColorStop(.56,'#0c1b30');
    bg.addColorStop(1,'#15284a');
    ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);

    const glow=ctx.createRadialGradient(width*.82,height*.08,0,width*.82,height*.08,width*.42);
    glow.addColorStop(0,'rgba(111,156,255,.3)');
    glow.addColorStop(1,'rgba(111,156,255,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);

    ctx.fillStyle='#7da3ff';
    ctx.font=`900 ${Math.round(width*.021)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.fillText('STATS MAKER',pad,Math.round(height*.085));

    ctx.fillStyle='#6ddaa2';
    ctx.font=`900 ${Math.round(width*.015)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.fillText(String(category||'').toUpperCase(),pad,Math.round(height*.13));

    const titleFont=shareTitleFont(width,title,portrait);
    ctx.fillStyle='#f3f7ff';
    ctx.font=`900 ${Math.round(titleFont)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    const titleMaxW=portrait||square?innerW:Math.round(width*.57);
    const titleLines=wrapCanvasText(ctx,title,titleMaxW,portrait?3:2);
    const titleStart=Math.round(height*.205);
    const titleLineH=Math.round(titleFont*1.16);
    titleLines.forEach((line,i)=>ctx.fillText(line,pad,titleStart+i*titleLineH));

    const titleBottom=titleStart+(Math.max(1,titleLines.length)-1)*titleLineH;
    let descBottom=titleBottom;
    if(description){
      const descFont=Math.round(width*(portrait?.021:.018));
      ctx.fillStyle='#9fb1c9';
      ctx.font=`600 ${descFont}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      const descMax=portrait||square?innerW:Math.round(width*.57);
      const descLines=wrapCanvasText(ctx,description,descMax,portrait?3:2);
      const descStart=titleBottom+Math.round(height*.055);
      const descLineH=Math.round(descFont*1.4);
      descLines.forEach((line,i)=>ctx.fillText(line,pad,descStart+i*descLineH));
      descBottom=descStart+(Math.max(1,descLines.length)-1)*descLineH;
    }

    const meta=[
      [ja?'対象':'TARGETS',String(targets)],
      [ja?'評価項目':'METRICS',String(metrics)],
      [ja?'尺度':'SCALE',String(scale)],
      [ja?'参加者':'PARTICIPANTS',String(participant??0)]
    ];

    const drawMetaGrid=(x,y,w,cols=2)=>{
      const rowsCount=Math.ceil(meta.length/cols);
      const gap=Math.round(width*.012);
      const cellW=(w-gap*(cols-1))/cols;
      const cellH=Math.round((portrait?height*.085:height*.105));
      meta.forEach((entry,i)=>{
        const col=i%cols,row=Math.floor(i/cols);
        const cx=x+col*(cellW+gap),cy=y+row*(cellH+gap);
        roundRectPath(ctx,cx,cy,cellW,cellH,Math.round(width*.012));
        ctx.fillStyle='rgba(8,19,34,.78)';ctx.fill();
        ctx.strokeStyle='#294768';ctx.lineWidth=Math.max(1,width*.0015);ctx.stroke();
        ctx.fillStyle='#7087a6';
        ctx.font=`900 ${Math.round(width*.011)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.fillText(entry[0],cx+cellW*.08,cy+cellH*.34);
        ctx.fillStyle='#edf4ff';
        ctx.font=`900 ${Math.round(width*.026)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.fillText(entry[1],cx+cellW*.08,cy+cellH*.74);
      });
      return y+rowsCount*cellH+(rowsCount-1)*gap;
    };

    const drawRanking=(x,y,w,h,ranking,label)=>{
      roundRectPath(ctx,x,y,w,h,Math.round(width*.022));
      ctx.fillStyle='rgba(8,19,34,.91)';ctx.fill();
      ctx.strokeStyle='#36577d';ctx.lineWidth=Math.max(2,width*.0018);ctx.stroke();

      ctx.fillStyle='#879dbc';
      ctx.font=`900 ${Math.round(width*.013)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.fillText(label,x+w*.07,y+h*.09);

      const top=(ranking||[]).slice(0,3);
      if(!top.length){
        ctx.fillStyle='#7186a3';
        ctx.font=`700 ${Math.round(width*.018)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.fillText(ja?'まだ表示できるランキングがありません':'No ranking available yet',x+w*.07,y+h*.26);
        return;
      }
      const rowH=h*.245;
      top.forEach((item,i)=>{
        const ry=y+h*.2+i*rowH;
        ctx.fillStyle=i===0?'#8fb2ff':'#b8c7da';
        ctx.font=`900 ${Math.round(width*.019)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.fillText(String(i+1),x+w*.07,ry);

        ctx.fillStyle='#edf4ff';
        ctx.font=`800 ${Math.round(width*.017)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.fillText(truncateCanvasText(ctx,item.name,w*.57),x+w*.16,ry);

        ctx.fillStyle='#8fb2ff';
        ctx.font=`900 ${Math.round(width*.022)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
        ctx.textAlign='right';
        ctx.fillText(fmt(item.value),x+w*.92,ry);
        ctx.textAlign='left';

        const pct=Math.max(0,Math.min(1,Number(item.value||0)/Number(scale||100)));
        roundRectPath(ctx,x+w*.16,ry+h*.035,w*.69,Math.max(7,width*.007),999);
        ctx.fillStyle='#1d324f';ctx.fill();
        roundRectPath(ctx,x+w*.16,ry+h*.035,w*.69*pct,Math.max(7,width*.007),999);
        ctx.fillStyle='#6f9cff';ctx.fill();
      });
    };

    if(template==='overview'){
      const panelY=Math.max(descBottom+Math.round(height*.07),Math.round(height*.43));
      const metaBottom=drawMetaGrid(pad,panelY,innerW,portrait?2:4);
      const noteY=metaBottom+Math.round(height*.055);
      ctx.fillStyle='#94a9c4';
      ctx.font=`700 ${Math.round(width*.019)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      const overviewText=ja
        ?`全${targets}対象を${metrics}項目・${scale}点満点で比較`
        :`${targets} targets compared across ${metrics} metrics on a ${scale}-point scale`;
      wrapCanvasText(ctx,overviewText,innerW,2).forEach((line,i)=>ctx.fillText(line,pad,noteY+i*Math.round(width*.027)));
    }else if(portrait||square){
      const panelY=Math.max(descBottom+Math.round(height*.055),Math.round(height*(square?.43:.38)));
      const panelH=Math.round(height*(square?.32:.39));
      drawRanking(
        pad,panelY,innerW,panelH,
        template==='community'?communityRanking:creatorRanking,
        template==='community'
          ?(ja?'COMMUNITY 総合 TOP 3':'COMMUNITY OVERALL TOP 3')
          :(ja?'作成者 総合 TOP 3':'CREATOR OVERALL TOP 3')
      );
      if(portrait){
        drawMetaGrid(pad,panelY+panelH+Math.round(height*.035),innerW,2);
      }else if(square){
        drawMetaGrid(pad,panelY+panelH+Math.round(height*.025),innerW,4);
      }
    }else{
      const panelX=Math.round(width*.655),panelY=Math.round(height*.105);
      const panelW=width-pad-panelX,panelH=Math.round(height*.62);
      drawRanking(
        panelX,panelY,panelW,panelH,
        template==='community'?communityRanking:creatorRanking,
        template==='community'
          ?(ja?'COMMUNITY 総合 TOP 3':'COMMUNITY OVERALL TOP 3')
          :(ja?'作成者 総合 TOP 3':'CREATOR OVERALL TOP 3')
      );
      drawMetaGrid(pad,Math.round(height*.715),Math.round(width*.56),4);
    }

    ctx.textAlign='right';
    ctx.fillStyle='#7088a6';
    ctx.font=`700 ${Math.round(width*.013)}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
    ctx.fillText('Created with Stats Maker',width-pad,height-Math.round(height*.055));
    ctx.textAlign='left';

    return canvas;
  }
  function toast(message){const old=document.querySelector('.toast');old?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2200)}

  async function getOwnSubmitted(sb,topicId,items,criteria,weighted){
    try{
      const {data:sessionData}=await sb.auth.getSession();
      if(!sessionData.session)return null;
      const {data:rs,error:rsError}=await sb.from('rating_sets').select('id,status').eq('topic_id',topicId).maybeSingle();
      if(rsError||!rs)return null;
      const {data:scores,error:scoreError}=await sb.from('scores').select('item_id,criterion_id,score').eq('rating_set_id',rs.id);
      if(scoreError)return null;
      const map=new Map((scores||[]).map(s=>[`${s.item_id}|${s.criterion_id}`,num(s.score)]));
      const values=items.map(item=>{
        const row=criteria.map(c=>map.get(`${item.id}|${c.id}`)??null);
        return {itemId:item.id,name:item.name,value:average(row,criteria,weighted)};
      });
      return {status:rs.status,values};
    }catch{return null}
  }

  try{
    const id=new URLSearchParams(location.search).get('id');
    if(!id)throw new Error('Topic ID is missing.');
    const sb=window.SM_SUPABASE?.client;if(!sb)throw new Error('Supabase is not ready.');

    const {data,error}=await sb.from('topics')
      .select('*,topic_items(id,name,position,image_url),criteria(id,name,weight,position)')
      .eq('id',id).single();
    if(error)throw error;

    let sourceTopic=null;
    let remixCount=0;
    try{
      if(data.source_topic_id){
        const {data:source}=await sb.from('topics')
          .select('id,title,visibility')
          .eq('id',data.source_topic_id)
          .maybeSingle();
        if(source&&source.visibility!=='private')sourceTopic=source;
      }
    }catch{}
    const ja=data.language_code!=='en';document.documentElement.lang=ja?'ja':'en';document.title=`${data.title} - Stats Maker`;
    const metaDescription=document.querySelector('meta[name="description"]');
    if(metaDescription)metaDescription.content=data.description||`${data.title} - Stats Maker`;
    const footerOpen=document.getElementById('footerOpenApp');
    if(footerOpen)footerOpen.textContent=ja?'Stats Makerを開く':'Open Stats Maker';
    let currentUser=null;
    try{currentUser=(await sb.auth.getUser()).data?.user||null}catch{}
    const isOwner=!!currentUser&&currentUser.id===data.owner_id;
    const items=(data.topic_items||[]).sort((a,b)=>a.position-b.position);
    const dbCriteria=(data.criteria||[]).sort((a,b)=>a.position-b.position);
    const snap=(data.snapshot&&typeof data.snapshot==='object'&&!Array.isArray(data.snapshot))?data.snapshot:{};
    const lineageRelation=String(snap?.lineage?.relation||'').toLowerCase()||(data.source_topic_id?'derived':'');
    try{
      const {data:children}=await sb.from('topics')
        .select('id,snapshot,visibility')
        .eq('source_topic_id',data.id)
        .in('visibility',['public','unlisted']);
      remixCount=(children||[]).filter(child=>String(child?.snapshot?.lineage?.relation||'').toLowerCase()==='remix').length;
    }catch{}
    const criteria=(Array.isArray(snap.criteria)&&snap.criteria.length)?snap.criteria:dbCriteria.map(c=>({name:c.name,weight:Number(c.weight??1)}));
    const rows=(Array.isArray(snap.rows)&&snap.rows.length)?snap.rows:items.map(i=>({name:i.name,note:'',scores:Array(criteria.length).fill(null)}));
    const scale=Number(snap.scale||data.score_scale||100)===10?10:100;
    const weighted=typeof snap.weighted==='boolean'?snap.weighted:!!data.weighted;
    const publicCategory=socialCategoryLabel(snap?.metadata?.category||'other',ja);

    const creatorRanking=rows.map((row,index)=>({index,name:row.name||`${ja?'対象':'Target'} ${index+1}`,value:average(Array.isArray(row.scores)?row.scores:[],criteria,weighted)})).filter(x=>x.value!==null).sort((a,b)=>b.value-a.value||a.index-b.index);
    const creatorTop=creatorRanking[0]||null;
    let shareParticipant=0;
    let shareCommunityRanking=[];
    let shareCommunityUnlocked=false;
    const updatedLabel=fmtDate(data.snapshot_updated_at||data.published_at,ja);
    const visibilityLabel=data.visibility==='private'
      ?(ja?'非公開プレビュー':'Private preview')
      :(data.visibility==='unlisted'?(ja?'URL限定':'Unlisted'):(ja?'公開作品':'Public'));
    const visibilityHelp=data.visibility==='private'
      ?(ja?'現在は非公開です。公開者セッションでのみ確認できます。':'This page is private and is only visible to the publisher session.')
      :(data.visibility==='unlisted'
        ?(ja?'公開一覧には表示せず、URLを知っている人だけが閲覧できます。':'Hidden from public listings; anyone with the URL can view it.')
        :(ja?'公開作品として扱われ、URLから誰でも閲覧できます。':'A public Stats Maker page that anyone with the URL can view.'));
    const metricChips=criteria.map(c=>`<span class="${weighted?'weightedMetric':''}">${esc(c.name)}${weighted?`<small>×${fmt(c.weight??1)}</small>`:''}</span>`).join('');
    const tableHead=criteria.map(c=>`<th>${esc(c.name)}</th>`).join('');
    const tableRows=rows.map(row=>{const scores=Array.isArray(row.scores)?row.scores:[];const av=average(scores,criteria,weighted);return `<tr><td>${esc(row.name)}</td>${criteria.map((_,i)=>{const n=num(scores[i]);return `<td class="${n===null?'na':'score'}">${n===null?'—':fmt(n)}</td>`}).join('')}<td class="avg">${av===null?'—':fmt(av)}</td></tr>`}).join('');

    content.innerHTML=`
      <section class="hero">
        <div class="heroTopline">
          <div class="visibilityBadge ${data.visibility==='private'?'private':data.visibility==='unlisted'?'unlisted':''}">${visibilityLabel}</div>
          ${updatedLabel?`<div class="updatedAt">${ja?'更新':'Updated'} ${esc(updatedLabel)}</div>`:''}
        </div>
        <h1>${esc(data.title)}</h1>
        ${data.description?`<div class="desc">${esc(data.description)}</div>`:''}
        <div class="heroScope">${visibilityHelp}</div>
        ${data.source_topic_id?`
          <div class="lineageBar">
            <div class="lineageMain">
              <span class="lineageLabel">${lineageRelation==='version'?(ja?'前バージョン':'Previous version'):lineageRelation==='remix'?(ja?'Remix元':'Remix source'):(ja?'派生元':'Source')}</span>
              ${sourceTopic
                ?`<a class="lineageSource" href="public.html?id=${encodeURIComponent(sourceTopic.id)}&v=r23ux4">${esc(sourceTopic.title)}</a>`
                :`<span class="lineageSource unavailable">${ja?'派生元は現在参照できません':'Source is currently unavailable'}</span>`}
            </div>
            <div class="lineageBadge">${lineageRelation==='version'?'VERSION':lineageRelation==='remix'?'REMIX':'SOURCE'}</div>
          </div>`
        :''}

        <div class="summaryStrip">
          <div class="summaryStat">
            <div class="summaryLabel">${ja?'あなたの総合1位':'Your Overall #1'}</div>
            <div class="summaryValue accent">${creatorTop?fmt(creatorTop.value):'—'}</div>
            <div class="summarySub">${creatorTop?esc(creatorTop.name):(ja?'採点なし':'No scores')}</div>
          </div>
          <div class="summaryStat">
            <div class="summaryLabel">${ja?'対象':'Targets'}</div>
            <div class="summaryValue">${rows.length}</div>
            <div class="summarySub">${ja?'比較対象':'rated targets'}</div>
          </div>
          <div class="summaryStat">
            <div class="summaryLabel">${ja?'評価項目':'Metrics'}</div>
            <div class="summaryValue">${criteria.length}</div>
            <div class="summarySub">${weighted?(ja?'重み付け平均':'weighted average'):(ja?'均等平均':'equal average')}</div>
          </div>
          <div class="summaryStat">
            <div class="summaryLabel">${ja?'尺度':'Scale'}</div>
            <div class="summaryValue">${scale}</div>
            <div class="summarySub">${ja?'点満点':'point scale'}</div>
          </div>
        </div>

        <div class="primaryActions">
          <button id="remixBtn" class="actionBtn remix">${ja?'Remixして使う':'Remix this'}<span class="actionCount">${remixCount}</span></button>
          <button id="shareBtn" class="actionBtn ghost">${ja?'URL共有':'Share URL'}</button>
          <button id="shareImageBtn" class="actionBtn shareImage">${ja?'画像で共有':'Share Image'}</button>
          ${isOwner?`<button id="ownerManageBtn" class="actionBtn owner">${ja?'編集・公開設定':'Edit / Publish settings'}</button>`:''}
        </div>
        ${isOwner?`<div class="ownerHint">${ja?'このブラウザの公開者セッションで開いています。元シートが残っていれば編集画面へ戻せます。':'You are viewing this with the publisher session. If the local source sheet still exists, it will be selected when you return.'}</div>`:''}

        <div class="notice remixNotice">
          <b>${ja?'Remixでは構成だけをコピーし、作成者の点数はコピーしません。':'Remix copies the structure, not the creator’s scores.'}</b>
          <span>${ja?'採点後は「元作品のCommunityに参加」か、「自分版として公開」かを選べます。Community参加はこの作品の集計へ評価を送り、自分版公開はRemix関係を残した別作品になります。':'After scoring, choose either “Join the source Community” or “Publish as your own version.” Community submission contributes to this work; publishing creates a separate linked work.'}</span>
        </div>
        ${rows.some(row=>row.hasLocalImage)?`<div class="notice">${ja?'現在、作成者のローカル画像は公開ページへアップロードされません。':'Creator-local images are not uploaded to the public page yet.'}</div>`:''}
      </section>

      <div class="grid">
        <section class="card">
          <div class="cardTitleRow"><h2>${ja?'作成者の公開スコア':'Creator Scores'}</h2><span class="smallBadge">${rows.length} × ${criteria.length}</span></div>
          <div class="tableWrap"><table><thead><tr><th>${ja?'対象':'Target'}</th>${tableHead}<th>${ja?'平均':'Average'}</th></tr></thead><tbody>${tableRows}</tbody></table></div>
        </section>
        <aside>
          <section class="card">
            <div class="cardTitleRow"><h2>${ja?'あなたの総合ランキング':'Your Overall Ranking'}</h2><span class="smallBadge">TOP ${Math.min(10,creatorRanking.length)}</span></div>
            <div class="ranking">${creatorRanking.length?creatorRanking.slice(0,10).map((item,i)=>`<div class="rankRow"><div class="rankNo">${i+1}</div><div class="rankName">${esc(item.name)}</div><div class="rankValue">${fmt(item.value)}</div></div>`).join(''):`<div class="emptyCommunity">${ja?'採点データがありません。':'No scored data yet.'}</div>`}</div>
          </section>
          <section class="card" style="margin-top:14px">
            <div class="cardTitleRow"><h2>${ja?'評価項目':'Metrics'}</h2><span class="smallBadge">${criteria.length}</span></div>
            <div class="criteria">${metricChips}</div>
          </section>
        </aside>
      </div>

      <section id="communitySection" class="card communityBlock">
        <div class="sectionHead">
          <div><h2>Community</h2><div class="sectionSub">${ja?'みんなの評価を集計':'Aggregated participant ratings'}</div></div>
        </div>
        <div id="communityContent" class="emptyCommunity">${ja?'集計中…':'Loading community…'}</div>
      </section>

      <div id="shareImageBackdrop" class="shareImageBackdrop hidden" role="dialog" aria-modal="true">
        <div class="shareImageDialog">
          <div class="shareImageHead">
            <div>
              <div class="eyebrow">SHARE IMAGE</div>
              <h2>${ja?'共有画像を作成':'Create Share Image'}</h2>
            </div>
            <button id="shareImageCloseBtn" class="shareImageClose" type="button" aria-label="Close">×</button>
          </div>

          <div class="shareOptionGroup">
            <div class="shareOptionLabel">${ja?'比率':'Aspect ratio'}</div>
            <div class="shareOptionGrid shareAspectGrid">
              <button class="shareChoice active" data-share-aspect="landscape" type="button"><b>16:9</b><span>X / Web</span></button>
              <button class="shareChoice" data-share-aspect="square" type="button"><b>1:1</b><span>Square</span></button>
              <button class="shareChoice" data-share-aspect="portrait" type="button"><b>4:5</b><span>Instagram</span></button>
            </div>
          </div>

          <div class="shareOptionGroup">
            <div class="shareOptionLabel">${ja?'内容':'Template'}</div>
            <div class="shareOptionGrid">
              <button class="shareChoice active" data-share-template="creator" type="button"><b>${ja?'作成者 TOP3':'Creator TOP3'}</b><span>${ja?'自分の総合ランキング':'Creator overall ranking'}</span></button>
              <button id="shareCommunityChoice" class="shareChoice" data-share-template="community" type="button"><b>Community TOP3</b><span id="shareCommunityChoiceSub">${ja?'5人以上で利用可能':'Available at 5+ participants'}</span></button>
              <button class="shareChoice" data-share-template="overview" type="button"><b>${ja?'概要カード':'Overview'}</b><span>${ja?'対象数・項目数・尺度・参加者':'Targets, metrics, scale, participants'}</span></button>
            </div>
          </div>

          <div id="shareImageSelectionNote" class="shareImageSelectionNote"></div>
          <button id="shareImageCreateBtn" class="actionBtn shareImage shareImageCreateBtn" type="button">${ja?'作成して共有':'Create & Share'}</button>
        </div>
      </div>`;

    document.getElementById('remixBtn').onclick=()=>{
      try{
        const sheet=window.SM_REMIX.buildSheet(data,snap,dbCriteria,items,ja?'ja':'en');
        window.SM_REMIX.saveSheet(sheet);
        toast(ja?'Remixしました。編集画面へ移動します。':'Remixed. Opening the editor…');
        setTimeout(()=>{location.href='index.html?remixed=1&v=r23ux4'},500);
      }catch(e){toast((ja?'Remixに失敗しました：':'Remix failed: ')+(e?.message||e))}
    };
    document.getElementById('shareBtn').onclick=async()=>{
      try{
        const url=location.href;
        if(navigator.share){
          await navigator.share({title:data.title,text:data.description||'',url});
        }else if(navigator.clipboard?.writeText){
          await navigator.clipboard.writeText(url);
          toast(ja?'URLをコピーしました。':'URL copied.');
        }else{
          const ta=document.createElement('textarea');ta.value=url;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
          toast(ja?'URLをコピーしました。':'URL copied.');
        }
      }catch(e){if(e?.name!=='AbortError')toast(ja?'共有できませんでした。':'Could not share.')}
    };

    const shareState={aspect:'landscape',template:'creator'};

    const syncShareDialog=()=>{
      document.querySelectorAll('[data-share-aspect]').forEach(button=>{
        button.classList.toggle('active',button.dataset.shareAspect===shareState.aspect);
      });
      document.querySelectorAll('[data-share-template]').forEach(button=>{
        button.classList.toggle('active',button.dataset.shareTemplate===shareState.template);
      });
      const communityChoice=document.getElementById('shareCommunityChoice');
      const communitySub=document.getElementById('shareCommunityChoiceSub');
      if(communityChoice){
        communityChoice.disabled=!shareCommunityUnlocked;
        if(communitySub)communitySub.textContent=shareCommunityUnlocked
          ?(ja?`${shareParticipant}人のCommunity平均を使用`:`Uses ${shareParticipant} Community participants`)
          :(ja?'5人以上で利用可能':'Available at 5+ participants');
      }
      if(!shareCommunityUnlocked&&shareState.template==='community')shareState.template='creator';
      const size=shareCanvasSize(shareState.aspect);
      const templateLabel=shareState.template==='community'
        ?'Community TOP3'
        :shareState.template==='overview'
          ?(ja?'概要カード':'Overview')
          :(ja?'作成者 TOP3':'Creator TOP3');
      const note=document.getElementById('shareImageSelectionNote');
      if(note)note.textContent=`${size.label} · ${size.width}×${size.height}px · ${templateLabel}`;
    };

    const openShareDialog=()=>{
      document.getElementById('shareImageBackdrop')?.classList.remove('hidden');
      syncShareDialog();
    };
    const closeShareDialog=()=>document.getElementById('shareImageBackdrop')?.classList.add('hidden');

    document.getElementById('shareImageBtn').onclick=openShareDialog;
    document.getElementById('shareImageCloseBtn').onclick=closeShareDialog;
    document.getElementById('shareImageBackdrop').onclick=e=>{
      if(e.target===document.getElementById('shareImageBackdrop'))closeShareDialog();
    };

    document.querySelectorAll('[data-share-aspect]').forEach(button=>{
      button.onclick=()=>{
        shareState.aspect=button.dataset.shareAspect||'landscape';
        syncShareDialog();
      };
    });
    document.querySelectorAll('[data-share-template]').forEach(button=>{
      button.onclick=()=>{
        const requested=button.dataset.shareTemplate||'creator';
        if(requested==='community'&&!shareCommunityUnlocked)return;
        shareState.template=requested;
        syncShareDialog();
      };
    });

    document.getElementById('shareImageCreateBtn').onclick=async()=>{
      const button=document.getElementById('shareImageCreateBtn');
      const original=button.textContent;
      try{
        button.disabled=true;
        button.textContent=ja?'画像を作成中…':'Creating image…';
        const canvas=await buildPublicShareCard({
          title:data.title,
          description:data.description||'',
          category:publicCategory,
          creatorRanking,
          communityRanking:shareCommunityRanking,
          participant:shareParticipant,
          targets:rows.length,
          metrics:criteria.length,
          scale,
          ja,
          aspect:shareState.aspect,
          template:shareState.template
        });
        const blob=await canvasBlob(canvas,'image/png',.96);
        const safe=String(data.title||'stats-maker').replace(/[\\/:*?"<>|]+/g,'_').slice(0,60)||'stats-maker';
        const size=shareCanvasSize(shareState.aspect);
        const file=new File([blob],`${safe}-${size.label.replace(':','x')}.png`,{type:'image/png'});
        const url=location.href;

        let shared=false;
        if(navigator.share&&navigator.canShare?.({files:[file]})){
          try{
            await navigator.share({
              files:[file],
              title:data.title,
              text:`${data.description||''}${data.description?'\n':''}${url}`
            });
            shared=true;
            closeShareDialog();
            toast(ja?'共有画像を作成しました。':'Share image created.');
          }catch(e){
            if(e?.name==='AbortError')throw e;
            console.warn('[Stats Maker] Native image share failed; falling back to save.',e);
          }
        }
        if(!shared){
          const objectUrl=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=objectUrl;a.download=file.name;a.rel='noopener';
          document.body.appendChild(a);a.click();a.remove();
          setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
          closeShareDialog();
          toast(ja?'共有画像を保存しました。':'Share image saved.');
        }
      }catch(e){
        if(e?.name!=='AbortError'){
          console.error('[Stats Maker] Share image failed',e);
          toast(ja?'共有画像を作成できませんでした。':'Could not create share image.');
        }
      }finally{
        button.disabled=false;
        button.textContent=original;
      }
    };
    if(isOwner&&document.getElementById('ownerManageBtn')){
      document.getElementById('ownerManageBtn').onclick=()=>{
        try{
          const key='statsMakerV014Library';
          const lib=JSON.parse(localStorage.getItem(key)||'null');
          if(lib&&Array.isArray(lib.sheets)){
            const source=lib.sheets.find(sheet=>String(sheet?.cloudTopicId||'')===String(data.id));
            if(source){lib.activeId=source.id;localStorage.setItem(key,JSON.stringify(lib))}
          }
          sessionStorage.setItem('statsMaker:openPublish','1');
        }catch{}
        location.href='index.html?v=r23ux4&from=public';
      };
    };

    if(data.show_community){
      const [countRes,itemRes,criterionRes,own]=await Promise.all([
        sb.rpc('get_topic_participant_count',{p_topic_id:id}),
        sb.rpc('get_community_item_summary',{p_topic_id:id}),
        sb.rpc('get_community_criterion_summary',{p_topic_id:id}),
        getOwnSubmitted(sb,id,items,dbCriteria,weighted)
      ]);
      if(countRes.error||itemRes.error||criterionRes.error)throw(countRes.error||itemRes.error||criterionRes.error);

      const participant=Number(countRes.data||0);
      const canShowAverages=participant>=5;
      const itemSummary=itemRes.data||[];
      const criterionSummary=criterionRes.data||[];
      const itemById=new Map(items.map(i=>[i.id,i]));
      const communityRanking=itemSummary
        .map(s=>({
          itemId:s.item_id,
          name:itemById.get(s.item_id)?.name||'',
          count:Number(s.response_count||0),
          value:canShowAverages&&Number(s.response_count||0)>=5?num(s.avg_overall):null
        }))
        .filter(x=>x.value!==null)
        .sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,ja?'ja':'en'));
      shareParticipant=participant;
      shareCommunityUnlocked=canShowAverages&&communityRanking.length>0;
      shareCommunityRanking=communityRanking;
      syncShareDialog();

      const cMap=new Map(
        criterionSummary.map(s=>[
          `${s.item_id}|${s.criterion_id}`,
          {...s,avg_score:canShowAverages&&Number(s.response_count||0)>=5?num(s.avg_score):null}
        ])
      );

      const metricSummary=dbCriteria.map(criterion=>{
        const rowsForMetric=criterionSummary
          .filter(row=>row.criterion_id===criterion.id&&canShowAverages&&Number(row.response_count||0)>=5&&num(row.avg_score)!==null)
          .map(row=>({avg:num(row.avg_score),count:Number(row.response_count||0)}))
          .filter(row=>row.avg!==null&&row.count>0);
        const den=rowsForMetric.reduce((sum,row)=>sum+row.count,0);
        const value=den
          ? rowsForMetric.reduce((sum,row)=>sum+row.avg*row.count,0)/den
          : null;
        return {name:criterion.name,value};
      });

      const metricSummaryHtml=canShowAverages
        ? `<div class="metricSummaryGrid">${metricSummary.map(metric=>`
            <div class="metricSummaryCard">
              <div class="metricSummaryName">${esc(metric.name)}</div>
              <div class="metricSummaryValue">${metric.value===null?'—':fmt(metric.value)}</div>
              <div class="metricSummaryScale">/ ${scale}</div>
            </div>`).join('')}</div>`
        : '';

      let communityTable='';
      if(canShowAverages&&items.length&&dbCriteria.length){
        communityTable=`<div class="tableWrap"><table><thead><tr><th>${ja?'対象':'Target'}</th>${dbCriteria.map(c=>`<th>${esc(c.name)}</th>`).join('')}<th>${ja?'総合':'Overall'}</th></tr></thead><tbody>${items.map(item=>{
          const overall=itemSummary.find(x=>x.item_id===item.id);
          const overallValue=Number(overall?.response_count||0)>=5?num(overall?.avg_overall):null;
          return `<tr><td>${esc(item.name)}</td>${dbCriteria.map(c=>{
            const s=cMap.get(`${item.id}|${c.id}`);
            return `<td class="${s?.avg_score==null?'na':'score'}">${s?.avg_score==null?'—':fmt(s.avg_score)}</td>`;
          }).join('')}<td class="${overallValue===null?'na':'avg'}">${overallValue===null?'—':fmt(overallValue)}</td></tr>`;
        }).join('')}</tbody></table></div>`;
      }

      const rankingHtml=canShowAverages
        ? (communityRanking.length
          ? communityRanking.slice(0,10).map((item,i)=>`<div class="rankRow"><div class="rankNo">${i+1}</div><div class="rankName">${esc(item.name)}<small>${item.count}${ja?'人':' ratings'}</small></div><div class="rankValue">${fmt(item.value)}</div></div>`).join('')
          : `<div class="emptyCommunity">${ja?'5件以上の評価が集まった対象はまだありません。':'No target has 5 eligible ratings yet.'}</div>`)
        : `<div class="privacyLock"><b>${ja?'平均はまだ非表示':'Averages are still private'}</b><span>${ja?'参加者が5人に達するとCommunity総合ランキングを表示します。':'Community Overall Ranking unlocks when 5 participants have submitted.'}</span></div>`;

      let ownHtml='';
      if(own&&canShowAverages){
        const commMap=new Map(communityRanking.map(x=>[x.itemId,x.value]));
        const rowsOwn=own.values
          .filter(x=>x.value!==null)
          .map(x=>{
            const community=commMap.get(x.itemId)??null;
            const diff=community===null?null:Math.round((x.value-community)*10)/10;
            return `<tr><td>${esc(x.name)}</td><td class="score">${fmt(x.value)}</td><td class="${community===null?'na':'avg'}">${fmt(community)}</td><td class="${diff===null?'na':diff>=0?'diffPlus':'diffMinus'}">${diff===null?'—':`${diff>0?'+':''}${fmt(diff)}`}</td></tr>`;
          }).join('');
        if(rowsOwn){
          ownHtml=`<section class="card compareCommunityCard"><div class="cardTitleRow"><h2>${ja?'あなた vs Community':'You vs Community'}</h2><span class="smallBadge">${ja?'平均点比較':'Average comparison'}</span></div><div class="tableWrap"><table><thead><tr><th>${ja?'対象':'Target'}</th><th>${ja?'あなた':'You'}</th><th>Community</th><th>${ja?'差':'Diff'}</th></tr></thead><tbody>${rowsOwn}</tbody></table></div></section>`;
        }
      }

      document.getElementById('communityContent').className='';
      document.getElementById('communityContent').innerHTML=`
        <div class="communityHero">
          <div class="participantBox">
            <div>
              <div class="participantNumber">${participant}</div>
              <div class="participantLabel">${ja?'参加者':'PARTICIPANTS'}</div>
            </div>
          </div>
          <div class="privacyNote">
            <b>${canShowAverages?(ja?'Community平均を公開中':'Community averages unlocked'):(ja?'プライバシー保護中':'Privacy threshold active')}</b>
            <span>${canShowAverages
              ?(ja?'5人以上の投稿が集まったため、Community平均を表示しています。対象ごとの平均は、その対象を全項目採点した参加者が5人以上いる場合のみ表示します。':'Community averages are available. Each target is shown only when at least 5 participants fully rated that target.')
              :(ja?`現在${participant}人。5人未満では平均点・順位・差分を表示しません。`:`${participant} participant(s). Averages, rankings, and differences stay hidden until 5 participants submit.`)}</span>
          </div>
        </div>

        <div class="communityGrid">
          <section>
            <div class="cardTitleRow"><h2>${ja?'Community総合ランキング':'Community Overall Ranking'}</h2><span class="smallBadge">${canShowAverages?'TOP 10':'5+'}</span></div>
            <div class="ranking">${rankingHtml}</div>
          </section>
          <section>
            <div class="cardTitleRow"><h2>${ja?'項目別Community平均':'Community Metric Averages'}</h2><span class="smallBadge">${canShowAverages?dbCriteria.length:'5+'}</span></div>
            ${canShowAverages
              ?metricSummaryHtml
              :`<div class="privacyLock compact"><b>${ja?'5人で解放':'Unlocks at 5'}</b><span>${ja?'項目別平均も5人未満では表示しません。':'Metric averages remain hidden below 5 participants.'}</span></div>`}
          </section>
        </div>

        ${canShowAverages&&communityTable
          ?`<section class="communityMatrix"><div class="cardTitleRow"><h2>${ja?'Community採点表':'Community Score Matrix'}</h2><span class="smallBadge">${ja?'対象 × 項目':'Target × Metric'}</span></div>${communityTable}</section>`
          :''}
        ${ownHtml}`;
    }else{
      shareParticipant=0;
      shareCommunityRanking=[];
      shareCommunityUnlocked=false;
      syncShareDialog();
      document.getElementById('communityContent').textContent=ja?'この公開ページではCommunity集計が非表示です。':'Community results are hidden for this page.';
    }

    status.classList.add('hidden');content.classList.remove('hidden');
  }catch(e){console.error(e);status.textContent='Could not load this Stats Maker page.\n'+(e?.message||String(e));}
})();
