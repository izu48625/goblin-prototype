import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173';
const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
const luminosity=s=>{
 const c=rgb(s).map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
};
const contrast=(a,b)=>(Math.max(luminosity(a),luminosity(b))+.05)/(Math.min(luminosity(a),luminosity(b))+.05);
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const context=await browser.newContext({
    viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'
   });
   await context.route('https://*.supabase.co/**',r=>r.abort());
   await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({
    status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'
   }));
   const page=await context.newPage();
   assert.equal((await page.goto(base+'/index.html?lang=ja',{waitUntil:'load'})).status(),200);
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#scoreTable .scoreInput').first().waitFor();
   const styles=await frame.locator('body').evaluate(()=>{
    const get=sel=>{
      const el=document.querySelector(sel);if(!el)return null;
      const cs=getComputedStyle(el),rect=el.getBoundingClientRect();
      return {bg:cs.backgroundColor,fg:cs.color,
       borderL:cs.borderLeftWidth,borderTop:cs.borderTopWidth,
       h:rect.height,visibility:cs.visibility};
    };
    return {
      outer:get('.topbar.panel'),sheet:get('.sheetPanel.panel'),
      segmented:get('.modeStrip'),row:get('#addRowBtn'),
      setting:get('#scoreSettingsBtn'),sort:get('#scoreTable .headerSortRow'),
      arrow:get('#scoreTable .headerSortBtn'),
      label:get('#scoreTable .metricHeaderInput'),
      table:get('#scoreTable tbody tr:first-child td.scoreCell'),
      filter:get('#searchInput'),overflow:document.documentElement.scrollWidth-innerWidth
    };
   });
   for(const key of ['outer','sheet','segmented','row','setting','sort','arrow','label','table','filter'])
     assert(styles[key],'Missing UI '+key+' at '+width);
   assert(styles.outer.borderL==='0px','Outer title card still boxed '+JSON.stringify(styles.outer));
   assert(styles.sheet.borderL==='0px','Outer sheet card still boxed '+JSON.stringify(styles.sheet));
   assert(luminosity(styles.sort.bg)>.8,'Sort strip remains dark '+JSON.stringify(styles.sort));
   assert(contrast(styles.sort.bg,styles.arrow.fg)>=4.5,'Sort arrows illegible '+JSON.stringify(styles.arrow));
   assert(contrast(styles.sort.bg,styles.label.fg)>=4.5,'Metric title illegible '+JSON.stringify(styles.label));
   assert(luminosity(styles.table.bg)>.9,'Blank scoring cell darkened');
   assert(styles.overflow<=2,'Document viewport overflow '+width+' '+JSON.stringify(styles));
   if(width<500)assert(styles.row.h>=40,'Add-row mobile tap target too small');
   assert(luminosity(styles.filter.bg)>.83,'Search should be light');
   const launch=await page.locator('#extLauncher').evaluate(el=>{
     const r=el.getBoundingClientRect();return {height:r.height,width:r.width};
   });
   assert(launch.height>=44&&launch.height<=56,'Extension launcher should be compact '+JSON.stringify(launch));
   const rowCount=await frame.locator('#scoreTable tbody tr').count();
   await frame.locator('#addRowBtn').click();
   assert((await frame.locator('#scoreTable tbody tr').count())>rowCount,
     'Add row must still function after visual redesign');
   await frame.locator('#scoreSettingsBtn').click();
   assert(await frame.locator('#scoreSettingsPanel').isVisible(),
     'Scoring settings remain accessible');
   await frame.locator('#scoreSettingsBtn').click();
   await frame.locator('#overviewViewBtn').click();
   assert(await frame.locator('#overviewSheetView').isVisible(),'Overview button functionality');
   await frame.locator('#sheetViewBtn').click();
   assert(await frame.locator('#normalSheetView').isVisible(),'Return to sheet');
   await page.locator('#extLauncher').click();
   assert(await page.locator('#extSheet').isVisible(),'Extension sheet still opens');
   await page.locator('#extClose').click();
   assert(!await page.locator('#extSheet').isVisible(),'Extension sheet still closes');
   console.log('R76 '+engine.name()+' '+width+'px border hierarchy, sorting, controls, extension PASS');
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R76 Chromium + WebKit 320/390/1180 UI declutter and behavior PASS');
