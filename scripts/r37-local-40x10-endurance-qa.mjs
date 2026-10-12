import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// R37: browser-local endurance testing. It never submits a public topic,
// authenticates to Supabase, or mutates data outside this temporary context.
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const KEY='statsMakerV014Library';
const BACKUP='statsMakerV014PreRestoreBackup';
const browser=await chromium.launch({headless:true});
const outcomes=[];
try{
  for(const scale of [100,10]){
    const name='R37 PRECIOUS '+scale+' MAX 40x10';
    const source={
      id:'r37-max-'+scale,title:name,desc:'Private local QA, do not publish',
      cols:Array.from({length:10},(_,i)=>'Metric '+(i+1)),
      rows:Array.from({length:40},(_,r)=>({
        name:'Subject '+String(r+1).padStart(2,'0'),image:'',note:'note '+r,
        scores:Array.from({length:10},(_,c)=>
          scale===10?Math.round(((r*7+c*11)%101)/10)*1/1:(r*7+c*11)%101)
      })),
      weights:Array(10).fill(1),scale,rankMetric:'avg',compare:[],
      weighted:false,fitMode:'auto',fitZoom:1,viewMode:'sheet',
      updatedAt:Date.now()
    };
    const spare={id:'r37-spare-'+scale,title:'SECOND SHEET — KEEP',desc:'',
      cols:['One'],rows:[{name:'Other sheet',image:'',note:'',scores:[42]}],
      weights:[1],scale:100,weighted:false,updatedAt:Date.now()};
    const initial={activeId:source.id,sheets:[source,spare]};
    const ctx=await browser.newContext({viewport:{width:390,height:844},
      isMobile:true,hasTouch:true,locale:'ja-JP'});
    await ctx.addInitScript(({key,seed})=>{
      if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(seed));
    },{key:KEY,seed:initial});
    const remote=[];
    await ctx.route('**/*.supabase.co/**',async route=>{
      if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))remote.push(route.request().url());
      await route.abort();
    });
    const page=await ctx.newPage();
    page.on('dialog',d=>d.accept());
    const start=Date.now();
    await page.goto(BASE+'/index.html?qa=r37-local-'+scale,
      {waitUntil:'domcontentloaded',timeout:30000});
    const home=page.frameLocator('#basicFrame');
    await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    const runtime=await home.locator('body').evaluate(async()=>{
      for(let i=0;i<120;i++){
        if(typeof window.__statsMakerGetLibrary==='function'&&
           typeof window.__statsMakerCanPersist==='function')
          return {persist:window.__statsMakerCanPersist(),name:document.querySelector('#titleInput')?.value};
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw new Error('R37 Home runtime not ready');
    });
    assert.equal(runtime.persist,true,'R37 local source unexpectedly blocked writes');
    assert.equal(runtime.name,name,'R37 saved source sheet did not load');
    assert.equal(await home.locator('#scoreTable .scoreInput').count(),400,
      '40x10 sheet did not render 400 score fields');
    const renderedMs=Date.now()-start;
    assert(renderedMs<60000,'40x10 sheet took over 60 seconds to initialize');
    const snapshot=()=>home.locator('body').evaluate(key=>{
      const d=JSON.parse(localStorage.getItem(key));
      return {library:d,raw:localStorage.getItem(key)};
    },KEY);
    const original=await snapshot();
    assert.deepEqual(original.library.sheets[0].rows[39].scores,
      source.rows[39].scores,'last row changed during initial render');
    assert.equal(original.library.sheets.length,2);

    // Burst of 20 distinct keyboard edits, with swaps and reloads. Values
    // must still survive the asynchronous 220ms save debounce.
    let edits=0;
    for(let n=0;n<20;n++){
      const ri=n%40,ci=n%10;
      const val=scale===100?(n*3+25)%101:Number(((n*7+15)%101/10).toFixed(1));
      await home.locator(`#scoreTable .scoreInput[data-score-row="${ri}"][data-score-col="${ci}"]`).fill(String(val));
      source.rows[ri].scores[ci]=val;edits++;
      if(n%5===4){
        await home.locator('#titleInput').click();
        await home.locator('body').evaluate(async key=>{
          for(let i=0;i<60;i++){
            const d=JSON.parse(localStorage.getItem(key)||'null');
            if(d?.sheets?.[0]?.rows?.[4]?.scores) {
              await new Promise(resolve=>setTimeout(resolve,260));return;
            }
            await new Promise(resolve=>setTimeout(resolve,100));
          }
        },KEY);
      }
    }
    await home.locator('#titleInput').click();
    await page.waitForTimeout(400);
    let saved=(await snapshot()).library;
    assert.deepEqual(saved.sheets[0].rows.map(r=>r.scores),
      source.rows.map(r=>r.scores),'20 keyboard edits were not fully persisted');
    assert.equal(saved.sheets.length,2,'Autosave lost the second sheet');
    assert.equal(saved.sheets[1].title,spare.title);
    // Switch sheets repeatedly without mutating their identities.
    for(let n=0;n<12;n++){
      await home.locator('#sheetSelect').selectOption(n%2===0?spare.id:source.id);
      assert.equal(await home.locator('#titleInput').inputValue(),n%2===0?spare.title:name);
    }
    await page.waitForTimeout(400);
    await page.reload({waitUntil:'domcontentloaded'});
    await home.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    assert.equal(await home.locator('#scoreTable .scoreInput').count(),400);
    saved=(await snapshot()).library;
    assert.deepEqual(saved.sheets[0].rows.map(r=>r.scores),
      source.rows.map(r=>r.scores),'Reload damaged persisted 40x10 scores');
    assert.equal(saved.sheets[1].title,spare.title);
    const checkpoint=structuredClone(saved);
    const imported=structuredClone(saved);
    imported.sheets[0].title='RESTORED '+name;
    imported.sheets[0].rows[39].scores[9]=scale===100?99:9.9;
    const importButton=home.locator('#importJsonBtn');
    if(!(await importButton.isVisible()))await home.locator('#moreToolsBtn').click();
    await importButton.click();
    await home.locator('#importFileInput').setInputFiles({
      name:'r37-backup.json',mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify({app:'Stats Maker',version:'1.0-A2',library:imported}))
    });
    await home.locator('body').evaluate(async expected=>{
      for(let i=0;i<80;i++){
        if(document.querySelector('#titleInput')?.value===expected)return;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw Error('R37 40x10 restore not reflected in UI');
    },imported.sheets[0].title);
    let after=await snapshot();
    assert.equal(after.library.sheets[0].rows[39].scores[9],scale===100?99:9.9);
    assert.deepEqual(JSON.parse(await home.locator('body').evaluate(key=>localStorage.getItem(key),BACKUP)),
      checkpoint,'Restore did not preserve exact previous multi-sheet checkpoint');
    // Undo is an explicit user action. Confirm that all 400 data cells AND
    // the other sheet return, not just the heading.
    if(!(await importButton.isVisible()))await home.locator('#moreToolsBtn').click();
    await importButton.click();
    await home.locator('#undoLastRestoreBtn').waitFor({state:'visible',timeout:10000});
    await home.locator('#undoLastRestoreBtn').click();
    await home.locator('body').evaluate(async expected=>{
      for(let i=0;i<80;i++){
        if(document.querySelector('#titleInput')?.value===expected)return;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw Error('Undo restore did not return to the original sheet');
    },name);
    after=await snapshot();
    assert.deepEqual(after.library.sheets[0].rows.map(r=>r.scores),
      source.rows.map(r=>r.scores),'Undo restore failed to recover all original scores');
    assert.equal(after.library.sheets[1].title,spare.title);
    assert.deepEqual(remote,[],'Local-only endurance QA unexpectedly contacted Supabase');
    const elapsed=Date.now()-start;
    outcomes.push({scale,rows:40,criteria:10,edits,swaps:12,
      restored:after.library.sheets.length,initialMs:renderedMs,totalMs:elapsed});
    console.log('R37 local 40x10 endurance PASS: '+JSON.stringify(outcomes.at(-1)));
    await ctx.close();
  }
  console.log('R37 P1 Local-first data integrity, 40x10 / 100 and 10 scale PASS');
}finally{await browser.close()}
