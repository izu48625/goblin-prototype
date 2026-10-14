// R43: cache only Public ranking IDs, never topic title, snapshot or user content.
// Every cache HIT rehydrates rows against current Public RLS.
const SUPABASE_URL='https://ibpdxbeltdwkquowjeay.supabase.co';
const SUPABASE_KEY='sb_publishable_6abnwW_1p-U_Y_DefUXfFQ_Dz_Y2vsD';
const CATEGORIES=new Set(['all','sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other']);
const SORTS=new Set(['newest','popular','community','remix']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TTL=20;

async function dbRpc(fn,params){
  const res=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn,{
    method:'POST',
    headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,
      'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(params)
  });
  if(!res.ok)throw new Error('Discover upstream '+res.status);
  return res.json();
}
function response(data,status=200,cacheState='bypass'){
  return Response.json(data,{status,headers:{
    'Cache-Control':'private, no-store',
    'X-Stats-Maker-Discover-Cache':cacheState,
    'X-Content-Type-Options':'nosniff'
  }});
}
function checked(data){
  if(!data||!Array.isArray(data.rows)||data.rows.length>12||
      !Number.isSafeInteger(Number(data.total))||Number(data.total)<0||
      typeof data.has_more!=='boolean'||typeof data.anchor!=='string'||
      data.rows.some(t=>!UUID.test(String(t?.id||''))||t.visibility!=='public'))
    throw new Error('Malformed Public Discover response');
  return data;
}
function parse(url){
  const q=url.searchParams;
  const query=q.get('query')||'';
  if(query.length>120)throw Error('query too long');
  const rawOffset=q.get('offset')||'0',rawLimit=q.get('limit')||'12';
  if(!/^(0|[1-9]\d{0,5})$/.test(rawOffset)||rawLimit!=='12')throw Error('bad pagination');
  const sort=q.get('sort')||'newest',category=q.get('category')||'all';
  const view=q.get('view')||'all',locale=q.get('locale')||'ja';
  if(!SORTS.has(sort)||!CATEGORIES.has(category)||!['all','community'].includes(view)||
      !['ja','en'].includes(locale))throw Error('bad filter');
  const anchor=q.get('anchor')||null;
  if(anchor&&(anchor.length>40||!Number.isFinite(Date.parse(anchor))))throw Error('bad anchor');
  return {query,sort,category,view,locale,offset:Number(rawOffset),anchor};
}
function params(input){
  return {p_query:input.query,p_category:input.category,p_view:input.view,
    p_sort:input.sort,p_locale:input.locale,p_offset:input.offset,p_limit:12,p_anchor:input.anchor};
}
function cacheable(input){
  return input.query===''&&input.category==='all'&&input.view==='all'&&
    input.offset===0&&!input.anchor&&['newest','popular'].includes(input.sort);
}
function cacheKey(input){
  return new Request('https://statsmaker.app/__internal/discover-v1?sort='+input.sort+'&locale='+input.locale);
}
function validIndex(d){
  return d&&Array.isArray(d.ids)&&d.ids.length<=12&&d.ids.every(id=>UUID.test(id))&&
    new Set(d.ids).size===d.ids.length&&Number.isSafeInteger(d.total)&&d.total>=0&&
    typeof d.has_more==='boolean'&&typeof d.anchor==='string'&&Number.isFinite(Date.parse(d.anchor));
}

export async function discoverPublicRequest(request,env,ctx){
  if(request.method!=='GET')return response({error:'method_not_allowed'},405);
  let input;
  try{input=parse(new URL(request.url))}
  catch{return response({error:'invalid_query'},400)}
  if(env.DISCOVER_RATE_LIMIT){
    try{
      const ip=request.headers.get('CF-Connecting-IP')||'unknown-client';
      const rate=await env.DISCOVER_RATE_LIMIT.limit({key:ip});
      if(!rate.success)return response({error:'rate_limited'},429);
    }catch{return response({error:'temporarily_unavailable'},503)}
  }
  try{
    const useCache=cacheable(input)&&typeof caches!=='undefined'&&!!caches.default;
    if(useCache){
      let old=null;
      try{
        const saved=await caches.default.match(cacheKey(input));
        if(saved)old=await saved.json();
      }catch{old=null}
      if(validIndex(old)){
        // Current live Public-only RLS check. No topic content was cached.
        const rows=await dbRpc('discover_public_cards_by_ids_v1',{
          p_ids:old.ids,p_view:input.view,p_anchor:old.anchor
        });
        if(Array.isArray(rows)&&rows.length===old.ids.length&&
            rows.every((r,i)=>r?.id===old.ids[i]&&r.visibility==='public')){
          return response(checked({
            rows,total:old.total,has_more:old.has_more,anchor:old.anchor
          }),200,'hit-verified');
        }
        // Visibility changed or hydration failed: discard stale index and
        // recompute. This is fail-closed for Public -> Private/Unlisted.
      }
    }
    const fresh=checked(await dbRpc('discover_public_works_v1',params(input)));
    if(useCache){
      const index={ids:fresh.rows.map(r=>r.id),total:Number(fresh.total),
        has_more:fresh.has_more,anchor:fresh.anchor};
      const save=caches.default.put(cacheKey(input),
        new Response(JSON.stringify(index),{headers:{
          'Content-Type':'application/json','Cache-Control':'public, max-age='+TTL
        }}));
      if(ctx?.waitUntil)ctx.waitUntil(save.catch(()=>{}));
      else await save.catch(()=>{});
    }
    return response(fresh,200,useCache?'miss':'bypass');
  }catch(error){
    console.error('[Stats Maker] Public Discover gateway',error);
    return response({error:'temporarily_unavailable'},503);
  }
}
