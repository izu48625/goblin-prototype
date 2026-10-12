import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const ids={
  public:'11111111-1111-4111-8111-111111111111',
  unlisted:'22222222-2222-4222-8222-222222222222',
  private:'33333333-3333-4333-8333-333333333333'
};
const visibility=new Map(Object.entries(ids).map(([v,id])=>[id,v]));
const network={topic:[],og:[],other:[]};
const oldFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(input));
  if(url.hostname.endsWith('.supabase.co')){
    const vis=url.searchParams.get('visibility')||'';
    network.topic.push({id:url.searchParams.get('id'),vis});
    assert.equal(vis,'in.(public,unlisted)','Share/OG must request only viewable topics');
    const id=String(url.searchParams.get('id')||'').replace(/^eq\./,'');
    const v=visibility.get(id);
    const topics=v==='public'||v==='unlisted'
      ?[{id,title:'CONFIDENTIAL WORK '+id.slice(0,4),
          description:'sensitive draft preview',visibility:v,language_code:'ja'}]:[];
    return Response.json(topics,{headers:{'Cache-Control':'no-store'}});
  }
  if(url.hostname==='stats-maker-ogp.vercel.app'&&url.pathname==='/api/og'){
    network.og.push(url.href);
    const blob=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
    return new Response(blob,{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=86400'}});
  }
  network.other.push(url.href);
  throw Error('Unexpected network call '+url.href);
};
const env={
  OG_RATE_LIMIT:{async limit(){return {success:true}}},
  SHARE_RATE_LIMIT:{async limit(){return {success:true}}},
  ASSETS:{async fetch(){return new Response('asset')}}
};
const host='https://statsmaker.app';
async function request(path){return worker.fetch(new Request(host+path),env)}
try{
  for(const kind of ['public','unlisted']){
    const id=ids[kind];
    const page=await request('/p/'+id);
    assert.equal(page.status,200,'Expected viewable share for '+kind);
    assert.equal(page.headers.get('Cache-Control'),'no-store');
    const html=await page.text();
    assert(html.includes('CONFIDENTIAL WORK'),kind+' no share preview');
    assert(html.includes('/public.html?id='+id),kind+' broken share URL');
    assert(html.includes('noindex,follow'),kind+' share should not be indexed');

    const og=await request('/api/og?id='+id);
    assert.equal(og.status,200,kind+' image unavailable');
    assert.equal(og.headers.get('Cache-Control'),'private, no-store',kind+' leaked cacheable image');
    assert.equal(og.headers.get('Content-Type'),'image/png');
  }
  const renderedBefore=network.og.length;

  // Switching public->private or unlisted->private revokes previously valid
  // share/OG URLs without trusting the former CDN response or a v= query.
  for(const id of [ids.public,ids.unlisted]){
    visibility.set(id,'private');
    const page=await request('/p/'+id);
    assert.equal(page.status,404);
    assert.equal(page.headers.get('Cache-Control'),'no-store');
    const html=await page.text();
    assert(!html.includes('CONFIDENTIAL WORK'),'Revoked share leaked a title');
    assert(!html.includes('sensitive draft preview'),'Revoked share leaked description');
    const image=await request('/api/og?id='+id+'&v=previousPublicTimestamp');
    assert.equal(image.status,404,'Revoked URL still served an image');
    assert.equal(image.headers.get('Cache-Control'),'no-store');
  }
  for(const id of [ids.private,'bad-id','']){
    const share=await request('/p/'+id);
    if(id===ids.private)assert.equal(share.status,404);
    const og=await request('/api/og?id='+id);
    assert.equal(og.status,404,'Private/malformed topic must not reach OG backend');
  }
  assert.equal(network.og.length,renderedBefore,
    'Backend was reached with revoked or invalid topic');
  assert.equal(network.other.length,0);
  console.log('R37 visibility Worker PASS: public/unlisted direct share, private revocation, OG no-store');
}finally{globalThis.fetch=oldFetch}
