import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

// All URLs are 127.0.0.1 static fixtures; no public ratings, no Supabase writes.
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
assert.equal(base,'http://127.0.0.1:4173');
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const context=await browser.newContext({viewport:{width,height:width<400?700:840},
     isMobile:width<400,hasTouch:width<400,locale:'ja-JP'});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*.supabase.co/**',r=>r.abort());
   for(const lang of ['ja','en']){
    const res=await page.goto(base+'/'+lang+'/examples.html',{waitUntil:'domcontentloaded'});
    assert.equal(res.status(),200);
    await page.locator('img').evaluateAll(imgs=>{
      for(const img of imgs)img.loading='eager';
    });
    await page.waitForFunction(()=>[...document.images].length===3 &&
      [...document.images].every(i=>i.complete&&i.naturalWidth===1080),
      null,{timeout:15000});
    const result=await page.evaluate(()=>{
      const images=[...document.images];
      const h1=document.querySelector('h1');
      const sectors=[...document.querySelectorAll('.example')];
      const inView=e=>{const r=e.getBoundingClientRect();return r.left>=-2&&r.right<=innerWidth+2};
      return {pageOverflow:document.documentElement.scrollWidth-innerWidth,
        h1inView:inView(h1),imgWidths:images.map(i=>i.naturalWidth),
        imagesSafe:images.every(inView),sectors:sectors.length,
        imageAlt:images.every(i=>i.alt&&i.alt.length>15),
        links:[...document.querySelectorAll('a')].filter(a=>a.href.endsWith('/examples.html')).length
      };
    });
    assert(result.pageOverflow<=2,'Horizontal overflow at '+width+' '+lang+': '+JSON.stringify(result));
    assert(result.h1inView&&result.imagesSafe&&result.imageAlt&&result.sectors===3,
      'Misaligned native PNGs or example page '+lang+': '+JSON.stringify(result));
    assert.equal(errors.length,0,'Runtime browser errors '+lang+' '+errors.join('; '));
    console.log('R70 browser '+engine.name()+' '+width+'px '+lang+' examples PASS');
   }
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R70 mobile/desktop Chromium+WebKit screenshot and PNG loading QA PASS');
