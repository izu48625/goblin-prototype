import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const root=process.env.BASE_URL||'http://127.0.0.1:4173';
for(const browserType of [chromium,webkit]){
  const browser=await browserType.launch({headless:true});
  try{
    for(const lang of ['ja','en']){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:lang==='ja'?'ja-JP':'en-US'});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const response=await page.goto(root+'/'+lang+'/tier.html',{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.locator('#definition h2').waitFor({state:'visible',timeout:10000});
      assert((await page.locator('h1').textContent()).includes(lang==='ja'?'ティア':'Tier'));
      assert.equal(await page.locator('.tierSeoTable tbody tr').count(),11);
      const img=page.locator('#worked-example img');
      assert(await img.evaluate(x=>x.complete&&x.naturalWidth>0),'Original chart must load');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert(overflow<=4,'Mobile overflow '+browserType.name()+' '+lang+' '+overflow);
      await page.locator('#how-to a[href="'+('/'+lang+'/tier-maker.html')+'"]').first().click();
      await page.waitForURL(new RegExp('/'+lang+'/tier-maker\\.html'),{timeout:10000});
      await page.locator('#tierStart').waitFor({state:'visible'});
      assert.deepEqual(errors.filter(x=>/SyntaxError|TypeError|ReferenceError/.test(x)),[]);
      console.log('R122 '+browserType.name()+' '+lang+': Tier concept, sample, mobile fit and maker navigation PASS');
      await context.close();
    }
  }finally{await browser.close()}
}
