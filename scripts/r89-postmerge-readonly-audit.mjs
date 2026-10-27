import assert from 'node:assert/strict';
const origin='https://statsmaker.app';
const checks=[
 ['/index.html',['id="r89HomeIntro"','r89-home-intro.js?v=r89p1','id="basicRoot"']],
 ['/discover.html',['discover.js?v=r89i18n1']],
 ['/ja/use-cases.html',['r89-example-editor.js?v=r89p1','r89-example-editor.css?v=r89p1']],
 ['/en/use-cases.html',['r89-example-editor.js?v=r89p1','r89-example-editor.css?v=r89p1']],
 ['/ja/examples.html',['r89-example-editor.js?v=r89p2','id="r89OriginalExamples"']],
 ['/en/examples.html',['r89-example-editor.js?v=r89p2','id="r89OriginalExamples"']],
 ['/cloud/r89-example-editor.js',["visibility:'private'",'createProject(x.type)','saveProject(projectFor(sample))','messages.retry']],
 ['/cloud/r89-original-presets.json',['"radar"','"ranking"','"tier"']],
 ['/cloud/r89-usecase-presets.json',['"cafe"','"routes"','"study"','"plan"','"hero"']],
 ['/cloud/r89-home-intro.js',['SM_R89_LANGUAGE']],
 ['/cloud/discover.js',['use-cases.html']]
];
async function once(){
 const failures=[];
 for(const [path,markers] of checks){
  try{
   const response=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(12000)});
   const body=await response.text();
   if(response.status!==200){failures.push(path+' HTTP '+response.status);continue;}
   for(const token of markers){if(!body.includes(token))failures.push(path+' missing '+token);}
   if(body.length>1000000)failures.push(path+' unexpectedly large response');
  }catch(e){failures.push(path+' '+e.message);}
 }
 return failures;
}
let last=[];
for(let attempt=1;attempt<=18;attempt++){
 last=await once();
 console.log('read-only production check attempt',attempt,'failed markers',last.length);
 if(!last.length){
  console.log('R89 LIVE PASS: 11 HTTP GET assets, JA/EN source-backed editable samples, Discover and Home markers');
  process.exit(0);
 }
 if(attempt<18)await new Promise(resolve=>setTimeout(resolve,15000));
}
console.error('R89 LIVE NOT READY:',last.join('; '));
process.exitCode=1;
