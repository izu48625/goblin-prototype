import {getImageUrl} from "../core/images.js";

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

export const quadrant={
  id:"quadrant",
  labelKey:"viz.quadrant",

  validate(project){
    return project.data.items.every(x=>Number.isFinite(Number(x.x))&&Number.isFinite(Number(x.y)));
  },

  async render(project,root){
    root.innerHTML="";
    const wrap=document.createElement("div");
    wrap.className="visual quadrant-visual";
    wrap.innerHTML=`
      <div class="quad-head">
        <div class="viz-title quad-title"></div>
        <div class="viz-subtitle quad-subtitle"></div>
      </div>
      <div class="quad-chart">
        <div class="quad-vline"></div>
        <div class="quad-hline"></div>
        <div class="quad-label tl"></div>
        <div class="quad-label tr"></div>
        <div class="quad-label bl"></div>
        <div class="quad-label br"></div>
        <div class="axis-x"></div>
        <div class="axis-y"></div>
      </div>
    `;

    wrap.querySelector(".quad-title").textContent=project.meta.title||"Quadrant";
    wrap.querySelector(".quad-subtitle").textContent=project.meta.subtitle||"";

    const chart=wrap.querySelector(".quad-chart");
    const x=project.settings.xAxis;
    const y=project.settings.yAxis;
    const xSplit=((x.split-x.min)/(x.max-x.min))*100;
    const ySplit=((y.split-y.min)/(y.max-y.min))*100;

    wrap.querySelector(".quad-vline").style.left=`${clamp(xSplit,0,100)}%`;
    wrap.querySelector(".quad-hline").style.bottom=`${clamp(ySplit,0,100)}%`;

    const q=project.settings.quadrants;
    wrap.querySelector(".tl").textContent=q.topLeft||"";
    wrap.querySelector(".tr").textContent=q.topRight||"";
    wrap.querySelector(".bl").textContent=q.bottomLeft||"";
    wrap.querySelector(".br").textContent=q.bottomRight||"";
    wrap.querySelector(".axis-x").textContent=x.label||"X";
    wrap.querySelector(".axis-y").textContent=y.label||"Y";

    const placed=[];
    (project.data.items||[]).filter(i=>i.enabled!==false).forEach(item=>{
      const xp=((Number(item.x)-x.min)/(x.max-x.min))*100;
      const yp=((Number(item.y)-y.min)/(y.max-y.min))*100;
      const cluster=placed.filter(p=>Math.hypot(p.x-xp,p.y-yp)<12).length;
      placed.push({x:xp,y:yp});
      const point=document.createElement("div");
      point.className=`quad-point label-offset-${cluster%4}`;
      point.style.left=`${clamp(xp,0,100)}%`;
      point.style.bottom=`${clamp(yp,0,100)}%`;
      point.innerHTML=`<span class="quad-point-dot"></span><span class="quad-point-name"></span>`;
      const dot=point.querySelector(".quad-point-dot");
      if(item.imageRef){
        try{
          const url=await getImageUrl(item.imageRef);
          if(url){
            dot.style.backgroundImage=`url("${url}")`;
            dot.classList.add("has-image",`shape-${item.imageShape||"circle"}`);
          }
        }catch(e){
          console.warn("Quadrant image load failed",e);
        }
      }
      point.querySelector(".quad-point-name").textContent=item.name||"";
      chart.appendChild(point);
    });

    root.appendChild(wrap);
  }
};
