import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('my.html');
const css=await read('cloud/my.css');
assert(html.includes('class="r73-light-page"'));
assert(html.includes('cloud/my.css?v=r93light1'));
assert(html.includes('content="#f6f5f1"'));
assert(html.includes('noindex,follow'));
assert(!html.includes('noindex,nofollow'),'No duplicate conflicting robots meta');
assert(css.includes('html:not([data-sm-theme="dark"])'));
assert(css.includes('.r90CategorySelect'));
const mock=String.raw`
window.SM_SUPABASE={
 ready:true,
 client:{
   auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}
 },
 url:'https://mock.invalid'
};
`;
for(const [engine,width] of [[webkit,390],[chromium,320],[chromium,1180]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const mode of ['light','dark']){
   const ctx=await browser.newContext({viewport:{width,height:810},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
   await ctx.addInitScript(mode=>localStorage.setItem('statsMaker.uiTheme',mode),mode);
   await ctx.route('**/cloud/supabase.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:mock}));
   await ctx.route('**/cdn.jsdelivr.net/npm/@supabase/supabase-js@2*',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={};'}));
   await ctx.route('https://*.supabase.co/**',route=>route.abort());
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE+'/my.html',{waitUntil:'domcontentloaded'});
   await page.locator('.globalSupportMenu summary').waitFor();
   await page.waitForFunction(expected=>document.documentElement.dataset.smTheme===expected,mode);
   await page.waitForFunction(()=>document.querySelector('#emptyTitle')?.offsetWidth>0);
   const actual=await page.evaluate(()=>({
    bg:getComputedStyle(document.body).backgroundColor,
    panel:getComputedStyle(document.querySelector('.worksSection')).backgroundColor,
    nav:getComputedStyle(document.querySelector('.globalLocaleBar')).backgroundColor,
    contrast:getComputedStyle(document.querySelector('.workCard')||document.querySelector('.summaryCard')).color,
    horizontal:document.documentElement.scrollWidth-innerWidth
   }));
   if(mode==='light'){
     assert.equal(actual.bg,'rgb(246, 245, 241)','My Works is not light-first');
     assert.equal(actual.panel,'rgb(255, 255, 255)','Management panel is not white');
     assert.equal(actual.nav,'rgb(255, 255, 255)','Shared navigation stayed dark');
   }else{
     assert.notEqual(actual.bg,'rgb(246, 245, 241)','Explicit dark mode lost');
     assert.notEqual(actual.panel,'rgb(255, 255, 255)','Explicit dark panel was recolored');
   }
   assert(actual.horizontal<=3,engine.name()+' '+mode+' '+width+' horizontal overflow: '+actual.horizontal);
   assert.equal(await page.locator('#countAll').textContent(),'0','Ownerless session must show zero, not public works');
   assert.equal(await page.locator('#r91SuggestBtn').count(),1,'Keep owner category curation features');
   assert.deepEqual(errors.filter(x=>/SyntaxError|ReferenceError|TypeError/.test(x)),[]);
   console.log('R93 PASS',engine.name(),width,mode,actual);
   await ctx.close();
  }
 }finally{await browser.close()}
}
