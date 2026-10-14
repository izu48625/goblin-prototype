import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:8765';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const [js,css,roadmap,ja,en]=await Promise.all([
  'cloud/global-locale.js','cloud/global-locale.css','ROADMAP_R31_PLUS.md','ja/legal.html','en/legal.html'].map(read));
assert(js.includes('globalSupportMenu')&&js.includes('data-global-support')&&js.includes('data-global-guide'));
assert(css.includes('.globalSupportPanel'));
assert(roadmap.includes('R35 P3'));
for(const page of [ja,en])for(const anchor of ['terms','privacy','contact'])assert(page.includes('id="'+anchor+'"'));

const browser=await chromium.launch({headless:true});
try{
  for(const width of [320,390]){
    for(const lang of ['ja','en']){
      const ctx=await browser.newContext({viewport:{width,height:844},locale:lang==='ja'?'ja-JP':'en-US',
        userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
      await ctx.addInitScript(locale=>{
        try{localStorage.setItem('statsMaker.locale',locale);localStorage.setItem('statsMakerV2Language',locale)}catch{}
      },lang);
      const page=await ctx.newPage();
      const paths=lang==='ja'?['/index.html','/discover.html','/public.html','/ja/','/ja/legal.html']:
        ['/index.html','/discover.html','/public.html','/en/','/en/legal.html'];
      for(const path of paths){
        await page.goto(BASE+path,{waitUntil:'domcontentloaded',timeout:60000});
        const bar=page.locator('.globalLocaleBar');
        await bar.waitFor({state:'visible',timeout:20000});
        assert.equal(await bar.count(),1,'Duplicate global navbar on '+path);
        assert.equal(await bar.locator('.globalHomeBtn').count(),1);
        assert.equal(await bar.locator('.globalDiscoverBtn').count(),1);
        assert.equal(await bar.locator('.globalSupportMenu').count(),1);
        assert.equal(await bar.locator('[data-global-lang]').count(),2);
        const measured=await page.evaluate(()=>{
          const bar=document.querySelector('.globalLocaleBar');
          const nav=bar.querySelector('.globalNavLinks');
          const controls=bar.querySelector('.globalLocaleControls');
          return {width:innerWidth,barHeight:bar.getBoundingClientRect().height,
            scrollWidth:bar.scrollWidth,clientWidth:bar.clientWidth,
            navLeft:nav.getBoundingClientRect().left,
            navRight:nav.getBoundingClientRect().right,
            navTop:nav.getBoundingClientRect().top,
            navBottom:nav.getBoundingClientRect().bottom,
            supportPadding:getComputedStyle(bar.querySelector('.globalSupportMenu')).paddingTop,
            supportBorder:getComputedStyle(bar.querySelector('.globalSupportMenu')).borderBottomWidth,
            controlsLeft:controls.getBoundingClientRect().left,
            controlsRight:controls.getBoundingClientRect().right};
        });
        assert(measured.scrollWidth<=measured.clientWidth+2,'Support navbar horizontal overflow '+path+' '+JSON.stringify(measured));
        assert(measured.navLeft>=-1&&measured.navRight<=width+1,'Nav outside viewport '+path+' '+JSON.stringify(measured));
        // Landing FAQ CSS targets all <details>; it must never enlarge the common Help nav.
        assert(measured.navTop>=-1&&measured.navBottom<=measured.barHeight+2,
          'Support nav vertically overflows 44px toolbar '+path+' '+JSON.stringify(measured));
        assert(measured.supportPadding==='0px'&&measured.supportBorder==='0px',
          'Generic FAQ details styling leaked into shared Help '+path+' '+JSON.stringify(measured));
        assert(measured.controlsRight<=width+1&&measured.controlsLeft>=measured.navRight-1,'Controls overlap '+path+' '+JSON.stringify(measured));
        assert(measured.barHeight>=40&&measured.barHeight<=52,'Navbar height changed '+JSON.stringify(measured));
        await bar.locator('.globalSupportMenu summary').click();
        assert.equal(await bar.locator('.globalSupportMenu').getAttribute('open'),'','Help menu did not open on '+path);
        for(const [kind,slug] of [['chart','chart-guide.html'],['png','png-guide.html']]){
          const link=bar.locator('[data-global-guide="'+kind+'"]');
          assert(await link.isVisible(),'Guide '+kind+' link missing on '+path);
          const destination=new URL(await link.getAttribute('href'));
          assert.equal(destination.pathname,'/'+lang+'/'+slug);
          const bounds=await link.boundingBox();
          assert(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=width+1,
            'Guide '+kind+' not visible on '+width+'px phone: '+JSON.stringify(bounds));
        }
        for(const section of ['terms','privacy','contact']){
          const link=bar.locator('[data-global-support="'+section+'"]');
          assert(await link.isVisible(),section+' link hidden on '+path);
          const url=new URL(await link.getAttribute('href'));
          assert.equal(url.pathname,'/'+lang+'/legal.html');
          assert.equal(url.hash,'#'+section);
        }
        await page.keyboard.press('Escape');
        assert.equal(await bar.locator('.globalSupportMenu').getAttribute('open'),null);
        console.log('R35 support navbar PASS',width,lang,path);
      }
      // Real Home -> Help -> guide navigation without going via the About page.
      for(const [kind,slug] of [['chart','chart-guide.html'],['png','png-guide.html']]){
        await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
        await page.locator('.globalSupportMenu summary').click();
        await page.locator('[data-global-guide="'+kind+'"]').click();
        await page.waitForURL(url=>url.pathname==='/'+lang+'/'+slug);
        assert.equal(await page.locator('main h1').count(),1,'Guide landing inaccessible: '+slug);
      }
      await page.goto(BASE+'/'+lang+'/',{waitUntil:'domcontentloaded'});
      await page.locator('.globalSupportMenu summary').click();
      await page.locator('[data-global-support="contact"]').click();
      await page.waitForURL(url=>url.pathname==='/'+lang+'/legal.html'&&url.hash==='#contact');
      await page.locator('#legalContactForm').waitFor({state:'visible'});
      assert.equal(await page.locator('.globalLocaleBar').count(),1);
      // Switching language from an anchored legal page keeps the active section.
      const opposite=lang==='ja'?'en':'ja';
      await page.locator('[data-global-lang="'+opposite+'"]').click();
      await page.waitForURL(url=>url.pathname==='/'+opposite+'/legal.html'&&url.hash==='#contact');
      await page.locator('#legalContactForm').waitFor({state:'visible'});
      await ctx.close();
    }
  }
  console.log('R35 P3 bilingual Help menu, Contact routing, and 320/390px smartphone UX PASS');
}finally{await browser.close();}
