import {clickBasic} from './r80-qa-click.mjs';
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
  const outerMarkup=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const expectedFrame=outerMarkup.match(/base\/index\.html\?v=[a-z0-9._-]+/i)?.[0];
  assert(expectedFrame&&iframeSource?.includes(expectedFrame),
    'Home iframe source must match the current versioned site entrypoint');
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  const cssSource=await home.locator('link[href^="css/style.css"]').getAttribute('href');
  const homeMarkup=await readFile(new URL('../base/index.html',import.meta.url),'utf8');
  const expectedCssHref=homeMarkup.match(/css\/style\.css\?v=[a-z0-9._-]+/i)?.[0];
  assert(expectedCssHref&&cssSource===expectedCssHref,
    'Home stylesheet must match the revision linked by the current document');
  await home.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
  await clickBasic(home,'scoreSettingsBtn');
  await home.locator('#scale10Btn').click();
  await clickBasic(home,'scoreSettingsBtn');
  const values=[10,9,8,6];
  for(let i=0;i<values.length;i++)
    await home.locator('[data-score-row="0"][data-score-col="'+i+'"]').fill(String(values[i]));
  await home.locator('#titleInput').click(); // Commit the final score's change event.
  await page.waitForTimeout(300); // CSS color transition settles before exact RGB comparison.
  // R139: validate current opaque, pastel grading rather than the retired
  // dark translucent screenshot palette. This still checks real DOM painting,
  // all 7 bands, mobile/desktop pixels and the restored empty score cells.
  const palette={
    'heat-ss':'#e8b9b2','heat-s':'#edc9b9','heat-a':'#f1d9c4',
    'heat-b':'#efd2a6','heat-c':'#f8edcc','heat-d':'#e3edc9',
    'heat-e':'#d1dce9','heat-zero':'#c0cfdf'
  };
  const toRgb=hex=>{
    assert(/^#[0-9a-f]{6}$/i.test(hex),'Malformed score color '+hex);
    return [1,3,5].map(n=>parseInt(hex.slice(n,n+2),16));
  };
  const toCss=hex=>'rgb('+toRgb(hex).join(', ')+')';
  const colors=await home.locator('#scoreTable').evaluate(el=>
    [...el.querySelectorAll('tbody tr:first-child td.scoreCell')].slice(0,4)
      .map(td=>({
        grade:[...td.classList].find(s=>s.startsWith('heat-')),
        tint:td.style.getPropertyValue('--score-tile-overlay'),
        backing:getComputedStyle(td).backgroundColor,
        layer:getComputedStyle(td).backgroundImage,
        value:td.querySelector('input')?.value
      })));
  const expectedGrades10=['heat-ss','heat-s','heat-a','heat-c'];
  assert.deepEqual(colors.map(x=>x.grade),expectedGrades10);
  assert.deepEqual(colors.map(x=>x.tint),expectedGrades10.map(g=>palette[g]),
    'R139 current light palette does not match grading rules in 10-point mode');
  assert(colors.every((x,i)=>x.backing===toCss(palette[expectedGrades10[i]])&&x.layer==='none'),
    'Score backgrounds must be the real solid grade colors, without glossy gradients');
  const blank=await home.locator('#scoreTable tbody tr:nth-child(2) td.scoreCell').first().evaluate(td=>({
    hasGrade:[...td.classList].some(x=>x.startsWith('heat-')),
    backing:getComputedStyle(td).backgroundColor,
    layer:getComputedStyle(td).backgroundImage
  }));
  assert(!blank.hasGrade&&blank.layer==='none'&&blank.backing==='rgb(255, 255, 255)',
    'Missing scores must remain ungraded and white');

  const cellPixelPair=async locator=>{
    const png=await locator.screenshot({animations:'disabled'});
    const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const x=Math.min(12,info.width-2);
    const at=y=>{
      const off=(y*info.width+x)*info.channels;
      return [...data.subarray(off,off+3)];
    };
    return {top:at(Math.min(8,info.height-2)),
      bottom:at(Math.max(1,info.height-8))};
  };
  const rgbClose=(a,b)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=5);
  const baselineTopRGB=[];

  await clickBasic(home,'scoreSettingsBtn');
  await home.locator('#scale100Btn').click();
  await clickBasic(home,'scoreSettingsBtn');
  const referenceValues=[97,94,88,67];
  for(let i=0;i<referenceValues.length;i++)
    await home.locator('[data-score-row="0"][data-score-col="'+i+'"]')
      .fill(String(referenceValues[i]));
  await home.locator('#titleInput').click();
  const expectedGrades100=['heat-s','heat-s','heat-a','heat-c'];
  const reference=await home.locator('#scoreTable').evaluate(el=>
    [...el.querySelectorAll('tbody tr:first-child td.scoreCell')].slice(0,4)
      .map(td=>({grade:[...td.classList].find(s=>s.startsWith('heat-')),
        tint:td.style.getPropertyValue('--score-tile-overlay'),
        backing:getComputedStyle(td).backgroundColor,
        layer:getComputedStyle(td).backgroundImage})));
  assert.deepEqual(reference.map(x=>x.grade),expectedGrades100);
  assert.deepEqual(reference.map(x=>x.tint),expectedGrades100.map(g=>palette[g]));
  assert(reference.every((x,i)=>
    x.backing===toCss(palette[expectedGrades100[i]])&&x.layer==='none'));
  const avg=await home.locator('#scoreTable tbody tr:first-child td.avgCell').evaluate(el=>({
    className:el.className,
    backing:getComputedStyle(el).backgroundColor,
    layer:getComputedStyle(el).backgroundImage
  }));
  assert(avg.className.includes('heat-a')&&
    avg.backing===toCss(palette['heat-a'])&&avg.layer==='none',
    'Average must use the same light palette as individual scores');

  const pixelValues=[100,94,88,70,67,60,50];
  const pixelGrades=['heat-ss','heat-s','heat-a','heat-b','heat-c','heat-c','heat-d'];
  const targets=pixelGrades.map(g=>toRgb(palette[g]));
  for(const width of [1365,390,320]){
    await page.setViewportSize({width,height:844});
    const samples=[];
    for(let i=0;i<pixelValues.length;i++){
      await home.locator('[data-score-row="0"][data-score-col="0"]')
        .fill(String(pixelValues[i]));
      await home.locator('#titleInput').click();
      const actual=await cellPixelPair(home.locator('#scoreTable tbody tr:first-child td.scoreCell').first());
      assert(rgbClose(actual.top,targets[i]),
        'R139 light score pixel mismatch at '+width+' score '+pixelValues[i]+
        ' actual '+actual.top+' expected '+targets[i]);
      assert(rgbClose(actual.bottom,actual.top),
        'Grade surface has unwanted gradient at '+width+' score '+pixelValues[i]);
      if(width===1365)baselineTopRGB[i]=actual.top;
      else assert(rgbClose(actual.top,baselineTopRGB[i]),
        'PC/mobile score RGB mismatch at '+width+' score '+pixelValues[i]);
      samples.push({score:pixelValues[i],actual:actual.top});
    }
    console.log('R139 opaque scoring screenshot parity PASS',
      process.env.BROWSER_ENGINE||'chromium',width,samples);
  }
  // Underlying striped rows must not affect the current opaque grade colors.
  await page.setViewportSize({width:390,height:844});
  await home.locator('[data-score-row="0"][data-score-col="0"]').fill('97');
  await home.locator('[data-score-row="1"][data-score-col="0"]').fill('97');
  await home.locator('#titleInput').click();
  await page.waitForTimeout(250);
  const odd=await cellPixelPair(home.locator('#scoreTable tbody tr:first-child td.scoreCell').first());
  const even=await cellPixelPair(home.locator('#scoreTable tbody tr:nth-child(2) td.scoreCell').first());
  assert(rgbClose(odd.top,even.top),
    'Opaque score colors should not depend on odd/even row: '+odd.top+' vs '+even.top);
  await home.locator('[data-score-row="1"][data-score-col="0"]').fill('');
  await home.locator('#titleInput').click();
  console.log('R139 iPhone light, 10/100 and no-gloss scoring palette PASS');

  // R38 P14: screenshot-matched palette is default ON. A single toggle next
  // to the "All" grade filter neutralizes table/average/fit/overview displays
  // without touching score values, grade classes or the sheet's stored JSON.
  assert.equal(await home.locator('#gradeFilter').count(),0,'retired All dropdown must be removed');
  assert.equal(await home.locator('#filterCount').count(),0,'retired row count must be removed');
  const toggle=home.locator('#scoreColorToggleBtn');
  await toggle.waitFor({state:'attached'});
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  assert.equal(await toggle.innerText(),'色 ON');
  const stateBefore=await home.locator('body').evaluate(()=>{
    const sheet=window.__statsMakerGetActiveSheet();
    delete sheet.updatedAt; // pending pre-existing autosave may legitimately refresh it
    return JSON.stringify(sheet);
  });
  const checkColor=async(expected)=>{
    return home.locator('body').evaluate(()=>{
      const selectors=[
        '#scoreTable tbody tr:first-child td.scoreCell',
        '#scoreTable tbody tr:first-child td.avgCell',
        '.fitTable tbody tr:first-child td.fitScoreCell',
        '.fitTable tbody tr:first-child td.fitAverageCell',
        '.overviewMetric.heat-ss'
      ];
      return selectors.map(sel=>{
        const el=document.querySelector(sel);
        if(!el)throw new Error('Missing color sample selector '+sel);
        return {selector:sel,color:getComputedStyle(el).backgroundColor,
          grade:[...el.classList].find(c=>c.startsWith('heat-'))};
      });
    });
  };
  const original=await checkColor();
  assert.equal(original[0].color,toCss(palette['heat-s']));
  assert(original.slice(1).every(x=>x.color.startsWith('rgb(')),
    'Other comparison views should use the light, opaque grading palette');
  for(const width of [1365,390,320]){
    await page.setViewportSize({width,height:844});
    const geometry=await home.locator('.filterBar').evaluate(el=>{
      const search=el.querySelector('#searchInput').getBoundingClientRect();
      const toggle=el.querySelector('#scoreColorToggleBtn').getBoundingClientRect();
      const container=el.getBoundingClientRect();
      return {searchRight:search.right,toggleLeft:toggle.left,toggleRight:toggle.right,
        filterRight:container.right,buttonHeight:toggle.height};
    });
    if(width>760){
      assert(geometry.toggleLeft>=geometry.searchRight-1,
        'Desktop color switch stays to right of search '+width);
      assert(geometry.toggleRight<=geometry.filterRight+1 && geometry.buttonHeight>=30,
        'Desktop color switch still has a tap area '+width);
    }else{
      assert(await home.locator('#r80OptionsBtn').isVisible(),
        'Mobile color switch must be reachable via Settings '+width);
    }
    await clickBasic(home,'scoreColorToggleBtn');
    await page.waitForTimeout(220); // original scoreCell has a 120ms background transition
    assert.equal(await toggle.innerText(),'色 OFF');
    assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    assert(await home.locator('body').evaluate(el=>el.classList.contains('score-colors-off')));
    const off=await checkColor();
    assert(off.every(x=>x.color==='rgb(255, 255, 255)'),
      'OFF must neutralize normal/average/fit/overview tile backgrounds: '+JSON.stringify(off));
    const stillSame=await home.locator('body').evaluate(()=>{
      const sheet=window.__statsMakerGetActiveSheet();
      delete sheet.updatedAt;
      return JSON.stringify(sheet);
    });
    assert.equal(stillSame,stateBefore,'Color visibility toggle mutated scores or sheet metadata');
    await clickBasic(home,'scoreColorToggleBtn');
    await page.waitForTimeout(220); // measure the finished tint, not its transition frame
    assert.equal(await toggle.innerText(),'色 ON');
    assert.equal(await toggle.getAttribute('aria-pressed'),'true');
    assert.deepEqual((await checkColor()).map(x=>x.color),
      original.map(x=>x.color),'ON must restore original photo palette in every view');
    console.log('R38 P14 all-view score color toggle PASS',
      process.env.BROWSER_ENGINE||'chromium',width);
  }
  await page.setViewportSize({width:390,height:844});
  // Persistence belongs to a separate preference key, not the saved work.
  await clickBasic(home,'scoreColorToggleBtn');
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await page.waitForTimeout(950); // let prior score edits autosave normally
  await page.reload({waitUntil:'domcontentloaded'});
  await home.locator('#scoreColorToggleBtn').waitFor({state:'attached'});
  assert.equal(await toggle.getAttribute('aria-pressed'),'false','OFF was not restored on reload');
  assert.equal(await toggle.innerText(),'色 OFF');
  assert((await checkColor()).every(x=>x.color==='rgb(255, 255, 255)'));
  assert.equal(await home.locator('body').evaluate(()=>localStorage.getItem('statsMaker.scoreColorsVisible.v1')),'off');
  const afterReload=await home.locator('body').evaluate(()=>window.__statsMakerGetActiveSheet().rows[0].scores[0]);
  assert.equal(Number(afterReload),97,'score values not preserved through reload');
  // Verify JA/EN dynamic state label and retain default JA for remaining QA.
  await home.locator('body').evaluate(()=>window.SM_I18N.setLanguage('en'));
  assert.equal(await toggle.innerText(),'Color OFF');
  await home.locator('body').evaluate(()=>window.SM_I18N.setLanguage('ja'));
  assert.equal(await toggle.innerText(),'色 OFF');
  await clickBasic(home,'scoreColorToggleBtn');
  assert.equal(await toggle.innerText(),'色 ON');
  assert.equal(await home.locator('body').evaluate(()=>localStorage.getItem('statsMaker.scoreColorsVisible.v1')),'on');
  console.log('R38 P14 color setting survives reload and translates JA/EN PASS');

  const nav=page.locator('.globalLocaleBar');
  assert.equal(await nav.locator('.globalIntroBtn').count(),1);
  assert.equal(await nav.locator('.globalIntroBtn').innerText(),'作例');
  assert(new URL(await nav.locator('.globalIntroBtn').getAttribute('href')).pathname==='/ja/use-cases.html');
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
  await clickBasic(home,'publishBtn');
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
  await page.waitForURL(/\/ja\/use-cases\.html$/,{timeout:12000});
  assert((await page.locator('h1').innerText()).length>4);
  await page.locator('[data-global-lang="en"]').click();
  await page.waitForURL(/\/en\/use-cases\.html$/,{timeout:12000});
  assert.equal(await page.locator('.globalIntroBtn').innerText(),'Demos');
  assert.equal(new URL(await page.locator('.globalIntroBtn').getAttribute('href')).pathname,'/en/use-cases.html');
  assert.equal(await page.locator('.case').count(),5,'English worked cases must load');
  console.log('R38 P3 JA/EN visible examples navigation PASS');
}finally{await browser.close()}
