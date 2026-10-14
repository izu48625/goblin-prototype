import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const PUBLIC='11111111-1111-4111-8111-111111111111';
const UNLISTED='22222222-2222-4222-8222-222222222222';
const PRIVATE='33333333-3333-4333-8333-333333333333';
const mockSdk="(()=>{\n const PUBLIC='11111111-1111-4111-8111-111111111111';\n const UNLISTED='22222222-2222-4222-8222-222222222222';\n const PRIVATE='33333333-3333-4333-8333-333333333333';\n const works=[\n   {id:PUBLIC,title:'R37 Public Safe Work',description:'Visible for everyone',\n    visibility:'public',owner_id:'00000000-0000-4000-8000-000000000001',\n    language_code:'ja',snapshot:{rows:[{name:'Player A',scores:[75]}],criteria:[{name:'Speed',weight:1}],scale:100},\n    topic_items:[{id:'item1',name:'Player A',position:0}],criteria:[{id:'c1',name:'Speed',position:0,weight:1}],\n    show_community:false,allow_ratings:false,published_at:'2026-10-11T00:00:00Z'},\n   {id:UNLISTED,title:'R37 Unlisted Secret Work',description:'Url holder only',\n    visibility:'unlisted',owner_id:'00000000-0000-4000-8000-000000000001',\n    language_code:'ja',snapshot:{rows:[{name:'Hidden A',scores:[50]}],criteria:[{name:'Value',weight:1}],scale:100},\n    topic_items:[{id:'item2',name:'Hidden A',position:0}],criteria:[{id:'c2',name:'Value',position:0,weight:1}],\n    show_community:false,allow_ratings:false,published_at:'2026-10-11T00:00:00Z'},\n   {id:PRIVATE,title:'R37 Private Secret Work',description:'Owner only',\n    visibility:'private',owner_id:'00000000-0000-4000-8000-000000000001',\n    language_code:'ja',snapshot:{rows:[{name:'Super Secret',scores:[98]}],criteria:[{name:'Hidden'}],scale:100},\n    topic_items:[],criteria:[],show_community:false,allow_ratings:false}\n ];\n window.__r37VisibilityLog=[];\n function query(table){\n   const state={filters:[],columns:'*'};\n   const api={\n     select(cols){state.columns=cols;return api},\n     eq(k,v){state.filters.push([k,v]);window.__r37VisibilityLog.push({table,k,v});return api},\n     not(){return api},in(){return api},order(){return api},limit(){return api},range(){return api},\n     single:async()=>selectOne(),maybeSingle:async()=>selectOne(),\n     then(resolve,reject){return Promise.resolve({data:list(),error:null}).then(resolve,reject)}\n   };\n   const list=()=>{\n     if(table!=='topics')return [];\n     const id=state.filters.find(([k])=>k==='id')?.[1];\n     // Discover is deliberately given an over-broad service response\n     // (including private/unlisted), simulating an API filtering regression.\n     if(!id)return works.map(w=>({...w}));\n     const found=works.find(w=>w.id===id);\n     return found && found.visibility!=='private'?[{...found}]:[];\n   };\n   const selectOne=async()=>{\n     const row=list()[0]||null;\n     return row?{data:row,error:null}:{data:null,error:{message:'Not found',code:'PGRST116'}};\n   };\n   return api;\n }\n const sb={\n   auth:{getSession:async()=>({data:{session:null},error:null}),\n     getUser:async()=>({data:{user:null},error:null}),\n     onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},\n   from:table=>query(table),\n   rpc:async(name)=>({data:name==='get_topic_participant_count'?0:[],error:null})\n };\n window.supabase={createClient:()=>sb};\n})();";
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
    hasTouch:true,locale:'ja-JP'});
  await context.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2',route=>
    route.fulfill({status:200,contentType:'application/javascript',body:mockSdk}));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(BASE+'/discover.html?qa=r37visibility',{waitUntil:'domcontentloaded'});
  await page.locator('#grid:not(.hidden)').waitFor({timeout:20000});
  const grid=await page.locator('#grid').innerText();
  assert(grid.includes('R37 Public Safe Work'),'Discover lost public content');
  assert(!grid.includes('R37 Unlisted Secret Work'),'Unlisted leaked in Discover');
  assert(!grid.includes('R37 Private Secret Work'),'Private leaked in Discover');
  const reqs=await page.evaluate(()=>window.__r37VisibilityLog);
  assert(reqs.filter(r=>r.k==='visibility'&&r.v==='public').length>=1,
    'Discover must still query Public-only rows at API level');
  assert.equal(await page.locator('#grid article').count(),1,
    'Discover must reject unexpected non-Public API rows');
  console.log('R37 Discover privacy PASS: API Public query plus defensive local filter');

  for(const [id,name,allowed] of [
    [PUBLIC,'R37 Public Safe Work',true],
    [UNLISTED,'R37 Unlisted Secret Work',true],
    [PRIVATE,'R37 Private Secret Work',false]
  ]){
    await page.goto(BASE+'/public.html?id='+id+'&qa=r37visibility',
      {waitUntil:'domcontentloaded'});
    if(allowed){
      await page.locator('#content:not(.hidden)').waitFor({timeout:20000});
      assert((await page.locator('#content').innerText()).includes(name),
        'Direct URL should show '+name);
    }else{
      await page.waitForFunction(()=>
        document.querySelector('#status')?.textContent?.includes('Could not load'),null,
        {timeout:20000});
      assert(!(await page.locator('body').innerText()).includes(name),
        'Anonymous direct Private URL leaked title');
      assert(!(await page.locator('body').innerText()).includes('Super Secret'),
        'Anonymous Private URL leaked row content');
    }
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,follow',
      'Raw public.html should stay noindex (SEO only via public /work route)');
  }
  assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError/.test(e)),[],
    'Public/Discover JS runtime error');
  console.log('R37 direct public.html privacy PASS: Public + URL-limited viewable, Private blocked');
}finally{await browser.close()}
