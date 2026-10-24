import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const BASE='http://127.0.0.1:4173';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
 for(const width of [320,390,1180]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await context.route('https://*.supabase.co/**',r=>r.abort());
   await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'}));
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   assert.equal((await page.goto(BASE+'/index.html?lang=ja',{waitUntil:'load'})).status(),200);
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
   await frame.locator('#r81ThemeBtn').waitFor({state:'visible'});
   assert.equal(await frame.locator('html').getAttribute('data-sm-theme'),'light','Default must be light');
   assert.equal(await frame.locator('#r81ThemeBtn').getAttribute('aria-pressed'),'false');
   if(width<500){
    assert(await frame.locator('#publishBtn').isVisible(),'Publish must be visible directly');
    assert(await frame.locator('#newSheetBtn').isVisible(),'New must be visible directly');
    assert.equal(await frame.locator('#r80SearchBtn').count(),0,'Magnifier still present');
    const layout=await frame.locator('body').evaluate(()=>{
     const r=sel=>{const e=document.querySelector(sel);const a=e.getBoundingClientRect();return {x:a.x,y:a.y,w:a.width,h:a.height,right:a.right}};
     return {publish:r('#publishBtn'),newSheet:r('#newSheetBtn'),theme:r('#r81ThemeBtn'),
       menu:r('#mobileHeaderMoreBtn'),title:r('.titleHeading .fieldLabel'),
       overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert(layout.overflow<=2,'Page horizontal overflow '+JSON.stringify(layout));
    for(const n of ['publish','newSheet','theme','menu']){
      assert(layout[n].h>=40&&layout[n].right<=width+2,'Header action broken '+n+' '+JSON.stringify(layout));
    }
    assert(layout.publish.x>layout.title.right-2,'Header buttons must not cover title label '+JSON.stringify(layout));
    await frame.locator('#r80OptionsBtn').click();
    const dims=await frame.locator('#r80OptionsPanel').evaluate(e=>{
      const p=e.getBoundingClientRect(),outer=document.querySelector('.sheetToolbar').getBoundingClientRect();
      return {width:p.width,left:p.left,right:p.right,outer:outer.width,outerLeft:outer.left};
    });
    assert(dims.width>=width-40,'Narrow floating settings menu regressed '+JSON.stringify(dims));
    assert(dims.left<=dims.outerLeft+20,'Settings not aligned with scoring toolbar');
    for(const id of ['r80ScaleAction','r80ColorAction','r81SearchAction','r80MoreAction']){
      const button=frame.locator('#'+id);
      assert(await button.isVisible(),id+' hidden');
      const g=await button.evaluate(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height}});
      assert(g.w>=width-60&&g.h>=44,'Settings tap target insufficient '+JSON.stringify({id,g}));
    }
    await frame.locator('#r80ColorAction').click();
    assert.equal(await frame.locator('#scoreColorToggleBtn').getAttribute('aria-pressed'),'false');
    await frame.locator('#r80ColorAction').click();
    assert.equal(await frame.locator('#scoreColorToggleBtn').getAttribute('aria-pressed'),'true');
    await frame.locator('#r81SearchAction').click();
    assert(await frame.locator('#searchInput').isVisible(),'Search from Settings failed');
    await frame.locator('#searchInput').fill('Filter');
    await frame.locator('#r81SearchClose').click();
    assert(!await frame.locator('#searchInput').isVisible(),'Search dismissed but filter remains');
    await frame.locator('#publishBtn').click();
    assert(await frame.locator('#publishDialogBackdrop').isVisible(),'Direct Publish broken');
    await frame.locator('#publishCloseBtn').click();
    const before=await frame.locator('#sheetSelect option').count();
    await frame.locator('#newSheetBtn').click();
    assert((await frame.locator('#sheetSelect option').count())>before,'Direct New broken');
   }
   const before=await frame.locator('#scoreTable .scoreInput').first().inputValue();
   await frame.locator('#r81ThemeBtn').click();
   await frame.locator('html[data-sm-theme="dark"]').waitFor();
   await page.locator('html[data-sm-theme="dark"]').waitFor();
   const dark=await frame.locator('body').evaluate(()=>{
     const c=getComputedStyle(document.querySelector('.sheetPanel'));
     return {bg:c.backgroundColor,text:c.color,pref:localStorage.getItem('statsMaker.uiTheme')};
   });
   assert.equal(dark.pref,'dark','Theme was not stored locally');
   assert(!['rgb(255, 255, 255)','rgb(246, 245, 241)'].includes(dark.bg),
      'Dark mode must actually change scoring UI '+JSON.stringify(dark));
   assert.equal(await frame.locator('#scoreTable .scoreInput').first().inputValue(),before,'Theme toggle changed scores');
   await page.reload({waitUntil:'load'});
   await page.frameLocator('#basicFrame').locator('html[data-sm-theme="dark"]').waitFor();
   await page.locator('html[data-sm-theme="dark"]').waitFor();
   assert.equal(await page.frameLocator('#basicFrame').locator('#r81ThemeBtn').getAttribute('aria-pressed'),'true');
   if(width<500){
     await page.frameLocator('#basicFrame').locator('#r80VisualsBtn').click();
   }else await page.locator('#extLauncher').click();
   await page.locator('#extSheet').waitFor({state:'visible'});
   await page.locator('#extGroups .extCard').filter({hasText:'Ranking Card'}).click();
   await page.waitForURL(/\/app\/editor\.html/);
   await page.locator('#previewRoot .ranking-visual').waitFor({state:'visible'});
   assert.equal(await page.locator('html').getAttribute('data-sm-theme'),'dark','Editor did not inherit site preference');
   const artwork=await page.evaluate(()=>{
     const p=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').at(-1);
     const e=document.querySelector('#previewRoot .visual');
     return {projectBG:p?.style?.background,projectTheme:p?.style?.theme,
       graphicBG:e?getComputedStyle(e).backgroundColor:''};
   });
   assert.equal(artwork.projectTheme,'light','UI dark preference must NOT rewrite project style');
   assert.equal(artwork.projectBG,'#F3F5F8','Original minimal template BG must stay intact');
   assert.equal(artwork.graphicBG,'rgb(243, 245, 248)','Project visual must stay light while UI dark');
   await page.locator('#moreBtn').click();
   await page.locator('#r81EditorTheme').click();
   await page.locator('html[data-sm-theme="light"]').waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('statsMaker.uiTheme')),'light');
   assert.deepEqual(errors,[],'Javascript errors '+errors.join('; '));
   console.log('R81 '+engine.name()+' '+width+'px header/settings/theme sync/artwork PASS');
   await context.close();
 }
 }finally{await browser.close()}
}
