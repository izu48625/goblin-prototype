// Server-render Discover's first Public page for people and no-JavaScript readers.
// All rows come from the existing bounded Public-only Discover gateway, which
// applies the same rate limit, current RLS check and ID-only cache as the UI.
// Never cache HTML or submitted user text: Public visibility can be revoked.
import {discoverPublicRequest} from './discover-public.js';

const CATEGORIES=new Set(['all','sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other']);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
const trim=(value,max=160)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const cssCategory=topic=>{
  const value=topic?.snapshot?.metadata?.category;
  return CATEGORIES.has(value)&&value!=='all'?value:'other';
};
const maxScore=topic=>Number(topic?.snapshot?.scale||topic?.score_scale)===10?10:100;

function preview(topic){
  const snap=topic.snapshot&&typeof topic.snapshot==='object'?topic.snapshot:{};
  const criteria=Array.isArray(snap.criteria)?snap.criteria.slice(0,10):[];
  const rows=Array.isArray(snap.rows)?snap.rows.slice(0,40):[];
  const weighted=typeof snap.weighted==='boolean'?snap.weighted:topic.weighted===true;
  return rows.map((row,index)=>{
    let sum=0,den=0;
    for(let j=0;j<criteria.length;j++){
      const raw=row?.scores?.[j];
      if(raw==null||raw==='')continue;
      const score=Number(raw);
      const weight=weighted?Math.max(0,Number(criteria[j]?.weight??1)):1;
      if(!Number.isFinite(score)||!Number.isFinite(weight))continue;
      sum+=score*weight;den+=weight;
    }
    return {index,name:trim(row?.name,90)||'Target '+(index+1),
      value:den?Math.round(sum/den*10)/10:null};
  }).filter(v=>v.value!==null).sort((a,b)=>b.value-a.value||a.index-b.index).slice(0,3);
}

function card(topic,locale){
  const id=String(topic.id);
  const href='/work/'+encodeURIComponent(id);
  const category=cssCategory(topic);
  const scores=preview(topic),scale=maxScore(topic);
  const rows=scores.map((item,i)=>{
    const pct=Math.round(Math.max(0,Math.min(100,item.value/scale*100))*10)/10;
    return '<div class="visualRow"><div class="visualRank">'+(i+1)+'</div>'+
      '<div class="visualMain"><div class="visualName">'+esc(item.name)+'</div>'+
      '<div class="visualTrack"><i style="width:'+pct+'%"></i></div></div>'+
      '<div class="visualValue">'+esc(item.value)+'</div></div>';
  }).join('');
  const visual=scores.length
    ?'<div class="workVisual visualCategory-'+category+'"><div class="visualTop"><span>STATS MAKER</span><span>TOP 3</span></div><div class="visualRows">'+rows+'</div></div>'
    :'<div class="workVisual visualCategory-'+category+' emptyVisual"><span>STATS MAKER</span><b>NO SCORE DATA</b></div>';
  const metrics=Array.isArray(topic.snapshot?.criteria)
    ?topic.snapshot.criteria.slice(0,3).map(x=>trim(x?.name,48)).filter(Boolean):[];
  const metricHint=metrics.length?'<div class="cardMeta compactMeta"><span class="metaChip">'+
    esc(locale==='en'?'Criteria: ':'評価項目：')+esc(metrics.join(' / '))+'</span></div>':'';
  return '<article class="workCard" data-public-id="'+esc(id)+'">'+
    '<div class="cardTop"><div class="visibility">PUBLIC</div><div class="languageBadge">'+
    (topic.language_code==='en'?'EN':'JA')+'</div></div>'+
    '<a class="workMainLink" href="'+href+'">'+visual+
    '<h2 class="workTitle">'+esc(trim(topic.title,140)||'Untitled')+'</h2>'+
    '<div class="workDesc">'+esc(trim(topic.description,240))+'</div></a>'+
    metricHint+'<div class="cardFoot compactFoot"><span>'+esc(category.replace(/_/g,' '))+
    '</span><a class="openLabel" href="'+href+'">'+(locale==='en'?'View scores':'採点結果を見る')+'</a></div></article>';
}

const noStoreHeaders={'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};

export async function discoverSsrPage(request,env,ctx){
  if(request.method!=='GET'&&request.method!=='HEAD')
    return new Response('Method Not Allowed',{status:405,headers:{...noStoreHeaders,Allow:'GET, HEAD'}});
  const url=new URL(request.url);
  const assetUrl=new URL('/discover.html',url);
  let asset;
  try{asset=await env.ASSETS.fetch(new Request(assetUrl))}
  catch(error){
    console.error('[Stats Maker] Discover shell unavailable',error);
    return new Response('Temporarily unavailable',{status:503,headers:{...noStoreHeaders,'X-Robots-Tag':'noindex,follow'}});
  }
  if(!asset.ok)return new Response('Temporarily unavailable',{status:503,headers:{...noStoreHeaders,'X-Robots-Tag':'noindex,follow'}});
  // HEAD must not consume Supabase Free requests or the expensive Discover limiter.
  if(request.method==='HEAD')return new Response(null,{status:200,headers:noStoreHeaders});
  const shell=await asset.text();
  const categoryParam=url.searchParams.get('category');
  const category=CATEGORIES.has(categoryParam)?categoryParam:'all';
  const view=url.searchParams.get('view')==='community'?'community':'all';
  const lang=url.searchParams.get('lang');
  const locale=lang==='en'||lang==='ja'?lang:
    (request.headers.get('Accept-Language')||'').toLowerCase().startsWith('en')?'en':'ja';
  const apiUrl=new URL('/api/discover',url);
  for(const [key,value] of Object.entries({query:'',sort:'newest',category,view,locale,
    offset:'0',limit:'12'}))apiUrl.searchParams.set(key,value);
  const ip=request.headers.get('CF-Connecting-IP');
  const headers=ip?{'CF-Connecting-IP':ip}:{};
  let result=null;
  try{
    const upstream=await discoverPublicRequest(new Request(apiUrl,{headers}),env,ctx);
    if(upstream.ok)result=await upstream.json();
  }catch(error){console.error('[Stats Maker] Discover SSR failed',error)}
  const marker='<main id="grid" class="discoverGrid hidden"></main>';
  const statusMarker='<div id="status" class="status">公開作品を読み込んでいます…</div>';
  if(!shell.includes(marker)||!shell.includes(statusMarker)){
    console.error('[Stats Maker] Discover SSR shell markers absent');
    return new Response(shell,{status:200,headers:{...noStoreHeaders,'X-Robots-Tag':'noindex,follow'}});
  }
  if(!result){
    // Preserve JS fallback for visitors, but do not index a failed, empty shell.
    return new Response(shell,{status:200,headers:{...noStoreHeaders,'X-Robots-Tag':'noindex,follow'}});
  }
  const cards=result.rows.map(t=>card(t,locale)).join('');
  const initial=JSON.stringify({locale,category,view,data:result})
    .replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
    .replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const noJsEmpty='<div class="empty">'+(locale==='en'?'No Public works match these filters.':'条件に合う公開作品がありません。')+'</div>';
  const grid='<main id="grid" class="discoverGrid">'+(cards||noJsEmpty)+'</main>'+
    '<script type="application/json" id="discover-ssr-data">'+initial+'</script>';
  const meta=locale==='en'?result.total+' Public works':result.total+'件のPublic作品';
  const html=shell.replace(statusMarker,'<div id="status" class="status hidden">公開作品を読み込んでいます…</div>')
    .replace(marker,grid)
    .replace('<div id="resultMeta" class="resultMeta">読み込み中…</div>',
      '<div id="resultMeta" class="resultMeta">'+esc(meta)+'</div>');
  return new Response(html,{status:200,headers:noStoreHeaders});
}
