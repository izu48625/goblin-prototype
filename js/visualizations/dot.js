function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
export const dotChart={
  id:"dot",labelKey:"viz.dot",
  validate:p=>Array.isArray(p.data?.items),
  render(project,root){
    const s={min:0,max:100,autoRange:false,unit:"",showValues:true,showGrid:true,...project.settings};
    const items=(project.data.items||[]).filter(x=>x.enabled!==false);
    let min=n(s.min),max=n(s.max);
    if(s.autoRange && items.length){
      const vals=items.map(x=>n(x.value));
      min=Math.min(...vals);max=Math.max(...vals);
      const pad=Math.max(1,(max-min)*.12);min-=pad;max+=pad;
    }
    if(max<=min)max=min+1;
    root.innerHTML="";
    const w=document.createElement("div");
    w.className="visual dot-visual";
    w.innerHTML=`<div class="generic-kicker">DOT CHART</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="dot-axis-head"><span></span><span></span></div><div class="dot-list"></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Dot Chart";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    const heads=w.querySelectorAll(".dot-axis-head span");heads[0].textContent=Math.round(min);heads[1].textContent=Math.round(max);
    const list=w.querySelector(".dot-list");
    items.forEach(item=>{
      const val=n(item.value),pct=Math.max(0,Math.min(100,(val-min)/(max-min)*100));
      const row=document.createElement("div");row.className="dot-row";
      row.innerHTML=`<div><b class="dot-name"></b><small class="dot-cat"></small></div><div class="dot-track"><i class="dot-guide"></i><i class="dot-marker"></i></div><div class="dot-value"></div>`;
      row.querySelector(".dot-name").textContent=item.name||"";
      row.querySelector(".dot-cat").textContent=item.category||"";
      row.querySelector(".dot-marker").style.left=`${pct}%`;
      row.querySelector(".dot-guide").style.display=s.showGrid===false?"none":"block";
      row.querySelector(".dot-value").textContent=s.showValues===false?"":`${val}${s.unit||""}`;
      list.appendChild(row);
    });
    root.appendChild(w);
  }
};