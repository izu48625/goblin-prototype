import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {discoverPublicRequest} from '../worker/discover-public.js';

const ids={public:'11111111-1111-4111-8111-111111111111',unlisted:'22222222-2222-4222-8222-222222222222',private:'33333333-3333-4333-8333-333333333333'};
const visibility=new Map(Object.entries(ids).map(([v,id])=>[id,v]));
const BASE='https://statsmaker.app';
const calls={seo:[],seoHead:[],ogDb:[],share:[],vercel:[],discover:[]};
const prevFetch=globalThis.fetch;
const snapshot={rows:[{name:'Messi & Ronaldo',scores:Array(10).fill(90),image_url:'UNNEEDED'},
                      {name:'<img src=x onerror=alert(1)>',scores:[66]}],
                criteria:[{name:'Finishing',weight:1},'Agility']};
const row={id:ids.public,title:'Football Best',description:'Compare elite football players',
           language_code:'en',snapshot_updated_at:'2026-10-16T08:00:00Z',
           published_at:'2026-10-15T08:00:00Z'};
const limiter={async limit(){return {success:true}}};
const env={OG_RATE_LIMIT:limiter,SHARE_RATE_LIMIT:limiter,DISCOVER_RATE_LIMIT:limiter,
           ASSETS:{async fetch(){return new Response('asset')}}};
const call=(uri,method='GET',options=env)=>worker.fetch(new Request(BASE+uri,{method}),options);
function project(select,r){
  assert(!select.split(',').includes('snapshot'),'Full snapshot transferred to SEO');
  return Object.fromEntries(select.split(',').map(col=>{
    const [alias,source]=col.includes(':')?col.split(':'):[col,col];
    if(/^seo_row_\d+$/.test(alias))return [alias,snapshot.rows[Number(alias.slice(8))]?.name??null];
    if(/^seo_metric_\d+$/.test(alias))return [alias,snapshot.criteria[Number(alias.slice(11))]??null];
    assert(Object.hasOwn(r,source),'Unknown projection '+source);
    return [alias,r[source]];
  }));
}
globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  if(url.hostname.endsWith('.supabase.co')&&url.pathname==='/rest/v1/topics'){
    const id=(url.searchParams.get('id')||'').replace(/^eq\./,'');
    const select=url.searchParams.get('select')||'';
    const publicOnly=url.searchParams.get('visibility')==='eq.public';
    const allowed=publicOnly?visibility.get(id)==='public':['public','unlisted'].includes(visibility.get(id));
    const kind=publicOnly?(select==='id'?'seoHead':'seo'):
      (select==='id,visibility'?'ogDb':'share');
    calls[kind].push({id,select});
    if(!allowed)return Response.json([]);
    return Response.json([project(select,{...row,id,visibility:visibility.get(id)})]);
  }
  if(url.hostname==='stats-maker-ogp.vercel.app'){
    calls.vercel.push(url.href);
    return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
  }
  if(url.pathname.endsWith('/discover_public_works_v1')){
    calls.discover.push(url.href);
    return Response.json({rows:[],total:0,has_more:false,anchor:'2026-10-16T08:00:00Z'});
  }
  throw Error('Unexpected upstream '+url.href);
};
try{
  let res=await call('/work/'+ids.public);
  assert.equal(res.status,200);
  const html=await res.text();
  assert(html.includes('Messi &amp; Ronaldo'));
  assert(html.includes('Finishing')&&html.includes('Agility'));
  assert(!html.includes('<img src=x onerror=alert(1)>'));
  assert(!html.includes('UNNEEDED'));
  assert.equal(calls.seo.length,1);
  assert(calls.seo[0].select.includes('seo_row_17:snapshot->rows->17->>name'));
  assert(calls.seo[0].select.includes('seo_metric_9:snapshot->criteria->9'));
  assert(!calls.seo[0].select.split(',').includes('snapshot'));
  res=await call('/work/'+ids.public,'HEAD');
  assert.equal(res.status,200);assert.equal(await res.text(),'');
  assert.equal(calls.seo.length,1,'HEAD cannot fetch snapshot data');
  assert.equal(calls.seoHead.at(-1).select,'id');
  assert.equal((await call('/work/'+ids.unlisted,'HEAD')).status,404);
  visibility.set(ids.public,'private');
  assert.equal((await call('/work/'+ids.public,'HEAD')).status,404);
  visibility.set(ids.public,'public');
  res=await call('/api/og?id='+ids.public);
  assert.equal(res.status,200);assert.equal(calls.vercel.length,1);
  assert.equal(calls.ogDb.at(-1).select,'id,visibility');
  res=await call('/api/og?id='+ids.public,'HEAD');
  assert.equal(res.status,200);
  assert.equal(res.headers.get('Cache-Control'),'private, no-store');
  assert.equal(await res.text(),'');
  assert.equal(calls.vercel.length,1,'OG HEAD must not invoke Vercel');
  visibility.set(ids.public,'private');
  assert.equal((await call('/api/og?id='+ids.public,'HEAD')).status,404);
  assert.equal(calls.vercel.length,1);
  visibility.set(ids.public,'public');
  assert.equal((await call('/api/og?id='+ids.unlisted,'HEAD')).status,200);
  res=await call('/p/'+ids.public,'HEAD');
  assert.equal(res.status,200);assert.equal(await res.text(),'');
  assert.equal((await call('/p/'+ids.private,'HEAD')).status,404);
  assert.equal((await call('/p/'+ids.unlisted)).status,200);
  const before=calls.seo.length+calls.seoHead.length+calls.share.length+calls.ogDb.length;
  for(const uri of ['/sitemap.xml','/sitemap-static.xml','/sitemap-works-1.xml']){
    res=await call(uri,'HEAD');assert.equal(res.status,200);assert.equal(await res.text(),'');
  }
  assert.equal((await call('/sitemap-works-251.xml','HEAD')).status,404);
  assert.equal(calls.seo.length+calls.seoHead.length+calls.share.length+calls.ogDb.length,before,
    'Sitemap HEAD cannot contact DB');
  const search=new Request(BASE+'/api/discover?sort=popular&limit=12');
  assert.equal((await discoverPublicRequest(search,{},null)).status,503);
  assert.equal((await discoverPublicRequest(search,{DISCOVER_RATE_LIMIT:{async limit(){throw Error('oops')}}},null)).status,503);
  const limited=await discoverPublicRequest(search,{DISCOVER_RATE_LIMIT:{async limit(){return {success:false}}}},null);
  assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'60');
  assert.equal(calls.discover.length,0,'Rate-limit failures must not call DB');
  assert.equal((await call('/api/og?id='+ids.public,'GET',{})).status,503,
    'Missing OG limiter should fail closed');
  assert.equal(calls.vercel.length,1);
  console.log('R65 edge efficiency/privacy/SEO projection/HEAD/fail-closed QA PASS');
}finally{globalThis.fetch=prevFetch}
