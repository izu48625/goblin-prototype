import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const IDS={small:'11111111-1111-4111-8111-111111111111',large:'22222222-2222-4222-8222-222222222222'};
const mockSdk=`(()=>{
  const IDS={small:'11111111-1111-4111-8111-111111111111',large:'22222222-2222-4222-8222-222222222222'};
  function topic(id){
    const large=id===IDS.large;
    const size=large?40:4,n=large?10:4;
    const names=large?Array.from({length:size},(_,i)=>'とても長い対象名'+(i+1)):['孫悟空','モンキー・D・ルフィ','うずまきナルト','トリコ'];
    const columns=large?Array.from({length:n},(_,i)=>'とても長い評価項目'+(i+1)):['戦闘力','冒険心','友情','成長'];
    const scores=large?Array.from({length:size},(_,i)=>Array.from({length:n},(_,j)=>(i+j)%11)): [
      [10,7,8,9],[7,9,8,8],[8,8,7,9],[9,7,10,8]
    ];
    const criteria=columns.map((name,i)=>({id:'c'+i,name,position:i,weight:1}));
    const items=names.map((name,i)=>({id:'item'+i,name,position:i}));
    return {
      id,title:large?'40x10 QA':'公開スコア QA 4×4',
      description:'Local mocked data only',language_code:'ja',
      visibility:'public',owner_id:'00000000-0000-4000-8000-000000000001',
      show_community:false,allow_ratings:false,source_topic_id:null,
      score_scale:10,weighted:false,published_at:'2026-10-11T00:00:00Z',
      snapshot:{rows:names.map((name,i)=>({name,scores:scores[i]})),
        criteria:columns.map(name=>({name,weight:1})),scale:10,weighted:false},
      topic_items:items,criteria
    };
  }
  function query(table){
    const q={id:null,source:null};
    const api={
      select(){return api},
      eq(k,v){if(k==='id')q.id=v;if(k==='source_topic_id')q.source=v;return api},
      in(){return api},order(){return api},limit(){return api},
      single:async()=>({data:q.id?topic(q.id):null,error:null}),
      maybeSingle:async()=>({data:null,error:null}),
      then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
    };
    return api;
  }
  const client={
    auth:{
      getUser:async()=>({data:{user:null},error:null}),
      getSession:async()=>({data:{session:null},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    },
    from:table=>query(table),
    rpc:async()=>({data:[],error:null})
  };
  window.supabase={createClient:()=>client};
})();`;
const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const requests=[];
  await context.route('**/supabase-js@2',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:mockSdk
  }));
  await context.route('**/ibpdxbeltdwkquowjeay.supabase.co/**',route=>{
    requests.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const run=async({id,rows,cols,width,lang='ja'})=>{
    await page.setViewportSize({width,height:844});
    await page.goto(BASE+'/public.html?id='+id+'&qa=r38p15',{waitUntil:'domcontentloaded'});
    await page.locator('.publicScoreCard').first().waitFor({state:width<=760?'visible':'attached',timeout:25000});
    assert.equal(await page.locator('.publicScoreCard').count(),rows);
    assert.equal(await page.locator('.publicMetricPair').count(),rows*cols);
    const table=page.locator('.creatorScoreTable');
    if(width<=760){
      assert.equal(await table.isVisible(),false,'desktop table must hide at mobile width');
      const cards=page.locator('.publicScoreCards');
      assert(await cards.isVisible(),'mobile score cards must show');
      assert.equal(await page.locator('.publicScoreCardAvg').count(),rows);
      const layout=await cards.evaluate(el=>{
        const container=el.getBoundingClientRect();
        const children=[...el.querySelectorAll('.publicScoreCard,.publicMetricPair')];
        return {containerWidth:container.width,
          outside:children.filter(child=>{
            const b=child.getBoundingClientRect();
            return b.left<container.left-1||b.right>container.right+1;
          }).length,
          overflowing:children.filter(child=>child.scrollWidth>child.clientWidth+3).length};
      });
      assert.equal(layout.outside,0,'public score cards overflow phone viewport');
      assert.equal(layout.overflowing,0,'score metric content clipped inside card');
      const first=page.locator('.publicScoreCard').first();
      assert.equal((await first.locator('.publicMetricNumber').allTextContents()).length,cols);
      assert.equal(await first.locator('.publicMetricNumber').first().innerText(),cols===4?'10':'0');
      assert.equal(await first.locator('.publicScoreCardAvg strong').innerText(),
        cols===4?'8.5':'4.5');
    }else{
      assert(await table.isVisible(),'desktop matrix must still be shown');
      assert.equal(await page.locator('.publicScoreCards').isVisible(),false);
      assert.equal(await table.locator('tbody tr').count(),rows);
      assert.equal(await table.locator('thead th').count(),cols+2);
    }
    assert(!errors.some(e=>/SyntaxError|TypeError|ReferenceError/.test(e)),
      'Uncaught script errors: '+errors);
    console.log('R38 P15 creator public score cards PASS',engine===webkit?'webkit':'chromium',
      rows+'x'+cols,width,lang);
  };
  for(const width of [320,390,760,1024])
    await run({id:IDS.small,rows:4,cols:4,width});
  for(const width of [320,390,1024])
    await run({id:IDS.large,rows:40,cols:10,width});
  // English captions must switch via existing persisted UI locale.
  await page.evaluate(()=>localStorage.setItem('statsMaker.locale','en'));
  await run({id:IDS.small,rows:4,cols:4,width:390,lang:'en'});
  assert.equal(await page.locator('.publicScoreCardAvg span').first().innerText(),'Average');
  assert.equal(requests.length,0,'Real Supabase requests are not allowed in UI QA');
  console.log('R38 P15 public responsive scoring layout and isolated mock DB PASS');
}finally{await browser.close()}
