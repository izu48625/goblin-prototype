import {clickBasic} from './r80-qa-click.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
const paths=['/index.html','/discover.html','/public.html','/my.html','/app/editor.html'];
try{
  const context=await browser.newContext({
    locale:'ja-JP',viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const errors=[];
  const page=await context.newPage();
  page.on('pageerror',e=>{if(!/Project not found/i.test(e.message))errors.push(e.message)});
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  const frame=page.frameLocator('#basicFrame');
  await frame.locator('#scoreTable').waitFor({state:'visible',timeout:25000});
  const nav=page.locator('.globalLocaleBar');
  assert.equal(await nav.locator('.globalHomeBtn').count(),1);
  assert.equal(await nav.locator('.globalDiscoverBtn').count(),1);
  assert.equal(await nav.locator('[data-global-lang]').count(),2);
  assert.equal(await frame.locator('#discoverBtn,#columnManageBtn').count(),0,
    'Removed Discover or metric toggle returned to the Home action row');
  assert.equal(await frame.locator('#columnManage .columnChip').count(),4,
    'All metric editing chips must be shown without a toggle');
  const metricPanel=frame.locator('#columnManage');
  assert(await metricPanel.isVisible());
  await clickBasic(frame,'scoreSettingsBtn');
  assert(await metricPanel.isVisible(),'Score settings incorrectly hide metric management');
  await clickBasic(frame,'moreToolsBtn');
  assert(await metricPanel.isVisible(),'More menu incorrectly hides metric management');
  await frame.locator('#overviewViewBtn').click();
  assert(await metricPanel.isVisible(),'Overview view hid metric chips');
  await frame.locator('#fitViewBtn').click();
  assert(await metricPanel.isVisible(),'Fit view hid metric chips');
  await frame.locator('#sheetViewBtn').click();

  // Changes to metric editing must still update the actual Home sheet.
  await frame.locator('#addColBtn').click();
  assert.equal(await metricPanel.locator('.columnChip').count(),5);
  await metricPanel.locator('[data-delete-col="4"]').click();
  assert.equal(await metricPanel.locator('.columnChip').count(),4);

  const homeNavRect=await nav.evaluate(el=>{
    const home=el.querySelector('.globalHomeBtn').getBoundingClientRect();
    const discover=el.querySelector('.globalDiscoverBtn').getBoundingClientRect();
    const languages=el.querySelector('.globalLocaleControls').getBoundingClientRect();
    return {homeX:home.x,discoverX:discover.x,homeRight:home.right,
      discoverRight:discover.right,langX:languages.x,viewport:innerWidth};
  });
  assert(homeNavRect.homeRight<=homeNavRect.discoverX+2,'Discover is not beside HOME');
  assert(homeNavRect.discoverRight<=homeNavRect.langX+2,'Discover overlaps JA/EN');
  assert(homeNavRect.langX<homeNavRect.viewport,'Language control escaped iPhone viewport');

  await page.goto(BASE+'/index.html?adPreview=1',{waitUntil:'domcontentloaded'});
  const adFrame=page.frameLocator('#basicFrame');
  await adFrame.locator('[data-sm-slot="home-inline"]').waitFor({timeout:20000});
  const ad=await adFrame.locator('[data-sm-slot="home-inline"]').evaluate(el=>({
    previous:el.previousElementSibling?.matches('header.topbar'),
    position:el.compareDocumentPosition(document.querySelector('.workspace')),
    style:getComputedStyle(el).borderTopStyle,
    width:getComputedStyle(el).borderTopWidth,
    label:el.textContent
  }));
  assert(ad.previous,'Home ad preview is not immediately under the action header');
  assert((ad.position&4)!==0,'Home ad preview must appear before the workspace');
  assert.equal(ad.style,'dashed');
  assert.equal(ad.width,'2px');
  assert(ad.label.includes('メイン操作直下'));
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  await page.frameLocator('#basicFrame').locator('#scoreTable').waitFor({timeout:25000});
  assert.equal(await page.frameLocator('#basicFrame').locator('[data-sm-slot]').count(),0,
    'Ads leaked into normal Home without adPreview opt-in');

  // The same global navigation appears on the browsing and editor routes.
  for(const path of paths.slice(1)){
    let full=path;
    if(path==='/app/editor.html'){
      await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
      const id=await page.evaluate(async()=>{
        const [{createProject},{saveProject}]=await Promise.all([
          import('/app/src/core/project.js'),import('/app/src/core/store.js')
        ]);
        const p=createProject('bar');p.meta.title='R31 UI QA';saveProject(p);return p.id;
      });
      full+='?id='+encodeURIComponent(id);
    }
    await page.goto(BASE+full,{waitUntil:'domcontentloaded'});
    await page.locator('.globalDiscoverBtn').waitFor({state:'visible',timeout:15000});
    assert.equal(await page.locator('.globalHomeBtn').count(),1,path);
    assert.equal(await page.locator('.globalDiscoverBtn').count(),1,path);
    assert((await page.locator('.globalDiscoverBtn').getAttribute('href')).endsWith('/discover.html'),path);
    if(path==='/public.html')assert.equal(await page.locator('.discoverLink').count(),0);
  }
  assert.deepEqual(errors,[],'Unexpected browser errors during R31 Home UI checks');
  console.log('R31 Home compact/nav/metric/ad-preview QA PASS');
}finally{await browser.close()}
