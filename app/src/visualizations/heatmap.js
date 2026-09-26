function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
export const heatmap={
  id:"heatmap",labelKey:"viz.heatmap",
  validate:p=>Array.isArray(p.data?.rows)&&Array.isArray(p.data?.columns),
  render(project,root){
    const s={min:0,max:100,showValues:true,decimals:0,palette:"blue",...project.settings};
    const min=n(s.min),max=Math.max(min+1,n(s.max));
    root.innerHTML="";
    const w=document.createElement("div");w.className="visual heatmap-visual";
    w.innerHTML=`<div class="generic-kicker">HEATMAP</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="heatmap-wrap"><table class="heatmap-table"></table></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Heatmap";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    const table=w.querySelector("table");
    const head=document.createElement("tr");head.innerHTML="<th></th>";
    (project.data.columns||[]).forEach(c=>{const th=document.createElement("th");th.textContent=c.label||"";head.appendChild(th)});table.appendChild(head);
    (project.data.rows||[]).forEach(row=>{
      const tr=document.createElement("tr");const th=document.createElement("th");th.textContent=row.name||"";tr.appendChild(th);
      (project.data.columns||[]).forEach((c,i)=>{
        const val=n(row.values?.[i]),pct=Math.max(0,Math.min(100,(val-min)/(max-min)*100));
        const td=document.createElement("td");
        const palettes={
          blue:["#16325C","#6F9CFF"],
          green:["#173B2A","#48D58A"],
          red:["#421D24","#FF7284"],
          heat:["#2B1B45","#FFB347"],
          cool:["#112D36","#48C7D9"],
          rainbow:["#5F56E8","#FF6B9A"]
        };
        const [lo,hi]=palettes[s.palette]||palettes.blue;
        td.style.background=pct>=65?hi:(pct>=35?"#3d5576":lo);
        td.textContent=s.showValues===false?"":val.toFixed(Math.max(0,Math.min(2,Number(s.decimals)||0)));
        tr.appendChild(td);
      });table.appendChild(tr);
    });
    root.appendChild(w);
  }
};