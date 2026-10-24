// R70 | Generate genuine Stats Maker PNGs from the CURRENT in-repo
// renderNativeProject() exporter. No outside data or third-party images.
// Run only on a local static server, never the public site. Six hypothetical
// teams are editorial scoring examples, not real sports statistics.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
assert(/^http:\/\/127\.0\.0\.1:4173\/?$/.test(base),
  'R70 generator must run against localhost only');
const out=new URL('../ja/example-images/',import.meta.url);
await mkdir(out,{recursive:true});
const scores=[
  {name:'Green Team',scores:[95,90,95,90],color:'#38cda0'},
  {name:'Purple Team',scores:[80,85,90,80],color:'#ad8cff'},
  {name:'Red Team',scores:[90,60,70,90],color:'#ff887e'},
  {name:'Blue Team',scores:[60,90,80,70],color:'#74adff'},
  {name:'Yellow Team',scores:[55,60,65,60],color:'#e7be6b'},
  {name:'Gray Team',scores:[40,50,55,45],color:'#9ba5b5'}
];
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1200,height:900}});
  await context.route('**/*.supabase.co/**',route=>route.abort());
  const page=await context.newPage();
  await page.goto(base+'/ja/',{waitUntil:'domcontentloaded'});
  const images=await page.evaluate(async teams=>{
    const {createProject}=await import('/app/src/core/project.js');
    const {renderNativeProject}=await import('/app/src/core/export.js');
    const files=[];
    const avg=item=>item.scores.reduce((a,b)=>a+b,0)/item.scores.length;
    for(const [type,filename] of [
      ['radar','sample-radar.png'],
      ['ranking-card','sample-ranking.png'],
      ['tier-list','sample-tier.png']
    ]){
      const p=createProject(type);
      p.meta.title={
        radar:'Red vs Blue | Four Strengths',
        'ranking-card':'Six Teams | Average Ratings',
        'tier-list':'Six Teams | Tier Groups'
      }[type];
      p.meta.subtitle='ILLUSTRATIVE SCORES · NOT REAL DATA';
      p.canvas={preset:'square',width:1080,height:1080,transparent:false};
      if(type==='radar'){
        p.data.axes=['Attack','Defense','Speed','Teamwork']
          .map((label,i)=>({id:'axis_'+i,label,max:100}));
        p.data.series=teams.filter(t=>['Red Team','Blue Team'].includes(t.name))
          .map((t,i)=>({id:'series_'+i,name:t.name,color:t.color,values:t.scores}));
        p.settings.showLegend=true;
      }
      if(type==='ranking-card'){
        p.data.items=[...teams].sort((a,b)=>avg(b)-avg(a))
          .map((t,i)=>({id:'rank_'+i,name:t.name,value:avg(t),
            note:'',category:'',imageRef:null,enabled:true}));
        p.settings.topN=6;
        p.settings.showCategory=false;
        p.settings.unit='';
      }
      if(type==='tier-list'){
        p.data.items=teams.map((t,i)=>({id:'tier_item_'+i,name:t.name,
          value:avg(t),tier:avg(t)>=90?'S':avg(t)>=80?'A':avg(t)>=70?'B':
            avg(t)>=60?'C':'D'}));
        p.settings.showScore=true;
      }
      const canvas=await renderNativeProject(p);
      if(canvas.width!==1080||canvas.height!==1080)
        throw Error('Unexpected native export dimensions');
      const dataUrl=canvas.toDataURL('image/png');
      if(!dataUrl.startsWith('data:image/png;base64,'))
        throw Error('Native export is not PNG');
      files.push({filename,data:dataUrl.slice('data:image/png;base64,'.length)});
    }
    return files;
  },scores);
  for(const file of images){
    assert(/^sample-(?:radar|ranking|tier)\.png$/.test(file.filename));
    const buf=Buffer.from(file.data,'base64');
    assert(buf.length>5000,'Graph PNG is unexpectedly small: '+file.filename);
    assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    await writeFile(new URL(file.filename,out),buf);
    console.log('R70 native exporter PNG:',file.filename,buf.length,'bytes');
  }
}finally{await browser.close()}
