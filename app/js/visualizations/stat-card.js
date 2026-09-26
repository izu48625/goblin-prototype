import {getImageUrl} from "../core/images.js";

export const statCard={
  id:"stat-card",
  labelKey:"viz.stat",

  validate(project){
    return !!project.data.name && Array.isArray(project.data.stats);
  },

  async render(project,root){
    root.innerHTML="";
    const wrap=document.createElement("div");
    wrap.className=`visual stat-card-visual stat-template-${project.settings?.template||"sports"}`;

    const card=document.createElement("div");
    card.className="player-card";
    card.innerHTML=`
      <div class="stat-hero">
        <div class="stat-image-wrap">
          <div class="stat-image-placeholder">IMAGE</div>
          <img class="stat-image hidden" alt="">
        </div>
        <div class="stat-top">
          <div>
            <div class="stat-name"></div>
            <div class="stat-subtitle"></div>
          </div>
          <div class="ovr-box">
          <div class="ovr-label">OVR</div>
            <div class="ovr-value"></div>
          </div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-grid"></div>
      <div class="stat-footer">
        <span class="team"></span>
        <span class="tier"></span>
      </div>
    `;

    const imageWrap=card.querySelector(".stat-image-wrap");
    const imageEl=card.querySelector(".stat-image");
    imageWrap.classList.add(`shape-${project.data.imageShape||"rounded"}`);
    if(project.data.imageData){
      imageEl.src=project.data.imageData;
      imageEl.classList.remove("hidden");
      card.querySelector(".stat-image-placeholder").classList.add("hidden");
    }else if(project.data.imageRef){
      try{
        const url=await getImageUrl(project.data.imageRef);
        if(url){
          imageEl.src=url;
          imageEl.classList.remove("hidden");
          card.querySelector(".stat-image-placeholder").classList.add("hidden");
        }
      }catch(e){
        console.warn("Stat image load failed",e);
      }
    }

    const displayName=project.data.name||project.meta.title||"";
    const nameEl=card.querySelector(".stat-name");
    nameEl.textContent=displayName;
    nameEl.classList.toggle("long-name",[...displayName].length>=9);
    card.querySelector(".stat-subtitle").textContent=project.data.subtitle||project.meta.subtitle||"";
    card.querySelector(".ovr-value").textContent=project.data.overall??0;
    card.querySelector(".team").textContent=project.data.team||"";
    card.querySelector(".tier").textContent=project.data.tier?`TIER ${project.data.tier}`:"";

    const grid=card.querySelector(".stat-grid");
    (project.data.stats||[]).slice(0,12).forEach(stat=>{
      const cell=document.createElement("div");
      cell.className="stat-cell";
      cell.innerHTML=`<div class="stat-label"></div><div class="stat-value"></div>`;
      cell.querySelector(".stat-label").textContent=stat.label||"STAT";
      const value=Number(stat.value);
      cell.querySelector(".stat-value").textContent=Number.isFinite(value)
        ? (Number.isInteger(value)?String(value):value.toFixed(1))
        : "—";
      grid.appendChild(cell);
    });

    wrap.appendChild(card);
    root.appendChild(wrap);
  }
};
