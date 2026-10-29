import {createTierProject} from "/app/src/core/project.js";
import {saveProject} from "/app/src/core/store.js";

// A dedicated, working create flow for search visitors. No public-topic
// mutation, remote API request, auth, cookie or analytics is required.
const start=document.querySelector("#tierStart");
const status=document.querySelector("#tierStatus");
const ja=document.documentElement.lang==="ja";
if(start&&status){
  start.addEventListener("click",()=>{
    if(start.disabled)return;
    start.disabled=true;
    status.textContent=ja?"Tier表を準備中…":"Preparing your tier list…";
    try{
      const project=createTierProject();
      // Preserve editable sample values, but do not insert these illustrative
      // rows into Home scoring or into public Discover.
      project.meta.title=ja?"新しいTier表":"My Tier List";
      project.meta.subtitle=ja?"S〜Dでグループ分け":"Group items into tiers";
      project.data.items.forEach((item,i)=>{
        item.name=ja?`項目${i+1}`:`Item ${i+1}`;
      });
      project.meta.language=ja?"ja":"en";
      const saved=saveProject(project);
      const url=new URL("/app/editor.html",location.origin);
      url.searchParams.set("id",saved.id);
      location.assign(url.pathname+url.search);
    }catch(error){
      console.error("[Stats Maker] Could not start Tier List",error);
      status.textContent=ja
        ?"Tier表を開始できませんでした。ブラウザの保存容量やデータを確認してください。"
        :"Could not start. Check browser storage availability and try again.";
      start.disabled=false;
    }
  });
}
