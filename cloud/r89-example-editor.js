// R89b: first-party example values can be opened as NEW private local chart projects.
// Data is read from same-origin audited manifests; never write to remote services.
import {createProject,applyTheme} from '/app/src/core/project.js';
import {saveProject} from '/app/src/core/store.js';

const lang=document.body.dataset.smReadingPage==='en'?'en':'ja';
const original=location.pathname.endsWith('/examples.html');
const kinds=new Map([
 ['cafe','bar'],['routes','quadrant'],['study','image-line'],['plan','range'],['hero','stat-card'],
 ['radar','radar'],['ranking','ranking-card'],['tier','tier-list']
]);
const messages=lang==='en'
 ?{edit:'Edit a copy of this example',busy:'Creating your private copy…',
   note:'Opens a new private chart; your saved charts remain unchanged.',
   failed:'The example could not be loaded. Please try again.',
   retry:'Retry loading examples',copyError:'Could not save a new example copy. Check browser storage.'}
 :{edit:'この作例を編集してみる',busy:'非公開のコピーを作成中…',
   note:'新しい非公開のグラフを開きます。保存済みの作品は変更しません。',
   failed:'作例データを読み込めませんでした。もう一度お試しください。',
   retry:'作例を再読み込み',copyError:'新しい作例を保存できませんでした。ブラウザの保存領域を確認してください。'};
let originalTeams=[];
let originalAxes=[];
const average=team=>team.scores.reduce((total,n)=>total+n,0)/team.scores.length;
function projectFor(x){
 if(!kinds.has(x.slug)||kinds.get(x.slug)!==x.type)throw Error('Invalid sample type');
 if(!original&&(!Array.isArray(x.rows)||x.rows.length<1||x.rows.length>10))
   throw Error('Invalid example rows');
 const p=createProject(x.type);
 if(!original)applyTheme(p,x.theme);
 p.meta.title=x[lang]?.title||x.title;
 p.meta.subtitle=x.subtitle;
 p.meta.language=lang;
 p.canvas=original?{preset:'square',width:1080,height:1080,transparent:false}
   :{preset:x.width>x.height?'landscape':'square',width:x.width,height:x.height,transparent:false};
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
 }else if(x.type==='radar'){
   if(originalTeams.length!==6||originalAxes.length!==4)throw Error('Missing source data');
   p.data.axes=originalAxes.map((label,i)=>({id:'axis_'+i,label,max:100}));
   p.data.series=originalTeams.filter(team=>['Red Team','Blue Team'].includes(team.name))
     .map((team,i)=>({id:'series_'+i,name:team.name,color:team.color,values:[...team.scores]}));
   p.settings.showLegend=true;
 }else if(x.type==='ranking-card'){
   if(originalTeams.length!==6)throw Error('Missing source data');
   p.data.items=[...originalTeams].sort((a,b)=>average(b)-average(a))
     .map((team,i)=>({id:'rank_'+i,name:team.name,value:average(team),note:'',category:'',imageRef:null,enabled:true}));
   p.settings.topN=6;p.settings.showCategory=false;p.settings.unit='';
 }else if(x.type==='tier-list'){
   if(originalTeams.length!==6)throw Error('Missing source data');
   p.data.items=originalTeams.map((team,i)=>{
     const score=average(team);
     return {id:'tier_item_'+i,name:team.name,value:score,
       tier:score>=90?'S':score>=80?'A':score>=70?'B':score>=60?'C':'D'};
   });
   p.settings.showScore=true;
 }
 p.publish={cloudId:null,visibility:'private',publishedAt:null};
 return p;
}

function loadStatus(){
 let element=document.getElementById('r89ExampleStatus');
 if(element)return element;
 element=document.createElement('div');element.id='r89ExampleStatus';
 element.className='r89ExampleStatus';element.setAttribute('role','status');
 const top=document.querySelector(original?'.intro':'.hero')||document.querySelector('main');
 top?.appendChild(element);
 return element;
}
async function initialize(){
 const status=loadStatus();
 status.replaceChildren();
 try{
   const path=original?'/cloud/r89-original-presets.json':'/cloud/r89-usecase-presets.json';
   const response=await fetch(path,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error('Sample manifest HTTP '+response.status);
   const data=await response.json();
   const required=original?['radar','ranking','tier']:['cafe','routes','study','plan','hero'];
   if(!Array.isArray(data?.cases)||data.cases.length!==required.length
     ||required.some((id,i)=>data.cases[i]?.slug!==id||kinds.get(id)!==data.cases[i]?.type))
     throw Error('Incomplete example dataset');
   if(original){
     if(!Array.isArray(data.teams)||data.teams.length!==6
       ||!Array.isArray(data.axes)||data.axes.length!==4
       ||data.teams.some(t=>!Array.isArray(t.scores)||t.scores.length!==4
         ||t.scores.some(n=>!Number.isFinite(n)||n<0||n>100)))
       throw Error('Invalid source rating values');
     originalTeams=data.teams;
     originalAxes=data.axes;
   }
   for(const sample of data.cases){
     const section=document.getElementById(sample.slug);
     if(!section||!section.classList.contains(original?'explain':'case'))continue;
     if(section.querySelector('.r89ExampleAction'))continue;
     const area=document.createElement('div');area.className='r89ExampleAction';
     const button=document.createElement('button');button.type='button';button.className='r89EditCopy';
     button.textContent=messages.edit;
     const note=document.createElement('small');note.textContent=messages.note;
     area.append(button,note);
     (section.querySelector(original?'.exampleText':'.caseHead')||section).appendChild(area);
     button.addEventListener('click',()=>{
       if(button.disabled)return;
       button.disabled=true;button.textContent=messages.busy;
       try{
         const saved=saveProject(projectFor(sample));
         const url=new URL('/app/editor.html',location.origin);
         url.searchParams.set('id',saved.id);
         location.assign(url.href);
       }catch(error){
         console.error('Local example copy failed',error);
         button.disabled=false;button.textContent=messages.edit;
         alert(messages.copyError);
       }
     });
   }
   status.replaceChildren();
 }catch(error){
   console.error('First-party example data unavailable',error);
   status.replaceChildren();
   const notice=document.createElement('span');notice.textContent=messages.failed;
   const retry=document.createElement('button');retry.type='button';retry.textContent=messages.retry;
   retry.addEventListener('click',()=>{void initialize()},{once:true});
   status.append(notice,retry);
 }
}
void initialize();
