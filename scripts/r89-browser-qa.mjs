import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const origin='http://127.0.0.1:4173';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const ctx=await browser.newContext({viewport:{width,height:850},locale:'ja-JP',isMobile:width<500,hasTouch:width<500});
   await ctx.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin || route.request().method()!=='GET')return route.abort();
    return route.continue();
   });
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
   await page.goto(origin+'/index.html?lang=ja',{waitUntil:'domcontentloaded'});
   await page.frameLocator('#basicFrame').locator('#titleInput').waitFor({state:'visible',timeout:15000});
   let banner=page.locator('#r89HomeIntro');
   await banner.waitFor({state:'visible'});
   const visible=await banner.evaluate(el=>{
    const rect=el.getBoundingClientRect(),frame=document.getElementById('basicRoot').getBoundingClientRect();
    return {rectTop:rect.top,rectBottom:rect.bottom,frameTop:frame.top,
      h1:el.querySelector('h1').textContent,scrollWidth:document.documentElement.scrollWidth};
   });
   assert.equal(visible.rectTop,44,'Banner should follow global bar');
   assert(visible.frameTop>=visible.rectBottom-1,'Banner overlaps editor');
   assert(visible.scrollWidth<=width+3,'Home overflows horizontally');
   assert(visible.h1.includes('採点・比較'));
   await page.locator('[data-global-lang="en"]').click();
   assert((await banner.locator('h1').textContent()).includes('Rate and compare'));
   assert((await banner.locator('a').getAttribute('href'))==='/en/use-cases.html');
   assert((await page.locator('#r87HomeGuide summary').textContent()).includes('Getting started'));
   await banner.locator('button').click();
   assert.equal(await banner.isVisible(),false,'Banner must dismiss');
   const rootTop=await page.locator('#basicRoot').evaluate(el=>el.getBoundingClientRect().top);
   assert(rootTop<=44.5,'Dismissal should restore editor height');
   await page.reload({waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('#r89HomeIntro').isVisible(),false,'Home dismissal not persisted');
   await page.locator('.globalSupportMenu summary').click();
   await page.locator('[data-global-intro]').click();
   assert.equal(await page.locator('#r89HomeIntro').isVisible(),true,'Help cannot restore the intro');
   await page.evaluate(()=>window.SM_THEME.set('dark'));
   const themed=await page.locator('#r89HomeIntro').evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(themed,'rgb(23, 34, 50)','Home banner does not follow dark theme');
   await page.evaluate(()=>window.SM_THEME.set('light'));
   const d=await page.goto(origin+'/discover.html?lang=en',{waitUntil:'domcontentloaded'});
   assert.equal(d.status(),200);
   const gallery=page.locator('.r87Editorial');
   assert((await gallery.locator('h2').textContent()).startsWith('Discover'));
   assert((await gallery.locator('p').textContent()).includes('separate from'));
   const links=await gallery.locator('a[href]').evaluateAll(els=>els.map(x=>x.getAttribute('href')));
   assert(links.every(x=>x.startsWith('/en/use-cases.html')),'EN examples must link EN only: '+links.join(','));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(overflow<=3,'Discover overflow '+width);
   let failManifestOnce=width===390;
   if(failManifestOnce){
     await page.route('**/cloud/r89-usecase-presets.json',route=>{
       if(failManifestOnce){failManifestOnce=false;return route.fulfill({status:503,body:'Unavailable'})}
       return route.continue();
     });
   }
   const examples=await page.goto(origin+'/en/use-cases.html',{waitUntil:'domcontentloaded'});
   if(width===390){
     const retry=page.locator('#r89ExampleStatus button');
     await retry.waitFor({state:'visible',timeout:12000});
     assert((await page.locator('#r89ExampleStatus').textContent()).includes('could not be loaded'));
     await retry.click();
   }
   assert.equal(examples.status(),200);
   const buttons=page.locator('.r89EditCopy');
   await buttons.first().waitFor({state:'visible',timeout:15000});
   assert.equal(await buttons.count(),5);
   assert((await buttons.first().textContent()).includes('Edit a copy'));
   await buttons.first().click();
   await page.waitForURL(/\/app\/editor\.html\?id=project_/,{timeout:18000});
   const list=await page.evaluate(()=>JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]'));
   assert.equal(list.length,1,'One new private project only');
   assert.equal(list[0].type,'bar');assert.equal(list[0].publish.visibility,'private');
   assert.equal(list[0].data.items[0].name,'Citrus Tea');
   assert.equal(list[0].data.items[0].value,92);
   await page.goto(origin+'/en/examples.html',{waitUntil:'domcontentloaded'});
   const originalButtons=page.locator('.r89OriginalExamples .r89EditCopy');
   await originalButtons.first().waitFor({state:'visible',timeout:15000});
   assert.equal(await originalButtons.count(),3);
   await page.locator('#radar .r89EditCopy').click();
   await page.waitForURL(/\/app\/editor\.html\?id=project_/,{timeout:18000});
   const radarLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('statsMakerV2Projects')));
   assert.equal(radarLibrary.length,2,'Radar must create an additional project');
   const radar=radarLibrary.find(p=>p.type==='radar');
   assert.deepEqual(radar.data.axes.map(x=>x.label),['Attack','Defense','Speed','Teamwork']);
   assert.deepEqual(radar.data.series.find(x=>x.name==='Red Team').values,[90,60,70,90]);
   assert.equal(radar.publish.visibility,'private');
   if(width===1180){
     for(const [slug,type,count] of [['ranking','ranking-card',3],['tier','tier-list',4]]){
       await page.goto(origin+'/en/examples.html',{waitUntil:'domcontentloaded'});
       await page.locator('#'+slug+' .r89EditCopy').click();
       await page.waitForURL(/\/app\/editor\.html\?id=project_/,{timeout:18000});
       const projects=await page.evaluate(()=>JSON.parse(localStorage.getItem('statsMakerV2Projects')));
       assert.equal(projects.length,count,'Additional original copy must preserve prior projects');
       assert.equal(projects.at(-1).publish.visibility,'private');
       assert.equal(projects.at(-1).type,type);
       if(type==='ranking-card'){
         assert.equal(projects.at(-1).data.items[0].name,'Green Team');
         assert.equal(projects.at(-1).data.items[0].value,92.5);
       }
       if(type==='tier-list')assert.equal(projects.at(-1).data.items.find(x=>x.name==='Purple Team').tier,'A');
     }
   }
   assert(!errors.length,engine.name()+'/'+width+' '+JSON.stringify(errors));
   console.log('R89 browser PASS',engine.name(),width,'persisted Home/help/theme, bilingual Discover, data retry, 8 private editable samples');
   await ctx.close();
  }
 }finally{await browser.close();}
}
