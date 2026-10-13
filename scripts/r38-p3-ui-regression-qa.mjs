import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import sharp from 'sharp';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const raw=await readFile(new URL('./r28-publish-lifecycle-test.mjs',import.meta.url),'utf8');
const mockLine=raw.match(/^const mockSdk=(".+");$/m);
assert(mockLine,'R28 isolated mocked Supabase SDK fixture missing');
const mockSdk=JSON.parse(mockLine[1]);

const engine=process.env.BROWSER_ENGINE==='webkit'?webkit:chromium;
const browser=await engine.launch({headless:true});
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
  assert(iframeSource?.includes('base/index.html?v=r38p9layer1'),
    'Home iframe document still uses a stale cache key');
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  const cssSource=await home.locator('link[href^="css/style.css"]').getAttribute('href');
  assert.equal(cssSource,'css/style.css?v=r38p9layer1',
    'Home document still references cached old score-cell CSS');
  await home.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
  await home.locator('#scoreSettingsBtn').click();
  await home.locator('#scale10Btn').click();
  await home.locator('#scoreSettingsBtn').click();
  const values=[10,9,8,6];
  for(let i=0;i<values.length;i++)
    await home.locator('[data-score-row="0"][data-score-col="'+i+'"]').fill(String(values[i]));
  await home.locator('#titleInput').click(); // Commit the final score's change event.
  await page.waitForTimeout(300); // CSS color transition settles before exact RGB comparison.
  // R38 P9: verify the actual transparent layer, stable backing, and pixels.
  const expectedRaw=[
    'rgba(218,94,159,.52)',
    'rgba(169,144,143,.42)',
    'rgba(100,167,131,.48)',
    'rgba(76,135,198,.38)'
  ];
  const expectedCss=[
    'rgba(218, 94, 159, 0.52)',
    'rgba(169, 144, 143, 0.42)',
    'rgba(100, 167, 131, 0.48)',
    'rgba(76, 135, 198, 0.38)'
  ];
  const colors=await home.locator('#scoreTable').evaluate(el=>
    [...el.querySelectorAll('tbody tr:first-child td.scoreCell')].slice(0,4)
      .map(td=>({
        klass:td.className,
        tint:td.style.getPropertyValue('--score-tile-overlay'),
        backing:getComputedStyle(td).backgroundColor,
        layer:getComputedStyle(td).backgroundImage,
        value:td.querySelector('input')?.value
      })));
  assert.deepEqual(colors.map(x=>x.klass.split(' ').at(-1)),
    ['heat-ss','heat-s','heat-a','heat-c']);
  assert.deepEqual(colors.map(x=>x.tint),expectedRaw,
    'score tiles lost actual inline translucent RGBA');
  for(let i=0;i<4;i++){
    assert.equal(colors[i].backing,'rgb(16, 27, 48)',
      'tile backing is not the unified dark layer');
    assert(colors[i].layer.includes(expectedCss[i]),
      'transparent grade overlay not applied to background image');
  }
  console.log('R38 P9 10-point deep-translucent CSS layer PASS',colors);

  const pixelRGB=async locator=>{
    const png=await locator.screenshot({animations:'disabled'});
    const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const x=Math.min(12,info.width-2),y=Math.min(8,info.height-2);
    const offset=(y*info.width+x)*info.channels;
    return [...data.subarray(offset,offset+3)];
  };
  const expectedPixels=[[121,62,106],[80,76,88],[56,94,88],[39,68,105]];
  const rgbClose=(a,b)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=3);

  await home.locator('#scoreSettingsBtn').click();
  await home.locator('#scale100Btn').click();
  await home.locator('#scoreSettingsBtn').click();
  const referenceValues=[97,94,88,67];
  for(let i=0;i<referenceValues.length;i++)
    await home.locator('[data-score-row="0"][data-score-col="'+i+'"]')
      .fill(String(referenceValues[i]));
  await home.locator('#titleInput').click();
  const reference=await home.locator('#scoreTable').evaluate(el=>
    [...el.querySelectorAll('tbody tr:first-child td.scoreCell')].slice(0,4)
      .map(td=>({grade:td.classList[1],
        tint:td.style.getPropertyValue('--score-tile-overlay'),
        backing:getComputedStyle(td).backgroundColor,
        layer:getComputedStyle(td).backgroundImage})));
  assert.deepEqual(reference.map(x=>x.grade),['heat-ss','heat-s','heat-a','heat-c']);
  assert.deepEqual(reference.map(x=>x.tint),expectedRaw);
  assert(reference.every(x=>x.backing==='rgb(16, 27, 48)'));
  console.log('R38 P9 source photo 97/94/88/67 overlay PASS',reference);
  const avg=await home.locator('#scoreTable tbody tr:first-child td.avgCell').evaluate(el=>({
    className:el.className,
    backing:getComputedStyle(el).backgroundColor,
    layer:getComputedStyle(el).backgroundImage
  }));
  assert(avg.className.includes('heat-a') && avg.backing==='rgb(16, 27, 48)'
    && avg.layer.includes('rgba(100, 167, 131, 0.48)'),
    'average cell failed to inherit identical translucent A shading');

  // Measure real rendered pixel colors at identical positions. Don't confuse
  // getComputedStyle RGBA equivalence with final painted color equivalence.
  for(const width of [1365,390,320]){
    await page.setViewportSize({width,height:844});
    const samples=[];
    for(let i=0;i<4;i++){
      const input=home.locator('[data-score-row="0"][data-score-col="0"]');
      await input.fill(String(referenceValues[i]));
      await home.locator('#titleInput').click();
      const actual=await pixelRGB(home.locator('#scoreTable tbody tr:first-child td.scoreCell').first());
      assert(rgbClose(actual,expectedPixels[i]),
        'Actual composited tile pixel differs at '+width+' score '+referenceValues[i]+
        ': '+actual+' expected '+expectedPixels[i]);
      samples.push(actual);
    }
    console.log('R38 P9 layered RGBA screenshot pixel parity PASS',
      process.env.BROWSER_ENGINE||'chromium',width,samples);
  }
  await page.setViewportSize({width:390,height:844});

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
