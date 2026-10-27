import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const context=await browser.newContext({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await context.route('**/*.supabase.co/**',route=>route.abort());
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const r=await page.goto(base+'/index.html?lang=ja',{waitUntil:'domcontentloaded'});
   assert.equal(r.status(),200);
   await page.frameLocator('#basicFrame').locator('#titleInput').waitFor({state:'visible',timeout:20000});
   assert.equal(await page.locator('#r87HomeGuide').count(),1);
   // The new educational text stays INSIDE the pre-existing extension sheet.
   assert.equal(await page.locator('#r87HomeGuide').isVisible(),false);
   assert.equal(await page.locator('h1').count(),1,'HTML-first service explanation for crawlers and extension users');
   // Existing extension selection is reachable without editing saved values.
   if(width>760){
    const launch=page.locator('#extLauncher');
    await launch.click();
    await page.locator('#r87HomeGuide summary').click();
    assert.equal(await page.locator('#r87HomeGuide').getAttribute('open'),'');
    const entry=page.locator('#r87HomeGuide a[href="/ja/use-cases.html"]');
    assert.equal(await entry.count(),1);
    await page.locator('#extClose').click();
   }
   const d=await page.goto(base+'/discover.html?lang=ja',{waitUntil:'domcontentloaded'});
   assert.equal(d.status(),200);
   const geometry=await page.evaluate(()=>{
     const gallery=document.querySelector('.r87Editorial');
     const images=[...gallery.querySelectorAll('img')];
     const links=[...gallery.querySelectorAll('.r87EditorialRail a')];
     const bounds=gallery.getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth-innerWidth,
       width:bounds.width,left:bounds.left,right:bounds.right,
       links:links.length,images:images.length,publicGrid:!!document.querySelector('#grid'),
       heading:gallery.querySelector('h2').textContent,
       browse:!!document.querySelector('.browseTabs')};
   });
   assert(geometry.overflow<=3,'Discover width overflow '+engine.name()+'/'+width+': '+JSON.stringify(geometry));
   assert(geometry.links===3&&geometry.images===3&&geometry.browse&&geometry.publicGrid);
   assert(geometry.left>=-1&&geometry.right<=width+1);
   assert.equal(errors.length,0,engine.name()+' '+width+' JS error '+errors.join('|'));
   console.log('R87 browser PASS '+engine.name()+' '+width+'px');
   await context.close();
  }
 }finally{await browser.close()}
}
