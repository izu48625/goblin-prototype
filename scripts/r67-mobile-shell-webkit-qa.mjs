import assert from 'node:assert/strict';
import {webkit} from 'playwright';

// R67: iPhone-sized WebKit QA. Local assets, localStorage only. No Supabase
// production writes, auth, analytics, publishing, or OS share-sheet claims.
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const widths=[
 {width:320,height:568,label:'iPhone SE / short'},
 {width:375,height:560,label:'short Safari keyboard-like viewport'},
 {width:390,height:844,label:'modern iPhone'},
 {width:430,height:932,label:'large iPhone'}
];
const browser=await webkit.launch({headless:true});
try {
 for(const size of widths) {
  const context=await browser.newContext({
    viewport:{width:size.width,height:size.height},
    isMobile:true,hasTouch:true,deviceScaleFactor:3,
    locale:'ja-JP',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const external=[];
  await context.route('**/*.supabase.co/**',route=>{
    external.push(route.request().url());return route.abort();
  });
  await context.route('**/api/guard/**',route=>{
    external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/index.html?qa=r67-mobile-safe',{
    waitUntil:'domcontentloaded',timeout:30000
  });
  const frame=page.frameLocator('#basicFrame');
  await frame.locator('#titleInput').waitFor({state:'visible',timeout:20000});
  await frame.locator('body').evaluate(async()=>{
    for(let i=0;i<120;i++){
      if(typeof window.__statsMakerGetActiveSheet==='function')return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('Home failed to initialize');
  });
  const initial=await page.evaluate(()=>{
    const bar=document.querySelector('.globalLocaleBar');
    const launcher=document.querySelector('#extLauncher');
    const shell=document.querySelector('#basicRoot');
    const box=el=>{const r=el.getBoundingClientRect();
      return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,
        width:r.width,height:r.height}};
    return {width:innerWidth,height:innerHeight,bar:box(bar),
      home:box(bar.querySelector('.globalHomeBtn')),
      discover:box(bar.querySelector('.globalDiscoverBtn')),
      intro:box(bar.querySelector('.globalIntroBtn')),
      help:box(bar.querySelector('.globalSupportMenu>summary')),
      en:box(bar.querySelector('[data-global-lang="en"]')),
      launcher:box(launcher),shell:box(shell),
      navScroll:bar.scrollWidth,navWidth:bar.clientWidth};
  });
  assert(initial.bar.top>=-1 && initial.bar.bottom<=initial.height+1,
    size.label+' global nav offscreen: '+JSON.stringify(initial));
  for(const key of ['home','discover','intro','help','en']) {
    const b=initial[key];
    assert(b.left>=-2 && b.right<=initial.width+2 && b.width>=20,
      size.label+' navigation '+key+' clipped: '+JSON.stringify(initial));
  }
  assert(initial.navScroll<=initial.navWidth+2,
    size.label+' nav overflow hidden by sticky header: '+JSON.stringify(initial));
  assert(initial.launcher.height>=44 && initial.launcher.left>=-2
    && initial.launcher.right<=initial.width+2 && initial.launcher.bottom<=initial.height+2,
    size.label+' extension entry unreachable: '+JSON.stringify(initial));
  assert(initial.shell.bottom<=initial.launcher.top+8,
    size.label+' launcher overlaps Home scrolling surface: '+JSON.stringify(initial));
  assert.equal(await page.locator('.globalLocaleBar').count(),1,
    'Duplicated global nav');
  assert.equal(await frame.locator('.globalLocaleBar').count(),0,
    'Embedded HOME unexpectedly has global bar');

  // Help is a fixed, short-screen-safe dropdown; all destinations remain
  // tappable, and it must not cover the launch action.
  await page.locator('.globalSupportMenu>summary').click();
  const popup=await page.locator('.globalSupportPanel').evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      scroll:el.scrollHeight,client:el.clientHeight};
  });
  assert(popup.left>=-2 && popup.right<=size.width+2
    && popup.top>=-2 && popup.bottom<=size.height+2,
    size.label+' HELP dropdown offscreen: '+JSON.stringify(popup));
  assert.equal(await page.locator('.globalSupportPanel a').count(),5);
  await page.locator('.globalSupportMenu>summary').click();

  // Opening/closing extension selector MUST preserve the local HOME sheet.
  await frame.locator('#titleInput').fill('R67 LOCAL WebKit '+size.width);
  await frame.locator('#descInput').fill('not published; free local test');
  await frame.locator('#scoreTable .scoreInput').first().fill('82');
  await frame.locator('#scoreTable .scoreInput').first().press('Tab');
  assert.equal(await frame.locator('body').evaluate(()=>
    window.__statsMakerGetActiveSheet()?.rows?.[0]?.scores?.[0]),82);
  const inputs=await frame.locator('body').evaluate(()=>{
    const wanted=['#titleInput','#descInput','#sheetSelect','#searchInput',
      '#scoreTable .nameInput','#scoreTable .scoreInput'];
    return wanted.map(selector=>{
      const el=document.querySelector(selector);
      return {selector,font:parseFloat(getComputedStyle(el).fontSize),
        height:el.getBoundingClientRect().height};
    });
  });
  for(const field of inputs)assert(field.font>=16,
    size.label+' Safari focus autozoom: '+JSON.stringify(field));
  assert((await frame.locator('body').evaluate(()=>
    document.documentElement.scrollWidth-innerWidth))<=2,
    size.label+' horizontal scrolling of Home shell');

  await page.locator('#extLauncher').click();
  const panel=page.locator('#extSheet');
  await panel.waitFor({state:'visible',timeout:15000});
  const p=await panel.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,client:el.clientHeight,
      scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY};
  });
  assert(p.top>=-2 && p.bottom<=size.height+2,
    size.label+' extended gallery invisible: '+JSON.stringify(p));
  assert(['auto','scroll'].includes(p.overflow),
    size.label+' extension selector cannot scroll');
  assert((await page.locator('.extCard').count())>=10,
    'Missing graph template launcher cards');
  await page.locator('#extClose').click();
  assert(await page.locator('#extBackdrop').isHidden(),'Extension picker did not close');
  const data=await frame.locator('body').evaluate(()=>({
    title:document.querySelector('#titleInput')?.value,
    score:window.__statsMakerGetActiveSheet()?.rows?.[0]?.scores?.[0]
  }));
  assert(data.title.startsWith('R67 LOCAL WebKit')&&data.score===82,
    'Closing picker erased local edit '+JSON.stringify(data));
  assert.deepEqual(errors.filter(s=>/SyntaxError|ReferenceError|TypeError/.test(s)),[],
    size.label+' critical WebKit script errors');
  assert.equal(external.length,0,
    size.label+' test unexpectedly contacted a Supabase endpoint');
  console.log('R67 mobile shell + nav + help + edit + graph picker PASS',
    size.label,JSON.stringify({popup,selector:p}));
  await context.close();
 }
 console.log('R67 iPhone-sized WebKit QA PASS; actual iOS share sheet not tested');
}finally{await browser.close()}
