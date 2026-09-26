function n(v){const x=Number(v);return Number.isFinite(x)?x:0}

export const statBoard={
  id:"stat-board",
  labelKey:"viz.statBoard",

  validate(project){
    return Array.isArray(project.data?.blocks);
  },

  render(project,root){
    const settings={columns:2,gap:"medium",...project.settings};
    root.innerHTML="";

    const wrap=document.createElement("div");
    wrap.className=`visual statboard-visual gap-${settings.gap}`;
    wrap.innerHTML=`
      <div class="generic-kicker">STAT BOARD</div>
      <div class="viz-title generic-title"></div>
      <div class="viz-subtitle generic-subtitle"></div>
      <div class="statboard-grid"></div>
    `;
    wrap.querySelector(".generic-title").textContent=project.meta.title||"Stat Board";
    wrap.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";

    const grid=wrap.querySelector(".statboard-grid");
    grid.style.gridTemplateColumns=`repeat(${Math.max(1,Math.min(3,Number(settings.columns)||2))},1fr)`;

    (project.data.blocks||[]).forEach(block=>{
      const card=document.createElement("section");
      card.className=`statboard-block block-${block.type}`;
      card.style.gridColumn=`span ${Math.max(1,Math.min(Number(settings.columns)||2,Number(block.span)||1))}`;

      if(block.type==="hero"){
        card.innerHTML=`<div class="sb-hero-copy"><div class="sb-hero-title"></div><div class="sb-hero-sub"></div></div><div class="sb-hero-value"></div>`;
        card.querySelector(".sb-hero-title").textContent=block.title||"";
        card.querySelector(".sb-hero-sub").textContent=block.subtitle||"";
        card.querySelector(".sb-hero-value").textContent=block.value||"";
      }else if(block.type==="number"){
        card.innerHTML=`<div class="sb-label"></div><div class="sb-number"></div>`;
        card.querySelector(".sb-label").textContent=block.label||"";
        card.querySelector(".sb-number").textContent=block.value??"";
      }else if(block.type==="ring"){
        const max=Math.max(1,n(block.max)||100);
        const pct=Math.max(0,Math.min(100,n(block.value)/max*100));
        card.innerHTML=`<div class="sb-label"></div><div class="sb-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="39" pathLength="100" class="bg"></circle><circle cx="50" cy="50" r="39" pathLength="100" class="fg"></circle></svg><b></b></div>`;
        card.querySelector(".sb-label").textContent=block.label||"";
        card.querySelector(".fg").style.strokeDasharray=`${pct} ${100-pct}`;
        card.querySelector(".sb-ring b").textContent=`${Math.round(pct)}%`;
      }else if(block.type==="progress"){
        const max=Math.max(1,n(block.max)||100);
        const pct=Math.max(0,Math.min(100,n(block.value)/max*100));
        card.innerHTML=`<div class="sb-label"></div><div class="sb-progress-head"><b></b><span></span></div><div class="sb-progress"><i></i></div>`;
        card.querySelector(".sb-label").textContent=block.label||"";
        card.querySelector(".sb-progress-head b").textContent=block.value??0;
        card.querySelector(".sb-progress-head span").textContent=`/ ${max}`;
        card.querySelector(".sb-progress i").style.width=`${pct}%`;
      }else{
        card.innerHTML=`<div class="sb-text-title"></div><div class="sb-text"></div>`;
        card.querySelector(".sb-text-title").textContent=block.title||"";
        card.querySelector(".sb-text").textContent=block.text||"";
      }

      grid.appendChild(card);
    });

    root.appendChild(wrap);
  }
};
