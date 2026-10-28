import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createProject} from '../app/src/core/project.js';
import {syncSourceProject} from '../app/src/core/source-sync.js';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const topicId='11111111-1111-4111-8111-111111111111';
const sheet={
  id:'published_r119_fixture',title:'マンチェスターユナイテッド 監督候補',desc:'',
  cols:['柔軟性','攻撃構築','守備構築','育成'],
  rows:[
    {name:'キャリック',image:'',note:'',scores:[4,3,3,4]},
    {name:'コンテ',image:'',note:'',scores:[6,7,9,5]},
    {name:'エディハウ',image:'',note:'',scores:[5,6,7,6]}
  ],weights:[1,1,1,1],scale:10,weighted:false,rankMetric:'avg',compare:[]
};
const project=createProject('quadrant');
syncSourceProject(project,{},sheet);
project.settings.publicSourceSheet=sheet;
project.settings.publicSourceTopicId=topicId;
project.meta.title=sheet.title;
const extract=()=>({
  stage:document.querySelector('#canvasStage')?.getBoundingClientRect(),
  box:document.querySelector('#canvasFitBox')?.getBoundingClientRect(),
  tabs:document.querySelector('.mobile-bottom-tabs')?.getBoundingClientRect(),
  label:document.querySelector('#zoomLabel')?.textContent,
  style:getComputedStyle(document.querySelector('#canvasStage')).justifyContent,
  art:document.querySelector('#previewRoot .visual')?.getBoundingClientRect(),
  canvas:document.querySelector('#previewRoot')?.getBoundingClientRect()
});
for(const engine of [chromium,webkit]){
  const browser=await engine.launch({headless:true});
  try{
    for(const {width,height} of [{width:390,height:844},{width:375,height:667}]){
      const context=await browser.newContext({
        viewport:{width,height},isMobile:true,hasTouch:true,locale:'ja-JP'
      });
      await context.addInitScript(p=>{
        localStorage.setItem('statsMakerV2Projects',JSON.stringify([p]));
        localStorage.setItem('statsMaker.locale','ja');
      },project);
      await context.route('https://cdn.jsdelivr.net/**',route=>
        route.fulfill({status:200,contentType:'application/javascript',
          body:'window.html2canvas=async()=>document.createElement("canvas");'}
        ));
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/app/editor.html?id='+encodeURIComponent(project.id)+
        '&from=public&topic='+topicId,{waitUntil:'domcontentloaded'});
      await page.locator('#previewRoot .visual').waitFor({state:'visible',timeout:25000});
      await page.waitForFunction(()=>document.querySelector('#canvasFitBox')?.getBoundingClientRect().height>0);
      let frame=await page.evaluate(extract);
      assert.equal(frame.style,'flex-start','Artwork is not top-aligned');
      assert(frame.box.top>=frame.stage.top-1 && frame.box.top-frame.stage.top<=22,
        'Canvas is still pushed too far down: '+JSON.stringify(frame));
      assert(frame.canvas.bottom<=frame.tabs.top-8,
        'Initial canvas is behind mobile bottom tabs: '+JSON.stringify(frame));
      assert(frame.canvas.width>=100 && frame.canvas.height>=100,
        'Initial fit is illegibly small: '+JSON.stringify(frame));
      assert.equal(await page.locator('#sourceQuickBar').isVisible(),true,
        'Public creator source selector missing');
      assert((await page.locator('.editor-back-btn').getAttribute('href')||'').includes('visuals=1'),
        'Back control lost published source');
      const fitted=Number.parseInt(frame.label,10);
      await page.locator('#zoomInBtn').click();
      await page.waitForFunction(value=>
        Number.parseInt(document.querySelector('#zoomLabel')?.textContent,10)>value,fitted);
      await page.locator('#fitZoomBtn').click();
      await page.waitForFunction(value=>
        Math.abs(Number.parseInt(document.querySelector('#zoomLabel')?.textContent,10)-value)<=1,fitted);
      frame=await page.evaluate(extract);
      assert(frame.canvas.bottom<=frame.tabs.top-8,'Fit button failed to restore full view');
      assert(frame.box.top-frame.stage.top<=22,'Fit button failed to restore top alignment');
      assert.deepEqual(errors,[],'JS errors while opening and fitting a public chart');
      console.log('R119 '+engine.name()+' '+width+'x'+height+
        ': top-aligned, fully visible on load, zoom+/Fit working PASS');
      await context.close();
    }
  }finally{await browser.close()}
}
