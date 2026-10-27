import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const nav=await read('cloud/global-locale.js');
assert(nav.includes('class="globalExamplesBtn"'), 'Need one-tap examples in shared top navigation');
assert(nav.includes('data-global-about'), 'Preserve About under Help menu');
assert(nav.includes("'/'+lang+'/use-cases.html'"), 'Localized live use-case destination');
for(const lang of ['ja','en']){
 const landing=await read(lang+'/index.html');
 assert(landing.includes('class="r71SectionLinks"'), 'Landing screenshot gallery must remain');
 assert(landing.includes('href="/'+lang+'/use-cases.html"'), 'Landing gallery must directly link to five cases');
 assert(landing.includes('href="/'+lang+'/examples.html"'), 'Preserve older three graphic examples');
 assert(landing.includes('r85examples1'), 'Fresh first-load assets');
}
assert((await read('index.html')).includes('r85examples1'), 'Home cache should load latest shared navigation');
for(const browserType of [chromium,webkit]){
 const browser=await browserType.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const ctx=await browser.newContext({viewport:{width,height:850},locale:'ja-JP',
    isMobile:width<500,hasTouch:width<500});
   await ctx.route('**/*.supabase.co/**',r=>r.abort());
   const page=await ctx.newPage();
   for(const lang of ['ja','en']){
    const url=lang==='ja'?'/index.html?lang=ja':'/en/';
    const res=await page.goto(base+url,{waitUntil:'domcontentloaded'});
    assert.equal(res.status(),200);
    const link=page.locator('.globalLocaleBar .globalExamplesBtn');
    await link.waitFor({state:'visible',timeout:15000});
    const actual=await link.evaluate(el=>{
      const r=el.getBoundingClientRect();
      const nav=el.closest('.globalLocaleBar').getBoundingClientRect();
      const langBtns=[...el.closest('.globalLocaleBar').querySelectorAll('[data-global-lang]')];
      return {label:el.textContent,href:new URL(el.href).pathname,
        within:r.left>=0&&r.right<=window.innerWidth,headerWidth:nav.width,
        langVisible:langBtns.every(b=>{const x=b.getBoundingClientRect();return x.left>=0&&x.right<=window.innerWidth}),
        navCount:el.closest('nav').children.length};
    });
    assert.equal(actual.href,'/'+lang+'/use-cases.html','Wrong language destination: '+JSON.stringify(actual));
    assert.equal(actual.label,lang==='ja'?'作例':'Demos');
    assert(actual.within&&actual.langVisible&&actual.navCount===4,
      browserType.name()+'/'+lang+'/'+width+' header did not fit: '+JSON.stringify(actual));
    await page.locator('.globalSupportMenu summary').click();
    const about=page.locator('.globalSupportPanel [data-global-about]');
    await about.waitFor({state:'visible'});
    assert.equal(new URL(await about.getAttribute('href'),base).pathname,'/'+lang+'/');
    const e=await link.getAttribute('href');
    const target=await page.goto(new URL(e,base).href,{waitUntil:'domcontentloaded'});
    assert.equal(target.status(),200,'Click destination should be served');
    assert.equal(await page.locator('.case').count(),5,'Five examples should actually be present');
    await page.goto(base+url,{waitUntil:'domcontentloaded'});
   }
   await ctx.close();
  }
 }finally{await browser.close()}
}
console.log('R85 PASS: persistent visible four-tab header on 320/390/1180 Chromium+WebKit, JA/EN routes, About in Help, five examples');
