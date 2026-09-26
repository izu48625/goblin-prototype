
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

export function parseTableText(text){
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

export function mapRankingRows(rows){
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

export function mapQuadrantRows(rows){
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

export function mapStatRows(rows){
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

export function previewRows(rows,limit=6){
  return rows.slice(0,limit);
}


export function mapRadarMatrix(rows){
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


export function mapRangeRows(rows){
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
export function mapRingRows(rows){
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
export function mapWaffleRows(rows){
  if(!rows.length)return [];
  const first=rows[0].map(normalizeHeader);
  const header=first.some(v=>["label","name","category","項目","名前","カテゴリ"].includes(v));
  const body=header?rows.slice(1):rows;
  return body.filter(r=>r.some(v=>String(v||"").trim())).map(r=>({
    label:String(r[0]??"").trim()||"Category",
    value:toNumber(r[1],0)
  }));
}
export function mapHeatmapMatrix(rows){
  if(rows.length<2)return {columns:[],rows:[]};
  const columns=(rows[0].slice(1)||[]).map((v,i)=>String(v||`C${i+1}`).trim()||`C${i+1}`);
  const outRows=rows.slice(1).filter(r=>r.some(v=>String(v||"").trim())).map((r,i)=>({
    name:String(r[0]??`Row ${i+1}`).trim()||`Row ${i+1}`,
    values:columns.map((_,j)=>toNumber(r[j+1],0))
  }));
  return {columns,rows:outRows};
}
