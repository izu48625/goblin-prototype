import {t,getLanguage,toggleLanguage,applyI18n} from "./core/i18n.js";
import {createProject,cloneProject} from "./core/project.js";
import {listProjects,saveProject,deleteProject} from "./core/store.js";

const createDefs=[
  {type:"ranking-card",label:"viz.ranking",desc:"viz.rankingDesc",preview:"ranking",category:"Popular"},
  {type:"stat-card",label:"viz.stat",desc:"viz.statDesc",preview:"stat",category:"Popular"},
  {type:"bar",label:"viz.bar",desc:"viz.barDesc",preview:"bar",category:"Popular"},
  {type:"radar",label:"viz.radar",desc:"viz.radarDesc",preview:"radar",category:"Popular"},
  {type:"quadrant",label:"viz.quadrant",desc:"viz.quadrantDesc",preview:"quadrant",category:"Compare"},
  {type:"dot",label:"viz.dot",desc:"viz.dotDesc",preview:"dot",category:"Compare"},
  {type:"range",label:"viz.range",desc:"viz.rangeDesc",preview:"range",category:"Compare"},
  {type:"scatter",label:"viz.scatter",desc:"viz.scatterDesc",preview:"scatter",category:"Compare"},
  {type:"heatmap",label:"viz.heatmap",desc:"viz.heatmapDesc",preview:"heatmap",category:"Analyze"},
  {type:"tier-list",label:"viz.tier",desc:"viz.tierDesc",preview:"tier",category:"Ranking"},
  {type:"ring",label:"viz.ring",desc:"viz.ringDesc",preview:"ring",category:"Show a Number"},
  {type:"waffle",label:"viz.waffle",desc:"viz.waffleDesc",preview:"waffle",category:"Show a Number"},
  {type:"stat-board",label:"viz.statBoard",desc:"viz.statBoardDesc",preview:"statboard",category:"Advanced"}
];

function previewMarkup(kind){
  if(kind==="ranking")return `<div class="mini-ranking"><div class="mini-rank-row"><b>1</b><span>対象A</span><b>92</b></div><div class="mini-rank-row"><b>2</b><span>対象B</span><b>86</b></div><div class="mini-rank-row"><b>3</b><span>対象C</span><b>80</b></div></div>`;
  if(kind==="stat")return `<div class="mini-stat"><div><div class="ovr">94</div><div class="name">対象A</div></div><div class="mini-stat-grid"><span>評価1 92</span><span>評価2 91</span><span>評価3 88</span><span>評価4 95</span></div></div>`;
  if(kind==="quadrant")return `<div class="mini-quadrant"><i class="mini-dot d1"></i><i class="mini-dot d2"></i><i class="mini-dot d3"></i><i class="mini-dot d4"></i></div>`;
  if(kind==="bar")return `<div class="mini-bar"><div><span>A</span><i style="width:92%"></i></div><div><span>B</span><i style="width:78%"></i></div><div><span>C</span><i style="width:64%"></i></div><div><span>D</span><i style="width:48%"></i></div></div>`;
  if(kind==="radar")return `<div class="mini-radar"><svg viewBox="0 0 100 100"><polygon points="50,7 90,31 82,78 50,94 14,77 10,31" class="grid"></polygon><polygon points="50,17 82,34 74,70 50,82 24,69 20,34" class="shape a"></polygon><polygon points="50,24 72,38 80,72 50,73 31,63 27,39" class="shape b"></polygon></svg></div>`;
  if(kind==="dot")return `<div class="mini-generic mini-dot-preview"><i style="left:82%"></i><i style="left:62%"></i><i style="left:42%"></i></div>`;
  if(kind==="ring")return `<div class="mini-ring-preview"><i></i><i></i><i></i></div>`;
  if(kind==="tier")return `<div class="mini-tier-preview"><b>S</b><span></span><b>A</b><span></span><b>B</b><span></span></div>`;
  if(kind==="heatmap")return `<div class="mini-heatmap-preview">${Array.from({length:20},(_,i)=>`<i style="opacity:${.2+(i%5)*.18}"></i>`).join("")}</div>`;
  if(kind==="scatter")return `<div class="mini-scatter-preview"><i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i></div>`;
  if(kind==="range")return `<div class="mini-range-preview"><span><i></i><b></b></span><span><i></i><b></b></span><span><i></i><b></b></span></div>`;
  if(kind==="waffle")return `<div class="mini-waffle-preview">${Array.from({length:50},(_,i)=>`<i class="${i<28?"on":""}"></i>`).join("")}</div>`;
  return `<div class="mini-statboard-preview"><b>96</b><span></span><span></span><i></i><i></i></div>`;
}

function renderCreate(){
  const grid=document.getElementById("createGrid");
  grid.innerHTML="";
  const groups=[...new Set(createDefs.map(d=>d.category))];

  groups.forEach(category=>{
    const section=document.createElement("section");
    section.className="create-category";
    section.innerHTML=`<div class="create-category-title"></div><div class="category-grid"></div>`;
    section.querySelector(".create-category-title").textContent=category;

    const inner=section.querySelector(".category-grid");
    createDefs.filter(d=>d.category===category).forEach(def=>{
      const card=document.createElement("article");
      card.className="template-card";
      card.innerHTML=`
        <div class="template-preview">${previewMarkup(def.preview)}</div>
        <div class="template-copy">
          <div class="template-title">${t(def.label)}</div>
          <div class="template-desc">${t(def.desc)}</div>
          <div class="template-actions"><button class="btn primary">${getLanguage()==="ja"?"作る":"Create"}</button></div>
        </div>
      `;
      card.querySelector("button").addEventListener("click",()=>{
        const p=createProject(def.type);
        saveProject(p);
        location.href=`editor.html?id=${encodeURIComponent(p.id)}`;
      });
      inner.appendChild(card);
    });

    grid.appendChild(section);
  });
}

function renderProjects(){
  const grid=document.getElementById("projectGrid");
  const empty=document.getElementById("emptyProjects");
  const list=listProjects();
  grid.innerHTML="";
  empty.classList.toggle("hidden",list.length>0);

  list.forEach(p=>{
    const card=document.createElement("article");
    card.className="project-card";
    const date=new Date(p.meta.updatedAt||Date.now()).toLocaleString(getLanguage()==="ja"?"ja-JP":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
    card.innerHTML=`
      <div class="project-card-head">
        <div>
          <div class="project-type">${p.type}</div>
          <div class="project-title"></div>
        </div>
      </div>
      <div class="project-meta">${date}</div>
      <div class="project-actions">
        <button class="btn primary open">${t("common.open")}</button>
        <button class="btn duplicate">${t("common.duplicate")}</button>
        <button class="btn delete">${t("common.delete")}</button>
      </div>
    `;
    card.querySelector(".project-title").textContent=p.meta.title||"Untitled";
    card.querySelector(".open").addEventListener("click",()=>location.href=`editor.html?id=${encodeURIComponent(p.id)}`);
    card.querySelector(".duplicate").addEventListener("click",()=>{
      saveProject(cloneProject(p));
      renderProjects();
    });
    card.querySelector(".delete").addEventListener("click",()=>{
      if(confirm(getLanguage()==="ja"?"このProjectを削除しますか？":"Delete this project?")){
        deleteProject(p.id);
        renderProjects();
      }
    });
    grid.appendChild(card);
  });
}

function refresh(){
  applyI18n();
  document.getElementById("langBtn").textContent=`🌐 ${getLanguage().toUpperCase()}`;
  renderCreate();
  renderProjects();
}

document.getElementById("langBtn").addEventListener("click",()=>{
  toggleLanguage();
  refresh();
});
refresh();
