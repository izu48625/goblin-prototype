import {EXTENSIONS,EXTENSION_GROUP_ORDER} from "../app/src/extension-catalog.js?v=r118public1";
import {createProject} from "../app/src/core/project.js";
import {saveProject} from "../app/src/core/store.js";
import {syncSourceProject} from "../app/src/core/source-sync.js?v=r118public1";

// Public works provide a viewable creator snapshot, NOT the viewer's Home sheet.
// This tool creates a new local visual project; no cloud writes are performed.
const labels={
  ja:{
    heading:"公開作品からグラフを作る",
    help:"作成者の公開スコアを使用します。元作品・共同採点は変更されません。",
    note:"作成したグラフは自分のブラウザに保存されます。画像・評価項目・点数は公開時点のコピーです。",
    close:"閉じる",busy:"作成中…",
    groups:{popular:"人気",compare:"比較",ranking:"ランキング",number:"数値表示",creative:"画像グラフ"},
    failed:"グラフを作成できませんでした：",
    missing:"この公開作品にはグラフ化できる採点データがありません。",
    images:"一部の対象画像を保存できませんでした。グラフは画像なしで作成します。",
    storage:"保存容量の制限により、対象画像なしでグラフを作成します。"
  },
  en:{
    heading:"Create a chart from this work",
    help:"Uses the creator's published scores. The original work and Community scores stay unchanged.",
    note:"Charts are saved in your browser. Scores, metrics, and images are a snapshot of this publication.",
    close:"Close",busy:"Creating…",
    groups:{popular:"POPULAR",compare:"COMPARE",ranking:"RANKING",number:"NUMBERS",creative:"IMAGE CHART"},
    failed:"Could not create chart: ",
    missing:"There are no published numeric scores available for a chart.",
    images:"Some target photos could not be saved. The chart will use the available images.",
    storage:"Browser storage is full; the chart will be created without target images."
  }
};
const $=id=>document.getElementById(id);
let source=null,busy=false;
const shell=document.createElement("div");
shell.id="publicVisualBackdrop";
shell.className="publicVisualBackdrop hidden";
shell.setAttribute("role","presentation");
shell.innerHTML=`<section class="publicVisualDialog" role="dialog" aria-modal="true" aria-labelledby="publicVisualTitle">
  <div class="publicVisualHeader">
    <div><h2 id="publicVisualTitle"></h2><p id="publicVisualHelp"></p></div>
    <button id="publicVisualClose" class="publicVisualClose" type="button" aria-label="Close">×</button>
  </div>
  <div id="publicVisualGroups"></div>
  <p id="publicVisualNote" class="publicVisualNote"></p>
  <p id="publicVisualStatus" class="publicVisualStatus" role="status" aria-live="polite"></p>
</section>`;
document.body.appendChild(shell);
const close=()=>{if(!busy)shell.classList.add("hidden")};
$("publicVisualClose").addEventListener("click",close);
shell.addEventListener("click",event=>{if(event.target===shell)close()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!shell.classList.contains("hidden"))close()});

function lang(){return source?.locale==="en"?"en":"ja"}
function copy(){return labels[lang()]}
function open(){
  if(!source||busy)return;
  const c=copy();
  $("publicVisualTitle").textContent=c.heading;
  $("publicVisualHelp").textContent=c.help;
  $("publicVisualNote").textContent=c.note;
  $("publicVisualStatus").textContent="";
  $("publicVisualClose").setAttribute("aria-label",c.close);
  const host=$("publicVisualGroups");
  host.replaceChildren();
  for(const group of EXTENSION_GROUP_ORDER){
    const items=EXTENSIONS.filter(item=>item[0]===group);
    if(!items.length)continue;
    const section=document.createElement("div");
    section.className="publicVisualGroup";
    const title=document.createElement("h3");
    title.textContent=c.groups[group]||group;
    const grid=document.createElement("div");
    grid.className="publicVisualGrid";
    for(const [,type,name,jaDesc,enDesc] of items){
      const button=document.createElement("button");
      button.type="button";
      button.className="publicVisualCard";
      const bold=document.createElement("b");
      bold.textContent=name;
      const small=document.createElement("span");
      small.textContent=lang()==="ja"?jaDesc:enDesc;
      button.append(bold,small);
      button.addEventListener("click",()=>createVisual(type));
      grid.appendChild(button);
    }
    section.append(title,grid);
    host.appendChild(section);
  }
  shell.classList.remove("hidden");
}
window.addEventListener("statsmaker:open-public-visuals",open);

function normalizeScore(raw,max){
  if(raw===null||raw===undefined||raw==="")return null;
  const n=Number(raw);
  return Number.isFinite(n)&&n>=0&&n<=max?n:null;
}
function buildPublishedSheet(work){
  const scale=work.scale===10?10:100;
  const cols=(work.criteria||[]).slice(0,10).map(c=>String(c?.name||"").trim());
  const weights=(work.criteria||[]).slice(0,10).map(c=>{
    const w=Number(c?.weight);
    return Number.isFinite(w)&&w>=0?w:1;
  });
  const rows=(work.rows||[]).slice(0,40).map(row=>({
    name:String(row?.name||"").trim(),
    note:String(row?.note||"").trim(),
    scores:cols.map((_,index)=>normalizeScore(row?.scores?.[index],scale)),
    image:""
  }));
  if(!cols.some(Boolean)||!rows.some(r=>r.name&&r.scores.some(Number.isFinite)))
    throw new Error(copy().missing);
  return {
    id:"published_"+work.id,
    title:String(work.title||"Stats Maker"),
    desc:String(work.description||""),
    cols,weights,rows,
    scale,weighted:!!work.weighted,
    rankMetric:"avg",compare:[],
    sourceTopicId:work.id
  };
}
function readAsDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(typeof reader.result==="string"?reader.result:"");
    reader.onerror=()=>reject(reader.error||new Error("Image read failed"));
    reader.readAsDataURL(blob);
  });
}
async function retainImages(work,sheet){
  const urls=(work.imageUrls||[]).slice(0,40);
  let next=0,failed=0;
  const worker=async()=>{
    while(next<urls.length){
      const i=next++;
      const url=urls[i];
      if(!url||!sheet.rows[i])continue;
      // Only already-authorized signed URLs returned by our private Storage.
      if(typeof url!=="string"||!url.startsWith("https://ibpdxbeltdwkquowjeay.supabase.co/storage/v1/object/sign/"))continue;
      try{
        const response=await fetch(url,{mode:"cors",credentials:"omit"});
        if(!response.ok)throw new Error("Image unavailable");
        const blob=await response.blob();
        if(blob.size>51200||!blob.type.startsWith("image/"))throw new Error("Image size or format");
        sheet.rows[i].image=await readAsDataUrl(blob);
      }catch(error){failed++;console.warn("[Stats Maker] Public target image snapshot skipped",error)}
    }
  };
  await Promise.all(Array.from({length:Math.min(4,urls.length)},worker));
  if(failed)$("publicVisualStatus").textContent=copy().images;
}
async function createVisual(type){
  if(busy||!source||!EXTENSIONS.some(item=>item[1]===type))return;
  busy=true;
  const c=copy();
  const buttons=[...shell.querySelectorAll("button")];
  buttons.forEach(button=>button.disabled=true);
  $("publicVisualStatus").textContent=c.busy;
  try{
    const sheet=buildPublishedSheet(source);
    await retainImages(source,sheet);
    const create=published=>{
      const p=createProject(type);
      syncSourceProject(p,{},published);
      // Keep the snapshot available to the editor's source selectors. It must
      // never silently rebind to the viewer's separate Home sheet.
      p.settings.publicSourceSheet=published;
      p.settings.publicSourceTopicId=source.id;
      p.meta.language=lang();
      p.publish={cloudId:null,visibility:"private",publishedAt:null};
      return p;
    };
    let project=create(sheet);
    try{
      saveProject(project);
    }catch(error){
      const quota=error?.name==="QuotaExceededError"||error?.name==="NS_ERROR_DOM_QUOTA_REACHED";
      if(!quota)throw error;
      sheet.rows.forEach(row=>row.image="");
      project=create(sheet);
      saveProject(project);
      $("publicVisualStatus").textContent=c.storage;
    }
    window.SM_ANALYTICS?.event("template_selected",{template_type:type,source:"public"});
    const target="app/editor.html?v=r118public1&id="+encodeURIComponent(project.id)+
      "&from=public&topic="+encodeURIComponent(source.id);
    location.href=window.SM_AD_PREVIEW_NAV?.url(target)||target;
  }catch(error){
    console.error("[Stats Maker] Public visual tool failed",error);
    $("publicVisualStatus").textContent=c.failed+(error?.message||error);
    busy=false;
    buttons.forEach(button=>button.disabled=false);
  }
}
function ready(){
  const incoming=window.SM_PUBLIC_VISUAL_SOURCE;
  if(!incoming||!/^[0-9a-f-]{36}$/i.test(String(incoming.id||"")))return;
  source=incoming;
  if(new URLSearchParams(location.search).get("visuals")==="1")open();
}
window.addEventListener("statsmaker:public-visual-ready",ready);
ready();
