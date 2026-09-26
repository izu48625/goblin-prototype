
(function(){
"use strict";
const __modules=Object.create(null);
const __cache=Object.create(null);

function __define(id,factory){__modules[id]=factory}
function __require(id){
  if(__cache[id])return __cache[id].exports;
  const factory=__modules[id];
  if(!factory)throw new Error("Module not found: "+id);
  const module={exports:{}};
  __cache[id]=module;
  factory(__require,module.exports,module);
  return module.exports;
}

__define("core/export.js",function(__require,__exports,__module){
"use strict";
const { getImageUrl }=__require("core/images.js");

function safeName(project){
  return (project.meta.title||"stats-maker").replace(/[\\/:*?"<>|]+/g,"_");
}

function isIOS(){
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
  (project.data?.items||[]).filter(i=>i.enabled!==false).forEach(item=>{
    const x=xp(item.x),y=yp(item.y);
    ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(x,y,width*.012,0,Math.PI*2);ctx.fill();
    font(ctx,width*.015,800,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,item.name||"",width*.16),x+width*.016,y-width*.012);
  });
  font(ctx,width*.017,800,c.family);ctx.fillStyle=c.muted;ctx.textAlign="right";ctx.fillText(xa.label||"X",R,B+width*.05);
  ctx.textAlign="left";ctx.fillText(ya.label||"Y",L,T-width*.015);
  return canvas;
}

function renderScatter(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const {L,R,T,B}=drawXYAxes(ctx,c,width,height,project,"SCATTER");
  const xa=project.settings?.xAxis||{},ya=project.settings?.yAxis||{};
  const xmin=Number(xa.min)||0,xmax=Number(xa.max)||100,ymin=Number(ya.min)||0,ymax=Number(ya.max)||100;
  const xp=v=>L+(Number(v)-xmin)/(xmax-xmin||1)*(R-L),yp=v=>B-(Number(v)-ymin)/(ymax-ymin||1)*(B-T);
  for(let i=1;i<5;i++){
    const x=L+(R-L)*i/5,y=T+(B-T)*i/5;ctx.strokeStyle=c.border;ctx.globalAlpha=.5;ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,B);ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();ctx.globalAlpha=1;
  }
  (project.data?.items||[]).forEach(item=>{
    const x=xp(item.x),y=yp(item.y);ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(x,y,width*.011,0,Math.PI*2);ctx.fill();
    if(project.settings?.showLabels!==false){font(ctx,width*.014,700,c.family);ctx.fillStyle=c.text;ctx.fillText(ellipsis(ctx,item.name||"",width*.14),x+width*.014,y-width*.01)}
  });
  font(ctx,width*.017,800,c.family);ctx.fillStyle=c.muted;ctx.textAlign="right";ctx.fillText(xa.label||"X",R,B+width*.05);ctx.textAlign="left";ctx.fillText(ya.label||"Y",L,T-width*.015);
  return canvas;
}

function renderDot(project){
  const {canvas,ctx,c,width,height}=baseCanvas(project);
  const y0=drawHeader(ctx,project,c,width,{kicker:"DOT CHART",top:70});
  const items=(project.data?.items||[]).filter(x=>x.enabled!==false);
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
  const items=project.data?.items||[];
  let vals=items.flatMap(i=>[Number(i.value)||0,Number(i.value2)||0]);
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
  const items=(project.data?.items||[]).slice(0,6);
  const cols=Math.max(1,Math.min(3,Number(project.settings?.columns)||3)),rows=Math.ceil(items.length/cols);
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

async function renderNativeProject(project){
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

async function exportPreview(root,project,format="png"){
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

function exportProjectJSON(project){
  const blob=new Blob([JSON.stringify(project,null,2)],{type:"application/json"});
  ordinaryDownload(blob,`${safeName(project)}.statsmaker.json`);
}

async function readProjectJSON(file){
  const text=await file.text();
  const data=JSON.parse(text);
  if(!data || typeof data!=="object" || !data.type || !data.meta)throw new Error("Invalid Stats Maker project");
  return data;
}

Object.assign(__exports,{renderNativeProject,exportPreview,readProjectJSON,isIOS,exportProjectJSON});

});
__define("core/history.js",function(__require,__exports,__module){
"use strict";
class History{
  constructor(initial,limit=50){
    this.past=[];
    this.present=structuredClone(initial);
    this.future=[];
    this.limit=limit;
  }

  commit(next){
    this.past.push(structuredClone(this.present));
    if(this.past.length>this.limit)this.past.shift();
    this.present=structuredClone(next);
    this.future=[];
    return structuredClone(this.present);
  }

  replace(next){
    this.present=structuredClone(next);
    return structuredClone(this.present);
  }

  undo(){
    if(!this.past.length)return null;
    this.future.unshift(structuredClone(this.present));
    this.present=this.past.pop();
    return structuredClone(this.present);
  }

  redo(){
    if(!this.future.length)return null;
    this.past.push(structuredClone(this.present));
    this.present=this.future.shift();
    return structuredClone(this.present);
  }

  canUndo(){return this.past.length>0}
  canRedo(){return this.future.length>0}
}

Object.assign(__exports,{History});

});
__define("core/i18n.js",function(__require,__exports,__module){
"use strict";
const STRINGS={
  ja:{
    "home.eyebrow":"DATA VISUAL MAKER",
    "home.title":"数字を、そのまま使えるビジュアルへ。",
    "home.desc":"ランキング、能力カード、4象限マップを、ログインなしで作成・保存・画像化できます。",
    "home.createEyebrow":"CREATE",
    "home.createTitle":"何を作りますか？",
    "home.projectsEyebrow":"LOCAL FIRST",
    "home.projectsTitle":"My Projects",
    "home.empty":"まだProjectはありません。上から作成してください。",
    "common.open":"開く",
    "common.duplicate":"複製",
    "common.delete":"削除",
    "common.export":"共有",
    "common.fit":"全体表示",
    "common.done":"完了",
    "common.add":"追加",
    "common.remove":"削除",
    "common.title":"タイトル",
    "common.subtitle":"サブタイトル",
    "editor.data":"DATA",
    "editor.style":"STYLE",
    "editor.text":"TEXT",
    "editor.canvas":"CANVAS",
    "editor.theme":"テーマ",
    "editor.colors":"カラー",
    "editor.typography":"文字",
    "editor.items":"データ",
    "editor.canvasSize":"キャンバス",
    "editor.background":"背景",
    "editor.accent":"アクセント",
    "editor.textColor":"文字色",
    "editor.mutedColor":"補助文字",
    "editor.fontSize":"基準文字サイズ",
    "editor.preset":"プリセット",
    "editor.width":"幅",
    "editor.height":"高さ",
    "editor.unit":"単位",
    "editor.note":"補足",
    "editor.value":"値",
    "editor.name":"名前",
    "editor.x":"X",
    "editor.y":"Y",
    "editor.autoSort":"高い順に並べる",
    "editor.topN":"表示人数",
    "ranking.template":"Ranking Template",
    "ranking.options":"表示設定",
    "ranking.headerLabel":"上部ラベル",
    "ranking.category":"所属 / カテゴリ",
    "ranking.showNote":"補足を表示",
    "ranking.showCategory":"所属を表示",
    "ranking.highlightTop3":"TOP3を強調",
    "ranking.showBars":"数値バーを表示",
    "ranking.density":"行の密度",
    "ranking.comfortable":"標準",
    "ranking.compact":"コンパクト",
    "import.title":"Paste / CSV",
    "import.subtitle":"Excel / Google Sheets対応",
    "import.example":"例を入れる",
    "import.preview":"プレビュー",
    "import.replace":"置換",
    "import.append":"追記",
    "import.apply":"読み込む",
    "editor.addItem":"＋ 行を追加",
    "editor.addStat":"＋ Statを追加",
    "editor.overall":"OVR",
    "editor.team":"Team / Category",
    "editor.xAxis":"X軸",
    "editor.yAxis":"Y軸",
    "editor.split":"中央基準",
    "editor.quadrants":"象限ラベル",
    "editor.topLeft":"左上",
    "editor.topRight":"右上",
    "editor.bottomLeft":"左下",
    "editor.bottomRight":"右下",
    "save.saved":"Saved",
    "save.saving":"Saving...",
    "save.error":"Save failed",
    "viz.ranking":"Ranking Card",
    "viz.stat":"Stat Card",
    "viz.quadrant":"Quadrant Chart",
    "viz.rankingDesc":"SNSにそのまま使えるランキング画像。",
    "viz.statDesc":"人物・チーム・商品を1枚の能力カードへ。",
    "viz.quadrantDesc":"2軸で対象を分類する4象限マップ。",
    "viz.bar":"Bar Chart",
    "viz.radar":"Radar Chart",
    "viz.barDesc":"数値差を一目で見せる、SNS向け横棒チャート。",
    "viz.radarDesc":"複数対象の能力・評価バランスを重ねて比較。",
    "viz.dot":"Dot Chart",
    "viz.dotDesc":"複数対象の数値差をコンパクトに比較。",
    "viz.ring":"Ring Gauge",
    "viz.ringDesc":"少数の重要指標をリングで強調。",
    "viz.tier":"Tier List",
    "viz.tierDesc":"対象をS〜Dなどの段階へ分類。",
    "viz.heatmap":"Heatmap",
    "viz.heatmapDesc":"多数の対象×指標を色で一気に比較。",
    "viz.scatter":"Scatter Chart",
    "viz.scatterDesc":"2つの数値の関係や傾向を見る。",
    "viz.range":"Range / Dumbbell",
    "viz.rangeDesc":"Before→Afterなど2値の差を比較。",
    "viz.waffle":"Waffle Chart",
    "viz.waffleDesc":"割合・構成比をセルで直感的に表示。",
    "viz.statBoard":"Stat Board",
    "viz.statBoardDesc":"複数の指標・リング・数値・文章を1枚へまとめる。",
    "common.jpg":"JPG保存",
    "common.backup":"Project保存",
    "common.restore":"Project読込",
    "editor.spreadsheet":"Spreadsheet",
    "editor.mode":"モード",
    "editor.auto":"自動",
    "editor.manual":"手動",
    "bar.options":"Bar設定",
    "bar.showValues":"値を表示",
    "bar.showCategory":"所属を表示",
    "bar.showGrid":"ガイドライン",
    "bar.autoMax":"最大値を自動",
    "bar.max":"最大値",
    "radar.options":"Radar設定",
    "radar.axes":"評価軸",
    "radar.series":"比較対象",
    "radar.gridLevels":"グリッド段数",
    "radar.showValues":"数値を表示",
    "radar.showLegend":"凡例を表示",
    "radar.showAxisLabels":"軸名を表示",
    "radar.fillOpacity":"塗り透明度"
  },
  en:{
    "home.eyebrow":"DATA VISUAL MAKER",
    "home.title":"Turn data into visuals worth sharing.",
    "home.desc":"Create rankings, stat cards and quadrant maps without signing in.",
    "home.createEyebrow":"CREATE",
    "home.createTitle":"What do you want to make?",
    "home.projectsEyebrow":"LOCAL FIRST",
    "home.projectsTitle":"My Projects",
    "home.empty":"No projects yet. Create one above.",
    "common.open":"Open",
    "common.duplicate":"Duplicate",
    "common.delete":"Delete",
    "common.export":"Share",
    "common.fit":"Fit",
    "common.done":"Done",
    "common.add":"Add",
    "common.remove":"Delete",
    "common.title":"Title",
    "common.subtitle":"Subtitle",
    "editor.data":"DATA",
    "editor.style":"STYLE",
    "editor.text":"TEXT",
    "editor.canvas":"CANVAS",
    "editor.theme":"Theme",
    "editor.colors":"Colors",
    "editor.typography":"Typography",
    "editor.items":"Data",
    "editor.canvasSize":"Canvas",
    "editor.background":"Background",
    "editor.accent":"Accent",
    "editor.textColor":"Text",
    "editor.mutedColor":"Muted text",
    "editor.fontSize":"Base font size",
    "editor.preset":"Preset",
    "editor.width":"Width",
    "editor.height":"Height",
    "editor.unit":"Unit",
    "editor.note":"Note",
    "editor.value":"Value",
    "editor.name":"Name",
    "editor.x":"X",
    "editor.y":"Y",
    "editor.autoSort":"Sort high to low",
    "editor.topN":"Show top",
    "ranking.template":"Ranking Template",
    "ranking.options":"Display Options",
    "ranking.headerLabel":"Header label",
    "ranking.category":"Club / Category",
    "ranking.showNote":"Show note",
    "ranking.showCategory":"Show category",
    "ranking.highlightTop3":"Highlight Top 3",
    "ranking.showBars":"Show value bars",
    "ranking.density":"Row density",
    "ranking.comfortable":"Comfortable",
    "ranking.compact":"Compact",
    "import.title":"Paste / CSV",
    "import.subtitle":"Excel / Google Sheets compatible",
    "import.example":"Example",
    "import.preview":"Preview",
    "import.replace":"Replace",
    "import.append":"Append",
    "import.apply":"Import",
    "editor.addItem":"＋ Add row",
    "editor.addStat":"＋ Add stat",
    "editor.overall":"OVR",
    "editor.team":"Team / Category",
    "editor.xAxis":"X Axis",
    "editor.yAxis":"Y Axis",
    "editor.split":"Center split",
    "editor.quadrants":"Quadrant labels",
    "editor.topLeft":"Top left",
    "editor.topRight":"Top right",
    "editor.bottomLeft":"Bottom left",
    "editor.bottomRight":"Bottom right",
    "save.saved":"Saved",
    "save.saving":"Saving...",
    "save.error":"Save failed",
    "viz.ranking":"Ranking Card",
    "viz.stat":"Stat Card",
    "viz.quadrant":"Quadrant Chart",
    "viz.rankingDesc":"A share-ready ranking graphic.",
    "viz.statDesc":"Turn one player, team or product into a stat card.",
    "viz.quadrantDesc":"Classify items on a two-axis quadrant map.",
    "viz.bar":"Bar Chart",
    "viz.radar":"Radar Chart",
    "viz.barDesc":"A share-ready horizontal bar chart for clear value comparison.",
    "viz.radarDesc":"Overlay multiple profiles to compare strengths and balance.",
    "viz.dot":"Dot Chart",
    "viz.dotDesc":"Compactly compare values across multiple items.",
    "viz.ring":"Ring Gauge",
    "viz.ringDesc":"Highlight a few key metrics with rings.",
    "viz.tier":"Tier List",
    "viz.tierDesc":"Classify items into tiers such as S through D.",
    "viz.heatmap":"Heatmap",
    "viz.heatmapDesc":"Compare many items and metrics with color.",
    "viz.scatter":"Scatter Chart",
    "viz.scatterDesc":"Explore relationships between two numeric variables.",
    "viz.range":"Range / Dumbbell",
    "viz.rangeDesc":"Compare two values such as before and after.",
    "viz.waffle":"Waffle Chart",
    "viz.waffleDesc":"Show proportions as a grid of cells.",
    "viz.statBoard":"Stat Board",
    "viz.statBoardDesc":"Combine numbers, rings, progress and text into one board.",
    "common.jpg":"Export JPG",
    "common.backup":"Save Project",
    "common.restore":"Load Project",
    "editor.spreadsheet":"Spreadsheet",
    "editor.mode":"Mode",
    "editor.auto":"Auto",
    "editor.manual":"Manual",
    "bar.options":"Bar Settings",
    "bar.showValues":"Show values",
    "bar.showCategory":"Show category",
    "bar.showGrid":"Guide lines",
    "bar.autoMax":"Auto maximum",
    "bar.max":"Maximum",
    "radar.options":"Radar Settings",
    "radar.axes":"Axes",
    "radar.series":"Series",
    "radar.gridLevels":"Grid levels",
    "radar.showValues":"Show values",
    "radar.showLegend":"Show legend",
    "radar.showAxisLabels":"Show axis labels",
    "radar.fillOpacity":"Fill opacity"
  }
};

const KEY="statsMakerV2Language";
let language=localStorage.getItem(KEY)||((navigator.language||"ja").toLowerCase().startsWith("ja")?"ja":"en");

function t(key,vars={}){
  let s=(STRINGS[language]&&STRINGS[language][key])||STRINGS.ja[key]||key;
  Object.entries(vars).forEach(([k,v])=>s=s.replaceAll(`{${k}}`,String(v)));
  return s;
}
function getLanguage(){return language}
function setLanguage(next){
  language=next==="en"?"en":"ja";
  localStorage.setItem(KEY,language);
  applyI18n();
}
function toggleLanguage(){
  setLanguage(language==="ja"?"en":"ja");
}
function applyI18n(root=document){
  root.querySelectorAll("[data-i18n]").forEach(el=>{
    el.textContent=t(el.dataset.i18n);
  });
  document.documentElement.lang=language;
}

Object.assign(__exports,{t,getLanguage,setLanguage,toggleLanguage,applyI18n});

});
__define("core/images.js",function(__require,__exports,__module){
"use strict";
const DB_NAME="statsMakerV2Assets";
const DB_VERSION=1;
const STORE="images";

let dbPromise=null;
const objectUrlCache=new Map();

function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        db.createObjectStore(STORE,{keyPath:"id"});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

function uid(){
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
}

function fileToBitmap(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror=()=>{
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    img.src=url;
  });
}

function canvasToBlob(canvas,type="image/jpeg",quality=.86){
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>{
      if(blob)resolve(blob);
      else reject(new Error("Image compression failed"));
    },type,quality);
  });
}

async function optimizeImageFile(file,{
  maxDimension=1200,
  quality=.86
}={}){
  if(!file || !file.type?.startsWith("image/")){
    throw new Error("Please choose an image file.");
  }

  const img=await fileToBitmap(file);
  const originalWidth=img.naturalWidth||img.width;
  const originalHeight=img.naturalHeight||img.height;
  const scale=Math.min(1,maxDimension/Math.max(originalWidth,originalHeight));
  const width=Math.max(1,Math.round(originalWidth*scale));
  const height=Math.max(1,Math.round(originalHeight*scale));

  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(img,0,0,width,height);

  const preserveAlpha=file.type==="image/png" || file.type==="image/webp";
  let blob;
  if(preserveAlpha){
    blob=await canvasToBlob(canvas,"image/webp",quality);
  }else{
    blob=await canvasToBlob(canvas,"image/jpeg",quality);
  }

  return {
    blob,
    width,
    height,
    originalWidth,
    originalHeight,
    sourceName:file.name||"pasted-image",
    mime:blob.type
  };
}

async function saveImageFile(file,options={}){
  const optimized=await optimizeImageFile(file,options);
  const id=uid();
  const record={
    id,
    blob:optimized.blob,
    width:optimized.width,
    height:optimized.height,
    originalWidth:optimized.originalWidth,
    originalHeight:optimized.originalHeight,
    sourceName:optimized.sourceName,
    mime:optimized.mime,
    createdAt:new Date().toISOString()
  };

  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("Image save failed"));
    tx.onabort=()=>reject(tx.error||new Error("Image save aborted"));
  });

  return {
    id,
    width:record.width,
    height:record.height,
    sourceName:record.sourceName,
    mime:record.mime
  };
}

async function getImageRecord(id){
  if(!id)return null;
  const db=await openDB();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error||new Error("Image load failed"));
  });
}

async function getImageUrl(id){
  if(!id)return null;
  if(objectUrlCache.has(id))return objectUrlCache.get(id);

  const record=await getImageRecord(id);
  if(!record?.blob)return null;

  const url=URL.createObjectURL(record.blob);
  objectUrlCache.set(id,url);
  return url;
}

async function deleteImage(id){
  if(!id)return;
  const cached=objectUrlCache.get(id);
  if(cached){
    URL.revokeObjectURL(cached);
    objectUrlCache.delete(id);
  }

  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("Image delete failed"));
  });
}

async function cloneImage(id){
  if(!id)return null;
  const record=await getImageRecord(id);
  if(!record?.blob)return null;

  const newId=uid();
  const copy={...record,id:newId,createdAt:new Date().toISOString()};
  const db=await openDB();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(copy);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error("Image clone failed"));
  });
  return newId;
}

function revokeObjectUrls(){
  for(const url of objectUrlCache.values())URL.revokeObjectURL(url);
  objectUrlCache.clear();
}

Object.assign(__exports,{optimizeImageFile,saveImageFile,getImageRecord,getImageUrl,deleteImage,cloneImage,revokeObjectUrls});

});
__define("core/import.js",function(__require,__exports,__module){
"use strict";

function detectDelimiter(text){
  const first=(text||"").split(/\r?\n/).find(line=>line.trim())||"";
  const tabs=(first.match(/\t/g)||[]).length;
  const commas=(first.match(/,/g)||[]).length;
  const semis=(first.match(/;/g)||[]).length;
  if(tabs>=commas && tabs>=semis && tabs>0)return "\t";
  if(semis>commas && semis>0)return ";";
  return ",";
}

function parseDelimitedLine(line,delimiter){
  const out=[];
  let current="";
  let quoted=false;

  for(let i=0;i<line.length;i++){
    const ch=line[i];

    if(ch === '"'){
      if(quoted && line[i+1] === '"'){
        current+='"';
        i++;
      }else{
        quoted=!quoted;
      }
      continue;
    }

    if(ch===delimiter && !quoted){
      out.push(current);
      current="";
      continue;
    }

    current+=ch;
  }

  out.push(current);
  return out.map(v=>v.trim());
}

function parseTableText(text){
  const clean=String(text||"")
    .replace(/^\uFEFF/,"")
    .replace(/\r\n/g,"\n")
    .replace(/\r/g,"\n")
    .trim();

  if(!clean)return {rows:[],delimiter:""};

  const delimiter=detectDelimiter(clean);
  const lines=clean.split("\n").filter(line=>line.trim().length>0);
  const rows=lines.map(line=>parseDelimitedLine(line,delimiter));

  return {rows,delimiter};
}

const HEADER_ALIASES={
  ranking:{
    name:["name","player","item","対象","名前","選手","商品","チーム"],
    value:["value","score","points","pts","得点","点数","値","評価"],
    category:["category","club","team","所属","カテゴリ","カテゴリー","クラブ"],
    note:["note","memo","comment","補足","メモ","コメント"]
  },
  quadrant:{
    name:["name","player","item","対象","名前","選手","商品","チーム"],
    x:["x","xvalue","x value","x値","横軸"],
    y:["y","yvalue","y value","y値","縦軸"],
    category:["category","club","team","所属","カテゴリ","カテゴリー","クラブ"]
  },
  stats:{
    label:["label","stat","metric","項目","能力","指標"],
    value:["value","score","points","pts","値","点数","評価"]
  }
};

function normalizeHeader(s){
  return String(s||"")
    .trim()
    .toLowerCase()
    .replace(/\s+/g," ");
}

function findHeaderIndex(headers,aliases){
  const normalized=headers.map(normalizeHeader);
  for(const alias of aliases){
    const idx=normalized.indexOf(normalizeHeader(alias));
    if(idx>=0)return idx;
  }
  return -1;
}

function looksNumeric(v){
  if(v===null || v===undefined || String(v).trim()==="")return false;
  const n=Number(String(v).replace(/,/g,""));
  return Number.isFinite(n);
}

function hasLikelyHeader(rows,kind){
  if(rows.length<2)return false;
  const first=rows[0];
  const aliases=HEADER_ALIASES[kind]||{};
  const headerWords=Object.values(aliases).flat().map(normalizeHeader);

  const firstHasHeaderWord=first.some(v=>headerWords.includes(normalizeHeader(v)));
  if(firstHasHeaderWord)return true;

  const second=rows[1];
  // Generic fallback: if first row has nonnumeric tokens where second row is numeric, likely header.
  for(let i=0;i<Math.min(first.length,second.length);i++){
    if(!looksNumeric(first[i]) && looksNumeric(second[i]))return true;
  }
  return false;
}

function toNumber(v,fallback=0){
  const raw=String(v??"").trim().replace(/,/g,"");
  const n=Number(raw);
  return Number.isFinite(n)?n:fallback;
}

function mapRankingRows(rows){
  if(!rows.length)return [];
  const header=hasLikelyHeader(rows,"ranking");
  const headers=header?rows[0]:[];
  const body=header?rows.slice(1):rows;

  let nameIdx=header?findHeaderIndex(headers,HEADER_ALIASES.ranking.name):0;
  let valueIdx=header?findHeaderIndex(headers,HEADER_ALIASES.ranking.value):1;
  let categoryIdx=header?findHeaderIndex(headers,HEADER_ALIASES.ranking.category):2;
  let noteIdx=header?findHeaderIndex(headers,HEADER_ALIASES.ranking.note):3;

  if(nameIdx<0)nameIdx=0;
  if(valueIdx<0)valueIdx=1;

  return body
    .filter(r=>r.some(v=>String(v||"").trim()))
    .map(r=>({
      name:String(r[nameIdx]??"").trim()||"Untitled",
      value:toNumber(r[valueIdx],0),
      category:categoryIdx>=0?String(r[categoryIdx]??"").trim():"",
      note:noteIdx>=0?String(r[noteIdx]??"").trim():""
    }));
}

function mapQuadrantRows(rows){
  if(!rows.length)return [];
  const header=hasLikelyHeader(rows,"quadrant");
  const headers=header?rows[0]:[];
  const body=header?rows.slice(1):rows;

  let nameIdx=header?findHeaderIndex(headers,HEADER_ALIASES.quadrant.name):0;
  let xIdx=header?findHeaderIndex(headers,HEADER_ALIASES.quadrant.x):1;
  let yIdx=header?findHeaderIndex(headers,HEADER_ALIASES.quadrant.y):2;
  let categoryIdx=header?findHeaderIndex(headers,HEADER_ALIASES.quadrant.category):3;

  if(nameIdx<0)nameIdx=0;
  if(xIdx<0)xIdx=1;
  if(yIdx<0)yIdx=2;

  return body
    .filter(r=>r.some(v=>String(v||"").trim()))
    .map(r=>({
      name:String(r[nameIdx]??"").trim()||"Untitled",
      x:toNumber(r[xIdx],0),
      y:toNumber(r[yIdx],0),
      category:categoryIdx>=0?String(r[categoryIdx]??"").trim():""
    }));
}

function mapStatRows(rows){
  if(!rows.length)return [];
  const header=hasLikelyHeader(rows,"stats");
  const headers=header?rows[0]:[];
  const body=header?rows.slice(1):rows;

  let labelIdx=header?findHeaderIndex(headers,HEADER_ALIASES.stats.label):0;
  let valueIdx=header?findHeaderIndex(headers,HEADER_ALIASES.stats.value):1;

  if(labelIdx<0)labelIdx=0;
  if(valueIdx<0)valueIdx=1;

  return body
    .filter(r=>r.some(v=>String(v||"").trim()))
    .map(r=>({
      label:String(r[labelIdx]??"").trim()||"STAT",
      value:toNumber(r[valueIdx],0)
    }));
}

function previewRows(rows,limit=6){
  return rows.slice(0,limit);
}


function mapRadarMatrix(rows){
  if(!rows.length)return {axes:[],series:[]};

  const first=rows[0];
  const firstToken=normalizeHeader(first[0]||"");
  const headerWords=["axis","metric","stat","attribute","項目","能力","指標"];
  const likelyHeader=
    rows.length>1 &&
    (
      headerWords.includes(firstToken) ||
      (first.length>=2 && !looksNumeric(first[1]) && rows[1] && looksNumeric(rows[1][1]))
    );

  const body=likelyHeader?rows.slice(1):rows;
  const seriesNames=likelyHeader
    ? first.slice(1).map((v,i)=>String(v||`Series ${i+1}`).trim()||`Series ${i+1}`)
    : ["Series 1"];

  const axes=[];
  const series=seriesNames.map((name,i)=>({
    name,
    color:["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"][i%6],
    values:[]
  }));

  body
    .filter(r=>r.some(v=>String(v||"").trim()))
    .slice(0,12)
    .forEach((r,rowIndex)=>{
      const label=String(r[0]??`A${rowIndex+1}`).trim()||`A${rowIndex+1}`;
      const numericValues=(likelyHeader?r.slice(1):[r[1]]).map(v=>toNumber(v,0));
      const max=Math.max(100,...numericValues.map(v=>Math.ceil(v/10)*10));
      axes.push({label,max});

      series.forEach((s,i)=>{
        s.values.push(toNumber(likelyHeader?r[i+1]:r[1],0));
      });
    });

  return {axes,series};
}


function mapRangeRows(rows){
  if(!rows.length)return [];
  const first=rows[0].map(normalizeHeader);
  const header=first.some(v=>["name","名前","item","対象","value a","valuea","before","a"].includes(v));
  const body=header?rows.slice(1):rows;
  return body.filter(r=>r.some(v=>String(v||"").trim())).map(r=>({
    name:String(r[0]??"").trim()||"Untitled",
    value:toNumber(r[1],0),
    value2:toNumber(r[2],0)
  }));
}
function mapRingRows(rows){
  if(!rows.length)return [];
  const first=rows[0].map(normalizeHeader);
  const header=first.some(v=>["label","name","項目","名前"].includes(v));
  const body=header?rows.slice(1):rows;
  return body.filter(r=>r.some(v=>String(v||"").trim())).map(r=>({
    label:String(r[0]??"").trim()||"Metric",
    value:toNumber(r[1],0),
    max:Math.max(1,toNumber(r[2],100)),
    unit:String(r[3]??"").trim()
  }));
}
function mapWaffleRows(rows){
  if(!rows.length)return [];
  const first=rows[0].map(normalizeHeader);
  const header=first.some(v=>["label","name","category","項目","名前","カテゴリ"].includes(v));
  const body=header?rows.slice(1):rows;
  return body.filter(r=>r.some(v=>String(v||"").trim())).map(r=>({
    label:String(r[0]??"").trim()||"Category",
    value:toNumber(r[1],0)
  }));
}
function mapHeatmapMatrix(rows){
  if(rows.length<2)return {columns:[],rows:[]};
  const columns=(rows[0].slice(1)||[]).map((v,i)=>String(v||`C${i+1}`).trim()||`C${i+1}`);
  const outRows=rows.slice(1).filter(r=>r.some(v=>String(v||"").trim())).map((r,i)=>({
    name:String(r[0]??`Row ${i+1}`).trim()||`Row ${i+1}`,
    values:columns.map((_,j)=>toNumber(r[j+1],0))
  }));
  return {columns,rows:outRows};
}

Object.assign(__exports,{parseTableText,mapRankingRows,mapQuadrantRows,mapStatRows,previewRows,mapRadarMatrix,mapRangeRows,mapRingRows,mapWaffleRows,mapHeatmapMatrix});

});
__define("core/project.js",function(__require,__exports,__module){
"use strict";
const SCHEMA_VERSION=2;

const THEMES={
  dark:{id:"dark",bg:"#10192B",surface:"#17243A",text:"#F4F7FC",muted:"#9EADC1",accent:"#6F9CFF",border:"#2C405E"},
  light:{id:"light",bg:"#F3F5F8",surface:"#FFFFFF",text:"#162034",muted:"#68758A",accent:"#315FDB",border:"#D5DBE4"},
  black:{id:"black",bg:"#050505",surface:"#101010",text:"#FFFFFF",muted:"#A8A8A8",accent:"#F0B84F",border:"#2A2A2A"},
  sports:{id:"sports",bg:"#071B2B",surface:"#0D314A",text:"#F7FBFF",muted:"#91B6CB",accent:"#35D07F",border:"#1C5571"},
  neon:{id:"neon",bg:"#080A16",surface:"#11152B",text:"#F7F9FF",muted:"#9DA6C3",accent:"#B673FF",border:"#2B3260"},
  pastel:{id:"pastel",bg:"#F7F0F4",surface:"#FFF9FC",text:"#463845",muted:"#877682",accent:"#E277A8",border:"#E2CBD6"}
};

const CANVAS_PRESETS={
  square:{width:1080,height:1080},
  portrait:{width:1080,height:1350},
  story:{width:1080,height:1920},
  landscape:{width:1600,height:900}
};

function uid(prefix="id"){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function base(type,title){
  const now=new Date().toISOString();
  return {
    id:uid("project"),
    schemaVersion:SCHEMA_VERSION,
    type,
    meta:{title,subtitle:"",language:"ja",createdAt:now,updatedAt:now},
    canvas:{preset:"square",width:1080,height:1080,transparent:false},
    style:{
      theme:"dark",
      background:THEMES.dark.bg,
      surface:THEMES.dark.surface,
      primary:THEMES.dark.text,
      secondary:THEMES.dark.muted,
      accent:THEMES.dark.accent,
      border:THEMES.dark.border,
      typography:{fontFamily:"system-ui",titleScale:1,bodyScale:1,weight:700,align:"left"}
    },
    data:{},
    settings:{},
    publish:{cloudId:null,visibility:"private",publishedAt:null}
  };
}

function createRankingProject(){
  const p=base("ranking-card","ランキング");
  p.meta.subtitle="総合ランキング";
  p.data.items=[
    {id:uid("item"),name:"対象A",value:92,note:"",category:"",imageRef:null,imageShape:"circle",color:null,enabled:true},
    {id:uid("item"),name:"対象B",value:86,note:"",category:"",imageRef:null,imageShape:"circle",color:null,enabled:true},
    {id:uid("item"),name:"対象C",value:80,note:"",category:"",imageRef:null,imageShape:"circle",color:null,enabled:true},
    {id:uid("item"),name:"対象D",value:74,note:"",category:"",imageRef:null,imageShape:"circle",color:null,enabled:true},
    {id:uid("item"),name:"対象E",value:69,note:"",category:"",imageRef:null,imageShape:"circle",color:null,enabled:true}
  ];
  p.settings={
    template:"sports",
    unit:"PTS",
    topN:5,
    sort:"manual",
    showRank:true,
    showNote:true,
    showCategory:true,
    highlightTop3:true,
    showBars:true,
    headerLabel:"総合ランキング",
    density:"comfortable",
    tieMode:"competition"
  };
  return p;
}

function createStatCardProject(){
  const p=base("stat-card","対象A");
  p.meta.subtitle="評価サマリー";
  p.data={
    name:"対象A",
    subtitle:"",
    overall:94,
    imageRef:null,
    imageShape:"rounded",
    team:"",
    tier:"S",
    stats:[
      {id:uid("stat"),label:"評価1",value:92},
      {id:uid("stat"),label:"評価2",value:91},
      {id:uid("stat"),label:"評価3",value:88},
      {id:uid("stat"),label:"評価4",value:95},
      {id:uid("stat"),label:"評価5",value:61},
      {id:uid("stat"),label:"評価6",value:84}
    ]
  };
  p.settings={template:"sports",maxStats:12};
  return p;
}

function createQuadrantProject(){
  const p=base("quadrant","2軸比較");
  p.meta.subtitle="評価1 × 評価2";
  p.data.items=[
    {id:uid("item"),name:"対象A",x:82,y:88,category:"",imageRef:null,imageShape:"circle",enabled:true},
    {id:uid("item"),name:"対象B",x:34,y:76,category:"",imageRef:null,imageShape:"circle",enabled:true},
    {id:uid("item"),name:"対象C",x:75,y:32,category:"",imageRef:null,imageShape:"circle",enabled:true},
    {id:uid("item"),name:"対象D",x:28,y:26,category:"",imageRef:null,imageShape:"circle",enabled:true}
  ];
  p.settings={
    xAxis:{label:"評価1",min:0,max:100,split:50},
    yAxis:{label:"評価2",min:0,max:100,split:50},
    quadrants:{topLeft:"Technical",topRight:"Superstar",bottomLeft:"Specialist",bottomRight:"Physical"},
    markerMode:"dot"
  };
  return p;
}


function createBarProject(){
  const p=base("bar","数値比較");
  p.meta.subtitle="比較";
  p.data.items=[
    {id:uid("item"),name:"対象A",value:92,category:"",enabled:true},
    {id:uid("item"),name:"対象B",value:86,category:"",enabled:true},
    {id:uid("item"),name:"対象C",value:80,category:"",enabled:true},
    {id:uid("item"),name:"対象D",value:74,category:"",enabled:true},
    {id:uid("item"),name:"対象E",value:69,category:"",enabled:true}
  ];
  p.settings={
    unit:"PTS",
    orientation:"horizontal",
    showValues:true,
    showCategory:true,
    showGrid:true,
    autoMax:true,
    max:100,
    sort:"manual",
    topN:10,
    barRadius:14
  };
  return p;
}

function createRadarProject(){
  const p=base("radar","レーダー比較");
  p.meta.subtitle="評価項目比較";
  p.data={
    axes:[
      {id:uid("axis"),label:"評価1",max:100},
      {id:uid("axis"),label:"評価2",max:100},
      {id:uid("axis"),label:"評価3",max:100},
      {id:uid("axis"),label:"評価4",max:100},
      {id:uid("axis"),label:"評価5",max:100},
      {id:uid("axis"),label:"評価6",max:100}
    ],
    series:[
      {id:uid("series"),name:"対象A",color:"#6F9CFF",values:[92,91,88,95,61,84]},
      {id:uid("series"),name:"対象B",color:"#35D07F",values:[86,94,83,89,72,90]}
    ]
  };
  p.settings={
    gridLevels:5,
    showValues:false,
    showLegend:true,
    showAxisLabels:true,
    fillOpacity:0.18,
    strokeWidth:4
  };
  return p;
}


function createDotProject(){
  const p=base("dot","ドット比較");
  p.meta.subtitle="総合評価";
  p.data.items=[
    {id:uid("item"),name:"対象A",value:92,category:"",enabled:true},
    {id:uid("item"),name:"対象B",value:86,category:"",enabled:true},
    {id:uid("item"),name:"対象C",value:80,category:"",enabled:true},
    {id:uid("item"),name:"対象D",value:74,category:"",enabled:true}
  ];
  p.settings={unit:"PTS",min:0,max:100,autoRange:false,showValues:true,showGrid:true};
  return p;
}

function createRingProject(){
  const p=base("ring","評価項目");
  p.meta.subtitle="項目別評価";
  p.data.items=[
    {id:uid("item"),label:"評価1",value:82,max:100,unit:"%"},
    {id:uid("item"),label:"評価2",value:74,max:100,unit:"%"},
    {id:uid("item"),label:"評価3",value:91,max:100,unit:""}
  ];
  p.settings={style:"thick",columns:3,showPercent:true};
  return p;
}

function createTierProject(){
  const p=base("tier-list","Tier List");
  p.meta.subtitle="評価分類";
  p.data={
    tiers:[
      {id:uid("tier"),label:"S",min:90,max:100},
      {id:uid("tier"),label:"A",min:80,max:89},
      {id:uid("tier"),label:"B",min:70,max:79},
      {id:uid("tier"),label:"C",min:60,max:69},
      {id:uid("tier"),label:"D",min:0,max:59}
    ],
    items:[
      {id:uid("item"),name:"対象A",value:94,tier:"S"},
      {id:uid("item"),name:"対象B",value:87,tier:"A"},
      {id:uid("item"),name:"対象C",value:79,tier:"B"},
      {id:uid("item"),name:"対象D",value:68,tier:"C"},
      {id:uid("item"),name:"対象E",value:55,tier:"D"}
    ]
  };
  p.settings={mode:"auto",showScore:true};
  return p;
}

function createHeatmapProject(){
  const p=base("heatmap","Heatmap");
  p.meta.subtitle="対象 × 評価項目";
  p.data={
    columns:[
      {id:uid("column"),label:"評価1"},
      {id:uid("column"),label:"評価2"},
      {id:uid("column"),label:"評価3"},
      {id:uid("column"),label:"評価5"}
    ],
    rows:[
      {id:uid("row"),name:"対象A",values:[92,87,80,42]},
      {id:uid("row"),name:"対象B",values:[83,91,86,50]},
      {id:uid("row"),name:"対象C",values:[77,75,94,68]},
      {id:uid("row"),name:"対象D",values:[69,82,72,90]}
    ]
  };
  p.settings={min:0,max:100,showValues:true,decimals:0};
  return p;
}

function createScatterProject(){
  const p=base("scatter","散布図");
  p.meta.subtitle="評価1 × 評価2";
  p.data.items=[
    {id:uid("item"),name:"A",x:24,y:88,category:"Alpha"},
    {id:uid("item"),name:"B",x:42,y:92,category:"Beta"},
    {id:uid("item"),name:"C",x:35,y:73,category:"Alpha"},
    {id:uid("item"),name:"D",x:68,y:95,category:"Gamma"},
    {id:uid("item"),name:"E",x:55,y:80,category:"Beta"}
  ];
  p.settings={
    xAxis:{label:"評価1",min:0,max:80},
    yAxis:{label:"評価2",min:60,max:100},
    showAverage:true,
    showTrend:true,
    showLabels:true
  };
  return p;
}

function createRangeProject(){
  const p=base("range","2項目比較");
  p.meta.subtitle="評価項目間の差";
  p.data.items=[
    {id:uid("item"),name:"対象A",value:72,value2:91},
    {id:uid("item"),name:"対象B",value:84,value2:88},
    {id:uid("item"),name:"対象C",value:78,value2:69},
    {id:uid("item"),name:"対象D",value:65,value2:82}
  ];
  p.settings={labelA:"評価1",labelB:"評価2",unit:"",autoRange:true,min:0,max:100,showDiff:true};
  return p;
}

function createWaffleProject(){
  const p=base("waffle","Outcome Share");
  p.meta.subtitle="100-CELL BREAKDOWN";
  p.data.categories=[
    {id:uid("item"),label:"Win",value:55},
    {id:uid("item"),label:"Draw",value:20},
    {id:uid("item"),label:"Loss",value:25}
  ];
  p.settings={cells:100,columns:10,unit:"%",showLegend:true};
  return p;
}


function createStatBoardProject(){
  const p=base("stat-board","STAT BOARD");
  p.meta.subtitle="評価サマリー";
  p.canvas={preset:"portrait",width:1080,height:1350,transparent:false};
  p.data={
    blocks:[
      {id:uid("block"),type:"hero",span:2,title:"対象A",subtitle:"",value:"96"},
      {id:uid("block"),type:"number",span:1,label:"Goals",value:"32"},
      {id:uid("block"),type:"number",span:1,label:"Assists",value:"18"},
      {id:uid("block"),type:"ring",span:1,label:"評価1",value:72,max:100},
      {id:uid("block"),type:"progress",span:1,label:"評価3",value:88,max:100},
      {id:uid("block"),type:"text",span:2,title:"Season Note",text:"Elite production with strong all-round contribution."}
    ]
  };
  p.settings={columns:2,gap:"medium"};
  return p;
}

function createProject(type){
  if(type==="ranking-card")return createRankingProject();
  if(type==="stat-card")return createStatCardProject();
  if(type==="quadrant")return createQuadrantProject();
  if(type==="bar")return createBarProject();
  if(type==="radar")return createRadarProject();
  if(type==="dot")return createDotProject();
  if(type==="ring")return createRingProject();
  if(type==="tier-list")return createTierProject();
  if(type==="heatmap")return createHeatmapProject();
  if(type==="scatter")return createScatterProject();
  if(type==="range")return createRangeProject();
  if(type==="waffle")return createWaffleProject();
  if(type==="stat-board")return createStatBoardProject();
  throw new Error(`Unknown visualization: ${type}`);
}

function applyTheme(project,themeId){
  const th=THEMES[themeId]||THEMES.dark;
  project.style.theme=th.id;
  project.style.background=th.bg;
  project.style.surface=th.surface;
  project.style.primary=th.text;
  project.style.secondary=th.muted;
  project.style.accent=th.accent;
  project.style.border=th.border;
}

function applyCanvasPreset(project,presetId){
  const p=CANVAS_PRESETS[presetId];
  if(!p)return;
  project.canvas.preset=presetId;
  project.canvas.width=p.width;
  project.canvas.height=p.height;
}

function cloneProject(project){
  const c=structuredClone(project);
  c.id=uid("project");
  c.meta.title=`${project.meta.title} Copy`;
  c.meta.createdAt=new Date().toISOString();
  c.meta.updatedAt=c.meta.createdAt;
  c.publish={cloudId:null,visibility:"private",publishedAt:null};
  return c;
}

function newItemId(){return uid("item")}
function newStatId(){return uid("stat")}
function newAxisId(){return uid("axis")}
function newSeriesId(){return uid("series")}

Object.assign(__exports,{createRankingProject,createStatCardProject,createQuadrantProject,createBarProject,createRadarProject,createDotProject,createRingProject,createTierProject,createHeatmapProject,createScatterProject,createRangeProject,createWaffleProject,createStatBoardProject,createProject,applyTheme,applyCanvasPreset,cloneProject,newItemId,newStatId,newAxisId,newSeriesId,SCHEMA_VERSION,THEMES,CANVAS_PRESETS});

});
__define("core/source-sync.js",function(__require,__exports,__module){
"use strict";
const BASE_STORAGE_KEY="statsMakerV014Library";

function num(v){
  if(v===null || v===undefined || String(v).trim()==="")return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
}

function normalizeMetricKey(sheet,value){
  if(value==="avg" || value===null || value===undefined)return "avg";
  if(typeof value==="string" && value.startsWith("c:")){
    const i=Number(value.slice(2));
    return Number.isInteger(i)?`c:${i}`:"avg";
  }
  const i=Number(value);
  return Number.isInteger(i)?`c:${i}`:"avg";
}

function readBaseLibrary(){
  try{
    const raw=localStorage.getItem(BASE_STORAGE_KEY);
    const parsed=raw?JSON.parse(raw):null;
    return parsed && Array.isArray(parsed.sheets)?parsed:null;
  }catch{
    return null;
  }
}

function getSourceSheet(project,explicitSheet=null){
  if(explicitSheet)return explicitSheet;

  const library=readBaseLibrary();
  if(!library?.sheets?.length)return null;

  const wanted=project?.settings?.sourceSheetId;
  return library.sheets.find(s=>s.id===wanted)
    || library.sheets.find(s=>s.id===library.activeId)
    || library.sheets[0]
    || null;
}

function getSourceModel(project,explicitSheet=null){
  const sheet=getSourceSheet(project,explicitSheet);
  if(!sheet)return null;

  const scale=sheet.scale===10?10:100;
  const weighted=!!sheet.weighted;

  // A criterion is active when:
  // 1) it has a non-empty label, and
  // 2) it is not an untouched auto-generated trailing criterion (評価N)
  //    with no numeric values at all.
  const rawColumns=(sheet.cols||[]).map((c,rawIndex)=>{
    const label=String(c??"").trim();
    const hasValue=(sheet.rows||[]).some(row=>Number.isFinite(num(row?.scores?.[rawIndex])));
    const untouchedDefault=/^評価\d+$/.test(label) && !hasValue;
    return {rawIndex,label,hasValue,untouchedDefault};
  });

  const activeColumns=rawColumns.filter(col=>col.label && !col.untouchedDefault);
  const criteria=activeColumns.map(col=>col.label);
  const rawToFiltered=new Map(activeColumns.map((col,i)=>[col.rawIndex,i]));

  const weights=activeColumns.map(col=>{
    const w=Number(sheet.weights?.[col.rawIndex]);
    return Number.isFinite(w)&&w>=0?w:1;
  });

  // Only named rows become extension targets.
  const rows=(sheet.rows||[]).map((row,rawIndex)=>{
    const name=String(row?.name??"").trim();
    if(!name)return null;
    return {
      rawIndex,
      name,
      note:String(row?.note??"").trim(),
      image:typeof row?.image==="string"?row.image:"",
      scores:activeColumns.map(col=>num(row?.scores?.[col.rawIndex]))
    };
  }).filter(Boolean);

  const average=row=>{
    let total=0,den=0;
    row.scores.forEach((score,ci)=>{
      if(!Number.isFinite(score))return;
      const w=weighted?weights[ci]:1;
      total+=score*w;
      den+=w;
    });
    return den?Math.round(total/den*10)/10:0;
  };

  let metricKey="avg";
  if(sheet.rankMetric!=="avg" && sheet.rankMetric!==null && sheet.rankMetric!==undefined){
    const rawMetric=Number(String(sheet.rankMetric).replace("c:",""));
    const filtered=rawToFiltered.get(rawMetric);
    if(Number.isInteger(filtered))metricKey=`c:${filtered}`;
  }

  const metricLabel=key=>{
    if(key==="avg")return "総合平均";
    const ci=Number(String(key).replace("c:",""));
    return criteria[ci]||`評価${ci+1}`;
  };

  const metricValue=(row,key)=>{
    if(key==="avg")return average(row);
    const ci=Number(String(key).replace("c:",""));
    const value=row?.scores?.[ci];
    return Number.isFinite(value)?value:0;
  };

  const criterionMean=ci=>{
    const values=rows.map(r=>r.scores[ci]).filter(Number.isFinite);
    return values.length
      ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10
      : 0;
  };

  const validByRaw=new Map(rows.map(r=>[r.rawIndex,r]));
  const compare=(sheet.compare||[])
    .map(Number)
    .filter(Number.isInteger)
    .filter(i=>validByRaw.has(i));

  return {
    sheet,
    criteria,
    activeColumns,
    scale,
    rows,
    average,
    metricKey,
    metricLabel,
    metricValue,
    criterionMean,
    compare
  };
}

function getMetricOptions(model){
  if(!model)return [];
  return [
    {value:"avg",label:"総合平均"},
    ...model.criteria.map((label,i)=>({value:`c:${i}`,label}))
  ];
}

function getCriterionOptions(model){
  if(!model)return [];
  return model.criteria.map((label,i)=>({value:i,label}));
}

function getSubjectOptions(model){
  if(!model)return [];
  return model.rows.map(r=>({value:r.rawIndex,label:r.name}));
}

function sourceRow(model,rawIndex){
  return model.rows.find(r=>r.rawIndex===Number(rawIndex))
    || model.rows[0]
    || null;
}

function criterionIndex(model,value,fallback=0){
  const i=Number(value);
  if(Number.isInteger(i) && i>=0 && i<model.criteria.length)return i;
  return Math.max(0,Math.min(model.criteria.length-1,fallback));
}

function setSourceBasics(project,model){
  project.settings.sourceLinked=true;
  project.settings.sourceSheetId=model.sheet.id;
  project.meta.title=String(model.sheet.title||"Stats Maker").trim()||"Stats Maker";
  project.meta.subtitle=String(model.sheet.desc||"").trim();
}

function syncMetricItems(project,model,key){
  key=normalizeMetricKey(model.sheet,key);
  const label=model.metricLabel(key);
  project.settings.sourceMetricKey=key;

  project.data.items=model.rows.map(r=>({
    id:`src_${r.rawIndex}`,
    sourceRawIndex:r.rawIndex,
    name:r.name,
    value:model.metricValue(r,key),
    note:r.note,
    category:"",
    imageData:r.image,
    imageRef:null,
    imageShape:"circle",
    enabled:true
  }));

  if(project.type==="ranking-card"){
    project.data.items.sort((a,b)=>
      Number(b.value)-Number(a.value)
      || Number(a.sourceRawIndex)-Number(b.sourceRawIndex)
    );

    const currentTop=Number(project.settings.topN);
    project.settings.topN=Number.isFinite(currentTop)&&currentTop>0
      ? Math.min(20,Math.max(1,currentTop))
      : Math.min(20,Math.max(1,project.data.items.length));
    project.settings.unit="";
    project.settings.headerLabel=label;
    project.settings.showCategory=false;
    project.meta.subtitle=`${label}ランキング`;
  }else if(project.type==="bar"){
    const currentTop=Number(project.settings.topN);
    project.settings.topN=Number.isFinite(currentTop)&&currentTop>0
      ? Math.min(30,Math.max(1,currentTop))
      : Math.min(30,Math.max(1,project.data.items.length));
    project.settings.unit="";
    project.settings.showCategory=false;
    project.settings.autoMax=false;
    project.settings.max=model.scale;
    project.meta.subtitle=label;
  }else if(project.type==="dot"){
    project.settings.unit="";
    project.settings.min=0;
    project.settings.max=model.scale;
    project.settings.autoRange=false;
    project.meta.subtitle=label;
  }else if(project.type==="tier-list"){
    project.meta.subtitle=label;
    const cut=model.scale===10?[9,8,7,6]:[90,80,70,60];
    project.data.tiers=[
      {id:"tier_s",label:"S",min:cut[0],max:model.scale},
      {id:"tier_a",label:"A",min:cut[1],max:cut[0]-0.01},
      {id:"tier_b",label:"B",min:cut[2],max:cut[1]-0.01},
      {id:"tier_c",label:"C",min:cut[3],max:cut[2]-0.01},
      {id:"tier_d",label:"D",min:0,max:cut[3]-0.01}
    ];
    project.data.items=project.data.items.map(item=>({
      id:item.id,
      sourceRawIndex:item.sourceRawIndex,
      name:item.name,
      value:item.value,
      tier:""
    }));
    project.settings.mode="auto";
  }
}

function syncStatCard(project,model,rawIndex){
  const row=sourceRow(model,rawIndex);
  project.settings.sourceSubjectIndex=row?.rawIndex??null;
  project.data.name=row?.name||project.meta.title;
  project.data.subtitle=String(model.sheet.title||"");
  project.data.overall=row?model.average(row):0;
  project.data.team="";
  project.data.tier="";
  project.data.imageData=row?.image||"";
  project.data.imageRef=null;
  project.data.imageShape="rounded";
  project.data.stats=model.criteria
    .map((label,ci)=>({
      id:`stat_${ci}`,
      label,
      value:row?.scores?.[ci],
      ci
    }))
    .filter(stat=>Number.isFinite(stat.value))
    .slice(0,12)
    .map(({id,label,value})=>({id,label,value}));
  project.meta.title=row?.name||String(model.sheet.title||"Stats Maker");
  project.meta.subtitle="評価サマリー";
}

function syncXY(project,model,xValue,yValue){
  const xi=criterionIndex(model,xValue,0);
  let yi=criterionIndex(model,yValue,model.criteria.length>1?1:0);
  if(model.criteria.length>1 && yi===xi){
    yi=(xi+1)%model.criteria.length;
  }
  project.settings.sourceXIndex=xi;
  project.settings.sourceYIndex=yi;

  const xLabel=model.criteria[xi]||`評価${xi+1}`;
  const yLabel=model.criteria[yi]||`評価${yi+1}`;

  project.data.items=model.rows.map(r=>({
    id:`src_${r.rawIndex}`,
    sourceRawIndex:r.rawIndex,
    name:r.name,
    x:Number.isFinite(r.scores[xi])?r.scores[xi]:0,
    y:Number.isFinite(r.scores[yi])?r.scores[yi]:0,
    category:"",
    enabled:true,
    imageData:r.image,
    imageRef:null,
    imageShape:"circle"
  }));

  project.settings.xAxis={
    ...(project.settings.xAxis||{}),
    label:xLabel,min:0,max:model.scale,split:model.scale/2
  };
  project.settings.yAxis={
    ...(project.settings.yAxis||{}),
    label:yLabel,min:0,max:model.scale,split:model.scale/2
  };
  project.meta.subtitle=`${xLabel} × ${yLabel}`;

  if(project.type==="quadrant"){
    project.settings.quadrants={
      topLeft:`${yLabel}高 / ${xLabel}低`,
      topRight:`${xLabel}高 / ${yLabel}高`,
      bottomLeft:`${xLabel}低 / ${yLabel}低`,
      bottomRight:`${xLabel}高 / ${yLabel}低`
    };
  }
}

function syncRange(project,model,aValue,bValue){
  const ai=criterionIndex(model,aValue,0);
  let bi=criterionIndex(model,bValue,model.criteria.length>1?1:0);
  if(model.criteria.length>1 && bi===ai){
    bi=(ai+1)%model.criteria.length;
  }
  project.settings.sourceRangeA=ai;
  project.settings.sourceRangeB=bi;
  project.settings.labelA=model.criteria[ai]||`評価${ai+1}`;
  project.settings.labelB=model.criteria[bi]||`評価${bi+1}`;
  project.settings.min=0;
  project.settings.max=model.scale;
  project.settings.autoRange=false;
  project.meta.subtitle=`${project.settings.labelA} → ${project.settings.labelB}`;
  project.data.items=model.rows.map(r=>({
    id:`src_${r.rawIndex}`,
    sourceRawIndex:r.rawIndex,
    name:r.name,
    value:Number.isFinite(r.scores[ai])?r.scores[ai]:0,
    value2:Number.isFinite(r.scores[bi])?r.scores[bi]:0
  }));
}

function syncRing(project,model,rawIndex){
  const row=sourceRow(model,rawIndex);
  project.settings.sourceSubjectIndex=row?.rawIndex??null;
  project.data.items=model.criteria
    .map((label,ci)=>({
      id:`ring_${ci}`,
      label,
      value:row?.scores?.[ci],
      max:model.scale,
      unit:"",
      ci
    }))
    .filter(item=>Number.isFinite(item.value))
    .slice(0,6)
    .map(({id,label,value,max,unit})=>({id,label,value,max,unit}));
  project.meta.title=row?.name||String(model.sheet.title||"Stats Maker");
  project.meta.subtitle=row?String(model.sheet.title||""):"項目平均";
}

function syncRadar(project,model,rawIndices){
  const valid=new Set(model.rows.map(r=>r.rawIndex));
  let indices=Array.isArray(rawIndices)
    ? rawIndices.map(Number).filter(Number.isInteger).filter(i=>valid.has(i))
    : [];

  if(!indices.length){
    indices=model.compare.filter(i=>valid.has(i));
  }
  if(!indices.length){
    indices=model.rows.slice(0,Math.min(3,model.rows.length)).map(r=>r.rawIndex);
  }
  indices=[...new Set(indices)].slice(0,6);

  project.settings.sourceSeriesIndices=indices;

  const selectedRows=indices
    .map(rawIndex=>sourceRow(model,rawIndex))
    .filter(Boolean);

  // Drop only axes that have no score for every selected subject.
  const axisIndices=model.criteria
    .map((_,ci)=>ci)
    .filter(ci=>selectedRows.some(row=>Number.isFinite(row.scores[ci])))
    .slice(0,12);

  project.data.axes=axisIndices.map(ci=>({
    id:`axis_${ci}`,
    sourceCriterionIndex:ci,
    label:model.criteria[ci],
    max:model.scale
  }));

  const palette=["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];
  project.data.series=selectedRows.map((row,si)=>({
    id:`series_${row.rawIndex}`,
    sourceRawIndex:row.rawIndex,
    name:row.name,
    color:palette[si%palette.length],
    values:axisIndices.map(ci=>
      Number.isFinite(row.scores[ci])?row.scores[ci]:0
    )
  }));

  project.meta.subtitle=`${project.data.axes.length}項目比較`;
}

function syncSourceProject(project,changes={},explicitSheet=null){
  const model=getSourceModel(project,explicitSheet);
  if(!model)return project;

  setSourceBasics(project,model);

  const type=project.type;
  if(["ranking-card","bar","dot","tier-list"].includes(type)){
    const key=changes.metricKey
      ?? project.settings.sourceMetricKey
      ?? model.metricKey;
    syncMetricItems(project,model,key);
  }else if(type==="stat-card"){
    syncStatCard(
      project,model,
      changes.subjectIndex
        ?? project.settings.sourceSubjectIndex
        ?? model.rows[0]?.rawIndex
    );
  }else if(type==="quadrant"||type==="scatter"){
    syncXY(
      project,model,
      changes.xIndex
        ?? project.settings.sourceXIndex
        ?? 0,
      changes.yIndex
        ?? project.settings.sourceYIndex
        ?? (model.criteria.length>1?1:0)
    );
  }else if(type==="range"){
    syncRange(
      project,model,
      changes.aIndex
        ?? project.settings.sourceRangeA
        ?? 0,
      changes.bIndex
        ?? project.settings.sourceRangeB
        ?? (model.criteria.length>1?1:0)
    );
  }else if(type==="ring"){
    syncRing(
      project,model,
      changes.subjectIndex
        ?? project.settings.sourceSubjectIndex
        ?? model.rows[0]?.rawIndex
    );
  }else if(type==="radar"){
    syncRadar(
      project,model,
      changes.seriesIndices
        ?? project.settings.sourceSeriesIndices
        ?? model.compare
    );
  }
  return project;
}

Object.assign(__exports,{readBaseLibrary,getSourceSheet,getSourceModel,getMetricOptions,getCriterionOptions,getSubjectOptions,syncSourceProject});

});
__define("core/store.js",function(__require,__exports,__module){
"use strict";
const PROJECT_KEY="statsMakerV2Projects";
const PREF_KEY="statsMakerV2Preferences";

function parseProjects(){
  try{
    const raw=localStorage.getItem(PROJECT_KEY);
    const list=raw?JSON.parse(raw):[];
    return Array.isArray(list)?list:[];
  }catch{return []}
}

function listProjects(){
  return parseProjects().sort((a,b)=>(b.meta?.updatedAt||"").localeCompare(a.meta?.updatedAt||""));
}

function getProject(id){
  return parseProjects().find(p=>p.id===id)||null;
}

function saveProject(project){
  const list=parseProjects();
  const idx=list.findIndex(p=>p.id===project.id);
  const copy=structuredClone(project);
  copy.meta.updatedAt=new Date().toISOString();
  if(idx>=0)list[idx]=copy;
  else list.push(copy);
  localStorage.setItem(PROJECT_KEY,JSON.stringify(list));
  return copy;
}

function deleteProject(id){
  localStorage.setItem(PROJECT_KEY,JSON.stringify(parseProjects().filter(p=>p.id!==id)));
}

function getPreferences(){
  try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch{return {}}
}
function savePreferences(prefs){
  localStorage.setItem(PREF_KEY,JSON.stringify(prefs||{}));
}

Object.assign(__exports,{listProjects,getProject,saveProject,deleteProject,getPreferences,savePreferences});

});
__define("editor/data-import.js",function(__require,__exports,__module){
"use strict";

const { parseTableText, mapRankingRows, mapQuadrantRows, mapStatRows, mapRadarMatrix, mapRangeRows, mapRingRows, mapWaffleRows, mapHeatmapMatrix, previewRows }=__require("core/import.js");

function chooseCsvFile(){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.click();
  });
}

function mapperFor(kind){
  if(["ranking","bar","dot","tier"].includes(kind))return mapRankingRows;
  if(["quadrant","scatter"].includes(kind))return mapQuadrantRows;
  if(kind==="radar")return mapRadarMatrix;
  if(kind==="range")return mapRangeRows;
  if(kind==="ring")return mapRingRows;
  if(kind==="waffle")return mapWaffleRows;
  if(kind==="heatmap")return mapHeatmapMatrix;
  return mapStatRows;
}

function exampleFor(kind){
  if(kind==="ranking"){
    return `Name\tValue\tCategory\tNote
対象A\t92\t\tElite finisher
対象B\t86\t\tBreakout season
対象C\t80\t\tComplete creator`;
  }

  if(kind==="quadrant"){
    return `Name\tX\tY\tCategory
対象A\t82\t88\t
対象B\t34\t76\t
対象C\t75\t32\t`;
  }

  return `Label\tValue
評価1\t92
評価2\t91
評価3\t88
評価4\t95`;
}

function createDataImport({
  kind,
  onImport
}){
  const wrap=document.createElement("div");
  wrap.className="data-import";

  wrap.innerHTML=`
    <div class="data-import-head">
      <div>
        <div class="data-import-title">Paste / CSV</div>
        <div class="data-import-sub">Excel / Google Sheets compatible</div>
      </div>
      <button type="button" class="btn compact import-example">Example</button>
    </div>

    <textarea class="textarea import-text" spellcheck="false"></textarea>

    <div class="data-import-actions">
      <button type="button" class="btn import-csv">CSV / TSV</button>
      <button type="button" class="btn import-preview-btn">Preview</button>
    </div>

    <div class="import-preview hidden">
      <div class="import-preview-head">
        <span class="import-count"></span>
        <span class="import-delimiter"></span>
      </div>
      <div class="import-preview-table"></div>

      <div class="import-mode">
        <button type="button" data-mode="replace" class="active">Replace</button>
        <button type="button" data-mode="append">Append</button>
      </div>

      <button type="button" class="btn primary import-apply">Import</button>
    </div>

    <div class="import-status"></div>
  `;

  const ta=wrap.querySelector(".import-text");
  const previewBox=wrap.querySelector(".import-preview");
  const previewTable=wrap.querySelector(".import-preview-table");
  const count=wrap.querySelector(".import-count");
  const delim=wrap.querySelector(".import-delimiter");
  const status=wrap.querySelector(".import-status");

  let currentMapped=[];
  let mode="replace";

  ta.placeholder=exampleFor(kind);

  function setStatus(text,type=""){
    status.textContent=text||"";
    status.className=`import-status ${type}`;
  }

  function renderPreview(){
    const parsed=parseTableText(ta.value);
    currentMapped=mapperFor(kind)(parsed.rows);

    const importCount=kind==="radar"
      ? (currentMapped.axes?.length||0)
      : kind==="heatmap"
        ? (currentMapped.rows?.length||0)
        : currentMapped.length;

    if(!importCount){
      previewBox.classList.add("hidden");
      setStatus("No importable rows","warn");
      return;
    }

    previewBox.classList.remove("hidden");
    count.textContent=kind==="radar"
      ? `${currentMapped.axes.length} axes / ${currentMapped.series.length} series`
      : kind==="heatmap"
        ? `${currentMapped.rows.length} rows / ${currentMapped.columns.length} columns`
        : `${currentMapped.length} rows`;
    delim.textContent=parsed.delimiter==="\t"?"TSV":parsed.delimiter===";"?"CSV ;":"CSV";

    previewTable.innerHTML="";

    if(kind==="radar"){
      currentMapped.axes.slice(0,6).forEach((axis,index)=>{
        const line=document.createElement("div");
        line.className="import-preview-row";
        line.innerHTML=`
          <b>${index+1}</b>
          <span class="main"></span>
          <span class="value"></span>
        `;
        line.querySelector(".main").textContent=axis.label;
        line.querySelector(".value").textContent=currentMapped.series
          .map(s=>s.values[index])
          .join(" / ");
        previewTable.appendChild(line);
      });

      if(currentMapped.axes.length>6){
        const more=document.createElement("div");
        more.className="import-preview-more";
        more.textContent=`+ ${currentMapped.axes.length-6} more`;
        previewTable.appendChild(more);
      }
      setStatus("");
      return;
    }

    if(kind==="heatmap"){
      currentMapped.rows.slice(0,6).forEach((row,index)=>{
        const line=document.createElement("div");
        line.className="import-preview-row";
        line.innerHTML=`<b>${index+1}</b><span class="main"></span><span class="value"></span>`;
        line.querySelector(".main").textContent=row.name;
        line.querySelector(".value").textContent=row.values.slice(0,3).join(" / ");
        previewTable.appendChild(line);
      });
      setStatus("");
      return;
    }

    const preview=previewRows(currentMapped,6);

    preview.forEach((row,index)=>{
      const line=document.createElement("div");
      line.className="import-preview-row";

      if(kind==="ranking"){
        line.innerHTML=`
          <b>${index+1}</b>
          <span class="main"></span>
          <span class="value"></span>
        `;
        line.querySelector(".main").textContent=row.name;
        line.querySelector(".value").textContent=row.value;
      }else if(kind==="quadrant"){
        line.innerHTML=`
          <b>${index+1}</b>
          <span class="main"></span>
          <span class="value"></span>
        `;
        line.querySelector(".main").textContent=row.name;
        line.querySelector(".value").textContent=`${row.x}, ${row.y}`;
      }else{
        line.innerHTML=`
          <b>${index+1}</b>
          <span class="main"></span>
          <span class="value"></span>
        `;
        line.querySelector(".main").textContent=row.label;
        line.querySelector(".value").textContent=row.value;
      }

      previewTable.appendChild(line);
    });

    if(currentMapped.length>preview.length){
      const more=document.createElement("div");
      more.className="import-preview-more";
      more.textContent=`+ ${currentMapped.length-preview.length} more`;
      previewTable.appendChild(more);
    }

    setStatus("");
  }

  wrap.querySelector(".import-example").addEventListener("click",()=>{
    ta.value=exampleFor(kind);
    renderPreview();
  });

  wrap.querySelector(".import-preview-btn").addEventListener("click",renderPreview);

  wrap.querySelector(".import-csv").addEventListener("click",async()=>{
    const file=await chooseCsvFile();
    if(!file)return;

    try{
      ta.value=await file.text();
      renderPreview();
      setStatus(file.name,"ok");
    }catch(e){
      console.error(e);
      setStatus("Could not read file","error");
    }
  });

  wrap.querySelectorAll("[data-mode]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      mode=btn.dataset.mode;
      wrap.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b===btn));
    });
  });

  wrap.querySelector(".import-apply").addEventListener("click",()=>{
    const countNow=kind==="radar"
      ? (currentMapped?.axes?.length||0)
      : kind==="heatmap"
        ? (currentMapped?.rows?.length||0)
        : (currentMapped?.length||0);

    if(!countNow){
      renderPreview();
    }

    const finalCount=kind==="radar"
      ? (currentMapped?.axes?.length||0)
      : kind==="heatmap"
        ? (currentMapped?.rows?.length||0)
        : (currentMapped?.length||0);

    if(!finalCount)return;

    onImport?.(structuredClone(currentMapped),mode);
    setStatus(
      kind==="radar"
        ? `${currentMapped.axes.length} axes imported`
        : kind==="heatmap"
          ? `${currentMapped.rows.length} rows imported`
          : `${currentMapped.length} rows imported`,
      "ok"
    );
  });

  ta.addEventListener("paste",()=>{
    setTimeout(renderPreview,0);
  });

  return wrap;
}

Object.assign(__exports,{createDataImport});

});
__define("editor/editor.js",function(__require,__exports,__module){
"use strict";
const { t,getLanguage,toggleLanguage,applyI18n }=__require("core/i18n.js");
const { getProject,saveProject }=__require("core/store.js");
const { THEMES,CANVAS_PRESETS,applyTheme,applyCanvasPreset,newItemId,newStatId,newAxisId,newSeriesId }=__require("core/project.js");
const { History }=__require("core/history.js");
const { getVisualization }=__require("visualizations/registry.js");
const { exportPreview,exportProjectJSON,readProjectJSON,isIOS }=__require("core/export.js");
const { createImageManager }=__require("editor/image-editor.js");
const { createDataImport }=__require("editor/data-import.js");
const { createSpreadsheetEditor }=__require("editor/spreadsheet-editor.js");
const { getSourceModel,getMetricOptions,getCriterionOptions,getSubjectOptions,syncSourceProject }=__require("core/source-sync.js");

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const id=params.get("id");
let project=getProject(id);
if(!project){
  alert(getLanguage()==="ja"?"Projectが見つかりません":"Project not found");
  location.href="../index.html?extensions=1";
  throw new Error("Project not found");
}

const history=new History(project,50);
let activePanel="data";
let zoom=.55;
let zoomTouched=false;
let saveTimer=null;
let previewRenderToken=0;
let exportPreviewUrl=null;
let exportPreviewFile=null;
const sectionCollapseState=new Map();
const mobileQuery=window.matchMedia("(max-width:760px)");
let lastMobileMode=mobileQuery.matches;
let resizeTimer=null;

function current(){return history.present}

function mutate(fn,{historyCommit=true,panels=true}={}){
  const before=current();
  const oldCanvas=`${before.canvas.width}x${before.canvas.height}`;

  const next=structuredClone(before);
  fn(next);
  next.meta.updatedAt=new Date().toISOString();

  const newCanvas=`${next.canvas.width}x${next.canvas.height}`;
  project=historyCommit?history.commit(next):history.replace(next);

  queueSave();
  render({panels});

  if(!zoomTouched && oldCanvas!==newCanvas){
    requestAnimationFrame(()=>{
      fitZoomToStage();
      renderPreview();
    });
  }
}

function setSaveState(key,mode=""){
  const text=t(key);
  const desktop=$("saveState");
  const mobile=$("mobileSaveState");

  if(desktop){
    desktop.textContent=text;
    desktop.className=`save-state ${mode}`.trim();
  }

  if(mobile){
    mobile.textContent=text;
    mobile.className=`mobile-save-state ${mode}`.trim();
  }
}

function queueSave(){
  setSaveState("save.saving","saving");
  clearTimeout(saveTimer);

  saveTimer=setTimeout(()=>{
    try{
      project=saveProject(current());
      history.replace(project);
      setSaveState("save.saved");
      syncHistoryButtons();
    }catch(e){
      console.error(e);
      setSaveState("save.error","error");
    }
  },650);
}

function cssVars(){
  const p=current();
  return `
    --visual-bg:${p.canvas.transparent?"transparent":p.style.background};
    --visual-surface:${p.style.surface};
    --visual-text:${p.style.primary};
    --visual-muted:${p.style.secondary};
    --visual-accent:${p.style.accent};
    --visual-border:${p.style.border};
    --visual-font:${p.style.typography?.fontFamily||"system-ui"};
    --title-scale:${Number(p.style.typography?.titleScale)||1};
    --body-scale:${Number(p.style.typography?.bodyScale)||1};
  `;
}

function fitZoomToStage(){
  const stage=$("canvasStage");
  const p=current();
  if(!stage||!stage.clientWidth||!stage.clientHeight)return;
  const pad=36;
  const fitW=(stage.clientWidth-pad)/p.canvas.width;
  const fitH=(stage.clientHeight-pad)/p.canvas.height;
  zoom=Math.max(.18,Math.min(.82,fitW,fitH));
}

async function renderPreview(){
  const p=current();
  const viz=getVisualization(p.type);
  if(!viz)return;

  const token=++previewRenderToken;
  const shell=$("canvasShell");

  shell.style.width=`${p.canvas.width}px`;
  shell.style.height=`${p.canvas.height}px`;
  shell.style.transform=`scale(${zoom})`;
  shell.style.margin=`${-(p.canvas.height*(1-zoom))/2}px ${-(p.canvas.width*(1-zoom))/2}px`;

  const target=$("previewRoot");
  target.setAttribute("style",cssVars());
  target.style.containerType="inline-size";

  // Render into a detached root first. Image-backed visualizations are async;
  // this prevents an older render from overwriting a newer edit.
  const scratch=document.createElement("div");
  scratch.setAttribute("style",cssVars());
  scratch.style.containerType="inline-size";

  try{
    await viz.render(p,scratch);
    if(token!==previewRenderToken)return;

    target.replaceChildren(...scratch.childNodes);
  }catch(e){
    console.error(e);
    if(token===previewRenderToken){
      target.innerHTML=`<div style="padding:40px;color:#ff9999">Preview Error</div>`;
    }
  }

  $("zoomLabel").textContent=`${Math.round(zoom*100)}%`;
  $("typeBadge").textContent=p.type;
}

function field(label,value,onInput,type="text",attrs={}){
  const wrap=document.createElement("div");
  wrap.className="field";
  const l=document.createElement("label");
  l.textContent=label;
  const input=document.createElement("input");
  input.className="input";
  input.type=type;
  input.value=value??"";
  Object.entries(attrs).forEach(([k,v])=>input.setAttribute(k,v));
  input.addEventListener("change",()=>onInput(input.value));
  input.addEventListener("input",()=>{
    if(type==="color")onInput(input.value,true);
  });
  wrap.append(l,input);
  return wrap;
}

function textareaField(label,value,onChange){
  const wrap=document.createElement("div");
  wrap.className="field";
  const l=document.createElement("label");l.textContent=label;
  const ta=document.createElement("textarea");ta.className="textarea";ta.value=value??"";
  ta.addEventListener("change",()=>onChange(ta.value));
  wrap.append(l,ta);
  return wrap;
}

function section(title,{collapsedDefault=false}={}){
  const key=`${current().type}:${activePanel}:${title}`;
  const defaultCollapsed=collapsedDefault || title==="Paste / CSV";
  const collapsed=sectionCollapseState.has(key)
    ? sectionCollapseState.get(key)
    : defaultCollapsed;

  const box=document.createElement("section");
  box.className=`panel-section ${collapsed?"collapsed":""}`;

  const h=document.createElement("button");
  h.type="button";
  h.className="panel-section-title panel-section-toggle";
  h.setAttribute("aria-expanded",collapsed?"false":"true");

  const label=document.createElement("span");
  label.textContent=title;

  const chevron=document.createElement("span");
  chevron.className="section-chevron";
  chevron.textContent=collapsed?"＋":"−";

  h.append(label,chevron);
  h.addEventListener("click",()=>{
    const next=!box.classList.contains("collapsed");
    box.classList.toggle("collapsed",next);
    sectionCollapseState.set(key,next);
    h.setAttribute("aria-expanded",next?"false":"true");
    chevron.textContent=next?"＋":"−";
  });

  box.appendChild(h);
  return box;
}

function numberValue(v){const n=Number(v);return Number.isFinite(n)?n:0}

function toggleOption(label,on,onToggle){
  const b=document.createElement("button");
  b.type="button";
  b.className=`option-toggle ${on?"on":""}`;
  b.innerHTML=`<span></span><i></i>`;
  b.querySelector("span").textContent=label;
  b.addEventListener("click",onToggle);
  return b;
}

function sourceSelectField(label,options,currentValue,onChange){
  const wrap=document.createElement("label");
  wrap.className="field source-select-field";
  const span=document.createElement("span");
  span.className="source-select-label";
  span.textContent=label;
  const select=document.createElement("select");
  select.className="select";
  options.forEach(opt=>{
    const option=document.createElement("option");
    option.value=String(opt.value);
    option.textContent=opt.label;
    option.selected=String(opt.value)===String(currentValue);
    select.appendChild(option);
  });
  select.addEventListener("change",()=>onChange(select.value));
  wrap.append(span,select);
  return wrap;
}

function sourceSubjectChecks(model,selected,onChange){
  const wrap=document.createElement("div");
  wrap.className="source-subject-grid";
  const selectedSet=new Set((selected||[]).map(Number));
  model.rows.forEach(row=>{
    const label=document.createElement("label");
    label.className="source-check";
    const input=document.createElement("input");
    input.type="checkbox";
    input.checked=selectedSet.has(row.rawIndex);
    input.addEventListener("change",()=>{
      const next=new Set(selectedSet);
      if(input.checked)next.add(row.rawIndex);
      else next.delete(row.rawIndex);
      onChange([...next].slice(0,6));
    });
    const text=document.createElement("span");
    text.textContent=row.name;
    label.append(input,text);
    wrap.appendChild(label);
  });
  return wrap;
}

function choiceButtons(options,currentValue,onChange,className="segmented"){
  const wrap=document.createElement("div");
  wrap.className=className;
  options.forEach(({value,label})=>{
    const b=document.createElement("button");
    b.type="button";
    b.className=className==="segmented"?`seg-btn ${value===currentValue?"active":""}`:`topn-btn ${value===currentValue?"active":""}`;
    b.textContent=label;
    b.addEventListener("click",()=>onChange(value));
    wrap.appendChild(b);
  });
  return wrap;
}

const RANKING_TEMPLATES={
  minimal:{theme:"light",font:"system-ui",preview:"linear-gradient(135deg,#f5f6f8,#fff)"},
  sports:{theme:"sports",font:"system-ui",preview:"linear-gradient(135deg,#071b2b,#0d314a)"},
  dark:{theme:"black",font:"system-ui",preview:"linear-gradient(135deg,#050505,#181818)"},
  newspaper:{theme:"light",font:"Georgia, serif",preview:"linear-gradient(135deg,#f2eee4,#fffdf6)"},
  neon:{theme:"neon",font:"system-ui",preview:"linear-gradient(135deg,#080a16,#281443)"}
};

function applyRankingTemplate(project,templateId){
  const def=RANKING_TEMPLATES[templateId]||RANKING_TEMPLATES.sports;
  project.settings.template=templateId;
  applyTheme(project,def.theme);
  project.style.typography.fontFamily=def.font;
}


const STAT_TEMPLATES={
  sports:{theme:"sports",font:"system-ui"},
  gaming:{theme:"neon",font:"system-ui"},
  minimal:{theme:"light",font:"system-ui"},
  dark:{theme:"black",font:"system-ui"},
  neon:{theme:"neon",font:"system-ui"},
  classic:{theme:"dark",font:"Georgia, serif"}
};
function applyStatTemplate(project,templateId){
  const def=STAT_TEMPLATES[templateId]||STAT_TEMPLATES.sports;
  project.settings.template=templateId;
  applyTheme(project,def.theme);
  project.style.typography.fontFamily=def.font;
}

function swapRows(list,index,delta){
  const next=index+delta;
  if(next<0||next>=list.length)return;
  [list[index],list[next]]=[list[next],list[index]];
}

function buildSpreadsheetSection(p){
  if(p.settings?.sourceLinked)return null;
  let rows=null,columns=[],onCell=null,onAdd=null,onDelete=null,onMove=null;

  if(p.type==="ranking-card"){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"Value",type:"number"},{key:"category",label:"Category"},{key:"note",label:"Note"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);
    onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,category:"",note:"",imageRef:null,imageShape:"circle",enabled:true}));
    onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(["bar","dot"].includes(p.type)){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"Value",type:"number"},{key:"category",label:"Category"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);
    onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,category:"",enabled:true}));
    onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(["quadrant","scatter"].includes(p.type)){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"x",label:"X",type:"number"},{key:"y",label:"Y",type:"number"},{key:"category",label:"Category"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);
    onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",x:50,y:50,category:"",enabled:true}));
    onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="stat-card"){
    rows=p.data.stats;columns=[{key:"label",label:"Stat"},{key:"value",label:"Value",type:"number"}];
    onCell=(i,k,v)=>mutate(x=>x.data.stats[i][k]=v);
    onAdd=()=>mutate(x=>{if(x.data.stats.length<12)x.data.stats.push({id:newStatId(),label:"NEW",value:0})});
    onDelete=i=>mutate(x=>x.data.stats.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.stats,i,d));
  }else if(p.type==="range"){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"A",type:"number"},{key:"value2",label:"B",type:"number"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,value2:0}));onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="ring"){
    rows=p.data.items;columns=[{key:"label",label:"Label"},{key:"value",label:"Value",type:"number"},{key:"max",label:"Max",type:"number"},{key:"unit",label:"Unit"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);onAdd=()=>mutate(x=>{if(x.data.items.length<6)x.data.items.push({id:newItemId(),label:"Metric",value:0,max:100,unit:""})});onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="tier-list"){
    rows=p.data.items;columns=[{key:"name",label:"Name"},{key:"value",label:"Score",type:"number"},{key:"tier",label:"Tier"}];
    onCell=(i,k,v)=>mutate(x=>x.data.items[i][k]=v);onAdd=()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,tier:x.data.tiers.at(-1)?.label||""}));onDelete=i=>mutate(x=>x.data.items.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.items,i,d));
  }else if(p.type==="waffle"){
    rows=p.data.categories;columns=[{key:"label",label:"Category"},{key:"value",label:"Value",type:"number"}];
    onCell=(i,k,v)=>mutate(x=>x.data.categories[i][k]=v);onAdd=()=>mutate(x=>{if(x.data.categories.length<6)x.data.categories.push({id:newItemId(),label:"Category",value:0})});onDelete=i=>mutate(x=>x.data.categories.splice(i,1));onMove=(i,d)=>mutate(x=>swapRows(x.data.categories,i,d));
  }else{
    return null;
  }

  const sec=section(t("editor.spreadsheet"),{collapsedDefault:true});
  sec.appendChild(createSpreadsheetEditor({columns,rows,onCellChange:onCell,onAdd,onDelete,onMove}));
  return sec;
}


function sourceInfoBlock(model){
  const box=document.createElement("div");
  box.className="source-info-card";
  box.innerHTML=`<b></b><span></span>`;
  box.querySelector("b").textContent=model.sheet.title||"Stats Maker";
  box.querySelector("span").textContent=`${model.rows.length}対象 / ${model.criteria.length}評価項目`;
  return box;
}

function buildLinkedDataPanel(p,model){
  const frag=document.createDocumentFragment();

  const source=section("基本表と連動");
  source.appendChild(sourceInfoBlock(model));
  frag.appendChild(source);

  if(p.type==="stat-card" || p.type==="ring"){
    const sec=section("対象");
    sec.appendChild(sourceSelectField(
      "表示対象",
      getSubjectOptions(model),
      p.settings.sourceSubjectIndex??model.rows[0]?.rawIndex??"",
      value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
    ));
    frag.appendChild(sec);
  }

  if(["ranking-card","bar","dot","tier-list"].includes(p.type)){
    const sec=section("評価項目");
    sec.appendChild(sourceSelectField(
      "表示する評価",
      getMetricOptions(model),
      p.settings.sourceMetricKey||model.metricKey,
      value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
    ));
    frag.appendChild(sec);
  }

  if(p.type==="quadrant" || p.type==="scatter"){
    const sec=section("軸");
    const grid=document.createElement("div");
    grid.className="inline-grid";
    grid.appendChild(sourceSelectField(
      "X軸",
      getCriterionOptions(model),
      p.settings.sourceXIndex??0,
      value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
    ));
    grid.appendChild(sourceSelectField(
      "Y軸",
      getCriterionOptions(model),
      p.settings.sourceYIndex??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
    ));
    sec.appendChild(grid);

    if(p.type==="quadrant"){
      const split=document.createElement("div");
      split.className="inline-grid";
      split.appendChild(field("X split",p.settings.xAxis.split,v=>mutate(x=>x.settings.xAxis.split=numberValue(v)),"number"));
      split.appendChild(field("Y split",p.settings.yAxis.split,v=>mutate(x=>x.settings.yAxis.split=numberValue(v)),"number"));
      sec.appendChild(split);
    }
    frag.appendChild(sec);
  }

  if(p.type==="range"){
    const sec=section("比較項目");
    const grid=document.createElement("div");
    grid.className="inline-grid";
    grid.appendChild(sourceSelectField(
      "項目A",
      getCriterionOptions(model),
      p.settings.sourceRangeA??0,
      value=>mutate(x=>syncSourceProject(x,{aIndex:Number(value)}))
    ));
    grid.appendChild(sourceSelectField(
      "項目B",
      getCriterionOptions(model),
      p.settings.sourceRangeB??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{bIndex:Number(value)}))
    ));
    sec.appendChild(grid);
    sec.appendChild(toggleOption("Difference",p.settings.showDiff!==false,()=>mutate(x=>x.settings.showDiff=x.settings.showDiff===false)));
    sec.appendChild(choiceButtons(
      [{value:"value",label:"Value"},{value:"percent",label:"%"}],
      p.settings.diffMode||"value",
      v=>mutate(x=>x.settings.diffMode=v)
    ));
    frag.appendChild(sec);
  }

  if(p.type==="radar"){
    const sec=section("比較対象");
    sec.appendChild(sourceSubjectChecks(
      model,
      p.settings.sourceSeriesIndices||[],
      indices=>mutate(x=>syncSourceProject(x,{seriesIndices:indices}))
    ));
    frag.appendChild(sec);
  }

  const options=section("表示設定");

  if(p.type==="ranking-card"){
    const top=document.createElement("div");
    top.className="field";
    const label=document.createElement("label");
    label.textContent=t("editor.topN");
    top.appendChild(label);
    top.appendChild(choiceButtons(
      [3,5,10,20].map(n=>({value:n,label:`TOP ${n}`})),
      Number(p.settings.topN||5),
      value=>mutate(x=>x.settings.topN=value),
      "topn-presets"
    ));
    options.appendChild(top);
    options.appendChild(toggleOption(t("ranking.showNote"),p.settings.showNote!==false,()=>mutate(x=>x.settings.showNote=x.settings.showNote===false)));
    options.appendChild(toggleOption(t("ranking.highlightTop3"),p.settings.highlightTop3!==false,()=>mutate(x=>x.settings.highlightTop3=x.settings.highlightTop3===false)));
    options.appendChild(toggleOption(t("ranking.showBars"),p.settings.showBars!==false,()=>mutate(x=>x.settings.showBars=x.settings.showBars===false)));
  }

  if(p.type==="bar"){
    options.appendChild(toggleOption(t("bar.showValues"),p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    options.appendChild(toggleOption(t("bar.showGrid"),p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
  }

  if(p.type==="dot"){
    options.appendChild(toggleOption("Values",p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    options.appendChild(toggleOption("Guide",p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
  }

  if(p.type==="radar"){
    options.appendChild(toggleOption(t("radar.showValues"),!!p.settings.showValues,()=>mutate(x=>x.settings.showValues=!x.settings.showValues)));
    options.appendChild(toggleOption(t("radar.showLegend"),p.settings.showLegend!==false,()=>mutate(x=>x.settings.showLegend=x.settings.showLegend===false)));
    options.appendChild(toggleOption(t("radar.showAxisLabels"),p.settings.showAxisLabels!==false,()=>mutate(x=>x.settings.showAxisLabels=x.settings.showAxisLabels===false)));
  }

  if(p.type==="scatter"){
    options.appendChild(toggleOption("Average lines",p.settings.showAverage!==false,()=>mutate(x=>x.settings.showAverage=x.settings.showAverage===false)));
    options.appendChild(toggleOption("Median lines",!!p.settings.showMedian,()=>mutate(x=>x.settings.showMedian=!x.settings.showMedian)));
    options.appendChild(toggleOption("Trend line",p.settings.showTrend!==false,()=>mutate(x=>x.settings.showTrend=x.settings.showTrend===false)));
    options.appendChild(toggleOption("Labels",p.settings.showLabels!==false,()=>mutate(x=>x.settings.showLabels=x.settings.showLabels===false)));
  }

  if(p.type==="ring"){
    options.appendChild(choiceButtons(
      [{value:"thick",label:"Thick"},{value:"thin",label:"Thin"},{value:"half",label:"Half"}],
      p.settings.style||"thick",
      v=>mutate(x=>x.settings.style=v)
    ));
    options.appendChild(toggleOption("Percent",p.settings.showPercent!==false,()=>mutate(x=>x.settings.showPercent=x.settings.showPercent===false)));
  }

  if(p.type==="tier-list"){
    options.appendChild(toggleOption("Score",p.settings.showScore!==false,()=>mutate(x=>x.settings.showScore=x.settings.showScore===false)));
  }

  if(options.children.length>1)frag.appendChild(options);

  return frag;
}

function buildDataPanel(){
  const p=current();
  const sourceModel=getSourceModel(p);

  if(sourceModel && p.settings.sourceLinked){
    return buildLinkedDataPanel(p,sourceModel);
  }

  const frag=document.createDocumentFragment();

  const common=section(t("editor.items"));
  common.appendChild(field(t("common.title"),p.meta.title,v=>mutate(x=>x.meta.title=v)));
  common.appendChild(field(t("common.subtitle"),p.meta.subtitle,v=>mutate(x=>x.meta.subtitle=v)));
  frag.appendChild(common);

  if(p.type==="ranking-card"){
    const opts=section("Ranking");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "表示項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    opts.appendChild(field(t("editor.unit"),p.settings.unit??"PTS",v=>mutate(x=>x.settings.unit=v)));
    opts.appendChild(field(t("ranking.headerLabel"),p.settings.headerLabel??"POWER RANKING",v=>mutate(x=>x.settings.headerLabel=v)));

    const topLabel=document.createElement("div");
    topLabel.className="field";
    const topText=document.createElement("label");topText.textContent=t("editor.topN");
    topLabel.appendChild(topText);
    topLabel.appendChild(choiceButtons(
      [3,5,10,20].map(n=>({value:n,label:`TOP ${n}`})),
      Number(p.settings.topN||5),
      value=>mutate(x=>x.settings.topN=value),
      "topn-presets"
    ));
    opts.appendChild(topLabel);

    const sort=document.createElement("button");
    sort.className="btn";
    sort.textContent=t("editor.autoSort");
    sort.addEventListener("click",()=>mutate(x=>{
      x.data.items.sort((a,b)=>Number(b.value)-Number(a.value));
      x.settings.sort="manual";
    }));
    opts.appendChild(sort);
    frag.appendChild(opts);

    const display=section(t("ranking.options"));
    const optionList=document.createElement("div");optionList.className="option-list";
    optionList.appendChild(toggleOption(t("ranking.showNote"),p.settings.showNote!==false,()=>mutate(x=>x.settings.showNote=x.settings.showNote===false)));
    optionList.appendChild(toggleOption(t("ranking.showCategory"),p.settings.showCategory!==false,()=>mutate(x=>x.settings.showCategory=x.settings.showCategory===false)));
    optionList.appendChild(toggleOption(t("ranking.highlightTop3"),p.settings.highlightTop3!==false,()=>mutate(x=>x.settings.highlightTop3=x.settings.highlightTop3===false)));
    optionList.appendChild(toggleOption(t("ranking.showBars"),p.settings.showBars!==false,()=>mutate(x=>x.settings.showBars=x.settings.showBars===false)));
    display.appendChild(optionList);

    const densityWrap=document.createElement("div");densityWrap.className="field";densityWrap.style.marginTop="10px";
    const densityLabel=document.createElement("label");densityLabel.textContent=t("ranking.density");
    densityWrap.appendChild(densityLabel);
    densityWrap.appendChild(choiceButtons(
      [
        {value:"comfortable",label:t("ranking.comfortable")},
        {value:"compact",label:t("ranking.compact")}
      ],
      p.settings.density||"comfortable",
      value=>mutate(x=>x.settings.density=value)
    ));
    display.appendChild(densityWrap);
    frag.appendChild(display);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"ranking",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.map(r=>({
          id:newItemId(),
          name:r.name,
          value:r.value,
          note:r.note||"",
          category:r.category||"",
          imageRef:null,
          imageShape:"circle",
          enabled:true
        }));
        x.data.items=mode==="append"?[...x.data.items,...mapped]:mapped;
        x.settings.sort="manual";
      })
    }));
    frag.appendChild(importSection);

    const data=section(t("editor.items"));
    const list=document.createElement("div");list.className="data-list";
    p.data.items.forEach((item,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head"><span class="drag-label">#${index+1}</span><div class="row-actions"><button class="icon-btn up">↑</button><button class="icon-btn down">↓</button><button class="icon-btn del">×</button></div></div>
        <div class="row-grid"><input class="input name"><input class="input value" type="number"></div>
        <input class="input category">
        <input class="input note">
      `;
      row.querySelector(".name").value=item.name;
      row.querySelector(".value").value=item.value;
      row.querySelector(".category").value=item.category||"";
      row.querySelector(".category").placeholder=t("ranking.category");
      row.querySelector(".note").value=item.note||"";
      row.querySelector(".note").placeholder=t("editor.note");
      row.querySelector(".name").addEventListener("change",e=>mutate(x=>x.data.items[index].name=e.target.value));
      row.querySelector(".value").addEventListener("change",e=>mutate(x=>x.data.items[index].value=numberValue(e.target.value)));
      row.querySelector(".category").addEventListener("change",e=>mutate(x=>x.data.items[index].category=e.target.value));
      row.querySelector(".note").addEventListener("change",e=>mutate(x=>x.data.items[index].note=e.target.value));

      const imageManager=createImageManager({
        imageRef:item.imageRef||null,
        shape:item.imageShape||"circle",
        label:getLanguage()==="ja"?"画像":"Image",
        onChange:(imageRef)=>mutate(x=>x.data.items[index].imageRef=imageRef),
        onShapeChange:(imageShape)=>mutate(x=>x.data.items[index].imageShape=imageShape)
      });
      row.appendChild(imageManager);

      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.items.splice(index,1)));
      row.querySelector(".up").addEventListener("click",()=>mutate(x=>{if(index>0)[x.data.items[index-1],x.data.items[index]]=[x.data.items[index],x.data.items[index-1]]}));
      row.querySelector(".down").addEventListener("click",()=>mutate(x=>{if(index<x.data.items.length-1)[x.data.items[index+1],x.data.items[index]]=[x.data.items[index],x.data.items[index+1]]}));
      list.appendChild(row);
    });
    data.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addItem");
    add.addEventListener("click",()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",value:0,note:"",category:"",imageRef:null,imageShape:"circle",enabled:true})));
    data.appendChild(add);
    frag.appendChild(data);
  }

  if(p.type==="stat-card"){
    const info=section("Card");
    if(sourceModel){
      info.appendChild(sourceSelectField(
        "対象",
        getSubjectOptions(sourceModel),
        p.settings.sourceSubjectIndex??sourceModel.rows[0]?.rawIndex??"",
        value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
      ));
    }
    info.appendChild(field(t("editor.name"),p.data.name,v=>mutate(x=>x.data.name=v)));
    info.appendChild(field(t("common.subtitle"),p.data.subtitle,v=>mutate(x=>x.data.subtitle=v)));
    const grid=document.createElement("div");grid.className="inline-grid";
    grid.appendChild(field(t("editor.overall"),p.data.overall,v=>mutate(x=>x.data.overall=numberValue(v)),"number"));
    grid.appendChild(field("Tier",p.data.tier,v=>mutate(x=>x.data.tier=v)));
    info.appendChild(grid);
    info.appendChild(field(t("editor.team"),p.data.team,v=>mutate(x=>x.data.team=v)));

    info.appendChild(createImageManager({
      imageRef:p.data.imageRef||null,
      shape:p.data.imageShape||"rounded",
      label:getLanguage()==="ja"?"カード画像":"Card Image",
      onChange:(imageRef)=>mutate(x=>x.data.imageRef=imageRef),
      onShapeChange:(imageShape)=>mutate(x=>x.data.imageShape=imageShape)
    }));

    frag.appendChild(info);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"stats",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.slice(0,12).map(r=>({
          id:newStatId(),
          label:r.label,
          value:r.value
        }));
        x.data.stats=mode==="append"
          ? [...x.data.stats,...mapped].slice(0,12)
          : mapped.slice(0,12);
      })
    }));
    frag.appendChild(importSection);

    const stats=section("Stats");
    const list=document.createElement("div");list.className="data-list";
    p.data.stats.forEach((stat,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`<div class="row-grid"><input class="input label"><input class="input value" type="number"></div><div class="row-actions"><button class="icon-btn del">×</button></div>`;
      row.querySelector(".label").value=stat.label;
      row.querySelector(".value").value=stat.value;
      row.querySelector(".label").addEventListener("change",e=>mutate(x=>x.data.stats[index].label=e.target.value));
      row.querySelector(".value").addEventListener("change",e=>mutate(x=>x.data.stats[index].value=numberValue(e.target.value)));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.stats.splice(index,1)));
      list.appendChild(row);
    });
    stats.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addStat");
    add.disabled=p.data.stats.length>=12;
    add.addEventListener("click",()=>mutate(x=>x.data.stats.push({id:newStatId(),label:"NEW",value:0})));
    stats.appendChild(add);
    frag.appendChild(stats);
  }

  if(p.type==="quadrant"){
    const axes=section("Axis");
    if(sourceModel){
      const sourceGrid=document.createElement("div");sourceGrid.className="inline-grid";
      sourceGrid.appendChild(sourceSelectField(
        "X軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceXIndex??0,
        value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
      ));
      sourceGrid.appendChild(sourceSelectField(
        "Y軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceYIndex??Math.min(1,sourceModel.criteria.length-1),
        value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
      ));
      axes.appendChild(sourceGrid);
      const splitGrid=document.createElement("div");splitGrid.className="inline-grid";
      splitGrid.appendChild(field("X split",p.settings.xAxis.split,v=>mutate(x=>x.settings.xAxis.split=numberValue(v)),"number"));
      splitGrid.appendChild(field("Y split",p.settings.yAxis.split,v=>mutate(x=>x.settings.yAxis.split=numberValue(v)),"number"));
      axes.appendChild(splitGrid);
    }else{
      const xgrid=document.createElement("div");xgrid.className="inline-grid";
      xgrid.appendChild(field(t("editor.xAxis"),p.settings.xAxis.label,v=>mutate(x=>x.settings.xAxis.label=v)));
      xgrid.appendChild(field(t("editor.split"),p.settings.xAxis.split,v=>mutate(x=>x.settings.xAxis.split=numberValue(v)),"number"));
      axes.appendChild(xgrid);
      const ygrid=document.createElement("div");ygrid.className="inline-grid";
      ygrid.appendChild(field(t("editor.yAxis"),p.settings.yAxis.label,v=>mutate(x=>x.settings.yAxis.label=v)));
      ygrid.appendChild(field(t("editor.split"),p.settings.yAxis.split,v=>mutate(x=>x.settings.yAxis.split=numberValue(v)),"number"));
      axes.appendChild(ygrid);
    }
    frag.appendChild(axes);

    const qs=section(t("editor.quadrants"));
    [["topLeft","editor.topLeft"],["topRight","editor.topRight"],["bottomLeft","editor.bottomLeft"],["bottomRight","editor.bottomRight"]].forEach(([key,label])=>{
      qs.appendChild(field(t(label),p.settings.quadrants[key],v=>mutate(x=>x.settings.quadrants[key]=v)));
    });
    frag.appendChild(qs);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"quadrant",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.map(r=>({
          id:newItemId(),
          name:r.name,
          x:r.x,
          y:r.y,
          category:r.category||"",
          imageRef:null,
          imageShape:"circle",
          enabled:true
        }));
        x.data.items=mode==="append"?[...x.data.items,...mapped]:mapped;
      })
    }));
    frag.appendChild(importSection);

    const data=section(t("editor.items"));
    const list=document.createElement("div");list.className="data-list";
    p.data.items.forEach((item,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head"><span class="drag-label">#${index+1}</span><button class="icon-btn del">×</button></div>
        <input class="input name">
        <div class="inline-grid"><input class="input x" type="number"><input class="input y" type="number"></div>
      `;
      row.querySelector(".name").value=item.name;
      row.querySelector(".x").value=item.x;
      row.querySelector(".y").value=item.y;
      row.querySelector(".name").addEventListener("change",e=>mutate(x=>x.data.items[index].name=e.target.value));
      row.querySelector(".x").addEventListener("change",e=>mutate(x=>x.data.items[index].x=numberValue(e.target.value)));
      row.querySelector(".y").addEventListener("change",e=>mutate(x=>x.data.items[index].y=numberValue(e.target.value)));

      row.appendChild(createImageManager({
        imageRef:item.imageRef||null,
        shape:item.imageShape||"circle",
        label:getLanguage()==="ja"?"マーカー画像":"Marker Image",
        onChange:(imageRef)=>mutate(x=>x.data.items[index].imageRef=imageRef),
        onShapeChange:(imageShape)=>mutate(x=>x.data.items[index].imageShape=imageShape)
      }));

      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.items.splice(index,1)));
      list.appendChild(row);
    });
    data.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addItem");
    add.addEventListener("click",()=>mutate(x=>x.data.items.push({id:newItemId(),name:"New Item",x:50,y:50,category:"",imageRef:null,imageShape:"circle",enabled:true})));
    data.appendChild(add);
    frag.appendChild(data);
  }


  if(p.type==="bar"){
    const opts=section(t("bar.options"));
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "表示項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    const grid=document.createElement("div");grid.className="inline-grid";
    grid.appendChild(field(t("editor.unit"),p.settings.unit||"",v=>mutate(x=>x.settings.unit=v)));
    grid.appendChild(field(t("editor.topN"),p.settings.topN||10,v=>mutate(x=>x.settings.topN=Math.max(1,Math.min(30,numberValue(v)))),"number",{min:"1",max:"30"}));
    opts.appendChild(grid);

    const toggles=document.createElement("div");toggles.className="option-list";
    toggles.appendChild(toggleOption(t("bar.showValues"),p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    toggles.appendChild(toggleOption(t("bar.showCategory"),p.settings.showCategory!==false,()=>mutate(x=>x.settings.showCategory=x.settings.showCategory===false)));
    toggles.appendChild(toggleOption(t("bar.showGrid"),p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
    toggles.appendChild(toggleOption(t("bar.autoMax"),p.settings.autoMax!==false,()=>mutate(x=>x.settings.autoMax=x.settings.autoMax===false)));
    opts.appendChild(toggles);

    if(p.settings.autoMax===false){
      opts.appendChild(field(t("bar.max"),p.settings.max||100,v=>mutate(x=>x.settings.max=Math.max(1,numberValue(v))),"number"));
    }

    const sort=document.createElement("button");
    sort.className="btn";sort.style.marginTop="8px";sort.textContent=t("editor.autoSort");
    sort.addEventListener("click",()=>mutate(x=>{
      x.data.items.sort((a,b)=>Number(b.value)-Number(a.value));
      x.settings.sort="manual";
    }));
    opts.appendChild(sort);
    frag.appendChild(opts);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"bar",
      onImport:(rows,mode)=>mutate(x=>{
        const mapped=rows.map(r=>({
          id:newItemId(),
          name:r.name,
          value:r.value,
          category:r.category||"",
          enabled:true
        }));
        x.data.items=mode==="append"?[...x.data.items,...mapped]:mapped;
      })
    }));
    frag.appendChild(importSection);

    const data=section(t("editor.items"));
    const list=document.createElement("div");list.className="data-list";

    p.data.items.forEach((item,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">#${index+1}</span>
          <div class="row-actions">
            <button class="icon-btn up">↑</button>
            <button class="icon-btn down">↓</button>
            <button class="icon-btn del">×</button>
          </div>
        </div>
        <div class="row-grid">
          <input class="input name">
          <input class="input value" type="number">
        </div>
        <input class="input category">
      `;
      row.querySelector(".name").value=item.name||"";
      row.querySelector(".value").value=item.value??0;
      row.querySelector(".category").value=item.category||"";
      row.querySelector(".category").placeholder=t("ranking.category");

      row.querySelector(".name").addEventListener("change",e=>mutate(x=>x.data.items[index].name=e.target.value));
      row.querySelector(".value").addEventListener("change",e=>mutate(x=>x.data.items[index].value=numberValue(e.target.value)));
      row.querySelector(".category").addEventListener("change",e=>mutate(x=>x.data.items[index].category=e.target.value));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.items.splice(index,1)));
      row.querySelector(".up").addEventListener("click",()=>mutate(x=>{if(index>0)[x.data.items[index-1],x.data.items[index]]=[x.data.items[index],x.data.items[index-1]]}));
      row.querySelector(".down").addEventListener("click",()=>mutate(x=>{if(index<x.data.items.length-1)[x.data.items[index+1],x.data.items[index]]=[x.data.items[index],x.data.items[index+1]]}));

      list.appendChild(row);
    });

    data.appendChild(list);
    const add=document.createElement("button");add.className="btn add-row-btn";add.textContent=t("editor.addItem");
    add.addEventListener("click",()=>mutate(x=>x.data.items.push({
      id:newItemId(),name:"New Item",value:0,category:"",enabled:true
    })));
    data.appendChild(add);
    frag.appendChild(data);
  }

  if(p.type==="radar"){
    if(sourceModel){
      const subjects=section("対象");
      subjects.appendChild(sourceSubjectChecks(
        sourceModel,
        p.settings.sourceSeriesIndices||[],
        indices=>mutate(x=>syncSourceProject(x,{seriesIndices:indices}))
      ));
      frag.appendChild(subjects);
    }
    const opts=section(t("radar.options"));
    const toggles=document.createElement("div");toggles.className="option-list";
    toggles.appendChild(toggleOption(t("radar.showValues"),!!p.settings.showValues,()=>mutate(x=>x.settings.showValues=!x.settings.showValues)));
    toggles.appendChild(toggleOption(t("radar.showLegend"),p.settings.showLegend!==false,()=>mutate(x=>x.settings.showLegend=x.settings.showLegend===false)));
    toggles.appendChild(toggleOption(t("radar.showAxisLabels"),p.settings.showAxisLabels!==false,()=>mutate(x=>x.settings.showAxisLabels=x.settings.showAxisLabels===false)));
    opts.appendChild(toggles);

    const grid=document.createElement("div");grid.className="inline-grid";grid.style.marginTop="9px";
    grid.appendChild(field(t("radar.gridLevels"),p.settings.gridLevels||5,v=>mutate(x=>x.settings.gridLevels=Math.max(3,Math.min(8,numberValue(v)))),"number",{min:"3",max:"8"}));
    grid.appendChild(field(t("radar.fillOpacity"),p.settings.fillOpacity??0.18,v=>mutate(x=>x.settings.fillOpacity=Math.max(0,Math.min(.7,Number(v)||0))),"number",{min:"0",max:"0.7",step:"0.05"}));
    opts.appendChild(grid);
    frag.appendChild(opts);

    const importSection=section("Paste / CSV");
    importSection.appendChild(createDataImport({
      kind:"radar",
      onImport:(mapped,mode)=>mutate(x=>{
        const axes=(mapped.axes||[]).map(a=>({
          id:newAxisId(),
          label:a.label,
          max:a.max||100
        }));
        const series=(mapped.series||[]).map(s=>({
          id:newSeriesId(),
          name:s.name,
          color:s.color||x.style.accent,
          values:[...(s.values||[])]
        }));

        if(mode==="append" && x.data.axes.length===axes.length){
          x.data.series=[...x.data.series,...series].slice(0,6);
        }else{
          x.data.axes=axes.slice(0,12);
          x.data.series=series.slice(0,6);
        }
      })
    }));
    frag.appendChild(importSection);

    const axesSection=section(t("radar.axes"));
    const axesList=document.createElement("div");axesList.className="data-list";

    p.data.axes.forEach((axis,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">Axis ${index+1}</span>
          <button class="icon-btn del">×</button>
        </div>
        <div class="row-grid">
          <input class="input label">
          <input class="input max" type="number">
        </div>
      `;
      row.querySelector(".label").value=axis.label||"";
      row.querySelector(".max").value=axis.max??100;
      row.querySelector(".label").addEventListener("change",e=>mutate(x=>x.data.axes[index].label=e.target.value));
      row.querySelector(".max").addEventListener("change",e=>mutate(x=>x.data.axes[index].max=Math.max(1,numberValue(e.target.value))));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>{
        if(x.data.axes.length<=3)return;
        x.data.axes.splice(index,1);
        x.data.series.forEach(s=>s.values.splice(index,1));
      }));
      axesList.appendChild(row);
    });

    axesSection.appendChild(axesList);
    const addAxis=document.createElement("button");addAxis.className="btn add-row-btn";addAxis.textContent="+ Axis";
    addAxis.disabled=p.data.axes.length>=12;
    addAxis.addEventListener("click",()=>mutate(x=>{
      if(x.data.axes.length>=12)return;
      x.data.axes.push({id:newAxisId(),label:`A${x.data.axes.length+1}`,max:100});
      x.data.series.forEach(s=>s.values.push(0));
    }));
    axesSection.appendChild(addAxis);
    frag.appendChild(axesSection);

    const seriesSection=section(t("radar.series"));
    const seriesList=document.createElement("div");seriesList.className="data-list";

    p.data.series.forEach((series,sIndex)=>{
      const row=document.createElement("div");row.className="data-row radar-series-editor";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">Series ${sIndex+1}</span>
          <button class="icon-btn del">×</button>
        </div>
        <div class="color-row">
          <input class="color-input series-color" type="color">
          <input class="input series-name">
        </div>
        <div class="radar-value-grid"></div>
      `;

      row.querySelector(".series-color").value=series.color||"#6F9CFF";
      row.querySelector(".series-name").value=series.name||`Series ${sIndex+1}`;

      row.querySelector(".series-color").addEventListener("change",e=>mutate(x=>x.data.series[sIndex].color=e.target.value));
      row.querySelector(".series-name").addEventListener("change",e=>mutate(x=>x.data.series[sIndex].name=e.target.value));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>{
        if(x.data.series.length<=1)return;
        x.data.series.splice(sIndex,1);
      }));

      const vg=row.querySelector(".radar-value-grid");
      p.data.axes.forEach((axis,aIndex)=>{
        const f=document.createElement("label");
        f.className="radar-value-field";
        const span=document.createElement("span");span.textContent=axis.label;
        const input=document.createElement("input");input.className="input";input.type="number";input.value=series.values?.[aIndex]??0;
        input.addEventListener("change",e=>mutate(x=>x.data.series[sIndex].values[aIndex]=numberValue(e.target.value)));
        f.append(span,input);vg.appendChild(f);
      });

      seriesList.appendChild(row);
    });

    seriesSection.appendChild(seriesList);
    const addSeries=document.createElement("button");addSeries.className="btn add-row-btn";addSeries.textContent="+ Series";
    addSeries.disabled=p.data.series.length>=6;
    addSeries.addEventListener("click",()=>mutate(x=>{
      if(x.data.series.length>=6)return;
      const palette=["#6F9CFF","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];
      x.data.series.push({
        id:newSeriesId(),
        name:`Series ${x.data.series.length+1}`,
        color:palette[x.data.series.length%palette.length],
        values:x.data.axes.map(()=>0)
      });
    }));
    seriesSection.appendChild(addSeries);
    frag.appendChild(seriesSection);
  }


  if(p.type==="dot"){
    const opts=section("Dot");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "表示項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    const g=document.createElement("div");g.className="inline-grid";
    g.appendChild(field("Min",p.settings.min,v=>mutate(x=>x.settings.min=numberValue(v)),"number"));
    g.appendChild(field("Max",p.settings.max,v=>mutate(x=>x.settings.max=numberValue(v)),"number"));
    opts.appendChild(g);
    opts.appendChild(field(t("editor.unit"),p.settings.unit||"",v=>mutate(x=>x.settings.unit=v)));
    const toggles=document.createElement("div");toggles.className="option-list";
    toggles.appendChild(toggleOption("Auto Range",!!p.settings.autoRange,()=>mutate(x=>x.settings.autoRange=!x.settings.autoRange)));
    toggles.appendChild(toggleOption("Values",p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));
    toggles.appendChild(toggleOption("Guide",p.settings.showGrid!==false,()=>mutate(x=>x.settings.showGrid=x.settings.showGrid===false)));
    opts.appendChild(toggles);frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"dot",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),name:r.name,value:r.value,category:r.category||"",enabled:true}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);
  }

  if(p.type==="ring"){
    const opts=section("Ring");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "対象",
        getSubjectOptions(sourceModel),
        p.settings.sourceSubjectIndex??sourceModel.rows[0]?.rawIndex??"",
        value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
      ));
    }
    opts.appendChild(choiceButtons([{value:"thick",label:"Thick"},{value:"thin",label:"Thin"},{value:"half",label:"Half"}],p.settings.style||"thick",v=>mutate(x=>x.settings.style=v)));
    opts.appendChild(toggleOption("Percent",p.settings.showPercent!==false,()=>mutate(x=>x.settings.showPercent=x.settings.showPercent===false)));
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"ring",onImport:(rows,mode)=>mutate(x=>{const m=rows.slice(0,6).map(r=>({id:newItemId(),...r}));x.data.items=mode==="append"?[...x.data.items,...m].slice(0,6):m})}));frag.appendChild(opts,imp);
  }

  if(p.type==="tier-list"){
    const opts=section("Tier");
    if(sourceModel){
      opts.appendChild(sourceSelectField(
        "評価項目",
        getMetricOptions(sourceModel),
        p.settings.sourceMetricKey||sourceModel.metricKey,
        value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
      ));
    }
    opts.appendChild(choiceButtons([{value:"auto",label:t("editor.auto")},{value:"manual",label:t("editor.manual")}],p.settings.mode||"auto",v=>mutate(x=>x.settings.mode=v)));
    opts.appendChild(toggleOption("Score",p.settings.showScore!==false,()=>mutate(x=>x.settings.showScore=x.settings.showScore===false)));
    frag.appendChild(opts);
    const tiers=section("Tiers");
    const tl=document.createElement("div");tl.className="data-list";
    p.data.tiers.forEach((tier,i)=>{const row=document.createElement("div");row.className="data-row";row.innerHTML=`<div class="row-grid"><input class="input label"><input class="input min" type="number"></div><div class="row-grid"><input class="input max" type="number"><button class="btn del">Delete</button></div>`;row.querySelector(".label").value=tier.label;row.querySelector(".min").value=tier.min;row.querySelector(".max").value=tier.max;row.querySelector(".label").addEventListener("change",e=>mutate(x=>x.data.tiers[i].label=e.target.value));row.querySelector(".min").addEventListener("change",e=>mutate(x=>x.data.tiers[i].min=numberValue(e.target.value)));row.querySelector(".max").addEventListener("change",e=>mutate(x=>x.data.tiers[i].max=numberValue(e.target.value)));row.querySelector(".del").addEventListener("click",()=>mutate(x=>{if(x.data.tiers.length>1)x.data.tiers.splice(i,1)}));tl.appendChild(row)});tiers.appendChild(tl);const add=document.createElement("button");add.className="btn add-row-btn";add.textContent="+ Tier";add.addEventListener("click",()=>mutate(x=>{if(x.data.tiers.length<10)x.data.tiers.push({id:newItemId(),label:"NEW",min:0,max:0})}));tiers.appendChild(add);frag.appendChild(tiers);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"tier",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),name:r.name,value:r.value,tier:x.data.tiers.at(-1)?.label||""}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);

    if(p.settings.mode==="manual"){
      const manual=section("Manual Tier Placement");
      const holder=document.createElement("div");holder.className="tier-manual-list";
      p.data.items.forEach((item,i)=>{
        const row=document.createElement("div");row.className="tier-manual-row";
        const name=document.createElement("span");name.textContent=item.name||"";
        const select=document.createElement("select");select.className="select";
        p.data.tiers.forEach(tier=>{const o=document.createElement("option");o.value=tier.label;o.textContent=tier.label;if((item.tier||"")===tier.label)o.selected=true;select.appendChild(o)});
        select.addEventListener("change",()=>mutate(x=>x.data.items[i].tier=select.value));
        row.append(name,select);holder.appendChild(row);
      });
      manual.appendChild(holder);frag.appendChild(manual);
    }
  }

  if(p.type==="heatmap"){
    const opts=section("Heatmap");
    opts.appendChild(choiceButtons(
      ["blue","green","red","heat","cool","rainbow"].map(v=>({value:v,label:v})),
      p.settings.palette||"blue",
      v=>mutate(x=>x.settings.palette=v),
      "theme-grid"
    ));
    const g=document.createElement("div");g.className="inline-grid";g.appendChild(field("Min",p.settings.min,v=>mutate(x=>x.settings.min=numberValue(v)),"number"));g.appendChild(field("Max",p.settings.max,v=>mutate(x=>x.settings.max=numberValue(v)),"number"));opts.appendChild(g);opts.appendChild(toggleOption("Values",p.settings.showValues!==false,()=>mutate(x=>x.settings.showValues=x.settings.showValues===false)));frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"heatmap",onImport:(mapped)=>mutate(x=>{x.data.columns=mapped.columns.map(label=>({id:newItemId(),label}));x.data.rows=mapped.rows.map(r=>({id:newItemId(),name:r.name,values:r.values}))})}));frag.appendChild(imp);
    const matrix=section("Matrix");
    const sc=document.createElement("div");sc.className="heatmap-editor-scroll";const table=document.createElement("table");table.className="heatmap-editor-table";const hr=document.createElement("tr");hr.innerHTML="<th></th>";p.data.columns.forEach((c,ci)=>{const th=document.createElement("th");const input=document.createElement("input");input.className="sheet-cell";input.value=c.label;input.addEventListener("change",e=>mutate(x=>x.data.columns[ci].label=e.target.value));th.appendChild(input);hr.appendChild(th)});table.appendChild(hr);
    p.data.rows.forEach((r,ri)=>{const tr=document.createElement("tr");const th=document.createElement("th");const name=document.createElement("input");name.className="sheet-cell";name.value=r.name;name.addEventListener("change",e=>mutate(x=>x.data.rows[ri].name=e.target.value));th.appendChild(name);tr.appendChild(th);p.data.columns.forEach((c,ci)=>{const td=document.createElement("td");const input=document.createElement("input");input.className="sheet-cell";input.type="number";input.value=r.values?.[ci]??0;input.addEventListener("change",e=>mutate(x=>x.data.rows[ri].values[ci]=numberValue(e.target.value)));td.appendChild(input);tr.appendChild(td)});table.appendChild(tr)});sc.appendChild(table);matrix.appendChild(sc);
    const acts=document.createElement("div");acts.className="matrix-actions";const ar=document.createElement("button");ar.className="btn";ar.textContent="+ Row";ar.addEventListener("click",()=>mutate(x=>x.data.rows.push({id:newItemId(),name:"New Row",values:x.data.columns.map(()=>0)})));const ac=document.createElement("button");ac.className="btn";ac.textContent="+ Column";ac.addEventListener("click",()=>mutate(x=>{if(x.data.columns.length<12){x.data.columns.push({id:newItemId(),label:`C${x.data.columns.length+1}`});x.data.rows.forEach(r=>r.values.push(0))}}));acts.append(ar,ac);matrix.appendChild(acts);frag.appendChild(matrix);
  }

  if(p.type==="scatter"){
    const axes=section("Axis");
    if(sourceModel){
      const sg=document.createElement("div");sg.className="inline-grid";
      sg.appendChild(sourceSelectField(
        "X軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceXIndex??0,
        value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
      ));
      sg.appendChild(sourceSelectField(
        "Y軸",
        getCriterionOptions(sourceModel),
        p.settings.sourceYIndex??Math.min(1,sourceModel.criteria.length-1),
        value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
      ));
      axes.appendChild(sg);
    }else{
      const xg=document.createElement("div");xg.className="inline-grid";xg.appendChild(field("X Label",p.settings.xAxis.label,v=>mutate(x=>x.settings.xAxis.label=v)));xg.appendChild(field("X Max",p.settings.xAxis.max,v=>mutate(x=>x.settings.xAxis.max=numberValue(v)),"number"));axes.appendChild(xg);
      const yg=document.createElement("div");yg.className="inline-grid";yg.appendChild(field("Y Label",p.settings.yAxis.label,v=>mutate(x=>x.settings.yAxis.label=v)));yg.appendChild(field("Y Max",p.settings.yAxis.max,v=>mutate(x=>x.settings.yAxis.max=numberValue(v)),"number"));axes.appendChild(yg);
    }
    const tg=document.createElement("div");tg.className="option-list";tg.appendChild(toggleOption("Average lines",p.settings.showAverage!==false,()=>mutate(x=>x.settings.showAverage=x.settings.showAverage===false)));tg.appendChild(toggleOption("Median lines",!!p.settings.showMedian,()=>mutate(x=>x.settings.showMedian=!x.settings.showMedian)));tg.appendChild(toggleOption("Trend line",p.settings.showTrend!==false,()=>mutate(x=>x.settings.showTrend=x.settings.showTrend===false)));tg.appendChild(toggleOption("Category colors",p.settings.categoryColors!==false,()=>mutate(x=>x.settings.categoryColors=x.settings.categoryColors===false)));tg.appendChild(toggleOption("Labels",p.settings.showLabels!==false,()=>mutate(x=>x.settings.showLabels=x.settings.showLabels===false)));axes.appendChild(tg);frag.appendChild(axes);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"scatter",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),name:r.name,x:r.x,y:r.y,category:r.category||""}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);
  }

  if(p.type==="range"){
    const opts=section("Range");
    if(sourceModel){
      const g=document.createElement("div");g.className="inline-grid";
      g.appendChild(sourceSelectField(
        "項目A",
        getCriterionOptions(sourceModel),
        p.settings.sourceRangeA??0,
        value=>mutate(x=>syncSourceProject(x,{aIndex:Number(value)}))
      ));
      g.appendChild(sourceSelectField(
        "項目B",
        getCriterionOptions(sourceModel),
        p.settings.sourceRangeB??Math.min(1,sourceModel.criteria.length-1),
        value=>mutate(x=>syncSourceProject(x,{bIndex:Number(value)}))
      ));
      opts.appendChild(g);
    }else{
      const g=document.createElement("div");g.className="inline-grid";g.appendChild(field("Label A",p.settings.labelA,v=>mutate(x=>x.settings.labelA=v)));g.appendChild(field("Label B",p.settings.labelB,v=>mutate(x=>x.settings.labelB=v)));opts.appendChild(g);
    }opts.appendChild(field(t("editor.unit"),p.settings.unit||"",v=>mutate(x=>x.settings.unit=v)));opts.appendChild(toggleOption("Auto Range",p.settings.autoRange!==false,()=>mutate(x=>x.settings.autoRange=x.settings.autoRange===false)));opts.appendChild(toggleOption("Difference",p.settings.showDiff!==false,()=>mutate(x=>x.settings.showDiff=x.settings.showDiff===false)));
    opts.appendChild(choiceButtons([{value:"value",label:"Value"},{value:"percent",label:"%"}],p.settings.diffMode||"value",v=>mutate(x=>x.settings.diffMode=v)));
    frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"range",onImport:(rows,mode)=>mutate(x=>{const m=rows.map(r=>({id:newItemId(),...r}));x.data.items=mode==="append"?[...x.data.items,...m]:m})}));frag.appendChild(imp);
  }

  if(p.type==="waffle"){
    const opts=section("Waffle");
    opts.appendChild(choiceButtons(
      [{value:"10x10",label:"10×10"},{value:"5x20",label:"5×20"},{value:"5x10",label:"5×10"}],
      `${Math.ceil((p.settings.cells||100)/(p.settings.columns||10))}x${p.settings.columns||10}`,
      v=>mutate(x=>{
        if(v==="10x10"){x.settings.cells=100;x.settings.columns=10}
        if(v==="5x20"){x.settings.cells=100;x.settings.columns=20}
        if(v==="5x10"){x.settings.cells=50;x.settings.columns=10}
      })
    ));
    opts.appendChild(field(t("editor.unit"),p.settings.unit||"%",v=>mutate(x=>x.settings.unit=v)));opts.appendChild(toggleOption("Legend",p.settings.showLegend!==false,()=>mutate(x=>x.settings.showLegend=x.settings.showLegend===false)));frag.appendChild(opts);
    const imp=section("Paste / CSV");imp.appendChild(createDataImport({kind:"waffle",onImport:(rows,mode)=>mutate(x=>{const m=rows.slice(0,6).map(r=>({id:newItemId(),...r}));x.data.categories=mode==="append"?[...x.data.categories,...m].slice(0,6):m})}));frag.appendChild(imp);
  }

  if(p.type==="stat-board"){
    const layout=section("Layout");
    layout.appendChild(choiceButtons(
      [{value:1,label:"1 Column"},{value:2,label:"2 Columns"},{value:3,label:"3 Columns"}],
      Number(p.settings.columns||2),
      v=>mutate(x=>x.settings.columns=v)
    ));
    layout.appendChild(choiceButtons(
      [{value:"small",label:"Small Gap"},{value:"medium",label:"Medium Gap"},{value:"large",label:"Large Gap"}],
      p.settings.gap||"medium",
      v=>mutate(x=>x.settings.gap=v)
    ));
    frag.appendChild(layout);

    const blocks=section("Blocks");
    const list=document.createElement("div");list.className="data-list";

    p.data.blocks.forEach((block,index)=>{
      const row=document.createElement("div");row.className="data-row";
      row.innerHTML=`
        <div class="data-row-head">
          <span class="drag-label">${block.type}</span>
          <div class="row-actions">
            <button class="icon-btn up">↑</button>
            <button class="icon-btn down">↓</button>
            <button class="icon-btn del">×</button>
          </div>
        </div>
        <div class="inline-grid">
          <select class="select block-type">
            <option value="hero">Hero</option>
            <option value="number">Number</option>
            <option value="ring">Ring</option>
            <option value="progress">Progress</option>
            <option value="text">Text</option>
          </select>
          <select class="select block-span">
            <option value="1">Span 1</option>
            <option value="2">Span 2</option>
            <option value="3">Span 3</option>
          </select>
        </div>
        <div class="block-fields"></div>
      `;
      row.querySelector(".block-type").value=block.type;
      row.querySelector(".block-span").value=String(block.span||1);
      row.querySelector(".block-type").addEventListener("change",e=>mutate(x=>x.data.blocks[index].type=e.target.value));
      row.querySelector(".block-span").addEventListener("change",e=>mutate(x=>x.data.blocks[index].span=Number(e.target.value)));
      row.querySelector(".up").addEventListener("click",()=>mutate(x=>swapRows(x.data.blocks,index,-1)));
      row.querySelector(".down").addEventListener("click",()=>mutate(x=>swapRows(x.data.blocks,index,1)));
      row.querySelector(".del").addEventListener("click",()=>mutate(x=>x.data.blocks.splice(index,1)));

      const fields=row.querySelector(".block-fields");
      const appendField=(label,key,type="text")=>fields.appendChild(field(label,block[key]??"",v=>mutate(x=>x.data.blocks[index][key]=type==="number"?numberValue(v):v),type));
      if(block.type==="hero"){
        appendField("Title","title");appendField("Subtitle","subtitle");appendField("Value","value");
      }else if(block.type==="number"){
        appendField("Label","label");appendField("Value","value");
      }else if(block.type==="ring"||block.type==="progress"){
        appendField("Label","label");appendField("Value","value","number");appendField("Max","max","number");
      }else{
        appendField("Title","title");fields.appendChild(textareaField("Text",block.text||"",v=>mutate(x=>x.data.blocks[index].text=v)));
      }
      list.appendChild(row);
    });
    blocks.appendChild(list);

    const addWrap=document.createElement("div");addWrap.className="statboard-add-grid";
    ["hero","number","ring","progress","text"].forEach(type=>{
      const b=document.createElement("button");b.className="btn";b.textContent=`+ ${type}`;
      b.addEventListener("click",()=>mutate(x=>{
        const defaults={
          hero:{id:newItemId(),type:"hero",span:Math.min(2,x.settings.columns||2),title:"Hero",subtitle:"Subtitle",value:"96"},
          number:{id:newItemId(),type:"number",span:1,label:"Metric",value:"0"},
          ring:{id:newItemId(),type:"ring",span:1,label:"Rate",value:75,max:100},
          progress:{id:newItemId(),type:"progress",span:1,label:"Progress",value:80,max:100},
          text:{id:newItemId(),type:"text",span:Math.min(2,x.settings.columns||2),title:"Note",text:"Text"}
        };
        x.data.blocks.push(defaults[type]);
      }));
      addWrap.appendChild(b);
    });
    blocks.appendChild(addWrap);
    frag.appendChild(blocks);
  }

  const spreadsheet=buildSpreadsheetSection(p);
  if(spreadsheet)frag.appendChild(spreadsheet);

  return frag;
}

function buildStylePanel(){
  const p=current();
  const frag=document.createDocumentFragment();

  if(p.type==="ranking-card"){
    const templates=section(t("ranking.template"));
    const picker=document.createElement("div");picker.className="template-picker";
    Object.entries(RANKING_TEMPLATES).forEach(([id,def])=>{
      const b=document.createElement("button");
      b.type="button";
      b.className=`template-choice ${(p.settings.template||"sports")===id?"active":""}`;
      b.innerHTML=`<div class="template-choice-name">${id}</div><div class="template-choice-preview"></div>`;
      b.querySelector(".template-choice-preview").style.background=def.preview;
      b.addEventListener("click",()=>mutate(x=>applyRankingTemplate(x,id)));
      picker.appendChild(b);
    });
    templates.appendChild(picker);
    frag.appendChild(templates);
  }

  if(p.type==="stat-card"){
    const templates=section("Stat Card Template");
    const picker=document.createElement("div");picker.className="template-picker";
    Object.keys(STAT_TEMPLATES).forEach(id=>{
      const b=document.createElement("button");b.type="button";b.className=`template-choice ${(p.settings.template||"sports")===id?"active":""}`;
      b.innerHTML=`<div class="template-choice-name">${id}</div><div class="template-choice-preview stat-preview-${id}"></div>`;
      b.addEventListener("click",()=>mutate(x=>applyStatTemplate(x,id)));picker.appendChild(b);
    });templates.appendChild(picker);frag.appendChild(templates);
  }

  const themes=section(t("editor.theme"));
  const grid=document.createElement("div");grid.className="theme-grid";

  Object.values(THEMES).forEach(th=>{
    const b=document.createElement("button");
    b.className=`theme-btn ${p.style.theme===th.id?"active":""}`;
    b.style.background=th.bg;
    b.innerHTML=`<b>${th.id}</b><div class="theme-swatches"><i class="swatch" style="background:${th.surface}"></i><i class="swatch" style="background:${th.text}"></i><i class="swatch" style="background:${th.accent}"></i></div>`;
    b.addEventListener("click",()=>mutate(x=>applyTheme(x,th.id)));
    grid.appendChild(b);
  });
  themes.appendChild(grid);
  frag.appendChild(themes);

  const colors=section(t("editor.colors"));
  const defs=[
    ["background","editor.background"],
    ["surface","Surface"],
    ["primary","editor.textColor"],
    ["secondary","editor.mutedColor"],
    ["accent","editor.accent"],
    ["border","Border"]
  ];
  defs.forEach(([key,label])=>{
    const row=document.createElement("div");row.className="field";
    const l=document.createElement("label");l.textContent=label.startsWith("editor.")?t(label):label;
    const wrap=document.createElement("div");wrap.className="color-row";
    const c=document.createElement("input");c.type="color";c.className="color-input";c.value=p.style[key];
    const txt=document.createElement("input");txt.className="input";txt.value=p.style[key];
    c.addEventListener("input",()=>{txt.value=c.value;mutate(x=>x.style[key]=c.value,{historyCommit:false,panels:false})});
    c.addEventListener("change",()=>mutate(x=>x.style[key]=c.value));
    txt.addEventListener("change",()=>mutate(x=>x.style[key]=txt.value));
    wrap.append(c,txt);row.append(l,wrap);colors.appendChild(row);
  });
  frag.appendChild(colors);
  return frag;
}

function buildTextPanel(){
  const p=current();
  const frag=document.createDocumentFragment();
  const ty=section(t("editor.typography"));

  const font=document.createElement("div");font.className="field";
  const l=document.createElement("label");l.textContent="Font";
  const sel=document.createElement("select");sel.className="select";
  [
    ["system-ui","System / Noto"],
    ["Arial, sans-serif","Arial"],
    ["Georgia, serif","Serif"]
  ].forEach(([v,n])=>{
    const o=document.createElement("option");o.value=v;o.textContent=n;if(v===p.style.typography.fontFamily)o.selected=true;sel.appendChild(o)
  });
  sel.addEventListener("change",()=>mutate(x=>x.style.typography.fontFamily=sel.value));
  font.append(l,sel);ty.appendChild(font);

  ty.appendChild(field("Title Scale",p.style.typography.titleScale,v=>mutate(x=>x.style.typography.titleScale=Math.max(.6,Math.min(1.8,Number(v)||1))),"number",{step:"0.1",min:"0.6",max:"1.8"}));
  ty.appendChild(field("Body Scale",p.style.typography.bodyScale,v=>mutate(x=>x.style.typography.bodyScale=Math.max(.6,Math.min(1.8,Number(v)||1))),"number",{step:"0.1",min:"0.6",max:"1.8"}));
  frag.appendChild(ty);
  return frag;
}

function buildCanvasPanel(){
  const p=current();
  const frag=document.createDocumentFragment();
  const can=section(t("editor.canvasSize"));

  const seg=document.createElement("div");seg.className="segmented";
  Object.entries(CANVAS_PRESETS).forEach(([id,sz])=>{
    const b=document.createElement("button");
    b.className=`seg-btn ${p.canvas.preset===id?"active":""}`;
    b.textContent=id;
    b.addEventListener("click",()=>mutate(x=>applyCanvasPreset(x,id)));
    seg.appendChild(b);
  });
  can.appendChild(seg);

  const grid=document.createElement("div");grid.className="inline-grid";grid.style.marginTop="10px";
  grid.appendChild(field(t("editor.width"),p.canvas.width,v=>mutate(x=>{x.canvas.width=Math.max(320,numberValue(v));x.canvas.preset="custom"}),"number"));
  grid.appendChild(field(t("editor.height"),p.canvas.height,v=>mutate(x=>{x.canvas.height=Math.max(320,numberValue(v));x.canvas.preset="custom"}),"number"));
  can.appendChild(grid);

  const transparent=document.createElement("button");
  transparent.className=`btn ${p.canvas.transparent?"primary":""}`;
  transparent.textContent=p.canvas.transparent?(getLanguage()==="ja"?"透過背景 ON":"Transparent ON"):(getLanguage()==="ja"?"透過背景 OFF":"Transparent OFF");
  transparent.addEventListener("click",()=>mutate(x=>x.canvas.transparent=!x.canvas.transparent));
  can.appendChild(transparent);

  frag.appendChild(can);
  return frag;
}

function buildPanel(){
  if(activePanel==="data")return buildDataPanel();
  if(activePanel==="style")return buildStylePanel();
  if(activePanel==="text")return buildTextPanel();
  return buildCanvasPanel();
}

function panelLabel(panel){
  return t(`editor.${panel}`);
}

function renderPanels(){
  const desktop=$("panelContent");
  const mobile=$("mobilePanelContent");

  if(mobileQuery.matches){
    desktop.innerHTML="";
    mobile.innerHTML="";
    mobile.appendChild(buildPanel());
  }else{
    mobile.innerHTML="";
    desktop.innerHTML="";
    desktop.appendChild(buildPanel());
  }

  if($("mobilePanelTitle")){
    $("mobilePanelTitle").textContent=panelLabel(activePanel);
  }
}

function syncHistoryButtons(){
  const canUndo=history.canUndo();
  const canRedo=history.canRedo();

  ["undoBtn","mobileUndoBtn"].forEach(id=>{
    if($(id))$(id).disabled=!canUndo;
  });

  ["redoBtn","mobileRedoBtn"].forEach(id=>{
    if($(id))$(id).disabled=!canRedo;
  });
}

function renderSourceQuickBar(){
  const p=current();
  const model=getSourceModel(p);
  const bar=$("sourceQuickBar");

  if(!bar)return;
  bar.innerHTML="";

  if(!model || !p.settings.sourceLinked){
    bar.classList.add("hidden");
    document.body.classList.remove("source-linked");
    return;
  }

  document.body.classList.add("source-linked");
  bar.classList.remove("hidden");

  const lead=document.createElement("div");
  lead.className="source-quick-lead";
  lead.innerHTML=`<b>連動元</b><span></span>`;
  lead.querySelector("span").textContent=model.sheet.title||"Stats Maker";
  bar.appendChild(lead);

  const addSelect=(label,options,value,onChange)=>{
    const wrap=document.createElement("label");
    wrap.className="source-quick-select";
    const span=document.createElement("span");
    span.textContent=label;
    const select=document.createElement("select");
    options.forEach(opt=>{
      const o=document.createElement("option");
      o.value=String(opt.value);
      o.textContent=opt.label;
      o.selected=String(opt.value)===String(value);
      select.appendChild(o);
    });
    select.addEventListener("change",()=>onChange(select.value));
    wrap.append(span,select);
    bar.appendChild(wrap);
  };

  if(p.type==="stat-card" || p.type==="ring"){
    addSelect(
      "対象",
      getSubjectOptions(model),
      p.settings.sourceSubjectIndex??model.rows[0]?.rawIndex??"",
      value=>mutate(x=>syncSourceProject(x,{subjectIndex:Number(value)}))
    );
  }else if(["ranking-card","bar","dot","tier-list"].includes(p.type)){
    addSelect(
      "評価",
      getMetricOptions(model),
      p.settings.sourceMetricKey||model.metricKey,
      value=>mutate(x=>syncSourceProject(x,{metricKey:value}))
    );
  }else if(p.type==="quadrant" || p.type==="scatter"){
    addSelect(
      "X",
      getCriterionOptions(model),
      p.settings.sourceXIndex??0,
      value=>mutate(x=>syncSourceProject(x,{xIndex:Number(value)}))
    );
    addSelect(
      "Y",
      getCriterionOptions(model),
      p.settings.sourceYIndex??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{yIndex:Number(value)}))
    );
  }else if(p.type==="range"){
    addSelect(
      "A",
      getCriterionOptions(model),
      p.settings.sourceRangeA??0,
      value=>mutate(x=>syncSourceProject(x,{aIndex:Number(value)}))
    );
    addSelect(
      "B",
      getCriterionOptions(model),
      p.settings.sourceRangeB??Math.min(1,model.criteria.length-1),
      value=>mutate(x=>syncSourceProject(x,{bIndex:Number(value)}))
    );
  }else if(p.type==="radar"){
    const chips=document.createElement("div");
    chips.className="source-quick-chips";
    const current=new Set((p.settings.sourceSeriesIndices||[]).map(Number));
    model.rows.forEach(row=>{
      const button=document.createElement("button");
      button.type="button";
      button.className=`source-quick-chip ${current.has(row.rawIndex)?"active":""}`;
      button.textContent=row.name;
      button.addEventListener("click",()=>{
        const next=new Set(current);
        if(next.has(row.rawIndex))next.delete(row.rawIndex);
        else if(next.size<6)next.add(row.rawIndex);
        mutate(x=>syncSourceProject(x,{seriesIndices:[...next]}));
      });
      chips.appendChild(button);
    });
    bar.appendChild(chips);
  }
}

function renderHeader(){
  const p=current();
  $("projectTitleInput").value=p.meta.title||"";
  $("projectTitleInput").readOnly=!!p.settings.sourceLinked;
  $("projectTitleInput").classList.toggle("source-readonly",!!p.settings.sourceLinked);
  renderSourceQuickBar();
  syncHistoryButtons();

  $("langBtn").textContent=`🌐 ${getLanguage().toUpperCase()}`;
  if($("mobileLangBtn"))$("mobileLangBtn").textContent=getLanguage().toUpperCase();
  if($("mobilePanelTitle"))$("mobilePanelTitle").textContent=panelLabel(activePanel);
}

function render({panels=true}={}){
  applyI18n();
  renderHeader();
  renderPreview();
  if(panels)renderPanels();
}

function openMobileSheet(){
  if(!mobileQuery.matches)return;
  $("mobileSheetBackdrop").classList.remove("hidden");
  document.body.classList.add("sheet-open");
  renderPanels();
}

function closeMobileSheet(){
  $("mobileSheetBackdrop").classList.add("hidden");
  document.body.classList.remove("sheet-open");
}

function setPanel(panel,openMobile=false){
  activePanel=panel;
  document.querySelectorAll(".panel-tab,.mobile-tab").forEach(
    b=>b.classList.toggle("active",b.dataset.panel===panel)
  );
  renderPanels();
  if(openMobile)openMobileSheet();
}

function doUndo(){
  const p=history.undo();
  if(p){
    project=p;
    queueSave();
    render();
  }
}

function doRedo(){
  const p=history.redo();
  if(p){
    project=p;
    queueSave();
    render();
  }
}

function closeExportPreview(){
  $("exportPreviewModal").classList.add("hidden");
  $("exportPreviewImage").removeAttribute("src");
  if(exportPreviewUrl){
    URL.revokeObjectURL(exportPreviewUrl);
    exportPreviewUrl=null;
  }
  exportPreviewFile=null;
}

function showExportPreview(result){
  if(exportPreviewUrl)URL.revokeObjectURL(exportPreviewUrl);
  exportPreviewUrl=URL.createObjectURL(result.blob);
  exportPreviewFile=result.file;
  $("exportPreviewImage").src=exportPreviewUrl;
  $("exportPreviewTitle").textContent=result.mime==="image/jpeg"?"JPGプレビュー":"PNGプレビュー";
  $("exportPreviewModal").classList.remove("hidden");
}

async function shareExportPreview(){
  if(!exportPreviewFile)return;
  try{
    if(navigator.share && navigator.canShare?.({files:[exportPreviewFile]})){
      await navigator.share({files:[exportPreviewFile],title:exportPreviewFile.name});
      return;
    }
  }catch(e){
    if(e?.name==="AbortError")return;
    console.warn("Native share failed",e);
  }
  alert(getLanguage()==="ja"
    ?"共有シートを開けませんでした。表示中の画像を長押しして保存してください。"
    :"Sharing is unavailable. Long-press the image to save it.");
}

async function doExport(){
  const button=$("exportBtn");
  const oldText=button.textContent;
  try{
    button.disabled=true;
    button.textContent=getLanguage()==="ja"?"生成中…":"Rendering…";
    const result=await exportPreview($("previewRoot"),current(),"png");
    if(result.method==="preview")showExportPreview(result);
  }catch(e){
    console.error(e);
    alert(getLanguage()==="ja"
      ?`PNG生成に失敗しました\n${e?.message||""}`
      :`PNG export failed\n${e?.message||""}`);
  }finally{
    button.disabled=false;
    button.textContent=oldText;
  }
}

function fitPreview(){
  zoomTouched=false;
  fitZoomToStage();
  renderPreview();
}


function chooseProjectFile(){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept=".json,.statsmaker.json,application/json";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.click();
  });
}

function toggleMoreMenu(force){
  const menu=$("moreMenu");
  const show=typeof force==="boolean"?force:menu.classList.contains("hidden");
  menu.classList.toggle("hidden",!show);
}

document.querySelectorAll(".panel-tab").forEach(
  b=>b.addEventListener("click",()=>setPanel(b.dataset.panel,false))
);
document.querySelectorAll(".mobile-tab").forEach(
  b=>b.addEventListener("click",()=>setPanel(b.dataset.panel,true))
);

$("mobileSheetBackdrop").addEventListener("click",e=>{
  if(e.target===$("mobileSheetBackdrop"))closeMobileSheet();
});
$("mobileDoneBtn").addEventListener("click",closeMobileSheet);

$("projectTitleInput").addEventListener("change",e=>{
  if(current().settings?.sourceLinked){
    e.target.value=current().meta.title||"";
    return;
  }
  mutate(x=>x.meta.title=e.target.value);
});

$("undoBtn").addEventListener("click",doUndo);
$("redoBtn").addEventListener("click",doRedo);
$("mobileUndoBtn").addEventListener("click",doUndo);
$("mobileRedoBtn").addEventListener("click",doRedo);

$("langBtn").addEventListener("click",()=>{
  toggleLanguage();
  render();
});
$("mobileLangBtn").addEventListener("click",()=>{
  toggleLanguage();
  render();
});

$("zoomOutBtn").addEventListener("click",()=>{
  zoomTouched=true;
  zoom=Math.max(.18,zoom-.05);
  renderPreview();
});
$("zoomInBtn").addEventListener("click",()=>{
  zoomTouched=true;
  zoom=Math.min(1,zoom+.05);
  renderPreview();
});
$("fitZoomBtn").addEventListener("click",fitPreview);

$("exportBtn").addEventListener("click",doExport);
$("mobileExportBtn").addEventListener("click",doExport);
$("exportPreviewClose").addEventListener("click",closeExportPreview);
$("exportPreviewDismiss").addEventListener("click",closeExportPreview);
$("exportPreviewShare").addEventListener("click",shareExportPreview);
$("exportPreviewModal").addEventListener("click",e=>{
  if(e.target===$("exportPreviewModal"))closeExportPreview();
});

$("moreBtn").addEventListener("click",e=>{
  e.stopPropagation();
  toggleMoreMenu();
});
document.addEventListener("click",e=>{
  if(!$("moreMenu").contains(e.target) && e.target!==$("moreBtn"))toggleMoreMenu(false);
});
$("jpgBtn").addEventListener("click",async()=>{
  toggleMoreMenu(false);
  try{
    const result=await exportPreview($("previewRoot"),current(),"jpg");
    if(result.method==="preview")showExportPreview(result);
  }catch(e){
    console.error(e);
    alert(getLanguage()==="ja"
      ?`JPG生成に失敗しました\n${e?.message||""}`
      :`JPG export failed\n${e?.message||""}`);
  }
});

$("backupBtn").addEventListener("click",()=>{
  toggleMoreMenu(false);
  exportProjectJSON(current());
});
$("restoreBtn").addEventListener("click",async()=>{
  toggleMoreMenu(false);
  const file=await chooseProjectFile();
  if(!file)return;
  try{
    const loaded=await readProjectJSON(file);
    loaded.id=current().id;
    loaded.meta={...loaded.meta,updatedAt:new Date().toISOString()};
    project=history.commit(loaded);
    queueSave();
    zoomTouched=false;
    render();
    requestAnimationFrame(fitPreview);
  }catch(e){
    console.error(e);
    alert(getLanguage()==="ja"?"Projectを読み込めませんでした":"Could not load project");
  }
});

function handleViewportResize(){
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    const nowMobile=mobileQuery.matches;

    if(nowMobile!==lastMobileMode){
      lastMobileMode=nowMobile;
      if(!nowMobile)closeMobileSheet();
      renderPanels();
    }

    if(!zoomTouched){
      fitZoomToStage();
      renderPreview();
    }
  },90);
}

window.addEventListener("resize",handleViewportResize);
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",handleViewportResize);
}
window.addEventListener("beforeunload",()=>{
  try{saveProject(current())}catch{}
});

render();
requestAnimationFrame(()=>{
  fitZoomToStage();
  renderPreview();
});

});
__define("editor/image-editor.js",function(__require,__exports,__module){
"use strict";
const { saveImageFile,getImageUrl,deleteImage }=__require("core/images.js");

function imageFileFromClipboardEvent(event){
  const items=[...(event.clipboardData?.items||[])];
  for(const item of items){
    if(item.kind==="file" && item.type.startsWith("image/")){
      return item.getAsFile();
    }
  }
  return null;
}

function chooseFile(){
  return new Promise(resolve=>{
    const input=document.createElement("input");
    input.type="file";
    input.accept="image/*";
    input.onchange=()=>resolve(input.files?.[0]||null);
    input.click();
  });
}

function createImageManager({
  imageRef=null,
  shape="circle",
  label="Image",
  onChange,
  onShapeChange,
  allowShape=true
}){
  const box=document.createElement("div");
  box.className="image-manager";
  box.tabIndex=0;

  box.innerHTML=`
    <div class="image-manager-head">
      <span class="image-manager-label"></span>
      <button type="button" class="btn compact image-remove">Remove</button>
    </div>

    <div class="image-dropzone">
      <div class="image-preview ${shape}">
        <span class="image-placeholder">＋</span>
        <img alt="">
      </div>
      <div class="image-drop-copy">
        <b>Upload image</b>
        <small>Tap / Drop / Paste</small>
      </div>
    </div>

    <div class="image-manager-actions">
      <button type="button" class="btn image-upload">Upload</button>
      <button type="button" class="btn image-paste">Paste</button>
    </div>

    <div class="image-shape-row ${allowShape?"":"hidden"}">
      <button type="button" data-shape="circle">Circle</button>
      <button type="button" data-shape="square">Square</button>
      <button type="button" data-shape="rounded">Rounded</button>
      <button type="button" data-shape="original">Original</button>
    </div>

    <div class="image-manager-status"></div>
  `;

  box.querySelector(".image-manager-label").textContent=label;

  const drop=box.querySelector(".image-dropzone");
  const preview=box.querySelector(".image-preview");
  const img=box.querySelector("img");
  const placeholder=box.querySelector(".image-placeholder");
  const removeBtn=box.querySelector(".image-remove");
  const status=box.querySelector(".image-manager-status");

  function setStatus(text,type=""){
    status.textContent=text||"";
    status.className=`image-manager-status ${type}`;
  }

  function updateShape(next){
    preview.className=`image-preview ${next}`;
    box.querySelectorAll("[data-shape]").forEach(b=>{
      b.classList.toggle("active",b.dataset.shape===next);
    });
  }

  updateShape(shape);

  async function hydrate(){
    if(!imageRef){
      img.removeAttribute("src");
      img.classList.add("hidden");
      placeholder.classList.remove("hidden");
      removeBtn.disabled=true;
      return;
    }
    try{
      const url=await getImageUrl(imageRef);
      if(url){
        img.src=url;
        img.classList.remove("hidden");
        placeholder.classList.add("hidden");
        removeBtn.disabled=false;
      }else{
        img.classList.add("hidden");
        placeholder.classList.remove("hidden");
        removeBtn.disabled=true;
      }
    }catch(e){
      console.error(e);
      setStatus("Image load failed","error");
    }
  }

  async function acceptFile(file){
    if(!file)return;
    try{
      setStatus("Optimizing...");
      const saved=await saveImageFile(file,{maxDimension:1200,quality:.86});
      const old=imageRef;
      imageRef=saved.id;

      if(old && old!==imageRef){
        deleteImage(old).catch(console.warn);
      }

      await hydrate();
      setStatus(`${saved.width}×${saved.height} saved`,"ok");
      onChange?.(imageRef,saved);
    }catch(e){
      console.error(e);
      setStatus(e?.message||"Image failed","error");
    }
  }

  drop.addEventListener("click",async()=>acceptFile(await chooseFile()));
  box.querySelector(".image-upload").addEventListener("click",async()=>acceptFile(await chooseFile()));

  box.querySelector(".image-paste").addEventListener("click",async()=>{
    try{
      if(!navigator.clipboard?.read){
        setStatus("Use Ctrl/Cmd+V or long press paste","warn");
        box.focus();
        return;
      }
      const items=await navigator.clipboard.read();
      for(const item of items){
        const imageType=item.types.find(t=>t.startsWith("image/"));
        if(imageType){
          const blob=await item.getType(imageType);
          const file=new File([blob],"clipboard-image",{type:imageType});
          await acceptFile(file);
          return;
        }
      }
      setStatus("No image in clipboard","warn");
    }catch(e){
      setStatus("Use Ctrl/Cmd+V or long press paste","warn");
      box.focus();
    }
  });

  box.addEventListener("paste",async e=>{
    const file=imageFileFromClipboardEvent(e);
    if(file){
      e.preventDefault();
      await acceptFile(file);
    }
  });

  ["dragenter","dragover"].forEach(type=>{
    drop.addEventListener(type,e=>{
      e.preventDefault();
      drop.classList.add("dragging");
    });
  });
  ["dragleave","drop"].forEach(type=>{
    drop.addEventListener(type,e=>{
      e.preventDefault();
      drop.classList.remove("dragging");
    });
  });
  drop.addEventListener("drop",async e=>{
    const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith("image/"));
    await acceptFile(file);
  });

  removeBtn.addEventListener("click",async()=>{
    const old=imageRef;
    imageRef=null;
    await hydrate();
    setStatus("");
    onChange?.(null,null);
    if(old)deleteImage(old).catch(console.warn);
  });

  box.querySelectorAll("[data-shape]").forEach(b=>{
    b.addEventListener("click",()=>{
      shape=b.dataset.shape;
      updateShape(shape);
      onShapeChange?.(shape);
    });
  });

  hydrate();
  return box;
}

Object.assign(__exports,{createImageManager});

});
__define("editor/spreadsheet-editor.js",function(__require,__exports,__module){
"use strict";
function createSpreadsheetEditor({
  columns=[],
  rows=[],
  onCellChange,
  onAdd,
  onDelete,
  onMove
}){
  const wrap=document.createElement("div");
  wrap.className="sheet-editor-wrap";

  const scroller=document.createElement("div");
  scroller.className="sheet-editor-scroll";

  const table=document.createElement("table");
  table.className="sheet-editor-table";

  const thead=document.createElement("thead");
  const hr=document.createElement("tr");
  const orderHead=document.createElement("th");
  orderHead.textContent="#";
  hr.appendChild(orderHead);

  columns.forEach(col=>{
    const th=document.createElement("th");
    th.textContent=col.label;
    hr.appendChild(th);
  });

  const actionHead=document.createElement("th");
  actionHead.textContent="";
  hr.appendChild(actionHead);
  thead.appendChild(hr);

  const tbody=document.createElement("tbody");

  rows.forEach((row,rowIndex)=>{
    const tr=document.createElement("tr");

    const order=document.createElement("td");
    order.className="sheet-order";
    order.textContent=String(rowIndex+1);
    tr.appendChild(order);

    columns.forEach(col=>{
      const td=document.createElement("td");
      const input=document.createElement("input");
      input.className="sheet-cell";
      input.type=col.type||"text";
      input.value=row?.[col.key]??"";
      if(col.min!==undefined)input.min=String(col.min);
      if(col.max!==undefined)input.max=String(col.max);
      if(col.step!==undefined)input.step=String(col.step);
      input.addEventListener("change",()=>{
        const value=input.type==="number"
          ? (Number.isFinite(Number(input.value))?Number(input.value):0)
          : input.value;
        onCellChange?.(rowIndex,col.key,value);
      });
      td.appendChild(input);
      tr.appendChild(td);
    });

    const actions=document.createElement("td");
    actions.className="sheet-actions";
    actions.innerHTML=`
      <button type="button" data-act="up">↑</button>
      <button type="button" data-act="down">↓</button>
      <button type="button" data-act="delete">×</button>
    `;
    actions.querySelector('[data-act="up"]').disabled=rowIndex===0;
    actions.querySelector('[data-act="down"]').disabled=rowIndex===rows.length-1;
    actions.querySelector('[data-act="up"]').addEventListener("click",()=>onMove?.(rowIndex,-1));
    actions.querySelector('[data-act="down"]').addEventListener("click",()=>onMove?.(rowIndex,1));
    actions.querySelector('[data-act="delete"]').addEventListener("click",()=>onDelete?.(rowIndex));
    tr.appendChild(actions);

    tbody.appendChild(tr);
  });

  table.append(thead,tbody);
  scroller.appendChild(table);
  wrap.appendChild(scroller);

  const footer=document.createElement("div");
  footer.className="sheet-editor-footer";
  const add=document.createElement("button");
  add.type="button";
  add.className="btn";
  add.textContent="+ Row";
  add.addEventListener("click",()=>onAdd?.());
  footer.appendChild(add);
  wrap.appendChild(footer);

  return wrap;
}

Object.assign(__exports,{createSpreadsheetEditor});

});
__define("home.js",function(__require,__exports,__module){
"use strict";
const { t,getLanguage,toggleLanguage,applyI18n }=__require("core/i18n.js");
const { createProject,cloneProject }=__require("core/project.js");
const { listProjects,saveProject,deleteProject }=__require("core/store.js");

const createDefs=[
  {type:"ranking-card",label:"viz.ranking",desc:"viz.rankingDesc",preview:"ranking",category:"Popular"},
  {type:"stat-card",label:"viz.stat",desc:"viz.statDesc",preview:"stat",category:"Popular"},
  {type:"bar",label:"viz.bar",desc:"viz.barDesc",preview:"bar",category:"Popular"},
  {type:"radar",label:"viz.radar",desc:"viz.radarDesc",preview:"radar",category:"Popular"},
  {type:"quadrant",label:"viz.quadrant",desc:"viz.quadrantDesc",preview:"quadrant",category:"Compare"},
  {type:"dot",label:"viz.dot",desc:"viz.dotDesc",preview:"dot",category:"Compare"},
  {type:"range",label:"viz.range",desc:"viz.rangeDesc",preview:"range",category:"Compare"},
  {type:"scatter",label:"viz.scatter",desc:"viz.scatterDesc",preview:"scatter",category:"Compare"},
  {type:"heatmap",label:"viz.heatmap",desc:"viz.heatmapDesc",preview:"heatmap",category:"Analyze"},
  {type:"tier-list",label:"viz.tier",desc:"viz.tierDesc",preview:"tier",category:"Ranking"},
  {type:"ring",label:"viz.ring",desc:"viz.ringDesc",preview:"ring",category:"Show a Number"},
  {type:"waffle",label:"viz.waffle",desc:"viz.waffleDesc",preview:"waffle",category:"Show a Number"},
  {type:"stat-board",label:"viz.statBoard",desc:"viz.statBoardDesc",preview:"statboard",category:"Advanced"}
];

function previewMarkup(kind){
  if(kind==="ranking")return `<div class="mini-ranking"><div class="mini-rank-row"><b>1</b><span>対象A</span><b>92</b></div><div class="mini-rank-row"><b>2</b><span>対象B</span><b>86</b></div><div class="mini-rank-row"><b>3</b><span>対象C</span><b>80</b></div></div>`;
  if(kind==="stat")return `<div class="mini-stat"><div><div class="ovr">94</div><div class="name">対象A</div></div><div class="mini-stat-grid"><span>評価1 92</span><span>評価2 91</span><span>評価3 88</span><span>評価4 95</span></div></div>`;
  if(kind==="quadrant")return `<div class="mini-quadrant"><i class="mini-dot d1"></i><i class="mini-dot d2"></i><i class="mini-dot d3"></i><i class="mini-dot d4"></i></div>`;
  if(kind==="bar")return `<div class="mini-bar"><div><span>A</span><i style="width:92%"></i></div><div><span>B</span><i style="width:78%"></i></div><div><span>C</span><i style="width:64%"></i></div><div><span>D</span><i style="width:48%"></i></div></div>`;
  if(kind==="radar")return `<div class="mini-radar"><svg viewBox="0 0 100 100"><polygon points="50,7 90,31 82,78 50,94 14,77 10,31" class="grid"></polygon><polygon points="50,17 82,34 74,70 50,82 24,69 20,34" class="shape a"></polygon><polygon points="50,24 72,38 80,72 50,73 31,63 27,39" class="shape b"></polygon></svg></div>`;
  if(kind==="dot")return `<div class="mini-generic mini-dot-preview"><i style="left:82%"></i><i style="left:62%"></i><i style="left:42%"></i></div>`;
  if(kind==="ring")return `<div class="mini-ring-preview"><i></i><i></i><i></i></div>`;
  if(kind==="tier")return `<div class="mini-tier-preview"><b>S</b><span></span><b>A</b><span></span><b>B</b><span></span></div>`;
  if(kind==="heatmap")return `<div class="mini-heatmap-preview">${Array.from({length:20},(_,i)=>`<i style="opacity:${.2+(i%5)*.18}"></i>`).join("")}</div>`;
  if(kind==="scatter")return `<div class="mini-scatter-preview"><i class="s1"></i><i class="s2"></i><i class="s3"></i><i class="s4"></i></div>`;
  if(kind==="range")return `<div class="mini-range-preview"><span><i></i><b></b></span><span><i></i><b></b></span><span><i></i><b></b></span></div>`;
  if(kind==="waffle")return `<div class="mini-waffle-preview">${Array.from({length:50},(_,i)=>`<i class="${i<28?"on":""}"></i>`).join("")}</div>`;
  return `<div class="mini-statboard-preview"><b>96</b><span></span><span></span><i></i><i></i></div>`;
}

function renderCreate(){
  const grid=document.getElementById("createGrid");
  grid.innerHTML="";
  const groups=[...new Set(createDefs.map(d=>d.category))];

  groups.forEach(category=>{
    const section=document.createElement("section");
    section.className="create-category";
    section.innerHTML=`<div class="create-category-title"></div><div class="category-grid"></div>`;
    section.querySelector(".create-category-title").textContent=category;

    const inner=section.querySelector(".category-grid");
    createDefs.filter(d=>d.category===category).forEach(def=>{
      const card=document.createElement("article");
      card.className="template-card";
      card.innerHTML=`
        <div class="template-preview">${previewMarkup(def.preview)}</div>
        <div class="template-copy">
          <div class="template-title">${t(def.label)}</div>
          <div class="template-desc">${t(def.desc)}</div>
          <div class="template-actions"><button class="btn primary">${getLanguage()==="ja"?"作る":"Create"}</button></div>
        </div>
      `;
      card.querySelector("button").addEventListener("click",()=>{
        const p=createProject(def.type);
        saveProject(p);
        location.href=`editor.html?id=${encodeURIComponent(p.id)}`;
      });
      inner.appendChild(card);
    });

    grid.appendChild(section);
  });
}

function renderProjects(){
  const grid=document.getElementById("projectGrid");
  const empty=document.getElementById("emptyProjects");
  const list=listProjects();
  grid.innerHTML="";
  empty.classList.toggle("hidden",list.length>0);

  list.forEach(p=>{
    const card=document.createElement("article");
    card.className="project-card";
    const date=new Date(p.meta.updatedAt||Date.now()).toLocaleString(getLanguage()==="ja"?"ja-JP":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
    card.innerHTML=`
      <div class="project-card-head">
        <div>
          <div class="project-type">${p.type}</div>
          <div class="project-title"></div>
        </div>
      </div>
      <div class="project-meta">${date}</div>
      <div class="project-actions">
        <button class="btn primary open">${t("common.open")}</button>
        <button class="btn duplicate">${t("common.duplicate")}</button>
        <button class="btn delete">${t("common.delete")}</button>
      </div>
    `;
    card.querySelector(".project-title").textContent=p.meta.title||"Untitled";
    card.querySelector(".open").addEventListener("click",()=>location.href=`editor.html?id=${encodeURIComponent(p.id)}`);
    card.querySelector(".duplicate").addEventListener("click",()=>{
      saveProject(cloneProject(p));
      renderProjects();
    });
    card.querySelector(".delete").addEventListener("click",()=>{
      if(confirm(getLanguage()==="ja"?"このProjectを削除しますか？":"Delete this project?")){
        deleteProject(p.id);
        renderProjects();
      }
    });
    grid.appendChild(card);
  });
}

function refresh(){
  applyI18n();
  document.getElementById("langBtn").textContent=`🌐 ${getLanguage().toUpperCase()}`;
  renderCreate();
  renderProjects();
}

document.getElementById("langBtn").addEventListener("click",()=>{
  toggleLanguage();
  refresh();
});
refresh();

});
__define("visualizations/bar.js",function(__require,__exports,__module){
"use strict";
function safeNumber(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

const barChart={
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

Object.assign(__exports,{barChart});

});
__define("visualizations/dot.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
const dotChart={
  id:"dot",labelKey:"viz.dot",
  validate:p=>Array.isArray(p.data?.items),
  render(project,root){
    const s={min:0,max:100,autoRange:false,unit:"",showValues:true,showGrid:true,...project.settings};
    const items=(project.data.items||[]).filter(x=>x.enabled!==false);
    let min=n(s.min),max=n(s.max);
    if(s.autoRange && items.length){
      const vals=items.map(x=>n(x.value));
      min=Math.min(...vals);max=Math.max(...vals);
      const pad=Math.max(1,(max-min)*.12);min-=pad;max+=pad;
    }
    if(max<=min)max=min+1;
    root.innerHTML="";
    const w=document.createElement("div");
    w.className="visual dot-visual";
    w.innerHTML=`<div class="generic-kicker">DOT CHART</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="dot-axis-head"><span></span><span></span></div><div class="dot-list"></div>`;
    w.querySelector(".generic-title").textContent=project.meta.title||"Dot Chart";
    w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";
    const heads=w.querySelectorAll(".dot-axis-head span");heads[0].textContent=Math.round(min);heads[1].textContent=Math.round(max);
    const list=w.querySelector(".dot-list");
    items.forEach(item=>{
      const val=n(item.value),pct=Math.max(0,Math.min(100,(val-min)/(max-min)*100));
      const row=document.createElement("div");row.className="dot-row";
      row.innerHTML=`<div><b class="dot-name"></b><small class="dot-cat"></small></div><div class="dot-track"><i class="dot-guide"></i><i class="dot-marker"></i></div><div class="dot-value"></div>`;
      row.querySelector(".dot-name").textContent=item.name||"";
      row.querySelector(".dot-cat").textContent=item.category||"";
      row.querySelector(".dot-marker").style.left=`${pct}%`;
      row.querySelector(".dot-guide").style.display=s.showGrid===false?"none":"block";
      row.querySelector(".dot-value").textContent=s.showValues===false?"":`${val}${s.unit||""}`;
      list.appendChild(row);
    });
    root.appendChild(w);
  }
};
Object.assign(__exports,{dotChart});

});
__define("visualizations/heatmap.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
const heatmap={
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
Object.assign(__exports,{heatmap});

});
__define("visualizations/quadrant.js",function(__require,__exports,__module){
"use strict";
const { getImageUrl }=__require("core/images.js");

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

const quadrant={
  id:"quadrant",
  labelKey:"viz.quadrant",

  validate(project){
    return project.data.items.every(x=>Number.isFinite(Number(x.x))&&Number.isFinite(Number(x.y)));
  },

  async render(project,root){
    root.innerHTML="";
    const wrap=document.createElement("div");
    wrap.className="visual quadrant-visual";
    wrap.innerHTML=`
      <div class="quad-head">
        <div class="viz-title quad-title"></div>
        <div class="viz-subtitle quad-subtitle"></div>
      </div>
      <div class="quad-chart">
        <div class="quad-vline"></div>
        <div class="quad-hline"></div>
        <div class="quad-label tl"></div>
        <div class="quad-label tr"></div>
        <div class="quad-label bl"></div>
        <div class="quad-label br"></div>
        <div class="axis-x"></div>
        <div class="axis-y"></div>
      </div>
    `;

    wrap.querySelector(".quad-title").textContent=project.meta.title||"Quadrant";
    wrap.querySelector(".quad-subtitle").textContent=project.meta.subtitle||"";

    const chart=wrap.querySelector(".quad-chart");
    const x=project.settings.xAxis;
    const y=project.settings.yAxis;
    const xSplit=((x.split-x.min)/(x.max-x.min))*100;
    const ySplit=((y.split-y.min)/(y.max-y.min))*100;

    wrap.querySelector(".quad-vline").style.left=`${clamp(xSplit,0,100)}%`;
    wrap.querySelector(".quad-hline").style.bottom=`${clamp(ySplit,0,100)}%`;

    const q=project.settings.quadrants;
    wrap.querySelector(".tl").textContent=q.topLeft||"";
    wrap.querySelector(".tr").textContent=q.topRight||"";
    wrap.querySelector(".bl").textContent=q.bottomLeft||"";
    wrap.querySelector(".br").textContent=q.bottomRight||"";
    wrap.querySelector(".axis-x").textContent=x.label||"X";
    wrap.querySelector(".axis-y").textContent=y.label||"Y";

    const placed=[];
    for (const item of (project.data.items||[]).filter(i=>i.enabled!==false)) {
      const xp=((Number(item.x)-x.min)/(x.max-x.min))*100;
      const yp=((Number(item.y)-y.min)/(y.max-y.min))*100;
      const cluster=placed.filter(p=>Math.hypot(p.x-xp,p.y-yp)<12).length;
      placed.push({x:xp,y:yp});
      const point=document.createElement("div");
      point.className=`quad-point label-offset-${cluster%4}`;
      point.style.left=`${clamp(xp,0,100)}%`;
      point.style.bottom=`${clamp(yp,0,100)}%`;
      point.innerHTML=`<span class="quad-point-dot"></span><span class="quad-point-name"></span>`;
      const dot=point.querySelector(".quad-point-dot");
      if(item.imageRef){
        try{
          const url=await getImageUrl(item.imageRef);
          if(url){
            dot.style.backgroundImage=`url("${url}")`;
            dot.classList.add("has-image",`shape-${item.imageShape||"circle"}`);
          }
        }catch(e){
          console.warn("Quadrant image load failed",e);
        }
      }
      point.querySelector(".quad-point-name").textContent=item.name||"";
      chart.appendChild(point);
    }

    root.appendChild(wrap);
  }
};

Object.assign(__exports,{quadrant});

});
__define("visualizations/radar.js",function(__require,__exports,__module){
"use strict";
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

const radarChart={
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

Object.assign(__exports,{radarChart});

});
__define("visualizations/range.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
const rangeChart={
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
Object.assign(__exports,{rangeChart});

});
__define("visualizations/ranking-card.js",function(__require,__exports,__module){
"use strict";
const { getImageUrl }=__require("core/images.js");

function initials(name=""){
  const s=String(name).trim();
  if(!s)return "?";
  const parts=s.split(/\s+/).filter(Boolean);
  if(parts.length>=2)return (parts[0][0]+parts[1][0]).toUpperCase();
  return s.slice(0,2).toUpperCase();
}

function safeNumber(v){
  const n=Number(v);
  return Number.isFinite(n)?n:0;
}

const rankingCard={
  id:"ranking-card",
  labelKey:"viz.ranking",

  validate(project){
    return Array.isArray(project.data?.items) &&
      project.data.items.every(x=>x.name && Number.isFinite(Number(x.value)));
  },

  async render(project,root){
    const settings={
      template:"sports",
      unit:"PTS",
      topN:10,
      showRank:true,
      showNote:true,
      showCategory:true,
      highlightTop3:true,
      showBars:true,
      headerLabel:"POWER RANKING",
      density:"comfortable",
      tieMode:"competition",
      ...project.settings
    };

    // Important: display order follows the stored row order.
    // Auto-sort is an explicit editor action, so score edits never reorder unexpectedly.
    const items=(project.data.items||[])
      .filter(x=>x.enabled!==false)
      .slice(0,Math.max(1,Math.min(20,Number(settings.topN)||10)));

    const maxValue=Math.max(1,...items.map(x=>safeNumber(x.value)));
    let lastValue=null;
    let lastRank=0;

    root.innerHTML="";
    const wrap=document.createElement("div");
    const countClass=items.length<=5?"ranking-count-short":items.length<=10?"ranking-count-medium":"ranking-count-long";
    wrap.className=`visual ranking-visual ranking-template-${settings.template} ${countClass} density-${settings.density}`;

    wrap.innerHTML=`
      <div class="ranking-kicker"></div>
      <div class="ranking-head">
        <div>
          <div class="viz-title ranking-title"></div>
          <div class="viz-subtitle ranking-subtitle"></div>
        </div>
        <div class="ranking-count-badge"></div>
      </div>
      <div class="ranking-rule"></div>
      <div class="ranking-list"></div>
    `;

    wrap.querySelector(".ranking-kicker").textContent=settings.headerLabel||"";
    wrap.querySelector(".ranking-title").textContent=project.meta.title||"Ranking";
    wrap.querySelector(".ranking-subtitle").textContent=project.meta.subtitle||"";
    wrap.querySelector(".ranking-count-badge").textContent=`TOP ${items.length}`;

    const list=wrap.querySelector(".ranking-list");

    for (const [index,item] of items.entries()) {
      const val=safeNumber(item.value);
      if(val!==lastValue){
        lastRank=index+1;
        lastValue=val;
      }

      const row=document.createElement("div");
      const topClass=settings.highlightTop3 && lastRank<=3?` rank-top-${lastRank}`:"";
      row.className=`ranking-row${topClass}`;

      const ratio=Math.max(0,Math.min(100,(val/maxValue)*100));
      row.innerHTML=`
        <div class="ranking-bar-bg"><i></i></div>
        <div class="ranking-rank-wrap">
          <span class="ranking-rank"></span>
        </div>
        <div class="ranking-avatar"><span></span></div>
        <div class="ranking-copy">
          <div class="ranking-name"></div>
          <div class="ranking-meta">
            <span class="ranking-category"></span>
            <span class="ranking-meta-dot">•</span>
            <span class="ranking-note"></span>
          </div>
        </div>
        <div class="ranking-value">
          <span class="value"></span>
          <span class="ranking-unit"></span>
        </div>
      `;

      row.querySelector(".ranking-bar-bg").style.display=settings.showBars?"block":"none";
      row.querySelector(".ranking-bar-bg i").style.width=`${ratio}%`;

      const rankEl=row.querySelector(".ranking-rank");
      rankEl.textContent=settings.showRank===false?"":String(lastRank);

      const avatar=row.querySelector(".ranking-avatar");
      const avatarText=avatar.querySelector("span");
      avatarText.textContent=initials(item.name);
      if(item.imageData){
        avatar.style.backgroundImage=`url("${item.imageData}")`;
        avatar.classList.add("has-image",`shape-${item.imageShape||"circle"}`);
      }else if(item.imageRef){
        try{
          const imageUrl=await getImageUrl(item.imageRef);
          if(imageUrl){
            avatar.style.backgroundImage=`url("${imageUrl}")`;
            avatar.classList.add("has-image",`shape-${item.imageShape||"circle"}`);
          }
        }catch(e){
          console.warn("Ranking image load failed",e);
        }
      }

      row.querySelector(".ranking-name").textContent=item.name||"";
      const cat=row.querySelector(".ranking-category");
      const note=row.querySelector(".ranking-note");
      const dot=row.querySelector(".ranking-meta-dot");

      cat.textContent=settings.showCategory===false?"":(item.category||"");
      note.textContent=settings.showNote===false?"":(item.note||"");

      const catVisible=!!cat.textContent;
      const noteVisible=!!note.textContent;
      dot.style.display=catVisible && noteVisible?"inline":"none";
      row.querySelector(".ranking-meta").style.display=(catVisible||noteVisible)?"flex":"none";

      row.querySelector(".value").textContent=Number.isInteger(val)?String(val):val.toFixed(1);
      row.querySelector(".ranking-unit").textContent=settings.unit||"";

      list.appendChild(row);
    }

    root.appendChild(wrap);
  }
};

Object.assign(__exports,{rankingCard});

});
__define("visualizations/registry.js",function(__require,__exports,__module){
"use strict";
const { rankingCard }=__require("visualizations/ranking-card.js");
const { statCard }=__require("visualizations/stat-card.js");
const { quadrant }=__require("visualizations/quadrant.js");
const { barChart }=__require("visualizations/bar.js");
const { radarChart }=__require("visualizations/radar.js");
const { dotChart }=__require("visualizations/dot.js");
const { ringGauge }=__require("visualizations/ring.js");
const { tierList }=__require("visualizations/tier-list.js");
const { heatmap }=__require("visualizations/heatmap.js");
const { scatterChart }=__require("visualizations/scatter.js");
const { rangeChart }=__require("visualizations/range.js");
const { waffleChart }=__require("visualizations/waffle.js");
const { statBoard }=__require("visualizations/stat-board.js");

const VISUALIZATIONS={
  [rankingCard.id]:rankingCard,
  [statCard.id]:statCard,
  [quadrant.id]:quadrant,
  [barChart.id]:barChart,
  [radarChart.id]:radarChart,
  [dotChart.id]:dotChart,
  [ringGauge.id]:ringGauge,
  [tierList.id]:tierList,
  [heatmap.id]:heatmap,
  [scatterChart.id]:scatterChart,
  [rangeChart.id]:rangeChart,
  [waffleChart.id]:waffleChart,
  [statBoard.id]:statBoard
};

function getVisualization(type){
  return VISUALIZATIONS[type]||null;
}

Object.assign(__exports,{getVisualization,VISUALIZATIONS});

});
__define("visualizations/ring.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
const ringGauge={
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
Object.assign(__exports,{ringGauge});

});
__define("visualizations/scatter.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
const scatterChart={
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
Object.assign(__exports,{scatterChart});

});
__define("visualizations/stat-board.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}

const statBoard={
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

Object.assign(__exports,{statBoard});

});
__define("visualizations/stat-card.js",function(__require,__exports,__module){
"use strict";
const { getImageUrl }=__require("core/images.js");

const statCard={
  id:"stat-card",
  labelKey:"viz.stat",

  validate(project){
    return !!project.data.name && Array.isArray(project.data.stats);
  },

  async render(project,root){
    root.innerHTML="";
    const wrap=document.createElement("div");
    wrap.className=`visual stat-card-visual stat-template-${project.settings?.template||"sports"}`;

    const card=document.createElement("div");
    card.className="player-card";
    card.innerHTML=`
      <div class="stat-hero">
        <div class="stat-image-wrap">
          <div class="stat-image-placeholder">IMAGE</div>
          <img class="stat-image hidden" alt="">
        </div>
        <div class="stat-top">
          <div>
            <div class="stat-name"></div>
            <div class="stat-subtitle"></div>
          </div>
          <div class="ovr-box">
          <div class="ovr-label">OVR</div>
            <div class="ovr-value"></div>
          </div>
        </div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-grid"></div>
      <div class="stat-footer">
        <span class="team"></span>
        <span class="tier"></span>
      </div>
    `;

    const imageWrap=card.querySelector(".stat-image-wrap");
    const imageEl=card.querySelector(".stat-image");
    imageWrap.classList.add(`shape-${project.data.imageShape||"rounded"}`);
    if(project.data.imageData){
      imageEl.src=project.data.imageData;
      imageEl.classList.remove("hidden");
      card.querySelector(".stat-image-placeholder").classList.add("hidden");
    }else if(project.data.imageRef){
      try{
        const url=await getImageUrl(project.data.imageRef);
        if(url){
          imageEl.src=url;
          imageEl.classList.remove("hidden");
          card.querySelector(".stat-image-placeholder").classList.add("hidden");
        }
      }catch(e){
        console.warn("Stat image load failed",e);
      }
    }

    const displayName=project.data.name||project.meta.title||"";
    const nameEl=card.querySelector(".stat-name");
    nameEl.textContent=displayName;
    nameEl.classList.toggle("long-name",[...displayName].length>=9);
    card.querySelector(".stat-subtitle").textContent=project.data.subtitle||project.meta.subtitle||"";
    card.querySelector(".ovr-value").textContent=project.data.overall??0;
    card.querySelector(".team").textContent=project.data.team||"";
    card.querySelector(".tier").textContent=project.data.tier?`TIER ${project.data.tier}`:"";

    const grid=card.querySelector(".stat-grid");
    (project.data.stats||[]).slice(0,12).forEach(stat=>{
      const cell=document.createElement("div");
      cell.className="stat-cell";
      cell.innerHTML=`<div class="stat-label"></div><div class="stat-value"></div>`;
      cell.querySelector(".stat-label").textContent=stat.label||"STAT";
      const value=Number(stat.value);
      cell.querySelector(".stat-value").textContent=Number.isFinite(value)
        ? (Number.isInteger(value)?String(value):value.toFixed(1))
        : "—";
      grid.appendChild(cell);
    });

    wrap.appendChild(card);
    root.appendChild(wrap);
  }
};

Object.assign(__exports,{statCard});

});
__define("visualizations/tier-list.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function autoTier(item,tiers){
  const v=n(item.value);
  return tiers.find(t=>v>=n(t.min)&&v<=n(t.max))?.label || tiers[tiers.length-1]?.label || "";
}
const tierList={
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
Object.assign(__exports,{tierList});

});
__define("visualizations/waffle.js",function(__require,__exports,__module){
"use strict";
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
const waffleChart={
  id:"waffle",labelKey:"viz.waffle",
  validate:p=>Array.isArray(p.data?.categories),
  render(project,root){
    const s={cells:100,columns:10,unit:"%",showLegend:true,...project.settings};const cells=Math.max(10,Math.min(200,Number(s.cells)||100)),cols=Math.max(5,Math.min(20,Number(s.columns)||10));const cats=project.data.categories||[],total=Math.max(1,cats.reduce((a,c)=>a+n(c.value),0));const palette=["var(--visual-accent)","#35D07F","#F5B54C","#B673FF","#FF7284","#48C7D9"];let allocations=cats.map(c=>Math.round(n(c.value)/total*cells));let delta=cells-allocations.reduce((a,b)=>a+b,0);if(allocations.length)allocations[0]+=delta;
    root.innerHTML="";const w=document.createElement("div");w.className="visual waffle-visual";w.innerHTML=`<div class="generic-kicker">WAFFLE</div><div class="viz-title generic-title"></div><div class="viz-subtitle generic-subtitle"></div><div class="waffle-layout"><div class="waffle-grid"></div><div class="waffle-legend"></div></div>`;w.querySelector(".generic-title").textContent=project.meta.title||"Waffle";w.querySelector(".generic-subtitle").textContent=project.meta.subtitle||"";const grid=w.querySelector(".waffle-grid");grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;let ci=0,remaining=allocations[0]||0;for(let i=0;i<cells;i++){while(ci<cats.length-1&&remaining<=0){ci++;remaining=allocations[ci]||0}const cell=document.createElement("i");cell.style.background=palette[ci%palette.length];grid.appendChild(cell);remaining--}const leg=w.querySelector(".waffle-legend");if(s.showLegend!==false)cats.forEach((c,i)=>{const row=document.createElement("div");row.innerHTML=`<i></i><span></span><b></b>`;row.querySelector("i").style.background=palette[i%palette.length];row.querySelector("span").textContent=c.label||"";row.querySelector("b").textContent=`${c.value}${s.unit||""}`;leg.appendChild(row)});else leg.style.display="none";root.appendChild(w);
  }
};
Object.assign(__exports,{waffleChart});

});

window.StatsMakerRequire=__require;
window.StatsMakerRuntimeReady=true;
})();
