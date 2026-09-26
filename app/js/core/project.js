export const SCHEMA_VERSION=2;

export const THEMES={
  dark:{id:"dark",bg:"#10192B",surface:"#17243A",text:"#F4F7FC",muted:"#9EADC1",accent:"#6F9CFF",border:"#2C405E"},
  light:{id:"light",bg:"#F3F5F8",surface:"#FFFFFF",text:"#162034",muted:"#68758A",accent:"#315FDB",border:"#D5DBE4"},
  black:{id:"black",bg:"#050505",surface:"#101010",text:"#FFFFFF",muted:"#A8A8A8",accent:"#F0B84F",border:"#2A2A2A"},
  sports:{id:"sports",bg:"#071B2B",surface:"#0D314A",text:"#F7FBFF",muted:"#91B6CB",accent:"#35D07F",border:"#1C5571"},
  neon:{id:"neon",bg:"#080A16",surface:"#11152B",text:"#F7F9FF",muted:"#9DA6C3",accent:"#B673FF",border:"#2B3260"},
  pastel:{id:"pastel",bg:"#F7F0F4",surface:"#FFF9FC",text:"#463845",muted:"#877682",accent:"#E277A8",border:"#E2CBD6"}
};

export const CANVAS_PRESETS={
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

export function createRankingProject(){
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

export function createStatCardProject(){
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

export function createQuadrantProject(){
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


export function createBarProject(){
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

export function createRadarProject(){
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


export function createDotProject(){
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

export function createRingProject(){
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

export function createTierProject(){
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

export function createHeatmapProject(){
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

export function createScatterProject(){
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

export function createRangeProject(){
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

export function createWaffleProject(){
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


export function createStatBoardProject(){
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

export function createProject(type){
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

export function applyTheme(project,themeId){
  const th=THEMES[themeId]||THEMES.dark;
  project.style.theme=th.id;
  project.style.background=th.bg;
  project.style.surface=th.surface;
  project.style.primary=th.text;
  project.style.secondary=th.muted;
  project.style.accent=th.accent;
  project.style.border=th.border;
}

export function applyCanvasPreset(project,presetId){
  const p=CANVAS_PRESETS[presetId];
  if(!p)return;
  project.canvas.preset=presetId;
  project.canvas.width=p.width;
  project.canvas.height=p.height;
}

export function cloneProject(project){
  const c=structuredClone(project);
  c.id=uid("project");
  c.meta.title=`${project.meta.title} Copy`;
  c.meta.createdAt=new Date().toISOString();
  c.meta.updatedAt=c.meta.createdAt;
  c.publish={cloudId:null,visibility:"private",publishedAt:null};
  return c;
}

export function newItemId(){return uid("item")}
export function newStatId(){return uid("stat")}
export function newAxisId(){return uid("axis")}
export function newSeriesId(){return uid("series")}
