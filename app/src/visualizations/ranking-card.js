import {getImageUrl} from "../core/images.js";

function initials(name=""){
  const s=String(name).trim();
  if(!s)return "?";
  const parts=s.split(/\s+/).filter(Boolean);
  if(parts.length>=2)return (parts[0][0]+parts[1][0]).toUpperCase();
  return s.slice(0,2).toUpperCase();
}

function safeNumber(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

export const rankingCard={
  id:"ranking-card",
  labelKey:"viz.ranking",

  validate(project){
    return Array.isArray(project.data?.items) &&
      project.data.items.every(x=>x.name && Number.isFinite(Number(x.value)));
  },

  async render(project,root){
    const settings={
      template:"sports",
      unit:"PTS",
      topN:10,
      showRank:true,
      showNote:true,
      showCategory:true,
      highlightTop3:true,
      showBars:true,
      headerLabel:"POWER RANKING",
      density:"comfortable",
      tieMode:"competition",
      ...project.settings
    };

    // Important: display order follows the stored row order.
    // Auto-sort is an explicit editor action, so score edits never reorder unexpectedly.
    const items=(project.data.items||[])
      .filter(x=>x.enabled!==false)
      .slice(0,Math.max(1,Math.min(20,Number(settings.topN)||10)));

    const maxValue=Math.max(1,...items.map(x=>safeNumber(x.value)));
    let lastValue=null;
    let lastRank=0;

    root.innerHTML="";
    const wrap=document.createElement("div");
    const countClass=items.length<=5?"ranking-count-short":items.length<=10?"ranking-count-medium":"ranking-count-long";
    wrap.className=`visual ranking-visual ranking-template-${settings.template} ${countClass} density-${settings.density}`;

    wrap.innerHTML=`
      <div class="ranking-kicker"></div>
      <div class="ranking-head">
        <div>
          <div class="viz-title ranking-title"></div>
          <div class="viz-subtitle ranking-subtitle"></div>
        </div>
        <div class="ranking-count-badge"></div>
      </div>
      <div class="ranking-rule"></div>
      <div class="ranking-list"></div>
    `;

    wrap.querySelector(".ranking-kicker").textContent=settings.headerLabel||"";
    wrap.querySelector(".ranking-title").textContent=project.meta.title||"Ranking";
    wrap.querySelector(".ranking-subtitle").textContent=project.meta.subtitle||"";
    wrap.querySelector(".ranking-count-badge").textContent=`TOP ${items.length}`;

    const list=wrap.querySelector(".ranking-list");

    items.forEach((item,index)=>{
      const val=safeNumber(item.value);
      if(val!==lastValue){
        lastRank=index+1;
        lastValue=val;
      }

      const row=document.createElement("div");
      const topClass=settings.highlightTop3 && lastRank<=3?` rank-top-${lastRank}`:"";
      row.className=`ranking-row${topClass}`;

      const ratio=Math.max(0,Math.min(100,(val/maxValue)*100));
      row.innerHTML=`
        <div class="ranking-bar-bg"><i></i></div>
        <div class="ranking-rank-wrap">
          <span class="ranking-rank"></span>
        </div>
        <div class="ranking-avatar"><span></span></div>
        <div class="ranking-copy">
          <div class="ranking-name"></div>
          <div class="ranking-meta">
            <span class="ranking-category"></span>
            <span class="ranking-meta-dot">•</span>
            <span class="ranking-note"></span>
          </div>
        </div>
        <div class="ranking-value">
          <span class="value"></span>
          <span class="ranking-unit"></span>
        </div>
      `;

      row.querySelector(".ranking-bar-bg").style.display=settings.showBars?"block":"none";
      row.querySelector(".ranking-bar-bg i").style.width=`${ratio}%`;

      const rankEl=row.querySelector(".ranking-rank");
      rankEl.textContent=settings.showRank===false?"":String(lastRank);

      const avatar=row.querySelector(".ranking-avatar");
      const avatarText=avatar.querySelector("span");
      avatarText.textContent=initials(item.name);
      if(item.imageData){
        avatar.style.backgroundImage=`url("${item.imageData}")`;
        avatar.classList.add("has-image",`shape-${item.imageShape||"circle"}`);
      }else if(item.imageRef){
        try{
          const imageUrl=await getImageUrl(item.imageRef);
          if(imageUrl){
            avatar.style.backgroundImage=`url("${imageUrl}")`;
            avatar.classList.add("has-image",`shape-${item.imageShape||"circle"}`);
          }
        }catch(e){
          console.warn("Ranking image load failed",e);
        }
      }

      row.querySelector(".ranking-name").textContent=item.name||"";
      const cat=row.querySelector(".ranking-category");
      const note=row.querySelector(".ranking-note");
      const dot=row.querySelector(".ranking-meta-dot");

      cat.textContent=settings.showCategory===false?"":(item.category||"");
      note.textContent=settings.showNote===false?"":(item.note||"");

      const catVisible=!!cat.textContent;
      const noteVisible=!!note.textContent;
      dot.style.display=catVisible && noteVisible?"inline":"none";
      row.querySelector(".ranking-meta").style.display=(catVisible||noteVisible)?"flex":"none";

      row.querySelector(".value").textContent=Number.isInteger(val)?String(val):val.toFixed(1);
      row.querySelector(".ranking-unit").textContent=settings.unit||"";

      list.appendChild(row);
    });

    root.appendChild(wrap);
  }
};
