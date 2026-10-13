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
  assert(iframeSource?.includes('base/index.html?v=r38p12alpha1'),
    'Home iframe document still uses a stale cache key');
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  const cssSource=await home.locator('link[href^="css/style.css"]').getAttribute('href');
  assert.equal(cssSource,'css/style.css?v=r38p12alpha1',
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
  // R38 P12: validate a REAL translucent cell background and its real pixels.
  const expectedRaw=[
    'rgba(218,94,159,.52)',
    'rgba(168,80,34,.49)',
    'rgba(94,116,35,.48)',
    'rgba(45,100,156,.34)'
  ];
  const expectedCss=[
    'rgba(218, 94, 159, 0.52)',
    'rgba(168, 80, 34, 0.49)',
    'rgba(94, 116, 35, 0.48)',
    'rgba(45, 100, 156, 0.34)'
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
    assert.equal(colors[i].backing,expectedCss[i],
      'graded tile must have genuine RGBA background, not an opaque backing');
    assert.equal(colors[i].layer,'none',
      'graded tile must not use a faux transparent gradient');
  }
  // The selected G5 mood must be smoky orange, olive yellow-green and blue,
  // with SS unchanged from R38 P9: verify composite hue and real alpha.
  const channels=(rgba,base=[16,27,48])=>{
    const match=rgba.match(/^rgba\((\d+),(\d+),(\d+),\.(\d+)\)$/);
    assert(match,'bad transparent tint '+rgba);
    const opacity=Number('0.'+match[4]);
    return [1,2,3].map((pos,i)=>Math.round(Number(match[pos])*opacity+base[i]*(1-opacity)));
  };
  const [ssColor,sColor,aColor,cColor]=expectedRaw.map(c=>channels(c));
  assert.deepEqual(ssColor,[121,62,106],'SS red-purple must be unchanged');
  assert(sColor[0]>sColor[1]+25 && sColor[1]>sColor[2]+5,'S must be dark muted orange');
  assert(aColor[1]>aColor[0]+12 && aColor[0]>aColor[2]+5,'A must be olive yellow-green');
  assert(cColor[2]>cColor[1]+25 && cColor[1]>cColor[0]+15,'C must be dusky blue');
  const blank=await home.locator('#scoreTable tbody tr:nth-child(2) td.scoreCell').first().evaluate(td=>({
    hasGrade:[...td.classList].some(x=>x.startsWith('heat-')),
    backing:getComputedStyle(td).backgroundColor,
    layer:getComputedStyle(td).backgroundImage
  }));
  assert(!blank.hasGrade && blank.layer==='none' &&
    blank.backing==='rgb(16, 27, 48)',
    'empty score cells must keep the existing dark opaque background');
  console.log('R38 P12 true G5 alpha, no gloss and safe blank cells PASS',colors);

  const cellPixelPair=async locator=>{
    const png=await locator.screenshot({animations:'disabled'});
    const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const x=Math.min(12,info.width-2);
    const at=y=>{
      const offset=(y*info.width+x)*info.channels;
      return [...data.subarray(offset,offset+3)];
    };
    return {top:at(Math.min(8,info.height-2)),
      bottom:at(Math.max(1,info.height-8))};
  };
  const rgbClose=(a,b)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=4);
  const baselineTopRGB=[];

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
  assert(reference.every((x,i)=>x.backing===expectedCss[i] && x.layer==='none'));
  console.log('R38 P12 97/94/88/67 true transparent backgrounds PASS',reference);
  const avg=await home.locator('#scoreTable tbody tr:first-child td.avgCell').evaluate(el=>({
    className:el.className,
    backing:getComputedStyle(el).backgroundColor,
    layer:getComputedStyle(el).backgroundImage
  }));
  assert(avg.className.includes('heat-a') &&
    avg.backing==='rgba(94, 116, 35, 0.48)' && avg.layer==='none',
    'average cell must use the same real RGBA A tint without gloss');

  // The SAME RGBA is composited with the table, not an opaque per-cell fill.
  // Check painted pixels against CSS alpha math, including absence of top shine.
  const expectedPixelColors=expectedRaw.map(x=>channels(x));
  for(const width of [1365,390,320]){
    await page.setViewportSize({width,height:844});
    const samples=[];
    for(let i=0;i<4;i++){
      const input=home.locator('[data-score-row="0"][data-score-col="0"]');
      await input.fill(String(referenceValues[i]));
      await home.locator('#titleInput').click();
      const actual=await cellPixelPair(home.locator('#scoreTable tbody tr:first-child td.scoreCell').first());
      assert(rgbClose(actual.top,expectedPixelColors[i]),
        'RGBA composite did not match its dark table underlay at '+width+
        ', score '+referenceValues[i]+': '+actual.top+' vs '+expectedPixelColors[i]);
      assert(rgbClose(actual.bottom,actual.top),
        'Unexpected shine/gradient remains at '+width+', score '+
        referenceValues[i]+': top '+actual.top+' bottom '+actual.bottom);
      if(width===1365)baselineTopRGB[i]=actual.top;
      else assert(rgbClose(actual.top,baselineTopRGB[i]),
        'PC/mobile alpha composite mismatch at '+width+', score '+referenceValues[i]);
      samples.push(actual);
    }
    console.log('R38 P12 direct alpha pixels and no-gloss PC/mobile PASS',
      process.env.BROWSER_ENGINE||'chromium',width,samples);
  }
  // Same SS tint on alternate rows must reveal the darker/lighter table
  // underlay, demonstrating real see-through compositing rather than a
  // flattened one-color screenshot. Restore test rows afterward.
  await page.setViewportSize({width:390,height:844});
  await home.locator('[data-score-row="0"][data-score-col="0"]').fill('97');
  await home.locator('[data-score-row="1"][data-score-col="0"]').fill('97');
  await home.locator('#titleInput').click();
  await page.waitForTimeout(250);
  const odd=await cellPixelPair(home.locator('#scoreTable tbody tr:first-child td.scoreCell').first());
  const even=await cellPixelPair(home.locator('#scoreTable tbody tr:nth-child(2) td.scoreCell').first());
  const diff=odd.top.map((v,i)=>Math.abs(v-even.top[i]));
  assert(diff.some(v=>v>=2) && diff.every(v=>v<=6),
    'Same RGBA score should reveal subtle table-row surface contrast: '+
    odd.top+' vs '+even.top);
  await home.locator('[data-score-row="1"][data-score-col="0"]').fill('');
  await home.locator('#titleInput').click();
  console.log('R38 P12 actual see-through row-compositing PASS',odd.top,even.top);

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
