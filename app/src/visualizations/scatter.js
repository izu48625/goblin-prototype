function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function fmt(v){const n=Number(v);return Number.isInteger(n)?String(n):n.toFixed(1)}
function niceStep(raw){
  if(!Number.isFinite(raw)||raw<=0)return 1;
  const pow=10**Math.floor(Math.log10(raw));
  const f=raw/pow;
  const n=f<=1?1:f<=2?2:f<=5?5:10;
  return n*pow;
}
function axisRange(values,scaleMax,minWidth,mode){
  if(mode==="full"||!values.length)return {min:0,max:scaleMax,step:niceStep(scaleMax/5)};
  let min=Math.min(...values),max=Math.max(...values);
  let width=max-min;
  if(width<minWidth){
    const mid=(min+max)/2;
    min=mid-minWidth/2;
    max=mid+minWidth/2;
    width=minWidth;
  }else{
    const pad=width*.2;
    min-=pad;max+=pad;width=max-min;
  }
  const step=niceStep(width/4);
  min=Math.floor(min/step)*step;
  max=Math.ceil(max/step)*step;
  if(max-min<minWidth){
    const need=minWidth-(max-min);
    min-=need/2;max+=need/2;
    min=Math.floor(min/step)*step;
    max=Math.ceil(max/step)*step;
  }
  if(min<0){max-=min;min=0}
  if(max>scaleMax){min-=max-scaleMax;max=scaleMax}
  min=Math.max(0,min);max=Math.min(scaleMax,max);
  if(max-min<minWidth){
    if(max===scaleMax)min=Math.max(0,scaleMax-minWidth);
    else max=Math.min(scaleMax,min+minWidth);
  }
  return {min,max,step:niceStep((max-min)/4)};
}
function ticks(range){
  const out=[];
  const eps=range.step/100;
  let v=Math.ceil((range.min-eps)/range.step)*range.step;
  for(;v<=range.max+eps&&out.length<8;v+=range.step)out.push(Math.round(v*1000)/1000);
  if(!out.length||Math.abs(out[0]-range.min)>eps)out.unshift(range.min);
  if(Math.abs(out.at(-1)-range.max)>eps)out.push(range.max);
  return [...new Set(out)].slice(0,7);
}
function textEstimate(text,size=22){return Math.min(250,Math.max(48,[...String(text||"")].length*size*.62+14))}
function overlaps(a,b,pad=5){return !(a.x2+pad<b.x1||a.x1-pad>b.x2||a.y2+pad<b.y1||a.y1-pad>b.y2)}
function candidateBoxes(px,py,w,h,gap=16){
  return [
    {x1:px+gap,y1:py-gap-h,x2:px+gap+w,y2:py-gap,anchor:"start",tx:px+gap,ty:py-gap-4},
    {x1:px-gap-w,y1:py-gap-h,x2:px-gap,y2:py-gap,anchor:"end",tx:px-gap,ty:py-gap-4},
    {x1:px+gap,y1:py+gap,x2:px+gap+w,y2:py+gap+h,anchor:"start",tx:px+gap,ty:py+gap+h-5},
    {x1:px-gap-w,y1:py+gap,x2:px-gap,y2:py+gap+h,anchor:"end",tx:px-gap,ty:py+gap+h-5},
    {x1:px-w/2,y1:py-gap-h,x2:px+w/2,y2:py-gap,anchor:"middle",tx:px,ty:py-gap-4},
    {x1:px-w/2,y1:py+gap,x2:px+w/2,y2:py+gap+h,anchor:"middle",tx:px,ty:py+gap+h-5},
    {x1:px+gap,y1:py-h/2,x2:px+gap+w,y2:py+h/2,anchor:"start",tx:px+gap,ty:py+7},
    {x1:px-gap-w,y1:py-h/2,x2:px-gap,y2:py+h/2,anchor:"end",tx:px-gap,ty:py+7}
  ];
}
function within(b,L,R,T,B){return b.x1>=L&&b.x2<=R&&b.y1>=T&&b.y2<=B}
function addText(NS,svg,text,x,y,cls,anchor="start"){
  const el=document.createElementNS(NS,"text");
  el.setAttribute("x",x);el.setAttribute("y",y);el.setAttribute("class",cls);el.setAttribute("text-anchor",anchor);el.textContent=text;svg.appendChild(el);return el;
}

export const scatterChart={
  id:"scatter",labelKey:"viz.scatter",
  validate:p=>Array.isArray(p.data?.items),
  render(project,root){
    const s={rangeMode:"auto",scaleMax:100,minDisplayWidth:null,showAverage:true,showMedian:false,showTrend:false,showLabels:true,labelLimit:15,categoryColors:true,...project.settings};
    const raw=(project.data.items||[]).filter(i=>i.enabled!==false);
    const items=raw.map(i=>({...i,x:finite(i.x),y:finite(i.y)})).filter(i=>i.x!==null&&i.y!==null);
    const scaleMax=Number(s.scaleMax)||Math.max(Number(s.xAxis?.max)||0,Number(s.yAxis?.max)||0,100);
    const minWidth=Number(s.minDisplayWidth)||(scaleMax===10?2:20);
    const xr=axisRange(items.map(i=>i.x),scaleMax,minWidth,s.rangeMode);
    const yr=axisRange(items.map(i=>i.y),scaleMax,minWidth,s.rangeMode);

    root.innerHTML="";
    const w=document.createElement("div");w.className="visual scatter-visual";
    w.innerHTML=`<div class="generic-kicker">SCATTER</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="scatter-wrap"><svg class="scatter-svg" viewBox="0 0 1000 730" role="img"></svg></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Scatter";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";

    const svg=w.querySelector("svg"),NS="http://www.w3.org/2000/svg";
    const L=118,R=930,T=36,B=625;
    const xp=v=>L+(v-xr.min)/(xr.max-xr.min||1)*(R-L);
    const yp=v=>B-(v-yr.min)/(yr.max-yr.min||1)*(B-T);

    const axis=document.createElementNS(NS,"path");
    axis.setAttribute("d",`M${L} ${T} V${B} H${R}`);
    axis.setAttribute("class","scatter-axis");svg.appendChild(axis);

    ticks(xr).forEach(v=>{
      const x=xp(v);
      const line=document.createElementNS(NS,"line");line.setAttribute("x1",x);line.setAttribute("x2",x);line.setAttribute("y1",T);line.setAttribute("y2",B);line.setAttribute("class","scatter-grid");svg.appendChild(line);
      addText(NS,svg,fmt(v),x,B+34,"scatter-tick","middle");
    });
    ticks(yr).forEach(v=>{
      const y=yp(v);
      const line=document.createElementNS(NS,"line");line.setAttribute("x1",L);line.setAttribute("x2",R);line.setAttribute("y1",y);line.setAttribute("y2",y);line.setAttribute("class","scatter-grid");svg.appendChild(line);
      addText(NS,svg,fmt(v),L-18,y+7,"scatter-tick","end");
    });

    const avgX=items.length?items.reduce((a,b)=>a+b.x,0)/items.length:null;
    const avgY=items.length?items.reduce((a,b)=>a+b.y,0)/items.length:null;
    const reserved=[];
    if(items.length&&s.showAverage!==false){
      const vx=xp(avgX),hy=yp(avgY);
      const vl=document.createElementNS(NS,"line");vl.setAttribute("x1",vx);vl.setAttribute("x2",vx);vl.setAttribute("y1",T);vl.setAttribute("y2",B);vl.setAttribute("class","scatter-average");svg.appendChild(vl);
      const hl=document.createElementNS(NS,"line");hl.setAttribute("x1",L);hl.setAttribute("x2",R);hl.setAttribute("y1",hy);hl.setAttribute("y2",hy);hl.setAttribute("class","scatter-average");svg.appendChild(hl);
      const xl=`${s.xAxis?.label||"X"} AVG ${fmt(avgX)}`;
      const yl=`${s.yAxis?.label||"Y"} AVG ${fmt(avgY)}`;
      const xw=textEstimate(xl,18),yw=textEstimate(yl,18);
      let xb={x1:clamp(vx+8,L,R-xw),y1:T+8,x2:0,y2:T+34};xb.x2=xb.x1+xw;
      let yb={x1:R-yw-8,y1:clamp(hy-30,T,B-26),x2:R-8,y2:clamp(hy-30,T,B-26)+26};
      addText(NS,svg,xl,xb.x1+6,xb.y2-6,"scatter-avg-label");
      addText(NS,svg,yl,yb.x1+6,yb.y2-6,"scatter-avg-label");
      reserved.push(xb,yb);
    }

    if(items.length>1&&s.showTrend){
      const xs=items.map(i=>i.x),ys=items.map(i=>i.y),mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
      let num=0,den=0;xs.forEach((v,i)=>{num+=(v-mx)*(ys[i]-my);den+=(v-mx)**2});
      const m=den?num/den:0,b=my-m*mx;
      const line=document.createElementNS(NS,"line");line.setAttribute("x1",xp(xr.min));line.setAttribute("y1",yp(m*xr.min+b));line.setAttribute("x2",xp(xr.max));line.setAttribute("y2",yp(m*xr.max+b));line.setAttribute("class","scatter-trend");svg.appendChild(line);
    }

    const cats=[...new Set(items.map(i=>i.category||""))];
    const palette=["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];
    const pointBoxes=items.map(i=>{const x=xp(i.x),y=yp(i.y);return{x1:x-15,y1:y-15,x2:x+15,y2:y+15}});
    const placed=[...reserved];

    items.forEach((item,index)=>{
      const px=xp(item.x),py=yp(item.y);
      const g=document.createElementNS(NS,"g");g.setAttribute("class","scatter-point-group");g.dataset.index=index;
      const hit=document.createElementNS(NS,"circle");hit.setAttribute("cx",px);hit.setAttribute("cy",py);hit.setAttribute("r","22");hit.setAttribute("class","scatter-hit");g.appendChild(hit);
      const key=String(item.sourceRawIndex??item.id??index);
      const highlight=s.highlightColors?.[key]||"";
      const c=document.createElementNS(NS,"circle");
      c.setAttribute("cx",px);c.setAttribute("cy",py);
      c.setAttribute("r",highlight?"14":"10");
      c.setAttribute("class",highlight?"scatter-point highlighted":"scatter-point");
      if(highlight)c.setAttribute("fill",highlight);
      else if(s.categoryColors&&item.category)c.setAttribute("fill",palette[Math.max(0,cats.indexOf(item.category))%palette.length]);
      g.appendChild(c);svg.appendChild(g);

      if(s.showLabels===false || index>=Math.max(1,Math.min(40,Number(s.labelLimit)||15)))return;
      const label=String(item.name||"").trim();if(!label)return;
      const fontSize=label.length>18?18:label.length>12?20:22;
      const maxW=220;
      const boxW=Math.min(maxW,textEstimate(label,fontSize));
      const lineH=fontSize+5;
      const twoLine=label.length>18;
      const boxH=twoLine?lineH*2:lineH;
      const candidates=candidateBoxes(px,py,boxW,boxH,17);
      let chosen=candidates.find(box=>within(box,L+2,R-2,T+2,B-2)&&!placed.some(p=>overlaps(box,p,5))&&!pointBoxes.some((p,pi)=>pi!==index&&overlaps(box,p,5)));
      if(!chosen)chosen=candidates.find(box=>within(box,L+2,R-2,T+2,B-2))||candidates[0];
      placed.push(chosen);

      const cx=clamp(chosen.tx,L+4,R-4),cy=clamp(chosen.ty,T+fontSize,B-4);
      const dist=Math.hypot((chosen.x1+chosen.x2)/2-px,(chosen.y1+chosen.y2)/2-py);
      if(dist>35){
        const line=document.createElementNS(NS,"line");line.setAttribute("x1",px);line.setAttribute("y1",py);line.setAttribute("x2",(chosen.x1+chosen.x2)/2);line.setAttribute("y2",(chosen.y1+chosen.y2)/2);line.setAttribute("class","scatter-leader");svg.appendChild(line);
      }

      const tx=document.createElementNS(NS,"text");tx.setAttribute("x",cx);tx.setAttribute("y",cy);tx.setAttribute("text-anchor",chosen.anchor);tx.setAttribute("class","scatter-label");tx.style.fontSize=fontSize+"px";
      if(twoLine){
        const chars=[...label],mid=Math.ceil(chars.length/2);
        const a=chars.slice(0,mid).join(""),b=chars.slice(mid).join("");
        [a,b].forEach((line,li)=>{const sp=document.createElementNS(NS,"tspan");sp.setAttribute("x",cx);sp.setAttribute("dy",li===0?"0":String(lineH));sp.textContent=line;tx.appendChild(sp)});
      }else tx.textContent=label;
      svg.appendChild(tx);
    });

    addText(NS,svg,s.xAxis?.label||"X",(L+R)/2,700,"scatter-axis-label","middle");
    addText(NS,svg,s.yAxis?.label||"Y",L,24,"scatter-axis-label","start");
    root.appendChild(w);
  }
};