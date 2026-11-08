// Read-only check of real Public work visualization on the production site.
// Select a currently Public ID from the SSR Discover page, not a stale fixture.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const BASE=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
async function publicTopic(){
  const res=await fetch(BASE+'/discover?lang=ja',{signal:AbortSignal.timeout(15000),
    headers:{Accept:'text/html'},cache:'no-store'});
  assert.equal(res.status,200,'Discover Public SSR must be reachable');
  const html=await res.text();
  const dataText=html.match(/<script type="application\/json" id="discover-ssr-data">([^<]*)<\/script>/)?.[1];
  assert(dataText,'Live Public Discover SSR data is missing');
  const parsed=JSON.parse(dataText);
  const all=parsed?.data?.rows;
  assert(Array.isArray(all),'Public-only SSR rows missing');
  const candidates=all.filter(row=>row?.visibility==='public'&&/^[0-9a-f-]{36}$/i.test(row.id));
  assert(candidates.length>0,'No current Public work to audit');
  return candidates.find(row=>Array.isArray(row.snapshot?.criteria)&&row.snapshot.criteria.length>=3)
    ||candidates[0];
}
const topic=await publicTopic();
const context=await browser.newContext({locale:'ja-JP'});
await context.addInitScript(()=>{
  localStorage.setItem('statsMaker.locale','ja');
  localStorage.setItem('statsMakerV2Language','ja');
});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  let confirmed=false;
  for(let attempt=1;attempt<=6;attempt++){
    await page.setViewportSize({width:390,height:844});
    try{
      const res=await page.goto(BASE+'/public.html?id='+encodeURIComponent(topic.id)+
        '&qa=r130-'+attempt,{waitUntil:'domcontentloaded',timeout:25000});
      assert(res?.ok(),'Public work viewer did not respond with 200');
      await page.locator('.publicGlance').waitFor({state:'visible',timeout:14000});
      confirmed=true;
      break;
    }catch(error){
      console.log('Waiting for deployed Public preview '+attempt+'/6: '+error.message.slice(0,140));
      if(attempt<6)await delay(12000);
    }
  }
  assert(confirmed,'Production Public viewer has not deployed first-view preview');
  for(const width of [390,1180]){
    await page.setViewportSize({width,height:844});
    const state=await page.evaluate(()=>{
      const glance=document.querySelector('.publicGlance');
      const columns=[...document.querySelectorAll('.glanceColumn')];
      const scoreTable=document.querySelector('.creatorScoreTable');
      const actions=document.querySelector('.primaryActions');
      const matrix=document.querySelector('.creatorScoreTable');
      const rect=glance?.getBoundingClientRect();
      const bounds=columns.map(c=>c.getBoundingClientRect().toJSON());
      return {exists:!!glance,width:rect?.width,layoutWidth:glance?.clientWidth,
        contentWidth:glance?.scrollWidth,
        rankingRows:glance?.querySelectorAll('.glanceRankRow').length||0,
        radar:!!glance?.querySelector('.glanceRadarSvg'),
        fallback:!!glance?.querySelector('.glanceNoRadar'),
        scoreTable:!!scoreTable,hasCommunity:!!document.querySelector('#communitySection'),
        beforeActions:!!(actions&&(glance.compareDocumentPosition(actions)&Node.DOCUMENT_POSITION_FOLLOWING)),
        beforeMatrix:!!(matrix&&(glance.compareDocumentPosition(matrix)&Node.DOCUMENT_POSITION_FOLLOWING)),
        bounds};
    });
    assert(state.exists&&state.scoreTable&&state.hasCommunity,
      'Public preview must coexist with original scores and Community');
    assert(state.beforeActions&&state.beforeMatrix,'Preview must be above primary actions and matrix');
    assert(state.rankingRows>=1&&state.rankingRows<=3,'No legitimate top-3 bars visible');
    assert(state.radar||state.fallback,'Radar or explicit incomplete-score message required');
    assert(state.contentWidth<=state.layoutWidth+3,
      'R130 preview must not introduce horizontal overflow at '+width+': '+JSON.stringify(state));
    assert(state.bounds.length===2);
    if(width===390)
      assert(state.bounds[1].top>=state.bounds[0].bottom-2,
        'Comparison columns must stack on mobile');
    else
      assert(Math.abs(state.bounds[1].top-state.bounds[0].top)<4,
        'Comparison columns must be side by side on desktop');
    console.log('LIVE R130 work comparison PASS',{width,
      radar:state.radar,rankingRows:state.rankingRows,previewWidth:state.width});
  }
  assert(!errors.some(x=>/publicGlance|SyntaxError|Cannot read properties of undefined/.test(x)),
    'Public page JavaScript errors: '+JSON.stringify(errors));
}finally{await browser.close()}
