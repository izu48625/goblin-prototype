import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=(process.env.BASE_URL||'http://127.0.0.1:8765').replace(/\/+$/,'');
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const requests=[];
  context.on('request',r=>{
    if(/googletagmanager\.com|google-analytics\.com|cloudflareinsights\.com|\/analytics(?:\/|\.gif)/.test(r.url()))requests.push(r.url());
  });
  const page=await context.newPage();
  const routes=[
    '/index.html','/index.html?community=57b432ed-fbf2-4261-b57d-9e0f27356d2e',
    '/discover.html','/public.html?id=SECRET-UNLISTED-ID',
    '/my.html','/ja/','/en/'
  ];
  for(const url of routes){
    await page.goto(BASE+url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.SM_ANALYTICS);
    const state=await page.evaluate(()=>window.SM_ANALYTICS.state());
    assert.equal(state.configured,false,url);
    assert.equal(state.loaded,false,url);
    assert.equal(await page.locator('#sm-analytics-consent').count(),0,'Consent UI shown '+url);
    assert.equal(await page.locator('#sm-analytics-settings').count(),0,'GA4 settings shown '+url);
    assert.equal(requests.length,0,'Unexpected GA4 network request '+url);
  }
  // Even a visitor who previously accepted GA4 must no longer be tracked.
  await page.goto(BASE+'/discover.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.setItem('sm-analytics-consent-v1','granted'));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.SM_ANALYTICS);
  assert.equal((await page.evaluate(()=>window.SM_ANALYTICS.state())).loaded,false);
  assert.equal(requests.length,0,'Stored historic consent revived GA4');
  assert.equal(await page.locator('#sm-analytics-consent').count(),0);

  // Local-only debugging keeps the sanitizer, but does not contact Google.
  await page.goto(BASE+'/discover.html?analyticsDebug=1',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.SM_ANALYTICS);
  const items=await page.evaluate(()=>{
    window.SM_ANALYTICS.event('work_view',{
      work_code:'deadbeef',visibility:'public',outcome:'success',
      id:'PRIVATE_ID',score:88,title:'PRIVATE_TITLE',search:'PRIVATE_SEARCH',
      page_location:'https://statsmaker.app/public?id=SECRET'
    });
    window.SM_ANALYTICS.event('work_view',{work_code:'SECRET',visibility:'unlisted'});
    window.SM_ANALYTICS.event('not_allowed',{email:'secret@example.com'});
    window.SM_ANALYTICS.setConsent('granted');
    return window.SM_ANALYTICS.state();
  });
  const work=items.events.filter(x=>x.name==='work_view');
  assert.equal(work.length,2);
  assert.equal(work[0].params.work_code,'deadbeef');
  for(const key of ['id','score','title','search','page_location'])
    assert(!(key in work[0].params),'Leaked private field '+key);
  assert(!('work_code' in work[1].params));
  assert(!items.events.some(x=>x.name==='not_allowed'));
  assert.equal(items.loaded,false,'Manual consent bypassed global off switch');
  assert.equal(requests.length,0,'Debug sent GA4 request');
  await context.close();
  console.log('R45 GA4 paused across routes; no consent banner/Google requests; old consent & debug PASS');
}finally{await browser.close()}
