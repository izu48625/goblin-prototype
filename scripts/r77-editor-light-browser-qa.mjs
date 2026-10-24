import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173';
const colors=x=>(x.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
const lum=x=>colors(x).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const sheet={
 id:'r77-fixture',title:'R77 Bright Interface Test',desc:'',
 cols:['Attack','Defense'],rows:[{name:'One',note:'',scores:[80,90]},{name:'Two',note:'',scores:[40,50]}],
 weights:[1,1],scale:100,rankMetric:'avg',compare:[],sortKey:null,sortDesc:true,
 weighted:false,viewMode:'sheet',fitMode:'auto',fitZoom:1,updatedAt:Date.now()
};
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const context=await browser.newContext({
     viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'
   });
   await context.addInitScript(s=>{
     if(!localStorage.getItem('r77:seeded')){
       localStorage.setItem('statsMakerV014Library',JSON.stringify({activeId:s.id,sheets:[s]}));
       localStorage.setItem('r77:seeded','true');
     }
   },sheet);
   await context.route('https://*.supabase.co/**',route=>route.abort());
   await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({
     status:200,contentType:'application/javascript',body:'window.html2canvas=async()=>document.createElement("canvas");window.supabase={createClient:()=>({})};'
   }));
   const page=await context.newPage();
   const jsErrors=[];page.on('pageerror',e=>jsErrors.push(e.message));
   await page.goto(base+'/index.html?lang=ja',{waitUntil:'domcontentloaded'});
   const launcher=page.locator('#extLauncher');
   await launcher.waitFor({state:'visible'});
   const bottom=await launcher.evaluate(el=>{
     const a=el.getBoundingClientRect(),c=getComputedStyle(el);
     return {w:a.width,h:a.height,bg:c.backgroundColor,fg:c.color,
        viewport:window.innerWidth,left:a.left};
   });
   assert(bottom.h>=44&&bottom.h<=56,'Button should be tappable/compact '+JSON.stringify(bottom));
   if(width<500){
     assert(bottom.w<=206,'Full-width orange banner still shown '+JSON.stringify(bottom));
     assert(Math.abs(bottom.left-(width-bottom.w)/2)<3,'Launcher not centered '+JSON.stringify(bottom));
     assert(lum(bottom.bg)>.85,'Launcher must be white');
     assert(ratio(bottom.bg,bottom.fg)>=4.5,'Launcher text illegible');
   }
   await launcher.click();
   await page.locator('#extSheet').waitFor({state:'visible'});
   const card=page.locator('#extGroups .extCard').filter({hasText:'Ranking Card'});
   await card.waitFor({state:'visible'});
   await card.click();
   await page.waitForURL(/\/app\/editor\.html/,{timeout:25000});
   await page.locator('#previewRoot .ranking-visual').waitFor({state:'visible',timeout:25000});
   const state=await page.evaluate(()=>{
     const st=sel=>{const el=document.querySelector(sel);if(!el)return null;
       const c=getComputedStyle(el),r=el.getBoundingClientRect();
       return {bg:c.backgroundColor,fg:c.color,h:r.height,visible:c.visibility}};
     return {
       body:st('body.editor-body'),nav:st('.globalLocaleBar'),navLink:st('.globalHomeBtn'),
       header:st('.editor-header'),toolbar:st('.preview-toolbar'),
       bottom:st('.mobile-bottom-tabs'),active:st('.mobile-tab.active'),
       previewArea:st('.preview-area'),art:st('#previewRoot .visual'),
       projectName:document.querySelector('#projectTitleInput')?.value,
       xOverflow:document.documentElement.scrollWidth-window.innerWidth,
       projectType:JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').at(-1)?.type
     };
   });
   for(const key of ['body','nav','header','toolbar','previewArea','art'])
     assert(state[key],'Missing element: '+key);
   assert.equal(state.body.bg,'rgb(246, 245, 241)','Editor body still navy');
   assert.equal(state.header.bg,'rgb(255, 255, 255)','Editor header still dark');
   assert.equal(state.nav.bg,'rgb(255, 255, 255)','Global nav still dark');
   assert.equal(state.toolbar.bg,'rgb(255, 255, 255)','Zoom toolbar still dark');
   assert(ratio(state.nav.bg,state.navLink.fg)>=4.5,'Header nav readability');
   assert(lum(state.previewArea.bg)>.80,'Checkered preview workbench still dark');
   assert(lum(state.art.bg)<.5,'Native ranking artwork was inadvertently light-restyled');
   assert.equal(state.projectType,'ranking-card');
   assert(state.xOverflow<=3,'Editor horizontally overflows '+width+' '+state.xOverflow);
   if(width<500){
     assert.equal(state.bottom.bg,'rgb(255, 255, 255)','Mobile DATA tabs remain dark');
     assert(lum(state.active.bg)>.75,'Selected DATA tab remains dark');
     await page.locator('.mobile-tab[data-panel="style"]').click();
     const dialog=page.locator('#mobileSheet');
     await dialog.waitFor({state:'visible'});
     const sheetBG=await dialog.evaluate(el=>getComputedStyle(el).backgroundColor);
     assert.equal(sheetBG,'rgb(255, 255, 255)','Mobile STYLE drawer still dark');
     await page.locator('#mobileDoneBtn').click();
   }else{
     await page.locator('.panel-tab[data-panel="style"]').click();
     assert(await page.locator('#panelContent').isVisible(),'Desktop STYLE tab failed');
   }
   assert.equal(jsErrors.length,0,'JS errors '+jsErrors.join('; '));
   console.log('R77 '+engine.name()+' '+width+'px: launcher, light chrome, dark artwork and panels PASS');
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R77 actual Chromium/WebKit project workflow PASS');
