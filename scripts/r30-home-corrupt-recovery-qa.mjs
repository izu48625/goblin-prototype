import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE=process.env.BASE_URL||'https://statsmaker.app';
const KEY='statsMakerV014Library';
const DAMAGED='statsMakerV014UnreadableRawBackup';
const RAW='{"sheets":[INVALID-R30-RECOVERY-FIXTURE]}';

// The production smoke may begin while Cloudflare is still deploying the
// new content-only release. Detect the expected frontend cache-bust marker.
let deployed=false;
for(let i=0;i<30;i++){
  try{
    const response=await fetch(BASE+'/index.html?qaR30Deploy='+Date.now(),
      {cache:'no-store'});
    if(response.ok && /base\/index\.html\?v=(?:r30guard1|r33analytics1|r36input1|r37score1)/.test(await response.text())){
      deployed=true;break;
    }
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,3000));
}
assert(deployed,'R30 Home guard assets have not yet reached production');

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},locale:'ja-JP'
  });
  await context.addInitScript(raw=>{
    if(!sessionStorage.getItem('r30:seeded-corrupt')){
      localStorage.setItem('statsMakerV014Library',raw);
      sessionStorage.setItem('r30:seeded-corrupt','1');
    }
  },RAW);
  const page=await context.newPage();
  const errors=[];
  const dialogs=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
  await page.goto(BASE+'/index.html?qa=r30-corrupt-home',
    {waitUntil:'domcontentloaded',timeout:60000});
  const home=page.frameLocator('#basicFrame');
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  await home.locator('#statusText').filter({hasText:'以前の保存データを読み取れません'})
    .waitFor({timeout:15000});
  const bridge=await home.locator('body').evaluate(()=>
    window.__statsMakerCanPersist?.());
  assert.equal(bridge,false,'Home did not block persistence after corrupt read');
  await home.locator('#titleInput').fill('Do not overwrite raw backup');
  await home.locator('#titleInput').press('Tab');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),RAW,
    'Home autosave silently overwrote unreadable library');

  // Navigating through the extension launcher used to bypass Home autosave
  // and commit the blank in-memory library to storage.
  await page.locator('#extLauncher').click();
  await page.locator('#extGroups .extCard').first().waitFor({state:'visible'});
  await page.locator('#extGroups .extCard').first().click();
  // With an unreadable source library, opening a chart may be blocked by
  // the editor rather than navigating. Either outcome is safe as long as
  // the original Home bytes remain untouched.
  await page.waitForTimeout(650);
  console.log('R30 extension attempt:',JSON.stringify({
    path:new URL(page.url()).pathname,
    dialogs:dialogs.slice(-2)
  }));
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),RAW,
    'Extension navigation bypassed recovery guard');
  await page.goto(BASE+'/index.html?qa=r30-restore',{waitUntil:'domcontentloaded'});
  await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
  // Visible HTML can precede the module registering click handlers. Do not
  // operate the More/Restore tray until the actual Home runtime is ready.
  const recoveryBridge=await home.locator('body').evaluate(async()=>{
    for(let i=0;i<150;i++){
      if(typeof window.__statsMakerCanPersist==='function' &&
         typeof window.__statsMakerGetLibrary==='function')
        return window.__statsMakerCanPersist();
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Home runtime was not ready for explicit restore');
  });
  assert.equal(recoveryBridge,false,'Restored page did not retain corrupt-storage guard');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),RAW,
    'Home reload overwrote unreadable bytes before user restore');

  // Deliberate, valid user backup import is allowed, but must first preserve
  // the exact unreadable raw text in a distinct recovery key.
  const restored={activeId:'r30-restored',sheets:[{
    id:'r30-restored',title:'RECOVERED FROM KNOWN GOOD BACKUP',
    cols:['Score'],rows:[{name:'Preserved user',scores:[92],note:'',image:''}],
    weights:[1],weighted:false,scale:100
  }]};
  // "More" toggles the utility tray. Depending on restore state and
  // browser navigation the tray may already be expanded: never click to
  // inadvertently close it before attempting Restore.
  const tray=home.locator('#utilityBar');
  if(!(await tray.isVisible()))await home.locator('#moreToolsBtn').click();
  await tray.waitFor({state:'visible',timeout:15000});
  const restore=home.locator('#importJsonBtn');
  // Do not fail on an instantaneous isVisible() read while Safari/Chromium
  // finishes layout; wait for the actual clickable UI with a strict timeout.
  try{
    await restore.waitFor({state:'visible',timeout:10000});
  }catch(error){
    const diag=await home.locator('body').evaluate(()=>{
      const btn=document.getElementById('importJsonBtn');
      const bar=document.getElementById('utilityBar');
      const tools=document.getElementById('moreToolsBtn');
      const css=el=>el?({
        className:el.className,
        display:getComputedStyle(el).display,
        visibility:getComputedStyle(el).visibility,
        rect:[el.getBoundingClientRect().width,el.getBoundingClientRect().height]
      }):null;
      return {bodyClass:document.body.className,toolbar:css(bar),
        restore:css(btn),moreButton:css(tools),
        bridge:window.__statsMakerCanPersist?.(),
        activeTitle:document.getElementById('titleInput')?.value};
    });
    throw new Error('Restore button did not become visible: '+JSON.stringify(diag),{cause:error});
  }
  await restore.click();
  await home.locator('#importFileInput').setInputFiles({
    name:'r30-good.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({app:'Stats Maker',library:restored}))
  });
  await home.locator('#titleInput').evaluate(async input=>{
    for(let i=0;i<70;i++){
      if(input.value==='RECOVERED FROM KNOWN GOOD BACKUP')return;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw new Error('Explicit valid import did not recover the damaged library');
  });
  const result=await page.evaluate(([key,damaged])=>({
    recovered:JSON.parse(localStorage.getItem(key)),
    raw:localStorage.getItem(damaged)
  }),[KEY,DAMAGED]);
  assert.equal(result.raw,RAW,'The damaged original bytes were not preserved');
  assert.equal(result.recovered.activeId,'r30-restored');
  assert.equal(result.recovered.sheets[0].rows[0].scores[0],92);
  assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError/.test(e)),[],
    'Unexpected runtime failures during recovery path');
  console.log('R30 Home corrupted storage PASS: autosave and launcher blocked; raw preserved; manual restore verified');
}finally{
  await browser.close();
}
