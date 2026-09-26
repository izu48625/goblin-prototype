function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
export const ringGauge={
  id:"ring",labelKey:"viz.ring",
  validate:p=>Array.isArray(p.data?.items),
  render(project,root){
    const s={style:"thick",columns:3,showPercent:true,...project.settings};
    const items=(project.data.items||[]).slice(0,6);
    root.innerHTML="";
    const w=document.createElement("div");w.className=`visual ring-visual ring-style-${s.style}`;
    w.innerHTML=`<div class="generic-kicker">RING GAUGE</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="ring-grid"></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Ring";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    const grid=w.querySelector(".ring-grid");
    const autoCols=items.length<=2?Math.max(1,items.length):(items.length===4?2:3);
    const cols=Math.max(1,Math.min(3,Number(s.columns)||autoCols));
    grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    items.forEach(item=>{
      const max=Math.max(1,n(item.max)||100),value=n(item.value),pct=Math.max(0,Math.min(100,value/max*100));
      const card=document.createElement("div");card.className="ring-card";
      const half=s.style==="half";
      card.innerHTML=half
        ? `<svg viewBox="0 0 120 72" class="ring-svg half"><path class="ring-bg" pathLength="100" d="M15 62 A45 45 0 0 1 105 62"></path><path class="ring-fg" pathLength="100" d="M15 62 A45 45 0 0 1 105 62"></path></svg>`
        : `<svg viewBox="0 0 120 120" class="ring-svg"><circle class="ring-bg" cx="60" cy="60" r="47" pathLength="100"></circle><circle class="ring-fg" cx="60" cy="60" r="47" pathLength="100"></circle></svg>`;
      card.querySelector(".ring-fg").style.strokeDasharray=`${pct} ${100-pct}`;
      const valueEl=document.createElement("div");valueEl.className="ring-center";
      valueEl.innerHTML=`<b></b><small></small>`;valueEl.querySelector("b").textContent=s.showPercent?`${Math.round(pct)}%`:`${value}${item.unit||""}`;
      valueEl.querySelector("small").textContent=item.label||"";
      card.appendChild(valueEl);
      grid.appendChild(card);
    });
    root.appendChild(w);
  }
};