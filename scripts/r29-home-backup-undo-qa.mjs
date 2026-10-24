import {clickBasic} from './r80-qa-click.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE=process.env.BASE_URL||'https://statsmaker.app';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  const page=await context.newPage();
  page.on('dialog',dialog=>dialog.accept());
  await page.goto(BASE+'/index.html?qa=r29-home-undo',{waitUntil:'domcontentloaded',timeout:60000});
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  // The input can be visible before the Home module binds autosave events.
  // Wait for the exported bridge rather than racing first-run initialization.
  const ready=await home.locator('body').evaluate(async()=>{
    for(let i=0;i<100;i++){
      if(typeof window.__statsMakerGetLibrary==='function' &&
         typeof window.__statsMakerCanPersist==='function'){
        return window.__statsMakerCanPersist();
      }
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Home runtime did not initialize before backup QA input');
  });
  assert.equal(ready,true,'Empty isolated Home unexpectedly blocked first-run saves');
  await home.locator('#titleInput').fill('PRECIOUS OLD SHEET');
  await home.locator('.nameInput').first().fill('Keep me');
  await home.locator('.nameInput').first().press('Tab');
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<80;i++){
      const library=JSON.parse(localStorage.getItem('statsMakerV014Library')||'null');
      if(library?.sheets?.some(s=>s.title==='PRECIOUS OLD SHEET'))return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Test source sheet did not autosave');
  });
  const baseline=await home.locator('body').evaluate(()=>
    JSON.parse(localStorage.getItem('statsMakerV014Library')));
  const originalId=baseline.activeId;
  await clickBasic(home,'moreToolsBtn');
  await home.locator('#importJsonBtn').click();
  assert(await home.locator('#undoLastRestoreBtn').isHidden(),
    'Undo restore should be unavailable before first import');
  await home.locator('#importFileInput').setInputFiles({
    name:'corrupt-backup.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({library:{sheets:[{id:'bad',cols:['Name'],
      rows:[{name:'Oops',scores:[{bogus:true}]}]}]}}))
  });
  await home.locator('#statusText').filter({hasText:'読み込めません'}).waitFor({timeout:10000});
  const unchanged=await home.locator('body').evaluate(()=>({
    library:JSON.parse(localStorage.getItem('statsMakerV014Library')),
    recovery:localStorage.getItem('statsMakerV014PreRestoreBackup')
  }));
  assert.deepEqual(unchanged.library,baseline,'Corrupt import altered original sheets');
  assert.equal(unchanged.recovery,null,'Corrupt import unexpectedly stored a recovery checkpoint');
  const imported={activeId:'imported',sheets:[{
    id:'imported',title:'NEW RESTORED SHEET',desc:'Replaced safely',
    cols:['Metric 1'],rows:[{name:'New person',note:'',image:'',scores:[88]}],
    weighted:false,weights:[1],scale:100,updatedAt:Date.now()
  }]};
  await home.locator('#importFileInput').setInputFiles({
    name:'good-backup.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({app:'Stats Maker',version:'1.0-A2',library:imported}))
  });
  await home.locator('#titleInput').waitFor({state:'visible',timeout:10000});
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<70;i++){
      if(document.querySelector('#titleInput')?.value==='NEW RESTORED SHEET')return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Valid restored Home sheet was not displayed');
  });
  const archive=await home.locator('body').evaluate(()=>{
    const original=JSON.parse(localStorage.getItem('statsMakerV014PreRestoreBackup')||'null');
    return original?.sheets?.find(s=>s.title==='PRECIOUS OLD SHEET');
  });
  assert(archive?.id===originalId,'Import failed to checkpoint original sheet ID');
  if(!(await home.locator('#importJsonBtn').isVisible()))
    await home.locator('#moreToolsBtn').click();
  await home.locator('#importJsonBtn').click();
  await home.locator('#undoLastRestoreBtn').waitFor({state:'visible',timeout:10000});
  await home.locator('#undoLastRestoreBtn').click();
  await home.locator('body').evaluate(async()=>{
    for(let i=0;i<70;i++){
      if(document.querySelector('#titleInput')?.value==='PRECIOUS OLD SHEET')return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Undo restore did not bring back the original Home sheet');
  });
  const after=await home.locator('body').evaluate(()=>({
    lib:JSON.parse(localStorage.getItem('statsMakerV014Library')),
    checkpoint:JSON.parse(localStorage.getItem('statsMakerV014PreRestoreBackup'))
  }));
  assert.equal(after.lib.activeId,originalId,'Undo restore lost original active sheet ID');
  assert(after.lib.sheets.some(s=>s.title==='PRECIOUS OLD SHEET'),'Undo restore lost original sheet');
  assert(after.checkpoint.sheets.some(s=>s.title==='NEW RESTORED SHEET'),
    'Undo should preserve the replaced import for possible redo');
  console.log('R29 Home library backup safety PASS: invalid rejected; original checkpointed; restore; undo preserves original ID');
}finally{await browser.close()}
