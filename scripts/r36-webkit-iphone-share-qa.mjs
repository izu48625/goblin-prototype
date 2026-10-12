import assert from 'node:assert/strict';
import {webkit} from 'playwright';

const BASE=process.env.BASE_URL||'http://127.0.0.1:4173';
const cases=[
  {type:'ranking-card',width:390,height:844},
  {type:'scatter',width:375,height:560},
  {type:'radar',width:390,height:844},
  {type:'stat-card',width:375,height:560}
];
const browser=await webkit.launch({headless:true});
try{
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    isMobile:true,hasTouch:true,deviceScaleFactor:3,locale:'ja-JP',
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });
  await context.addInitScript(()=>{
    window.__r36ShareLog=[];
    Object.defineProperty(navigator,'canShare',{configurable:true,
      value:payload=>Array.isArray(payload?.files)&&payload.files.length===1});
    Object.defineProperty(navigator,'share',{configurable:true,
      value:async payload=>{
        window.__r36ShareLog.push({title:payload.title,
          files:(payload.files||[]).map(f=>({name:f.name,size:f.size,type:f.type}))});
      }});
  });
  const page=await context.newPage();
  const errors=[];
  const notices=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',async dialog=>{notices.push(dialog.message());await dialog.accept()});
  for(const c of cases){
    await page.setViewportSize({width:c.width,height:c.height});
    await page.goto(BASE+'/index.html?qa=r36webkitseed',{waitUntil:'domcontentloaded',timeout:30000});
    const id=await page.evaluate(async type=>{
      const {createProject}=await import('/app/src/core/project.js');
      const {saveProject}=await import('/app/src/core/store.js');
      const project=createProject(type);
      project.meta.title='WebKit iPhone '+type;
      project.meta.subtitle='画像保存の確認';
      if(type==='scatter'){
        project.data.items=Array.from({length:40},(_,i)=>({
          id:'webkitpoint'+i,name:'日本語で長い比較対象'+i,
          x:45+(i%6)*.8,y:63+Math.floor(i/6)*.8,category:'QA',enabled:true
        }));
        project.settings.showLabels=true;
        project.settings.labelLimit=40;
      }
      if(type==='radar'){
        project.data.axes=project.data.axes.map((axis,i)=>({...axis,label:'日本語の能力比較項目'+i}));
      }
      if(type==='stat-card')project.data.name='とても長い日本語の名前を検証します';
      project.canvas={preset:'square',width:1080,height:1080,transparent:false};
      return saveProject(project).id;
    },c.type);
    await page.goto(BASE+'/app/editor.html?id='+encodeURIComponent(id)+'&qa=r36webkit',
      {waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForFunction(()=>document.querySelector('#previewRoot .visual')
      &&document.querySelector('#projectTitleInput')?.value?.startsWith('WebKit iPhone'),
      null,{timeout:30000});
    assert.equal(await page.locator('.globalLocaleBar').count(),1,
      'duplicate shared language/navigation toolbar on iPhone');
    const inputFont=await page.locator('#projectTitleInput').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    assert(inputFont>=16,'iPhone keyboard zoom risk for editor title');

    await page.locator('#exportBtn').click({timeout:15000});
    await page.locator('#exportPreviewModal:not(.hidden)').waitFor({state:'visible',timeout:45000});
    await page.locator('#exportPreviewImage').evaluate(async el=>{
      if(el.complete&&el.naturalWidth)return;
      await new Promise((resolve,reject)=>{
        el.onload=resolve;el.onerror=()=>reject(Error('Exported PNG did not load'));
        setTimeout(()=>reject(Error('Exported PNG timed out')),15000);
      });
    });
    const img=await page.locator('#exportPreviewImage').evaluate(async el=>{
      const resp=await fetch(el.src),blob=await resp.blob();
      const bytes=new Uint8Array(await blob.slice(0,8).arrayBuffer());
      const panel=document.querySelector('.export-preview-card');
      const actions=document.querySelector('.export-preview-actions');
      const rect=panel.getBoundingClientRect();
      return {width:el.naturalWidth,height:el.naturalHeight,mime:blob.type,
        bytes:Array.from(bytes),size:blob.size,
        panel:{top:rect.top,bottom:rect.bottom,client:panel.clientHeight,scroll:panel.scrollHeight,
          overflow:getComputedStyle(panel).overflowY},
        actionsHeight:actions.getBoundingClientRect().height,
        viewport:innerHeight};
    });
    assert.equal(img.width,1080,c.type+' PNG width');
    assert.equal(img.height,1080,c.type+' PNG height');
    assert.equal(img.mime,'image/png',c.type+' PNG mime');
    assert.deepEqual(img.bytes,[137,80,78,71,13,10,26,10],c.type+' PNG signature');
    assert(img.size>2000,c.type+' PNG suspiciously small');
    assert(img.panel.top>=-2&&img.panel.bottom<=img.viewport+2,
      c.type+' PNG panel outside short iPhone viewport: '+JSON.stringify(img.panel));
    assert(img.actionsHeight>=44,c.type+' save/share button area too small');
    assert(['auto','scroll'].includes(img.panel.overflow),
      'PNG preview does not scroll when image is tall');

    // This is a real user click in WebKit, but only the native share API is
    // replaced. It cannot invoke an OS share sheet from a CI runner.
    await page.locator('#exportPreviewShare').click({timeout:15000});
    const shared=await page.evaluate(()=>window.__r36ShareLog);
    assert.equal(shared.length,1,c.type+' share button failed to invoke share');
    assert.equal(shared[0].files[0].type,'image/png');
    assert(shared[0].files[0].name.endsWith('.png'));
    assert(shared[0].files[0].size>2000);

    if(c.type==='scatter'){
      // Unsupported native file sharing must still retain the PNG preview
      // and show the fallback long-press instructions without losing the file.
      await page.evaluate(()=>Object.defineProperty(navigator,'canShare',
        {configurable:true,value:()=>false}));
      await page.locator('#exportPreviewShare').click();
      assert(notices.some(x=>/長押し|Long-press/.test(x)),'missing Safari share fallback');
      assert(await page.locator('#exportPreviewModal').isVisible(),
        'fallback unexpectedly discarded exported PNG');
      await page.evaluate(()=>Object.defineProperty(navigator,'canShare',
        {configurable:true,value:()=>true}));
    }
    await page.locator('#exportPreviewClose').click();
    assert(await page.locator('#exportPreviewModal').isHidden(),'PNG preview did not close');
    console.log('PASS WebKit iPhone '+c.width+'x'+c.height+' '+c.type+
      ' PNG '+img.size+' bytes, modal, share and close');
  }
  assert.deepEqual(errors.filter(s=>/SyntaxError|ReferenceError|TypeError/.test(s)),[],
    'WebKit editor runtime error');
  console.log('R36 P3 iPhone WebKit editor export/share regression PASS (4 templates)');
}finally{await browser.close()}
