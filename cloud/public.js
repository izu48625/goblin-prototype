(async()=>{
  'use strict';
  const status=document.getElementById('status');
  const content=document.getElementById('content');

  // Safari/Chrome may restore the public page from BFCache after a Community
  // rating. Reload only on a persisted restore so participant counts are fresh.
  window.addEventListener('pageshow',event=>{
    if(event.persisted)location.reload();
  });
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null};
  const fmt=value=>{const n=num(value);return n===null?'—':(Number.isInteger(n)?String(n):n.toFixed(1))};
  const fmtDate=(value,ja)=>{if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';try{return new Intl.DateTimeFormat(ja?'ja-JP':'en-US',{year:'numeric',month:'short',day:'numeric'}).format(d)}catch{return d.toLocaleDateString()}};
  const average=(scores,criteria,weighted)=>{let total=0,den=0;scores.forEach((raw,i)=>{const score=num(raw);if(score===null)return;const w=weighted?Math.max(0,Number(criteria[i]?.weight??1)):1;total+=score*w;den+=w});return den?Math.round(total/den*10)/10:null};


  // R130: Make genuine published comparisons understandable above the score
  // matrix. Reuse the existing creatorRanking values; no new DB calls or
  // independent scoring rules. Radar polygons use raw criterion scores.
  function publicGlance({rows,criteria,creatorRanking,scale,weighted,ja,publicTargetHtml}){
    const color=['#b65c45','#367a91','#8464ad'];
    const top=creatorRanking.slice(0,3);
    const ranks=top.length?top.map((item,i)=>{
      const pct=Math.max(0,Math.min(100,(item.value/scale)*100));
      return '<div class="glanceRankRow">'+
        '<span class="glanceRankNumber">'+(i+1)+'</span>'+
        '<div class="glanceRankBody">'+
          '<div class="glanceRankHeading"><span class="glanceRankName">'+publicTargetHtml(item.name,item.index)+'</span>'+
            '<strong class="glanceRankScore">'+fmt(item.value)+' <small>/ '+scale+'</small></strong></div>'+
          '<div class="glanceBarTrack"><span style="width:'+pct.toFixed(1)+'%"></span></div>'+
        '</div></div>';
    }).join(''):'<p class="glanceEmpty">'+(ja?'公開された点数はまだありません。':'No published scores yet.')+'</p>';

    // Never turn missing values into zeros or connect an incomplete radar.
    // A radar needs at least two fully scored subjects and 3–10 criteria.
    const radarCandidates=criteria.length>=3&&criteria.length<=10?top.filter(item=>{
      const scores=rows[item.index]?.scores;
      return Array.isArray(scores)&&criteria.every((_,i)=>{
        const n=num(scores[i]);
        return n!==null&&n>=0&&n<=scale;
      });
    }).slice(0,3):[];
    let graph='';
    if(radarCandidates.length>=2){
      const centerX=165,centerY=145,radius=91,n=criteria.length;
      const xy=(i,val)=>{
        const angle=-Math.PI/2+(2*Math.PI*i/n);
        const distance=radius*Math.max(0,Math.min(1,val/scale));
        return [(centerX+Math.cos(angle)*distance).toFixed(1),
          (centerY+Math.sin(angle)*distance).toFixed(1)].join(',');
      };
      const polygon=(values)=>values.map((v,i)=>xy(i,v)).join(' ');
      const rings=[.25,.5,.75,1].map(fraction=>
        '<polygon points="'+polygon(criteria.map(()=>scale*fraction))+'" class="glanceRadarRing"/>').join('');
      const axes=criteria.map((criterion,i)=>{
        const angle=-Math.PI/2+(2*Math.PI*i/n);
        const tx=(centerX+Math.cos(angle)*116).toFixed(1);
        const ty=(centerY+Math.sin(angle)*116+4).toFixed(1);
        return '<line x1="'+centerX+'" y1="'+centerY+'" x2="'+xy(i,scale).replace(',','" y2="')+
          '" class="glanceRadarAxis"/><text x="'+tx+'" y="'+ty+'" text-anchor="middle" class="glanceRadarAxisLabel">'+(i+1)+'</text>';
      }).join('');
      const surfaces=radarCandidates.map((item,i)=>{
        const scores=rows[item.index].scores.slice(0,n).map(Number);
        return '<polygon points="'+polygon(scores)+'" fill="'+color[i]+'" fill-opacity="0.13" stroke="'+color[i]+
          '" stroke-width="2.5" stroke-linejoin="round"/>';
      }).join('');
      const legend=radarCandidates.map((item,i)=>
        '<span class="glanceLegendItem"><i style="background:'+color[i]+'"></i>'+esc(item.name)+'</span>').join('');
      graph='<figure class="glanceRadarFigure"><svg class="glanceRadarSvg" viewBox="0 0 330 290" role="img" aria-labelledby="creatorRadarTitle creatorRadarDescription">'+
        '<title id="creatorRadarTitle">'+(ja?'作成者の項目別レーダーチャート':'Creator criterion-by-criterion radar chart')+'</title>'+
        '<desc id="creatorRadarDescription">'+esc(criteria.map((c,i)=>(i+1)+'. '+c.name).join(' / '))+'</desc>'+
        rings+axes+surfaces+'</svg><figcaption class="glanceRadarLegend">'+legend+'</figcaption></figure>'+
        '<div class="glanceCriteria">'+criteria.map((c,i)=>
          '<span><b>'+(i+1)+'</b> '+esc(c.name)+'</span>').join('')+'</div>';
    }else{
      graph='<div class="glanceNoRadar">'+(ja
        ?'レーダー比較は、3項目以上をすべて採点した対象が2つ以上ある場合に表示します。'
        :'Radar comparison appears when at least two subjects have complete scores across 3 or more criteria.')+'</div>'+
        '<div class="glanceCriteria">'+criteria.map((c,i)=>
          '<span><b>'+(i+1)+'</b> '+esc(c.name)+'</span>').join('')+'</div>';
    }
    return '<section class="publicGlance" aria-labelledby="publicGlanceHeading">'+
      '<div class="glanceHead"><h2 id="publicGlanceHeading">'+(ja?'比較結果をひと目で':'Comparison at a glance')+'</h2>'+
      '<span>'+(weighted?(ja?'重み付け平均':'Weighted average'):(ja?'均等平均':'Equal-weight average'))+'</span></div>'+
      '<div class="glanceLayout">'+
        '<div class="glanceColumn glanceOverall"><h3>'+(ja?'作成者の総合TOP3':'Creator overall top 3')+'</h3>'+
          '<div class="glanceRankList">'+ranks+'</div>'+
          '<p class="glanceMethod">'+(ja
            ?'総合点は公開された各項目の平均です。未採点は0点に置き換えません。'
            :'Overall scores are based on published criterion averages. Missing scores are not zeros.')+'</p>'+
        '</div>'+
        '<div class="glanceColumn glanceBreakdown"><h3>'+(ja?'項目別の強みを比較':'Compare criterion scores')+'</h3>'+
          graph+
          '<p class="glanceMethod">'+(ja
            ?'レーダーは入力された元の点数です。重み付けは総合点にのみ反映しています。'
            :'Radar uses original entered scores; weighting only affects overall averages.')+'</p>'+
        '</div>'+
      '</div>'+
    '</section>';
  }

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

  function ogShareUrl(topicId){
    const origin=String(window.SM_RUNTIME?.ogShareOrigin||'').trim().replace(/\/+$/,'');
    return origin&&topicId?`${origin}/p/${encodeURIComponent(topicId)}`:location.href;
  }

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
        return {itemId:item.id,name:item.name,value:row.every(score=>score!==null)?average(row,criteria,weighted):null};
      });
      return {status:rs.status,values};
    }catch{return null}
  }

  try{
    const id=new URLSearchParams(location.search).get('id');
    if(!id)throw new Error('Topic ID is missing.');
    const sb=window.SM_SUPABASE?.client;if(!sb)throw new Error('Supabase is not ready.');

    const {data,error}=await sb.from('topics')
      .select('id,owner_id,title,description,score_scale,weighted,visibility,allow_ratings,show_community,community_minimum,source_topic_id,published_at,snapshot,snapshot_updated_at,topic_items(id,name,position,image_url),criteria(id,name,weight,position)')
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
    const preferred=localStorage.getItem('statsMaker.locale')||localStorage.getItem('statsMakerV2Language')||navigator.language||'ja';
    const ja=String(preferred).toLowerCase().startsWith('ja');document.documentElement.lang=ja?'ja':'en';document.title=`${data.title} - Stats Maker`;
    const metaDescription=document.querySelector('meta[name="description"]');
    if(metaDescription)metaDescription.content=data.description||`${data.title} - Stats Maker`;
    const footerOpen=document.getElementById('footerOpenApp');
    if(footerOpen)footerOpen.textContent=ja?'Stats Makerを開く':'Open Stats Maker';
    let currentUser=null;
    try{currentUser=(await sb.auth.getUser()).data?.user||null}catch{}
    const isOwner=!!currentUser&&currentUser.id===data.owner_id;
    const communityMinimum=Number(data.community_minimum)===1?1:5;
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
    // R117: issue short-lived image URLs only for viewable topics.
    // The Storage bucket is private and enforces topic visibility/ownership through RLS.
    const imagePathPattern=/^[0-9a-f-]{36}\/([0-9]|[1-3][0-9])[.]jpg$/;
    const imagePaths=items.map(item=>item.image_url)
      .filter(path=>typeof path==='string'&&imagePathPattern.test(path)&&path.startsWith(id+'/'));
    const imageByPath=new Map();
    if(imagePaths.length){
      try{
        const {data:signed,error:signError}=await sb.storage
          .from('topic-target-images').createSignedUrls(imagePaths,600);
        if(signError)throw signError;
        (signed||[]).forEach((entry,index)=>{
          const url=entry?.signedUrl||'';
          if(!entry?.error && typeof url==='string'
            && url.startsWith('https://ibpdxbeltdwkquowjeay.supabase.co/')){
            imageByPath.set(imagePaths[index],url);
          }
        });
      }catch(error){console.warn('[Stats Maker] Target images could not be loaded:',error)}
    }
    const targetImageUrls=items.map(item=>imageByPath.get(item.image_url)||'');
    const hasTargetImages=targetImageUrls.some(Boolean);
    function publicTargetHtml(name,index){
      const url=targetImageUrls[index]||'';
      const image=url
        ?'<img class="publicTargetThumb" loading="lazy" decoding="async" alt="" src="'+esc(url)+'">'
        :(hasTargetImages?'<span class="publicTargetThumb publicTargetMissing" aria-hidden="true"></span>':'');
      return '<span class="publicTargetIdentity">'+image+'<span class="publicTargetText">'+esc(name)+'</span></span>';
    }

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
    const tableRows=rows.map((row,rowIndex)=>{const scores=Array.isArray(row.scores)?row.scores:[];const av=average(scores,criteria,weighted);return `<tr><td>${publicTargetHtml(row.name,rowIndex)}</td>${criteria.map((_,i)=>{const n=num(scores[i]);return `<td class="${n===null?'na':'score'}" ${n===null?'':`data-score-value="${n}" data-score-max="${scale}" style="--score-bg:${n/scale>=1?'#e8b9b2':n/scale>=.9?'#edc9b9':n/scale>=.8?'#f1d9c4':n/scale>=.7?'#efd2a6':n/scale>=.6?'#f8edcc':n/scale>=.5?'#e3edc9':n/scale>0?'#d1dce9':'#c0cfdf'}"`}>${n===null?'—':fmt(n)}</td>`}).join('')}<td class="avg">${av===null?'—':fmt(av)}</td></tr>`}).join('');

    // Public score colors are optional and never change the underlying scores.
    // R38 P16: preserve the single original horizontal scroll matrix on every
    // viewport. Compact mobile columns are controlled only by CSS, not by
    // changing displayed source data, order, or average calculations.

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
                ?`<a class="lineageSource" href="public.html?id=${encodeURIComponent(sourceTopic.id)}&v=r25p3">${esc(sourceTopic.title)}</a>`
                :`<span class="lineageSource unavailable">${ja?'派生元は現在参照できません':'Source is currently unavailable'}</span>`}
            </div>
            <div class="lineageBadge">${lineageRelation==='version'?'VERSION':lineageRelation==='remix'?'REMIX':'SOURCE'}</div>
          </div>`
        :''}

        <div class="summaryStrip">
          <div class="summaryStat">
            <div class="summaryLabel">${ja?'作成者の総合1位':'Creator Overall #1'}</div>
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

        ${publicGlance({rows,criteria,creatorRanking,scale,weighted,ja,publicTargetHtml})}

        <div class="primaryActions">
          ${data.show_community===true&&data.allow_ratings===true&&data.visibility!=='private'
            ?`<a id="communityRateLink" class="actionBtn communityRate" href="index.html?community=${encodeURIComponent(id)}&v=r27std1">${ja?'Communityで採点する':'Rate in Community'}</a>`
            :''}
          <button id="remixBtn" class="actionBtn remix">${ja?'コピーして採点する':'Copy & rate'}<span class="actionCount">${remixCount}</span></button>
          <button id="visualToolsBtn" class="actionBtn visualTools" type="button">${ja?'データやグラフ':'Visual Tools'}</button>
          <button id="shareBtn" class="actionBtn ghost">${ja?'URL共有':'Share URL'}</button>
          <button id="shareImageBtn" class="actionBtn shareImage">${ja?'画像で共有':'Share Image'}</button>
          ${isOwner?`<button id="ownerManageBtn" class="actionBtn owner">${ja?'編集・公開設定':'Edit / Publish settings'}</button>`:''}
        </div>
        ${data.visibility==='public'&&!isOwner?`<div class="reportWorkLine"><button id="reportTopicBtn" class="reportTopicBtn" type="button">${ja?'この作品を通報':'Report this work'}</button></div>`:''}
        ${isOwner?`<div class="ownerHint">${ja?'このブラウザの公開者セッションで開いています。元シートが残っていれば編集画面へ戻せます。':'You are viewing this with the publisher session. If the local source sheet still exists, it will be selected when you return.'}</div>`:''}

        <div class="notice remixNotice">
          <b>${ja?'対象と評価項目をコピーして、自分で採点できます。':'Copy the targets and metrics to score them yourself.'}</b>
          <span>${ja?'元の点数はコピーされません。':'Original scores are not copied.'}</span>
        </div>
        ${rows.some((row,i)=>row.hasLocalImage&&!targetImageUrls[i])?`<div class="notice">${ja?'一部の画像はまだ公開されていません。作成者は画像を保存したブラウザから「公開を更新」すると反映できます。':'Some images are not public yet. The creator can update the publication from the browser where the images are saved.'}</div>`:''}
      </section>

      <div class="grid">
        <section class="card">
          <div class="cardTitleRow"><h2>${ja?'作成者の公開スコア':'Creator Scores'}</h2><label class="scoreColorSwitch"><input id="publicScoreColors" type="checkbox" checked> ${ja?'点数の色':'Score colors'}</label><span class="smallBadge">${rows.length} × ${criteria.length}</span></div>
          <div class="tableWrap creatorScoreTable" role="region" tabindex="0" aria-label="${ja?'作成者の公開スコア：左右スクロール可能':'Creator scores: scroll horizontally'}"><table><thead><tr><th>${ja?'対象':'Target'}</th>${tableHead}<th>${ja?'平均':'Average'}</th></tr></thead><tbody>${tableRows}</tbody></table></div>
        </section>
        <aside>
          <section class="card">
            <div class="cardTitleRow"><h2>${ja?'作成者の総合ランキング':'Creator Overall Ranking'}</h2><span class="smallBadge">TOP ${Math.min(10,creatorRanking.length)}</span></div>
            <div class="ranking">${creatorRanking.length?creatorRanking.slice(0,10).map((item,i)=>`<div class="rankRow"><div class="rankNo">${i+1}</div><div class="rankName">${publicTargetHtml(item.name,item.index)}</div><div class="rankValue">${fmt(item.value)}</div></div>`).join(''):`<div class="emptyCommunity">${ja?'採点データがありません。':'No scored data yet.'}</div>`}</div>
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
              <button class="shareChoice active" data-share-template="creator" type="button"><b>${ja?'作成者 TOP3':'Creator TOP3'}</b><span>${ja?'作成者の総合ランキング':'Creator overall ranking'}</span></button>
              <button id="shareCommunityChoice" class="shareChoice" data-share-template="community" type="button"><b>Community TOP3</b><span id="shareCommunityChoiceSub">${ja?`${communityMinimum}人以上で利用可能`:`Available at ${communityMinimum}+ participants`}</span></button>
              <button class="shareChoice" data-share-template="overview" type="button"><b>${ja?'概要カード':'Overview'}</b><span>${ja?'対象数・項目数・尺度・参加者':'Targets, metrics, scale, participants'}</span></button>
            </div>
          </div>

          <div id="shareImageSelectionNote" class="shareImageSelectionNote"></div>
          <button id="shareImageCreateBtn" class="actionBtn shareImage shareImageCreateBtn" type="button">${ja?'作成して共有':'Create & Share'}</button>
        </div>
      </div>`;

    // Public-only short key; no private/unlisted topic IDs or user content.
    if(data.visibility==='public'&&!window.__smPublicWorkViewSent){
      window.__smPublicWorkViewSent=true;
      window.SM_ANALYTICS?.event('work_view',{
        visibility:'public',
        eligible:data.show_community===true&&data.allow_ratings===true?'yes':'no',
        work_code:String(id).slice(0,8).toLowerCase()
      });
    }

    // R118: graph creation uses published creator scores and a local-only
    // snapshot. Neither original topic nor Community scores are mutated.
    window.SM_PUBLIC_VISUAL_SOURCE={
      id:data.id,title:data.title,description:data.description||'',
      rows,criteria,imageUrls:targetImageUrls,scale,weighted,locale:ja?'ja':'en'
    };
    window.dispatchEvent(new Event('statsmaker:public-visual-ready'));
    document.getElementById('visualToolsBtn').onclick=()=>
      window.dispatchEvent(new Event('statsmaker:open-public-visuals'));

    document.getElementById('remixBtn').onclick=()=>{
      try{
        const sheet=window.SM_REMIX.buildSheet(data,snap,dbCriteria,items,ja?'ja':'en');
        window.SM_REMIX.saveSheet(sheet);
        // One-time navigation intent: a copied Home URL must not reopen this sheet.
        try{sessionStorage.setItem('statsMaker:openRemix',sheet.id)}catch{}
        toast(ja?'採点用のコピーを作りました。':'Scoring copy created.');
        setTimeout(()=>{const target='index.html?remixed=1&v=r25p3';location.href=window.SM_AD_PREVIEW_NAV?.url(target)||target},500);
      }catch(e){toast((ja?'Remixに失敗しました：':'Remix failed: ')+(e?.message||e))}
    };
    document.getElementById('shareBtn').onclick=async()=>{
      try{
        const url=ogShareUrl(id);
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
          :(ja?`${communityMinimum}人以上で利用可能`:`Available at ${communityMinimum}+ participants`);
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
        const url=ogShareUrl(id);

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
        const target='index.html?v=r25p3&from=public';
        location.href=window.SM_AD_PREVIEW_NAV?.url(target)||target;
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
      const canShowAverages=participant>=communityMinimum;
      const itemSummary=itemRes.data||[];
      const criterionSummary=criterionRes.data||[];
      const itemById=new Map(items.map(i=>[i.id,i]));
      const communityRanking=itemSummary
        .map(s=>({
          itemId:s.item_id,
          name:itemById.get(s.item_id)?.name||'',
          count:Number(s.response_count||0),
          value:canShowAverages&&Number(s.response_count||0)>=communityMinimum?num(s.avg_overall):null
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
          {...s,avg_score:canShowAverages&&Number(s.response_count||0)>=communityMinimum?num(s.avg_score):null}
        ])
      );

      const metricSummary=dbCriteria.map(criterion=>{
        const rowsForMetric=criterionSummary
          .filter(row=>row.criterion_id===criterion.id&&canShowAverages&&Number(row.response_count||0)>=communityMinimum&&num(row.avg_score)!==null)
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
          const overallValue=Number(overall?.response_count||0)>=communityMinimum?num(overall?.avg_overall):null;
          return `<tr><td>${esc(item.name)}</td>${dbCriteria.map(c=>{
            const s=cMap.get(`${item.id}|${c.id}`);
            return `<td class="${s?.avg_score==null?'na':'score'}">${s?.avg_score==null?'—':fmt(s.avg_score)}</td>`;
          }).join('')}<td class="${overallValue===null?'na':'avg'}">${overallValue===null?'—':fmt(overallValue)}</td></tr>`;
        }).join('')}</tbody></table></div>`;
      }

      const rankingHtml=canShowAverages
        ? (communityRanking.length
          ? communityRanking.slice(0,10).map((item,i)=>`<div class="rankRow"><div class="rankNo">${i+1}</div><div class="rankName">${esc(item.name)}<small>${item.count}${ja?'人':' ratings'}</small></div><div class="rankValue">${fmt(item.value)}</div></div>`).join('')
          : `<div class="emptyCommunity">${ja?`${communityMinimum}件以上の評価が集まった対象はまだありません。`:`No target has ${communityMinimum} eligible ratings yet.`}</div>`)
        : `<div class="privacyLock"><b>${ja?'平均はまだ非表示':'Averages are still private'}</b><span>${ja?`あと${Math.max(0,communityMinimum-participant)}人でCommunity総合ランキングを公開します。`:`Community ranking unlocks after ${communityMinimum} participants.`}</span></div>`;

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
              ?(ja?`Community平均を公開中。${participant===1?'参加者1人のため暫定結果です。':''}対象ごとの平均は、全項目を採点した人が${communityMinimum}人以上いる場合に表示します。`:`Community averages are available. ${participant===1?'This is a provisional result from one voter. ':''}Each target needs ${communityMinimum} completed ratings.`)
              :(ja?`現在${participant}人。あと${Math.max(0,communityMinimum-participant)}人で集計結果を表示します。`:`${participant} participant(s). ${Math.max(0,communityMinimum-participant)} more needed to unlock results.`)}</span>
          </div>
        </div>

        <div class="communityGrid">
          <section>
            <div class="cardTitleRow"><h2>${ja?'Community総合ランキング':'Community Overall Ranking'}</h2><span class="smallBadge">${canShowAverages?'TOP 10':`${communityMinimum}+`}</span></div>
            <div class="ranking">${rankingHtml}</div>
          </section>
          <section>
            <div class="cardTitleRow"><h2>${ja?'項目別Community平均':'Community Metric Averages'}</h2><span class="smallBadge">${canShowAverages?dbCriteria.length:`${communityMinimum}+`}</span></div>
            ${canShowAverages
              ?metricSummaryHtml
              :`<div class="privacyLock compact"><b>${ja?`${communityMinimum}人で公開`:`Unlocks at ${communityMinimum}`}</b><span>${ja?`項目別平均も${communityMinimum}人未満では非表示です。`:`Metric averages are hidden below ${communityMinimum} participants.`}</span></div>`}
          </section>
        </div>

        ${canShowAverages&&communityTable
          ?`<section class="communityMatrix"><div class="cardTitleRow"><h2>${ja?'Community採点表':'Community Score Matrix'}</h2><span class="smallBadge">${ja?'対象 × 項目':'Target × Metric'}</span></div>${communityTable}</section>`
          :''}
        ${ownHtml}`;
      function enhanceCommunity(root,ja,items,criteria,criterionSummary,communityRanking,own,minimum,unlocked){
  const grid=root.querySelector(".communityGrid");
  if(!grid)return;
  grid.classList.add("communityResultsGrid");
  const rankingSection=grid.children[0];
  const metricSection=grid.children[1];
  if(rankingSection){
    rankingSection.classList.add("communityRankingSection");
    const title=rankingSection.querySelector("h2");
    if(title)title.textContent=ja?"みんなの総合ランキング":"Community Overall Ranking";
  }
  const make=(tag,className,value)=>{
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(value!==undefined)el.textContent=String(value);
    return el;
  };
  const short=(value)=>Number(Number(value).toFixed(1)).toString();
  // Rebuild the comparison. Existing overall results include the current
  // participant, so subtract their completed submitted score first.
  const compare=root.querySelector(".compareCommunityCard")||make("section","compareCommunityCard");
  compare.classList.add("communityCompareSection");
  compare.replaceChildren();
  const compareHead=make("div","cardTitleRow");
  compareHead.appendChild(make("h2","",ja?"あなた vs みんな":"You vs other participants"));
  compareHead.appendChild(make("span","smallBadge",ja?"自分を除いた平均":"Excludes your rating"));
  compare.appendChild(compareHead);
  compare.appendChild(make("p","communityHelp",ja?
    "差＝あなたの点数 − ほかの参加者の平均。プラスはあなたの方が高く評価。":
    "Difference = your score minus the average rating of everyone else."));
  if(!unlocked||!own||own.status!=="submitted"){
    compare.appendChild(make("p","communityWaiting",ja?
      "採点を投稿すると、ほかの参加者との評価差を比較できます。":
      "Submit a rating to compare your scores with other participants."));
  }else{
    const overallById=new Map(communityRanking.map(v=>[v.itemId,v]));
    const entries=own.values.filter(v=>v.value!==null);
    const comparable=entries.some(v=>{
      const all=overallById.get(v.itemId);
      return all && all.count-1>=Math.max(1,minimum);
    });
    if(!comparable){
      compare.appendChild(make("p","communityWaiting",ja?
        "ほかの参加者の採点待ちです。自分1人のときは差を0と表示しません。":
        "Waiting for other participants. A solo rating is not shown as a zero difference."));
    }
    if(entries.length){
      const wrap=make("div","tableWrap communityCompareTable");
      const table=make("table");
      const thead=make("thead"),theadRow=make("tr");
      [ja?"対象":"Target",ja?"あなた":"You",ja?"みんな":"Others",ja?"差":"Diff"].forEach(n=>theadRow.appendChild(make("th","",n)));
      thead.appendChild(theadRow);table.appendChild(thead);
      const tbody=make("tbody");
      entries.forEach(entry=>{
        const pooled=overallById.get(entry.itemId);
        const otherCount=pooled?pooled.count-1:0;
        // RPC reports a pooled 2-decimal mean. Show one decimal for the
        // reconstructed other-participant mean to avoid false precision.
        const other=pooled&&otherCount>=Math.max(1,minimum)
          ?(pooled.value*pooled.count-entry.value)/otherCount:null;
        const diff=other===null?null:Number((entry.value-other).toFixed(1));
        const tr=make("tr");
        tr.appendChild(make("td","",entry.name));
        tr.appendChild(make("td","score",short(entry.value)));
        tr.appendChild(make("td",other===null?"na":"avg",other===null?"—":short(other)));
        tr.appendChild(make("td",diff===null?"na":diff>0?"diffPlus":diff<0?"diffMinus":"na",
          diff===null?"—":(diff>0?"+":"")+short(diff)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);wrap.appendChild(table);compare.appendChild(wrap);
    }
  }
  if(metricSection)grid.insertBefore(compare,metricSection);
  else grid.appendChild(compare);
  // Replace cross-team metric averages with a switchable ranking for each
  // criterion; only public, threshold-qualified aggregate values are used.
  if(metricSection){
    metricSection.classList.add("communityMetricSection");
    metricSection.replaceChildren();
    const header=make("div","cardTitleRow");
    header.appendChild(make("h2","",ja?"項目別ランキング":"Rankings by metric"));
    header.appendChild(make("span","smallBadge",String(criteria.length)+(ja?"項目":" metrics")));
    metricSection.appendChild(header);
    if(unlocked){
      const label=make("label","communityMetricControl",ja?"比較項目 ":"Metric ");
      const select=make("select");
      select.id="communityMetricSelect";
      select.setAttribute("aria-label",ja?"比較する評価項目":"Metric to compare");
      criteria.forEach((criterion,i)=>{
        const opt=make("option","",criterion.name);opt.value=String(i);select.appendChild(opt);
      });
      label.appendChild(select);metricSection.appendChild(label);
      const list=make("div","ranking communityMetricRanking");
      list.setAttribute("aria-live","polite");
      metricSection.appendChild(list);
      const render=()=>{
        list.replaceChildren();
        const criterion=criteria[Number(select.value)];
        if(!criterion)return;
        const rows=items.map(item=>{
          const data=criterionSummary.find(s=>s.item_id===item.id&&s.criterion_id===criterion.id);
          return {name:item.name,count:Number(data?.response_count||0),value:Number(data?.avg_score)};
        }).filter(row=>row.count>=minimum&&Number.isFinite(row.value))
          .sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,ja?"ja":"en"));
        if(!rows.length){
          list.appendChild(make("p","communityWaiting",ja?"この項目はまだ集計待ちです。":"Waiting for ratings on this metric."));
          return;
        }
        rows.forEach((row,i)=>{
          const wrapper=make("div","rankRow");
          wrapper.appendChild(make("div","rankNo",i+1));
          const name=make("div","rankName",row.name);
          name.appendChild(make("small","",row.count+(ja?"人の回答":" ratings")));
          wrapper.appendChild(name);
          wrapper.appendChild(make("div","rankValue",short(row.value)));
          list.appendChild(wrapper);
        });
      };
      select.addEventListener("change",render);
      render();
    }else{
      metricSection.appendChild(make("p","communityWaiting",ja?
        "必要な参加者数に達すると項目別ランキングが表示されます。":
        "Rankings appear once enough participants submit."));
    }
  }
  // The first column previously consumed the screen on mobile.
  // Default to one criterion + Overall, with an option for the full matrix.
  const matrix=root.querySelector(".communityMatrix");
  if(matrix){
    matrix.classList.add("communityCompactMatrix");
    const header=matrix.querySelector(".cardTitleRow h2");
    if(header)header.textContent=ja?"詳細採点表":"Detailed score matrix";
    const wrap=matrix.querySelector(".tableWrap");
    if(wrap){
      wrap.classList.add("communityScoreTable");
      const table=wrap.querySelector("table");
      const heading=make("div","communityMatrixControls");
      const label=make("label","communityMetricControl",ja?"表示項目 ":"Show metric ");
      const select=make("select");
      select.id="communityTableMetricSelect";
      select.setAttribute("aria-label",ja?"採点表の表示項目":"Visible score matrix column");
      criteria.forEach((criterion,i)=>{
        const opt=make("option","",criterion.name);opt.value=String(i);select.appendChild(opt);
      });
      const allOpt=make("option","",ja?"すべての項目":"All metrics");
      allOpt.value="all";select.appendChild(allOpt);label.appendChild(select);
      heading.appendChild(label);
      heading.appendChild(make("span","communityHelp",ja?
        "すべて表示すると横スクロールできます。":"Scroll sideways to view all metrics."));
      matrix.insertBefore(heading,wrap);
      const apply=()=>{
        const val=select.value;matrix.dataset.view=val;
        const rows=table?Array.from(table.rows):[];
        rows.forEach(row=>{
          Array.from(row.cells).forEach((cell,index)=>{
            const criterionIndex=index-1;
            cell.hidden=val!=="all"&&criterionIndex>=0&&criterionIndex<criteria.length&&criterionIndex!==Number(val);
          });
        });
      };
      select.value=window.innerWidth<=700?"0":"all";
      select.addEventListener("change",apply);
      apply();
    }
  }
}
      enhanceCommunity(document.getElementById('communityContent'),ja,items,dbCriteria,criterionSummary,communityRanking,own,communityMinimum,canShowAverages);
    }else{
      shareParticipant=0;
      shareCommunityRanking=[];
      shareCommunityUnlocked=false;
      syncShareDialog();
      document.getElementById('communityContent').textContent=ja?'この公開ページではCommunity集計が非表示です。':'Community results are hidden for this page.';
    }

    const colorSwitch=document.getElementById('publicScoreColors');
    if(colorSwitch){let enabled=true;try{enabled=localStorage.getItem('statsmaker.publicScoreColors')!=='off'}catch{}colorSwitch.checked=enabled;document.body.classList.toggle('publicScoreColorsOff',!enabled)}
    status.classList.add('hidden');content.classList.remove('hidden');
  }catch(e){console.error(e);status.textContent='Could not load this Stats Maker page.\n'+(e?.message||String(e));}

  document.addEventListener('change',event=>{
    if(event.target?.id==='publicScoreColors'){
      document.body.classList.toggle('publicScoreColorsOff',!event.target.checked);
      try{localStorage.setItem('statsmaker.publicScoreColors',event.target.checked?'on':'off')}catch{}
    }
  });
})();
