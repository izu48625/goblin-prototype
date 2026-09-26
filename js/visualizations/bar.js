function safeNumber(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

export const barChart={
  id:"bar",
  labelKey:"viz.bar",

  validate(project){
    return Array.isArray(project.data?.items) &&
      project.data.items.every(x=>x.name && Number.isFinite(Number(x.value)));
  },

  render(project,root){
    const settings={
      unit:"",
      showValues:true,
      showCategory:true,
      showGrid:true,
      autoMax:true,
      max:100,
      topN:10,
      ...project.settings
    };

    const items=(project.data.items||[])
      .filter(x=>x.enabled!==false)
      .slice(0,Math.max(1,Math.min(30,Number(settings.topN)||10)));

    const maxValue=settings.autoMax
      ? Math.max(1,...items.map(x=>safeNumber(x.value))) * 1.08
      : Math.max(1,safeNumber(settings.max));

    root.innerHTML="";

    const wrap=document.createElement("div");
    wrap.className=`visual bar-visual ${items.length>12?"bar-dense":""}`;
    wrap.innerHTML=`
      <div class="bar-head">
        <div>
          <div class="bar-kicker">BAR CHART</div>
          <div class="viz-title bar-title"></div>
          <div class="viz-subtitle bar-subtitle"></div>
        </div>
        <div class="bar-max"></div>
      </div>
      <div class="bar-rule"></div>
      <div class="bar-list"></div>
    `;

    wrap.querySelector(".bar-title").textContent=project.meta.title||"Bar Chart";
    wrap.querySelector(".bar-subtitle").textContent=project.meta.subtitle||"";
    wrap.querySelector(".bar-max").textContent=settings.autoMax?"AUTO":`${settings.max}${settings.unit||""}`;

    const list=wrap.querySelector(".bar-list");

    items.forEach((item,index)=>{
      const val=safeNumber(item.value);
      const pct=Math.max(0,Math.min(100,(val/maxValue)*100));

      const row=document.createElement("div");
      row.className="bar-row";
      row.innerHTML=`
        <div class="bar-row-top">
          <div class="bar-label-wrap">
            <span class="bar-index"></span>
            <div>
              <div class="bar-name"></div>
              <div class="bar-category"></div>
            </div>
          </div>
          <div class="bar-value-wrap">
            <span class="bar-value"></span><span class="bar-unit"></span>
          </div>
        </div>
        <div class="bar-track">
          <div class="bar-fill"></div>
          <div class="bar-grid-lines"></div>
        </div>
      `;

      row.querySelector(".bar-index").textContent=String(index+1).padStart(2,"0");
      row.querySelector(".bar-name").textContent=item.name||"";
      const cat=row.querySelector(".bar-category");
      cat.textContent=settings.showCategory===false?"":(item.category||"");
      cat.style.display=cat.textContent?"block":"none";

      row.querySelector(".bar-value").textContent=settings.showValues===false?"":(
        Number.isInteger(val)?String(val):val.toFixed(1)
      );
      row.querySelector(".bar-unit").textContent=settings.showValues===false?"":(settings.unit||"");

      row.querySelector(".bar-fill").style.width=`${pct}%`;
      row.querySelector(".bar-grid-lines").style.display=settings.showGrid===false?"none":"block";

      list.appendChild(row);
    });

    root.appendChild(wrap);
  }
};
