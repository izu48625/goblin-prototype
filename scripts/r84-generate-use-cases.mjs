// R84: generate actual Stats Maker images, never upload an illustration pretending to be app output.
// The data and commentary use entirely fictional, first-party editorial examples.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.BASE_URL||'http://127.0.0.1:4173';
assert.equal(base,'http://127.0.0.1:4173','Generator must use isolated localhost');
const metadata=JSON.parse(await readFile(new URL('./r84-use-cases-data.json',import.meta.url),'utf8'));
const cases=metadata.cases;
assert.equal(cases.length,5);
const outDir=new URL('../ja/example-images/',import.meta.url);
await mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.route('**/*.supabase.co/**',route=>route.abort());
 const page=await context.newPage();
 await page.goto(base+'/ja/',{waitUntil:'domcontentloaded'});
 const imgs=await page.evaluate(async examples=>{
   const {createProject,applyTheme}=await import('/app/src/core/project.js');
   const {renderNativeProject}=await import('/app/src/core/export.js');
   const files=[];
   for(const x of examples){
      const p=createProject(x.type);
      applyTheme(p,x.theme);
      p.meta.title=x.title;
      p.meta.subtitle=x.subtitle;
      p.meta.language='en';
      p.canvas={preset:x.width>x.height?'landscape':'square',width:x.width,height:x.height,transparent:false};
      const rows=x.rows;
      if(x.type==='bar'){
        p.data.items=rows.map((r,i)=>({id:'bar_'+i,name:r[0],value:r[1],category:'',enabled:true}));
        Object.assign(p.settings,{unit:'pt',orientation:'horizontal',showValues:true,showCategory:false,sort:'manual',topN:5,max:100,autoMax:false});
      } else if(x.type==='quadrant'){
        p.data.items=rows.map((r,i)=>({id:'route_'+i,name:r[0],x:r[1],y:r[2],category:'',imageRef:null,enabled:true}));
        p.settings.xAxis={label:'Quietness',min:0,max:100,split:50};
        p.settings.yAxis={label:'Access',min:0,max:100,split:50};
        p.settings.quadrants={topLeft:'Convenient',topRight:'Balanced',bottomLeft:'Busy & Remote',bottomRight:'Quiet Retreat'};
        p.settings.markerMode='dot';p.settings.labelLimit=10;
      } else if(x.type==='image-line'){
        p.data.items=rows.map((r,i)=>({id:'week_'+i,name:r[0],value:r[1],enabled:true,imageRef:null,imageData:''}));
        Object.assign(p.settings,{min:0,max:100,displayLimit:8,showValues:true,showGrid:true,showLabels:true,showImages:false,imageOpacity:0});
      } else if(x.type==='range'){
        p.data.items=rows.map((r,i)=>({id:'activity_'+i,name:r[0],value:r[1],value2:r[2]}));
        Object.assign(p.settings,{labelA:'Target',labelB:'Done',unit:'pt',autoRange:false,min:0,max:100,showDiff:true,displayLimit:4});
      } else if(x.type==='stat-card'){
        p.data.name='Mira';p.data.subtitle='Original fictional explorer';p.data.team='';p.data.tier='B';p.data.overall=78;
        p.data.imageRef=null;
        p.data.stats=rows.map((r,i)=>({id:'stat_'+i,label:r[0],value:r[1]}));
        p.settings.maxStats=6;
      }else throw Error('Unsupported example '+x.type);
      const canvas=await renderNativeProject(p);
      if(canvas.width!==x.width||canvas.height!==x.height)throw Error('Canvas size mismatch '+x.slug);
      const data=canvas.toDataURL('image/png');
      if(!data.startsWith('data:image/png;base64,'))throw Error('Native export failed '+x.slug);
      files.push({slug:x.slug,data:data.slice('data:image/png;base64,'.length)});
   }
   return files;
 },cases);
 for(const file of imgs){
   assert(cases.some(e=>e.slug===file.slug));
   const name='usecase-'+file.slug+'.png';
   const buf=Buffer.from(file.data,'base64');
   assert(buf.length>5000&&buf.length<2000000,'Suspicious native image '+name);
   assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
   const x=cases.find(e=>e.slug===file.slug);
   assert.equal(buf.readUInt32BE(16),x.width);
   assert.equal(buf.readUInt32BE(20),x.height);
   await writeFile(new URL(name,outDir),buf);
   console.log('R84 native Stats Maker export:',name,buf.length,'bytes',x.width,x.height);
 }
}finally{await browser.close()}
