import assert from 'node:assert/strict';
import {createProject} from '../app/src/core/project.js';
import {getSourceSheet,getSourceModel,syncSourceProject} from '../app/src/core/source-sync.js';

const storage=new Map();
globalThis.localStorage={
  getItem:k=>storage.get(k)??null,
  setItem:(k,v)=>storage.set(k,String(v)),
  removeItem:k=>storage.delete(k)
};
const unrelated={
  id:'sheet-other',title:'WRONG SOURCE - DO NOT USE',
  cols:['Score'],rows:[{name:'Other Person',scores:[97]}],
  weights:[1],scale:100,rankMetric:'avg',compare:[],weighted:false
};
const original={
  id:'sheet-original',title:'RESTORED ORIGINAL SOURCE',
  cols:['Skill'],rows:[{name:'True Subject',scores:[81]}],
  weights:[1],scale:100,rankMetric:'avg',compare:[],weighted:false
};
const library=sheets=>storage.set('statsMakerV014Library',
  JSON.stringify({activeId:unrelated.id,sheets}));
library([unrelated]);

const chart=createProject('bar');
chart.meta.title='SAVED CHART SNAPSHOT';
chart.data.items=[{id:'item-preserved',name:'Snapshot Subject',value:55}];
chart.settings.sourceLinked=true;
chart.settings.sourceSheetId=original.id;
const snapshot=structuredClone(chart);
assert.equal(getSourceSheet(chart),null,'Orphaned graph silently rebound to active sheet');
assert.equal(getSourceModel(chart),null,'Orphaned graph incorrectly imported unrelated data');
assert.deepEqual(syncSourceProject(chart),snapshot,
  'Orphaned graph should preserve its last saved data and source ID');
assert(!JSON.stringify(chart).includes('WRONG SOURCE'),'Orphaned graph imported unrelated data');

const community=createProject('bar');
community.settings.communitySnapshot=true;
assert.equal(getSourceSheet(community),null,
  'Community chart must never attach itself to a local Home sheet');

// Existing graphs that predate tracked source IDs retain their legacy behavior.
const legacy=createProject('bar');
assert.equal(getSourceSheet(legacy)?.id,unrelated.id,
  'Legacy unlinked chart lost backwards-compatible active-sheet fallback');

// Restoring the exact original ID reconnects without reassigning identities.
library([unrelated,original]);
assert.equal(getSourceSheet(chart)?.id,original.id,'Original source failed to reconnect');
syncSourceProject(chart);
assert.equal(chart.settings.sourceSheetId,original.id,'Restoring source rewrote source ID');
assert.equal(chart.meta.title,original.title,'Restored source title not applied');
assert(chart.data.items.some(x=>x.name==='True Subject'&&x.value===81),
  'Restored source values were not synchronized');
assert(!chart.data.items.some(x=>x.name==='Other Person'),
  'Different active Home sheet contaminated the restored graph');
console.log('R29 chart source safety PASS: missing source preserved; exact source restored; legacy compatible');
