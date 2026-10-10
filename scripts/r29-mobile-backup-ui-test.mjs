import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';

const BASE=process.env.BASE_URL||'https://statsmaker.app';
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},locale:'ja-JP',acceptDownloads:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  await page.goto(BASE+'/index.html?qa=r29backup',{waitUntil:'domcontentloaded',timeout:60000});
  const id=await page.evaluate(async()=>{
    const [{createProject},{saveProject}]=await Promise.all([
      import('/app/src/core/project.js'),import('/app/src/core/store.js')
    ]);
    const p=createProject('bar');
    p.meta.title='R29 ORIGINAL KEEP';
    saveProject(p);
    return p.id;
  });
  await page.goto(BASE+'/app/editor.html?id='+encodeURIComponent(id),
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#projectTitleInput')?.value==='R29 ORIGINAL KEEP',
    null,{timeout:30000});
  assert(await page.locator('#moreBtn').isVisible(),'iPhone More menu is not visible');
  assert(await page.locator('#moreBtn').isEnabled(),'iPhone More menu disabled');
  assert(await page.locator('.globalLocaleBar').isVisible(),'Shared JA/EN bar missing');

  await page.locator('#moreBtn').click();
  assert(await page.locator('#backupBtn').isVisible(),'Project JSON export option unavailable on iPhone');
  assert(await page.locator('#restoreBtn').isVisible(),'Project JSON restore option unavailable on iPhone');

  const menu=await page.locator('#moreMenu').boundingBox();
  const header=await page.locator('.editor-header').boundingBox();
  assert(menu&&header&&menu.y>=header.y+header.height-3,
    'Backup menu overlaps sticky HOME/locale and editor header');

  const downloading=page.waitForEvent('download',{timeout:30000});
  await page.locator('#backupBtn').click();
  const download=await downloading;
  assert(download.suggestedFilename().endsWith('.statsmaker.json'),
    'Export file does not use the Stats Maker JSON extension');
  const exportFile=JSON.parse((await readFile(await download.path())).toString('utf8'));
  assert.equal(exportFile.id,id,'Exported project identity changed');
  assert.equal(exportFile.meta.title,'R29 ORIGINAL KEEP');
  assert.equal(exportFile.type,'bar');

  const alerts=[];
  page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.dismiss()});
  await page.locator('#moreBtn').click();
  const invalidChooser=page.waitForEvent('filechooser',{timeout:15000});
  await page.locator('#restoreBtn').click();
  const invalid=await invalidChooser;
  await invalid.setFiles({
    name:'invalid.statsmaker.json',mimeType:'application/json',
    buffer:Buffer.from('{"type":"bar","meta":{"title":"CORRUPTED"}}')
  });
  await page.waitForFunction(()=>window.__r29DialogSeen===true,
    null,{timeout:500}).catch(()=>{});
  await page.waitForTimeout(300);
  assert(alerts.length>=1,'Corrupted backup did not show an error');
  let stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').find(p=>p.id===id),id);
  assert.equal(stored.meta.title,'R29 ORIGINAL KEEP','Corrupt import modified saved project');
  assert.equal(await page.locator('#projectTitleInput').inputValue(),'R29 ORIGINAL KEEP');

  const restored={...exportFile,
    id:'FAKE-BACKUP-IDENTITY',
    meta:{...exportFile.meta,title:'R29 RESTORED VALID'}};
  await page.locator('#moreBtn').click();
  const validChooser=page.waitForEvent('filechooser',{timeout:15000});
  await page.locator('#restoreBtn').click();
  await (await validChooser).setFiles({
    name:'valid.statsmaker.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(restored))
  });
  await page.waitForFunction(()=>document.querySelector('#projectTitleInput')?.value==='R29 RESTORED VALID',
    null,{timeout:15000});
  await page.waitForFunction(id=>{
    const p=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').find(x=>x.id===id);
    return p?.meta.title==='R29 RESTORED VALID';
  },id,{timeout:15000});
  stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]').find(p=>p.id===id),id);
  assert.equal(stored.id,id,'Restore changed project identity');
  assert.equal(stored.meta.title,'R29 RESTORED VALID');
  assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]'))).length,1,
    'Restore duplicated the active project');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.querySelector('#projectTitleInput')?.value==='R29 RESTORED VALID',
    null,{timeout:30000});
  console.log('R29 iPhone backup UI PASS: More visible; project JSON download; corrupt reject; valid restore; same ID after reload');
}finally{
  await browser.close();
}
