import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const BASE='http://127.0.0.1:4173';
const lum=color=>{
 const c=(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 assert.equal(c.length,3,'unparseable '+color);
 const k=c.map(n=>{const v=n/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
 return .2126*k[0]+.7152*k[1]+.0722*k[2];
};
const contrast=(a,b)=>{const values=[lum(a),lum(b)].sort((x,y)=>x-y);return (values[1]+.05)/(values[0]+.05)};
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const context=await browser.newContext({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500});
   await context.route('https://*.supabase.co/**',r=>r.abort());
   await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'}));
   const page=await context.newPage();
   for(const language of ['ja','en']){
    for(const article of ['chart-guide.html','png-guide.html','examples.html']){
     const url=BASE+'/'+language+'/'+article;
     const response=await page.goto(url,{waitUntil:'load'});
     assert.equal(response.status(),200,url);
     await page.locator('.globalLocaleBar').waitFor({state:'visible'});
     assert.equal(await page.locator('.globalLocaleBar').count(),1,'Only one site bar '+url);
     assert.equal(await page.locator('body>header').count(),0,'Old header remains '+url);
     const dom=await page.evaluate(()=>{
      const bar=document.querySelector('.globalLocaleBar');
      const nav=document.querySelector('.globalNavLinks');
      return {barHeight:bar.getBoundingClientRect().height,
       barBG:getComputedStyle(bar).backgroundColor,
       barFG:getComputedStyle(bar.querySelector('.globalHomeBtn')).color,
       navWrap:getComputedStyle(nav).flexWrap,
       overflow:document.documentElement.scrollWidth-innerWidth};
     });
     assert(dom.barHeight>=40&&dom.barHeight<=52,'Header should be compact '+JSON.stringify(dom));
     assert(contrast(dom.barBG,dom.barFG)>=4.5,'Header contrast '+JSON.stringify(dom));
     assert.equal(dom.navWrap,'nowrap','Navigation wraps at '+width+' '+language);
     assert(dom.overflow<=2,'Article x-overflow '+url+' '+JSON.stringify(dom));
     assert.equal(await page.locator('[data-global-lang="'+language+'"]').getAttribute('aria-pressed'),'true');
    }
   }
   await page.goto(BASE+'/ja/chart-guide.html',{waitUntil:'load'});
   await page.locator('[data-global-lang="en"]').click();
   await page.waitForURL(url=>url.pathname==='/en/chart-guide.html');
   assert.equal(await page.locator('[data-global-lang="en"]').getAttribute('aria-pressed'),'true');
   await page.locator('.globalSupportMenu>summary').click();
   const help=await page.locator('.globalSupportPanel').evaluate(el=>{
     const l=el.querySelector('a');return {bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(l).color};
   });
   assert(contrast(help.bg,help.fg)>=4.5,'Help menu fails WCAG at '+width);
   await page.goto(BASE+'/ja/examples.html',{waitUntil:'load'});
   await page.locator('.globalHomeBtn').click();
   await page.waitForURL(url=>url.pathname==='/index.html');
   await page.frameLocator('#basicFrame').locator('#addRowBtn').waitFor();
   const control=await page.frameLocator('#basicFrame').locator('#addRowBtn').evaluate(el=>({
    bg:getComputedStyle(el).backgroundColor,fg:getComputedStyle(el).color
   }));
   assert.equal(control.bg,'rgb(255, 243, 238)','Row add should be warm light '+JSON.stringify(control));
   assert(contrast(control.bg,control.fg)>=4.5,'Row add contrast '+JSON.stringify(control));
   const badge=await page.frameLocator('#basicFrame').locator('#currentScaleBadge').evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(badge,'rgb(239, 233, 222)','100-point badge should be warm light '+badge);
   const blank=await page.frameLocator('#basicFrame').locator('#scoreTable tbody tr:nth-child(2) td.scoreCell').first().evaluate(el=>getComputedStyle(el).backgroundColor);
   assert.equal(blank,'rgb(255, 255, 255)','Blank score cells must match white page');
   console.log('R74 '+engine.name()+' '+width+'px: 6 pages, nav, i18n, score controls PASS');
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R74 all Chromium/WebKit mobile+desktop QA PASS');
