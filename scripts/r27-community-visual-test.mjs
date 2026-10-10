import assert from 'node:assert/strict';

// The visual module registers an optional UI event. No browser/network needed
// to exercise its pure project conversion.
globalThis.window={addEventListener(){}};
const [{createCommunityVisualProject},{getSourceModel,getSourceSheet}]=await Promise.all([
  import('../cloud/rate-visuals.js'),
  import('../app/src/core/source-sync.js')
]);
const types=['ranking-card','stat-card','bar','radar','dot','scatter','quadrant','range','tier-list','ring'];
const topic='57b432ed-fbf2-4261-b57d-9e0f27356d2e';
const sheet={
  id:'community_'+topic,
  title:'User-scored Community topic',
  desc:'Private scores only',
  cols:['Shoot','Pass','Vision'],
  rows:[
    {name:'Example A',image:'',note:'',scores:[8,9,10]},
    {name:'Example B',image:'',note:'',scores:[6,7,5]},
    {name:'Example C',image:'',note:'',scores:[null,null,null]}
  ],
  compare:[0,1],
  scale:10,
  weighted:false,
  weights:[1,1,1]
};
const serialized=JSON.stringify(sheet);
for(const type of types){
  const project=createCommunityVisualProject(type,sheet);
  assert.equal(project.type,type);
  assert.equal(project.settings.sourceLinked,false);
  assert.equal(project.settings.communitySnapshot,true);
  assert.equal(project.settings.sourceSheetId,undefined);
  assert.equal(getSourceSheet(project),null,'Community snapshot rebound to Home sheet');
  assert.equal(getSourceModel(project),null,'Community snapshot exposes unrelated live Home model');
  assert.equal(project.publish?.visibility,'private');
  assert.equal(project.meta.title.length>0,true);
  assert.notEqual(JSON.stringify(project.data),'{}',type+' not populated');
  assert.equal(JSON.stringify(sheet),serialized,'visualization mutated input rating data');
}
const radar=createCommunityVisualProject('radar',sheet);
assert.equal(radar.data.axes.length,3);
assert.equal(radar.data.series.length,2);
assert.deepEqual(radar.data.series[0].values,[8,9,10]);

assert.throws(()=>createCommunityVisualProject('bar',{...sheet,rows:sheet.rows.map(r=>({...r,scores:[null,null,null]}))}),/Enter scores/);
console.log('R27 Community visualization snapshot isolation PASS (10 types)');
