import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const raw=await readFile(new URL('./r28-publish-lifecycle-test.mjs',import.meta.url),'utf8');
const mockLine=raw.match(/^const mockSdk=(".+");$/m);
assert(mockLine,'R28 isolated mocked Supabase SDK fixture missing');
const mockSdk=JSON.parse(mockLine[1]);

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const realWrites=[];
  await context.route('**/supabase-js@2',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:mockSdk
  }));
  await context.route('**/ibpdxbeltdwkquowjeay.supabase.co/**',route=>{
    realWrites.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  // Catch the previous regression: the outer index iframe URL stayed at an
  // old cache version, so actual visitors loaded stale CSS despite passing
  // isolated tests with an empty browser cache.
  const iframeSource=await page.locator('#basicFrame').getAttribute('src');
  assert(iframeSource?.includes('base/index.html?v=r38p4palette1'),
    'Home iframe document still uses a stale cache key');
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  const cssSource=await home.locator('link[href^="css/style.css"]').getAttribute('href');
  assert.equal(cssSource,'css/style.css?v=r38p4palette1',
    'Home document still references cached old score-cell CSS');
  await home.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
  await home.locator('#scoreSettingsBtn').click();
  await home.locator('#scale10Btn').click();
  await home.locator('#scoreSettingsBtn').click();
  const values=[10,9,7,3];
  for(let i=0;i<values.length;i++)
    await home.locator('[data-score-row="0"][data-score-col="'+i+'"]').fill(String(values[i]));
  await home.locator('#titleInput').click(); // Commit the final score's change event.
  await page.waitForTimeout(300); // CSS color transition settles before exact RGB comparison.
  const colors=await home.locator('#scoreTable').evaluate(el=>{
    const tds=[...el.querySelectorAll('tbody tr:first-child td.scoreCell')];
    return tds.slice(0,4).map(td=>({klass:td.className,
      background:getComputedStyle(td).backgroundColor,value:td.querySelector('input')?.value}));
  });
  assert.deepEqual(colors.map(x=>x.klass.split(' ').at(-1)),
    ['heat-ss','heat-s','heat-b','heat-e']);
  assert.deepEqual(colors.map(x=>x.background),
    ['rgb(151, 78, 151)','rgb(134, 64, 156)','rgb(47, 110, 169)','rgb(48, 63, 94)']);
  assert.equal(new Set(colors.map(x=>x.background)).size,4,'Colored score tiles disappeared');
  console.log('R38 P3 colored 10-point score tile QA PASS',colors);

  const nav=page.locator('.globalLocaleBar');
  assert.equal(await nav.locator('.globalIntroBtn').count(),1);
  assert.equal(await nav.locator('.globalIntroBtn').innerText(),'紹介');
  assert(new URL(await nav.locator('.globalIntroBtn').getAttribute('href')).pathname==='/ja/');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    const widths=await nav.evaluate(el=>{
      const intro=el.querySelector('.globalIntroBtn').getBoundingClientRect();
      const discover=el.querySelector('.globalDiscoverBtn').getBoundingClientRect();
      const help=el.querySelector('.globalSupportMenu').getBoundingClientRect();
      const languages=el.querySelector('.globalLocaleControls').getBoundingClientRect();
      return {width:innerWidth,intro:Math.round(intro.right),discover:Math.round(discover.right),
        introLeft:Math.round(intro.left),helpLeft:Math.round(help.left),
        helpRight:Math.round(help.right),languagesLeft:Math.round(languages.left),
        languagesRight:Math.round(languages.right)};
    });
    assert(widths.discover<=widths.introLeft+1,'Intro overlaps Discover '+width);
    assert(widths.intro<=widths.helpLeft+1,'Intro overlaps Help '+width);
    assert(widths.helpRight<=widths.languagesLeft+1,'Help overlaps languages '+width);
    assert(widths.languagesRight<=width+1,'Language controls overflow '+width);
    console.log('R38 P3 responsive About nav PASS',widths);
  }
  await page.setViewportSize({width:390,height:844});
  await home.locator('#titleInput').fill('新しいお題 7');
  await home.locator('.nameInput').first().fill('テスト対象');
  await home.locator('#publishBtn').click();
  await home.locator('#publishTitleGuard').waitFor({state:'visible',timeout:10000});
  await home.locator('#publishSettingsPane:not(.hidden)').waitFor({timeout:20000});
  await home.locator('#publishExecuteBtn').click();
  assert((await home.locator('#publishStatus').innerText()).includes('表題'));
  const noChanges=await home.locator('body').evaluate(()=>window.__qaPublishDb?.calls||[]);
  assert.equal(noChanges.filter(x=>['insert','update','delete'].includes(x.operation)).length,0,
    'Default title caused real publish writes');
  await home.locator('#publishTitleConfirmInput').fill('人気キャラクター総合評価');
  await home.locator('#publishExecuteBtn').click();
  await home.locator('#publishResult:not(.hidden)').waitFor({timeout:12000});
  const saved=await home.locator('body').evaluate(()=>({
    title:window.__statsMakerGetActiveSheet?.().title,
    published:window.__qaPublishDb?.topics?.[0]?.title,
    calls:window.__qaPublishDb?.calls||[]
  }));
  assert.equal(saved.title,'人気キャラクター総合評価');
  assert.equal(saved.published,'人気キャラクター総合評価');
  assert(saved.calls.some(x=>x.table==='topics'&&x.operation==='insert'));
  assert.equal(realWrites.length,0,'A real Supabase endpoint was contacted');
  console.log('R38 P3 title guard blocks unnamed publication then saves valid title in mock DB PASS');

  await page.locator('.globalIntroBtn').click();
  await page.waitForURL(/\/ja\/$/,{timeout:12000});
  assert((await page.locator('h1').innerText()).length>4);
  await page.locator('[data-global-lang="en"]').click();
  await page.waitForURL(/\/en\/$/,{timeout:12000});
  assert.equal(await page.locator('.globalIntroBtn').innerText(),'About');
  assert.equal(new URL(await page.locator('.globalIntroBtn').getAttribute('href')).pathname,'/en/');
  console.log('R38 P3 JA/EN intro header navigation PASS');
}finally{await browser.close()}
