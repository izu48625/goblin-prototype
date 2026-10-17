// Lightweight Cloudflare Workers Free PNG image renderer: 600x315, 4-bit indexed PNG.
// Bitmap glyphs support ASCII; non-Latin titles and names are preserved in OG HTML metadata.
const WIDTH=600, HEIGHT=315;
const FONT={
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01111'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','10101','10011','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','10101','01010'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 '0':['01110','10011','10101','10101','11001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01111','10000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00001','11110'],
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '.':['00000','00000','00000','00000','00000','00110','00110'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 ':':['00000','00110','00110','00000','00110','00110','00000'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '#':['01010','01010','11111','01010','11111','01010','01010'],
 '?':['01110','10001','00001','00010','00100','00000','00100'],
 '_':['00000','00000','00000','00000','00000','00000','11111'],
 '(':['00010','00100','01000','01000','01000','00100','00010'],
 ')':['01000','00100','00010','00010','00010','00100','01000'],
 '&':['01100','10010','10100','01000','10101','10010','01101'],
 '!':['00100','00100','00100','00100','00100','00000','00100']
};
const COLORS={bg:0,panel:1,line:3,white:4,muted:5,blue:6,green:7};
const PALETTE=new Uint8Array([7,16,31,12,28,48,14,32,54,42,72,109,237,244,255,151,174,208,120,168,255,108,221,166,72,121,197,51,92,159,33,57,83]);
const CATEGORIES={sports:'SPORTS',manga_anime:'MANGA / ANIME',movie_tv:'MOVIES / TV',food:'FOOD',game:'GAMES',music:'MUSIC',books:'BOOKS',travel:'TRAVEL',tech:'TECH',lifestyle:'LIFESTYLE',other:'OTHER'};
const TABLE=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);TABLE[i]=c>>>0;}
function crc32(data){let crc=0xffffffff;for(let i=0;i<data.length;i++)crc=TABLE[(crc^data[i])&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function chunk(type,data){const out=new Uint8Array(12+data.length),view=new DataView(out.buffer);view.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);view.setUint32(out.length-4,crc32(out.subarray(4,out.length-4)));return out;}
function pngFromCompressed(compressed){
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,WIDTH);view.setUint32(4,HEIGHT);header[8]=4;header[9]=3;
 const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('PLTE',PALETTE),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())];
 const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
function finite(value){if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;}
function average(scores,criteria,weighted){let sum=0,total=0;for(let i=0;i<criteria.length;i++){const value=finite(Array.isArray(scores)?scores[i]:null);if(value===null)continue;const weight=weighted?Math.max(0,finite(criteria[i]?.weight)??1):1;if(weight<=0)continue;sum+=value*weight;total+=weight;}return total?Math.round(sum/total*10)/10:null;}
export function cardFromTopic(topic){
 const snapshot=topic?.snapshot&&typeof topic.snapshot==='object'&&!Array.isArray(topic.snapshot)?topic.snapshot:{};
 const criteria=Array.isArray(snapshot.criteria)?snapshot.criteria.slice(0,10):[];
 const rows=Array.isArray(snapshot.rows)?snapshot.rows.slice(0,40):[];
 const scale=Number(snapshot.scale||topic?.score_scale||100)===10?10:100;
 const weighted=typeof snapshot.weighted==='boolean'?snapshot.weighted:!!topic?.weighted;
 const ranking=rows.map((r,i)=>({index:i,name:String(r?.name||'').trim()||'Target '+(i+1),value:average(r?.scores,criteria,weighted)}))
   .filter(r=>r.value!==null).sort((a,b)=>b.value-a.value||a.index-b.index).slice(0,3);
 return {title:String(topic?.title||'Stats Maker').trim(),category:CATEGORIES[String(snapshot?.metadata?.category||'other').toLowerCase()]||'OTHER',targets:rows.length,metrics:criteria.length,scale,ranking};
}
function safeAscii(input,fallback,max){
 const raw=String(input||'').toUpperCase(),latin=raw.replace(/[^A-Z0-9 .:\/+&#_!?()\-]/g,' ').replace(/\s+/g,' ').trim();
 if(latin.length<3||latin.replace(/\s/g,'').length<raw.replace(/\s/g,'').length*0.5)return fallback;
 return latin.slice(0,max).trim();
}
function zlibStored(raw){
 const blocks=Math.ceil(raw.length/65535),out=new Uint8Array(2+raw.length+blocks*5+4);
 out[0]=0x78;out[1]=0x01;let pos=2,at=0,a=1,b=0;
 while(at<raw.length){const len=Math.min(65535,raw.length-at),final=at+len===raw.length;out[pos++]=final?1:0;out[pos++]=len&255;out[pos++]=len>>>8;out[pos++]=(~len)&255;out[pos++]=((~len)>>>8)&255;out.set(raw.subarray(at,at+len),pos);pos+=len;for(let i=at;i<at+len;i++){a+=raw[i];b+=a;if((i&4095)===4095){a%=65521;b%=65521;}}at+=len;}
 a%=65521;b%=65521;new DataView(out.buffer).setUint32(pos,((b<<16)|a)>>>0);return out;
}
export function renderOgPng(card){
 // Indexed PNG with uncompressed zlib avoids native modules, WASM, or paid services.
 const stride=WIDTH/2,raw=new Uint8Array((stride+1)*HEIGHT);
 function rect(x,y,w,h,color){const left=Math.max(0,Math.floor(x)),top=Math.max(0,Math.floor(y)),right=Math.min(WIDTH,Math.ceil(x+w)),bottom=Math.min(HEIGHT,Math.ceil(y+h));for(let yy=top;yy<bottom;yy++){const row=yy*(stride+1)+1;for(let xx=left;xx<right;xx++){const at=row+(xx>>>1);raw[at]=(xx&1)?((raw[at]&0xf0)|color):((raw[at]&0x0f)|(color<<4));}}}
 function glyphs(str,x,y,scale,color,limit=100){let pen=x;for(const ch of String(str).toUpperCase().slice(0,limit)){if(pen+5*scale>WIDTH-16)break;const g=FONT[ch]||FONT['?'];for(let ry=0;ry<7;ry++)for(let rx=0;rx<5;rx++)if(g[ry][rx]==='1')rect(pen+rx*scale,y+ry*scale,scale,scale,color);pen+=scale*6;}}
 rect(0,0,WIDTH,8,COLORS.blue);rect(18,20,30,30,9);glyphs('S',26,25,3,COLORS.white);
 glyphs('STATS MAKER',59,28,2,COLORS.blue);rect(19,62,330,1,COLORS.line);
 glyphs(card.category||'OTHER',20,75,2,COLORS.green,23);
 const title=safeAscii(card.title,'SHARED RANKING',30);
 glyphs(title.slice(0,18),20,107,3,COLORS.white,18);
 if(title.length>18)glyphs(title.slice(18,36),20,135,3,COLORS.white,18);
 glyphs('CREATOR OVERALL',20,183,2,COLORS.muted);rect(18,207,334,1,COLORS.line);
 glyphs('TARGETS',20,226,2,COLORS.muted);glyphs(String(card.targets??0),20,248,3,COLORS.white);
 glyphs('METRICS',131,226,2,COLORS.muted);glyphs(String(card.metrics??0),131,248,3,COLORS.white);
 glyphs('SCALE',246,226,2,COLORS.muted);glyphs(String(card.scale??100),246,248,3,COLORS.white);
 rect(369,20,213,272,COLORS.panel);rect(369,20,213,1,COLORS.line);glyphs('TOP 3',387,35,3,COLORS.white);
 const rank=Array.isArray(card.ranking)?card.ranking.slice(0,3):[];
 if(!rank.length)glyphs('NO SCORES YET',389,148,2,COLORS.muted);
 rank.forEach((item,i)=>{const y=80+i*65;rect(385,y,181,1,COLORS.line);glyphs('#'+(i+1),387,y+12,3,COLORS.blue);glyphs(safeAscii(item.name,'TARGET '+(i+1),11),426,y+11,2,COLORS.white);const value=Number(item.value);glyphs(Number.isFinite(value)?String(Math.round(value*10)/10):'--',428,y+34,2,COLORS.green);const ratio=Math.max(0,Math.min(1,Number.isFinite(value)?value/Math.max(1,Number(card.scale)||100):0));rect(477,y+38,88,5,10);rect(477,y+38,Math.floor(88*ratio),5,COLORS.blue);});
 glyphs('CREATED WITH STATS MAKER',20,297,1,COLORS.muted);
 return pngFromCompressed(zlibStored(raw));
}
