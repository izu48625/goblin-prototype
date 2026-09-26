function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function autoTier(item,tiers){
  const v=n(item.value);
  return tiers.find(t=>v>=n(t.min)&&v<=n(t.max))?.label || tiers[tiers.length-1]?.label || "";
}
export const tierList={
  id:"tier-list",labelKey:"viz.tier",
  validate:p=>Array.isArray(p.data?.tiers)&&Array.isArray(p.data?.items),
  render(project,root){
    const s={mode:"auto",showScore:true,...project.settings};
    const tiers=project.data.tiers||[],items=project.data.items||[];
    root.innerHTML="";
    const w=document.createElement("div");w.className="visual tier-visual";
    w.innerHTML=`<div class="generic-kicker">TIER LIST</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="tier-board"></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Tier List";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    const board=w.querySelector(".tier-board");
    tiers.forEach((tier,idx)=>{
      const row=document.createElement("div");row.className="tier-row";
      row.innerHTML=`<div class="tier-label"></div><div class="tier-items"></div>`;
      row.querySelector(".tier-label").textContent=tier.label||"";
      row.querySelector(".tier-label").style.setProperty("--tier-index",idx);
      const holder=row.querySelector(".tier-items");
      items
        .filter(item=>(s.mode==="auto"?autoTier(item,tiers):(item.tier||""))===tier.label)
        .sort((a,b)=>n(b.value)-n(a.value))
        .forEach(item=>{
        const chip=document.createElement("div");chip.className="tier-chip";
        chip.innerHTML=`<span></span><b></b>`;
        chip.querySelector("span").textContent=item.name||"";
        chip.querySelector("b").textContent=s.showScore?String(n(item.value)):"";
        holder.appendChild(chip);
      });
      board.appendChild(row);
    });
    root.appendChild(w);
  }
};