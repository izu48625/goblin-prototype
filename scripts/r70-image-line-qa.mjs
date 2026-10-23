import assert from "node:assert/strict";
import {createImageLineProject,createProject} from "../app/src/core/project.js";
import {syncSourceProject} from "../app/src/core/source-sync.js";
import {imageLineItems,renderImageLineCanvas} from "../app/src/core/image-line.js";
import {readProjectJSON} from "../app/src/core/export.js";

// New template starts in a usable independent mode with bounded settings.
const blank=createProject("image-line");
assert.equal(blank.type,"image-line");
assert.deepEqual([blank.canvas.width,blank.canvas.height],[1600,900]);
assert.equal(blank.data.items.length,8);
assert.equal(imageLineItems(blank).length,8);
assert.equal(imageLineItems({...blank,data:{items:[{value:null},{value:""},{value:9}]} }).length,1);

// Source-linked creation preserves Home row order and original row artwork.
const image="data:image/png;base64,YWJj";
const sheet={
  id:"qa-sheet",title:"Series review",desc:"",scale:10,
  cols:["Overall"],rows:[
    {name:"Opening",scores:[7],image},
    {name:"Middle",scores:[2],image:""},
    {name:"Finale",scores:[9],image}
  ]
};
const linked=createImageLineProject();
syncSourceProject(linked,{},sheet);
assert.equal(linked.settings.sourceLinked,true);
assert.equal(linked.settings.max,10);
assert.deepEqual(linked.data.items.map(x=>x.name),["Opening","Middle","Finale"]);
assert.equal(linked.data.items[0].imageData,image);
linked.data.items[0].imageRef="img-local-override";
syncSourceProject(linked,{metricKey:"c:0"},sheet);
assert.equal(linked.data.items[0].imageRef,"img-local-override");

// Undo/reload-safe JSON structure and share/export compatibility.
const restored=await readProjectJSON({
  size:2000,text:async()=>JSON.stringify(blank)
});
assert.equal(restored.type,"image-line");

// Canvas renderer is used by both preview and native export.
// Stub Canvas 2D and decoding so the check runs without a browser.
const events=[];
const ctx=new Proxy({},{
  get(obj,key){
    if(key==="measureText")return str=>({width:String(str).length*14});
    if(key in obj)return obj[key];
    return (...args)=>events.push({operation:key,args});
  },
  set(obj,key,value){obj[key]=value;return true}
});
globalThis.document={
  createElement:tag=>{
    assert.equal(tag,"canvas");
    return {width:0,height:0,getContext:()=>ctx};
  }
};
globalThis.Image=class{
  width=200;height=100;
  set src(value){this.value=value;queueMicrotask(()=>this.onload?.())}
};
const preview=createImageLineProject();
preview.data.items[0].imageData=image;
const canvas=await renderImageLineCanvas(preview);
assert.deepEqual([canvas.width,canvas.height],[1600,900]);
assert.ok(events.some(e=>e.operation==="drawImage"),"embedded art should be drawn");
assert.ok(events.some(e=>e.operation==="lineTo"),"score line should be drawn");
assert.ok(events.some(e=>e.operation==="fillText"),"scores and labels should be drawn");
events.length=0;
preview.settings.showImages=false;
await renderImageLineCanvas(preview);
assert.equal(events.filter(e=>e.operation==="drawImage").length,0);
console.log("Image Line template/source/image/Canvas/JSON checks passed");
