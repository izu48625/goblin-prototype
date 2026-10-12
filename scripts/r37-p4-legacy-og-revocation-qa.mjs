import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import share from '../api/share.mjs';
import {fetchTopic} from '../server/og-data.mjs';

// Covers the legacy Vercel hostname, which can be reached directly instead
// of via the Cloudflare visibility gate. No live network calls or real topics.
const ids={
  public:'11111111-1111-4111-8111-111111111111',
  unlisted:'22222222-2222-4222-8222-222222222222',
  private:'33333333-3333-4333-8333-333333333333',
  failure:'44444444-4444-4444-8444-444444444444'
};
const oldFetch=globalThis.fetch;
let requests=[];
globalThis.fetch=async(input)=>{
  const url=new URL(String(input));
  assert(url.hostname.endsWith('.supabase.co'));
  const visibility=url.searchParams.get('visibility');
  assert.equal(visibility,'in.(public,unlisted)','Legacy endpoint must filter visibility at query');
  const id=String(url.searchParams.get('id')||'').replace(/^eq\./,'');
  requests.push(id);
  if(id===ids.failure)throw new Error('Simulated read failure');
  const exposed=[ids.public,ids.unlisted].includes(id);
  const rows=exposed?[{
    id,title:'SENSITIVE REVOCABLE WORK',description:'Previously public content',
    language_code:'ja',visibility:id===ids.public?'public':'unlisted',
    score_scale:100,weighted:false,
    snapshot:{criteria:[{name:'Score',weight:1}],
      rows:[{name:'Player A',scores:[90]}]}
  }]:[];
  return new Response(JSON.stringify(rows),{
    status:200,headers:{'Content-Type':'application/json'}
  });
};
function mockResponse(){
  return {
    statusCode:200,headers:{},body:null,
    setHeader(name,value){this.headers[name.toLowerCase()]=String(value)},
    end(body){this.body=body}
  };
}
async function call(id){
  const response=mockResponse();
  await share({
    url:'/api/share?id='+encodeURIComponent(id),
    headers:{host:'stats-maker-ogp.vercel.app','x-forwarded-proto':'https'}
  },response);
  return response;
}
try{
  for(const visibility of ['public','unlisted']){
    const result=await call(ids[visibility]);
    assert.equal(result.statusCode,200,visibility);
    assert.equal(result.headers['cache-control'],'private, no-store');
    assert.match(result.body,/SENSITIVE REVOCABLE WORK/);
    assert.match(result.body,/property="og:image"/);
  }
  const revoked=await call(ids.private);
  assert.equal(revoked.statusCode,404);
  assert.equal(revoked.headers['cache-control'],'private, no-store');
  assert(!revoked.body.includes('SENSITIVE REVOCABLE WORK'));
  assert(!revoked.body.includes('Previously public content'));
  assert(!revoked.body.includes('property="og:image"'));

  const invalid=await call('not-an-id');
  assert.equal(invalid.statusCode,404);
  assert.equal(invalid.headers['cache-control'],'private, no-store');

  const unavailable=await call(ids.failure);
  assert.equal(unavailable.statusCode,503);
  assert.equal(unavailable.headers['cache-control'],'no-store');
  assert(!unavailable.body.includes('SENSITIVE REVOCABLE WORK'));

  // The OG image handler requires Sharp at runtime. Protect its access and
  // caching contracts statically without installing or calling live Vercel.
  const og=await readFile(new URL('../api/og.js',import.meta.url),'utf8');
  assert(og.includes("response.setHeader('Cache-Control','private, no-store')"));
  assert(og.includes("if(!topic){"),'Revoked image must be rejected');
  assert(og.includes('response.statusCode=404;'));
  assert(!/setHeader\('Cache-Control','public,/.test(og),
    'Legacy OG must not cache previously public pixels');
  const source=await readFile(new URL('../server/og-data.mjs',import.meta.url),'utf8');
  assert(source.includes("visibility:'in.(public,unlisted)'"));
  assert.equal(await fetchTopic(ids.private),null);
  assert(requests.includes(ids.public)&&requests.includes(ids.unlisted));
  console.log('R37 P4 legacy Vercel OG/share source and mocked direct-host revocation PASS');
}finally{
  globalThis.fetch=oldFetch;
}
