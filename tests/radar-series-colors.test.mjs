import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRadarProject} from "../app/src/core/project.js";
import {syncSourceProject} from "../app/src/core/source-sync.js";

const sheet={
  id:"attributes-6",title:"属性比較",scale:10,weighted:false,
  cols:["攻撃","防御","機動"],
  rows:[
    {name:"火",scores:[10,3,6]},
    {name:"水",scores:[6,6,5]},
    {name:"風",scores:[7,6,10]}
  ],
  compare:[0,1,2],weights:[1,1,1]
};

test("radar series uses Home scores and preserves custom colors by raw row ID",()=>{
  const project=createRadarProject();
  syncSourceProject(project,{},sheet);
  assert.deepEqual(project.data.series.map(s=>s.name),["火","水","風"]);

  project.settings.radarSeriesColors={"0":"#FF4400","2":"#22AACC"};
  project.data.series[0].color="#FF4400";
  project.data.series[2].color="#22AACC";

  syncSourceProject(project,{seriesIndices:[2,0]},sheet);
  assert.deepEqual(project.data.series.map(s=>[s.name,s.color]),[
    ["風","#22AACC"],["火","#FF4400"]
  ]);
  assert.deepEqual(project.data.series.map(s=>s.values),[[7,6,10],[10,3,6]]);

  syncSourceProject(project,{seriesIndices:[1]},sheet);
  syncSourceProject(project,{seriesIndices:[0,2]},sheet);
  assert.deepEqual(project.data.series.map(s=>s.color),["#FF4400","#22AACC"]);
});

test("invalid persisted colors fall back to the default palette",()=>{
  const project=createRadarProject();
  project.settings.radarSeriesColors={"0":"not-a-color"};
  syncSourceProject(project,{},sheet);
  assert.match(project.data.series[0].color,/^#[0-9a-f]{6}$/i);
  assert.notEqual(project.data.series[0].color,"not-a-color");
});

test("linked editor exposes per-target color pickers and PNG renderer uses series color",()=>{
  const root=new URL("../",import.meta.url);
  const editor=readFileSync(new URL("app/src/editor/editor.js",root),"utf8");
  const svg=readFileSync(new URL("app/src/visualizations/radar.js",root),"utf8");
  const exportFile=readFileSync(new URL("app/src/core/export.js",root),"utf8");
  assert.match(editor,/frag\.appendChild\(linkedRadarColorControls\(p\)\)/);
  assert.match(editor,/x\.settings\.radarSeriesColors=/);
  assert.match(svg,/poly\.setAttribute\("stroke",color\)/);
  assert.match(exportFile,/const color=s\.color\|\|c\.accent/);
});
