import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base='http://127.0.0.1:4173';
function luminance(rgb){
 const parts=(rgb.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 assert(parts.length===3,'No RGB color: '+rgb);
 const c=parts.map(n=>{const v=n/255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05)}
function neutral(rgb){
 const c=(rgb.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
 return c.length===3&&Math.max(...c)-Math.min(...c)<=13;
}
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1180]){
   const mobile=width<500;
   const context=await browser.newContext({viewport:{width,height:mobile?800:900},isMobile:mobile,hasTouch:mobile,locale:'ja-JP'});
   // Local mock-only: browser never contacts cloud database.
   await context.route('https://*.supabase.co/**',route=>route.abort());
   // CSS-only editor inspection: without a saved project the app intentionally redirects home.
   await context.route(url=>url.pathname==='/app/src/editor-entry.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:'export {};'
   }));
   await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'
   }));
   const page=await context.newPage();
   for(const lang of ['ja','en']){
    const res=await page.goto(base+'/'+lang+'/',{waitUntil:'domcontentloaded'});
    assert.equal(res.status(),200);
    await page.locator('.globalSupportMenu>summary').waitFor();
    assert.equal(await page.locator('.r71ShowcaseCard').count(),3);
    const c1=await page.evaluate(()=>{
     const bar=getComputedStyle(document.querySelector('.globalLocaleBar'));
     const nav=document.querySelector('.r73MoreLinks');
     const hero=document.querySelector('.hero');
     return {bg:bar.backgroundColor,navBelow:nav.getBoundingClientRect().top>hero.getBoundingClientRect().bottom,
             overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert(c1.navBelow,'Duplicated secondary links still above hero');
    assert(c1.overflow<=2,'Landing horizontal overflow '+width+lang+JSON.stringify(c1));
    assert(neutral(c1.bg)&&luminance(c1.bg)>.85,'Header must be bright neutral');
    await page.locator('.globalSupportMenu>summary').click();
    const menu=page.locator('.globalSupportPanel');
    assert(await menu.isVisible(),'Help dropdown not visible');
    const colors=await page.evaluate(()=>{
     const m=document.querySelector('.globalSupportPanel');
     const a=m.querySelector('a');
     return {bg:getComputedStyle(m).backgroundColor,fg:getComputedStyle(a).color,
             overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert(contrast(colors.bg,colors.fg)>=4.5,
      'Help menu accessibility contrast '+lang+' '+width+JSON.stringify(colors));
    assert(colors.overflow<=2,'Open menu causes horizontal overflow '+lang+' '+width);
    await page.keyboard.press('Escape');
    for(const path of ['legal.html','chart-guide.html','examples.html']){
     const result=await page.goto(base+'/'+lang+'/'+path,{waitUntil:'load'});
     assert.equal(result.status(),200);
     await page.waitForFunction(()=>!!document.querySelector('link[href*="r73-reading.css"]')?.sheet,null,{timeout:12000});
     await page.waitForLoadState('load');
     await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(246, 245, 241)',null,{timeout:4500}).catch(()=>{});
     const c2=await page.evaluate(()=>({
       sheets:[...document.styleSheets].map(s=>({href:s.href,disabled:s.disabled,rules:(()=>{try{return s.cssRules.length}catch{return -1}})()})),
       bg:getComputedStyle(document.body).backgroundColor,
       color:getComputedStyle(document.body).color,
       overflow:document.documentElement.scrollWidth-innerWidth
     }));
     assert(luminance(c2.bg)>.82,'Dark reading page remains: '+lang+path+' '+JSON.stringify(c2));
     assert(contrast(c2.bg,c2.color)>=4.5,'Reading contrast '+lang+path);
     assert(c2.overflow<=2,'Reading page horizontally overflows '+lang+path+width+JSON.stringify(c2));
    }
    console.log('R73 '+engine.name()+' '+width+' '+lang+' light shell, help and reading PASS');
   }
   await page.goto(base+'/index.html?lang=ja',{waitUntil:'domcontentloaded'});
   const frame=page.frameLocator('#basicFrame');
   await frame.locator('#titleInput').waitFor();
   const baseColors=await frame.locator('#titleInput').evaluate(el=>{
    const style=getComputedStyle(el);
    return {bg:style.backgroundColor,fg:style.color};
   });
   assert(neutral(baseColors.bg),'Basic editor title field still navy '+JSON.stringify(baseColors));
   assert(contrast(baseColors.bg,baseColors.fg)>=4.5,'Basic editor title illegible');
   await page.goto(base+'/app/editor.html',{waitUntil:'domcontentloaded'});
   const editorBg=await page.locator('.preview-toolbar').evaluate(el=>getComputedStyle(el).backgroundColor);
   assert(neutral(editorBg),'Graph editor chrome still navy');
   // Chart output theme is explicitly owned by the selected graph, not by site chrome.
   const artBg=await page.evaluate(()=>getComputedStyle(document.querySelector('#previewRoot')).backgroundColor);
   assert(!neutral(artBg),'Chart template colors were accidentally overwritten: '+artBg);
   console.log('R73 '+engine.name()+' '+width+' basic and graph editor palettes PASS');
   await context.close();
  }
 }finally{await browser.close()}
}
console.log('R73 WebKit+Chromium readable navigation and cross-page palette PASS');
