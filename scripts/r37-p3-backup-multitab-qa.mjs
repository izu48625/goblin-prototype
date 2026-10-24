import {clickBasic} from './r80-qa-click.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// All storage and editing stay in a disposable browser context. Never sign
// into Supabase, publish a topic, submit Community scores or delete live data.
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const KEY='statsMakerV014Library';
const PRE='statsMakerV014PreRestoreBackup';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4BfWQAAAAASUVORK5CYII=';
const main={
  id:'r37-p3-max',title:'R37 P3 ORIGINAL 大容量',desc:'日本語 and English '.repeat(200),
  cols:Array.from({length:10},(_,i)=>'Criterion '+i),
  rows:Array.from({length:40},(_,r)=>({
    name:'Subject '+r+' の評価',note:'Detailed notes '.repeat(50)+r,
    image:r%4===0?image:'',scores:Array.from({length:10},(_,c)=>(r*11+c*7)%101)
  })),
  weights:Array(10).fill(1),weighted:false,scale:100,
  rankMetric:'avg',compare:[],updatedAt:Date.now()
};
const spare={
  id:'r37-p3-other',title:'SECOND SHEET — KEEP',desc:'Do not erase',
  cols:['M'],rows:[{name:'Spare person',note:'',image,scores:[77]}],
  weights:[1],scale:100,weighted:false,updatedAt:Date.now()
};
const seed={activeId:main.id,sheets:[main,spare]};
const older={activeId:'earlier',sheets:[{
  ...structuredClone(spare),id:'earlier',title:'OLDER RECOVERY POINT'
}]};
const browser=await chromium.launch({headless:true});
const remote=[];
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,
    locale:'ja-JP',acceptDownloads:true
  });
  await context.addInitScript(({key,pre,seed,older})=>{
    if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(seed));
    if(localStorage.getItem(pre)===null)localStorage.setItem(pre,JSON.stringify(older));
  },{key:KEY,pre:PRE,seed,older});
  await context.route('**/*.supabase.co/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))
      remote.push(route.request().url());
    return route.abort();
  });
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(BASE+'/index.html?qa=r37p3safe',{waitUntil:'domcontentloaded'});
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<100;i++){
      if(typeof window.__statsMakerCanPersist==='function')return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('HOME save bridge missing');
  });
  assert.equal(await home.locator('#scoreTable .scoreInput').count(),400);
  assert.equal(await home.locator('body').evaluate(()=>window.__statsMakerCanPersist()),true);

  // 100 keyboard edits plus repeated sheet swaps without destroying the
  // second sheet. Values must survive debounce and a full reload.
  for(let i=0;i<100;i++){
    const r=i%40,c=Math.floor(i/10)%10;
    const value=(i*13+7)%101;
    await home.locator(`#scoreTable .scoreInput[data-score-row="${r}"][data-score-col="${c}"]`).fill(String(value));
    main.rows[r].scores[c]=value;
  }
  await home.locator('#titleInput').click();
  for(let i=0;i<16;i++){
    await home.locator('#sheetSelect').selectOption(i%2===0?spare.id:main.id);
  }
  await page.waitForTimeout(550);
  const beforeReload=await home.locator('body').evaluate((body,key)=>({
    raw:localStorage.getItem(key),writable:window.__statsMakerCanPersist?.(),
    title:window.__statsMakerGetLibrary?.()?.sheets?.[0]?.title
  }),KEY);
  assert(beforeReload.raw,'100 edits unexpectedly removed the stored library');
  assert.equal(beforeReload.writable,true,'HOME autosave was unexpectedly blocked before reload');
  await page.reload({waitUntil:'domcontentloaded'});
  await home.locator('#scoreTable .scoreInput').first().waitFor({state:'visible',timeout:30000});
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<100;i++){
      if(document.querySelectorAll('#scoreTable .scoreInput').length===400 &&
         typeof window.__statsMakerGetLibrary==='function')return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('400 persisted score fields did not restore');
  });
  let persisted=await home.locator('body').evaluate((body,key)=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.deepEqual(persisted.sheets[0].rows.map(r=>r.scores),main.rows.map(r=>r.scores));
  assert.equal(persisted.sheets.length,2);
  assert.equal(persisted.sheets[1].title,spare.title);
  assert.equal(persisted.sheets[0].rows[0].image,image);
  assert.equal(persisted.sheets[0].desc,main.desc);

  // A real JSON export must include both sheets, large text and embedded images.
  let exportBtn=home.locator('#exportJsonBtn');
  if(!(await exportBtn.isVisible()))await clickBasic(home,'moreToolsBtn');
  const [download]=await Promise.all([page.waitForEvent('download'),exportBtn.click()]);
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(exported.library.sheets.length,2);
  assert.equal(exported.library.sheets[0].rows[0].image,image);
  assert.deepEqual(exported.library.sheets[0].rows.map(r=>r.scores),
    main.rows.map(r=>r.scores));

  // Restoring a valid JSON file preserves every row, image and the prior Undo.
  const importBtn=home.locator('#importJsonBtn');
  if(!(await importBtn.isVisible()))await clickBasic(home,'moreToolsBtn');
  await importBtn.click();
  await home.locator('#importFileInput').setInputFiles({
    name:'r37p3.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(exported))
  });
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<80;i++){
      if(JSON.parse(localStorage.getItem('statsMakerV014PreRestoreBackup')||'null')
          ?.sheets?.[0]?.rows?.length===40)return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('Import checkpoint missing');
  });
  persisted=await home.locator('body').evaluate((body,key)=>JSON.parse(localStorage.getItem(key)),KEY);
  assert.equal(persisted.sheets[0].rows[0].image,image);
  assert.equal(persisted.sheets[0].rows.length,40);

  // Inject a quota error ONLY for the target Home key in this iframe. When
  // the second write fails, both the main bytes AND the earlier Undo
  // checkpoint must remain byte-for-byte unchanged.
  const before=await home.locator('body').evaluate((body,{key,pre})=>({
    main:localStorage.getItem(key),undo:localStorage.getItem(pre)
  }),{key:KEY,pre:PRE});
  await home.locator('body').evaluate(()=>{
    window.__r37p3OriginalSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,val){
      if(key==='statsMakerV014Library')
        throw new DOMException('Quota reached','QuotaExceededError');
      return window.__r37p3OriginalSetItem.call(this,key,val);
    };
  });
  const alternative=structuredClone(exported);
  alternative.library.sheets[0].title='THIS RESTORE MUST FAIL';
  if(!(await importBtn.isVisible()))await clickBasic(home,'moreToolsBtn');
  await importBtn.click();
  await home.locator('#importFileInput').setInputFiles({
    name:'quota.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(alternative))
  });
  await home.locator('#statusText').filter({hasText:'保存容量が不足'}).waitFor({timeout:12000});
  const after=await home.locator('body').evaluate((body,{key,pre})=>({
    main:localStorage.getItem(key),undo:localStorage.getItem(pre)
  }),{key:KEY,pre:PRE});
  assert.deepEqual(after,before,'Failed backup import changed main or previous Undo data');
  await home.locator('body').evaluate(()=>{
    Storage.prototype.setItem=window.__r37p3OriginalSetItem;
  });

  // Invalid JSON cannot mutate the current library or checkpoint either.
  await home.locator('#importFileInput').setInputFiles({
    name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{oops!')
  });
  await home.locator('#statusText').filter({hasText:'読み込めません'}).waitFor({timeout:12000});
  assert.deepEqual(await home.locator('body').evaluate((body,{key,pre})=>({
    main:localStorage.getItem(key),undo:localStorage.getItem(pre)
  }),{key:KEY,pre:PRE}),before);

  // Two open tabs: A commits a newer title. B's stale in-memory copy must
  // never be allowed to erase it, even after B edits its own field.
  const pageB=await context.newPage();
  pageB.on('dialog',dialog=>dialog.accept());
  await pageB.goto(BASE+'/index.html?qa=r37p3-tab-b',{waitUntil:'domcontentloaded'});
  const homeB=pageB.frameLocator('#basicFrame');
  await homeB.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  await homeB.locator('body').evaluate(async()=>{
    for(let i=0;i<100;i++){
      if(typeof window.__statsMakerCanPersist==='function')return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('Second tab bridge missing');
  });
  await home.locator('#titleInput').fill('NEWER TAB A — KEEP');
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<80;i++){
      const lib=JSON.parse(localStorage.getItem('statsMakerV014Library')||'null');
      if(lib?.sheets?.[0]?.title==='NEWER TAB A — KEEP')return;
      await new Promise(r=>setTimeout(r,100));
    }
    throw Error('First tab failed to commit its title');
  });
  await homeB.locator('#titleInput').fill('STALE TAB B — DO NOT OVERWRITE');
  await pageB.waitForTimeout(650);
  const crossTab=await homeB.locator('body').evaluate(()=>({
    title:JSON.parse(localStorage.getItem('statsMakerV014Library')).sheets[0].title,
    pending:window.__statsMakerGetLibrary().sheets[0].title,
    canPersist:window.__statsMakerCanPersist(),
    warning:document.querySelector('#statusText')?.textContent
  }));
  assert.equal(crossTab.title,'NEWER TAB A — KEEP');
  assert.equal(crossTab.pending,'STALE TAB B — DO NOT OVERWRITE');
  assert.equal(crossTab.canPersist,false);
  assert.match(crossTab.warning,/別のタブ/);
  assert.deepEqual(remote,[],'Test unexpectedly attempted a Supabase write');
  console.log('R37 P3 PASS: 40x10, 100 edits, 16 swaps, images, JSON export/import, quota rollback, invalid JSON, multi-tab stale write blocked');
  await context.close();
}finally{
  await browser.close();
}
