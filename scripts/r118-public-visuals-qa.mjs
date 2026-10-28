import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createProject} from "../app/src/core/project.js";
import {getSourceModel,syncSourceProject} from "../app/src/core/source-sync.js";
import {EXTENSIONS,EXTENSION_GROUP_ORDER} from "../app/src/extension-catalog.js";

// Regression: public creator scores are snapshot-linked, not the viewer's Home.
const sheet={
  id:"published_test_topic",title:"Creator's published work",desc:"Public snapshot",
  cols:["Attack","Defense","Development"],weights:[1,2,1],
  scale:10,weighted:true,rankMetric:"avg",compare:[],
  rows:[
    {name:"A",scores:[7,9,4],image:"data:image/jpeg;base64,aGVsbG8=",note:""},
    {name:"B",scores:[9,8,10],image:"",note:""},
    {name:"C",scores:[6,5,3],image:"",note:""}
  ]
};
const types=EXTENSIONS.map(([group,type])=>type);
assert.equal(new Set(types).size,11,"Expected 11 distinct Visual Tools");
assert.equal(EXTENSION_GROUP_ORDER.length,5);
for(const type of types){
  const p=createProject(type);
  syncSourceProject(p,{},sheet);
  p.settings.publicSourceSheet=structuredClone(sheet);
  p.settings.publicSourceTopicId="topic-test";
  const model=getSourceModel(p);
  assert(model,"Public source did not survive project persistence");
  assert.equal(model.sheet.id,sheet.id,"Viewer Home source leaked into published snapshot");
  assert.equal(model.rows.length,3);
  assert.equal(model.criteria.length,3);
  assert.equal(model.scale,10);
  assert.equal(model.average(model.rows[0]),7.3);
  assert.equal(p.publish.visibility,"private");
  if(type==="tier-list"){
    assert.equal(p.data.items[0].imageData,sheet.rows[0].image,
      "Target thumbnails were dropped when generating Tier from a source");
  }
}
const malformed=createProject("bar");
malformed.settings.publicSourceSheet={rows:null,cols:null};
assert.equal(getSourceModel(malformed),null,
  "Invalid public snapshot must not fall back to the viewer's Home sheet");

const html=await readFile(new URL("../public.html",import.meta.url),"utf8");
const pageJs=await readFile(new URL("../cloud/public.js",import.meta.url),"utf8");
const picker=await readFile(new URL("../cloud/public-extensions.js",import.meta.url),"utf8");
assert.match(html,/cloud\/public-extensions\.js/);
assert.match(pageJs,/id="visualToolsBtn"/);
assert.match(picker,/publicSourceSheet=published/);
assert.match(picker,/saveProject\(project\)/);
assert(!picker.includes(".from('topics').update("),"Visual tools should not update published topics");
console.log("R118 Public Visual Tools QA PASS: 11 formats, source isolation, scale, weighting, Tier images, public entrypoint");
