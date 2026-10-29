import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
    for(const lang of ['ja','en']){
      const context=await browser.newContext({
        viewport:{width:390,height:844},isMobile:true,hasTouch:true,
        locale:lang==='ja'?'ja-JP':'en-US'
      });
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('https://cdn.jsdelivr.net/**',route=>
        route.fulfill({status:200,contentType:'application/javascript',body:'window.html2canvas=()=>Promise.resolve(document.createElement("canvas"));'}));
      await page.goto(base+'/'+lang+'/tier-maker.html',{waitUntil:'domcontentloaded'});
      await page.locator('h1').waitFor({state:'visible'});
      assert((await page.locator('h1').textContent()).includes('Tier'));
      const initialLang=await page.locator('html').getAttribute('lang');
      assert.equal(initialLang,lang);
      const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');
      assert.equal(canonical,'https://statsmaker.app/'+lang+'/tier-maker.html');
      const image=page.locator('.tierSeoArt img');
      assert(await image.evaluate(img=>img.complete&&img.naturalWidth>0),'Example image missing');
      await page.locator('#tierStart').click();
      await page.waitForURL(/\/app\/editor\.html\?id=/,{timeout:18000});
      const project=await page.evaluate(()=>{
        const id=new URL(location.href).searchParams.get('id');
        return JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').find(x=>x.id===id);
      });
      assert(project,'Direct-create Tier project was not saved locally');
      assert.equal(project.type,'tier-list');
      assert.equal(project.settings.mode,'auto');
      assert.equal(project.publish?.visibility||'private','private');
      assert.deepEqual(project.data.tiers.map(t=>t.label),['S','A','B','C','D']);
      assert.equal(project.data.items[0].name,lang==='ja'?'項目1':'Item 1');
      await page.locator('#previewRoot .visual').waitFor({state:'visible',timeout:18000});
      assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError|TypeError/.test(e)),[]);
      console.log('R121 '+engine.name()+' '+lang+': SEO page, original image, Tier create CTA and editor PASS');
      await context.close();
    }
  }finally{await browser.close()}
}
