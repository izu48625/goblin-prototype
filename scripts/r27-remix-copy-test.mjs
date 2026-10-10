
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../cloud/remix.js',import.meta.url),'utf8');
const stored=new Map();
const sandbox={
  window:{},
  localStorage:{
    getItem:key=>stored.get(key)??null,
    setItem:(key,value)=>stored.set(key,value)
  },
  Date,Math,JSON
};
vm.runInNewContext(source,sandbox,{filename:'cloud/remix.js'});
const {buildSheet,saveSheet}=sandbox.window.SM_REMIX;
const snapshot={criteria:[{name:'Speed',weight:1}],rows:[{name:'Alpha',scores:[9]}],scale:10};
const topic={id:'57b432ed-fbf2-4261-b57d-9e0f27356d2e',title:'GOAT (Remix) （Remix） (Remix)',score_scale:10,description:'QA'};
const items=[{id:'i1',name:'Alpha',position:0}],criteria=[{id:'c1',name:'Speed',weight:1,position:0}];
const result=buildSheet(topic,snapshot,criteria,items,'ja');
assert.equal(result.title,'GOAT（コピー）','Stacked Remix suffixes survived');
assert.equal(result.sourceTopicId,topic.id,'Remix lineage was lost');
assert.equal(result.sourceCommunity.itemIds[0],'i1');
assert.equal(result.rows[0].scores[0],null,'Original score was wrongly copied');
const en=buildSheet({...topic,title:result.title},snapshot,criteria,items,'en');
assert.equal(en.title,'GOAT (Copy)');
assert.equal(topic.title,'GOAT (Remix) （Remix） (Remix)','Source topic was modified');
saveSheet(result);
assert.equal(JSON.parse(stored.get('statsMakerV014Library')).sheets[0].title,'GOAT（コピー）');
console.log('R27 copy labels and lineage regression PASS');
