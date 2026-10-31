import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const ROOT=new URL('../',import.meta.url);
const source=await readFile(new URL('cloud/public.js',ROOT),'utf8');
const html=await readFile(new URL('public.html',ROOT),'utf8');
const match=source.match(/await sb\.from\('topics'\)\s*\.select\('([^']+)'\)\s*\.eq\('id',id\)\.single\(\)/);
assert(match,'Main topic lookup with explicit select is required');
const projection=match[1];
const required=[
  'id','owner_id','title','description','score_scale','weighted','visibility',
  'allow_ratings','show_community','community_minimum','source_topic_id','published_at',
  'snapshot','snapshot_updated_at'
];
const fields=projection.split(',topic_items(')[0].split(',');
assert.deepEqual([...fields].sort(),[...required].sort(),'Unexpected/missing topic fields');
assert(projection.includes('topic_items(id,name,position,image_url)'),'Items relation changed');
assert(projection.includes('criteria(id,name,weight,position)'),'Criteria relation changed');
assert(!projection.includes('*'),'Wildcard fetch would expose generated search data');
assert(!projection.includes('discover_search_text_ja')&&!projection.includes('discover_search_text_en'),'Internal search-only fields leaked');
const dataAccess=[...new Set([...source.matchAll(/\bdata\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m=>m[1]))];
for(const key of dataAccess) {
  assert(required.includes(key)||['criteria','topic_items'].includes(key),'Rendered page reads unselected field '+key);
}
const jsVersion=html.match(/cloud\/public\.js\?v=([a-zA-Z0-9-]+)/)?.[1];
const cssVersion=html.match(/cloud\/public\.css\?v=([a-zA-Z0-9-]+)/)?.[1];
assert(jsVersion,'Public JS cache-busting missing');
assert.equal(cssVersion,jsVersion,'Public JS/CSS cache keys differ');
assert(/cloud\/public-extensions\.js\?v=[a-zA-Z0-9-]+/.test(html),'R118 Visual Tools asset missing version');
assert(source.includes('class="tableWrap creatorScoreTable"'),'Horizontal score matrix removed');
console.log('R58 P1 explicit projection and data-use audit PASS',fields.length,'fields');

function mockSupabaseSDK() {
  const PUBLIC='11111111-1111-4111-8111-111111111111';
  const UNLISTED='22222222-2222-4222-8222-222222222222';
  const PRIVATE='33333333-3333-4333-8333-333333333333';
  const works=[
    {id:PUBLIC,title:'R58 Public Forty By Ten',visibility:'public',show_community:true,allow_ratings:true},
    {id:UNLISTED,title:'R58 Unlisted Direct Link',visibility:'unlisted',show_community:false,allow_ratings:false},
    {id:PRIVATE,title:'R58 Private Owner Only',visibility:'private',show_community:false,allow_ratings:false}
  ].map((partial)=>{
    const large=partial.id===PUBLIC;
    const count=large?40:3;
    const metrics=large?10:2;
    const criteria=Array.from({length:metrics},(_,i)=>({id:'c'+i,name:'Criterion '+i,position:i,weight:1}));
    const items=Array.from({length:count},(_,i)=>({id:'i'+i,name:'Target '+i,position:i,image_url:null}));
    return {
      description:'R58 isolated test',owner_id:'00000000-0000-4000-8000-000000000001',
      score_scale:100,weighted:false,source_topic_id:null,
      snapshot_updated_at:'2026-10-16T00:00:00Z',published_at:'2026-10-16T00:00:00Z',
      snapshot:{rows:items.map(x=>({name:x.name,scores:Array(metrics).fill(75)})),
        criteria:criteria.map(c=>({name:c.name,weight:1})),scale:100},
      criteria,topic_items:items,
      discover_search_text_ja:'SHOULD NEVER LEAVE DB',
      discover_search_text_en:'INTERNAL SEARCH ONLY',
      ...partial
    };
  });
  window.__r58SelectLog=[];
  function query(table) {
    let columns='',wantedId=null;
    const api={
      select(c){columns=c;window.__r58SelectLog.push({table,columns});return api;},
      eq(k,v){if(k==='id')wantedId=v;return api;},
      in(){return api;},order(){return api;},range(){return api;},
      single:async()=>one(),
      maybeSingle:async()=>({data:null,error:null}),
      then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
    };
    function one(){
      const row=works.find(x=>x.id===wantedId);
      if(table!=='topics'||!row||row.visibility==='private'&&!window.__r58Owner)
        return {data:null,error:{message:'Not found',code:'PGRST116'}};
      const names=columns.split(',topic_items(')[0].split(',');
      const projected=Object.fromEntries(names.map(k=>[k,row[k]]));
      if(columns.includes('topic_items('))projected.topic_items=row.topic_items;
      if(columns.includes('criteria('))projected.criteria=row.criteria;
      window.__r58ReturnedKeys=Object.keys(projected);
      return {data:projected,error:null};
    }
    return api;
  }
  const client={
    from:query,
    auth:{getUser:async()=>({data:{user:window.__r58Owner?{id:'00000000-0000-4000-8000-000000000001'}:null}}),
      getSession:async()=>({data:{session:null}}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    rpc:async(name)=>({data:name==='get_topic_participant_count'?0:[],error:null})
  };
  window.supabase={createClient:()=>client};
}
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const sdk='('+mockSupabaseSDK.toString()+')()';
const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
try {
  for(const [id,owner,allowed,rows] of [
    ['11111111-1111-4111-8111-111111111111',false,true,40],
    ['22222222-2222-4222-8222-222222222222',false,true,3],
    ['33333333-3333-4333-8333-333333333333',false,false,0],
    ['33333333-3333-4333-8333-333333333333',true,true,3]
  ]) {
    const context=await browser.newContext({viewport:{width:390,height:844},
      isMobile:true,hasTouch:true,locale:'ja-JP',acceptDownloads:true});
    await context.addInitScript((value)=>{window.__r58Owner=value},owner);
    await context.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>
      route.fulfill({status:200,contentType:'application/javascript',body:sdk}));
    let externalRequests=0;
    await context.route('**/*.supabase.co/**',route=>{externalRequests++;return route.abort()});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(e.message));
    await page.goto(BASE+'/public.html?id='+id+'&qa=r58p1',{waitUntil:'domcontentloaded'});
    if(allowed) {
      await page.locator('#content:not(.hidden)').waitFor({timeout:20000});
      assert.equal(await page.locator('.creatorScoreTable tbody tr').count(),rows,'Rows missing');
      assert.equal(await page.locator('#shareImageBtn').count(),1,'Share image missing');
      const snapshot=await page.evaluate(()=>({
        queries:window.__r58SelectLog,keys:window.__r58ReturnedKeys,
        text:document.querySelector('#content')?.textContent||''
      }));
      const main=snapshot.queries.find(q=>q.table==='topics'&&q.columns.includes('topic_items('));
      assert.equal(main?.columns,projection,'Runtime PostgREST projection differs from audited source');
      assert(!snapshot.keys.some(k=>k.startsWith('discover_search_text')),'Internal generated columns in response');
      assert(!snapshot.text.includes('INTERNAL SEARCH ONLY'),'Search text leaked into UI');
      if(rows===40) {
        assert.equal(await page.locator('.creatorScoreTable thead th').count(),12,'40x10 score table broken');
        assert.equal(await page.locator('#communityRateLink').count(),1,'Community rating entry missing');
        assert((await page.locator('#communityContent').innerText()).includes('5'),'Threshold state missing');
      }
      if(owner)assert.equal(await page.locator('#ownerManageBtn').count(),1,'Owner controls missing');
      await page.locator('#shareImageBtn').click();
      assert(!(await page.locator('#shareImageBackdrop').getAttribute('class')).includes('hidden'),
        'Share image modal did not open');
    } else {
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('Could not load'),null,{timeout:20000});
      assert(!(await page.locator('body').innerText()).includes('Private Owner Only'),'Private title leaked');
    }
    assert.equal(externalRequests,0,'QA must not call real Supabase');
    assert.deepEqual(pageErrors.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[],'Browser errors');
    console.log('R58 P1 isolated mobile browser PASS',{engine:engine===webkit?'webkit':'chromium',
      visibility:id.slice(0,8),owner,allowed,rows});
    await context.close();
  }
} finally {
  await browser.close();
}
