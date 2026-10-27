import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
assert.equal(base,'http://127.0.0.1:4173');
for(const engine of [chromium,webkit]){
 const b=await engine.launch({headless:true});
 try{
  for(const width of [360,1180]){
   const ctx=await b.newContext({viewport:{width,height:width<500?740:840},isMobile:width<500,hasTouch:width<500});
   await ctx.route('**/*.supabase.co/**',r=>r.abort());
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const lang of ['ja','en']){
    const resp=await page.goto(base+'/'+lang+'/use-cases.html',{waitUntil:'domcontentloaded'});
    assert.equal(resp.status(),200);
    await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
    await page.waitForFunction(()=>[...document.images].length===5 && [...document.images].every(i=>i.complete&&i.naturalWidth>0),null,{timeout:15000});
    const stat=await page.evaluate(()=>{
      const images=[...document.images], r=e=>e.getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth-innerWidth,
        imgs:images.map(i=>({width:i.naturalWidth,height:i.naturalHeight,rect:r(i).width})),
        cases:document.querySelectorAll('.case').length,
        imgAlt:images.every(i=>i.alt.length>15),
        h1:document.querySelectorAll('h1').length};
    });
    assert(stat.overflow<=3,'Horizontal overflow '+engine.name()+'/'+lang+'/'+width+': '+JSON.stringify(stat));
    assert(stat.cases===5&&stat.imgAlt&&stat.h1===1,'Invalid image content: '+JSON.stringify(stat));
    assert.equal(errors.length,0,'Browser errors '+errors.join('|'));
    console.log('R84 browser '+engine.name()+' '+width+' '+lang+' PASS');
   }
   await ctx.close();
  }
 }finally{await b.close()}
}
