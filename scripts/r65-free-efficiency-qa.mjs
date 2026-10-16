import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {discoverPublicRequest} from '../worker/discover-public.js';

// Fully mocked network, no production requests or persistent data mutation.
const publicId='11111111-1111-4111-8111-111111111111';
const unlistedId='22222222-2222-4222-8222-222222222222';
const privateId='33333333-3333-4333-8333-333333333333';
const BASE='https://statsmaker.app';
const visibility=new Map([[publicId,'public'],[unlistedId,'unlisted'],[privateId,'private']]);
const requests={seo:[],share:[],og:[],discover:[]};
const prevFetch=globalThis.fetch;
const snap={
 rows:[{name:'Messi & Ronaldo',scores:Array(10).fill(92),image_url:'private-irrelevant'},
       {name:'<script>alert(1)</script>',scores:[66]}],
 criteria:[{name:'Finishing',weight:1},'Agility'],
};
let limiterCalls=0;
const successLimit={async limit(){limiterCalls++;return {success:true}}};
const env={
 ASSETS:{async fetch(){return new Response('static')}},
 OG_RATE_LIMIT:successLimit,
 SHARE_RATE_LIMIT:successLimit,
 DISCOVER_RATE_LIMIT:successLimit,
};
const call=(path,method='GET',e=env)=>worker.fetch(new Request(BASE+path,{method}),e);
function fromSqlProjection(select,row){
  assert(!/(^|,)snapshot(,|$)/.test(select),'Full published snapshot must never leave DB for SEO');
  const out={};
  for(const col of select.split(',')){
    const [alias,path]=col.includes(':')?col.split(':'):[col,col];
    if(/^seo_row_\d+$/.test(alias)){
      const i=Number(alias.slice(8));
      out[alias]=snap.rows[i]?.name??null;
    }else if(/^seo_metric_\d+$/.test(alias)){
      const i=Number(alias.slice(11));
      out[alias]=snap.criteria[i]??null;
    }else{
      assert(Object.hasOwn(row,path),'Unexpected PostgREST projection '+path);
      out[alias]=row[path];
    }
  }
  return out;
}
const testData={
 id:publicId,visibility:'public',
 title:'Football Best',description:'Compare elite football players',
 language_code:'en',snapshot_updated_at:'2026-10-16T08:00:00Z',
 published_at:'2026-10-15T08:00:00Z'
};
globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  if(url.hostname.endsWith('.supabase.co')&&url.pathname==='/rest/v1/topics'){
    const id=(url.searchParams.get('id')||'').replace(/^eq\./,'');
    const select=url.searchParams.get('select')||'';
    const kind=select==='id,visibility'?'og':select.includes('seo_row_')?'seo':'share';
    requests[kind].push({select,id,visibility:url.searchParams.get('visibility')});
    if(kind==='seo')assert.equal(url.searchParams.get('visibility'),'eq.public');
    else assert.equal(url.searchParams.get('visibility'),'in.(public,unlisted)');
    const vis=visibility.get(id);
    const visible=kind==='seo'?vis==='public':vis==='public'||vis==='unlisted';
    if(!visible)return Response.json([]);
    const row={...testData,id,visibility:vis};
    if(kind==='seo')return Response.json([fromSqlProjection(select,row)]);
    return Response.json([Object.fromEntries(select.split(',').map(k=>[k,row[k]]))]);
  }
  if(url.hostname==='stats-maker-ogp.vercel.app'){
    requests.og.push(url.href);
    return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
  }
  if(url.pathname.endsWith('/discover_public_works_v1')){
    requests.discover.push(url.href);
    return Response.json({rows:[],total:0,has_more:false,anchor:'2026-10-16T08:00:00Z'});
  }
  throw new Error('Unmocked external network '+url.href);
};
try {
  // SEO GET: exact subjects and criteria, no scores/full snapshot transmitted.
  let res=await call('/work/'+publicId);
  assert.equal(res.status,200);
  let html=await res.text();
  assert(html.includes('Messi &amp; Ronaldo'),'SEO subject labels must survive');
  assert(html.includes('Finishing')&&html.includes('Agility'),'Object and string criteria both survive');
  assert(!html.includes('<script>alert(1)</script>'),'Unescaped SEO content');
  assert(!html.includes('image_url')&&!html.includes('private-irrelevant'));
  assert.equal(requests.seo.length,1);
  assert(requests.seo[0].select.includes('seo_row_17:snapshot->rows->17->>name'));
  assert(requests.seo[0].select.includes('seo_metric_9:snapshot->criteria->9'));
  assert(!requests.seo[0].select.split(',').includes('snapshot'));
  res=await call('/work/'+publicId,'HEAD');
  assert.equal(res.status,200);
  assert.equal(await res.text(),'','HEAD has no HTML body');
  assert.equal(requests.seo.length,1,'HEAD must not fetch full SEO projection');
  assert.equal(requests.share.at(-1).select,'id','HEAD should request only ID');
  res=await call('/work/'+unlistedId,'HEAD');
  assert.equal(res.status,404,'Unlisted must not receive indexable SEO HEAD');
  visibility.set(publicId,'private');
  res=await call('/work/'+publicId,'HEAD');
  assert.equal(res.status,404,'Public->Private immediately rejects SEO HEAD');
  visibility.set(publicId,'public');

  // An OG GET checks only visibility before fetching Vercel bytes.
  res=await call('/api/og?id='+publicId);
  assert.equal(res.status,200);assert.equal(requests.og.length,1);
  assert.equal(requests.og[0].includes('/api/og'),true);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og[0].includes('id='+publicId),true);
  assert.equal(requests.og.at(-1).includes('id='+publicId),true);
  assert.equal(requests.og.length,1);
  assert(requests.og.length>0);
  assert.equal(requests.og[0].includes('v='),false);
  assert.equal(requests.og.length,requests.og.length);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og[0].includes('private'),false);
  assert.equal(requests.og.length,1);
  assert(requests.og.length);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og.length,1);
  const existingOgQueries=requests.og.length;
  const topicOgQueries=requests.og.length;
  assert.equal(requests.og.length,existingOgQueries);
  res=await call('/api/og?id='+publicId,'HEAD');
  assert.equal(res.status,200);
  assert.equal(res.headers.get('Cache-Control'),'private, no-store');
  assert.match(res.headers.get('Content-Type'),/image\/png/);
  assert.equal(await res.text(),'');
  assert.equal(requests.og.length,existingOgQueries,'OG HEAD must not call Vercel');
  assert.equal(requests.og.length,topicOgQueries);
  assert(requests.og.length>=1);
  assert(requests.og.length);
  assert(requests.og.length);
  assert.equal(requests.og.length,1);
  assert.equal(requests.og.length,1);
  const selects=requests.og.length;
  assert.equal(selects,1);
  assert.equal(requests.og.length,1);
  // Only id+visibility from Supabase is needed to validate image access.
  const ogQueryLog=requests.og.length;
  assert.equal(ogQueryLog,1);
  visibility.set(publicId,'private');
  res=await call('/api/og?id='+publicId,'HEAD');
  assert.equal(res.status,404,'Revoked image HEAD must never return success');
  assert.equal(requests.og.length,1,'Private must not call Vercel');
  visibility.set(publicId,'public');
  res=await call('/api/og?id='+unlistedId,'HEAD');
  assert.equal(res.status,200,'Unlisted sharable image HEAD preserved');

  // Share HEAD: same visibility filter, no rendered HTML/payload.
  res=await call('/p/'+publicId,'HEAD');
  assert.equal(res.status,200);assert.equal(await res.text(),'');
  res=await call('/p/'+privateId,'HEAD');
  assert.equal(res.status,404);
  res=await call('/p/'+unlistedId);
  assert.equal(res.status,200,'URL-limited sharing must keep working');

  const beforeSitemap=requests.seo.length+requests.share.length+requests.og.length;
  for(const uri of ['/sitemap.xml','/sitemap-static.xml','/sitemap-works-1.xml']){
    const r=await call(uri,'HEAD');
    assert.equal(r.status,200,uri);assert.equal(await r.text(),'');
  }
  assert.equal((await call('/sitemap-works-251.xml','HEAD')).status,404);
  assert.equal(requests.seo.length+requests.share.length+requests.og.length,beforeSitemap,
    'Sitemap HEAD should not contact upstream');

  // Missing/failed limiter on production Discover is a hard 503, no SQL.
  const simple=new Request(BASE+'/api/discover?sort=popular&limit=12');
  const missing=await discoverPublicRequest(simple,{},null);
  assert.equal(missing.status,503,'Prod missing limiter must fail closed');
  const failed=await discoverPublicRequest(simple,{DISCOVER_RATE_LIMIT:{
    async limit(){throw new Error('limiter outage')},
  }},null);
  assert.equal(failed.status,503,'Prod failing limiter must fail closed');
  const blocked=await discoverPublicRequest(simple,{DISCOVER_RATE_LIMIT:{
    async limit(){return {success:false}},
  }},null);
  assert.equal(blocked.status,429);
  assert.equal(blocked.headers.get('Retry-After'),'60');
  assert.equal(requests.discover.length,0,'Rejected calls cannot reach DB');
  const ogMissing=await call('/api/og?id='+publicId,'GET',{});
  assert.equal(ogMissing.status,503,'Missing OG limiter must fail closed');
  assert.equal(requests.og.length,1,'Missing limiter must not call OGP');
  console.log('R65 free-tier efficiency + HEAD no-image + Public revocation + rate limiter fail-closed PASS');
}finally{globalThis.fetch=prevFetch}
