import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE='http://127.0.0.1:4173';
const rgb=s=>{const v=String(s||'').match(/[\d.]+/g)?.slice(0,3).map(Number);return v?.length===3?v:[999,999,999]};
const luminance=s=>{
 const c=rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [320,390,1180]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,locale:'ja-JP'});
  await context.route('https://*.supabase.co/**',r=>r.abort());
  await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'}));
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(BASE+'/index.html?lang=ja',{waitUntil:'load'})).status(),200);
  const f=page.frameLocator('#basicFrame');
  await f.locator('#scoreTable tbody tr:first-child td.scoreCell').first().waitFor({state:'visible'});
  const style=async()=>f.locator('body').evaluate(()=>{
    const get=s=>{const el=document.querySelector(s);if(!el)throw Error('missing selector '+s);
      const c=getComputedStyle(el);return {background:c.backgroundColor,color:c.color,placeholder:c.getPropertyValue('--score-tile-overlay')}};
    const placeholder=s=>{
      const el=document.querySelector(s);return getComputedStyle(el,'::placeholder').color;
    };
    return {body:get('body'),head:get('#scoreTable thead th.metricHead'),
      fixed:get('#scoreTable thead th.nameHead'),sortRow:get('#scoreTable .headerSortRow'),
      sortBtn:get('#scoreTable .headerSortBtn'),headInput:get('#scoreTable .metricHeaderInput'),
      thumb:get('#scoreTable .thumbBtn'),row:get('#scoreTable tbody td.nameCell'),
      empty:get('#scoreTable tbody td.scoreCell'),
      nameInput:get('#scoreTable .nameInput'),
      titleInput:get('#titleInput'),scorePlaceholder:placeholder('#scoreTable .scoreInput'),
      namePlaceholder:placeholder('#scoreTable .nameInput'),
      overflow:document.documentElement.scrollWidth-innerWidth};
  });
  const light=await style();
  assert(luminance(light.head.background)>.65,'Light table header should remain light');
  assert(luminance(light.thumb.background)>.60,'Light image add button should stay light');
  await f.locator('#r81ThemeBtn').click();
  await f.locator('html[data-sm-theme="dark"]').waitFor();
  await f.locator('link[data-sm-theme-harmony]').waitFor({state:'attached'});
  await f.locator('body').evaluate(async()=>{
    for(let n=0;n<60;n++){
      const link=document.querySelector('link[data-sm-theme-harmony]');
      if(link?.sheet?.cssRules?.length)break;
      await new Promise(r=>setTimeout(r,50));
    }
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    // Native scoring tiles have a 120ms background transition. Compare the
    // settled frame, not the intermediate gray while theme changes.
    await new Promise(r=>setTimeout(r,260));
  });
  const dark=await style();
  const surfaces=['head','fixed','sortRow','thumb','row','empty','titleInput'];
  for(const key of surfaces){
   assert(luminance(dark[key].background)<.16,
      'Dark UI still has a bright/light patch: '+key+' '+JSON.stringify(dark[key])+' DOM '+JSON.stringify(await f.locator('#scoreTable tbody td.scoreCell').first().evaluate(el=>({classes:el.className,css:getComputedStyle(el).backgroundColor,style:el.getAttribute('style'),body:document.body.className,theme:document.documentElement.dataset.smTheme,rule:el.matches('td.scoreCell:not(.heat-e):not(.heat-d):not(.heat-c):not(.heat-b):not(.heat-a):not(.heat-s):not(.heat-ss)')}))));
  }
  assert.equal(dark.head.background,dark.fixed.background,
    'Metric header has different surface than Target column');
  assert(ratio(dark.head.background,dark.headInput.color)>=4.5,
    'Metric heading illegible '+JSON.stringify(dark.headInput));
  assert(ratio(dark.sortRow.background,dark.sortBtn.color)>=4.5,
    'Sort buttons illegible');
  assert(ratio(dark.thumb.background,dark.thumb.color)>=4.5,
    'Image add control illegible');
  assert(ratio(dark.row.background,dark.namePlaceholder)>=4.5,
    'Subject name placeholder illegible');
  assert(ratio(dark.empty.background,dark.scorePlaceholder)>=4.5,
    'Empty score placeholder illegible');
  assert(dark.overflow<=2,'Dark grid overflows page at '+width);
  const score=f.locator('#scoreTable .scoreInput').first();
  await score.fill('97');
  await score.press('Tab');
  const tile=await f.locator('#scoreTable tbody td.scoreCell').first().evaluate(el=>({
     background:getComputedStyle(el).backgroundColor,
     grade:el.className,alpha:el.style.getPropertyValue('--score-tile-overlay')
  }));
  assert.equal(tile.alpha,'rgba(116,60,74,.42)','Score tile exact user RGBA was rewritten');
  assert.equal(tile.background,'rgba(116, 60, 74, 0.42)','Translucent score grade lost');
  if(width<500){
   await f.locator('#r80OptionsBtn').click();
   await f.locator('#r80ColorAction').click();
   assert.equal(await f.locator('#scoreColorToggleBtn').getAttribute('aria-pressed'),'false');
   const off=await f.locator('#scoreTable td.scoreCell').first().evaluate(el=>getComputedStyle(el).backgroundColor);
   assert(luminance(off)<.17,'Score Colors OFF was white in dark mode '+off);
   await f.locator('#r80ColorAction').click();
   assert.equal(await f.locator('#scoreColorToggleBtn').getAttribute('aria-pressed'),'true');
   await f.locator('#r81OptionsClose').click();
  }
  await f.locator('#overviewViewBtn').click();
  await f.locator('#overviewSheetView').waitFor({state:'visible'});
  await f.locator('#fitViewBtn').click();
  await f.locator('#fitSheetView').waitFor({state:'visible'});
  const fit=await f.locator('.fitTable thead th').first().evaluate(el=>getComputedStyle(el).backgroundColor);
  assert(luminance(fit)<.17,'Fit header stays light after theme change');
  await f.locator('#sheetViewBtn').click();
  await f.locator('#r81ThemeBtn').click();
  await f.locator('html[data-sm-theme="light"]').waitFor();
  const restored=await style();
  assert.equal(restored.head.background,light.head.background,'Light header did not fully restore');
  assert.equal(restored.thumb.background,light.thumb.background,'Light image add button did not restore');
  assert.deepEqual(errors,[],'Uncaught browser errors '+errors.join('; '));
  console.log('R82 '+engine.name()+' '+width+'px dark matrix, contrast, heat RGBA, fit, round-trip PASS');
  await context.close();
 }
 }finally{await browser.close()}
}
