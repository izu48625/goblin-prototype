import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE=(process.env.BASE_URL||'http://127.0.0.1:8765').replace(/\/+$/,'');
const engines=process.env.REGION_BROWSER==='chromium'?[chromium]:[chromium,webkit];
const scenarios=[
  {name:'Japan',mode:'jp',auto:true},
  {name:'Germany EEA',mode:'consent_required',auto:false},
  {name:'UK',mode:'consent_required',auto:false},
  {name:'Swiss',mode:'consent_required',auto:false},
  {name:'United States',mode:'consent_required',auto:false},
  {name:'unknown',mode:'consent_required',auto:false},
  {name:'geo server error',mode:'error',auto:false},
  {name:'invalid response',mode:'malformed',auto:false}
];
for(const engine of engines){
 const browser=await engine.launch({headless:true});
 try{
  for(const sample of scenarios){
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
    const gaRequests=[];
    const page=await context.newPage();
    await page.route('**/api/analytics-region*',route=>{
      if(sample.mode==='error')return route.fulfill({status:503,contentType:'application/json',body:'{"mode":"jp"}'});
      if(sample.mode==='malformed')return route.fulfill({status:200,contentType:'text/html',body:'NOT_JSON'});
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({mode:sample.mode})});
    });
    await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js.*/,route=>{
      gaRequests.push(route.request().url());
      return route.fulfill({status:200,contentType:'application/javascript',body:'window.__gaTagMock=true;'});
    });
    await page.goto(BASE+'/discover.html?region=JP&country=JP&analyticsDebug=1',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.SM_ANALYTICS?.state().regionResolved===true,{timeout:10000});
    const initial=await page.evaluate(()=>window.SM_ANALYTICS.state());
    assert.equal(initial.region,sample.auto?'jp':'consent_required',sample.name);
    if(sample.auto){
      await page.waitForFunction(()=>window.SM_ANALYTICS?.state().loaded===true);
      assert.equal(await page.locator('#sm-analytics-consent').count(),0,'JP must not see initial prompt');
      assert.equal(initial.source,'jp_default');
      assert.equal(await page.evaluate(()=>localStorage.getItem('sm-analytics-consent-v2')),null,
        'Automatic JP analytics must not masquerade as explicit stored consent');
      assert.equal(gaRequests.length,1,'JP should load only one GA4 tag');
      const data=await page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
      assert(data.some(x=>x[0]==='event'&&x[1]==='page_view'));
      assert(!JSON.stringify(data).includes('country=JP'),'Never transmit spoofed URL flags');
      await page.locator('.globalSupportMenu>summary').click();
      await page.locator('#sm-analytics-settings').click();
      await page.locator('#sm-analytics-consent').waitFor({state:'visible'});
      const requestsBefore=gaRequests.length;
      await Promise.all([
        page.waitForEvent('load',{timeout:12000}),
        page.locator('#sm-analytics-consent button').first().click()
      ]);
      await page.waitForFunction(()=>window.SM_ANALYTICS?.state().regionResolved===true);
      const after=await page.evaluate(()=>window.SM_ANALYTICS.state());
      assert.equal(after.consent,'denied','JP visitor must be able to opt out');
      assert.equal(after.loaded,false,'Opt-out must unload GA script via reload');
      assert.equal(gaRequests.length,requestsBefore,'No further Google tags after opt-out');
    }else{
      await page.locator('#sm-analytics-consent').waitFor({state:'visible'});
      assert.equal(gaRequests.length,0,'No Google tracking before overseas consent: '+sample.name);
      assert.equal(initial.loaded,false);
      const buttons=page.locator('#sm-analytics-consent button');
      assert.equal(await buttons.count(),2);
      await buttons.first().click();
      await page.waitForFunction(()=>window.SM_ANALYTICS.state().consent==='denied');
      assert.equal(gaRequests.length,0,'Denied overseas visit must not load GA4');
      await page.locator('.globalSupportMenu>summary').click();
      await page.locator('#sm-analytics-settings').click();
      await page.locator('#sm-analytics-consent button').last().click();
      await page.waitForFunction(()=>window.SM_ANALYTICS.state().loaded===true);
      assert.equal(gaRequests.length,1,'Explicit overseas consent enables tag: '+sample.name);
      assert.equal(await page.evaluate(()=>localStorage.getItem('sm-analytics-consent-v2')),'granted');
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.SM_ANALYTICS.state().regionResolved===true);
      assert.equal(await page.locator('#sm-analytics-consent').count(),0,'Explicit consent persists');
      assert.equal(gaRequests.length,2);
    }
    await context.close();
    console.log('REGION BROWSER',engine.name(),sample.name,'PASS');
  }
  // Same browser, new overseas region after JP visit: no inherited implicit consent.
  const context=await browser.newContext({viewport:{width:320,height:690}});
  const page=await context.newPage();
  let region='jp';
  let loadCount=0;
  await page.route('**/api/analytics-region*',route=>route.fulfill({
    contentType:'application/json',body:JSON.stringify({mode:region})
  }));
  await page.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js.*/,route=>{
    loadCount++;
    return route.fulfill({contentType:'application/javascript',body:'window.__gaTagMock=true;'});
  });
  await page.goto(BASE+'/index.html?region=JP',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SM_ANALYTICS?.state().regionResolved===true);
  assert.equal(loadCount,1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sm-analytics-consent-v2')),null);
  region='consent_required';
  await page.goto(BASE+'/discover.html?region=JP',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.SM_ANALYTICS?.state().regionResolved===true);
  await page.locator('#sm-analytics-consent').waitFor({state:'visible'});
  assert.equal(loadCount,1,'Traveling from JP must NOT bypass overseas opt-in');
  const banner=await page.locator('#sm-analytics-consent').boundingBox();
  const reject=await page.locator('#sm-analytics-consent button').first().boundingBox();
  assert(banner&&reject&&reject.width>=44&&reject.height>=44,'Mobile overseas consent controls remain tappable at 320px');
  await page.locator('#sm-analytics-consent button').first().click();
  assert.equal(loadCount,1);
  await context.close();
  console.log('REGION BROWSER',engine.name(),'JP to overseas travel, 320px controls PASS');
 }finally{await browser.close()}
}
console.log('R44 region privacy simulations PASS (mocked geo; no physical overseas visit)');
