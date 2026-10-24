import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE='http://127.0.0.1:4173';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await ctx.route('https://*.supabase.co/**',r=>r.abort());
   await ctx.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'}));
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   assert.equal((await page.goto(BASE+'/index.html?lang=ja',{waitUntil:'load'})).status(),200);
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
   if(width<500){
     assert(!await page.locator('#extLauncher').isVisible(),'Floating CTA still covers score table');
     assert(await frame.locator('#r80VisualsBtn').isVisible());
     assert(await frame.locator('#publishBtn').isVisible());
     assert(await frame.locator('#newSheetBtn').isVisible());
     assert(!await frame.locator('#searchInput').isVisible(),'Search should be progressive');
     const geometry=await frame.locator('body').evaluate(()=>{
       const box=sel=>{const el=document.querySelector(sel),r=el?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,h:r.height}:null};
       return {header:box('.topbar'),toolbar:box('.sheetToolbar'),menu:box('#mobileHeaderMoreBtn'),
         table:box('#scoreTable'),overflow:document.documentElement.scrollWidth-innerWidth};
     });
     assert(geometry.overflow<=2,'Editor viewport overflow '+width+' '+JSON.stringify(geometry));
     assert(geometry.header.h<165,'Header still overly tall '+JSON.stringify(geometry));
     assert(geometry.toolbar.h<115,'Quick controls exceed two rows '+JSON.stringify(geometry));
     await frame.locator('#publishBtn').click();
     assert(await frame.locator('#publishDialogBackdrop').isVisible(),'Direct Publish broken');
     await frame.locator('#publishCloseBtn').click();
     const before=await frame.locator('#sheetSelect option').count();
     await frame.locator('#newSheetBtn').click();
     assert((await frame.locator('#sheetSelect option').count())>before,'Direct New failed');
     await frame.locator('#r80OptionsBtn').click();
     await frame.locator('#r81SearchAction').click();
     assert(await frame.locator('#searchInput').isVisible(),'Search from Settings broken');
     await frame.locator('#searchInput').fill('sample');
     await frame.locator('#r81SearchClose').click();
     assert(!await frame.locator('#searchInput').isVisible(),'Search should close by its dismiss button');
     await frame.locator('#r80OptionsBtn').click();
     assert(await frame.locator('#r80ScaleAction').isVisible(),'Score options hidden');
     await frame.locator('#r80ColorAction').click();
     assert.equal(await frame.locator('#scoreColorToggleBtn').getAttribute('aria-pressed'),'false');
     await frame.locator('#r80ColorAction').click();
     assert.equal(await frame.locator('#scoreColorToggleBtn').getAttribute('aria-pressed'),'true');
     await frame.locator('#r80ScaleAction').click();
     assert(await frame.locator('#scoreSettingsPanel').isVisible(),'Scoring controls cannot open');
     await frame.locator('#r80VisualsBtn').click();
   }else{
     assert(await page.locator('#extLauncher').isVisible());
     assert(await frame.locator('#publishBtn').isVisible());
     assert(!await frame.locator('#r80OptionsBtn').isVisible());
     await page.locator('#extLauncher').click();
   }
   await page.locator('#extSheet').waitFor({state:'visible'});
   await page.locator('#extGroups .extCard').filter({hasText:'Ranking Card'}).click();
   await page.waitForURL(/\/app\/editor\.html/,{timeout:25000});
   await page.locator('#previewRoot .ranking-visual').waitFor({state:'visible',timeout:25000});
   const project=await page.evaluate(()=>{
     const p=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').at(-1);
     return p?{theme:p.style?.theme,bg:p.style?.background,template:p.settings?.template}:null;
   });
   assert.equal(project.theme,'light','New Ranking Card should be light '+JSON.stringify(project));
   assert.equal(project.template,'minimal','New Ranking Card should show minimal visual by default');
   assert(!/^#(?:0[0-9a-f]|1[0-9a-f])/.test(project.bg),'New project still dark');
   assert.equal(errors.length,0,'Page errors '+JSON.stringify(errors));
   console.log('R80 '+engine.name()+' '+width+'px condensed scoring, menus, light ranking PASS');
   await ctx.close();
  }
 }finally{await browser.close()}
}
