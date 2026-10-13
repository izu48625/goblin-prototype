import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const BASE=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const mockSource=await readFile(new URL('./r28-publish-lifecycle-test.mjs',import.meta.url),'utf8');
const embedded=mockSource.match(/^const mockSdk=(".+");$/m);
assert(embedded,'Isolated Supabase mock unavailable');
const mockSdk=JSON.parse(embedded[1]);
const browser=await (process.env.BROWSER_ENGINE==='webkit'?webkit:chromium).launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},locale:'ja-JP'});
  const realRequests=[];
  await page.route('**/supabase-js@2',route=>route.fulfill({
    status:200,contentType:'application/javascript',body:mockSdk
  }));
  await page.route('**/ibpdxbeltdwkquowjeay.supabase.co/**',route=>{
    realRequests.push(route.request().url());return route.abort();
  });
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  await home.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
  assert.equal(await home.locator('#currentScaleBadge').innerText(),'100点満点');
  const score=async()=>home.locator('#scoreTable').evaluate(el=>
    [...el.querySelectorAll('tbody tr:first-child td.scoreCell')].slice(0,4)
      .map(td=>({
        value:td.querySelector('input').value,
        grade:td.classList[1],
        color:getComputedStyle(td).backgroundColor
      })));
  const sample=[8,8,6,1];
  for(let i=0;i<4;i++)
    await home.locator('[data-score-row="0"][data-score-col="'+i+'"]').fill(String(sample[i]));
  await home.locator('#titleInput').click();
  const before=await score();
  assert.deepEqual(before.map(x=>x.value),sample.map(String));
  assert(before.every(x=>x.grade==='heat-e'), 'Initial 8 is 8/100, not 8/10');
  assert.equal(new Set(before.map(x=>x.color)).size,1,
    'Screenshot regression cannot be demonstrated on initial 100-point mode');
  await home.locator('#scoreSettingsBtn').click();
  await home.locator('#scaleMismatchHint').waitFor({state:'visible',timeout:6000});
  assert((await home.locator('#scaleMismatchHint').innerText()).includes('8点'));
  const savedBefore=await home.locator('body').evaluate(()=>window.__statsMakerGetActiveSheet().rows[0].scores.slice(0,4));
  assert.deepEqual(savedBefore.map(Number),sample);
  await home.locator('#rebase10Btn').click();
  assert.equal(await home.locator('#currentScaleBadge').innerText(),'10点満点');
  const after=await score();
  assert.deepEqual(after.map(x=>x.value),sample.map(String));
  assert.deepEqual(after.map(x=>x.grade),['heat-a','heat-a','heat-c','heat-e']);
  assert.deepEqual(after.map(x=>x.color),
    ['rgb(64, 101, 90)','rgb(64, 101, 90)','rgb(54, 82, 120)','rgb(40, 52, 73)']);
  const active=await home.locator('body').evaluate(()=>window.__statsMakerGetActiveSheet());
  assert.equal(active.scale,10);
  assert.deepEqual(active.rows[0].scores.slice(0,4).map(Number),sample);
  await page.waitForTimeout(900);
  await page.reload({waitUntil:'domcontentloaded'});
  await home.locator('#scoreTable .scoreInput').first().waitFor({state:'visible'});
  const persisted=await home.locator('body').evaluate(async()=>{
    for(let i=0;i<100;i++){
      if(typeof window.__statsMakerGetActiveSheet==='function')
        return window.__statsMakerGetActiveSheet();
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('Saved sheet failed to restore after reload');
  });
  assert.equal(persisted.scale,10);
  assert.deepEqual(persisted.rows[0].scores.slice(0,4).map(Number),sample);
  assert.deepEqual((await score()).map(x=>x.grade),['heat-a','heat-a','heat-c','heat-e']);
  assert.equal(realRequests.length,0,'Test unexpectedly reached the production database');
  console.log('R38 P6 PASS: 8/100 is low-grade; explicit 8/10 rebase preserves numbers, colors and reload; no DB writes',
    process.env.BROWSER_ENGINE||'chromium');
}finally{await browser.close()}
