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
    ['/index.html?analyticsDebug=1','home'],
    ['/index.html?community=57b432ed-fbf2-4261-b57d-9e0f27356d2e&analyticsDebug=1','community'],
    ['/discover.html?analyticsDebug=1','discover'],
    ['/public.html?id=SECRET-UNLISTED-ID&analyticsDebug=1','published'],
    ['/my.html?analyticsDebug=1','my_works']
  ];
  for(const [url,group] of routes){
    await page.goto(BASE+url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.SM_ANALYTICS);
    const state=await page.evaluate(()=>window.SM_ANALYTICS.state());
    assert.equal(state.configured,false);
    assert.equal(state.loaded,false);
    assert.equal(state.debug,true);
    assert.equal(state.events[0]?.name,'page_view');
    assert.equal(state.events[0]?.params.page_group,group);
  }
  await page.goto(BASE+'/discover.html?analyticsDebug=1',{waitUntil:'domcontentloaded'});
  await page.locator('[data-view="community"]').click();
  const items=await page.evaluate(()=>{
    window.SM_ANALYTICS.event('work_view',{
      work_code:'deadbeef',visibility:'public',outcome:'success',
      id:'REAL_USER_ID',score:99,title:'PRIVATE_TITLE',search:'PRIVATE_QUERY',
      page_location:'https://statsmaker.app/public?id=SECRET'
    });
    window.SM_ANALYTICS.event('work_view',{
      work_code:'not-valid-private-id',visibility:'unlisted',foo:'secret'
    });
    window.SM_ANALYTICS.event('not_on_allowlist',{password:'none'});
    return window.SM_ANALYTICS.state().events;
  });
  assert(items.some(x=>x.name==='discover_filter'&&x.params.filter_type==='community'));
  const work=items.filter(x=>x.name==='work_view');
  assert.equal(work.length,2);
  assert.equal(work[0].params.work_code,'deadbeef');
  assert.equal(work[0].params.visibility,'public');
  assert(!('id' in work[0].params));
  assert(!('title' in work[0].params));
  assert(!('score' in work[0].params));
  assert(!('search' in work[0].params));
  assert(!('page_location' in work[0].params));
  assert(!('work_code' in work[1].params));
  assert(!items.some(x=>x.name==='not_on_allowlist'));
  assert.equal(requests.length,0,'Unconfigured analytics made third-party requests');

  // BASIC consent mode: consent UI is configured on demand, no Google tag
  // network request until visitor explicitly grants analytics permission.
  await context.route('**/cloud/analytics-config.js*',async route=>{
    await route.fulfill({
      contentType:'application/javascript',
      body:"window.SM_ANALYTICS_CONFIG={enabled:true,measurementId:'G-TEST1234'};"
    });
  });
  await context.route(/^https:\/\/www\.googletagmanager\.com\/gtag\/js.*$/,async route=>{
    await route.fulfill({
      status:200,contentType:'application/javascript',
      body:'window.__ga4DummyLoaded=true;'
    });
  });
  await page.goto(BASE+'/discover.html?id=SECRET-UNLISTED-ID&utm_source=reddit&utm_medium=social&utm_campaign=launch&analyticsDebug=1',
    {waitUntil:'domcontentloaded'});
  await page.locator('#sm-analytics-consent').waitFor({state:'visible'});
  assert.equal(requests.length,0,'GA4 was loaded before consent');
  await page.locator('#sm-analytics-consent button').first().click();
  assert.equal(await page.evaluate(()=>window.SM_ANALYTICS.consent()),'denied');
  assert.equal(requests.length,0,'GA4 loaded after refusal');
  await page.locator('#sm-analytics-settings').click();
  await page.locator('#sm-analytics-consent button').last().click();
  await page.waitForFunction(()=>window.__ga4DummyLoaded===true);
  const after=await page.evaluate(()=>{
    return {state:window.SM_ANALYTICS.state(),dataLayer:window.dataLayer.map(x=>Array.from(x))};
  });
  assert.equal(after.state.consent,'granted');
  assert.equal(after.state.loaded,true);
  assert(requests.some(x=>x.includes('googletagmanager.com/gtag/js?id=G-TEST1234')));
  const calls=after.dataLayer;
  const config=calls.find(x=>x[0]==='config');
  const pageView=calls.find(x=>x[0]==='event'&&x[1]==='page_view');
  assert.equal(config[1],'G-TEST1234');
  assert.equal(config[2].send_page_view,false,'Automatic raw-URL pageview must be disabled');
  assert.equal(pageView[2].page_location,
    BASE+'/discover?utm_source=reddit&utm_medium=social&utm_campaign=launch');
  assert(!JSON.stringify(calls).includes('SECRET-UNLISTED-ID'),
    'Analytics payload leaked a private URL query');
  assert.equal(pageView[2].page_group,'discover');

  // Revoking consent must disable further event forwarding.
  const before=calls.length;
  await page.locator('#sm-analytics-settings').click();
  await page.locator('#sm-analytics-consent button').first().click();
  await page.evaluate(()=>window.SM_ANALYTICS.event('share_action',{action_type:'share_url'}));
  const last=await page.evaluate(()=>window.dataLayer.map(x=>Array.from(x)));
  assert(!last.slice(before).some(x=>x[0]==='event'&&x[1]==='share_action'));
  await context.close();
  console.log('R33 analytics consent/privacy/route/debug QA PASS (no live Google tracking)');
}finally{await browser.close()}
