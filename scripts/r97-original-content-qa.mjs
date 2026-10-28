import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
// R98: the real editorial lab must be discoverable from both localized landing pages,
// without confusing it with user-published Public content.
for(const locale of ['ja','en']){
 const landing=await read(locale+'/index.html');
 const url='/'+locale+'/game-balance.html';
 assert((landing.split('href="'+url+'"').length-1)>=2,
  'Original lab should be linked from examples and practical-usecases: '+locale);
 assert(landing.includes('id="practical-usecases"'));
 assert(landing.includes(locale==='ja'?'ユーザーの公開作品とは別':'not a user-published work'));
 assert(!landing.includes('adsbygoogle.js')&&!landing.includes('googletagmanager.com'));
}
for(const locale of ['ja','en']){
 const html=await read(locale+'/game-balance.html');
 assert(html.includes('<html lang="'+locale+'">'));
 assert(html.includes('rel="canonical"'));
 assert(html.includes('name="description"'));
 assert(html.includes('id="r97Lab"'));
 assert(html.includes('/cloud/r97-game-balance.js?v=r97lab1'));
 assert((html.match(/data-weight="/g)||[]).length===4);
 assert((html.match(/<th scope="row">/g)||[]).length===5,
  'All original scores must be visible without JS');
 assert(html.includes('href="/'+locale+'/scoring-guide.html"'));
 assert(html.includes('hreflang="en"')&&html.includes('hreflang="ja"'));
 assert(!html.includes('adsbygoogle.js')&&!html.includes('googletagmanager.com'));
}
const sitemap=await read('worker/seo.js');
assert(sitemap.includes("'/ja/game-balance.html','/en/game-balance.html'"));
const discover=await read('discover.html');
assert(discover.includes('id="r97BalanceLink"'));
assert(discover.includes('cloud/discover.js?v=r97balance1'));
const management=await read('my.html');
assert(management.includes('id="r97DupOnlyBtn"'));
assert(management.includes('cloud/my.js?v=r97dup1'));
const ownerJS=await read('cloud/my.js');
assert(ownerJS.includes('publicDuplicatesAmongOwnedWorks()'));
assert(ownerJS.includes('data-stage-unlisted'));
assert(ownerJS.includes("select.value='unlisted'"));
assert(ownerJS.includes(".eq('owner_id',state.user.id)"));
assert(!ownerJS.includes('.delete()'));
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
for(const [browserType,width] of [[webkit,320],[webkit,390],[chromium,1180]]){
 const browser=await browserType.launch({headless:true});
 try{
  for(const locale of ['ja','en']){
   const context=await browser.newContext({viewport:{width,height:820},locale:locale==='ja'?'ja-JP':'en-US',isMobile:width<500,hasTouch:width<500});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   const res=await page.goto(BASE+'/'+locale+'/game-balance.html',{waitUntil:'domcontentloaded',timeout:40000});
   assert.equal(res.status(),200);
   await page.locator('[data-r97-result] tr').first().waitFor({timeout:12000});
   assert.equal(await page.locator('[data-r97-result] tr').count(),5);
   assert((await page.locator('[data-r97-summary]').textContent()).includes(locale==='ja'?'蒼の槍':'Azure Spear'));
   await page.locator('[data-r97-scenario="speed"]').click();
   assert((await page.locator('[data-r97-summary]').textContent()).includes(locale==='ja'?'疾風の短剣':'Wind Dagger'));
   assert.equal(await page.locator('[data-weight-output="1"]').textContent(),'3');
   await page.locator('[data-r97-scenario="defense"]').click();
   assert((await page.locator('[data-r97-summary]').textContent()).includes(locale==='ja'?'鋼の盾':'Iron Shield'));
   await page.locator('[data-r97-scenario="power"]').click();
   assert((await page.locator('[data-r97-summary]').textContent()).includes(locale==='ja'?'岩砕きの槌':'Stone Hammer'));
   await page.locator('[data-r97-reset]').click();
   assert((await page.locator('[data-r97-summary]').textContent()).includes(locale==='ja'?'蒼の槍':'Azure Spear'));
   await page.evaluate(()=>{
     document.querySelectorAll('[data-weight]').forEach(x=>x.value='0');
     document.querySelector('[data-weight="0"]').dispatchEvent(new Event('input',{bubbles:true}));
   });
   assert.equal(await page.locator('[data-r97-result] tr').count(),0,'No false winner when all weights zero');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(overflow<=3,browserType.name()+' '+locale+' '+width+' horizontal overflow: '+overflow);
   assert.deepEqual(errors.filter(x=>/SyntaxError|TypeError|ReferenceError/.test(x)),[],'Browser JS errors');
   console.log('R97 LAB PASS',browserType.name(),width,locale);
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R97 PASS: accessible JS-free source, weighted lab, sitemap, first-party links and owner-only duplicate review');
