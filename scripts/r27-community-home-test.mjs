import assert from 'node:assert/strict';
import {buildCommunitySheet,collectCommunityScores} from '../cloud/community-rating-model.js';

const topic={id:'57b432ed-fbf2-4261-b57d-9e0f27356d2e',
  title:'QA scoring',description:'Test',score_scale:10,weighted:false};
const items=[{id:'item-a',name:'Alpha'},{id:'item-b',name:'Beta'}];
const criteria=[{id:'crit-x',name:'Speed',weight:1},{id:'crit-y',name:'IQ',weight:1}];
const existing=[
  {item_id:'item-a',criterion_id:'crit-x',score:7},
  {item_id:'item-a',criterion_id:'crit-y',score:10}
];
const context={topic,items,criteria};
const sheet=buildCommunitySheet(topic,items,criteria,existing);
assert.equal(sheet.title,topic.title);
assert.equal(sheet.sourceTopicId,topic.id);
assert.deepEqual(sheet.rows[0].scores,[7,10]);
assert.deepEqual(sheet.rows[1].scores,[null,null]);
assert.deepEqual(collectCommunityScores(sheet,context),{
  completed:1,entries:[
    {item_id:'item-a',criterion_id:'crit-x',score:7},
    {item_id:'item-a',criterion_id:'crit-y',score:10}
  ]
});
// HOME sortable table physically reorders rows: stable IDs must still win.
sheet.rows.reverse();
sheet.rows[1].scores[0]=8;
const afterSort=collectCommunityScores(sheet,context);
assert.equal(afterSort.completed,1);
assert.equal(afterSort.entries[0].item_id,'item-a');
assert.equal(afterSort.entries[0].score,8);
assert.equal(afterSort.entries[1].criterion_id,'crit-y');
assert.equal(afterSort.entries.length,2);
assert.throws(()=>collectCommunityScores({
 ...sheet,rows:[{...sheet.rows[0],sourceItemId:'item-a'},sheet.rows[1]]
},context),/items no longer match/);
assert.throws(()=>collectCommunityScores({
 ...sheet,cols:['Tampered',sheet.cols[1]]
},context),/structure changed/);
assert.throws(()=>collectCommunityScores({
 ...sheet,rows:sheet.rows.map(r=>({...r,scores:[100,1]}))
},context),/published rating scale/);
const untouched=buildCommunitySheet(topic,items,criteria,[]);
assert.equal(untouched.rows[0].scores[0],null);
console.log('R27 Community Home sorted scores, structure and identity tests PASS');
