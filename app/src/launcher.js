import {EXTENSIONS} from "./extension-catalog.js?v=r118public1";
import {createProject} from "./core/project.js";
import {saveProject} from "./core/store.js";
import {syncSourceProject} from "./core/source-sync.js?v=r29source1";

const UI={
  ja:{launcherTitle:"データやグラフ",launcherSub:"グラフ・カードを作る",pickerTitle:"データやグラフ",pickerDesc:"基本表の対象・画像・評価項目・点数をそのまま使います。",groups:{popular:"人気",compare:"比較",ranking:"ランキング",number:"数値表示",creative:"画像グラフ"}},
  en:{launcherTitle:"Visual Tools",launcherSub:"Create charts & cards",pickerTitle:"Visual Tools",pickerDesc:"Uses names, images, metrics and scores from your current sheet.",groups:{popular:"POPULAR",compare:"COMPARE",ranking:"RANKING",number:"SHOW A NUMBER",creative:"IMAGE CHART"}}
};
const $=id=>document.getElementById(id);
const frame=$("basicFrame"),backdrop=$("extBackdrop");
const communityTopicId=new URLSearchParams(location.search).get('community')||'';
const communityMode=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(communityTopicId);
let freshHomeHandled=false;
let language=localStorage.getItem("statsMakerV2Language")||localStorage.getItem("statsMaker.locale")||((navigator.language||"ja").toLowerCase().startsWith("ja")?"ja":"en");

function setLanguage(next){
  language=next==="en"?"en":"ja";
  localStorage.setItem("statsMakerV2Language",language);
  localStorage.setItem("statsMaker.locale",language);
  try{frame.contentWindow?.SM_I18N?.setLanguage(language)}catch{}
  renderLanguage();
}
window.SM_LAUNCHER_SET_LANGUAGE=setLanguage;
function renderLanguage(){
  const u=UI[language];
  $("launcherTitle").textContent=u.launcherTitle;$("launcherSub").textContent=u.launcherSub;$("pickerTitle").textContent=u.pickerTitle;$("pickerDesc").textContent=u.pickerDesc;
  const examples=$("extExamplesLink");
  if(examples){
    examples.href=language==="en"?"/en/examples.html":"/ja/examples.html";
    examples.textContent=language==="en"?"See finished chart examples and instructions →":"完成グラフの作例と作り方を見る →";
  }
  window.SM_R89_LANGUAGE?.(language);
  const host=$("extGroups");host.innerHTML="";
  ["popular","compare","ranking","number","creative"].forEach(group=>{
    const items=EXTENSIONS.filter(x=>x[0]===group);if(!items.length)return;
    const section=document.createElement("div");section.className="extGroup";section.innerHTML='<div class="extGroupTitle"></div><div class="extGrid"></div>';
    section.querySelector(".extGroupTitle").textContent=u.groups[group];
    const grid=section.querySelector(".extGrid");
    items.forEach(([,type,name,jaDesc,enDesc])=>{
      const button=document.createElement("button");button.type="button";button.className="extCard";button.innerHTML="<b></b><span></span>";
      button.querySelector("b").textContent=name;button.querySelector("span").textContent=language==="ja"?jaDesc:enDesc;
      button.addEventListener("click",()=>openExtension(type));grid.appendChild(button);
    });host.appendChild(section);
  });
}
function getLiveSheet(){
  try{
    const lib=frame.contentWindow?.__statsMakerGetLibrary?.();
    // The Home iframe reports when its persisted library is corrupt. Never
    // bypass its fail-closed autosave safeguard during extension navigation.
    if(lib&&!communityMode&&frame.contentWindow?.__statsMakerCanPersist?.()!==false)
      localStorage.setItem("statsMakerV014Library",JSON.stringify(lib));
    return frame.contentWindow?.__statsMakerGetActiveSheet?.()||null;
  }catch(error){console.error("Base bridge failed",error);return null}
}
function openExtension(type){
  try{
    const sheet=getLiveSheet();
    const project=createProject(type);
    if(communityMode){
      if(!sheet?.sourceTopicId||sheet.sourceTopicId!==communityTopicId||
        !sheet.rows.some(r=>r.scores.some(Number.isFinite)))
        throw new Error('採点してから「データやグラフ」を開いてください。');
    }
    if(sheet?.id)project.settings.sourceSheetId=sheet.id;
    syncSourceProject(project,{},sheet);
    if(communityMode){
      // The community score snapshot is not a local Home sheet.
      project.settings.sourceLinked=false;
      project.settings.communitySnapshot=true;
      delete project.settings.sourceSheetId;
    }
    saveProject(project);
    window.SM_ANALYTICS?.event('template_selected',{template_type:type});
    const editorUrl=`app/editor.html?v=r27h1&id=${encodeURIComponent(project.id)}`+
      (communityMode?`&from=community&topic=${encodeURIComponent(communityTopicId)}`:'');
    location.href=window.SM_AD_PREVIEW_NAV?.url(editorUrl)||editorUrl;
  }catch(error){
    console.error(error);
    alert((language==="ja"?"データやグラフを開けませんでした：":"Could not open visual tool: ")+(error?.message||error));
  }
}
$("extLauncher").addEventListener("click",()=>backdrop.classList.remove("hidden"));
/* Same-origin bridge: mobile Home toolbar opens the existing extension picker
 * without an overlay hiding the bottom score rows. */
window.addEventListener("message",event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==="statsmaker:open-extensions")
    backdrop.classList.remove("hidden");
});
$("extClose").addEventListener("click",()=>backdrop.classList.add("hidden"));
backdrop.addEventListener("click",event=>{if(event.target===backdrop)backdrop.classList.add("hidden")});
frame.addEventListener("load",()=>{
  try{
    frame.contentWindow?.SM_I18N?.setLanguage(language);
    const homeLanguage=frame.contentWindow?.SM_I18N?.getLanguage?.();
    if(homeLanguage){language=homeLanguage==="en"?"en":"ja";renderLanguage()}

    const params=new URLSearchParams(location.search);
    if(!freshHomeHandled&&params.get("fresh")==="1"){
      const createFresh=frame.contentWindow?.__statsMakerCreateFreshSheet;
      if(typeof createFresh==="function"){
        freshHomeHandled=true;
        createFresh();
        params.delete("fresh");
        const query=params.toString();
        history.replaceState(null,"",location.pathname+(query?"?"+query:""));
      }
    }
  }catch(error){console.error("Home initialization failed",error)}
});
window.addEventListener("message",event=>{if(event.data?.type!=="statsmaker:languagechange")return;language=event.data.locale==="en"?"en":"ja";localStorage.setItem("statsMakerV2Language",language);renderLanguage()});
renderLanguage();
if(new URLSearchParams(location.search).get("extensions")==="1")requestAnimationFrame(()=>backdrop.classList.remove("hidden"));