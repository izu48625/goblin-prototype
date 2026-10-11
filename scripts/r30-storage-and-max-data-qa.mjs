import assert from 'node:assert/strict';
import {createProject} from '../app/src/core/project.js';
import {getProject,listProjects,saveProject,deleteProject} from '../app/src/core/store.js';
import {getSourceModel,syncSourceProject} from '../app/src/core/source-sync.js';

const PROJECT_KEY='statsMakerV2Projects';
const HOME_KEY='statsMakerV014Library';
const memory=new Map();
let simulateQuota=false;
globalThis.localStorage={
  getItem:k=>memory.get(k)??null,
  setItem(k,v){
    if(simulateQuota && k===PROJECT_KEY){
      const e=new Error('Storage quota exceeded');e.name='QuotaExceededError';throw e;
    }
    memory.set(k,String(v));
  },
  removeItem:k=>memory.delete(k)
};

const stored=createProject('bar');
stored.meta.title='PRECIOUS ORIGINAL CHART';
saveProject(stored);
const originalRaw=memory.get(PROJECT_KEY);
const additional=createProject('ring');
saveProject(additional);
assert.equal(listProjects().length,2);
assert.equal(getProject(stored.id)?.meta.title,'PRECIOUS ORIGINAL CHART');

simulateQuota=true;
const beforeQuota=memory.get(PROJECT_KEY);
assert.throws(()=>saveProject(createProject('radar')),/quota/i);
assert.equal(memory.get(PROJECT_KEY),beforeQuota,
  'Quota error should leave the last valid committed project list intact');
simulateQuota=false;

const corruptVariants=[
  '{not-json', 'null', '{}', '[]x', '[null]',
  JSON.stringify([{id:'',meta:{}}]),
  JSON.stringify([{id:'duplicates',meta:{}},{id:'duplicates',meta:{}}]),
  JSON.stringify([{id:'missing-meta'}]),
  JSON.stringify({projects:[stored]})
];
for(const raw of corruptVariants){
  memory.set(PROJECT_KEY,raw);
  assert.throws(()=>saveProject(createProject('bar')),/blocked to protect previous work/,
    'Corrupt storage must not be replaced by a single new project');
  assert.throws(()=>deleteProject(stored.id),/blocked to protect previous work/,
    'Corrupt storage must not be replaced by filtered empty data');
  assert.equal(memory.get(PROJECT_KEY),raw,
    'Corrupt bytes changed after attempted chart write/delete');
}
memory.set(PROJECT_KEY,beforeQuota);
assert.equal(getProject(stored.id)?.meta.title,'PRECIOUS ORIGINAL CHART');
assert.equal(listProjects().length,2,'Valid existing projects were not recovered unchanged');

// Exercise the official maximum 40 subjects x 10 criteria without touching
// production user projects, Remote Auth, topics, or Community scoring.
const types=['ranking-card','stat-card','bar','radar','quadrant',
  'dot','range','scatter','tier-list','ring'];
for(const scale of [100,10]){
  const source={
    id:'max-source-'+scale,title:'MAX 40 x 10 '+scale,desc:'QA only',
    cols:Array.from({length:10},(_,i)=>'Criterion '+(i+1)),
    rows:Array.from({length:40},(_,i)=>({
      name:'Subject '+String(i+1).padStart(2,'0'),
      note:'Notes '+i,image:'',
      scores:Array.from({length:10},(_,j)=>Number((((i*17+j*11)%101)*scale/100).toFixed(1)))
    })),
    weights:Array.from({length:10},()=>1),
    scale,rankMetric:'avg',compare:[],weighted:false
  };
  memory.set(HOME_KEY,JSON.stringify({activeId:source.id,sheets:[source]}));
  const model=getSourceModel(createProject('bar'));
  assert.equal(model.rows.length,40);
  assert.equal(model.criteria.length,10);
  assert.equal(model.rows[39].scores.length,10);
  for(const type of types){
    const project=createProject(type);
    syncSourceProject(project,{},source);
    assert.equal(project.settings.sourceSheetId,source.id,
      type+' lost its original source sheet ID');
    assert.equal(project.settings.sourceLinked,true);
    assert(!JSON.stringify(project).includes('undefined'));
    if(['ranking-card','bar','dot','tier-list','quadrant','scatter'].includes(type)){
      assert.equal(project.data.items.length,40,
        type+' did not retain all 40 eligible source subjects');
    }
    if(type==='radar')assert.equal(project.data.axes.length,10);
    if(type==='ring')assert.equal(project.data.items.length,10);
    if(type==='stat-card')assert.equal(project.data.stats.length,10);
    saveProject(project);
    const restored=getProject(project.id);
    assert.equal(restored.type,type);
    assert.deepEqual(restored.data,project.data,
      type+' data mutated during local save/reload');
    assert.equal(restored.settings.sourceSheetId,source.id);
    assert.equal(JSON.parse(memory.get(HOME_KEY)).sheets[0].rows.length,40,
      type+' changed the original Home library');
  }
  const all=JSON.parse(memory.get(PROJECT_KEY));
  assert(all.some(p=>p.id===stored.id),'Existing chart disappeared during 40x10 checks');
  console.log('R30 max data PASS: 40x10 scale '+scale+'; all ten official graph types');
}
assert.equal(JSON.parse(originalRaw)[0].id,stored.id);
console.log('R30 storage guard PASS: '+corruptVariants.length+
  ' corrupt fixtures blocked, quota atomic, original charts preserved');
