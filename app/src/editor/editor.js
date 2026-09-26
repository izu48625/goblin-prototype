import {t,getLanguage,toggleLanguage,applyI18n} from "../core/i18n.js";
import {getProject,saveProject} from "../core/store.js";
import {THEMES,CANVAS_PRESETS,applyTheme,applyCanvasPreset,newItemId,newStatId,newAxisId,newSeriesId} from "../core/project.js";
import {History} from "../core/history.js";
import {getVisualization} from "../visualizations/registry.js";
import {exportPreview,exportProjectJSON,readProjectJSON,isIOS} from "../core/export.js";
import {createImageManager} from "./image-editor.js";
import {createDataImport} from "./data-import.js";
import {createSpreadsheetEditor} from "./spreadsheet-editor.js";
import {getSourceModel,getMetricOptions,getCriterionOptions,getSubjectOptions,syncSourceProject} from "../core/source-sync.js";

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const id=params.get("id");
let project=getProject(id);
if(!project){
  alert(getLanguage()==="ja"?"Projectが見つかりません":"Project not found");
  location.href="../index.html?extensions=1";
  throw new Error("Project not found");
}

const history=new History(project,50);
let activePanel="data";
let zoom=.55;
let zoomTouched=false;
let saveTimer=null;
let previewRenderToken=0;
let exportPreviewUrl=null;
let exportPreviewFile=null;
const sectionCollapseState=new Map();
const mobileQuery=window.matchMedia("(max-width:760px)");
let lastMobileMode=mobileQuery.matches;
let resizeTimer=null;

function current(){return history.present}

function mutate(fn,{historyCommit=true,panels=true}={}){
  const before=current();
  const oldCanvas=`${before.canvas.width}x${before.canvas.height}`;

  const next=structuredClone(before);
  fn(next);
  next.meta.updatedAt=new Date().toISOString();

  const newCanvas=`${next.canvas.width}x${next.canvas.height}`;
  project=historyCommit?history.commit(next):history.replace(next);

  queueSave();
  render({panels});

  if(!zoomTouched && oldCanvas!==newCanvas){
    requestAnimationFrame(()=>{
      fitZoomToStage();
      renderPreview();
    });
  }
}

function setSaveState(key,mode=""){
  const text=t(key);
  const desktop=$("saveState");
  const mobile=$("mobileSaveState");

  if(desktop){
    desktop.textContent=text;
    desktop.className=`save-state ${mode}`.trim();
  }

  if(mobile){
    mobile.textContent=text;
    mobile.className=`mobile-save-state ${mode}`.trim();
  }
}

function queueSave(){
  setSaveState("save.saving","saving");
  clearTimeout(saveTimer);

  saveTimer=setTimeout(()=>{
    try{
      project=saveProject(current());
      history.replace(project);
      setSaveState("save.saved");
      syncHistoryButtons();
    }catch(e){
      console.error(e);
      setSaveState("save.error","error");
    }
  },650);
}

function cssVars(){
  const p=current();
  return `
    --visual-bg:${p.canvas.transparent?"transparent":p.style.background};
    --visual-surface:${p.style.surface};
    --visual-text:${p.style.primary};
    --visual-muted:${p.style.secondary};
    --visual-accent:${p.style.accent};
    --visual-border:${p.style.border};
    --visual-font:${p.style.typography?.fontFamily||"system-ui"};
    --title-scale:${Number(p.style.typography?.titleScale)||1};
    --body-scale:${Number(p.style.typography?.bodyScale)||1};
  `;
}

function fitZoomToStage(){
  const stage=$("canvasStage");
  const p=current();
  if(!stage||!stage.clientWidth||!stage.clientHeight)return;
  const pad=36;
  const fitW=(stage.clientWidth-pad)/p.canvas.width;
  const fitH=(stage.clientHeight-pad)/p.canvas.height;
  zoom=Math.max(.18,Math.min(.82,fitW,fitH));
}

async function renderPreview(){
  const p=current();
  const viz=getVisualization(p.type);
  if(!viz)return;

  const token=++previewRenderToken;
  const shell=$("canvasShell");

  shell.style.width=`${p.canvas.width}px`;
  shell.style.height=`${p.canvas.height}px`;
  shell.style.transform=`scale(${zoom})`;
  shell.style.margin=`${-(p.canvas.height*(1-zoom))/2}px ${-(p.canvas.width*(1-zoom))/2}px`;

  const target=$("previewRoot");
  target.setAttribute("style",cssVars());
  target.style.containerType="inline-size";

  // Render into a detached root first. Image-backed visualizations are async;
  // this prevents an older render from overwriting a newer edit.
  const scratch=document.createElement("div");
  scratch.setAttribute("style",cssVars());
  scratch.style.containerType="inline-size";

  try{
    await viz.render(p,scratch);
    if(token!==previewRenderToken)return;

    target.replaceChildren(...scratch.childNodes);
  }catch(e){
    console.error(e);
    if(token===previewRenderToken){
      target.innerHTML=`<div style="padding:40px;color:#ff9999">Preview Error</div>`;
    }
  }

  $("zoomLabel").textContent=`${Math.round(zoom*100)}%`;
  $("typeBadge").textContent=p.type;
}

function field(label,value,onInput,type="text",attrs={}){
  const wrap=document.createElement("div");
  wrap.className="field";
  const l=document.createElement("label");
  l.textContent=label;
  const input=document.createElement("input");
  input.className="input";
  input.type=type;
  input.value=value??"";
  Object.entries(attrs).forEach(([k,v])=>input.setAttribute(k,v));
  input.addEventListener("change",()=>onInput(input.value));
  input.addEventListener("input",()=>{
    if(type==="color")onInput(input.value,true);
  });
  wrap.append(l,input);
  return wrap;
}

function textareaField(label,value,onChange){
  const wrap=document.createElement("div");
  wrap.className="field";
  const l=document.createElement("label");l.textContent=label;
  const ta=document.createElement("textarea");ta.className="textarea";ta.value=value??"";
  ta.addEventListener("change",()=>onChange(ta.value));
  wrap.append(l,ta);
  return wrap;
}

function section(title,{collapsedDefault=false}={}){
  const key=`${current().type}:${activePanel}:${title}`;
  const defaultCollapsed=collapsedDefault || title==="Paste / CSV";
  const collapsed=sectionCollapseState.has(key)
    ? sectionCollapseState.get(key)
    : defaultCollapsed;

  const box=document.createElement("section");
  box.className=`panel-section ${collapsed?"collapsed":""}`;

  const h=document.createElement("button");
  h.type="button";
  h.className="panel-section-title panel-section-toggle";
  h.setAttribute("aria-expanded",collapsed?"false":"true");

  const label=document.createElement("span");
  label.textContent=title;

  const chevron=document.createElement("span");
  chevron.className="section-chevron";
  chevron.textContent=collapsed?"＋":"−";

  h.append(label,chevron);
  h.addEventListener("click",()=>{
    const next=!box.classList.contains("collapsed");
    box.classList.toggle("collapsed",next);
    sectionCollapseState.set(key,next);
    h.setAttribute("aria-expanded",next?"false":"true");
    chevron.textContent=next?"＋":"−";
  });

  box.appendChild(h);
  return box;
}

function numberValue(v){const n=Number(v);return Number.isFinite(n)?n:0}

function toggleOption(label,on,onToggle){
  const b=document.createElement("button");
  b.type="button";
  b.className=`option-toggle ${on?"on":""}`;
  b.innerHTML=`<span></span><i></i>`;
  b.querySelector("span").textContent=label;
  b.addEventListener("click",onToggle);
  return b;
}

function sourceSelectField(label,options,currentValue,onChange){
  const wrap=document.createElement("label");
  wrap.className="field source-select-field";
  const span=document.createElement("span");
  span.className="source-select-label";
  span.textContent=label;
  const select=document.createElement("select");
  select.className="select";
  options.forEach(opt=>{
    const option=document.createElement("option");
    option.value=String(opt.value);
    option.textContent=opt.label;
    option.selected=String(opt.value)===String(currentValue);
    select.appendChild(option);
  });
  select.addEventListener("change",()=>onChange(select.value));
  wrap.append(span,select);
  return wrap;
}

function sourceSubjectChecks(model,selected,onChange){
  const wrap=document.createElement("div");
  wrap.className="source-subject-grid";
  const selectedSet=new Set((selected||[]).map(Number));
  model.rows.forEach(row=>{
    const label=document.createElement("label");
    label.className="source-check";
    const input=document.createElement("input");
    input.type="checkbox";
    input.checked=selectedSet.has(row.rawIndex);
    input.addEventListener("change",()=>{
      const next=new Set(selectedSet);
      if(input.checked)next.add(row.rawIndex);
      else next.delete(row.rawIndex);
      onChange([...next].slice(0,6));
    });
    const text=document.createElement("span");
    text.textContent=row.name;
    label.append(input,text);
    wrap.appendChild(label);
  });
  return wrap;
}

function choiceButtons(options,currentValue,onChange,className="segmented"){
  const wrap=document.createElement("div");
  wrap.className=className;
  options.forEach(({value,label})=>{
    const b=document.createElement("button");
    b.type="button";
    b.className=className==="segmented"?`seg-btn ${value===currentValue?"active":""}`:`topn-btn ${value===currentValue?"active":""}`;
    b.textContent=label;
    b.addEventListener("click",()=>onChange(value));
    wrap.appendChild(b);
  });
  return wrap;
}

const RANKING_TEMPLATES={
  minimal:{theme:"light",font:"system-ui",preview:"linear-gradient(135deg,#f5f6f8,#fff)"},
  sports:{theme:"sports",font:"system-ui",preview:"linear-gradient(135deg,#071b2b,#0d314a)"},
  dark:{theme:"black",font:"system-ui",preview:"linear-gradient(135deg,#050505,#181818)"},
  newspaper:{theme:"light",font:"Georgia, serif",preview:"linear-gradient(135deg,#f2eee4,#fffdf6)"},
  neon:{theme:"neon",font:"system-ui",preview:"linear-gradient(135deg,#080a16,#281443)"}
};

function applyRankingTemplate(project,templateId){
  const def=RANKING_TEMPLATES[templateId]||RANKING_TEMPLATES.sports;
  project.settings.template=templateId;
  applyTheme(project,def.theme);
  project.style.typography.fontFamily=def.font;
}


const STAT_TEMPLATES={
  sports:{theme:"sports",font:"system-ui"},
  gaming:{theme:"neon",font:"system-ui"},
  minimal:{theme:"light",font:"system-ui"},
  dark:{theme:"black",font:"system-ui"},
  neon:{theme:"neon",font:"system-ui"},
  classic:{theme:"dark",font:"Georgia, serif"}
};
function applyStatTemplate(project,templateId){
  const def=STAT_TEMPLATES[templateId]||STAT_TEMPLATES.sports;
  project.settings.template=templateId;
  applyTheme(project,def.theme);
  project.style.typography.fontFamily=def.font;
}

function swapRows(list,index,delta){
  const next=index+delta;
  if(next<0||next>=list.length)return;
  [list[index],list[next]]=[list[next],list[index]];
}

function buildSpreadsheetSection(p){
  if(p.settings?.sourceLinked)return null;
  let rows=null,columns=[],onCell=null,onAdd=null,onDelete=null,onMove=null;

  if(p.type==="ranking-card"){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"Value",type:"number"},{key:"category",label:"Category"},{key:"note",label:"Note"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);
    onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,category:"",note:"",imageRef:null,imageShape:"circle",enabled:true}));
    onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(["bar","dot"].includes(p.type)){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"Value",type:"number"},{key:"category",label:"Category"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);
    onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,category:"",enabled:true}));
    onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(["quadrant","scatter"].includes(p.type)){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"x",label:"X",type:"number"},{key:"y",label:"Y",type:"number"},{key:"category",label:"Category"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);
    onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",x:50,y:50,category:"",enabled:true}));
    onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="stat-card"){
    rows=p.data.stats;columns=[{key:"label",label:"Stat"},{key:"value",label:"Value",type:"number"}];
    onCell=(i,k,v)=>mutate(x=>x.data.stats[i][k]=v);
    onAdd=()=>mutate(x=>{if(x.data.stats.length<12)x.data.stats.push({id:newStatId(),label:"NEW",value:0})});
    onDelete=i=>mutate(x=>x.data.stats.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.stats,i,d));
  }else if(p.type==="range"){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"A",type:"number"},{key:"value2",label:"B",type:"number"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,value2:0}));onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="ring"){
    rows=p.data.items;columns=[{key:"label",label:"Label"},{key:"value",label:"Value",type:"number"},{key:"max",label:"Max",type:"number"},{key:"unit",label:"Unit"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);onAdd=()=>mutate(x=>{if(x.data.items.length<6)x.data.items.push({id:newItemId(),label:"Metric",value:0,max:100,unit:""})});onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="tier-list"){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"Score",type:"number"},{key:"tier",label:"Tier"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,tier:x.data.tiers.at(-1)?.label||""}));onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="waffle"){
    rows=p.data.categories;columns=[{key:"label",label:"Category"},{key:"value",label:"Value",type:"number"}];
    onCell=(i,k,v)=>mutate(x=>x.data.categories[i][k]=v);onAdd=()=>mutate(x=>{if(x.data.categories.length<6)x.data.categories.push({id:newItemId(),label:"Category",value:0})});onDelete=i=>mutate(x=>x.data.categories.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.categories,i,d));
  }else{
    return null;
  }

  const sec=section(t("editor.spreadsheet"),{collapsedDefault:true});
  sec.appendChild(createSpreadsheetEditor({columns,rows,onCellChange:onCell,onAdd,onDelete,onMove}));
  return sec;
}


function sourceInfoBlock(model){
  const box=document.createElement("div");
  box.className="source-info-card";
  box.innerHTML=`<b></b><span></span>`;
  box.querySelector("b").textContent=model.sheet.title||"Stats Maker";
  box.querySelector("span").textContent=`${model.rows.length}対象 / ${model.criteria.length}評価項目`;
  return box;
}

function buildLinkedDataPanel(p,model){
  const frag=document.createDocumentFragment();

  const source=section("基本表と連動");
  source.appendChild(sourceInfoBlock(model));
  frag.appendChild(source);

  if(p.type==="stat-card" || p.type==="ring"){
    const sec=section("対象");
    sec.appendChild(sourceSelectField(
      "表示対象",
      getSubjectOptions(model),
      p.settings.sourceSubjectIndex??model.rows[0]?.rawIndex??"",
      value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
    ));
    frag.appendChild(sec);
  }

  if(["ranking-card","bar","dot","tier-list"].includes(p.type)){
    const sec=section("評価項目");
    sec.appendChild(sourceSelectField(
      "表示する評価",
      getMetricOptions(model),
      p.settings.sourceMetricKey||model.metricKey,
      value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
    ));
    frag.appendChild(sec);
  }

  if(p.type==="quadrant" || p.type==="scatter"){
    const sec=section("軸");
    const grid=document.createElement("div");
    grid.className="inline-grid";
    grid.appendChild(sourceSelectField(
      "X軸",
      getCriterionOptions(model),
      p.settings.sourceXIndex??0,
      value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
    ));
    grid.appendChild(sourceSelectField(
      "Y軸",
      getCriterionOptions(model),
      p.settings.sourceYIndex??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
    ));
    sec.appendChild(grid);

    if(p.type==="quadrant"){
      const split=document.createElement("div");
      split.className="inline-grid";
      split.appendChild(field("X split",p.settings.xAxis.split,v=>mutate(x=>x.settings.xAxis.split=numberValue(v)),"number"));
      split.appendChild(field("Y split",p.settings.yAxis.split,v=>mutate(x=>x.settings.yAxis.split=numberValue(v)),"number"));
      sec.appendChild(split);
    }
    frag.appendChild(sec);
  }

  if(p.type==="range"){
    const sec=section("比較項目");
    const grid=document.createElement("div");
    grid.className="inline-grid";
    grid.appendChild(sourceSelectField(
      "項目A",
      getCriterionOptions(model),
      p.settings.sourceRangeA??0,
      value=>mutate(x=>syncSourceProject(x,{aIndex:Number(value)}))
    ));
    grid.appendChild(sourceSelectField(
      "項目B",
      getCriterionOptions(model),
      p.settings.sourceRangeB??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{bIndex:Number(value)}))
    ));
    sec.appendChild(grid);
    sec.appendChild(toggleOption("Difference",p.settings.showDiff!==false,()=>mutate(x=>x.settings.showDiff=x.settings.showDiff===false)));
    sec.appendChild(choiceButtons(
      [{value:"value",label:"Value"},{value:"percent",label:"%"}],
      p.settings.diffMode||"value",
      v=>mutate(x=>x.settings.diffMode=v)
    ));
    frag.appendChild(sec);
  }

  if(p.type==="radar"){
    const sec=section("比較対象");
    sec.appendChild(sourceSubjectChecks(
      model,
      p.settings.sourceSeriesIndices||[],
      indices=>mutate(x=>syncSourceProject(x,{seriesIndices:indices}))
    ));
    frag.appendChild(sec);
  }

  const options=section("表示設定");

  if(p.type==="ranking-card"){
    const top=document.createElement("div");
    top.className="field";
    const label=document.createElement("label");
    label.textContent=t("editor.topN");
    top.appendChild(label);
    top.appendChild(choiceButtons(
      [3,5,10,20].map(n=>({value:n,label:`TOP ${n}`})),
      Number(p.settings.topN||5),
      value=>mutate(x=>x.settings.topN=value),
      "topn-presets"
    ));
    options.appendChild(top);
    options.appendChild(toggleOption(t("ranking.showNote"),p.settings.showNote!==false,()=>mutate(x=>x.settings.showNote=x.settings.showNote===false)));
    options.appendChild(toggleOption(t("ranking.highlightTop3"),p.settings.highlightTop3!==false,()=>mutate(x=>x.settings.highlightTop3=x.settings.highlightTop3===false)));
    options.appendChild(toggleOption(t("ranking.showBars"),p.settings.showBars!==false,()=>mutate(x=>x.settings.showBars=x.settings.showBars===false)));
  }

  if(p.type==="bar"){
    options.appendChild(toggleOption(t("bar.showValues"),p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    options.appendChild(toggleOption(t("bar.showGrid"),p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
  }

  if(p.type==="dot"){
    options.appendChild(toggleOption("Values",p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    options.appendChild(toggleOption("Guide",p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
  }

  if(p.type==="radar"){
    options.appendChild(toggleOption(t("radar.showValues"),!!p.settings.showValues,()=>mutate(x=>x.settings.showValues=!x.settings.showValues)));
    options.appendChild(toggleOption(t("radar.showLegend"),p.settings.showLegend!==false,()=>mutate(x=>x.settings.showLegend=x.settings.showLegend===false)));
    options.appendChild(toggleOption(t("radar.showAxisLabels"),p.settings.showAxisLabels!==false,()=>mutate(x=>x.settings.showAxisLabels=x.settings.showAxisLabels===false)));
  }

  if(p.type==="scatter"){
    options.appendChild(toggleOption("Average lines",p.settings.showAverage!==false,()=>mutate(x=>x.settings.showAverage=x.settings.showAverage===false)));
    options.appendChild(toggleOption("Median lines",!!p.settings.showMedian,()=>mutate(x=>x.settings.showMedian=!x.settings.showMedian)));
    options.appendChild(toggleOption("Trend line",p.settings.showTrend!==false,()=>mutate(x=>x.settings.showTrend=x.settings.showTrend===false)));
    options.appendChild(toggleOption("Labels",p.settings.showLabels!==false,()=>mutate(x=>x.settings.showLabels=x.settings.showLabels===false)));
  }

  if(p.type==="ring"){
    options.appendChild(choiceButtons(
      [{value:"thick",label:"Thick"},{value:"thin",label:"Thin"},{value:"half",label:"Half"}],
      p.settings.style||"thick",
      v=>mutate(x=>x.settings.style=v)
    ));
    options.appendChild(toggleOption("Percent",p.settings.showPercent!==false,()=>mutate(x=>x.settings.showPercent=x.settings.showPercent===false)));
  }

  if(p.type==="tier-list"){
    options.appendChild(toggleOption("Score",p.settings.showScore!==false,()=>mutate(x=>x.settings.showScore=x.settings.showScore===false)));
  }

  if(options.children.length>1)frag.appendChild(options);

  return frag;
}

function buildDataPanel(){
  const p=current();
  const sourceModel=getSourceModel(p);

  if(sourceModel && p.settings.sourceLinked){
    return buildLinkedDataPanel(p,sourceModel);
  }

  const frag=document.createDocumentFragment();

  const common=section(t("editor.items"));
  common.appendChild(field(t("common.title"),p.meta.title,v=>mutate(x=>x.meta.title=v)));
  common.appendChild(field(t("common.subtitle"),p.meta.subtitle,v=>mutate(x=>x.meta.subtitle=v)));
  frag.appendChild(common);

  if(p.type==="ranking-card"){
    const opts=section("Ranking");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "表示項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    opts.appendChild(field(t("editor.unit"),p.settings.unit??"PTS",v=>mutate(x=>x.settings.unit=v)));
    opts.appendChild(field(t("ranking.headerLabel"),p.settings.headerLabel??"POWER RANKING",v=>mutate(x=>x.settings.headerLabel=v)));

    const topLabel=document.createElement("div");
    topLabel.className="field";
    const topText=document.createElement("label");topText.textContent=t("editor.topN");
    topLabel.appendChild(topText);
    topLabel.appendChild(choiceButtons(
      [3,5,10,20].map(n=>({value:n,label:`TOP ${n}`})),
      Number(p.settings.topN||5),
      value=>mutate(x=>x.settings.topN=value),
      "topn-presets"
    ));
    opts.appendChild(topLabel);

    const sort=document.createElement("button");
    sort.className="btn";
    sort.textContent=t("editor.autoSort");
    sort.addEventListener("click",()=>mutate(x=>{
      x.data.items.sort((a,b)=>Number(b.value)-Number(a.value));
      x.settings.sort="manual";
    }));
    opts.appendChild(sort);
    frag.appendChild(opts);

    const display=section(t("ranking.options"));
    const optionList=document.createElement("div");optionList.className="option-list";
    optionList.appendChild(toggleOption(t("ranking.showNote"),p.settings.showNote!==false,()=>mutate(x=>x.settings.showNote=x.settings.showNote===false)));
    optionList.appendChild(toggleOption(t("ranking.showCategory"),p.settings.showCategory!==false,()=>mutate(x=>x.settings.showCategory=x.settings.showCategory===false)));
    optionList.appendChild(toggleOption(t("ranking.highlightTop3"),p.settings.highlightTop3!==false,()=>mutate(x=>x.settings.highlightTop3=x.settings.highlightTop3===false)));
    optionList.appendChild(toggleOption(t("ranking.showBars"),p.settings.showBars!==false,()=>mutate(x=>x.settings.showBars=x.settings.showBars===false)));
    display.appendChild(optionList);

    const densityWrap=document.createElement("div");densityWrap.className="field";densityWrap.style.marginTop="10px";
    const densityLabel=document.createElement("label");densityLabel.textContent=t("ranking.density");
    densityWrap.appendChild(densityLabel);
    densityWrap.appendChild(choiceButtons(
      [
        {value:"comfortable",label:t("ranking.comfortable")},
        {value:"compact",label:t("ranking.compact")}
      ],
      p.settings.density||"comfortable",
      value=>mutate(x=>x.settings.density=value)
    ));
    display.appendChild(densityWrap);
    frag.appendChild(display);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"ranking",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.map(r=>({
          id:newItemId(),
          name:r.name,
          value:r.value,
          note:r.note||"",
          category:r.category||"",
          imageRef:null,
          imageShape:"circle",
          enabled:true
        }));
        x.data.items=mode==="append"?[...x.data.items,...mapped]:mapped;
        x.settings.sort="manual";
      })
    }));
    frag.appendChild(importSection);

    const data=section(t("editor.items"));
    const list=document.createElement("div");list.className="data-list";
    p.data.items.forEach((item,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head"><span class="drag-label">#${index+1}</span><div class="row-actions"><button class="icon-btn up">↑</button><button class="icon-btn down">↓</button><button class="icon-btn del">×</button></div></div>
        <div class="row-grid"><input class="input name"><input class="input value" type="number"></div>
        <input class="input category">
        <input class="input note">
      `;
      row.querySelector(".name").value=item.name;
      row.querySelector(".value").value=item.value;
      row.querySelector(".category").value=item.category||"";
      row.querySelector(".category").placeholder=t("ranking.category");
      row.querySelector(".note").value=item.note||"";
      row.querySelector(".note").placeholder=t("editor.note");
      row.querySelector(".name").addEventListener("change",e=>mutate(x=>x.data.items[index].name=e.target.value));
      row.querySelector(".value").addEventListener("change",e=>mutate(x=>x.data.items[index].value=numberValue(e.target.value)));
      row.querySelector(".category").addEventListener("change",e=>mutate(x=>x.data.items[index].category=e.target.value));
      row.querySelector(".note").addEventListener("change",e=>mutate(x=>x.data.items[index].note=e.target.value));

      const imageManager=createImageManager({
        imageRef:item.imageRef||null,
        shape:item.imageShape||"circle",
        label:getLanguage()==="ja"?"画像":"Image",
        onChange:(imageRef)=>mutate(x=>x.data.items[index].imageRef=imageRef),
        onShapeChange:(imageShape)=>mutate(x=>x.data.items[index].imageShape=imageShape)
      });
      row.appendChild(imageManager);

      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.items.splice(index,1)));
      row.querySelector(".up").addEventListener("click",()=>mutate(x=>{if(index>0)[x.data.items[index-1],x.data.items[index]]=[x.data.items[index],x.data.items[index-1]]}));
      row.querySelector(".down").addEventListener("click",()=>mutate(x=>{if(index<x.data.items.length-1)[x.data.items[index+1],x.data.items[index]]=[x.data.items[index],x.data.items[index+1]]}));
      list.appendChild(row);
    });
    data.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addItem");
    add.addEventListener("click",()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,note:"",category:"",imageRef:null,imageShape:"circle",enabled:true})));
    data.appendChild(add);
    frag.appendChild(data);
  }

  if(p.type==="stat-card"){
    const info=section("Card");
    if(sourceModel){
      info.appendChild(sourceSelectField(
        "対象",
        getSubjectOptions(sourceModel),
        p.settings.sourceSubjectIndex??sourceModel.rows[0]?.rawIndex??"",
        value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
      ));
    }
    info.appendChild(field(t("editor.name"),p.data.name,v=>mutate(x=>x.data.name=v)));
    info.appendChild(field(t("common.subtitle"),p.data.subtitle,v=>mutate(x=>x.data.subtitle=v)));
    const grid=document.createElement("div");grid.className="inline-grid";
    grid.appendChild(field(t("editor.overall"),p.data.overall,v=>mutate(x=>x.data.overall=numberValue(v)),"number"));
    grid.appendChild(field("Tier",p.data.tier,v=>mutate(x=>x.data.tier=v)));
    info.appendChild(grid);
    info.appendChild(field(t("editor.team"),p.data.team,v=>mutate(x=>x.data.team=v)));

    info.appendChild(createImageManager({
      imageRef:p.data.imageRef||null,
      shape:p.data.imageShape||"rounded",
      label:getLanguage()==="ja"?"カード画像":"Card Image",
      onChange:(imageRef)=>mutate(x=>x.data.imageRef=imageRef),
      onShapeChange:(imageShape)=>mutate(x=>x.data.imageShape=imageShape)
    }));

    frag.appendChild(info);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"stats",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.slice(0,12).map(r=>({
          id:newStatId(),
          label:r.label,
          value:r.value
        }));
        x.data.stats=mode==="append"
          ? [...x.data.stats,...mapped].slice(0,12)
          : mapped.slice(0,12);
      })
    }));
    frag.appendChild(importSection);

    const stats=section("Stats");
    const list=document.createElement("div");list.className="data-list";
    p.data.stats.forEach((stat,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`<div class="row-grid"><input class="input label"><input class="input value" type="number"></div><div class="row-actions"><button class="icon-btn del">×</button></div>`;
      row.querySelector(".label").value=stat.label;
      row.querySelector(".value").value=stat.value;
      row.querySelector(".label").addEventListener("change",e=>mutate(x=>x.data.stats[index].label=e.target.value));
      row.querySelector(".value").addEventListener("change",e=>mutate(x=>x.data.stats[index].value=numberValue(e.target.value)));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.stats.splice(index,1)));
      list.appendChild(row);
    });
    stats.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addStat");
    add.disabled=p.data.stats.length>=12;
    add.addEventListener("click",()=>mutate(x=>x.data.stats.push({id:newStatId(),label:"NEW",value:0})));
    stats.appendChild(add);
    frag.appendChild(stats);
  }

  if(p.type==="quadrant"){
    const axes=section("Axis");
    if(sourceModel){
      const sourceGrid=document.createElement("div");sourceGrid.className="inline-grid";
      sourceGrid.appendChild(sourceSelectField(
        "X軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceXIndex??0,
        value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
      ));
      sourceGrid.appendChild(sourceSelectField(
        "Y軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceYIndex??Math.min(1,sourceModel.criteria.length-1),
        value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
      ));
      axes.appendChild(sourceGrid);
      const splitGrid=document.createElement("div");splitGrid.className="inline-grid";
      splitGrid.appendChild(field("X split",p.settings.xAxis.split,v=>mutate(x=>x.settings.xAxis.split=numberValue(v)),"number"));
      splitGrid.appendChild(field("Y split",p.settings.yAxis.split,v=>mutate(x=>x.settings.yAxis.split=numberValue(v)),"number"));
      axes.appendChild(splitGrid);
    }else{
      const xgrid=document.createElement("div");xgrid.className="inline-grid";
      xgrid.appendChild(field(t("editor.xAxis"),p.settings.xAxis.label,v=>mutate(x=>x.settings.xAxis.label=v)));
      xgrid.appendChild(field(t("editor.split"),p.settings.xAxis.split,v=>mutate(x=>x.settings.xAxis.split=numberValue(v)),"number"));
      axes.appendChild(xgrid);
      const ygrid=document.createElement("div");ygrid.className="inline-grid";
      ygrid.appendChild(field(t("editor.yAxis"),p.settings.yAxis.label,v=>mutate(x=>x.settings.yAxis.label=v)));
      ygrid.appendChild(field(t("editor.split"),p.settings.yAxis.split,v=>mutate(x=>x.settings.yAxis.split=numberValue(v)),"number"));
      axes.appendChild(ygrid);
    }
    frag.appendChild(axes);

    const qs=section(t("editor.quadrants"));
    [["topLeft","editor.topLeft"],["topRight","editor.topRight"],["bottomLeft","editor.bottomLeft"],["bottomRight","editor.bottomRight"]].forEach(([key,label])=>{
      qs.appendChild(field(t(label),p.settings.quadrants[key],v=>mutate(x=>x.settings.quadrants[key]=v)));
    });
    frag.appendChild(qs);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"quadrant",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.map(r=>({
          id:newItemId(),
          name:r.name,
          x:r.x,
          y:r.y,
          category:r.category||"",
          imageRef:null,
          imageShape:"circle",
          enabled:true
        }));
        x.data.items=mode==="append"?[...x.data.items,...mapped]:mapped;
      })
    }));
    frag.appendChild(importSection);

    const data=section(t("editor.items"));
    const list=document.createElement("div");list.className="data-list";
    p.data.items.forEach((item,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head"><span class="drag-label">#${index+1}</span><button class="icon-btn del">×</button></div>
        <input class="input name">
        <div class="inline-grid"><input class="input x" type="number"><input class="input y" type="number"></div>
      `;
      row.querySelector(".name").value=item.name;
      row.querySelector(".x").value=item.x;
      row.querySelector(".y").value=item.y;
      row.querySelector(".name").addEventListener("change",e=>mutate(x=>x.data.items[index].name=e.target.value));
      row.querySelector(".x").addEventListener("change",e=>mutate(x=>x.data.items[index].x=numberValue(e.target.value)));
      row.querySelector(".y").addEventListener("change",e=>mutate(x=>x.data.items[index].y=numberValue(e.target.value)));

      row.appendChild(createImageManager({
        imageRef:item.imageRef||null,
        shape:item.imageShape||"circle",
        label:getLanguage()==="ja"?"マーカー画像":"Marker Image",
        onChange:(imageRef)=>mutate(x=>x.data.items[index].imageRef=imageRef),
        onShapeChange:(imageShape)=>mutate(x=>x.data.items[index].imageShape=imageShape)
      }));

      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.items.splice(index,1)));
      list.appendChild(row);
    });
    data.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addItem");
    add.addEventListener("click",()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",x:50,y:50,category:"",imageRef:null,imageShape:"circle",enabled:true})));
    data.appendChild(add);
    frag.appendChild(data);
  }


  if(p.type==="bar"){
    const opts=section(t("bar.options"));
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "表示項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    const grid=document.createElement("div");grid.className="inline-grid";
    grid.appendChild(field(t("editor.unit"),p.settings.unit||"",v=>mutate(x=>x.settings.unit=v)));
    grid.appendChild(field(t("editor.topN"),p.settings.topN||10,v=>mutate(x=>x.settings.topN=Math.max(1,Math.min(30,numberValue(v)))),"number",{min:"1",max:"30"}));
    opts.appendChild(grid);

    const toggles=document.createElement("div");toggles.className="option-list";
    toggles.appendChild(toggleOption(t("bar.showValues"),p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    toggles.appendChild(toggleOption(t("bar.showCategory"),p.settings.showCategory!==false,()=>mutate(x=>x.settings.showCategory=x.settings.showCategory===false)));
    toggles.appendChild(toggleOption(t("bar.showGrid"),p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
    toggles.appendChild(toggleOption(t("bar.autoMax"),p.settings.autoMax!==false,()=>mutate(x=>x.settings.autoMax=x.settings.autoMax===false)));
    opts.appendChild(toggles);

    if(p.settings.autoMax===false){
      opts.appendChild(field(t("bar.max"),p.settings.max||100,v=>mutate(x=>x.settings.max=Math.max(1,numberValue(v))),"number"));
    }

    const sort=document.createElement("button");
    sort.className="btn";sort.style.marginTop="8px";sort.textContent=t("editor.autoSort");
    sort.addEventListener("click",()=>mutate(x=>{
      x.data.items.sort((a,b)=>Number(b.value)-Number(a.value));
      x.settings.sort="manual";
    }));
    opts.appendChild(sort);
    frag.appendChild(opts);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"bar",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.map(r=>({
          id:newItemId(),
          name:r.name,
          value:r.value,
          category:r.category||"",
          enabled:true
        }));
        x.data.items=mode==="append"?[...x.data.items,...mapped]:mapped;
      })
    }));
    frag.appendChild(importSection);

    const data=section(t("editor.items"));
    const list=document.createElement("div");list.className="data-list";

    p.data.items.forEach((item,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">#${index+1}</span>
          <div class="row-actions">
            <button class="icon-btn up">↑</button>
            <button class="icon-btn down">↓</button>
            <button class="icon-btn del">×</button>
          </div>
        </div>
        <div class="row-grid">
          <input class="input name">
          <input class="input value" type="number">
        </div>
        <input class="input category">
      `;
      row.querySelector(".name").value=item.name||"";
      row.querySelector(".value").value=item.value??0;
      row.querySelector(".category").value=item.category||"";
      row.querySelector(".category").placeholder=t("ranking.category");

      row.querySelector(".name").addEventListener("change",e=>mutate(x=>x.data.items[index].name=e.target.value));
      row.querySelector(".value").addEventListener("change",e=>mutate(x=>x.data.items[index].value=numberValue(e.target.value)));
      row.querySelector(".category").addEventListener("change",e=>mutate(x=>x.data.items[index].category=e.target.value));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.items.splice(index,1)));
      row.querySelector(".up").addEventListener("click",()=>mutate(x=>{if(index>0)[x.data.items[index-1],x.data.items[index]]=[x.data.items[index],x.data.items[index-1]]}));
      row.querySelector(".down").addEventListener("click",()=>mutate(x=>{if(index<x.data.items.length-1)[x.data.items[index+1],x.data.items[index]]=[x.data.items[index],x.data.items[index+1]]}));

      list.appendChild(row);
    });

    data.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addItem");
    add.addEventListener("click",()=>mutate(x=>x.data.items.push({
      id:newItemId(),name:"New Item",value:0,category:"",enabled:true
    })));
    data.appendChild(add);
    frag.appendChild(data);
  }

  if(p.type==="radar"){
    if(sourceModel){
      const subjects=section("対象");
      subjects.appendChild(sourceSubjectChecks(
        sourceModel,
        p.settings.sourceSeriesIndices||[],
        indices=>mutate(x=>syncSourceProject(x,{seriesIndices:indices}))
      ));
      frag.appendChild(subjects);
    }
    const opts=section(t("radar.options"));
    const toggles=document.createElement("div");toggles.className="option-list";
    toggles.appendChild(toggleOption(t("radar.showValues"),!!p.settings.showValues,()=>mutate(x=>x.settings.showValues=!x.settings.showValues)));
    toggles.appendChild(toggleOption(t("radar.showLegend"),p.settings.showLegend!==false,()=>mutate(x=>x.settings.showLegend=x.settings.showLegend===false)));
    toggles.appendChild(toggleOption(t("radar.showAxisLabels"),p.settings.showAxisLabels!==false,()=>mutate(x=>x.settings.showAxisLabels=x.settings.showAxisLabels===false)));
    opts.appendChild(toggles);

    const grid=document.createElement("div");grid.className="inline-grid";grid.style.marginTop="9px";
    grid.appendChild(field(t("radar.gridLevels"),p.settings.gridLevels||5,v=>mutate(x=>x.settings.gridLevels=Math.max(3,Math.min(8,numberValue(v)))),"number",{min:"3",max:"8"}));
    grid.appendChild(field(t("radar.fillOpacity"),p.settings.fillOpacity??0.18,v=>mutate(x=>x.settings.fillOpacity=Math.max(0,Math.min(.7,Number(v)||0))),"number",{min:"0",max:"0.7",step:"0.05"}));
    opts.appendChild(grid);
    frag.appendChild(opts);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"radar",
      onImport:(mapped,mode)=>mutate(x=>{
        const axes=(mapped.axes||[]).map(a=>({
          id:newAxisId(),
          label:a.label,
          max:a.max||100
        }));
        const series=(mapped.series||[]).map(s=>({
          id:newSeriesId(),
          name:s.name,
          color:s.color||x.style.accent,
          values:[...(s.values||[])]
        }));

        if(mode==="append" && x.data.axes.length===axes.length){
          x.data.series=[...x.data.series,...series].slice(0,6);
        }else{
          x.data.axes=axes.slice(0,12);
          x.data.series=series.slice(0,6);
        }
      })
    }));
    frag.appendChild(importSection);

    const axesSection=section(t("radar.axes"));
    const axesList=document.createElement("div");axesList.className="data-list";

    p.data.axes.forEach((axis,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">Axis ${index+1}</span>
          <button class="icon-btn del">×</button>
        </div>
        <div class="row-grid">
          <input class="input label">
          <input class="input max" type="number">
        </div>
      `;
      row.querySelector(".label").value=axis.label||"";
      row.querySelector(".max").value=axis.max??100;
      row.querySelector(".label").addEventListener("change",e=>mutate(x=>x.data.axes[index].label=e.target.value));
      row.querySelector(".max").addEventListener("change",e=>mutate(x=>x.data.axes[index].max=Math.max(1,numberValue(e.target.value))));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>{
        if(x.data.axes.length<=3)return;
        x.data.axes.splice(index,1);
        x.data.series.forEach(s=>s.values.splice(index,1));
      }));
      axesList.appendChild(row);
    });

    axesSection.appendChild(axesList);
    const addAxis=document.createElement("button");addAxis.className="btn add-row-btn";addAxis.textContent="+ Axis";
    addAxis.disabled=p.data.axes.length>=12;
    addAxis.addEventListener("click",()=>mutate(x=>{
      if(x.data.axes.length>=12)return;
      x.data.axes.push({id:newAxisId(),label:`A${x.data.axes.length+1}`,max:100});
      x.data.series.forEach(s=>s.values.push(0));
    }));
    axesSection.appendChild(addAxis);
    frag.appendChild(axesSection);

    const seriesSection=section(t("radar.series"));
    const seriesList=document.createElement("div");seriesList.className="data-list";

    p.data.series.forEach((series,sIndex)=>{
      const row=document.createElement("div");row.className="data-row radar-series-editor";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">Series ${sIndex+1}</span>
          <button class="icon-btn del">×</button>
        </div>
        <div class="color-row">
          <input class="color-input series-color" type="color">
          <input class="input series-name">
        </div>
        <div class="radar-value-grid"></div>
      `;

      row.querySelector(".series-color").value=series.color||"#6F9CFF";
      row.querySelector(".series-name").value=series.name||`Series ${sIndex+1}`;

      row.querySelector(".series-color").addEventListener("change",e=>mutate(x=>x.data.series[sIndex].color=e.target.value));
      row.querySelector(".series-name").addEventListener("change",e=>mutate(x=>x.data.series[sIndex].name=e.target.value));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>{
        if(x.data.series.length<=1)return;
        x.data.series.splice(sIndex,1);
      }));

      const vg=row.querySelector(".radar-value-grid");
      p.data.axes.forEach((axis,aIndex)=>{
        const f=document.createElement("label");
        f.className="radar-value-field";
        const span=document.createElement("span");span.textContent=axis.label;
        const input=document.createElement("input");input.className="input";input.type="number";input.value=series.values?.[aIndex]??0;
        input.addEventListener("change",e=>mutate(x=>x.data.series[sIndex].values[aIndex]=numberValue(e.target.value)));
        f.append(span,input);vg.appendChild(f);
      });

      seriesList.appendChild(row);
    });

    seriesSection.appendChild(seriesList);
    const addSeries=document.createElement("button");addSeries.className="btn add-row-btn";addSeries.textContent="+ Series";
    addSeries.disabled=p.data.series.length>=6;
    addSeries.addEventListener("click",()=>mutate(x=>{
      if(x.data.series.length>=6)return;
      const palette=["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];
      x.data.series.push({
        id:newSeriesId(),
        name:`Series ${x.data.series.length+1}`,
        color:palette[x.data.series.length%palette.length],
        values:x.data.axes.map(()=>0)
      });
    }));
    seriesSection.appendChild(addSeries);
    frag.appendChild(seriesSection);
  }


  if(p.type==="dot"){
    const opts=section("Dot");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "表示項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    const g=document.createElement("div");g.className="inline-grid";
    g.appendChild(field("Min",p.settings.min,v=>mutate(x=>x.settings.min=numberValue(v)),"number"));
    g.appendChild(field("Max",p.settings.max,v=>mutate(x=>x.settings.max=numberValue(v)),"number"));
    opts.appendChild(g);
    opts.appendChild(field(t("editor.unit"),p.settings.unit||"",v=>mutate(x=>x.settings.unit=v)));
    const toggles=document.createElement("div");toggles.className="option-list";
    toggles.appendChild(toggleOption("Auto Range",!!p.settings.autoRange,()=>mutate(x=>x.settings.autoRange=!x.settings.autoRange)));
    toggles.appendChild(toggleOption("Values",p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    toggles.appendChild(toggleOption("Guide",p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
    opts.appendChild(toggles);frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"dot",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),name:r.name,value:r.value,category:r.category||"",enabled:true}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);
  }

  if(p.type==="ring"){
    const opts=section("Ring");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "対象",
        getSubjectOptions(sourceModel),
        p.settings.sourceSubjectIndex??sourceModel.rows[0]?.rawIndex??"",
        value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
      ));
    }
    opts.appendChild(choiceButtons([{value:"thick",label:"Thick"},{value:"thin",label:"Thin"},{value:"half",label:"Half"}],p.settings.style||"thick",v=>mutate(x=>x.settings.style=v)));
    opts.appendChild(toggleOption("Percent",p.settings.showPercent!==false,()=>mutate(x=>x.settings.showPercent=x.settings.showPercent===false)));
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"ring",onImport:(rows,mode)=>mutate(x=>{const m=rows.slice(0,6).map(r=>({id:newItemId(),...r}));x.data.items=mode==="append"?[...x.data.items,...m].slice(0,6):m})}));frag.appendChild(opts,imp);
  }

  if(p.type==="tier-list"){
    const opts=section("Tier");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "評価項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    opts.appendChild(choiceButtons([{value:"auto",label:t("editor.auto")},{value:"manual",label:t("editor.manual")}],p.settings.mode||"auto",v=>mutate(x=>x.settings.mode=v)));
    opts.appendChild(toggleOption("Score",p.settings.showScore!==false,()=>mutate(x=>x.settings.showScore=x.settings.showScore===false)));
    frag.appendChild(opts);
    const tiers=section("Tiers");
    const tl=document.createElement("div");tl.className="data-list";
    p.data.tiers.forEach((tier,i)=>{const row=document.createElement("div");row.className="data-row";row.innerHTML=`<div class="row-grid"><input class="input label"><input class="input min" type="number"></div><div class="row-grid"><input class="input max" type="number"><button class="btn del">Delete</button></div>`;row.querySelector(".label").value=tier.label;row.querySelector(".min").value=tier.min;row.querySelector(".max").value=tier.max;row.querySelector(".label").addEventListener("change",e=>mutate(x=>x.data.tiers[i].label=e.target.value));row.querySelector(".min").addEventListener("change",e=>mutate(x=>x.data.tiers[i].min=numberValue(e.target.value)));row.querySelector(".max").addEventListener("change",e=>mutate(x=>x.data.tiers[i].max=numberValue(e.target.value)));row.querySelector(".del").addEventListener("click",()=>mutate(x=>{if(x.data.tiers.length>1)x.data.tiers.splice(i,1)}));tl.appendChild(row)});tiers.appendChild(tl);const add=document.createElement("button");add.className="btn add-row-btn";add.textContent="+ Tier";add.addEventListener("click",()=>mutate(x=>{if(x.data.tiers.length<10)x.data.tiers.push({id:newItemId(),label:"NEW",min:0,max:0})}));tiers.appendChild(add);frag.appendChild(tiers);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"tier",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),name:r.name,value:r.value,tier:x.data.tiers.at(-1)?.label||""}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);

    if(p.settings.mode==="manual"){
      const manual=section("Manual Tier Placement");
      const holder=document.createElement("div");holder.className="tier-manual-list";
      p.data.items.forEach((item,i)=>{
        const row=document.createElement("div");row.className="tier-manual-row";
        const name=document.createElement("span");name.textContent=item.name||"";
        const select=document.createElement("select");select.className="select";
        p.data.tiers.forEach(tier=>{const o=document.createElement("option");o.value=tier.label;o.textContent=tier.label;if((item.tier||"")===tier.label)o.selected=true;select.appendChild(o)});
        select.addEventListener("change",()=>mutate(x=>x.data.items[i].tier=select.value));
        row.append(name,select);holder.appendChild(row);
      });
      manual.appendChild(holder);frag.appendChild(manual);
    }
  }

  if(p.type==="heatmap"){
    const opts=section("Heatmap");
    opts.appendChild(choiceButtons(
      ["blue","green","red","heat","cool","rainbow"].map(v=>({value:v,label:v})),
      p.settings.palette||"blue",
      v=>mutate(x=>x.settings.palette=v),
      "theme-grid"
    ));
    const g=document.createElement("div");g.className="inline-grid";g.appendChild(field("Min",p.settings.min,v=>mutate(x=>x.settings.min=numberValue(v)),"number"));g.appendChild(field("Max",p.settings.max,v=>mutate(x=>x.settings.max=numberValue(v)),"number"));opts.appendChild(g);opts.appendChild(toggleOption("Values",p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"heatmap",onImport:(mapped)=>mutate(x=>{x.data.columns=mapped.columns.map(label=>({id:newItemId(),label}));x.data.rows=mapped.rows.map(r=>({id:newItemId(),name:r.name,values:r.values}))})}));frag.appendChild(imp);
    const matrix=section("Matrix");
    const sc=document.createElement("div");sc.className="heatmap-editor-scroll";const table=document.createElement("table");table.className="heatmap-editor-table";const hr=document.createElement("tr");hr.innerHTML="<th></th>";p.data.columns.forEach((c,ci)=>{const th=document.createElement("th");const input=document.createElement("input");input.className="sheet-cell";input.value=c.label;input.addEventListener("change",e=>mutate(x=>x.data.columns[ci].label=e.target.value));th.appendChild(input);hr.appendChild(th)});table.appendChild(hr);
    p.data.rows.forEach((r,ri)=>{const tr=document.createElement("tr");const th=document.createElement("th");const name=document.createElement("input");name.className="sheet-cell";name.value=r.name;name.addEventListener("change",e=>mutate(x=>x.data.rows[ri].name=e.target.value));th.appendChild(name);tr.appendChild(th);p.data.columns.forEach((c,ci)=>{const td=document.createElement("td");const input=document.createElement("input");input.className="sheet-cell";input.type="number";input.value=r.values?.[ci]??0;input.addEventListener("change",e=>mutate(x=>x.data.rows[ri].values[ci]=numberValue(e.target.value)));td.appendChild(input);tr.appendChild(td)});table.appendChild(tr)});sc.appendChild(table);matrix.appendChild(sc);
    const acts=document.createElement("div");acts.className="matrix-actions";const ar=document.createElement("button");ar.className="btn";ar.textContent="+ Row";ar.addEventListener("click",()=>mutate(x=>x.data.rows.push({id:newItemId(),name:"New Row",values:x.data.columns.map(()=>0)})));const ac=document.createElement("button");ac.className="btn";ac.textContent="+ Column";ac.addEventListener("click",()=>mutate(x=>{if(x.data.columns.length<12){x.data.columns.push({id:newItemId(),label:`C${x.data.columns.length+1}`});x.data.rows.forEach(r=>r.values.push(0))}}));acts.append(ar,ac);matrix.appendChild(acts);frag.appendChild(matrix);
  }

  if(p.type==="scatter"){
    const axes=section("Axis");
    if(sourceModel){
      const sg=document.createElement("div");sg.className="inline-grid";
      sg.appendChild(sourceSelectField(
        "X軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceXIndex??0,
        value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
      ));
      sg.appendChild(sourceSelectField(
        "Y軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceYIndex??Math.min(1,sourceModel.criteria.length-1),
        value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
      ));
      axes.appendChild(sg);
    }else{
      const xg=document.createElement("div");xg.className="inline-grid";xg.appendChild(field("X Label",p.settings.xAxis.label,v=>mutate(x=>x.settings.xAxis.label=v)));xg.appendChild(field("X Max",p.settings.xAxis.max,v=>mutate(x=>x.settings.xAxis.max=numberValue(v)),"number"));axes.appendChild(xg);
      const yg=document.createElement("div");yg.className="inline-grid";yg.appendChild(field("Y Label",p.settings.yAxis.label,v=>mutate(x=>x.settings.yAxis.label=v)));yg.appendChild(field("Y Max",p.settings.yAxis.max,v=>mutate(x=>x.settings.yAxis.max=numberValue(v)),"number"));axes.appendChild(yg);
    }
    const tg=document.createElement("div");tg.className="option-list";tg.appendChild(toggleOption("Average lines",p.settings.showAverage!==false,()=>mutate(x=>x.settings.showAverage=x.settings.showAverage===false)));tg.appendChild(toggleOption("Median lines",!!p.settings.showMedian,()=>mutate(x=>x.settings.showMedian=!x.settings.showMedian)));tg.appendChild(toggleOption("Trend line",p.settings.showTrend!==false,()=>mutate(x=>x.settings.showTrend=x.settings.showTrend===false)));tg.appendChild(toggleOption("Category colors",p.settings.categoryColors!==false,()=>mutate(x=>x.settings.categoryColors=x.settings.categoryColors===false)));tg.appendChild(toggleOption("Labels",p.settings.showLabels!==false,()=>mutate(x=>x.settings.showLabels=x.settings.showLabels===false)));axes.appendChild(tg);frag.appendChild(axes);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"scatter",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),name:r.name,x:r.x,y:r.y,category:r.category||""}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);
  }

  if(p.type==="range"){
    const opts=section("Range");
    if(sourceModel){
      const g=document.createElement("div");g.className="inline-grid";
      g.appendChild(sourceSelectField(
        "項目A",
        getCriterionOptions(sourceModel),
        p.settings.sourceRangeA??0,
        value=>mutate(x=>syncSourceProject(x,{aIndex:Number(value)}))
      ));
      g.appendChild(sourceSelectField(
        "項目B",
        getCriterionOptions(sourceModel),
        p.settings.sourceRangeB??Math.min(1,sourceModel.criteria.length-1),
        value=>mutate(x=>syncSourceProject(x,{bIndex:Number(value)}))
      ));
      opts.appendChild(g);
    }else{
      const g=document.createElement("div");g.className="inline-grid";g.appendChild(field("Label A",p.settings.labelA,v=>mutate(x=>x.settings.labelA=v)));g.appendChild(field("Label B",p.settings.labelB,v=>mutate(x=>x.settings.labelB=v)));opts.appendChild(g);
    }opts.appendChild(field(t("editor.unit"),p.settings.unit||"",v=>mutate(x=>x.settings.unit=v)));opts.appendChild(toggleOption("Auto Range",p.settings.autoRange!==false,()=>mutate(x=>x.settings.autoRange=x.settings.autoRange===false)));opts.appendChild(toggleOption("Difference",p.settings.showDiff!==false,()=>mutate(x=>x.settings.showDiff=x.settings.showDiff===false)));
    opts.appendChild(choiceButtons([{value:"value",label:"Value"},{value:"percent",label:"%"}],p.settings.diffMode||"value",v=>mutate(x=>x.settings.diffMode=v)));
    frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"range",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),...r}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);
  }

  if(p.type==="waffle"){
    const opts=section("Waffle");
    opts.appendChild(choiceButtons(
      [{value:"10x10",label:"10×10"},{value:"5x20",label:"5×20"},{value:"5x10",label:"5×10"}],
      `${Math.ceil((p.settings.cells||100)/(p.settings.columns||10))}x${p.settings.columns||10}`,
      v=>mutate(x=>{
        if(v==="10x10"){x.settings.cells=100;x.settings.columns=10}
        if(v==="5x20"){x.settings.cells=100;x.settings.columns=20}
        if(v==="5x10"){x.settings.cells=50;x.settings.columns=10}
      })
    ));
    opts.appendChild(field(t("editor.unit"),p.settings.unit||"%",v=>mutate(x=>x.settings.unit=v)));opts.appendChild(toggleOption("Legend",p.settings.showLegend!==false,()=>mutate(x=>x.settings.showLegend=x.settings.showLegend===false)));frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"waffle",onImport:(rows,mode)=>mutate(x=>{const m=rows.slice(0,6).map(r=>({id:newItemId(),...r}));x.data.categories=mode==="append"?[...x.data.categories,...m].slice(0,6):m})}));frag.appendChild(imp);
  }

  if(p.type==="stat-board"){
    const layout=section("Layout");
    layout.appendChild(choiceButtons(
      [{value:1,label:"1 Column"},{value:2,label:"2 Columns"},{value:3,label:"3 Columns"}],
      Number(p.settings.columns||2),
      v=>mutate(x=>x.settings.columns=v)
    ));
    layout.appendChild(choiceButtons(
      [{value:"small",label:"Small Gap"},{value:"medium",label:"Medium Gap"},{value:"large",label:"Large Gap"}],
      p.settings.gap||"medium",
      v=>mutate(x=>x.settings.gap=v)
    ));
    frag.appendChild(layout);

    const blocks=section("Blocks");
    const list=document.createElement("div");list.className="data-list";

    p.data.blocks.forEach((block,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">${block.type}</span>
          <div class="row-actions">
            <button class="icon-btn up">↑</button>
            <button class="icon-btn down">↓</button>
            <button class="icon-btn del">×</button>
          </div>
        </div>
        <div class="inline-grid">
          <select class="select block-type">
            <option value="hero">Hero</option>
            <option value="number">Number</option>
            <option value="ring">Ring</option>
            <option value="progress">Progress</option>
            <option value="text">Text</option>
          </select>
          <select class="select block-span">
            <option value="1">Span 1</option>
            <option value="2">Span 2</option>
            <option value="3">Span 3</option>
          </select>
        </div>
        <div class="block-fields"></div>
      `;
      row.querySelector(".block-type").value=block.type;
      row.querySelector(".block-span").value=String(block.span||1);
      row.querySelector(".block-type").addEventListener("change",e=>mutate(x=>x.data.blocks[index].type=e.target.value));
      row.querySelector(".block-span").addEventListener("change",e=>mutate(x=>x.data.blocks[index].span=Number(e.target.value)));
      row.querySelector(".up").addEventListener("click",()=>mutate(x=>swapRows(x.data.blocks,index,-1)));
      row.querySelector(".down").addEventListener("click",()=>mutate(x=>swapRows(x.data.blocks,index,1)));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.blocks.splice(index,1)));

      const fields=row.querySelector(".block-fields");
      const appendField=(label,key,type="text")=>fields.appendChild(field(label,block[key]??"",v=>mutate(x=>x.data.blocks[index][key]=type==="number"?numberValue(v):v),type));
      if(block.type==="hero"){
        appendField("Title","title");appendField("Subtitle","subtitle");appendField("Value","value");
      }else if(block.type==="number"){
        appendField("Label","label");appendField("Value","value");
      }else if(block.type==="ring"||block.type==="progress"){
        appendField("Label","label");appendField("Value","value","number");appendField("Max","max","number");
      }else{
        appendField("Title","title");fields.appendChild(textareaField("Text",block.text||"",v=>mutate(x=>x.data.blocks[index].text=v)));
      }
      list.appendChild(row);
    });
    blocks.appendChild(list);

    const addWrap=document.createElement("div");addWrap.className="statboard-add-grid";
    ["hero","number","ring","progress","text"].forEach(type=>{
      const b=document.createElement("button");b.className="btn";b.textContent=`+ ${type}`;
      b.addEventListener("click",()=>mutate(x=>{
        const defaults={
          hero:{id:newItemId(),type:"hero",span:Math.min(2,x.settings.columns||2),title:"Hero",subtitle:"Subtitle",value:"96"},
          number:{id:newItemId(),type:"number",span:1,label:"Metric",value:"0"},
          ring:{id:newItemId(),type:"ring",span:1,label:"Rate",value:75,max:100},
          progress:{id:newItemId(),type:"progress",span:1,label:"Progress",value:80,max:100},
          text:{id:newItemId(),type:"text",span:Math.min(2,x.settings.columns||2),title:"Note",text:"Text"}
        };
        x.data.blocks.push(defaults[type]);
      }));
      addWrap.appendChild(b);
    });
    blocks.appendChild(addWrap);
    frag.appendChild(blocks);
  }

  const spreadsheet=buildSpreadsheetSection(p);
  if(spreadsheet)frag.appendChild(spreadsheet);

  return frag;
}

function buildStylePanel(){
  const p=current();
  const frag=document.createDocumentFragment();

  if(p.type==="ranking-card"){
    const templates=section(t("ranking.template"));
    const picker=document.createElement("div");picker.className="template-picker";
    Object.entries(RANKING_TEMPLATES).forEach(([id,def])=>{
      const b=document.createElement("button");
      b.type="button";
      b.className=`template-choice ${(p.settings.template||"sports")===id?"active":""}`;
      b.innerHTML=`<div class="template-choice-name">${id}</div><div class="template-choice-preview"></div>`;
      b.querySelector(".template-choice-preview").style.background=def.preview;
      b.addEventListener("click",()=>mutate(x=>applyRankingTemplate(x,id)));
      picker.appendChild(b);
    });
    templates.appendChild(picker);
    frag.appendChild(templates);
  }

  if(p.type==="stat-card"){
    const templates=section("Stat Card Template");
    const picker=document.createElement("div");picker.className="template-picker";
    Object.keys(STAT_TEMPLATES).forEach(id=>{
      const b=document.createElement("button");b.type="button";b.className=`template-choice ${(p.settings.template||"sports")===id?"active":""}`;
      b.innerHTML=`<div class="template-choice-name">${id}</div><div class="template-choice-preview stat-preview-${id}"></div>`;
      b.addEventListener("click",()=>mutate(x=>applyStatTemplate(x,id)));picker.appendChild(b);
    });templates.appendChild(picker);frag.appendChild(templates);
  }

  const themes=section(t("editor.theme"));
  const grid=document.createElement("div");grid.className="theme-grid";

  Object.values(THEMES).forEach(th=>{
    const b=document.createElement("button");
    b.className=`theme-btn ${p.style.theme===th.id?"active":""}`;
    b.style.background=th.bg;
    b.innerHTML=`<b>${th.id}</b><div class="theme-swatches"><i class="swatch" style="background:${th.surface}"></i><i class="swatch" style="background:${th.text}"></i><i class="swatch" style="background:${th.accent}"></i></div>`;
    b.addEventListener("click",()=>mutate(x=>applyTheme(x,th.id)));
    grid.appendChild(b);
  });
  themes.appendChild(grid);
  frag.appendChild(themes);

  const colors=section(t("editor.colors"));
  const defs=[
    ["background","editor.background"],
    ["surface","Surface"],
    ["primary","editor.textColor"],
    ["secondary","editor.mutedColor"],
    ["accent","editor.accent"],
    ["border","Border"]
  ];
  defs.forEach(([key,label])=>{
    const row=document.createElement("div");row.className="field";
    const l=document.createElement("label");l.textContent=label.startsWith("editor.")?t(label):label;
    const wrap=document.createElement("div");wrap.className="color-row";
    const c=document.createElement("input");c.type="color";c.className="color-input";c.value=p.style[key];
    const txt=document.createElement("input");txt.className="input";txt.value=p.style[key];
    c.addEventListener("input",()=>{txt.value=c.value;mutate(x=>x.style[key]=c.value,{historyCommit:false,panels:false})});
    c.addEventListener("change",()=>mutate(x=>x.style[key]=c.value));
    txt.addEventListener("change",()=>mutate(x=>x.style[key]=txt.value));
    wrap.append(c,txt);row.append(l,wrap);colors.appendChild(row);
  });
  frag.appendChild(colors);
  return frag;
}

function buildTextPanel(){
  const p=current();
  const frag=document.createDocumentFragment();
  const ty=section(t("editor.typography"));

  const font=document.createElement("div");font.className="field";
  const l=document.createElement("label");l.textContent="Font";
  const sel=document.createElement("select");sel.className="select";
  [
    ["system-ui","System / Noto"],
    ["Arial, sans-serif","Arial"],
    ["Georgia, serif","Serif"]
  ].forEach(([v,n])=>{
    const o=document.createElement("option");o.value=v;o.textContent=n;if(v===p.style.typography.fontFamily)o.selected=true;sel.appendChild(o)
  });
  sel.addEventListener("change",()=>mutate(x=>x.style.typography.fontFamily=sel.value));
  font.append(l,sel);ty.appendChild(font);

  ty.appendChild(field("Title Scale",p.style.typography.titleScale,v=>mutate(x=>x.style.typography.titleScale=Math.max(.6,Math.min(1.8,Number(v)||1))),"number",{step:"0.1",min:"0.6",max:"1.8"}));
  ty.appendChild(field("Body Scale",p.style.typography.bodyScale,v=>mutate(x=>x.style.typography.bodyScale=Math.max(.6,Math.min(1.8,Number(v)||1))),"number",{step:"0.1",min:"0.6",max:"1.8"}));
  frag.appendChild(ty);
  return frag;
}

function buildCanvasPanel(){
  const p=current();
  const frag=document.createDocumentFragment();
  const can=section(t("editor.canvasSize"));

  const seg=document.createElement("div");seg.className="segmented";
  Object.entries(CANVAS_PRESETS).forEach(([id,sz])=>{
    const b=document.createElement("button");
    b.className=`seg-btn ${p.canvas.preset===id?"active":""}`;
    b.textContent=id;
    b.addEventListener("click",()=>mutate(x=>applyCanvasPreset(x,id)));
    seg.appendChild(b);
  });
  can.appendChild(seg);

  const grid=document.createElement("div");grid.className="inline-grid";grid.style.marginTop="10px";
  grid.appendChild(field(t("editor.width"),p.canvas.width,v=>mutate(x=>{x.canvas.width=Math.max(320,numberValue(v));x.canvas.preset="custom"}),"number"));
  grid.appendChild(field(t("editor.height"),p.canvas.height,v=>mutate(x=>{x.canvas.height=Math.max(320,numberValue(v));x.canvas.preset="custom"}),"number"));
  can.appendChild(grid);

  const transparent=document.createElement("button");
  transparent.className=`btn ${p.canvas.transparent?"primary":""}`;
  transparent.textContent=p.canvas.transparent?(getLanguage()==="ja"?"透過背景 ON":"Transparent ON"):(getLanguage()==="ja"?"透過背景 OFF":"Transparent OFF");
  transparent.addEventListener("click",()=>mutate(x=>x.canvas.transparent=!x.canvas.transparent));
  can.appendChild(transparent);

  frag.appendChild(can);
  return frag;
}

function buildPanel(){
  if(activePanel==="data")return buildDataPanel();
  if(activePanel==="style")return buildStylePanel();
  if(activePanel==="text")return buildTextPanel();
  return buildCanvasPanel();
}

function panelLabel(panel){
  return t(`editor.${panel}`);
}

function renderPanels(){
  const desktop=$("panelContent");
  const mobile=$("mobilePanelContent");

  if(mobileQuery.matches){
    desktop.innerHTML="";
    mobile.innerHTML="";
    mobile.appendChild(buildPanel());
  }else{
    mobile.innerHTML="";
    desktop.innerHTML="";
    desktop.appendChild(buildPanel());
  }

  if($("mobilePanelTitle")){
    $("mobilePanelTitle").textContent=panelLabel(activePanel);
  }
}

function syncHistoryButtons(){
  const canUndo=history.canUndo();
  const canRedo=history.canRedo();

  ["undoBtn","mobileUndoBtn"].forEach(id=>{
    if($(id))$(id).disabled=!canUndo;
  });

  ["redoBtn","mobileRedoBtn"].forEach(id=>{
    if($(id))$(id).disabled=!canRedo;
  });
}

function renderSourceQuickBar(){
  const p=current();
  const model=getSourceModel(p);
  const bar=$("sourceQuickBar");

  if(!bar)return;
  bar.innerHTML="";

  if(!model || !p.settings.sourceLinked){
    bar.classList.add("hidden");
    document.body.classList.remove("source-linked");
    return;
  }

  document.body.classList.add("source-linked");
  bar.classList.remove("hidden");

  const lead=document.createElement("div");
  lead.className="source-quick-lead";
  lead.innerHTML=`<b>連動元</b><span></span>`;
  lead.querySelector("span").textContent=model.sheet.title||"Stats Maker";
  bar.appendChild(lead);

  const addSelect=(label,options,value,onChange)=>{
    const wrap=document.createElement("label");
    wrap.className="source-quick-select";
    const span=document.createElement("span");
    span.textContent=label;
    const select=document.createElement("select");
    options.forEach(opt=>{
      const o=document.createElement("option");
      o.value=String(opt.value);
      o.textContent=opt.label;
      o.selected=String(opt.value)===String(value);
      select.appendChild(o);
    });
    select.addEventListener("change",()=>onChange(select.value));
    wrap.append(span,select);
    bar.appendChild(wrap);
  };

  if(p.type==="stat-card" || p.type==="ring"){
    addSelect(
      "対象",
      getSubjectOptions(model),
      p.settings.sourceSubjectIndex??model.rows[0]?.rawIndex??"",
      value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
    );
  }else if(["ranking-card","bar","dot","tier-list"].includes(p.type)){
    addSelect(
      "評価",
      getMetricOptions(model),
      p.settings.sourceMetricKey||model.metricKey,
      value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
    );
  }else if(p.type==="quadrant" || p.type==="scatter"){
    addSelect(
      "X",
      getCriterionOptions(model),
      p.settings.sourceXIndex??0,
      value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
    );
    addSelect(
      "Y",
      getCriterionOptions(model),
      p.settings.sourceYIndex??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
    );
  }else if(p.type==="range"){
    addSelect(
      "A",
      getCriterionOptions(model),
      p.settings.sourceRangeA??0,
      value=>mutate(x=>syncSourceProject(x,{aIndex:Number(value)}))
    );
    addSelect(
      "B",
      getCriterionOptions(model),
      p.settings.sourceRangeB??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{bIndex:Number(value)}))
    );
  }else if(p.type==="radar"){
    const chips=document.createElement("div");
    chips.className="source-quick-chips";
    const current=new Set((p.settings.sourceSeriesIndices||[]).map(Number));
    model.rows.forEach(row=>{
      const button=document.createElement("button");
      button.type="button";
      button.className=`source-quick-chip ${current.has(row.rawIndex)?"active":""}`;
      button.textContent=row.name;
      button.addEventListener("click",()=>{
        const next=new Set(current);
        if(next.has(row.rawIndex))next.delete(row.rawIndex);
        else if(next.size<6)next.add(row.rawIndex);
        mutate(x=>syncSourceProject(x,{seriesIndices:[...next]}));
      });
      chips.appendChild(button);
    });
    bar.appendChild(chips);
  }
}

function renderHeader(){
  const p=current();
  $("projectTitleInput").value=p.meta.title||"";
  $("projectTitleInput").readOnly=!!p.settings.sourceLinked;
  $("projectTitleInput").classList.toggle("source-readonly",!!p.settings.sourceLinked);
  renderSourceQuickBar();
  syncHistoryButtons();

  $("langBtn").textContent=`🌐 ${getLanguage().toUpperCase()}`;
  if($("mobileLangBtn"))$("mobileLangBtn").textContent=getLanguage().toUpperCase();
  if($("mobilePanelTitle"))$("mobilePanelTitle").textContent=panelLabel(activePanel);
}

function render({panels=true}={}){
  applyI18n();
  renderHeader();
  renderPreview();
  if(panels)renderPanels();
}

function openMobileSheet(){
  if(!mobileQuery.matches)return;
  $("mobileSheetBackdrop").classList.remove("hidden");
  document.body.classList.add("sheet-open");
  renderPanels();
}

function closeMobileSheet(){
  $("mobileSheetBackdrop").classList.add("hidden");
  document.body.classList.remove("sheet-open");
}

function setPanel(panel,openMobile=false){
  activePanel=panel;
  document.querySelectorAll(".panel-tab,.mobile-tab").forEach(
    b=>b.classList.toggle("active",b.dataset.panel===panel)
  );
  renderPanels();
  if(openMobile)openMobileSheet();
}

function doUndo(){
  const p=history.undo();
  if(p){
    project=p;
    queueSave();
    render();
  }
}

function doRedo(){
  const p=history.redo();
  if(p){
    project=p;
    queueSave();
    render();
  }
}

function closeExportPreview(){
  $("exportPreviewModal").classList.add("hidden");
  $("exportPreviewImage").removeAttribute("src");
  if(exportPreviewUrl){
    URL.revokeObjectURL(exportPreviewUrl);
    exportPreviewUrl=null;
  }
  exportPreviewFile=null;
}

function showExportPreview(result){
  if(exportPreviewUrl)URL.revokeObjectURL(exportPreviewUrl);
  exportPreviewUrl=URL.createObjectURL(result.blob);
  exportPreviewFile=result.file;
  $("exportPreviewImage").src=exportPreviewUrl;
  $("exportPreviewTitle").textContent=result.mime==="image/jpeg"?"JPGプレビュー":"PNGプレビュー";
  $("exportPreviewModal").classList.remove("hidden");
}

async function shareExportPreview(){
  if(!exportPreviewFile)return;
  try{
    if(navigator.share && navigator.canShare?.({files:[exportPreviewFile]})){
      await navigator.share({files:[exportPreviewFile],title:exportPreviewFile.name});
      return;
    }
  }catch(e){
    if(e?.name==="AbortError")return;
    console.warn("Native share failed",e);
  }
  alert(getLanguage()==="ja"
    ?"共有シートを開けませんでした。表示中の画像を長押しして保存してください。"
    :"Sharing is unavailable. Long-press the image to save it.");
}

async function doExport(){
  const button=$("exportBtn");
  const oldText=button.textContent;
  try{
    button.disabled=true;
    button.textContent=getLanguage()==="ja"?"生成中…":"Rendering…";
    const result=await exportPreview($("previewRoot"),current(),"png");
    if(result.method==="preview")showExportPreview(result);
  }catch(e){
    console.error(e);
    alert(getLanguage()==="ja"
      ?`PNG生成に失敗しました\n${e?.message||""}`
      :`PNG export failed\n${e?.message||""}`);
  }finally{
    button.disabled=false;
    button.textContent=oldText;
  }
}

function fitPreview(){
  zoomTouched=false;
  fitZoomToStage();
  renderPreview();
}


function chooseProjectFile(){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept=".json,.statsmaker.json,application/json";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.click();
  });
}

function toggleMoreMenu(force){
  const menu=$("moreMenu");
  const show=typeof force==="boolean"?force:menu.classList.contains("hidden");
  menu.classList.toggle("hidden",!show);
}

document.querySelectorAll(".panel-tab").forEach(
  b=>b.addEventListener("click",()=>setPanel(b.dataset.panel,false))
);
document.querySelectorAll(".mobile-tab").forEach(
  b=>b.addEventListener("click",()=>setPanel(b.dataset.panel,true))
);

$("mobileSheetBackdrop").addEventListener("click",e=>{
  if(e.target===$("mobileSheetBackdrop"))closeMobileSheet();
});
$("mobileDoneBtn").addEventListener("click",closeMobileSheet);

$("projectTitleInput").addEventListener("change",e=>{
  if(current().settings?.sourceLinked){
    e.target.value=current().meta.title||"";
    return;
  }
  mutate(x=>x.meta.title=e.target.value);
});

$("undoBtn").addEventListener("click",doUndo);
$("redoBtn").addEventListener("click",doRedo);
$("mobileUndoBtn").addEventListener("click",doUndo);
$("mobileRedoBtn").addEventListener("click",doRedo);

$("langBtn").addEventListener("click",()=>{
  toggleLanguage();
  render();
});
$("mobileLangBtn").addEventListener("click",()=>{
  toggleLanguage();
  render();
});

$("zoomOutBtn").addEventListener("click",()=>{
  zoomTouched=true;
  zoom=Math.max(.18,zoom-.05);
  renderPreview();
});
$("zoomInBtn").addEventListener("click",()=>{
  zoomTouched=true;
  zoom=Math.min(1,zoom+.05);
  renderPreview();
});
$("fitZoomBtn").addEventListener("click",fitPreview);

$("exportBtn").addEventListener("click",doExport);
$("mobileExportBtn").addEventListener("click",doExport);
$("exportPreviewClose").addEventListener("click",closeExportPreview);
$("exportPreviewDismiss").addEventListener("click",closeExportPreview);
$("exportPreviewShare").addEventListener("click",shareExportPreview);
$("exportPreviewModal").addEventListener("click",e=>{
  if(e.target===$("exportPreviewModal"))closeExportPreview();
});

$("moreBtn").addEventListener("click",e=>{
  e.stopPropagation();
  toggleMoreMenu();
});
document.addEventListener("click",e=>{
  if(!$("moreMenu").contains(e.target) && e.target!==$("moreBtn"))toggleMoreMenu(false);
});
$("jpgBtn").addEventListener("click",async()=>{
  toggleMoreMenu(false);
  try{
    const result=await exportPreview($("previewRoot"),current(),"jpg");
    if(result.method==="preview")showExportPreview(result);
  }catch(e){
    console.error(e);
    alert(getLanguage()==="ja"
      ?`JPG生成に失敗しました\n${e?.message||""}`
      :`JPG export failed\n${e?.message||""}`);
  }
});

$("backupBtn").addEventListener("click",()=>{
  toggleMoreMenu(false);
  exportProjectJSON(current());
});
$("restoreBtn").addEventListener("click",async()=>{
  toggleMoreMenu(false);
  const file=await chooseProjectFile();
  if(!file)return;
  try{
    const loaded=await readProjectJSON(file);
    loaded.id=current().id;
    loaded.meta={...loaded.meta,updatedAt:new Date().toISOString()};
    project=history.commit(loaded);
    queueSave();
    zoomTouched=false;
    render();
    requestAnimationFrame(fitPreview);
  }catch(e){
    console.error(e);
    alert(getLanguage()==="ja"?"Projectを読み込めませんでした":"Could not load project");
  }
});

function handleViewportResize(){
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    const nowMobile=mobileQuery.matches;

    if(nowMobile!==lastMobileMode){
      lastMobileMode=nowMobile;
      if(!nowMobile)closeMobileSheet();
      renderPanels();
    }

    if(!zoomTouched){
      fitZoomToStage();
      renderPreview();
    }
  },90);
}

window.addEventListener("resize",handleViewportResize);
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",handleViewportResize);
}
window.addEventListener("beforeunload",()=>{
  try{saveProject(current())}catch{}
});

render();
requestAnimationFrame(()=>{
  fitZoomToStage();
  renderPreview();
});
