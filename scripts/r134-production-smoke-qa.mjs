import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chooseCurrentPublicSmokeTopic,resolveCurrentPublicSmokeTopic}
  from './r134-production-smoke-topic.mjs';

const one='11111111-1111-4111-8111-111111111111';
const two='22222222-2222-4222-8222-222222222222';
const three='33333333-3333-4333-8333-333333333333';
const topics=[
  {id:'57b432ed-fbf2-4261-b57d-9e0f27356d2e',visibility:'private',
    show_community:true,allow_ratings:true},
  {id:two,visibility:'public',show_community:true,allow_ratings:false},
  {id:three,visibility:'unlisted',show_community:true,allow_ratings:true},
  {id:one,visibility:'public',show_community:true,allow_ratings:true},
  {id:two,visibility:'public',show_community:true,allow_ratings:true}
];
assert.equal(chooseCurrentPublicSmokeTopic(topics,'57b432ed-fbf2-4261-b57d-9e0f27356d2e'),one,
  'Stale workflow fixture must never select a revoked Private topic');
assert.equal(chooseCurrentPublicSmokeTopic(topics,two),two,
  'An existing Public eligible preferred topic should be accepted');
assert.equal(chooseCurrentPublicSmokeTopic(topics),one);
assert.throws(()=>chooseCurrentPublicSmokeTopic(null),/invalid data/);
assert.throws(()=>chooseCurrentPublicSmokeTopic(topics.slice(0,3)),/No current Public work/);
assert.throws(()=>chooseCurrentPublicSmokeTopic([{id:one,visibility:'public',
  show_community:'true',allow_ratings:true}]),/No current Public work/);
let count=0;
const selected=await resolveCurrentPublicSmokeTopic('57b432ed-fbf2-4261-b57d-9e0f27356d2e',
  async (url,options)=>{
    count++;
    assert.match(url,/^https:\/\/ibpdxbeltdwkquowjeay\.supabase\.co\/rest\/v1\/topics\?/);
    const u=new URL(url);
    assert.equal(u.searchParams.get('select'),'id,visibility,show_community,allow_ratings');
    assert.equal(u.searchParams.get('visibility'),'eq.public');
    assert.equal(u.searchParams.get('order'),'published_at.desc');
    assert.equal(options.method,'GET','No write method in discovery');
    assert(options.headers.apikey.startsWith('sb_publishable_'));
    assert.equal(options.cache,'no-store');
    return {ok:true,json:async()=>topics.filter(t=>t.visibility==='public')};
  });
assert.equal(count,1,'Resolve from one bounded query only');
assert.equal(selected,one,'A stale preferred ID must not hide live Public work');

const [workflow,smoke]=await Promise.all([
  readFile(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8'),
  readFile(new URL('./production-smoke.mjs',import.meta.url),'utf8')
]);
assert(!workflow.includes('PUBLIC_TOPIC_ID: 57b432ed-'),'No stale env override');
assert(workflow.includes('node scripts/r134-production-smoke-qa.mjs'));
assert(smoke.includes('resolveCurrentPublicSmokeTopic(process.env.PUBLIC_TOPIC_ID'));
assert(smoke.includes("const id='"+String.fromCharCode(36)+'{PUBLIC_TOPIC_ID}'+"';"),
  'Browser mock must point at selected current topic');
assert(smoke.includes("allow_ratings:true,show_community:true,visibility:'public'"),
  'Browser mock needs both consent flags after R133');
assert(!smoke.includes("const PUBLIC_TOPIC_ID=process.env.PUBLIC_TOPIC_ID||'"),
  'No baked-in published ID may persist');
console.log('R134 PASS: dynamic live Public ID, stale override bypass, consent flags, bounded anonymous GET and mock parity');
