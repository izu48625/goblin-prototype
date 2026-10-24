import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE='http://127.0.0.1:4173';
const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
function luminosity(v){
 const c=rgb(v).map(x=>{const s=x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4});
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){return (Math.max(luminosity(a),luminosity(b))+.05)/(Math.min(luminosity(a),luminosity(b))+.05)}
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [320,390,1180]){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await ctx.route('https://*.supabase.co/**',r=>r.abort());
   await ctx.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'}));
   const page=await ctx.newPage();
   const resp=await page.goto(BASE+'/index.html?lang=ja',{waitUntil:'load'});
   assert.equal(resp.status(),200);
   await page.locator('.globalLocaleBar').waitFor();
   const root=await page.evaluate(()=>({
     background:getComputedStyle(document.body).backgroundColor,
     navBg:getComputedStyle(document.querySelector('.globalLocaleBar')).backgroundColor,
     navFg:getComputedStyle(document.querySelector('.globalHomeBtn')).color,
     xOverflow:document.documentElement.scrollWidth-innerWidth
   }));
   assert.equal(root.background,'rgb(246, 245, 241)');
   assert.equal(root.navBg,'rgb(255, 255, 255)');
   assert(contrast(root.navBg,root.navFg)>=4.5,'Header illegible');
   assert(root.xOverflow<=2,'Outer nav horizontally overflows at '+width);
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
   const x=await frame.locator('body').evaluate(()=>{
     const c=sel=>{const el=document.querySelector(sel);return el?{
       bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color,
       layer:getComputedStyle(el).backgroundImage,
       height:el.getBoundingClientRect().height}:null};
     return {body:c('body'),panel:c('.topbar.panel'),
       title:c('#titleInput'),search:c('#searchInput'),
       headers:c('#scoreTable thead th'),
       blank:c('#scoreTable tbody tr:first-child td.scoreCell'),
       rowBtn:c('#addRowBtn'),scale:c('#currentScaleBadge'),
       overflow:document.documentElement.scrollWidth-innerWidth};
   });
   for(const k of ['body','panel','title','search','headers','blank','rowBtn','scale']){
     assert(x[k], 'Missing UI: '+k);
     assert(luminosity(x[k].bg)>.65,'Old dark surface: '+k+' '+JSON.stringify(x[k]));
     assert(contrast(x[k].bg,x[k].fg)>=3.0,'Unreadable area: '+k+' '+JSON.stringify(x[k]));
   }
   assert(x.rowBtn.height>=(width<500?40:30),'Add-row touch target regressed');
   assert(x.overflow<=2,'Light editor horizontal overflow at '+width);
   await frame.locator('[data-score-row="0"][data-score-col="0"]').fill('97');
   await frame.locator('#titleInput').click();
   // The original scoring UI deliberately animates its RGBA transition (120ms).
   await page.waitForTimeout(240);
   const tile=await frame.locator('#scoreTable tbody tr:first-child td.scoreCell').first().evaluate(el=>({
     color:getComputedStyle(el).backgroundColor,
     alpha:el.style.getPropertyValue('--score-tile-overlay'),
     layer:getComputedStyle(el).backgroundImage
   }));
   assert.equal(tile.alpha,'rgba(116,60,74,.42)','User-selected 7-band RGBA changed');
   assert.equal(tile.color,'rgba(116, 60, 74, 0.42)','Grade should be true translucent rgba');
   assert.equal(tile.layer,'none','No glossy texture in grade tint');
   const toggle=frame.locator('#scoreColorToggleBtn');
   assert.equal(await toggle.getAttribute('aria-pressed'),'true');
   await toggle.click();
   await page.waitForTimeout(240);
   const off=await frame.locator('#scoreTable tbody tr:first-child td.scoreCell').first().evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(off,'rgb(255, 255, 255)','OFF must be white');
   await toggle.click();
   assert.equal(await toggle.getAttribute('aria-pressed'),'true');
   // New bottom sheet also uses paper, not the former dark backdrop.
   await page.locator('#extLauncher').click();
   const ext=await page.locator('#extSheet').evaluate(el=>({bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color}));
   assert(luminosity(ext.bg)>.8&&contrast(ext.bg,ext.fg)>=4.5,'Extension picker should be light');
   await page.locator('#extClose').click();
   console.log('R75 '+engine.name()+' '+width+'px Home light, RGB/contrast, RGBA grading and launcher PASS');
   await ctx.close();
 }
 }finally{await browser.close()}
}
console.log('R75 isolated Chromium and WebKit light score editor PASS');
