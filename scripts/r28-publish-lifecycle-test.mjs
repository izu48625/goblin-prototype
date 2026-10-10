import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE_URL=process.env.BASE_URL||'https://statsmaker.app';
const GUEST='11111111-1111-4111-8111-111111111111';
const TOPIC='22222222-2222-4222-8222-222222222222';

// This browser test must NEVER send Supabase production mutations or create
// real anonymous users. The entire SDK is mocked at the CDN loading boundary.
const mockSdk="\n(() => {\n  const owner='11111111-1111-4111-8111-111111111111';\n  const topicId='22222222-2222-4222-8222-222222222222';\n  const db={\n    topics:[],topic_items:[],criteria:[],\n    calls:[],announcedNewSignins:0\n  };\n  const clone=v=>JSON.parse(JSON.stringify(v));\n  function query(table,operation='read',payload=null){\n    const state={table,operation,payload,filters:[],order:null};\n    const execute=()=>{\n      let data=null;\n      if(state.operation==='insert'){\n        const incoming=(Array.isArray(state.payload)?state.payload:[state.payload]).map(o=>clone(o));\n        for(const row of incoming)if(table==='topics'&&!row.id)row.id=topicId;\n        db[table].push(...incoming);\n        db.calls.push({table,operation:'insert',payload:clone(incoming)});\n        data=Array.isArray(state.payload)?clone(incoming):clone(incoming[0]);\n      }else if(state.operation==='update'){\n        const updated=db[table].filter(row=>state.filters.every(([key,value])=>row[key]===value));\n        for(const row of updated)Object.assign(row,clone(state.payload));\n        db.calls.push({table,operation:'update',filters:clone(state.filters),payload:clone(state.payload)});\n        data=updated.length===1?clone(updated[0]):clone(updated);\n      }else if(state.operation==='delete'){\n        const before=db[table].length;\n        db[table]=db[table].filter(row=>!state.filters.every(([key,value])=>row[key]===value));\n        db.calls.push({table,operation:'delete',count:before-db[table].length});\n        data=null;\n      }else{\n        data=db[table].filter(row=>state.filters.every(([key,value])=>row[key]===value));\n        if(state.order){\n          const [key,ascending]=state.order;\n          data.sort((a,b)=>(a[key]<b[key]?-1:a[key]>b[key]?1:0)*(ascending?1:-1));\n        }\n        data=clone(data);\n      }\n      return {data,error:null};\n    };\n    const api={\n      select(){return api},\n      eq(k,v){state.filters.push([k,v]);return api},\n      order(k,options={}){state.order=[k,options.ascending!==false];return api},\n      single:async()=>{\n        const result=execute();\n        return {...result,data:Array.isArray(result.data)?result.data[0]??null:result.data};\n      },\n      maybeSingle:async()=>{\n        const result=execute();\n        return {...result,data:Array.isArray(result.data)?result.data[0]??null:result.data};\n      },\n      then(resolve,reject){return Promise.resolve().then(execute).then(resolve,reject)}\n    };\n    return api;\n  }\n  const client={\n    auth:{\n      async getSession(){return {data:{session:{user:{id:owner,is_anonymous:true},access_token:'TEST_ONLY_JWT'}},error:null}},\n      async getUser(){return {data:{user:{id:owner,is_anonymous:true}},error:null}},\n      async signInAnonymously(){db.announcedNewSignins++;throw new Error('No real anonymous account is allowed in this test')}\n    },\n    from(table){\n      if(!Object.prototype.hasOwnProperty.call(db,table)||!Array.isArray(db[table]))\n        throw new Error('Unexpected Supabase table '+table);\n      return {\n        select:()=>query(table),\n        insert:payload=>query(table,'insert',payload),\n        update:payload=>query(table,'update',payload),\n        delete:()=>query(table,'delete')\n      };\n    },\n    async rpc(name){\n      if(name==='topic_has_submissions')return {data:false,error:null};\n      if(name==='get_topic_participant_count')return {data:0,error:null};\n      if(name==='get_community_item_summary'||name==='get_community_criterion_summary')\n        return {data:[],error:null};\n      return {data:null,error:{message:'Unexpected RPC: '+name}};\n    }\n  };\n  window.__qaPublishDb=db;\n  window.supabase={createClient:()=>client};\n})();\n";

const browser=await chromium.launch({headless:true});
const unexpected=[];
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  await context.route('**/supabase-js@2',async route=>{
    await route.fulfill({status:200,contentType:'application/javascript',body:mockSdk});
  });
  await context.route('**/ibpdxbeltdwkquowjeay.supabase.co/**',async route=>{
    unexpected.push(route.request().url());
    await route.abort();
  });
  const page=await context.newPage();
  await page.goto(BASE_URL+'/index.html?qaPublish='+Date.now(),
    {waitUntil:'domcontentloaded',timeout:60000});
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  await home.locator('#titleInput').fill('R28 QA UNLISTED SAMPLE');
  await home.locator('.nameInput').first().fill('TEST PERSON');
  await home.locator('[data-score-row="0"][data-score-col="0"]').fill('82');
  await home.locator('#publishBtn').click();
  await home.locator('#publishSettingsPane:not(.hidden)').waitFor({timeout:20000});
  await home.locator('input[name="publishVisibility"][value="unlisted"]').check();
  await home.locator('#publishExecuteBtn').click();
  await home.locator('#publishResult:not(.hidden)').waitFor({timeout:20000});
  await home.locator('#publishStatus.ok').waitFor({timeout:20000});
  // Publish returns before the normal local-first auto-save timer flushes.
  // Wait for the real Home library, rather than racing the 220ms timer.
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<40;i++){
      try{
        const library=JSON.parse(localStorage.getItem('statsMakerV014Library')||'null');
        if(library?.sheets?.some(x=>x.cloudTopicId==='22222222-2222-4222-8222-222222222222'))return;
      }catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Published topic did not reach local-first storage');
  });
  let state=await home.locator('body').evaluate(()=>({
    db:window.__qaPublishDb,
    library:JSON.parse(localStorage.getItem('statsMakerV014Library')||'null')
  }));
  assert.equal(state.db.topics.length,1,'Publish should create exactly one mocked topic');
  assert.equal(state.db.topics[0].visibility,'unlisted','Unlisted visibility not persisted');
  assert.equal(state.db.topics[0].owner_id,GUEST,'Wrong anonymous owner');
  assert.equal(state.db.topics[0].title,'R28 QA UNLISTED SAMPLE');
  assert.equal(state.db.topics[0].snapshot.rows[0].name,'TEST PERSON');
  assert.equal(state.db.topics[0].snapshot.rows[0].scores[0],82);
  assert.equal(state.db.topic_items.length,1,'Only populated targets should publish');
  assert.equal(state.db.criteria.length,1,'Unused blank metrics should not publish');
  assert.equal(state.db.announcedNewSignins,0,'Fake QA triggered guest signup');
  assert(state.library.sheets.some(x=>x.cloudTopicId===TOPIC),
    'Published topic ID was not associated with a local sheet');
  const share=await home.locator('#publishUrlInput').inputValue();
  assert(share.includes('/public.html?id='+TOPIC),'Published share URL wrong');
  // Repeat publishing without changing structure must update the SAME topic.
  await home.locator('#publishExecuteBtn').click();
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<100;i++){
      if(window.__qaPublishDb.calls.some(x=>x.table==='topics'&&x.operation==='update'))return;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw new Error('Publish update did not reach mock Supabase');
  });
  state=await home.locator('body').evaluate(()=>window.__qaPublishDb);
  assert.equal(state.topics.length,1,'Repeated publish created duplicate topics');
  assert.equal(state.topics[0].visibility,'unlisted');
  assert.equal(state.topic_items.length,1);
  assert.equal(state.criteria.length,1);
  // Turning it private must revoke the public link without touching other sheets.
  await home.locator('#publishUnpublishBtn').click();
  await home.locator('#publishUnpublishBtn').waitFor({state:'hidden',timeout:20000});
  // App intentionally persists changed cloud visibility after its debounce.
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<40;i++){
      const local=JSON.parse(localStorage.getItem('statsMakerV014Library')||'null');
      if(window.__qaPublishDb.topics[0]?.visibility==='private'&&
        local?.sheets?.some(x=>x.cloudVisibility==='private'))return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Private visibility did not reach mock database and local library');
  });
  state=await home.locator('body').evaluate(()=>({
    db:window.__qaPublishDb,
    library:JSON.parse(localStorage.getItem('statsMakerV014Library')||'null')
  }));
  assert.equal(state.db.topics[0].visibility,'private','Private transition failed');
  assert(state.library.sheets.some(x=>x.cloudVisibility==='private'),
    'Local visibility state failed to sync');
  assert.equal(state.db.topics.length,1);
  assert.deepEqual(unexpected,[],'A real Supabase network call occurred during mock QA');
  console.log('R28 publishing QA PASS: URL-limited -> same-ID update -> private; no real DB writes');
}finally{
  await browser.close();
}
