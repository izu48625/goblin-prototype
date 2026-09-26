function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
export const scatterChart={
  id:"scatter",labelKey:"viz.scatter",
  validate:p=>Array.isArray(p.data?.items),
  render(project,root){
    const s={xAxis:{label:"X",min:0,max:100},yAxis:{label:"Y",min:0,max:100},showAverage:true,showMedian:false,showTrend:true,showLabels:true,categoryColors:true,...project.settings};
    const items=project.data.items||[],x=s.xAxis,y=s.yAxis;
    root.innerHTML="";
    const w=document.createElement("div");w.className="visual scatter-visual";
    w.innerHTML=`<div class="generic-kicker">SCATTER</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="scatter-wrap"><svg class="scatter-svg" viewBox="0 0 1000 700"></svg></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Scatter";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    const svg=w.querySelector("svg"),NS="http://www.w3.org/2000/svg",L=110,R=930,T=45,B=600;
    const xp=v=>L+clamp((n(v)-n(x.min))/(n(x.max)-n(x.min)||1),0,1)*(R-L);
    const yp=v=>B-clamp((n(v)-n(y.min))/(n(y.max)-n(y.min)||1),0,1)*(B-T);
    const axis=document.createElementNS(NS,"path");axis.setAttribute("d",`M${L} ${T} V${B} H${R}`);axis.setAttribute("class","scatter-axis");svg.appendChild(axis);
    for(let i=1;i<5;i++){const gy=T+(B-T)*i/5,gx=L+(R-L)*i/5;["h","v"].forEach(type=>{const line=document.createElementNS(NS,"line");line.setAttribute("class","scatter-grid");if(type==="h"){line.setAttribute("x1",L);line.setAttribute("x2",R);line.setAttribute("y1",gy);line.setAttribute("y2",gy)}else{line.setAttribute("y1",T);line.setAttribute("y2",B);line.setAttribute("x1",gx);line.setAttribute("x2",gx)}svg.appendChild(line)})}
    if(items.length && s.showAverage){const ax=items.reduce((a,b)=>a+n(b.x),0)/items.length,ay=items.reduce((a,b)=>a+n(b.y),0)/items.length;const vl=document.createElementNS(NS,"line");vl.setAttribute("x1",xp(ax));vl.setAttribute("x2",xp(ax));vl.setAttribute("y1",T);vl.setAttribute("y2",B);vl.setAttribute("class","scatter-average");svg.appendChild(vl);const hl=document.createElementNS(NS,"line");hl.setAttribute("x1",L);hl.setAttribute("x2",R);hl.setAttribute("y1",yp(ay));hl.setAttribute("y2",yp(ay));hl.setAttribute("class","scatter-average");svg.appendChild(hl)}
    if(items.length && s.showMedian){
      const median=arr=>{const a=[...arr].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
      const mx=median(items.map(i=>n(i.x))),my=median(items.map(i=>n(i.y)));
      const vl=document.createElementNS(NS,"line");vl.setAttribute("x1",xp(mx));vl.setAttribute("x2",xp(mx));vl.setAttribute("y1",T);vl.setAttribute("y2",B);vl.setAttribute("class","scatter-median");svg.appendChild(vl);
      const hl=document.createElementNS(NS,"line");hl.setAttribute("x1",L);hl.setAttribute("x2",R);hl.setAttribute("y1",yp(my));hl.setAttribute("y2",yp(my));hl.setAttribute("class","scatter-median");svg.appendChild(hl);
    }
    if(items.length>1 && s.showTrend){const xs=items.map(i=>n(i.x)),ys=items.map(i=>n(i.y)),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;let num=0,den=0;xs.forEach((v,i)=>{num+=(v-mx)*(ys[i]-my);den+=(v-mx)**2});const m=den?num/den:0,b=my-m*mx;const line=document.createElementNS(NS,"line");line.setAttribute("x1",xp(x.min));line.setAttribute("y1",yp(m*n(x.min)+b));line.setAttribute("x2",xp(x.max));line.setAttribute("y2",yp(m*n(x.max)+b));line.setAttribute("class","scatter-trend");svg.appendChild(line)}
    const cats=[...new Set(items.map(i=>i.category||""))];
    const palette=["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];
    items.forEach(item=>{
      const px=xp(item.x),py=yp(item.y);
      const g=document.createElementNS(NS,"g");
      const c=document.createElementNS(NS,"circle");
      c.setAttribute("cx",px);c.setAttribute("cy",py);c.setAttribute("r","12");c.setAttribute("class","scatter-point");
      if(s.categoryColors&&item.category)c.setAttribute("fill",palette[cats.indexOf(item.category)%palette.length]);
      g.appendChild(c);
      if(s.showLabels){
        const tx=document.createElementNS(NS,"text");
        const rightSide=px>R-150;
        const nearTop=py<T+55;
        tx.setAttribute("x",rightSide?px-17:px+17);
        tx.setAttribute("y",nearTop?py+34:py-15);
        tx.setAttribute("text-anchor",rightSide?"end":"start");
        tx.setAttribute("class","scatter-label");
        tx.textContent=item.name||"";
        g.appendChild(tx);
      }
      svg.appendChild(g);
    });
    const xt=document.createElementNS(NS,"text");xt.setAttribute("x",R);xt.setAttribute("y",665);xt.setAttribute("class","scatter-axis-label");xt.textContent=x.label||"X";svg.appendChild(xt);
    const yt=document.createElementNS(NS,"text");yt.setAttribute("x",L);yt.setAttribute("y",28);yt.setAttribute("class","scatter-axis-label");yt.textContent=y.label||"Y";svg.appendChild(yt);
    root.appendChild(w);
  }
};