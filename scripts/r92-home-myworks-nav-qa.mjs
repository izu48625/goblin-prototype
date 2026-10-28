import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const nav=await readFile(new URL('../cloud/global-locale.js',import.meta.url),'utf8');
const root=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert(nav.includes('data-global-myworks')&&nav.includes("'/my.html?lang='+lang"),'Missing correct owner navigation');
assert(/cloud\/global-locale\.js\?v=[A-Za-z0-9-]+/.test(root),'Home must load versioned shared nav');
assert(!nav.includes('myWorks.innerHTML'),'Avoid injecting user-controlled text');
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
for(const [engine,width] of [[webkit,320],[webkit,390],[chromium,1180]]){
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width,height:800},isMobile:width<500,hasTouch:width<500,locale:'ja-JP'});
  await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:'window.supabase={createClient:()=>({})};'}));
  const page=await context.newPage();
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('.globalSupportMenu summary').waitFor({timeout:12000});
  assert.equal(await page.locator('a[data-global-myworks]').count(),1);
  assert.equal(await page.locator('a[data-global-myworks]').textContent(),'自分の作品を管理');
  await page.locator('.globalSupportMenu summary').click();
  assert.equal(await page.locator('a[data-global-myworks]').isVisible(),true);
  const href=await page.locator('a[data-global-myworks]').getAttribute('href');
  assert(new URL(href,BASE).pathname==='/my.html');
  assert.equal(new URL(href,BASE).searchParams.get('lang'),'ja');
  if(width<500){
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert(overflow<=3,'iPhone nav horizontal overflow '+width+': '+overflow);
  }
  await page.locator('a[data-global-myworks]').click();
  await page.waitForURL(/\/my\.html\?lang=ja/, {timeout:12000});
  assert.equal(await page.locator('#pageTitle').textContent(),'自分の公開作品');
  assert.deepEqual(errs.filter(e=>/SyntaxError|ReferenceError/.test(e)),[], 'Unexpected home JS syntax');
  console.log('R92 PASS',width,'Home Help → My Works route, language and mobile layout');
  await context.close();
 }finally{await browser.close()}
}
