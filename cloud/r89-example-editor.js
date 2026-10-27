// R89: users can open a NEW editable private copy of a first-party example.
// Never overwrite Home scoring library, submit/publish, or load user content.
import {createProject,applyTheme} from '/app/src/core/project.js';
import {saveProject} from '/app/src/core/store.js';
const lang=document.body.dataset.smReadingPage==='en'?'en':'ja';
const labels=lang==='en'
 ?{button:'Edit a copy of this example',busy:'Creating editable copy…',note:'Opens a new private chart; your existing charts are unchanged.',error:'Could not create a sample copy. Check that local browser storage is available.'}
 :{button:'この作例を編集してみる',busy:'編集用のコピーを作成中…',note:'新しい非公開のグラフを作成します。既存作品は変更しません。',error:'作例を読み込めませんでした。ブラウザの保存領域を確認してください。'};
const index=new Set(['cafe','routes','study','plan','hero']);
function projectFor(x){
  if(!index.has(x.slug)||!['bar','quadrant','image-line','range','stat-card'].includes(x.type)
      ||!Array.isArray(x.rows)||x.rows.length<1||x.rows.length>10)throw Error('Invalid sample');
  const p=createProject(x.type);
  applyTheme(p,x.theme);
  p.meta.title=x[lang]?.title||x.title;
  p.meta.subtitle=x.subtitle;
  p.meta.language=lang;
  p.canvas={preset:x.width>x.height?'landscape':'square',width:x.width,height:x.height,transparent:false};
  // Match the native images' original values, labels and chart configuration.
  if(x.type==='bar'){
    p.data.items=x.rows.map((r,i)=>({id:'sample_drink_'+i,name:r[0],value:r[1],category:'',enabled:true}));
    Object.assign(p.settings,{unit:'pt',orientation:'horizontal',showValues:true,showCategory:false,
      sort:'manual',topN:5,max:100,autoMax:false});
  }else if(x.type==='quadrant'){
    p.data.items=x.rows.map((r,i)=>({id:'sample_route_'+i,name:r[0],x:r[1],y:r[2],category:'',imageRef:null,enabled:true}));
    p.settings.xAxis={label:'Quietness',min:0,max:100,split:50};
    p.settings.yAxis={label:'Access',min:0,max:100,split:50};
    p.settings.quadrants={topLeft:'Convenient',topRight:'Balanced',bottomLeft:'Busy & Remote',bottomRight:'Quiet Retreat'};
    p.settings.markerMode='dot';p.settings.labelLimit=10;
  }else if(x.type==='image-line'){
    p.data.items=x.rows.map((r,i)=>({id:'sample_week_'+i,name:r[0],value:r[1],enabled:true,imageRef:null,imageData:''}));
    Object.assign(p.settings,{min:0,max:100,displayLimit:8,showValues:true,showGrid:true,showLabels:true,showImages:false,imageOpacity:0});
  }else if(x.type==='range'){
    p.data.items=x.rows.map((r,i)=>({id:'sample_plan_'+i,name:r[0],value:r[1],value2:r[2]}));
    Object.assign(p.settings,{labelA:'Target',labelB:'Done',unit:'pt',autoRange:false,min:0,max:100,showDiff:true,displayLimit:4});
  }else if(x.type==='stat-card'){
    p.data.name='Mira';p.data.subtitle='Original sample explorer';p.data.team='';p.data.tier='B';
    p.data.overall=78;p.data.imageRef=null;
    p.data.stats=x.rows.map((r,i)=>({id:'sample_stat_'+i,label:r[0],value:r[1]}));
    p.settings.maxStats=6;
  }
  // A new private local chart, not a cloud topic or linked source sheet.
  p.publish={cloudId:null,visibility:'private',publishedAt:null};
  return p;
}
const response=await fetch('/cloud/r89-usecase-presets.json',{credentials:'same-origin'});
if(!response.ok)throw Error('Examples unavailable');
const data=await response.json();
if(!Array.isArray(data?.cases)||data.cases.length!==5)throw Error('Incomplete sample index');
for(const sample of data.cases){
  const section=document.getElementById(sample.slug);
  if(!index.has(sample.slug)||!section||!section.classList.contains('case'))continue;
  const area=document.createElement('div');area.className='r89ExampleAction';
  const button=document.createElement('button');button.type='button';button.className='r89EditCopy';
  button.textContent=labels.button;
  const note=document.createElement('small');note.textContent=labels.note;
  area.append(button,note);
  section.querySelector('.caseHead')?.appendChild(area);
  button.addEventListener('click',()=>{
    if(button.disabled)return;
    button.disabled=true;button.textContent=labels.busy;
    try{
      const saved=saveProject(projectFor(sample));
      const url=new URL('/app/editor.html',location.origin);
      url.searchParams.set('id',saved.id);
      location.assign(url.href);
    }catch(e){
      console.error('Sample copy creation failed',e);
      button.disabled=false;button.textContent=labels.button;
      alert(labels.error);
    }
  });
}
