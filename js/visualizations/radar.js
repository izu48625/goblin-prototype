function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function safeNumber(v){const n=Number(v);return Number.isFinite(n)?n:0}

function polar(cx,cy,r,angle){
  return {
    x:cx + Math.cos(angle)*r,
    y:cy + Math.sin(angle)*r
  };
}

function polygonPoints(count,cx,cy,r){
  const start=-Math.PI/2;
  return Array.from({length:count},(_,i)=>{
    const a=start+(Math.PI*2*i/count);
    const p=polar(cx,cy,r,a);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function dataPolygon(axes,values,cx,cy,r){
  const start=-Math.PI/2;
  return axes.map((axis,i)=>{
    const max=Math.max(1,safeNumber(axis.max)||100);
    const ratio=clamp(safeNumber(values[i])/max,0,1);
    const a=start+(Math.PI*2*i/axes.length);
    const p=polar(cx,cy,r*ratio,a);
    return `${p.x},${p.y}`;
  }).join(" ");
}

export const radarChart={
  id:"radar",
  labelKey:"viz.radar",

  validate(project){
    return Array.isArray(project.data?.axes) &&
      project.data.axes.length>=3 &&
      Array.isArray(project.data?.series);
  },

  render(project,root){
    const axes=(project.data.axes||[]).slice(0,12);
    const series=(project.data.series||[]).slice(0,6);
    const settings={
      gridLevels:5,
      showValues:false,
      showLegend:true,
      showAxisLabels:true,
      fillOpacity:.18,
      strokeWidth:4,
      ...project.settings
    };

    root.innerHTML="";

    const wrap=document.createElement("div");
    wrap.className="visual radar-visual";
    wrap.innerHTML=`
      <div class="radar-head">
        <div class="radar-kicker">RADAR CHART</div>
        <div class="viz-title radar-title"></div>
        <div class="viz-subtitle radar-subtitle"></div>
      </div>
      <div class="radar-main">
        <div class="radar-chart-wrap"></div>
        <div class="radar-legend"></div>
      </div>
    `;

    wrap.querySelector(".radar-title").textContent=project.meta.title||"Radar Chart";
    wrap.querySelector(".radar-subtitle").textContent=project.meta.subtitle||"";

    const chartWrap=wrap.querySelector(".radar-chart-wrap");
    const legend=wrap.querySelector(".radar-legend");

    const NS="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox","0 0 1000 820");
    svg.setAttribute("class","radar-svg");

    const cx=500, cy=405, radius=285;
    const levels=Math.max(3,Math.min(8,Number(settings.gridLevels)||5));

    // Grid polygons
    for(let l=1;l<=levels;l++){
      const poly=document.createElementNS(NS,"polygon");
      poly.setAttribute("points",polygonPoints(axes.length,cx,cy,radius*(l/levels)));
      poly.setAttribute("fill","none");
      poly.setAttribute("stroke","var(--visual-border)");
      poly.setAttribute("stroke-width",l===levels?"3":"1.5");
      poly.setAttribute("opacity",l===levels?".9":".55");
      svg.appendChild(poly);
    }

    // Axes + labels
    const start=-Math.PI/2;
    axes.forEach((axis,i)=>{
      const a=start+(Math.PI*2*i/axes.length);
      const edge=polar(cx,cy,radius,a);

      const line=document.createElementNS(NS,"line");
      line.setAttribute("x1",cx);
      line.setAttribute("y1",cy);
      line.setAttribute("x2",edge.x);
      line.setAttribute("y2",edge.y);
      line.setAttribute("stroke","var(--visual-border)");
      line.setAttribute("stroke-width","1.5");
      line.setAttribute("opacity",".55");
      svg.appendChild(line);

      if(settings.showAxisLabels!==false){
        const labelPos=polar(cx,cy,radius+64,a);
        const text=document.createElementNS(NS,"text");
        text.setAttribute("x",labelPos.x);
        text.setAttribute("y",labelPos.y);
        text.setAttribute("fill","var(--visual-text)");
        text.setAttribute("font-size","30");
        text.setAttribute("font-weight","900");
        text.setAttribute("text-anchor",
          Math.cos(a)>.2?"start":Math.cos(a)<-.2?"end":"middle"
        );
        text.setAttribute("dominant-baseline","middle");
        text.textContent=axis.label||`A${i+1}`;
        svg.appendChild(text);
      }
    });

    // Series
    series.forEach((s,sIndex)=>{
      const color=s.color||["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"][sIndex%6];

      const poly=document.createElementNS(NS,"polygon");
      poly.setAttribute("points",dataPolygon(axes,s.values||[],cx,cy,radius));
      poly.setAttribute("fill",color);
      poly.setAttribute("fill-opacity",String(clamp(Number(settings.fillOpacity)||.18,0,.7)));
      poly.setAttribute("stroke",color);
      poly.setAttribute("stroke-width",String(Math.max(2,Math.min(10,Number(settings.strokeWidth)||4))));
      poly.setAttribute("stroke-linejoin","round");
      svg.appendChild(poly);

      axes.forEach((axis,i)=>{
        const max=Math.max(1,safeNumber(axis.max)||100);
        const ratio=clamp(safeNumber(s.values?.[i])/max,0,1);
        const a=start+(Math.PI*2*i/axes.length);
        const p=polar(cx,cy,radius*ratio,a);

        const dot=document.createElementNS(NS,"circle");
        dot.setAttribute("cx",p.x);
        dot.setAttribute("cy",p.y);
        dot.setAttribute("r","7");
        dot.setAttribute("fill",color);
        dot.setAttribute("stroke","var(--visual-bg)");
        dot.setAttribute("stroke-width","3");
        svg.appendChild(dot);

        if(settings.showValues){
          const txt=document.createElementNS(NS,"text");
          txt.setAttribute("x",p.x);
          txt.setAttribute("y",p.y-14);
          txt.setAttribute("fill",color);
          txt.setAttribute("font-size","23");
          txt.setAttribute("font-weight","900");
          txt.setAttribute("text-anchor","middle");
          txt.textContent=String(safeNumber(s.values?.[i]));
          svg.appendChild(txt);
        }
      });
    });

    chartWrap.appendChild(svg);

    if(settings.showLegend!==false){
      series.forEach(s=>{
        const item=document.createElement("div");
        item.className="radar-legend-item";
        item.innerHTML=`<i></i><span></span>`;
        item.querySelector("i").style.background=s.color||"var(--visual-accent)";
        item.querySelector("span").textContent=s.name||"Series";
        legend.appendChild(item);
      });
    }else{
      legend.style.display="none";
    }

    root.appendChild(wrap);
  }
};
