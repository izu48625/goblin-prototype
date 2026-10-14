import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../cloud/discover.js',import.meta.url),'utf8');
assert(source.includes("sb.rpc('discover_public_works_v1'"));
assert(!source.includes('allPublicTopics('));
assert(!source.includes(".from('topics')"));
assert(source.includes('const PAGE_SIZE=12'));
assert(source.includes("topic.visibility!=='public'"));

function makeUi(){
  const selectors=new Map();
  function el(dataset={}){
    const listeners=new Map();
    const classSet=new Set();
    return {dataset,listeners,classList:{
      add(c){classSet.add(c)},remove(c){classSet.delete(c)},
      toggle(c,force){if(force===undefined? !classSet.has(c):force)classSet.add(c);else classSet.delete(c)},
      contains(c){return classSet.has(c)}
    },addEventListener(t,fn){listeners.set(t,fn)},click(){return listeners.get('click')?.()},
    textContent:'',innerHTML:'',value:'',disabled:false};
  }
  const ids=Object.fromEntries(['grid','status','searchInput','resultMeta','sectionTitle','moreBtn','refreshBtn'].map(id=>[id,el()]));
  const views=['all','community'].map(v=>el({view:v}));
  const sorts=['newest','popular','community','remix'].map(v=>el({sort:v}));
  const categoryNames=['all','sports','manga_anime','movie_tv','food','game','music','books','travel','tech','lifestyle','other'];
  const categories=categoryNames.map(v=>el({category:v}));
  for(const selector of ['.hero h1','.hero p','.privacyNote','.createLink','.footer a'])selectors.set(selector,el());
  for(const btn of [...views,...sorts]){
    const key=btn.dataset.view?'view':'sort';
    selectors.set('[data-'+key+'="'+btn.dataset[key]+'"]',btn);
  }
  return {ids,views,sorts,categories,document:{
    documentElement:{lang:'ja'},
    getElementById(id){return ids[id]},
    querySelector(selector){if(!selectors.has(selector))throw Error('Unknown selector '+selector);return selectors.get(selector)},
    querySelectorAll(selector){return selector==='.categoryBtn'?categories:selector==='.browseTab'?views:selector==='.sortBtn'?sorts:[]}
  }};
}

const sizes=[0,11,12,13,60,61,120,1000];
for(const size of sizes){
  const ui=makeUi();
  const publicRows=Array.from({length:size},(_,i)=>{
    const number=size-i;
    return {id:String(i).padStart(8,'0'),title:(i===size-1?'Special Target ':'Title ')+number,
      description:'Readable description',visibility:'public',
      published_at:new Date(Date.UTC(2026,0,1,0,0,0)+number*1000).toISOString(),
      snapshot_updated_at:'2026-01-01T00:00:00Z',language_code:'ja',score_scale:100,
      snapshot:{metadata:{category:i%3===0?'sports':'other'},rows:[{name:'Target '+i,scores:[70]}],criteria:[{name:'Quality'}]},
      show_community:i%2===0,allow_ratings:i%2===0,participants:i%9,remixCount:i%4};
  });
  const privateRows=[{id:'private',title:'PRIVATE MUST NOT LEAK',visibility:'private'},
    {id:'unlisted',title:'UNLISTED MUST NOT LEAK',visibility:'unlisted'}];
  const calls=[];
  let injectPrivate=false;
  const sb={async rpc(name,args){
    assert.equal(name,'discover_public_works_v1');
    calls.push({...args});
    let list=publicRows.slice();
    if(args.p_category!=='all')list=list.filter(t=>t.snapshot.metadata.category===args.p_category);
    if(args.p_view==='community')list=list.filter(t=>t.show_community&&t.allow_ratings);
    if(args.p_query){
      const q=args.p_query.toLowerCase();
      list=list.filter(t=>(t.title+' '+t.description+' '+t.snapshot.rows[0].name+' '+t.snapshot.criteria[0].name).toLowerCase().includes(q));
    }
    const newest=(a,b)=>b.published_at.localeCompare(a.published_at)||a.id.localeCompare(b.id);
    list.sort(args.p_sort==='popular'?
      (a,b)=>(b.participants+b.remixCount)-(a.participants+a.remixCount)||
        b.participants-a.participants||b.remixCount-a.remixCount||newest(a,b):
      args.p_sort==='community'?(a,b)=>b.participants-a.participants||newest(a,b):
      args.p_sort==='remix'?(a,b)=>b.remixCount-a.remixCount||newest(a,b):newest);
    const rows=list.slice(args.p_offset,args.p_offset+args.p_limit);
    if(injectPrivate&&args.p_offset===0)rows.push(privateRows[0],privateRows[1]);
    return {data:{rows,total:list.length,has_more:args.p_offset+args.p_limit<list.length,
      anchor:'2026-10-14T00:00:00Z'},error:null};
  }};
  const localeStore={getItem:()=>null};
  const sandbox={window:{SM_SUPABASE:{client:sb},SM_ANALYTICS:{event(){}},},
    document:ui.document,localStorage:localeStore,navigator:{language:'ja-JP'},
    console:{warn(){},error(){}},setTimeout:(fn)=>setTimeout(fn,0),clearTimeout,Intl,Date};
  vm.runInNewContext(source,sandbox,{filename:'cloud/discover.js'});
  async function settled(){
    for(let i=0;i<15;i++)await new Promise(r=>setTimeout(r,0));
  }
  const rendered=()=>Array.from(ui.ids.grid.innerHTML.matchAll(/<article class="workCard">/g)).length;
  await settled();
  assert.equal(calls.length,1,'one initial RPC request for '+size);
  assert.equal(calls[0].p_offset,0);
  assert.equal(calls[0].p_limit,12);
  assert.equal(rendered(),Math.min(12,size));
  assert(!ui.ids.grid.innerHTML.includes('PRIVATE MUST NOT LEAK'));
  assert(!ui.ids.grid.innerHTML.includes('UNLISTED MUST NOT LEAK'));
  if(size>12){
    ui.ids.moreBtn.click();
    await settled();
    assert.equal(rendered(),Math.min(size,24),'12 additional cards on Show More');
    assert.equal(calls[1].p_offset,12);
    assert.equal(calls[1].p_anchor,'2026-10-14T00:00:00Z');
    assert(new Set([...ui.ids.grid.innerHTML.matchAll(/href="public\.html\?id=(\w+)/g)].map(x=>x[1])).size>=12);
    ui.sorts[1].click();
    await settled();
    assert.equal(rendered(),12,'sort resets to 12 cards');
    assert.equal(calls.at(-1).p_sort,'popular');
    assert.equal(calls.at(-1).p_offset,0);
  }
  if(size>=13){
    ui.categories.find(x=>x.dataset.category==='sports').click();
    await settled();
    assert.equal(calls.at(-1).p_category,'sports');
    assert.equal(calls.at(-1).p_offset,0);
    ui.views[1].click();
    await settled();
    assert.equal(calls.at(-1).p_view,'community');
    ui.ids.searchInput.value='Special Target';
    ui.ids.searchInput.listeners.get('input')();
    await settled();
    assert.equal(calls.at(-1).p_query,'Special Target');
    assert.equal(calls.at(-1).p_offset,0);
  }
  // A backend configuration mistake must not put even a single Private row in the DOM.
  if(size===13){
    injectPrivate=true;
    ui.ids.refreshBtn.click();
    await settled();
    assert(ui.ids.grid.classList.contains('hidden'));
    assert(!ui.ids.grid.innerHTML.includes('PRIVATE MUST NOT LEAK'));
  }
  console.log('R40 pagination fixture',size,'PASS');
}
