import {openVisuals} from './r80-qa-click.mjs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173';
const light=color=>{
 const rgb=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 assert.equal(rgb.length,3,'Unsupported color '+color);
 return rgb.every(x=>x>=170);
};
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [320,390,1180]){
   const ctx=await browser.newContext({viewport:{width,height:844},
    isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await ctx.route('https://*.supabase.co/**',r=>r.abort());
   await ctx.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({
    status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'
   }));
   const page=await ctx.newPage();
   assert.equal((await page.goto(base+'/index.html?lang=ja',{waitUntil:'load'})).status(),200);
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
   const rowColors=await frame.locator('body').evaluate(()=>{
    const el=sel=>{const e=document.querySelector(sel);if(!e)return null;
     const c=getComputedStyle(e);return {bg:c.backgroundColor,color:c.color};};
    return {normal:el('#sheetViewBtn.active'),color:el('#scoreColorToggleBtn'),
      score:el('#scoreTable tbody tr:first-child td.scoreCell'),
      search:el('#searchInput'),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert(light(rowColors.normal.bg),'Active view still dark '+JSON.stringify(rowColors));
   assert(light(rowColors.color.bg),'Color ON should be soft');
   assert(rowColors.overflow<=2,'Editor document overflow '+width);
   const count=await frame.locator('#scoreTable tbody tr').count();
   await frame.locator('#addRowBtn').click();
   assert((await frame.locator('#scoreTable tbody tr').count())>count);
   await frame.locator('#overviewViewBtn').click();
   const overview=frame.locator('#overviewSheetView');
   await overview.waitFor({state:'visible'});
   const first=overview.locator('.overviewMetric').first();
   await first.waitFor({state:'visible'});
   let overviewStyle=await first.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
   assert(light(overviewStyle.bg),'Overview metric still dark '+JSON.stringify(overviewStyle));
   await frame.locator('#fitViewBtn').click();
   await frame.locator('#fitTable .fitName').first().waitFor({state:'visible'});
   const fitStyle=await frame.locator('#fitTable .fitName').first().evaluate(e=>({
     bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color
   }));
   assert(light(fitStyle.bg),'Fit target-column still dark '+JSON.stringify(fitStyle));
   await frame.locator('#sheetViewBtn').click();
   await frame.locator('.rankRow').first().waitFor({state:'visible'});
   const rank=await frame.locator('.rankRow').first().evaluate(e=>({
     bg:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage
   }));
   assert(light(rank.bg)&&rank.image==='none','Ranking still dark '+JSON.stringify(rank));
   const selected=frame.locator('#radarTab.active');
   assert(await selected.isVisible(),'Comparison selection remains operable');
   const sel=await selected.evaluate(e=>getComputedStyle(e).backgroundColor);
   assert(light(sel),'Comparison tab still dark '+sel);
   await openVisuals(page);
   const card=page.locator('#extGroups .extCard').filter({hasText:'Ranking Card'});
   await card.click();
   await page.waitForURL(/\/app\/editor\.html/);
   await page.locator('#previewRoot .ranking-visual').waitFor({state:'visible'});
   const appState=await page.evaluate(()=>{
    const css=sel=>{const e=document.querySelector(sel);return e?getComputedStyle(e).backgroundColor:null;};
    return {bar:css('.source-quick-bar'),lead:css('.source-quick-lead'),
     control:css('.source-quick-select select'),tab:css('.mobile-tab.active'),
     artwork:css('#previewRoot .visual')};
   });
   assert(light(appState.bar),'Source ribbon still dark '+JSON.stringify(appState));
   if(width<500)assert(light(appState.tab),'Extension tabs still dark '+JSON.stringify(appState));
   assert(light(appState.artwork),'New ranking project defaults light; saved dark artwork stays user-controlled');
   console.log('R79 '+engine.name()+' '+width+'px overview/fit/rank/tabs/extension PASS');
   await ctx.close();
 }
 }finally{await browser.close()}
}
console.log('R79 Chromium/WebKit quiet light UI and art isolation PASS');
