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
  // R38 P16: the user wants the original sideways scrolling matrix, NOT cards.
  // Small fonts and fixed sticky names must make more columns visible at once.
  const run=async({id,rows,cols,width,lang='ja'})=>{
    await page.setViewportSize({width,height:844});
    await page.goto(BASE+'/public.html?id='+id+'&qa=r38p16',{waitUntil:'domcontentloaded'});
    const table=page.locator('.creatorScoreTable');
    await table.locator('tbody tr').first().waitFor({state:'visible',timeout:25000});
    assert(await table.isVisible(),'score matrix must show at '+width);
    assert.equal(await page.locator('.publicScoreCard').count(),0,
      'R38 P15 cards must not be rendered');
    assert.equal(await table.locator('tbody tr').count(),rows);
    assert.equal(await table.locator('thead th').count(),cols+2);
    const row=table.locator('tbody tr').first();
    assert.equal(await row.locator('td').count(),cols+2);
    assert.equal(await row.locator('td:nth-child(2)').innerText(),cols===4?'10':'0');
    assert.equal(await row.locator('td:last-child').innerText(),cols===4?'8.5':'4.5');
    assert.equal(await table.locator('thead th:last-child').innerText(),lang==='en'?'Average':'平均');
    const layout=await table.evaluate(el=>{
      const name=el.querySelector('tbody tr td:first-child');
      const metric=el.querySelector('tbody tr td:nth-child(2)');
      const head=el.querySelector('thead th:nth-child(2)');
      const nx=name.getBoundingClientRect();
      const mx=metric.getBoundingClientRect();
      return {
        client:el.clientWidth,scroll:el.scrollWidth,
        position:getComputedStyle(name).position,
        nameWidth:nx.width,metricWidth:mx.width,
        nameFont:parseFloat(getComputedStyle(name).fontSize),
        metricFont:parseFloat(getComputedStyle(metric).fontSize),
        headingFont:parseFloat(getComputedStyle(head).fontSize),
        right:el.getBoundingClientRect().right,
        nameLeft:nx.left,
        tableRight:el.querySelector('table').getBoundingClientRect().right,
        pageOverflow:document.documentElement.scrollWidth>window.innerWidth+2
      };
    });
    assert(!layout.pageOverflow,'entire public page should not scroll horizontally');
    if(width<=760){
      assert.equal(layout.position,'sticky','target name must stay fixed during horizontal swipe');
      assert(layout.nameWidth<=115,'name column too wide at '+width+': '+layout.nameWidth);
      assert(layout.metricWidth<=74,'metric columns are not compact at '+width+': '+layout.metricWidth);
      assert(layout.metricFont<=11.5 && layout.headingFont<=10,
        'mobile text should be smaller than previous display');
      const visible=await table.evaluate(el=>{
        const right=el.getBoundingClientRect().right;
        return [...el.querySelectorAll('tbody tr:first-child td')].slice(1)
          .filter(cell=>cell.getBoundingClientRect().right<=right+1).length;
      });
      if(width<=390)assert(visible>=2,'must show at least 2 metrics next to name at '+width);
      if(layout.scroll>layout.client+5){
        const before=await table.locator('tbody tr:first-child td:first-child').evaluate(el=>el.getBoundingClientRect().left);
        const shift=await table.evaluate(el=>{el.scrollLeft=Math.min(100,el.scrollWidth-el.clientWidth);return el.scrollLeft});
        assert(shift>10,'horizontal swipe did not move the score table at '+width);
        const after=await table.locator('tbody tr:first-child td:first-child').evaluate(el=>el.getBoundingClientRect().left);
        assert(Math.abs(before-after)<=2,'sticky target name did not remain visible during scrolling');
        await table.evaluate(el=>{el.scrollLeft=0});
      }
    }else{
      assert(layout.nameWidth>0,'desktop name column missing');
      assert(layout.metricWidth>0,'desktop score column missing');
    }
    assert(!errors.some(e=>/SyntaxError|TypeError|ReferenceError/.test(e)),
      'Uncaught script errors: '+errors);
    console.log('R38 P16 compact horizontally scrollable public scores PASS',
      engine===webkit?'webkit':'chromium',rows+'x'+cols,width,lang,layout);
  };
  for(const width of [320,390,760,1024])
    await run({id:IDS.small,rows:4,cols:4,width});
  for(const width of [320,390,760,1024])
    await run({id:IDS.large,rows:40,cols:10,width});
  await page.evaluate(()=>localStorage.setItem('statsMaker.locale','en'));
  await run({id:IDS.small,rows:4,cols:4,width:390,lang:'en'});
  assert.equal(requests.length,0,'Real Supabase requests are not allowed in UI QA');
  console.log('R38 P16 original horizontal public matrix and isolated mock DB PASS');
}finally{await browser.close()}
