import {clickBasic} from './r80-qa-click.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Run against local compiled assets only. Test projects remain in temporary
// Chromium storage; never send ratings, works or inquiries to production.
const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const sizes=[{width:320,height:568},{width:390,height:560},{width:390,height:844},{width:430,height:932}];
const checks=['#titleInput','#descInput','#sheetSelect','#searchInput',
  '#scoreTable .nameInput','#scoreTable .scoreInput','#noteTextarea'];
try{
  for(const size of sizes){
    const context=await browser.newContext({
      viewport:size,isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:'ja-JP',
      userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(BASE+'/index.html?qa=r36p2',{waitUntil:'domcontentloaded',timeout:30000});
    const home=page.frameLocator('#basicFrame');
    await home.locator('#titleInput').waitFor({state:'visible',timeout:20000});
    await home.locator('body').evaluate(async()=>{
      for(let i=0;i<100;i++){
        if(typeof window.__statsMakerGetActiveSheet==='function')return;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw new Error('Home not ready');
    });
    const fonts=await home.locator('body').evaluate((body,selectors)=>Object.fromEntries(
      selectors.map(selector=>{
        const el=document.querySelector(selector);
        return [selector,el?parseFloat(getComputedStyle(el).fontSize):null];
      })),checks);
    for(const [selector,value] of Object.entries(fonts))
      assert(value>=16,selector+' iPhone editable text zoom risk: '+value+'px at '+size.width);

    const geometry=await home.locator('body').evaluate(()=>{
      const rect=id=>{const e=document.querySelector(id),r=e?.getBoundingClientRect();
        return r?{height:r.height,width:r.width}:null};
      return {overflow:document.documentElement.scrollWidth-innerWidth,
        tools:rect('#r80OptionsBtn'),score:rect('#scoreTable .scoreInput'),
        search:rect('#r80SearchBtn')};
    });
    assert(geometry.overflow<=2,'Home horizontal page overflow at '+size.width+': '+geometry.overflow);
    assert(geometry.tools.height>=40,'More action touch target too small');
    assert(geometry.search.height>=40,'Search touch target too small');
    // Focus/blur and a local-only edit must preserve data without scrolling the
    // outer shell horizontally or changing any other stored sheet.
    await home.locator('#titleInput').fill('R36 MOBILE LOCAL QA');
    await home.locator('#descInput').fill('short-viewport check');
    const score=home.locator('#scoreTable .scoreInput').first();
    await score.fill('81');await score.press('Tab');
    assert.equal(await home.locator('body').evaluate(()=>
      window.__statsMakerGetActiveSheet()?.rows?.[0]?.scores?.[0]),81);
    const tray=home.locator('#utilityBar');
    if(!(await tray.isVisible()))await clickBasic(home,'moreToolsBtn');
    await tray.waitFor({state:'visible'});
    const utility=await home.locator('#importJsonBtn').evaluate(e=>({
      height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)
    }));
    assert(utility.height>=40&&utility.font>=12,'Import action too small on iPhone');
    await home.locator('#importJsonBtn').click();
    await home.locator('#importBackdrop:not(.hidden)').waitFor({state:'visible'});
    await modal('importBackdrop','importDialog');
    await home.locator('#importCancelBtn').click();

    // Export and Publish overlays may be inspected in DOM without invoking
    // file sharing, authentication or real Supabase network calls.
    for(const [backdrop,dialog] of [
      ['sharePreviewBackdrop','sharePreviewDialog'],
      ['publishDialogBackdrop','publishDialog'],
      ['noteDialogBackdrop','noteDialog'],
      ['weightDialogBackdrop','weightDialog']
    ]){
      await home.locator('#'+backdrop).evaluate(el=>el.classList.remove('hidden'));
      await modal(backdrop,dialog);
      if(backdrop==='sharePreviewBackdrop'){
        const action=home.locator('#sharePreviewSaveBtn');
        assert((await action.evaluate(e=>e.getBoundingClientRect().height))>=44);
      }
      await home.locator('#'+backdrop).evaluate(el=>el.classList.add('hidden'));
    }
    async function modal(backdrop,dialog){
      const result=await home.locator('#'+backdrop).evaluate((el,name)=>{
        const panel=el.querySelector('.'+name);
        const r=panel.getBoundingClientRect(),height=innerHeight;
        return {height:r.height,top:r.top,bottom:r.bottom,viewportHeight:height,
          overflowY:getComputedStyle(panel).overflowY,
          scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight};
      },dialog);
      assert(result.height<=result.viewportHeight-14,
        dialog+' clips in short viewport: '+JSON.stringify(result));
      assert(result.top>=-2&&result.bottom<=result.viewportHeight+2,
        dialog+' escaped viewport: '+JSON.stringify(result));
      assert(['auto','scroll'].includes(result.overflowY),
        dialog+' content cannot scroll if keyboard shortens viewport');
    }
    // The entire QA uses non-published, browser-local data.
    assert.deepEqual(errors.filter(e=>/SyntaxError|ReferenceError/.test(e)),[]);
    await context.close();
    console.log('PASS R36 P2 iPhone viewport '+size.width+'x'+size.height+
      ': keyboard-safe text, touch controls, scrollable dialogs, local score');
  }
  console.log('R36 P2 mobile Home input/modal QA PASS');
}finally{await browser.close()}
