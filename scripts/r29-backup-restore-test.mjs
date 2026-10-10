import assert from 'node:assert/strict';
import {createProject} from '../app/src/core/project.js';
import {readProjectJSON} from '../app/src/core/export.js';
import {getProject,saveProject} from '../app/src/core/store.js';

const items=new Map();
globalThis.localStorage={
  getItem:key=>items.get(key)??null,
  setItem:(key,value)=>items.set(key,String(value)),
  removeItem:key=>items.delete(key)
};
const TYPES=[
  'ranking-card','stat-card','bar','radar','quadrant','dot','range',
  'scatter','tier-list','ring','heatmap','waffle','stat-board'
];
function fileFrom(data){
  return new Blob([typeof data==='string'?data:JSON.stringify(data)],{type:'application/json'});
}
const unchanged=createProject('bar');
unchanged.meta.title='R29 Original Chart—Keep';
saveProject(unchanged);
const baseline=items.get('statsMakerV2Projects');
let validCount=0;
for(const type of TYPES){
  const project=createProject(type);
  project.meta.title='R29 '+type;
  const decoded=await readProjectJSON(fileFrom(project));
  assert.equal(decoded.type,type);
  assert.equal(decoded.meta.title,project.meta.title);
  assert.deepEqual(decoded.canvas,project.canvas);
  assert.deepEqual(decoded.data,project.data);
  assert.deepEqual(decoded.settings,project.settings);
  validCount++;
}
assert.equal(validCount,13,'Existing hidden/retired graph backups must still restore safely');

const invalid=[
  'not JSON','null','[]','{}',
  '{"type":"bar"}',
  {...createProject('bar'),type:'not-a-template'},
  {...createProject('bar'),data:null},
  {...createProject('bar'),meta:[]},
  {...createProject('bar'),settings:null},
  {...createProject('bar'),canvas:{width:0,height:500}},
  {...createProject('bar'),canvas:{width:999999,height:500}},
  {...createProject('bar'),meta:{title:1}},
  {...createProject('bar'),meta:{title:'X'.repeat(1100)}}
];
for(const value of invalid){
  await assert.rejects(()=>readProjectJSON(fileFrom(value)),Error,
    'Malformed backup should never replace or crash an open project');
  assert.equal(items.get('statsMakerV2Projects'),baseline,
    'Malformed backup modified saved local projects');
}
let readAttempted=false;
const oversized={
  size:50*1024*1024+1,
  async text(){readAttempted=true;return '{}'}
};
await assert.rejects(()=>readProjectJSON(oversized),/backup size/);
assert.equal(readAttempted,false,'Oversized file was read into memory');
const restored=await readProjectJSON(fileFrom(createProject('radar')));
restored.id=unchanged.id;
saveProject(restored);
assert.equal(getProject(unchanged.id)?.type,'radar',
  'Valid restore must replace only its selected project ID');
assert.equal(JSON.parse(items.get('statsMakerV2Projects')).length,1);
console.log('R29 backup/import QA PASS: '+validCount+
  ' compatible chart backups, '+invalid.length+
  ' corrupt backups rejected, oversized refused, project persistence isolated');
