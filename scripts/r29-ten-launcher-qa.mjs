import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const BASE_URL=process.env.BASE_URL||'https://statsmaker.app';
const TEMPLATE_TYPES=[
  ['ranking-card','Ranking Card'],['stat-card','Stat Card'],['bar','Bar Chart'],
  ['radar','Radar Chart'],['quadrant','Quadrant'],['dot','Dot Chart'],
  ['range','Range / Dumbbell'],['scatter','Scatter'],
  ['tier-list','Tier List'],['ring','Ring Gauge']
];
const BASE_SHEET={
  id:'r29-qa-source',title:'R29 PRIVATE QA SOURCE',desc:'Do not publish',
  cols:['Speed','Strength','Technique'],
  rows:[
    {name:'Subject Alpha',image:'',note:'QA',scores:[81,72,90]},
    {name:'Subject Beta',image:'',note:'QA',scores:[91,88,74]}
  ],
  weights:[1,1,1],scale:100,rankMetric:'avg',compare:[],
  sortKey:null,sortDesc:true,weighted:false,viewMode:'sheet',
  fitMode:'auto',fitZoom:1,updatedAt:Date.now()
};

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'ja-JP'});
  await context.addInitScript(source=>{
    try{
      if(!localStorage.getItem('r29:qa:init')){
        localStorage.setItem('statsMakerV014Library',
          JSON.stringify({activeId:source.id,sheets:[source]}));
        localStorage.setItem('r29:qa:init','1');
      }
    }catch{}
  },BASE_SHEET);
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on('pageerror',err=>{
    if(/project not found|cannot read properties|not defined|syntaxerror/i.test(err.message))
      runtimeErrors.push(err.message);
  });
  const dialogs=[];
  const consoleErrors=[];
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});

  let browserProjects=[];
  for(const [index,[type,name]] of TEMPLATE_TYPES.entries()){
    await page.goto(BASE_URL+'/index.html?extensions=1&qaR29='+index,
      {waitUntil:'domcontentloaded',timeout:60000});
    const frame=page.frameLocator('#basicFrame');
    await frame.locator('#titleInput').waitFor({state:'visible',timeout:30000});
    const cards=page.locator('#extGroups .extCard');
    await cards.first().waitFor({state:'visible',timeout:30000});
    assert.equal(await cards.count(),10,'The user-visible extension launcher changed from ten templates');
    assert.equal((await cards.nth(index).locator('b').innerText()).trim(),name,
      'Launcher template order changed at '+index);
    await cards.nth(index).click();
    try{
      // External image/CDN resources can keep the "load" event pending even
      // after the editor navigation has already committed successfully.
      await page.waitForURL(url=>url.pathname.endsWith('/app/editor.html'),
        {waitUntil:'domcontentloaded',timeout:15000});
    }catch(error){
      const ui=await page.locator('body').evaluate(el=>({
        url:location.href,
        cardCount:document.querySelectorAll('#extGroups .extCard').length,
        backdrop:document.querySelector('#extBackdrop')?.className
      }));
      throw new Error('R29 extension navigation failed at '+name+': '+
        JSON.stringify({ui,dialogs,consoleErrors:consoleErrors.slice(-8),
          runtimeErrors:runtimeErrors.slice(-8),error:error.message}));
    }
    const projectId=new URL(page.url()).searchParams.get('id');
    assert(projectId,'Launcher failed to attach a unique project ID for '+type);
    await page.locator('#projectTitleInput').waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(([id,type])=>{
      const projects=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]');
      return projects.some(p=>p.id===id&&p.type===type);
    },[projectId,type],{timeout:30000});
    const details=await page.evaluate(([id,type])=>{
      const projects=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]');
      const project=projects.find(p=>p.id===id);
      const library=JSON.parse(localStorage.getItem('statsMakerV014Library')||'null');
      return {
        type:project.type,hasData:!!project.data,
        hasCanvas:!!project.canvas?.width&&!!project.canvas?.height,
        sourceId:project.settings?.sourceSheetId,
        title:project.meta?.title,
        sameSource:library?.sheets?.[0]?.title==='R29 PRIVATE QA SOURCE',
        projectCount:projects.length,
        sameId:project.id===id,
        noDuplicatedLocaleBar:document.querySelectorAll('.globalLocaleBar').length===1,
        noExtraHome:document.querySelectorAll('.globalHomeBtn').length===1
      };
    },[projectId,type]);
    assert.equal(details.type,type,'Wrong visual type from real extension launcher');
    assert(details.hasData&&details.hasCanvas&&details.sameSource&&details.sameId,
      'Launcher project lost data/canvas or modified original Home sheet');
    assert.equal(details.sourceId,BASE_SHEET.id,'Source link lost for '+type);
    assert(details.noDuplicatedLocaleBar&&details.noExtraHome,
      'Visual editor contains duplicated global navigation');
    // Real editor module must hydrate the stored project after navigation.
    await page.waitForFunction(()=>document.querySelector('#projectTitleInput')?.value?.length>0,
      null,{timeout:30000});
    const before=await page.locator('#projectTitleInput').inputValue();
    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(expected=>
      document.querySelector('#projectTitleInput')?.value===expected,
      before,{timeout:30000});
    assert.equal(new URL(page.url()).searchParams.get('id'),projectId,
      'Project ID was not preserved by editor reload');
    browserProjects.push({type,projectId});
    console.log('R29 template '+(index+1)+'/10 PASS: '+name);
  }
  assert.equal(new Set(browserProjects.map(p=>p.projectId)).size,10,
    'Launcher overwrote existing extension projects');
  const state=await page.evaluate(()=>{
    const projects=JSON.parse(localStorage.getItem('statsMakerV2Projects')||'[]');
    const library=JSON.parse(localStorage.getItem('statsMakerV014Library')||'null');
    return {count:projects.length,homeCount:library?.sheets?.length,
      homeTitle:library?.sheets?.[0]?.title};
  });
  assert.equal(state.count,10);
  assert.equal(state.homeCount,1,'Extending charts duplicated the Home sheet');
  assert.equal(state.homeTitle,BASE_SHEET.title);
  assert.deepEqual(runtimeErrors,[],'Unhandled JS errors during template/edit/reload QA');
  console.log('R29 launcher QA PASS: all TEN visible templates, persistent local projects, source preservation');
}finally{
  await browser.close();
}
