import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base='http://127.0.0.1:4173';
const topic={
  id:'00000000-0000-4000-8000-000000000071',
  title:'PUBLIC R71 Sample',
  description:'Original score comparison',
  visibility:'public',language_code:'ja',
  published_at:'2026-10-20T00:00:00Z',snapshot_updated_at:'2026-10-20T00:00:00Z',
  snapshot:{metadata:{category:'manga_anime'},rows:[
    {name:'Red Team',scores:[8,6,7]},{name:'Blue Team',scores:[6,9,6]},
    {name:'Gold Team',scores:[9,8,8]}],
    criteria:[{name:'Attack',weight:1},{name:'Defense',weight:1},{name:'Teamwork',weight:1}],
    scale:10,weighted:false},
  score_scale:10,weighted:false,show_community:true,allow_ratings:true,participants:2,remixCount:1
};
for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
    for(const width of [320,390,1180]){
      const mobile=width<500;
      const context=await browser.newContext({viewport:{width,height:mobile?800:900},
        isMobile:mobile,hasTouch:mobile,locale:'ja-JP'});
      // Do not contact Supabase or third-party CDNs in this local visual test.
      await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({
        status:200,contentType:'application/javascript',
        body:'window.supabase={createClient:()=>({})};'
      }));
      await context.route('https://*.supabase.co/**',r=>r.abort());
      const requestArgs=[];
      let privatize=false;
      await context.route(url=>url.pathname==='/api/discover',async route=>{
        requestArgs.push(Object.fromEntries(route.request().url().split('?')[1]?
          new URL(route.request().url()).searchParams:[]));
        await route.fulfill({status:200,contentType:'application/json',
          headers:{'Cache-Control':'no-store'},
          body:JSON.stringify({rows:[{...topic,visibility:privatize?'private':'public'}],
            total:1,has_more:false,anchor:'2026-10-24T00:00:00Z'})});
      });
      const page=await context.newPage();
      for(const lang of ['ja','en']){
        const response=await page.goto(base+'/'+lang+'/',{waitUntil:'domcontentloaded'});
        assert.equal(response.status(),200);
        assert.equal(await page.locator('.r71ShowcaseCard').count(),3);
        await page.locator('.r71ShowcaseCard img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
        await page.waitForFunction(()=>[...document.querySelectorAll('.r71ShowcaseCard img')]
          .every(img=>img.complete&&img.naturalWidth===1080),null,{timeout:15000});
        const visual=await page.evaluate(()=>{
          const rail=document.querySelector('.r71ShowcaseRail');
          const cat=document.querySelector('.r71CategoryRail');
          return {overflow:document.documentElement.scrollWidth-innerWidth,
            horizontal:rail.scrollWidth>rail.clientWidth+1,
            categoryHorizontal:cat.scrollWidth>cat.clientWidth+1};
        });
        assert(visual.overflow<=2,'Unexpected viewport overflow '+engine.name()+' '+width+' '+lang+': '+JSON.stringify(visual));
        if(mobile)assert(visual.horizontal&&visual.categoryHorizontal,'Rails should scroll on mobile: '+JSON.stringify(visual));
        const category=page.locator('a[data-category="manga_anime"]');
        assert.equal(await category.count(),1);
        await category.click();
        await page.waitForURL(/discover\.html\?/);
        await page.locator('.workCard').waitFor({timeout:12000});
        assert(requestArgs.some(p=>p.category==='manga_anime'&&p.locale===lang),
          'Deep-linked category was not applied '+lang);
        assert.equal(await page.locator('.workMainLink .workVisual').count(),1);
        assert.equal(await page.locator('.statsDisclosureBody .workVisual').count(),0);
        assert.equal(await page.locator('.workTitle').innerText(),'PUBLIC R71 Sample');
        assert.equal(await page.locator('.categoryBtn.active').getAttribute('data-category'),'manga_anime');
        const preview=await page.locator('.workMainLink .workVisual').innerText();
        assert(preview.includes('Red Team')&&preview.includes('Gold Team'),
          'Preview must come from real snapshot scores');
        const titleClamp=await page.locator('.workTitle').evaluate(el=>getComputedStyle(el).webkitLineClamp);
        assert.equal(titleClamp,'2','Public titles can use two lines');
        assert.equal(await page.locator('img[src*="api/og"]').count(),0,
          'No per-card OG request');
        console.log('R71 '+engine.name()+' '+width+'px '+lang+' gallery & Public category PASS');
      }
      await page.goto(base+'/discover.html?lang=ja&view=community',{waitUntil:'domcontentloaded'});
      await page.locator('.workCard').waitFor();
      assert.equal(await page.locator('.browseTab.active').getAttribute('data-view'),'community');
      assert(requestArgs.some(p=>p.view==='community'));
      privatize=true;
      await page.locator('#refreshBtn').click();
      await page.waitForFunction(()=>!document.querySelector('#status').classList.contains('hidden'));
      assert.equal(await page.locator('.workCard').count(),0,
        'Non-Public payload must never be rendered');
      await page.goto(base+'/index.html?lang=ja',{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('#basicFrame').count(),1,'Home iframe preserved');
      assert.equal(await page.locator('#extLauncher').count(),1,'Editor extension launcher preserved');
      console.log('R71 '+engine.name()+' '+width+'px deep-link, privacy rejection, editor shell PASS');
      await context.close();
    }
  }finally{await browser.close()}
}
console.log('R71 Chromium+WebKit responsive visual and non-Public rejection QA PASS');
