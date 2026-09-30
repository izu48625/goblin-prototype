import {getImageUrl} from "./images.js";

function safeName(project){
  return (project.meta.title||"stats-maker").replace(/[\\/:*?"<>|]+/g,"_");
}

export function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
}

function canvasBlob(canvas,mime,quality){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error("Image encoding failed")),
      mime,
      quality
    );
  });
}

function rr(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

function fillRound(ctx,x,y,w,h,r,fill,stroke=null,lineWidth=1){
  rr(ctx,x,y,w,h,r);
  ctx.fillStyle=fill;
  ctx.fill();
  if(stroke){
    ctx.lineWidth=lineWidth;
    ctx.strokeStyle=stroke;
    ctx.stroke();
  }
}

function font(ctx,size,weight=700,family="system-ui"){
  ctx.font=`${weight} ${Math.max(1,size)}px ${family}`;
}

function ellipsis(ctx,text,maxWidth){
  text=String(text??"");
  if(ctx.measureText(text).width<=maxWidth)return text;
  let out=text;
  while(out.length>1 && ctx.measureText(out+"…").width>maxWidth)out=out.slice(0,-1);
  return out+"…";
}

function wrapLines(ctx,text,maxWidth,maxLines=2){
  const raw=String(text??"").trim();
  if(!raw)return [];
  const chars=[...raw];
  const lines=[];
  let line="";
  for(const ch of chars){
    const next=line+ch;
    if(line && ctx.measureText(next).width>maxWidth){
      lines.push(line);
      line=ch;
      if(lines.length>=maxLines-1)break;
    }else{
      line=next;
    }
  }
  if(lines.length<maxLines && line){
    let used=lines.join("").length;
    const remains=[...raw].slice(used).join("");
    lines.push(ellipsis(ctx,remains,maxWidth));
  }
  return lines.slice(0,maxLines);
}

function fmt(v){
  const n=Number(v);
  if(!Number.isFinite(n))return "0";
  return Number.isInteger(n)?String(n):n.toFixed(1);
}

function theme(project){
  const s=project.style||{};
  return {
    bg:s.background||"#10192B",
    surface:s.surface||"#17243A",
    text:s.primary||"#F4F7FC",
    muted:s.secondary||"#9EADC1",
    accent:s.accent||"#6F9CFF",
    border:s.border||"#2C405E",
    family:s.typography?.fontFamily||"system-ui"
  };
}

function baseCanvas(project){
  const width=Math.max(320,Math.min(2400,Number(project.canvas?.width)||1080));
  const height=Math.max(320,Math.min(3000,Number(project.canvas?.height)||1080));
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Canvas 2D unavailable");
  const c=theme(project);
  if(!project.canvas?.transparent){
    ctx.fillStyle=c.bg;
    ctx.fillRect(0,0,width,height);
  }else{
    ctx.clearRect(0,0,width,height);
  }
  ctx.textBaseline="alphabetic";
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  return {canvas,ctx,c,width,height};
}

function drawHeader(ctx,project,c,width,{kicker="",top=70}={}){
  const pad=width*.075;
  if(kicker){
    font(ctx,width*.018,900,c.family);
    ctx.fillStyle=c.accent;
    ctx.fillText(String(kicker).toUpperCase(),pad,top);
  }
  font(ctx,width*.052,900,c.family);
  ctx.fillStyle=c.text;
  const title=project.meta?.title||"Stats Maker";
  const lines=wrapLines(ctx,title,width-pad*2,2);
  let y=top+(kicker?54:20);
  for(const line of lines){
    ctx.fillText(line,pad,y);
    y+=width*.056;
  }
  const sub=project.meta?.subtitle||"";
  if(sub){
    font(ctx,width*.018,600,c.family);
    ctx.fillStyle=c.muted;
    ctx.fillText(ellipsis(ctx,sub,width-pad*2),pad,y+12);
    y+=42;
  }
  return y+20;
}

async function loadImage(src){
  if(!src)return null;
  return await new Promise(resolve=>{
    const img=new Image();
    const timer=setTimeout(()=>resolve(null),3500);
    img.onload=()=>{clearTimeout(timer);resolve(img)};
    img.onerror=()=>{clearTimeout(timer);resolve(null)};
    img.src=src;
  });
}

async function itemImage(item){
  if(item?.imageData)return item.imageData;
  if(item?.imageRef){
    try{return await getImageUrl(item.imageRef)}catch{}
  }
  return null;
}

function drawCover(ctx,img,x,y,w,h,shape="rounded"){
  if(!img)return;
  ctx.save();
  if(shape==="circle"){
    ctx.beginPath();
    ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2,0,Math.PI*2);
    ctx.clip();
  }else{
    rr(ctx,x,y,w,h,Math.min(w,h)*.14);
    ctx.clip();
  }
  const ir=img.width/img.height, br=w/h;
  let dw,dh,dx,dy;
  if(ir>br){
    dh=h;dw=h*ir;dx=x+(w-dw)/2;dy=y;
  }else{
    dw=w;dh=w/ir;dx=x;dy=y+(h-dh)/2;
  }
  ctx.drawImage(img,dx,dy,dw,dh);
  ctx.restore();
}

async function renderRanking(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const settings=project.settings||{};
  const items=(project.data?.items||[]).filter(x=>x.enabled!==false)
    .slice(0,Math.max(1,Math.min(20,Number(settings.topN)||10)));
  const y0=drawHeader(ctx,project,c,width,{kicker:settings.headerLabel||"RANKING",top:70});
  const pad=width*.075;
  const gap=height*.009;
  const bottom=height*.075;
  const available=Math.max(200,height-y0-bottom);
  const rowH=Math.min(width*.105,(available-gap*(items.length-1))/Math.max(1,items.length));
  let lastVal=null,lastRank=0;

  for(let i=0;i<items.length;i++){
    const item=items[i];
    const y=y0+i*(rowH+gap);
    const val=Number(item.value)||0;
    if(val!==lastVal){lastRank=i+1;lastVal=val}
    const stroke=lastRank===1?"#E8C45A":lastRank===2?"#BFC8D6":lastRank===3?"#C88E59":c.border;
    fillRound(ctx,pad,y,width-pad*2,rowH,rowH*.12,c.surface,stroke,Math.max(2,width*.002));

    const rankSize=rowH*.42;
    const rx=pad+rowH*.15, ry=y+(rowH-rankSize)/2;
    fillRound(ctx,rx,ry,rankSize,rankSize,rankSize*.2,lastRank<=3?stroke:"#34445D");
    font(ctx,rankSize*.48,900,c.family);
    ctx.fillStyle=lastRank<=3?"#132034":c.muted;
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText(String(lastRank),rx+rankSize/2,ry+rankSize/2+1);
    ctx.textAlign="left";
    ctx.textBaseline="alphabetic";

    const av=rowH*.5, ax=rx+rankSize+rowH*.14, ay=y+(rowH-av)/2;
    const src=await itemImage(item);
    const img=await loadImage(src);
    if(img){
      drawCover(ctx,img,ax,ay,av,av,"circle");
      ctx.strokeStyle=c.accent;ctx.lineWidth=Math.max(2,width*.002);
      ctx.beginPath();ctx.arc(ax+av/2,ay+av/2,av/2,0,Math.PI*2);ctx.stroke();
    }else{
      ctx.fillStyle="#5E78B7";ctx.beginPath();ctx.arc(ax+av/2,ay+av/2,av/2,0,Math.PI*2);ctx.fill();
      font(ctx,av*.25,800,c.family);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(String(item.name||"?").slice(0,2),ax+av/2,ay+av/2);
      ctx.textAlign="left";ctx.textBaseline="alphabetic";
    }

    const tx=ax+av+rowH*.14;
    const valueW=width*.17;
    font(ctx,rowH*.25,900,c.family);ctx.fillStyle=c.text;
    ctx.fillText(ellipsis(ctx,item.name||"",width-pad-tx-valueW),tx,y+rowH*.43);
    const meta=[settings.showCategory!==false?item.category:"",settings.showNote!==false?item.note:""].filter(Boolean).join(" · ");
    if(meta){
      font(ctx,rowH*.13,500,c.family);ctx.fillStyle=c.muted;
      ctx.fillText(ellipsis(ctx,meta,width-pad-tx-valueW),tx,y+rowH*.68);
    }
    font(ctx,rowH*.3,900,c.family);ctx.fillStyle=c.text;ctx.textAlign="right";
    ctx.fillText(fmt(val),width-pad-rowH*.08,y+rowH*.58);
    ctx.textAlign="left";
  }
  return canvas;
}

async function renderStat(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const pad=width*.12;
  const top=height*.07;
  const cardW=width-pad*2, cardH=height*.86;
  fillRound(ctx,pad,top,cardW,cardH,width*.04,c.surface,c.border,Math.max(2,width*.002));

  const imageSize=Math.min(cardW*.29,cardH*.26);
  const ix=pad+cardW*.08,iy=top+cardH*.12;
  fillRound(ctx,ix,iy,imageSize,imageSize,imageSize*.16,"#0D182A",c.border,2);
  const src=project.data?.imageData || (project.data?.imageRef?await getImageUrl(project.data.imageRef).catch(()=>null):null);
  const img=await loadImage(src);
  if(img)drawCover(ctx,img,ix,iy,imageSize,imageSize,project.data?.imageShape==="circle"?"circle":"rounded");
  else{
    font(ctx,imageSize*.18,900,c.family);ctx.fillStyle=c.muted;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("IMAGE",ix+imageSize/2,iy+imageSize/2);
    ctx.textAlign="left";ctx.textBaseline="alphabetic";
  }

  const infoX=ix+imageSize+cardW*.06;
  const infoW=pad+cardW-infoX-cardW*.06;
  font(ctx,width*.045,900,c.family);ctx.fillStyle=c.text;
  const nameLines=wrapLines(ctx,project.data?.name||project.meta?.title||"",infoW*.58,2);
  let ny=iy+width*.05;
  nameLines.forEach(line=>{ctx.fillText(line,infoX,ny);ny+=width*.05});
  font(ctx,width*.017,600,c.family);ctx.fillStyle=c.muted;
  ctx.fillText(ellipsis(ctx,project.data?.subtitle||project.meta?.subtitle||"",infoW*.6),infoX,ny+8);

  font(ctx,width*.017,800,c.family);ctx.fillStyle=c.muted;ctx.fillText("OVR",infoX+infoW*.61,iy+width*.04);
  font(ctx,width*.072,900,c.family);ctx.fillStyle=c.accent;
  ctx.fillText(fmt(project.data?.overall??0),infoX+infoW*.57,iy+width*.105);

  const lineY=iy+imageSize+cardH*.055;
  ctx.strokeStyle=c.border;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad+cardW*.08,lineY);ctx.lineTo(pad+cardW*.92,lineY);ctx.stroke();

  const stats=(project.data?.stats||[]).slice(0,12);
  const cols=2, rows=Math.ceil(stats.length/cols);
  const gridX=pad+cardW*.08, gridW=cardW*.84;
  const gridTop=lineY+cardH*.055;
  const cellW=gridW/2, cellH=Math.min(cardH*.105,(top+cardH-cardH*.08-gridTop)/Math.max(1,rows));

  stats.forEach((s,i)=>{
    const col=i%2,row=Math.floor(i/2),x=gridX+col*cellW,y=gridTop+row*cellH;
    font(ctx,width*.021,700,c.family);ctx.fillStyle=c.muted;
    ctx.fillText(ellipsis(ctx,s.label||"",cellW*.55),x,y+cellH*.5);
    font(ctx,width*.038,900,c.family);ctx.fillStyle=c.text;ctx.textAlign="right";
    ctx.fillText(fmt(s.value),x+cellW*.92,y+cellH*.55);
    ctx.textAlign="left";
    ctx.strokeStyle=c.border;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y+cellH*.72);ctx.lineTo(x+cellW*.92,y+cellH*.72);ctx.stroke();
  });
  return canvas;
}

function renderBar(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"BAR CHART",top:70});
  const items=(project.data?.items||[]).filter(x=>x.enabled!==false).slice(0,Math.min(20,project.settings?.topN||10));
  const pad=width*.075, labelW=width*.22, right=width*.1;
  const max=Math.max(1,project.settings?.autoMax?Math.max(...items.map(i=>Number(i.value)||0)):Number(project.settings?.max)||100);
  const rowH=Math.min(width*.08,(height-y0-height*.07)/Math.max(1,items.length));
  items.forEach((item,i)=>{
    const y=y0+i*rowH;
    font(ctx,rowH*.25,800,c.family);ctx.fillStyle=c.text;
    ctx.fillText(ellipsis(ctx,item.name||"",labelW*.9),pad,y+rowH*.55);
    const bx=pad+labelW,bw=width-pad-right-bx,by=y+rowH*.28,bh=rowH*.28;
    fillRound(ctx,bx,by,bw,bh,bh/2,c.border);
    fillRound(ctx,bx,by,bw*Math.max(0,Math.min(1,(Number(item.value)||0)/max)),bh,bh/2,c.accent);
    if(project.settings?.showValues!==false){
      font(ctx,rowH*.25,900,c.family);ctx.fillStyle=c.text;ctx.textAlign="right";
      ctx.fillText(fmt(item.value),width-right*.5,y+rowH*.55);ctx.textAlign="left";
    }
  });
  return canvas;
}

function renderRadar(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"RADAR",top:65});
  const axes=project.data?.axes||[], series=project.data?.series||[];
  const n=axes.length;
  if(n<3)return canvas;
  const cx=width*.5,cy=y0+(height-y0)*.46,r=Math.min(width*.34,(height-y0)*.34);
  const levels=Math.max(3,Math.min(8,Number(project.settings?.gridLevels)||5));
  for(let l=1;l<=levels;l++){
    const rr0=r*l/levels;
    ctx.beginPath();
    for(let i=0;i<n;i++){
      const a=-Math.PI/2+i*Math.PI*2/n,x=cx+Math.cos(a)*rr0,y=cy+Math.sin(a)*rr0;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.strokeStyle=c.border;ctx.lineWidth=1.5;ctx.stroke();
  }
  axes.forEach((ax,i)=>{
    const a=-Math.PI/2+i*Math.PI*2/n;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.strokeStyle=c.border;ctx.stroke();
    if(project.settings?.showAxisLabels!==false){
      const lx=cx+Math.cos(a)*r*1.15,ly=cy+Math.sin(a)*r*1.15;
      font(ctx,width*.017,700,c.family);ctx.fillStyle=c.muted;ctx.textAlign=lx<cx-width*.02?"right":lx>cx+width*.02?"left":"center";
      ctx.fillText(ellipsis(ctx,ax.label||"",width*.18),lx,ly);ctx.textAlign="left";
    }
  });
  series.forEach((s,si)=>{
    ctx.beginPath();
    axes.forEach((ax,i)=>{
      const a=-Math.PI/2+i*Math.PI*2/n,max=Math.max(1,Number(ax.max)||100),v=Number(s.values?.[i])||0,rr0=r*Math.max(0,Math.min(1,v/max));
      const x=cx+Math.cos(a)*rr0,y=cy+Math.sin(a)*rr0;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.closePath();ctx.strokeStyle=s.color||c.accent;ctx.lineWidth=Math.max(2,width*.004);ctx.stroke();
    ctx.globalAlpha=Math.max(.08,Math.min(.5,Number(project.settings?.fillOpacity)||.18));ctx.fillStyle=s.color||c.accent;ctx.fill();ctx.globalAlpha=1;
  });
  if(project.settings?.showLegend!==false){
    let x=width*.18,y=height*.9;
    series.slice(0,6).forEach(s=>{
      ctx.fillStyle=s.color||c.accent;ctx.beginPath();ctx.arc(x,y,width*.008,0,Math.PI*2);ctx.fill();
      font(ctx,width*.016,700,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,s.name||"",width*.16),x+width*.015,y+6);
      x+=width*.22;
      if(x>width*.8){x=width*.18;y+=width*.03}
    });
  }
  return canvas;
}

function drawXYAxes(ctx,c,width,height,project,titleKicker){
  const y0=drawHeader(ctx,project,c,width,{kicker:titleKicker,top:65});
  const L=width*.13,R=width*.9,T=y0+20,B=height*.86;
  ctx.strokeStyle=c.border;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,B);ctx.lineTo(R,B);ctx.stroke();
  return {L,R,T,B};
}

function renderQuadrant(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const {L,R,T,B}=drawXYAxes(ctx,c,width,height,project,"QUADRANT");
  const xa=project.settings?.xAxis||{},ya=project.settings?.yAxis||{};
  const xmin=Number(xa.min)||0,xmax=Number(xa.max)||100,ymin=Number(ya.min)||0,ymax=Number(ya.max)||100;
  const xp=v=>L+(Number(v)-xmin)/(xmax-xmin||1)*(R-L),yp=v=>B-(Number(v)-ymin)/(ymax-ymin||1)*(B-T);
  ctx.setLineDash([10,8]);ctx.strokeStyle=c.muted;ctx.globalAlpha=.65;
  ctx.beginPath();ctx.moveTo(xp(xa.split??50),T);ctx.lineTo(xp(xa.split??50),B);ctx.moveTo(L,yp(ya.split??50));ctx.lineTo(R,yp(ya.split??50));ctx.stroke();
  ctx.setLineDash([]);ctx.globalAlpha=1;
  const quadItems=(project.data?.items||[]).filter(i=>i.enabled!==false&&Number.isFinite(i.x)&&Number.isFinite(i.y));
  const labelLimit=Math.max(1,Math.min(40,Number(project.settings?.labelLimit)||15));
  quadItems.forEach((item,index)=>{
    const x=xp(item.x),y=yp(item.y);
    ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(x,y,width*.012,0,Math.PI*2);ctx.fill();
    if(index<labelLimit){
      font(ctx,width*.015,800,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,item.name||"",width*.16),x+width*.016,y-width*.012);
    }
  });
  font(ctx,width*.017,800,c.family);ctx.fillStyle=c.muted;ctx.textAlign="right";ctx.fillText(xa.label||"X",R,B+width*.05);
  ctx.textAlign="left";ctx.fillText(ya.label||"Y",L,T-width*.015);
  return canvas;
}

function scatterNiceStep(raw){
  if(!Number.isFinite(raw)||raw<=0)return 1;
  const pow=10**Math.floor(Math.log10(raw));
  const f=raw/pow;
  return (f<=1?1:f<=2?2:f<=5?5:10)*pow;
}
function scatterRange(values,scaleMax,minWidth,mode){
  if(mode==="full"||!values.length)return {min:0,max:scaleMax,step:scatterNiceStep(scaleMax/5)};
  let min=Math.min(...values),max=Math.max(...values),w=max-min;
  if(w<minWidth){
    const mid=(min+max)/2;min=mid-minWidth/2;max=mid+minWidth/2;w=minWidth;
  }else{
    const pad=w*.2;min-=pad;max+=pad;w=max-min;
  }
  let step=scatterNiceStep(w/4);
  min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
  if(max-min<minWidth){
    const need=minWidth-(max-min);min-=need/2;max+=need/2;
    min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
  }
  if(min<0){max-=min;min=0}
  if(max>scaleMax){min-=max-scaleMax;max=scaleMax}
  min=Math.max(0,min);max=Math.min(scaleMax,max);
  if(max-min<minWidth){
    if(max===scaleMax)min=Math.max(0,scaleMax-minWidth);
    else max=Math.min(scaleMax,min+minWidth);
  }
  step=scatterNiceStep((max-min)/4);
  return {min,max,step};
}
function scatterTicks(range){
  const out=[],eps=range.step/100;
  let v=Math.ceil((range.min-eps)/range.step)*range.step;
  for(;v<=range.max+eps&&out.length<8;v+=range.step)out.push(Math.round(v*1000)/1000);
  if(!out.length||Math.abs(out[0]-range.min)>eps)out.unshift(range.min);
  if(Math.abs(out.at(-1)-range.max)>eps)out.push(range.max);
  return [...new Set(out)].slice(0,7);
}
function scatterBoxOverlap(a,b,pad=6){return !(a.x2+pad<b.x1||a.x1-pad>b.x2||a.y2+pad<b.y1||a.y1-pad>b.y2)}

function renderScatter(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const settings=project.settings||{};
  const items=(project.data?.items||[]).filter(item=>item.enabled!==false&&Number.isFinite(item.x)&&Number.isFinite(item.y));
  const scaleMax=Number(settings.scaleMax)||Math.max(Number(settings.xAxis?.max)||0,Number(settings.yAxis?.max)||0,100);
  const minWidth=Number(settings.minDisplayWidth)||(scaleMax===10?2:20);
  const xr=scatterRange(items.map(i=>Number(i.x)),scaleMax,minWidth,settings.rangeMode||"auto");
  const yr=scatterRange(items.map(i=>Number(i.y)),scaleMax,minWidth,settings.rangeMode||"auto");

  const pad=width*.075;
  font(ctx,width*.018,900,c.family);ctx.fillStyle=c.accent;ctx.fillText("SCATTER",pad,70);
  font(ctx,width*.046,900,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,project.meta?.title||"Scatter",width-pad*2),pad,122);
  font(ctx,width*.017,650,c.family);ctx.fillStyle=c.muted;ctx.fillText(ellipsis(ctx,project.meta?.subtitle||"",width-pad*2),pad,157);

  const L=width*.12,R=width*.93,T=height*.20,B=height*.84;
  const xp=v=>L+(v-xr.min)/(xr.max-xr.min||1)*(R-L);
  const yp=v=>B-(v-yr.min)/(yr.max-yr.min||1)*(B-T);

  ctx.lineWidth=Math.max(1.2,width*.0015);
  scatterTicks(xr).forEach(v=>{
    const x=xp(v);ctx.strokeStyle=c.border;ctx.globalAlpha=.42;ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,B);ctx.stroke();ctx.globalAlpha=1;
    font(ctx,width*.014,700,c.family);ctx.fillStyle=c.muted;ctx.textAlign="center";ctx.fillText(fmt(v),x,B+width*.026);
  });
  scatterTicks(yr).forEach(v=>{
    const y=yp(v);ctx.strokeStyle=c.border;ctx.globalAlpha=.42;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();ctx.globalAlpha=1;
    font(ctx,width*.014,700,c.family);ctx.fillStyle=c.muted;ctx.textAlign="right";ctx.fillText(fmt(v),L-width*.012,y+5);
  });
  ctx.textAlign="left";ctx.strokeStyle=c.muted;ctx.lineWidth=Math.max(2,width*.002);ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,B);ctx.lineTo(R,B);ctx.stroke();

  const reserved=[];
  if(items.length&&settings.showAverage!==false){
    const ax=items.reduce((a,b)=>a+Number(b.x),0)/items.length;
    const ay=items.reduce((a,b)=>a+Number(b.y),0)/items.length;
    const vx=xp(ax),hy=yp(ay);
    ctx.setLineDash([10,8]);ctx.strokeStyle=c.accent;ctx.globalAlpha=.68;ctx.beginPath();ctx.moveTo(vx,T);ctx.lineTo(vx,B);ctx.moveTo(L,hy);ctx.lineTo(R,hy);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    font(ctx,width*.0145,850,c.family);ctx.fillStyle=c.accent;
    const xl=`${settings.xAxis?.label||"X"} AVG ${fmt(ax)}`;
    const yl=`${settings.yAxis?.label||"Y"} AVG ${fmt(ay)}`;
    const xw=Math.min(width*.22,ctx.measureText(xl).width+12),yw=Math.min(width*.22,ctx.measureText(yl).width+12);
    const xb={x1:Math.min(R-xw,vx+8),y1:T+8,x2:Math.min(R,vx+8+xw),y2:T+32};
    const yb={x1:R-yw-8,y1:Math.max(T,Math.min(B-28,hy-30)),x2:R-8,y2:Math.max(T,Math.min(B-28,hy-30))+26};
    ctx.fillText(xl,xb.x1+4,xb.y2-5);ctx.fillText(yl,yb.x1+4,yb.y2-5);reserved.push(xb,yb);
  }

  const points=items.map(i=>({x:xp(Number(i.x)),y:yp(Number(i.y))}));
  const placed=[...reserved];
  items.forEach((item,index)=>{
    const x=points[index].x,y=points[index].y,r=Math.max(5,width*.0095);
    ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    if(settings.showLabels===false || index>=Math.max(1,Math.min(40,Number(settings.labelLimit)||15)))return;

    const raw=String(item.name||"").trim();if(!raw)return;
    let size=width*(raw.length>18?.014:raw.length>12?.0155:.017);
    font(ctx,size,800,c.family);const maxW=width*.22;
    const lines=wrapLines(ctx,raw,maxW,2);const h=lines.length*size*1.25;
    const w=Math.min(maxW,Math.max(...lines.map(line=>ctx.measureText(line).width),40));
    const gap=width*.014;
    const cand=[
      {x1:x+gap,y1:y-gap-h,x2:x+gap+w,y2:y-gap,align:"left"},
      {x1:x-gap-w,y1:y-gap-h,x2:x-gap,y2:y-gap,align:"right"},
      {x1:x+gap,y1:y+gap,x2:x+gap+w,y2:y+gap+h,align:"left"},
      {x1:x-gap-w,y1:y+gap,x2:x-gap,y2:y+gap+h,align:"right"},
      {x1:x-w/2,y1:y-gap-h,x2:x+w/2,y2:y-gap,align:"center"},
      {x1:x-w/2,y1:y+gap,x2:x+w/2,y2:y+gap+h,align:"center"}
    ];
    let box=cand.find(b=>b.x1>=L&&b.x2<=R&&b.y1>=T&&b.y2<=B&&!placed.some(p=>scatterBoxOverlap(b,p))&&!points.some((p,pi)=>pi!==index&&p.x>=b.x1-10&&p.x<=b.x2+10&&p.y>=b.y1-10&&p.y<=b.y2+10));
    if(!box)box=cand.find(b=>b.x1>=L&&b.x2<=R&&b.y1>=T&&b.y2<=B)||cand[0];
    placed.push(box);

    const midx=(box.x1+box.x2)/2,midy=(box.y1+box.y2)/2;
    if(Math.hypot(midx-x,midy-y)>width*.045){
      ctx.strokeStyle=c.muted;ctx.globalAlpha=.7;ctx.lineWidth=Math.max(1,width*.0012);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(midx,midy);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.textAlign=box.align;ctx.fillStyle=c.text;font(ctx,size,850,c.family);
    const tx=box.align==="left"?box.x1:box.align==="right"?box.x2:midx;
    lines.forEach((line,li)=>ctx.fillText(line,tx,box.y1+size*(1+li*1.22)));
  });

  font(ctx,width*.017,850,c.family);ctx.fillStyle=c.muted;ctx.textAlign="center";ctx.fillText(settings.xAxis?.label||"X",(L+R)/2,height*.93);
  ctx.textAlign="left";ctx.fillText(settings.yAxis?.label||"Y",L,T-width*.015);
  return canvas;
}
function renderDot(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"DOT CHART",top:70});
  const items=(project.data?.items||[])
    .filter(x=>x.enabled!==false)
    .slice(0,Math.max(1,Math.min(20,Number(project.settings?.displayLimit)||10)));
  const min=Number(project.settings?.min)||0,max=Number(project.settings?.max)||100;
  const pad=width*.075,labelW=width*.24,right=width*.12,rowH=Math.min(width*.085,(height-y0-height*.07)/Math.max(1,items.length));
  items.forEach((item,i)=>{
    const y=y0+i*rowH+rowH*.5,bx=pad+labelW,bw=width-pad-right-bx;
    font(ctx,rowH*.24,800,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,item.name||"",labelW*.9),pad,y+6);
    ctx.strokeStyle=c.border;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(bx+bw,y);ctx.stroke();
    const pct=Math.max(0,Math.min(1,((Number(item.value)||0)-min)/(max-min||1))),x=bx+bw*pct;
    ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(x,y,rowH*.12,0,Math.PI*2);ctx.fill();
    if(project.settings?.showValues!==false){font(ctx,rowH*.24,900,c.family);ctx.fillStyle=c.text;ctx.textAlign="right";ctx.fillText(fmt(item.value),width-pad,y+6);ctx.textAlign="left";}
  });
  return canvas;
}

function renderRange(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"RANGE",top:70});
  const items=(project.data?.items||[])
    .filter(i=>i.enabled!==false&&Number.isFinite(i.value)&&Number.isFinite(i.value2))
    .slice(0,Math.max(1,Math.min(20,Number(project.settings?.displayLimit)||10)));
  let vals=items.flatMap(i=>[Number(i.value),Number(i.value2)]);
  let min=project.settings?.autoRange!==false?Math.min(...vals,0):(Number(project.settings?.min)||0);
  let max=project.settings?.autoRange!==false?Math.max(...vals,100):(Number(project.settings?.max)||100);
  if(max<=min)max=min+1;
  const pad=width*.075,labelW=width*.22,right=width*.17,rowH=Math.min(width*.09,(height-y0-height*.07)/Math.max(1,items.length));
  items.forEach((item,i)=>{
    const y=y0+i*rowH+rowH*.5,bx=pad+labelW,bw=width-pad-right-bx;
    const pa=((Number(item.value)||0)-min)/(max-min),pb=((Number(item.value2)||0)-min)/(max-min),xa=bx+bw*pa,xb=bx+bw*pb;
    font(ctx,rowH*.22,800,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,item.name||"",labelW*.9),pad,y+6);
    ctx.strokeStyle=c.border;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(bx,y);ctx.lineTo(bx+bw,y);ctx.stroke();
    ctx.strokeStyle=c.accent;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(xa,y);ctx.lineTo(xb,y);ctx.stroke();
    ctx.fillStyle=c.muted;ctx.beginPath();ctx.arc(xa,y,rowH*.11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(xb,y,rowH*.11,0,Math.PI*2);ctx.fill();
    font(ctx,rowH*.18,700,c.family);ctx.fillStyle=c.text;ctx.textAlign="right";ctx.fillText(`${fmt(item.value)} → ${fmt(item.value2)}`,width-pad,y+6);ctx.textAlign="left";
  });
  return canvas;
}

function renderTier(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"TIER LIST",top:70});
  const tiers=project.data?.tiers||[],items=project.data?.items||[];
  const pad=width*.07,gap=height*.009,rowH=Math.min(width*.115,(height-y0-height*.06-gap*Math.max(0,tiers.length-1))/Math.max(1,tiers.length));
  const tierFor=item=>{
    if(project.settings?.mode==="manual")return item.tier||"";
    const v=Number(item.value)||0;
    return tiers.find(t=>v>=Number(t.min)&&v<=Number(t.max))?.label||tiers.at(-1)?.label||"";
  };
  tiers.forEach((t,i)=>{
    const y=y0+i*(rowH+gap),labW=width*.1;
    fillRound(ctx,pad,y,labW,rowH,rowH*.12,c.accent);
    font(ctx,rowH*.38,900,c.family);ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(t.label||"",pad+labW/2,y+rowH/2);ctx.textAlign="left";ctx.textBaseline="alphabetic";
    fillRound(ctx,pad+labW,y,width-pad*2-labW,rowH,rowH*.12,c.surface,c.border,2);
    const arr=items.filter(it=>tierFor(it)===t.label);
    let x=pad+labW+rowH*.12;
    arr.forEach(it=>{
      font(ctx,rowH*.18,800,c.family);
      const txt=project.settings?.showScore===false?it.name:`${it.name} ${fmt(it.value)}`;
      const w=Math.min(width*.2,ctx.measureText(txt).width+rowH*.22);
      if(x+w>width-pad) return;
      fillRound(ctx,x,y+rowH*.22,w,rowH*.56,rowH*.12,c.bg);
      ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,txt,w-rowH*.14),x+rowH*.07,y+rowH*.57);
      x+=w+rowH*.07;
    });
  });
  return canvas;
}

function renderRing(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"RING GAUGE",top:70});
  const items=(project.data?.items||[]).slice(0,10);
  const requested=Math.max(1,Math.min(5,Number(project.settings?.columns)||3));
  const cols=items.length>=7?5:requested,rows=Math.ceil(items.length/cols);
  const availH=height-y0-height*.06,cellW=width*.85/cols,cellH=availH/Math.max(1,rows),startX=width*.075;
  items.forEach((it,i)=>{
    const col=i%cols,row=Math.floor(i/cols),cx=startX+cellW*(col+.5),cy=y0+cellH*(row+.5),r=Math.min(cellW,cellH)*.27;
    const max=Math.max(1,Number(it.max)||100),pct=Math.max(0,Math.min(1,(Number(it.value)||0)/max));
    ctx.lineWidth=Math.max(8,width*.012);ctx.strokeStyle=c.border;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=c.accent;ctx.lineCap="round";ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.stroke();ctx.lineCap="butt";
    font(ctx,width*.035,900,c.family);ctx.fillStyle=c.text;ctx.textAlign="center";ctx.fillText(project.settings?.showPercent===false?fmt(it.value):`${Math.round(pct*100)}%`,cx,cy+10);
    font(ctx,width*.017,700,c.family);ctx.fillStyle=c.muted;ctx.fillText(ellipsis(ctx,it.label||"",cellW*.72),cx,cy+r+width*.035);ctx.textAlign="left";
  });
  return canvas;
}

export async function renderNativeProject(project){
  switch(project.type){
    case "ranking-card": return await renderRanking(project);
    case "stat-card": return await renderStat(project);
    case "bar": return renderBar(project);
    case "radar": return renderRadar(project);
    case "quadrant": return renderQuadrant(project);
    case "dot": return renderDot(project);
    case "range": return renderRange(project);
    case "scatter": return renderScatter(project);
    case "tier-list": return renderTier(project);
    case "ring": return renderRing(project);
    default: throw new Error(`Native exporter does not support ${project.type}`);
  }
}

async function renderWithHtml2Canvas(root,project){
  if(!window.html2canvas)throw new Error("html2canvas unavailable");
  return await window.html2canvas(root,{
    backgroundColor:project.canvas.transparent?null:project.style.background,
    scale:2,useCORS:true,allowTaint:false,logging:false,imageTimeout:5000
  });
}

function ordinaryDownload(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.rel="noopener";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

export async function exportPreview(root,project,format="png"){
  let canvas;
  // Safari/iPhone uses our own Canvas renderer. It does not rely on
  // html2canvas or SVG foreignObject, both of which are unreliable here.
  if(isIOS()){
    canvas=await renderNativeProject(project);
  }else{
    try{canvas=await renderWithHtml2Canvas(root,project)}
    catch(e){console.warn("html2canvas failed; using native renderer",e);canvas=await renderNativeProject(project)}
  }

  const jpg=format==="jpg",mime=jpg?"image/jpeg":"image/png",ext=jpg?"jpg":"png";
  const filename=`${safeName(project)}.${ext}`;
  const blob=await canvasBlob(canvas,mime,jpg?.94:undefined);
  const file=new File([blob],filename,{type:mime});

  if(isIOS())return {method:"preview",blob,file,filename,mime};
  ordinaryDownload(blob,filename);
  return {method:"download",blob,file,filename,mime};
}

export function exportProjectJSON(project){
  const blob=new Blob([JSON.stringify(project,null,2)],{type:"application/json"});
  ordinaryDownload(blob,`${safeName(project)}.statsmaker.json`);
}

export async function readProjectJSON(file){
  const text=await file.text();
  const data=JSON.parse(text);
  if(!data || typeof data!=="object" || !data.type || !data.meta)throw new Error("Invalid Stats Maker project");
  return data;
}
