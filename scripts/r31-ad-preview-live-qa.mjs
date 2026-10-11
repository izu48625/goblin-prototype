import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=(process.env.BASE_URL||'https://statsmaker.app').replace(/\/+$/,'');
const TOPIC_ID=process.env.PUBLIC_TOPIC_ID||'57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const nap=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForProductionRelease(){
  for(let attempt=0;attempt<30;attempt++){
    try{
      const stamp=Date.now();
      const [page,script]=await Promise.all([
        fetch(BASE+'/discover.html?adPreview=1&nocache='+stamp,{cache:'no-store'}),
        fetch(BASE+'/cloud/ad-layout.js?v=r32ad1&nocache='+stamp,{cache:'no-store'})
      ]);
      const [html,js]=await Promise.all([page.text(),script.text()]);
      if(page.ok&&script.ok&&
          html.includes('data-sm-ad-page="discover"')&&
          html.includes('みんなで評価')&&
          js.includes('desktopRail')){
        console.log('R31 production assets ready; canonical URL =',page.url);
        return;
      }
      console.log('Waiting for worker deployment',attempt+1,
        'HTML',page.status,html.includes('data-sm-ad-page="discover"'),
        'JS',script.status,js.includes('desktopRail'));
    }catch(e){console.log('Deployment poll:',String(e))}
    await nap(5000);
  }
  throw new Error('New R31 ad-preview build was not visible on production after polling');
}

await waitForProductionRelease();
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  await context.addInitScript(()=>{
    try{localStorage.setItem('statsMaker.locale','ja')}catch{}
  });
  const page=await context.newPage();
  const adRequests=[];
  context.on('request',r=>{
    if(/googlesyndication|doubleclick|adsbygoogle|googletag/.test(r.url()))adRequests.push(r.url());
  });

  async function check(url,slot,total){
    await page.goto(BASE+url,{waitUntil:'domcontentloaded',timeout:60000});
    const element=page.locator('[data-sm-slot="'+slot+'"]');
    await element.waitFor({state:'visible',timeout:30000});
    const state=await page.evaluate(()=>({
      pathname:location.pathname,search:location.search,
      page:document.body.dataset.smAdPage,
      count:document.querySelectorAll('[data-sm-slot]').length
    }));
    const box=await element.evaluate(el=>({
      border:getComputedStyle(el).borderTopStyle,
      width:el.getBoundingClientRect().width,
      height:el.getBoundingClientRect().height
    }));
    assert(state.count>=total,JSON.stringify(state));
    assert.equal(box.border,'dashed',JSON.stringify({state,box}));
    assert(box.width>100&&box.height>35,JSON.stringify({state,box}));
    console.log('PRODUCTION DOTTED SLOT PASS',url,'=>',page.url(),state,box);
  }
  await check('/discover.html?adPreview=1','discover-primary',4);
  await page.locator('[data-sm-slot="discover-anchor"]').waitFor({state:'visible'});
  await page.locator('[data-sm-slot="discover-anchor"] .sm-ad-preview-close').click();
  assert.equal(await page.locator('[data-sm-slot="discover-anchor"]').count(),0,'Anchor did not close');

  assert.equal(await page.locator('[data-view="all"]').innerText(),'すべての作品');
  assert.equal(await page.locator('[data-view="community"]').innerText(),'みんなで評価');
  await page.locator('[data-view="community"]').click();
  await page.waitForFunction(()=>document.querySelector('#sectionTitle')?.textContent==='みんなで評価できる作品');
  assert(await page.locator('[data-sm-slot]').count()>=4);

  await check('/public.html?id='+TOPIC_ID+'&adPreview=1','public-primary',4);
  await page.locator('[data-sm-slot="public-between-rankings"]').waitFor({state:'visible',timeout:30000});
  await page.locator('[data-sm-slot="public-share"]').waitFor({state:'attached',timeout:30000});
  await page.locator('[data-sm-slot="public-anchor"]').waitFor({state:'visible'});

  await check('/my.html?adPreview=1','works-inline',1);

  await page.goto(BASE+'/?adPreview=1',{waitUntil:'domcontentloaded',timeout:60000});
  const frame=page.frameLocator('#basicFrame');
  await frame.locator('[data-sm-slot="home-inline"]').waitFor({state:'visible',timeout:30000});
  await page.locator('.globalDiscoverBtn').click();
  await page.waitForURL(url=>url.searchParams.get('adPreview')==='1',{timeout:30000});
  await page.locator('[data-sm-slot="discover-primary"]').waitFor({state:'visible',timeout:30000});
  console.log('PRODUCTION NAVIGATION PASS: Home -> Discover',page.url());

  await page.goto(BASE+'/?adPreview=1&community='+encodeURIComponent(TOPIC_ID),
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.frameLocator('#basicFrame').locator('[data-sm-slot="home-inline"]')
    .waitFor({state:'visible',timeout:30000});
  console.log('PRODUCTION COMMUNITY PREVIEW PASS',page.url());

  await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:60000});
  const id=await page.evaluate(async()=>{
    const [{createProject},{saveProject}]=await Promise.all([
      import('/app/src/core/project.js'),import('/app/src/core/store.js')
    ]);
    const p=createProject('bar');
    p.meta.title='R31 Local Ad Layout QA';
    saveProject(p);
    return p.id;
  });
  await check('/app/editor.html?id='+encodeURIComponent(id)+'&adPreview=1','editor-top',4);
  await page.locator('[data-sm-slot="editor-share"]').waitFor({state:'attached'});
  await page.evaluate(()=>document.getElementById('exportPreviewModal').classList.remove('hidden'));
  await page.locator('[data-sm-slot="editor-share"]').waitFor({state:'visible'});
  await page.evaluate(()=>document.getElementById('exportPreviewModal').classList.add('hidden'));



  const desktop=await browser.newContext({viewport:{width:1720,height:900},locale:'ja-JP'});
  const pc=await desktop.newPage();
  await pc.goto(BASE+'/discover.html?adPreview=1',{waitUntil:'domcontentloaded'});
  await pc.locator('[data-sm-slot="discover-desktop-rail"]').waitFor({state:'visible'});
  const bounds=await pc.evaluate(()=>({
    rail:document.querySelector('[data-sm-slot="discover-desktop-rail"]').getBoundingClientRect().left,
    page:document.querySelector('.wrap').getBoundingClientRect().right
  }));
  assert(bounds.rail>=bounds.page,'Desktop side rail overlays Discover: '+JSON.stringify(bounds));
  await pc.goto(BASE+'/?adPreview=1',{waitUntil:'domcontentloaded'});
  await pc.frameLocator('#basicFrame').locator('[data-sm-slot="home-desktop-rail"]')
    .waitFor({state:'visible'});
  await pc.goto(BASE+'/?adPreview=1&community='+encodeURIComponent(TOPIC_ID),
    {waitUntil:'domcontentloaded'});
  await pc.frameLocator('#basicFrame').locator('[data-sm-slot="community-desktop-rail"]')
    .waitFor({state:'visible'});
  await desktop.close();

  await page.goto(BASE+'/discover.html',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(await page.locator('[data-sm-slot]').count(),0,
    'Ad preview unexpectedly displayed on ordinary production Discover');
  assert.deepEqual(adRequests,[],'Advertiser scripts unexpectedly requested');
  console.log('R32 LIVE PRODUCTION QA PASSED: additional ad inventory and labels');
}finally{await browser.close()}
