import {openVisuals} from './r80-qa-click.mjs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE='http://127.0.0.1:4173';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,375,390,430,1180]){
   const context=await browser.newContext({viewport:{width,height:width===320?568:width===375?560:844},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await context.route('https://*.supabase.co/**',route=>route.abort());
   await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'
   }));
   const page=await context.newPage();
   const response=await page.goto(BASE+'/index.html?lang=ja',{waitUntil:'load'});
   assert.equal(response.status(),200);
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
   const geometry=await frame.locator('body').evaluate(()=>{
    const rect=sel=>{
      const el=document.querySelector(sel);if(!el)return null;
      const r=el.getBoundingClientRect();const c=getComputedStyle(el);
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
       width:r.width,height:r.height,fontsize:c.fontSize,display:c.display,visible:c.visibility};
    };
    return {
      outer:rect('.topbar'),area:rect('.titleArea'),
      title:rect('#titleInput'),titleLabel:rect('.titleArea .fieldLabel'),
      desc:rect('#descInput'),select:rect('#sheetSelect'),
      savedLabel:rect('.savedSheetHead .fieldLabel'),
      actions:rect('.topActions'),newButton:rect('#newSheetBtn'),
      publish:rect('#publishBtn'),menu:rect('#mobileHeaderMoreBtn'),
      score:rect('#scoreTable'),overflow:document.documentElement.scrollWidth-innerWidth
    };
   });
   for(const key of ['outer','area','title','titleLabel','desc','select','savedLabel','actions','score']){
     assert(geometry[key],'Missing '+key+' '+width);
   }
   assert(geometry.overflow<=2,'Horizontal screen overflow '+width+' '+JSON.stringify(geometry));
   if(width<500){
     assert(geometry.outer.height<=195,'Title/description/header still too tall '+width+' '+JSON.stringify(geometry));
     assert(geometry.title.width>=width-46,'Title should occupy complete row');
     assert(Math.abs(geometry.desc.top-geometry.select.top)<=19,'Desc/save must share one row '+width);
     assert(geometry.desc.right<=geometry.select.left+1,'Desc and selector overlap '+width);
     assert(geometry.desc.width>=width*.38,'Description no longer usable '+width);
     assert(geometry.select.width>=130,'Saved-sheet selector cannot be tapped '+width);
     assert(geometry.title.height>=40&&geometry.desc.height>=40&&geometry.select.height>=40,
       'Native input tap size too small '+width);
     assert(geometry.menu.height>=32,'Actions menu entry too small '+width);
     for(const x of [geometry.title,geometry.desc,geometry.select])
       assert(parseFloat(x.fontsize)>=16,'iOS auto-zoom risk: '+x.fontsize);
   }else{
     assert(geometry.title.width>=170,'Desktop header broken');
   }
   await frame.locator('#titleInput').fill('R67 LOCAL WebKit '+width);
   await frame.locator('#descInput').fill('not published; free local test');
   await frame.locator('#sheetSelect').click();
   assert.equal(await frame.locator('#titleInput').inputValue(),'R67 LOCAL WebKit '+width);
   assert.equal(await frame.locator('#descInput').inputValue(),'not published; free local test');
   await frame.locator('#scoreTable .scoreInput').first().fill('82');
   await frame.locator('#scoreTable .scoreInput').first().press('Tab');
   const overflowDebug=await frame.locator('body').evaluate(()=>{
     const d=document.documentElement;
     return {over:d.scrollWidth-innerWidth,scrollWidth:d.scrollWidth,innerWidth,
       large:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2)
         .slice(0,12).map(el=>({tag:el.tagName,id:el.id,cls:String(el.className).slice(0,55),
           right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)}))};
   });
   assert(overflowDebug.over<=2,'After scoring input there must be no whole-page overflow at '+width+' '+JSON.stringify(overflowDebug));
   const oldRows=await frame.locator('#scoreTable tbody tr').count();
   await frame.locator('#addRowBtn').click();
   assert((await frame.locator('#scoreTable tbody tr').count())>oldRows,'Scoring table behavior lost');
   if(width<500){
    await frame.locator('#mobileHeaderMoreBtn').click();
    assert(await frame.locator('#mobileHeaderMoreMenu').isVisible(),'Header popup broken');
    await frame.locator('#mobileHeaderMoreBtn').click();
   }
   await openVisuals(page);
   assert(await page.locator('#extSheet').isVisible(),'Visual tools launcher broken');
   await page.locator('#extClose').click();
   console.log('R78 '+engine.name()+' '+width+'px native input, no overlap, controls PASS');
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R78 Chromium+WebKit compact header and working controls PASS');
