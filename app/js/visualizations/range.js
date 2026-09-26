function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
export const rangeChart={
  id:"range",labelKey:"viz.range",
  validate:p=>Array.isArray(p.data?.items),
  render(project,root){
    const s={labelA:"A",labelB:"B",unit:"",autoRange:true,min:0,max:100,showDiff:true,diffMode:"value",...project.settings};
    const items=project.data.items||[];let min=n(s.min),max=n(s.max);
    if(s.autoRange && items.length){const all=items.flatMap(i=>[n(i.value),n(i.value2)]);min=Math.min(...all);max=Math.max(...all);const pad=Math.max(1,(max-min)*.12);min-=pad;max+=pad}
    if(max<=min)max=min+1;
    root.innerHTML="";
    const w=document.createElement("div");w.className="visual range-visual";
    w.innerHTML=`<div class="generic-kicker">RANGE / DUMBBELL</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="range-key"><span class="a"></span><span class="b"></span></div><div class="range-list"></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Range";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    w.querySelector(".range-key .a").textContent=s.labelA;w.querySelector(".range-key .b").textContent=s.labelB;
    const list=w.querySelector(".range-list");
    items.forEach(item=>{const a=n(item.value),b=n(item.value2),pa=(a-min)/(max-min)*100,pb=(b-min)/(max-min)*100,left=Math.min(pa,pb),width=Math.abs(pb-pa),diff=b-a;const row=document.createElement("div");row.className=`range-row ${diff>=0?"up":"down"}`;row.innerHTML=`<div class="range-name"></div><div class="range-track"><i class="range-line"></i><i class="range-dot a"></i><i class="range-dot b"></i></div><div class="range-values"><span></span><b></b></div>`;row.querySelector(".range-name").textContent=item.name||"";row.querySelector(".range-line").style.left=`${left}%`;row.querySelector(".range-line").style.width=`${width}%`;row.querySelector(".range-dot.a").style.left=`${pa}%`;row.querySelector(".range-dot.b").style.left=`${pb}%`;row.querySelector(".range-values span").textContent=`${a}${s.unit||""} → ${b}${s.unit||""}`;row.querySelector(".range-values b").textContent=s.showDiff
      ? (s.diffMode==="percent"
        ? `${diff>=0?"+":""}${a!==0?((diff/a)*100).toFixed(1):"0.0"}%`
        : `${diff>=0?"+":""}${diff}${s.unit||""}`)
      : "";list.appendChild(row)});
    root.appendChild(w);
  }
};