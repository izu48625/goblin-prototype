
(function(){
"use strict";

const EXTENSIONS=[
  ["popular","ranking-card","Ranking Card","総合平均または評価項目でランキング","Rank by overall average or any metric"],
  ["popular","stat-card","Stat Card","対象の画像と評価を1枚のカードに","Turn one subject into a visual stat card"],
  ["popular","bar","Bar Chart","評価項目を棒グラフで比較","Compare a metric with horizontal bars"],
  ["popular","radar","Radar Chart","複数対象を全評価項目で比較","Compare multiple subjects across metrics"],
  ["compare","quadrant","Quadrant","任意の2項目で4象限マップ","Map subjects on any two metrics"],
  ["compare","dot","Dot Chart","項目ごとの差をシンプルに比較","Compare one metric with a clean dot plot"],
  ["compare","range","Range / Dumbbell","2項目の差を見せる","Show the gap between two metrics"],
  ["compare","scatter","Scatter","任意の2項目を散布図に","Plot any two metrics as a scatter chart"],
  ["ranking","tier-list","Tier List","評価をTier形式で整理","Organize subjects into visual tiers"],
  ["number","ring","Ring Gauge","対象の評価をリングで表示","Show a subject's scores as ring gauges"]
];

const UI={
  ja:{
    launcherTitle:"拡張機能",
    launcherSub:"グラフ・カードを作る",
    pickerTitle:"拡張機能",
    pickerDesc:"基本表の対象・画像・評価項目・点数をそのまま使います。",
    groups:{popular:"人気",compare:"比較",ranking:"ランキング",number:"数値表示"}
  },
  en:{
    launcherTitle:"Visual Tools",
    launcherSub:"Create charts & cards",
    pickerTitle:"Visual Tools",
    pickerDesc:"Uses names, images, metrics and scores from your current sheet.",
    groups:{popular:"POPULAR",compare:"COMPARE",ranking:"RANKING",number:"SHOW A NUMBER"}
  }
};

const $=id=>document.getElementById(id);
const frame=$("basicFrame");
const backdrop=$("extBackdrop");
let language=localStorage.getItem("statsMakerV2Language")
  ||localStorage.getItem("statsMaker.locale")
  ||((navigator.language||"ja").toLowerCase().startsWith("ja")?"ja":"en");

function setLanguage(next){
  language=next==="en"?"en":"ja";
  localStorage.setItem("statsMakerV2Language",language);
  localStorage.setItem("statsMaker.locale",language);
  try{frame.contentWindow?.SM_I18N?.setLanguage(language)}catch{}
  renderLanguage();
}

function renderLanguage(){
  const u=UI[language];
  $("launcherTitle").textContent=u.launcherTitle;
  $("launcherSub").textContent=u.launcherSub;
  $("pickerTitle").textContent=u.pickerTitle;
  $("pickerDesc").textContent=u.pickerDesc;
  $("langJa").classList.toggle("active",language==="ja");
  $("langEn").classList.toggle("active",language==="en");

  const host=$("extGroups");
  host.innerHTML="";
  ["popular","compare","ranking","number"].forEach(group=>{
    const items=EXTENSIONS.filter(x=>x[0]===group);
    if(!items.length)return;

    const section=document.createElement("div");
    section.className="extGroup";
    section.innerHTML='<div class="extGroupTitle"></div><div class="extGrid"></div>';
    section.querySelector(".extGroupTitle").textContent=u.groups[group];

    const grid=section.querySelector(".extGrid");
    items.forEach(([,type,name,jaDesc,enDesc])=>{
      const button=document.createElement("button");
      button.type="button";
      button.className="extCard";
      button.innerHTML="<b></b><span></span>";
      button.querySelector("b").textContent=name;
      button.querySelector("span").textContent=language==="ja"?jaDesc:enDesc;
      button.addEventListener("click",()=>openExtension(type));
      grid.appendChild(button);
    });
    host.appendChild(section);
  });
}

function getLiveSheet(){
  try{
    const lib=frame.contentWindow?.__statsMakerGetLibrary?.();
    if(lib)localStorage.setItem("statsMakerV014Library",JSON.stringify(lib));
    return frame.contentWindow?.__statsMakerGetActiveSheet?.()||null;
  }catch(error){
    console.error("Base bridge failed",error);
    return null;
  }
}

function openExtension(type){
  try{
    if(!window.StatsMakerRequire)throw new Error("Stats Maker runtime unavailable");

    const {createProject}=window.StatsMakerRequire("core/project.js");
    const {saveProject}=window.StatsMakerRequire("core/store.js");
    const {syncSourceProject}=window.StatsMakerRequire("core/source-sync.js");

    const sheet=getLiveSheet();
    const project=createProject(type);
    if(sheet?.id)project.settings.sourceSheetId=sheet.id;

    syncSourceProject(project,{},sheet);
    saveProject(project);

    location.href=`app/editor.html?v=r12&id=${encodeURIComponent(project.id)}`;
  }catch(error){
    console.error(error);
    alert((language==="ja"?"拡張機能を開けませんでした：":"Could not open visual tool: ")+(error?.message||error));
  }
}

$("extLauncher").addEventListener("click",()=>backdrop.classList.remove("hidden"));
$("extClose").addEventListener("click",()=>backdrop.classList.add("hidden"));
backdrop.addEventListener("click",event=>{if(event.target===backdrop)backdrop.classList.add("hidden")});
$("langJa").addEventListener("click",()=>setLanguage("ja"));
$("langEn").addEventListener("click",()=>setLanguage("en"));

frame.addEventListener("load",()=>{
  try{frame.contentWindow?.SM_I18N?.setLanguage(language)}catch{}
});

window.addEventListener("message",event=>{
  if(event.data?.type!=="statsmaker:languagechange")return;
  language=event.data.locale==="en"?"en":"ja";
  localStorage.setItem("statsMakerV2Language",language);
  renderLanguage();
});

renderLanguage();

if(new URLSearchParams(location.search).get("extensions")==="1"){
  requestAnimationFrame(()=>backdrop.classList.remove("hidden"));
}
})();
