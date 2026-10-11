import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:8765';
const browser=await chromium.launch({headless:true});
const cases=[
  {path:'/discover.html',count:2,label:'Discover'},
  {path:'/public.html',count:2,label:'Published work'},
  {path:'/my.html',count:1,label:'My Works'},
  {path:'/rate.html?legacy=1',count:1,label:'Legacy Community'},
  {path:'/app/editor.html',count:2,label:'Graph editor'},
  {path:'/base/index.html',count:1,label:'Home inner frame'}
];
function previewURL(path){
  return BASE+path+(path.includes('?')?'&':'?')+'adPreview=1';
}
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const requests=[];
  context.on('request',r=>{
    if(/pagead2\.googlesyndication|doubleclick\.net|adsbygoogle|googletag/.test(r.url()))
      requests.push(r.url());
  });
  const page=await context.newPage();
  for(const item of cases){
    let targetPath=item.path;
    // The visual editor requires a real local-only project to stay on screen.
    // Create one in an isolated test browser; never touch cloud publications.
    if(item.label==='Graph editor'){
      await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded',timeout:45000});
      const id=await page.evaluate(async()=>{
        const [{createProject},{saveProject}]=await Promise.all([
          import('/app/src/core/project.js'),import('/app/src/core/store.js')
        ]);
        const project=createProject('bar');
        project.meta.title='R31 AD LAYOUT LOCAL QA';
        saveProject(project);
        return project.id;
      });
      targetPath+='?id='+encodeURIComponent(id);
    }
    await page.goto(BASE+targetPath,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(await page.locator('[data-sm-slot]').count(),0,
      item.label+' unexpectedly renders ad inventory to visitors');
    await page.goto(previewURL(targetPath),{waitUntil:'domcontentloaded',timeout:45000});
    await page.waitForFunction(expected=>
      document.querySelectorAll('[data-sm-slot]').length===expected,
      item.count,{timeout:15000});
    assert.equal(await page.locator('.sm-ad-preview').count(),item.count,
      item.label+' design preview count mismatch');
    assert.equal(await page.locator('ins.adsbygoogle').count(),0,
      'Google ad markup served before approval');
    assert.equal(await page.locator('iframe[src*="doubleclick"]').count(),0,
      'Ads iframe served before approval');
    if(item.label==='Graph editor'){
      // Editor's mobile settings sheet intentionally stays closed by default.
      // Its ad slot should only become visible when the user opens that sheet.
      assert.equal(await page.locator('[data-sm-slot="editor-mobile"]').isVisible(),false);
      assert.equal(await page.locator('[data-sm-slot="editor-sidebar"]').isVisible(),false);
      await page.locator('.mobile-bottom-tabs .mobile-tab').first().click();
      await page.locator('[data-sm-slot="editor-mobile"]').waitFor({
        state:'visible',timeout:12000
      });
    }
    console.log('PASS '+item.label+' normal hidden / preview '+item.count);
  }
  // Home is an outer, full-height shell containing a same-origin iframe.
  await page.goto(BASE+'/?adPreview=1',{waitUntil:'domcontentloaded',timeout:45000});
  const frame=page.frameLocator('#basicFrame');
  await frame.locator('[data-sm-slot="home-inline"]').waitFor({timeout:20000});
  assert.equal(await frame.locator('[data-sm-slot]').count(),1);
  assert.equal(await page.locator('[data-sm-slot]').count(),0,
    'Outer Home should not overlap the editor and submit controls');
  await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await frame.locator('main.app').waitFor({timeout:20000});
  assert.equal(await frame.locator('[data-sm-slot]').count(),0);
  // R31: opt-in ad placement must follow the actual user navigation chain,
  // not just work when a developer manually types ?adPreview=1 on each page.
  await page.goto(BASE+'/?adPreview=1',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.globalDiscoverBtn').waitFor({state:'visible',timeout:15000});
  assert.equal(new URL(await page.locator('.globalDiscoverBtn').getAttribute('href')).searchParams.get('adPreview'),'1');
  await page.locator('.globalDiscoverBtn').click();
  await page.waitForURL(url=>url.pathname.endsWith('/discover.html')&&url.searchParams.get('adPreview')==='1');
  await page.locator('[data-sm-slot="discover-primary"]').waitFor({state:'visible',timeout:15000});
  await page.locator('[data-sm-slot="discover-secondary"]').waitFor({state:'visible',timeout:15000});

  // Discover inserts cards dynamically; captured same-origin link clicks must
  // preserve the preview marker without modifying copied/share URLs.
  await page.evaluate(()=>{
    const link=document.createElement('a');
    link.id='r31-preview-public-link';
    link.href='public.html?id=11111111-1111-4111-8111-111111111111&v=qa';
    link.textContent='Preview published page';
    document.body.appendChild(link);
  });
  await page.locator('#r31-preview-public-link').click();
  await page.waitForURL(url=>url.pathname.endsWith('/public.html')&&url.searchParams.get('adPreview')==='1');
  await page.locator('[data-sm-slot="public-primary"]').waitFor({state:'visible',timeout:15000});
  await page.locator('[data-sm-slot="public-secondary"]').waitFor({state:'visible',timeout:15000});

  await page.locator('.globalHomeBtn').click();
  await page.waitForURL(url=>url.pathname.endsWith('/index.html')&&url.searchParams.get('adPreview')==='1');
  await page.frameLocator('#basicFrame').locator('[data-sm-slot="home-inline"]').waitFor({state:'visible',timeout:20000});

  // Extension opens via JS rather than a normal anchor. It should also carry
  // preview through to the visual editor without fetching ad vendors.
  await page.locator('#extLauncher').click();
  await page.locator('.extCard').first().click();
  await page.waitForURL(url=>url.pathname.endsWith('/app/editor.html')&&url.searchParams.get('adPreview')==='1',
    {timeout:25000});
  await page.locator('[data-sm-slot="editor-mobile"]').waitFor({state:'attached',timeout:15000});

  // Ordinary visitors never inherit preview state, even after a previous
  // preview was opened in the same browser tab.
  await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.globalDiscoverBtn').click();
  await page.waitForURL(url=>url.pathname.endsWith('/discover.html'));
  assert.equal(new URL(page.url()).searchParams.has('adPreview'),false,
    'Normal navigation unexpectedly retained ad preview');
  assert.equal(await page.locator('[data-sm-slot]').count(),0,
    'Normal Discover unexpectedly displays preview slots');
  assert.deepEqual(requests,[],'Unexpected external ad calls');
  await context.close();
  console.log('R31 ad placement layout QA PASS, no ad serving or iframe control overlays');
}finally{
  await browser.close();
}
