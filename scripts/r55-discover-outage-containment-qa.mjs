import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../cloud/discover.js',import.meta.url),'utf8');
function makeUI(){
  const elements=new Map();
  function el(dataset={}){
    const handlers={};const classes=new Set();
    return {dataset,handlers,value:'',textContent:'',innerHTML:'',disabled:false,
      classList:{add(v){classes.add(v)},remove(v){classes.delete(v)},
        contains(v){return classes.has(v)},toggle(v,state){
          if(state??!classes.has(v))classes.add(v);else classes.delete(v)}},
      addEventListener(t,cb){handlers[t]=cb},click(){return handlers.click?.()}};
  }
  const ids=Object.fromEntries(['grid','status','searchInput','resultMeta','sectionTitle','moreBtn','refreshBtn'].map(x=>[x,el()]));
  const views=['all','community'].map(x=>el({view:x}));
  const sorts=['newest','popular','community','remix'].map(x=>el({sort:x}));
  const categories=['all','sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other'].map(x=>el({category:x}));
  for(const name of ['.hero h1','.hero p','.privacyNote','.createLink','.footer a'])elements.set(name,el());
  for(const b of [...views,...sorts]){
    const k=b.dataset.view?'view':'sort';
    elements.set('[data-'+k+'="'+b.dataset[k]+'"]',b);
  }
  return {ids,document:{documentElement:{lang:'ja'},getElementById(id){return ids[id]},
    querySelector(q){if(!elements.has(q))throw Error('Missing selector '+q);return elements.get(q)},
    querySelectorAll(q){return q==='.categoryBtn'?categories:
      q==='.browseTab'?views:q==='.sortBtn'?sorts:[]}}};
}
const topic={id:'00000000-0000-4000-8000-000000000001',title:'Public',description:'Works',
  visibility:'public',published_at:'2026-10-16T00:00:00Z',snapshot_updated_at:'2026-10-16T00:00:00Z',
  snapshot:{metadata:{category:'sports'},rows:[{name:'sample',scores:[8]}],criteria:[{name:'speed'}]},
  score_scale:100,weighted:false,allow_ratings:true,show_community:true,participants:1,remixCount:0};
const valid={rows:[topic],total:1,has_more:false,anchor:'2026-10-16T00:00:00Z'};
const cases=[
  {name:'Official gateway 503',hostname:'statsmaker.app',status:503,wantRpc:0,wantVisible:false},
  {name:'Official gateway 429',hostname:'statsmaker.app',status:429,wantRpc:0,wantVisible:false},
  {name:'Official gateway 400',hostname:'statsmaker.app',status:400,wantRpc:0,wantVisible:false},
  {name:'Official gateway transport failure',hostname:'statsmaker.app',error:true,wantRpc:0,wantVisible:false},
  {name:'Official gateway success',hostname:'statsmaker.app',status:200,wantRpc:0,wantVisible:true},
  {name:'Legacy Pages preview 404',hostname:'izu48625.github.io',status:404,wantRpc:1,wantVisible:true},
  {name:'Legacy Pages network failure',hostname:'izu48625.github.io',error:true,wantRpc:1,wantVisible:true}
];
for(const c of cases){
  const ui=makeUI();
  let rpcCalls=0,fetchCalls=0;
  const sb={async rpc(name,params){
    assert.equal(name,'discover_public_works_v1');rpcCalls++;
    assert.equal(params.p_limit,12);
    return {data:valid,error:null};
  }};
  const sandbox={window:{location:{hostname:c.hostname},SM_SUPABASE:{client:sb}},
    document:ui.document,localStorage:{getItem:()=>null},navigator:{language:'ja-JP'},
    console:{error(){},warn(){}},fetch:async()=>{
      fetchCalls++;
      if(c.error)throw new TypeError('network down');
      return Response.json(c.status===200?valid:{error:'temporarily_unavailable'},{status:c.status});
    },setTimeout:(cb)=>setTimeout(cb,0),clearTimeout,Intl,Date,URLSearchParams};
  vm.runInNewContext(source,sandbox,{filename:'cloud/discover.js'});
  for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,0));
  assert.equal(fetchCalls,1,c.name+' must call gateway');
  assert.equal(rpcCalls,c.wantRpc,c.name+' must respect fallback policy');
  if(c.wantVisible)assert(ui.ids.grid.innerHTML.includes('Public'),c.name+' must show public card');
  else assert(ui.ids.status.textContent.includes('読み込めません'),c.name+' must show error not saved fake result');
  console.log('R55',c.name,'PASS');
}
console.log('R55: No production fallback under outages and preview compatibility PASS');
