import {getImageUrl} from "./images.js";

// Shared renderer for preview and PNG/JPG export: Safari receives the exact
// same Canvas pixels as desktop, avoiding html2canvas/SVG image differences.
const imageCache=new Map();
const palette=["#FCE4D6","#DDF1EB","#E0EAFB","#F1E2F3","#E9F2D7","#FFF1CC"];
const clamp=(v,low,high)=>Math.min(high,Math.max(low,v));
const num=(v,fallback=0)=>{
  const n=Number(v);
  return Number.isFinite(n)?n:fallback;
};
function drawCover(ctx,img,x,y,w,h){
  if(!img || !img.width || !img.height)return;
  const scale=Math.max(w/img.width,h/img.height);
  const dw=img.width*scale,dh=img.height*scale;
  ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
async function getSource(item){
  if(item?.imageRef){
    try{
      const url=await getImageUrl(item.imageRef);
      if(url)return url;
    }catch(e){console.warn("Image Line image lookup failed",e)}
  }
  // Sources from the Home table are embedded data URLs. Never load arbitrary
  // http(s) URLs from JSON backups into an exportable canvas.
  const data=item?.imageData;
  return typeof data==="string"&&/^data:image\/(png|jpeg|webp|gif);base64,/i.test(data)?data:null;
}
function loadImage(src){
  if(!src)return Promise.resolve(null);
  if(imageCache.has(src))return imageCache.get(src);
  if(imageCache.size>=80)imageCache.clear();
  const result=new Promise(resolve=>{
    const img=new Image();
    let done=false;
    const finish=value=>{
      if(done)return;
      done=true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout=setTimeout(()=>finish(null),3000);
    img.onload=()=>finish(img);
    img.onerror=()=>finish(null);
    img.src=src;
  });
  imageCache.set(src,result);
  return result;
}
function font(ctx,size,weight=700,family="system-ui"){
  ctx.font=weight+" "+Math.max(8,Math.round(size))+"px "+family;
}
function ellipsis(ctx,text,maxWidth){
  let value=String(text||"");
  if(ctx.measureText(value).width<=maxWidth)return value;
  while(value.length && ctx.measureText(value+"…").width>maxWidth)value=value.slice(0,-1);
  return value+"…";
}
function labelVertical(ctx,text,cx,yTop,maxHeight,fontSize,color){
  const chars=[...String(text||"")];
  const count=Math.max(1,Math.floor(maxHeight/(fontSize+2)));
  ctx.textAlign="center";ctx.textBaseline="top";
  ctx.fillStyle=color;
  font(ctx,fontSize,650);
  const visible=chars.slice(0,count);
  if(chars.length>count&&visible.length)visible[visible.length-1]="…";
  visible.forEach((ch,i)=>ctx.fillText(ch,cx,yTop+i*(fontSize+2)));
}
export function imageLineItems(project){
  return (project?.data?.items||[])
    .filter(item=>item&&item.enabled!==false&&item.value!==null&&item.value!==""&&Number.isFinite(Number(item.value)))
    .slice(0,clamp(Math.round(num(project?.settings?.displayLimit,15)),1,40));
}
export async function renderImageLineCanvas(project){
  const w=clamp(Math.round(num(project?.canvas?.width,1600)),320,2400);
  const h=clamp(Math.round(num(project?.canvas?.height,900)),320,3000);
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Canvas 2D unavailable");
  const s=project.settings||{},sty=project.style||{};
  const dark=sty.theme!=="light" && sty.theme!=="pastel";
  const bg=sty.background||(dark?"#10192B":"#F3F5F8");
  const ink=sty.primary||(dark?"#F4F7FC":"#17243A");
  const muted=sty.secondary||(dark?"#9EADC1":"#68758A");
  const line=sty.accent||"#315FDB";
  const family=sty.typography?.fontFamily||"system-ui";
  if(project.canvas?.transparent)ctx.clearRect(0,0,w,h);
  else{ctx.fillStyle=bg;ctx.fillRect(0,0,w,h)}

  const marginX=w*.075;
  const titleSize=clamp(w*.033,20,55);
  ctx.textAlign="left";ctx.textBaseline="alphabetic";
  font(ctx,titleSize,850,family);
  ctx.fillStyle=ink;
  ctx.fillText(ellipsis(ctx,project.meta?.title||"Image Line Chart",w-marginX*2),marginX,h*.079);
  if(project.meta?.subtitle){
    font(ctx,clamp(w*.015,13,25),500,family);
    ctx.fillStyle=muted;
    ctx.fillText(ellipsis(ctx,project.meta.subtitle,w-marginX*2),marginX,h*.119);
  }

  const items=imageLineItems(project);
  if(!items.length){
    ctx.textAlign="center";ctx.fillStyle=muted;font(ctx,Math.max(16,w*.021),500,family);
    ctx.fillText("No scores yet",w/2,h/2);
    return canvas;
  }
  const min=num(s.min,0);
  const max=num(s.max,10)>min?num(s.max,10):min+1;
  const L=w*.083,R=w*.966,T=h*.19,B=h*.785;
  const chartW=R-L,chartH=B-T;
  const colW=chartW/items.length;
  const xAt=i=>L+(i+.5)*colW;
  const yAt=value=>B-clamp((num(value)-min)/(max-min),0,1)*chartH;

  ctx.save();
  ctx.fillStyle=dark?"#17243A":"#FFFFFF";
  ctx.fillRect(L,T,chartW,chartH);
  for(let i=0;i<items.length;i++){
    const left=L+i*colW;
    ctx.fillStyle=palette[i%palette.length];
    ctx.globalAlpha=dark?.22:.43;
    ctx.fillRect(left,T,colW,chartH);
    ctx.globalAlpha=1;
  }
  if(s.showImages!==false){
    const photos=await Promise.all(items.map(async item=>loadImage(await getSource(item))));
    photos.forEach((photo,i)=>{
      if(!photo)return;
      ctx.save();
      ctx.beginPath();ctx.rect(L+i*colW,T,colW,chartH);ctx.clip();
      ctx.globalAlpha=clamp(num(s.imageOpacity,.70),0,1);
      drawCover(ctx,photo,L+i*colW,T,colW,chartH);
      ctx.restore();
    });
    // Lightweight scrim keeps scores and grid readable over photos.
    ctx.fillStyle=dark?"rgba(6,12,25,.12)":"rgba(255,255,255,.18)";
    ctx.fillRect(L,T,chartW,chartH);
  }
  ctx.restore();

  if(s.showGrid!==false){
    const steps=5;
    ctx.lineWidth=Math.max(1,w*.0008);
    for(let i=0;i<=steps;i++){
      const y=T+(chartH*i/steps);
      ctx.strokeStyle=dark?"rgba(242,247,255,.42)":"rgba(45,63,92,.24)";
      ctx.setLineDash([Math.max(3,w*.003),Math.max(3,w*.003)]);
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(R,y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle=muted;ctx.textAlign="right";ctx.textBaseline="middle";
      font(ctx,clamp(w*.011,10,19),650,family);
      ctx.fillText(String(Number((max-(max-min)*i/steps).toFixed(1))),L-w*.012,y);
    }
  }
  ctx.lineWidth=Math.max(1,w*.0012);
  ctx.strokeStyle=dark?"rgba(250,250,255,.45)":"rgba(35,48,75,.25)";
  ctx.strokeRect(L,T,chartW,chartH);
  const pts=items.map((item,i)=>({x:xAt(i),y:yAt(item.value),value:num(item.value)}));
  if(pts.length>1){
    ctx.lineCap="round";ctx.lineJoin="round";
    ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle=dark?"rgba(0,0,0,.65)":"rgba(255,255,255,.92)";
    ctx.lineWidth=clamp(w*.0055,4,10);ctx.stroke();
    ctx.strokeStyle=line;ctx.lineWidth=clamp(w*.0027,2.5,5);ctx.stroke();
  }
  const radius=clamp(w*.0049,3.5,8);
  pts.forEach((point,i)=>{
    ctx.fillStyle=dark?"#15223C":"#FFFFFF";
    ctx.strokeStyle=line;ctx.lineWidth=clamp(w*.0016,1.5,3);
    ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(s.showValues!==false){
      const text=Number.isInteger(point.value)?String(point.value):String(Number(point.value.toFixed(1)));
      font(ctx,clamp(Math.min(colW*.36,w*.017),10,25),850,family);
      ctx.textAlign="center";ctx.textBaseline="alphabetic";
      const offset=point.y-T<chartH*.16?radius+18:-(radius+7);
      const ty=clamp(point.y+offset,T+15,B-6);
      // An outlined label remains readable on either bright or dark art.
      ctx.lineWidth=clamp(w*.003,3,6);
      ctx.strokeStyle=dark?"#11192B":"rgba(255,255,255,.95)";
      ctx.strokeText(text,point.x,ty);
      ctx.fillStyle=line;ctx.fillText(text,point.x,ty);
    }
  });
  if(s.showLabels!==false){
    const fontSize=clamp(Math.min(colW*.50,w*.014),9,23);
    const labelY=B+h*.022;
    items.forEach((item,i)=>{
      labelVertical(ctx,item.name,xAt(i),labelY,h-labelY-h*.025,fontSize,ink);
    });
  }
  return canvas;
}
