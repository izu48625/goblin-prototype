
(() => {
  'use strict';

  const STORAGE_KEY = 'statsMakerV014Library';
  const LEGACY_STORAGE_KEYS = ['statsMakerV0134Library','statsMakerV0133Library','statsMakerV013Library','statsMakerV012Library','statsMakerV011Library','statsMakerV010Library','statsMakerV09Library','statsMakerV08Library','statsMakerV07Library','statsMakerV05Library','statsMakerV04Library','statsMakerV03Library'];
  const MAX_ROWS = 40;
  const MAX_COLS = 10;
  const IMAGE_SIZE = 160;
  const IMAGE_QUALITY = 0.76;
  const $ = id => document.getElementById(id);
  const t = (key,vars={}) => window.SM_I18N?.t(key,vars) ?? key;

  const sampleSheet = () => ({
    id: makeId(),
    title:'ワンピース 各編評価',
    desc:'各編を100点満点で自由に採点',
    cols:['ストーリー','戦闘','敵キャラ','感動','世界観'],
    rows:[
      {name:'東の海',image:'',scores:[88,80,82,91,84]},
      {name:'アラバスタ',image:'',scores:[94,92,95,94,92]},
      {name:'空島',image:'',scores:[91,84,87,89,98]},
      {name:'W7・エニエスロビー',image:'',scores:[98,97,94,99,93]},
      {name:'頂上戦争',image:'',scores:[97,99,99,99,97]}
    ],
    sortKey:null,
    sortDesc:true,
    rankMetric:'avg',
    compare:[1,2,4],
    compareView:'radar',
    viewMode:'sheet',
    fitMode:'auto',
    fitZoom:1,
    weighted:false,
    weights:[1,1,1,1,1],
    scale:100,
    updatedAt:Date.now()
  });

  const blankSheet = (title=t('fallback.newTopic')) => ({
    id:makeId(),
    title,
    desc:'',
    cols:[1,2,3,4].map(n=>t('fallback.metric',{n})),
    rows:[
      {name:'',image:'',note:'',scores:[null,null,null,null]},
      {name:'',image:'',note:'',scores:[null,null,null,null]},
      {name:'',image:'',note:'',scores:[null,null,null,null]},
      {name:'',image:'',note:'',scores:[null,null,null,null]}
    ],
    sortKey:null,sortDesc:true,rankMetric:'avg',compare:[],compareView:'radar',viewMode:'sheet',fitMode:'auto',fitZoom:1,weighted:false,weights:[1,1,1,1],scale:100,updatedAt:Date.now()
  });

  let library = loadLibrary();
  let saveTimer = null;
  let columnManagerVisible = true;

  function makeId(){
    return 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }

  function loadLibrary(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && Array.isArray(parsed.sheets) && parsed.sheets.length){
          parsed.sheets.forEach(normalizeSheet);
          if(!parsed.activeId || !parsed.sheets.some(s=>s.id===parsed.activeId)){
            parsed.activeId = parsed.sheets[0].id;
          }
          return parsed;
        }
      }
    }catch(e){}
    const first = sampleSheet();
    return {activeId:first.id,sheets:[first]};
  }

  function normalizeSheet(s){
    if(!s.id)s.id=makeId();
    if(!Array.isArray(s.cols)||!s.cols.length)s.cols=[1,2].map(n=>t('fallback.metric',{n}));
    if(!Array.isArray(s.rows)||!s.rows.length)s.rows=[{name:'',image:'',note:'',scores:Array(s.cols.length).fill(null)}];
    s.rows.forEach(r=>{
      if(typeof r.name!=='string')r.name='';
      if(typeof r.image!=='string')r.image='';
      if(typeof r.note!=='string')r.note='';
      if(!Array.isArray(r.scores))r.scores=[];
      while(r.scores.length<s.cols.length)r.scores.push(null);
      r.scores=r.scores.slice(0,s.cols.length);
    });
    if(!Array.isArray(s.compare))s.compare=[];
    if(!['radar','bar'].includes(s.compareView))s.compareView='radar';
    if(!['sheet','overview','fit'].includes(s.viewMode))s.viewMode='sheet';
    if(typeof s.weighted!=='boolean')s.weighted=false;
    if(typeof s.search!=='string')s.search='';
    if(typeof s.gradeFilter!=='string')s.gradeFilter='all';
    if(s.rankMode!=='bottom')s.rankMode='top';
    if(!Array.isArray(s.weights))s.weights=[];
    while(s.weights.length<s.cols.length)s.weights.push(1);
    s.weights=s.weights.slice(0,s.cols.length).map(w=>{
      const n=Number(w);
      return Number.isFinite(n)?Math.max(0,n):1;
    });
    if(!s.fitMode)s.fitMode='auto';
    if(!Number.isFinite(s.fitZoom))s.fitZoom=1;
    if(s.scale!==10 && s.scale!==100)s.scale=100;
    if(s.rankMetric===undefined)s.rankMetric='avg';
    if(s.sortKey===undefined)s.sortKey=null;
    if(typeof s.sortDesc!=='boolean')s.sortDesc=true;
  }

  function activeSheet(){
    return library.sheets.find(s=>s.id===library.activeId) || library.sheets[0];
  }

  function clone(obj){return JSON.parse(JSON.stringify(obj))}

  function scheduleSave(message=t('save.auto')){
    clearTimeout(saveTimer);
    $('saveBadge').textContent=t('save.saving');
    saveTimer=setTimeout(()=>{
      try{
        const s=activeSheet();
        s.updatedAt=Date.now();
        localStorage.setItem(STORAGE_KEY,JSON.stringify(library));
        $('saveBadge').textContent=t('save.saved');
        if(message)$('statusText').textContent=message;
      }catch(e){
        $('saveBadge').textContent=t('save.failed');
        $('statusText').textContent=t('save.quota');
      }
    },220);
  }

  function clampScore(value){
    if(value===''||value===null||value===undefined)return null;
    const n=Number(value);
    if(!Number.isFinite(n))return null;
    const max=activeSheet().scale||100;
    if(max===10)return Math.max(0,Math.min(10,Math.round(n*10)/10));
    return Math.max(0,Math.min(100,Math.round(n)));
  }

  function avg(row){
    const s=activeSheet();
    const weighted=!!s.weighted;
    if(!weighted){
      const vals=row.scores.filter(v=>Number.isFinite(v));
      return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    }
    let total=0,weightSum=0;
    row.scores.forEach((v,i)=>{
      if(!Number.isFinite(v))return;
      const w=Number(s.weights?.[i]??1);
      if(!Number.isFinite(w)||w<=0)return;
      total+=v*w;
      weightSum+=w;
    });
    return weightSum>0?total/weightSum:null;
  }

  function rowProgress(row){
    const total=activeSheet().cols.length;
    if(!total)return {done:0,total:0,pct:0};
    const done=row.scores.slice(0,total).filter(v=>Number.isFinite(v)).length;
    return {done,total,pct:Math.round(done/total*100)};
  }

  function overallProgress(){
    const s=activeSheet();
    const total=s.rows.length*s.cols.length;
    if(!total)return 0;
    let done=0;
    s.rows.forEach(r=>done+=r.scores.slice(0,s.cols.length).filter(v=>Number.isFinite(v)).length);
    return Math.round(done/total*100);
  }
  function fmt(v){
    if(v==null)return '--';
    const max=activeSheet().scale||100;
    return max===10 ? Number(v).toFixed(1).replace('.0','') : Number(v).toFixed(1).replace('.0','');
  }
  function scorePct(v){
    if(v==null)return null;
    const max=activeSheet().scale||100;
    return (v/max)*100;
  }
  function grade(v){
    const p=scorePct(v);
    if(p==null)return '–';
    if(p>=95)return 'SS';
    if(p>=90)return 'S';
    if(p>=80)return 'A';
    if(p>=70)return 'B';
    if(p>=60)return 'C';
    if(p>=50)return 'D';
    return 'E';
  }
  function heatClass(v){
    const p=scorePct(v);
    if(p==null)return '';
    if(p>=95)return 'heat-ss';
    if(p>=90)return 'heat-s';
    if(p>=80)return 'heat-a';
    if(p>=70)return 'heat-b';
    if(p>=60)return 'heat-c';
    if(p>=50)return 'heat-d';
    return 'heat-e';
  }
  function esc(s){
    return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function metricValue(row,key){return key==='avg'?avg(row):row.scores[Number(key)]??null}
  function metricLabel(key){const s=activeSheet();return key==='avg'?t('metric.overallAverage'):(s.cols[Number(key)]||t('fallback.metric',{n:Number(key)+1}))}

  function rowMatchesFilter(row,index){
    const s=activeSheet();
    const q=(s.search||'').trim().toLowerCase();
    if(q){
      const hay=`${row.name||''} ${row.note||''}`.toLowerCase();
      if(!hay.includes(q))return false;
    }

    const f=s.gradeFilter||'all';
    if(f==='all')return true;

    const a=avg(row);
    if(f==='unrated')return a==null;

    const g=grade(a);
    if(f==='C')return ['C','D','E','–'].includes(g);
    return g===f;
  }

  function filteredRows(){
    return activeSheet().rows
      .map((row,index)=>({row,index}))
      .filter(x=>rowMatchesFilter(x.row,x.index));
  }

  function orderedRows(){
    return filteredRows();
  }


  let viewOnlyMode=false;
  let viewOnlyReturnMode=null;
  let shareImageBlob=null;
  let shareImageUrl='';

  function safeFilename(name,ext){
    const base=(name||'stats-maker')
      .replace(/[\\/:*?"<>|]+/g,'_')
      .replace(/\s+/g,'_')
      .slice(0,60) || 'stats-maker';
    return `${base}.${ext}`;
  }

  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }

  async function exportBackup(){
    const payload={
      app:'Stats Maker',
      version:'1.0-A2',
      exportedAt:new Date().toISOString(),
      library
    };

    const json=JSON.stringify(payload,null,2);
    const filename=safeFilename(activeSheet().title||'stats-maker-backup','json');
    const blob=new Blob([json],{type:'application/json;charset=utf-8'});

    // iPhone/Safari: prefer the native share/save sheet so the JSON is saved
    // as a file instead of being displayed as raw text in a browser tab.
    try{
      const file=new File([blob],filename,{type:'application/json'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:t('backup.shareTitle')
        });
        $('statusText').textContent=t('backup.shared');
        return;
      }
    }catch(e){
      if(e?.name==='AbortError')return;
    }

    // Fallback for browsers without file sharing.
    const fallbackBlob=new Blob([json],{type:'application/octet-stream'});
    downloadBlob(fallbackBlob,filename);
    $('statusText').textContent=t('backup.exported');
  }

  function openImportDialog(){
    $('importFileInput').value='';
    $('importBackdrop').classList.remove('hidden');
  }

  function closeImportDialog(){
    $('importBackdrop').classList.add('hidden');
  }

  async function importBackupFile(file){
    if(!file)return;
    try{
      const text=await file.text();
      const parsed=JSON.parse(text);
      const incoming=parsed?.library || parsed;
      if(!incoming || !Array.isArray(incoming.sheets) || !incoming.sheets.length){
        throw new Error('invalid');
      }
      incoming.sheets.forEach(normalizeSheet);
      if(!incoming.activeId || !incoming.sheets.some(s=>s.id===incoming.activeId)){
        incoming.activeId=incoming.sheets[0].id;
      }
      library=incoming;
      localStorage.setItem(STORAGE_KEY,JSON.stringify(library));
      closeImportDialog();
      renderAll();
      $('statusText').textContent=t('backup.restored');
    }catch(e){
      $('statusText').textContent=t('backup.invalid');
    }
  }

  function csvEscape(value){
    const s=String(value??'');
    return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
  }

  function exportCsv(){
    const s=activeSheet();
    const headers=[t('table.target'),...s.cols,t('table.average'),t('table.rank'),t('table.note')];
    const lines=[headers.map(csvEscape).join(',')];
    s.rows.forEach(row=>{
      const vals=[
        row.name,
        ...row.scores.map(v=>v==null?'':v),
        avg(row)==null?'':fmt(avg(row)),
        grade(avg(row)),
        row.note||''
      ];
      lines.push(vals.map(csvEscape).join(','));
    });
    const bom='\ufeff';
    const blob=new Blob([bom+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    downloadBlob(blob,safeFilename(s.title||'stats-maker','csv'));
    $('statusText').textContent=t('csv.exported');
  }

  function setViewOnly(enabled){
    const s=activeSheet();

    if(enabled && !viewOnlyMode){
      viewOnlyReturnMode=s.viewMode||'sheet';
      viewOnlyMode=true;
      s.viewMode='overview';
    }else if(!enabled && viewOnlyMode){
      viewOnlyMode=false;
      s.viewMode=viewOnlyReturnMode||'sheet';
      viewOnlyReturnMode=null;
    }else{
      viewOnlyMode=!!enabled;
    }

    document.body.classList.toggle('viewOnly',viewOnlyMode);
    $('viewOnlyBanner').classList.toggle('hidden',!viewOnlyMode);
    $('viewOnlyBtn').textContent=viewOnlyMode?t('tools.viewing'):t('tools.view');

    renderViewMode();

    if(viewOnlyMode){
      window.scrollTo({top:0,behavior:'smooth'});
    }
  }

  function roundRect(ctx,x,y,w,h,r,fill,stroke){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill()}
    if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
  }

  function fitText(ctx,text,maxWidth){
    let s=String(text||'');
    if(ctx.measureText(s).width<=maxWidth)return s;
    while(s.length>1 && ctx.measureText(s+'…').width>maxWidth)s=s.slice(0,-1);
    return s+'…';
  }

  function buildShareCanvas(){
    const s=activeSheet();
    const ranked=s.rows.map((row,index)=>({row,index,value:avg(row)}))
      .filter(x=>x.value!=null)
      .sort((a,b)=>b.value-a.value)
      .slice(0,10);

    const width=1080;
    const headerH=250;
    const rowH=94;
    const footerH=130;
    const height=headerH + Math.max(3,ranked.length)*rowH + footerH;
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext('2d');

    ctx.fillStyle='#07101f';
    ctx.fillRect(0,0,width,height);

    const grad=ctx.createLinearGradient(0,0,width,0);
    grad.addColorStop(0,'#111d31');
    grad.addColorStop(1,'#0d1728');
    roundRect(ctx,42,36,width-84,height-72,34,grad,'#263750');

    ctx.fillStyle='#6f98ff';
    ctx.font='800 28px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText('STATS MAKER',84,95);

    ctx.fillStyle='#eef4ff';
    ctx.font='900 54px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(fitText(ctx,s.title||t('fallback.untitledSheet'),width-168),84,158);

    ctx.fillStyle='#93a3ba';
    ctx.font='500 24px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    if(s.desc)ctx.fillText(fitText(ctx,s.desc,width-168),84,202);

    const startY=headerH;
    ranked.forEach((item,rank)=>{
      const y=startY+rank*rowH;
      const border=rank===0?'#80692e':rank===1?'#536375':rank===2?'#79563a':'#263750';
      const fill=rank<3?'#121f34':'#0f1a2d';
      roundRect(ctx,76,y+8,width-152,rowH-16,18,fill,border);

      ctx.fillStyle='#9fb0c7';
      ctx.font='900 30px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.fillText(String(rank+1),102,y+62);

      ctx.fillStyle='#eef4ff';
      ctx.font='800 30px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      const name=item.row.name.trim()||t('fallback.target',{n:item.index+1});
      ctx.fillText(fitText(ctx,name,610),160,y+61);

      ctx.textAlign='right';
      ctx.fillStyle='#eef4ff';
      ctx.font='900 38px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.fillText(fmt(item.value),width-122,y+55);
      ctx.fillStyle='#93a3ba';
      ctx.font='900 18px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.fillText(grade(item.value),width-122,y+76);
      ctx.textAlign='left';
    });

    const fy=height-footerH+20;
    ctx.fillStyle='#6f819b';
    ctx.font='700 20px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillText(t('share.summary',{rows:s.rows.length,cols:s.cols.length,scale:s.scale||100}),84,fy+28);
    ctx.textAlign='right';
    ctx.fillText('Created with Stats Maker',width-84,fy+28);
    ctx.textAlign='left';

    return canvas;
  }

  async function openShareImage(){
    const canvas=buildShareCanvas();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.95));
    if(!blob){
      $('statusText').textContent=t('image.failed');
      return;
    }

    if(shareImageUrl)URL.revokeObjectURL(shareImageUrl);
    shareImageBlob=blob;
    shareImageUrl=URL.createObjectURL(blob);
    $('sharePreviewImage').src=shareImageUrl;
    $('sharePreviewBackdrop').classList.remove('hidden');
  }

  function closeSharePreview(){
    $('sharePreviewBackdrop').classList.add('hidden');
  }

  async function saveOrShareImage(){
    if(!shareImageBlob)return;
    const filename=safeFilename(activeSheet().title||'stats-maker-ranking','png');
    try{
      const file=new File([shareImageBlob],filename,{type:'image/png'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({
          files:[file],
          title:activeSheet().title||'Stats Maker'
        });
        return;
      }
    }catch(e){
      if(e?.name==='AbortError')return;
    }
    downloadBlob(shareImageBlob,filename);
  }

  function renderSheetSelect(){
    $('sheetSelect').innerHTML=library.sheets.map(s=>`<option value="${s.id}">${esc(s.title||t('fallback.untitledSheet'))}</option>`).join('');
    $('sheetSelect').value=library.activeId;
  }

  function renderHeader(){
    const s=activeSheet();
    $('titleInput').value=s.title||'';
    $('descInput').value=s.desc||'';
    renderSheetSelect();
  }

  function renderTable(){
    const s=activeSheet();
    let h='<thead><tr>';
    h+=`<th class="indexHead">#</th><th class="nameHead">${esc(t('table.imageTarget'))}</th>`;

    s.cols.forEach((name,ci)=>{
      h+=`<th class="metricHead">
        <div class="metricHeaderBox">
          <div class="metricHeaderMain">
            <span class="metricHeaderName">${esc(name)}</span>
            <button class="metricEditBtnV13" data-edit-col="${ci}" type="button" aria-label="${esc(t('aria.editMetric',{name}))}">✎</button>
          </div>
          <div class="headerSortRow">
            <button class="headerSortBtn" data-sort-now="${ci}" data-sort-dir="asc" type="button" aria-label="${esc(t('aria.sortAsc',{name}))}">▲</button>
            <button class="headerSortBtn" data-sort-now="${ci}" data-sort-dir="desc" type="button" aria-label="${esc(t('aria.sortDesc',{name}))}">▼</button>
          </div>
        </div>
      </th>`;
    });

    h+=`<th class="avgHead">
      <div class="avgHeaderBox">
        <div class="avgHeaderMain">${esc(t('table.average'))}</div>
        <div class="headerSortRow">
          <button class="headerSortBtn" data-sort-now="avg" data-sort-dir="asc" type="button" aria-label="${esc(t('aria.sortAsc',{name:t('table.average')}))}">▲</button>
          <button class="headerSortBtn" data-sort-now="avg" data-sort-dir="desc" type="button" aria-label="${esc(t('aria.sortDesc',{name:t('table.average')}))}">▼</button>
        </div>
      </div>
    </th><th class="deleteHead"></th></tr></thead><tbody>`;

    orderedRows().forEach(({row,index},displayIndex)=>{
      const a=avg(row);
      h+='<tr>';
      h+=`<td class="indexCell">${displayIndex+1}</td>`;
      h+=`<td class="nameCell"><div class="nameWrap">
        <button class="thumbBtn" data-pick-image="${index}" type="button" aria-label="${esc(t('aria.chooseImage'))}">${row.image?`<img src="${row.image}" alt="">`:'＋'}</button>
        <input class="nameInput" data-row-name="${index}" value="${esc(row.name)}" placeholder="${esc(t('table.targetName'))}">
        <button class="removeImg ${row.image?'':'hidden'}" data-remove-image="${index}" type="button" aria-label="${esc(t('aria.removeImage'))}">×</button>
        <input class="hidden fileInput" data-image-input="${index}" type="file" accept="image/*">
      </div></td>`;

      s.cols.forEach((_,ci)=>{
        const v=row.scores[ci];
        h+=`<td class="scoreCell ${heatClass(v)}"><input class="scoreInput" data-score-row="${index}" data-score-col="${ci}" type="number" inputmode="decimal" min="0" max="${s.scale||100}" step="${(s.scale||100)===10?'0.1':'1'}" value="${v==null?'':v}" placeholder="–"></td>`;
      });

      h+=`<td class="avgCell ${heatClass(a)}"><span class="avgValue">${fmt(a)}</span><span class="grade">${grade(a)}</span></td>`;
      const rp=rowProgress(row);
      h+=`<td class="deleteCell"><div class="rowActionWrap">
        <span class="progressPill ${rp.pct===100?'complete':''}" title="${esc(t('aria.progress'))}">${rp.done}/${rp.total}</span>
        <button class="rowNoteBtn ${row.note?'hasNote':''}" data-note-row="${index}" type="button" aria-label="${esc(t('aria.note'))}">📝</button>
        <button class="rowMove" data-move-row-up="${index}" type="button" aria-label="${esc(t('aria.up'))}">▲</button>
        <button class="rowMove" data-move-row-down="${index}" type="button" aria-label="${esc(t('aria.down'))}">▼</button>
        <button class="rowDelete" data-delete-row="${index}" type="button" aria-label="${esc(t('aria.delete'))}">×</button>
      </div></td></tr>`;
    });
    h+='</tbody>';
    $('scoreTable').innerHTML=h;

    document.querySelectorAll('[data-row-name]').forEach(el=>el.addEventListener('input',e=>{
      s.rows[+e.currentTarget.dataset.rowName].name=e.currentTarget.value;
      renderSidebar();
      renderOverview();
      renderFitTable();
      scheduleSave('');
    }));

    document.querySelectorAll('[data-edit-col]').forEach(el=>el.addEventListener('click',e=>{
      e.stopPropagation();
      const i=+e.currentTarget.dataset.editCol;
      const current=s.cols[i]||t('fallback.metric',{n:i+1});
      const next=window.prompt(t('metric.editPrompt'),current);
      if(next===null)return;
      s.cols[i]=next.trim()||current;
      renderAll();
      scheduleSave(t('metric.saved'));
    }));

    document.querySelectorAll('[data-score-row]').forEach(el=>el.addEventListener('change',e=>{
      const ri=+e.currentTarget.dataset.scoreRow,ci=+e.currentTarget.dataset.scoreCol;
      s.rows[ri].scores[ci]=clampScore(e.currentTarget.value);
      // Important: editing a score never reorders the table.
      renderAll();
      scheduleSave('');
    }));

    document.querySelectorAll('[data-sort-now]').forEach(el=>el.addEventListener('click',e=>{
      const raw=e.currentTarget.dataset.sortNow;
      const key=raw==='avg'?'avg':Number(raw);
      const desc=e.currentTarget.dataset.sortDir==='desc';
      sortRowsOnce(key,desc);
    }));

    document.querySelectorAll('[data-note-row]').forEach(el=>el.addEventListener('click',e=>{
      openNoteDialog(+e.currentTarget.dataset.noteRow);
    }));

    document.querySelectorAll('[data-move-row-up]').forEach(el=>el.addEventListener('click',e=>{
      moveRow(+e.currentTarget.dataset.moveRowUp,-1);
    }));
    document.querySelectorAll('[data-move-row-down]').forEach(el=>el.addEventListener('click',e=>{
      moveRow(+e.currentTarget.dataset.moveRowDown,1);
    }));

    document.querySelectorAll('[data-delete-row]').forEach(el=>el.addEventListener('click',e=>{
      const idx=+e.currentTarget.dataset.deleteRow;
      if(s.rows.length<=1){$('statusText').textContent=t('row.lastCannotDelete');return;}
      s.rows.splice(idx,1);
      s.compare=s.compare.filter(i=>i!==idx).map(i=>i>idx?i-1:i);
      renderAll();scheduleSave(t('row.deleted'));
    }));

    document.querySelectorAll('[data-pick-image]').forEach(el=>el.addEventListener('click',e=>{
      const idx=+e.currentTarget.dataset.pickImage;
      const input=document.querySelector(`[data-image-input="${idx}"]`);
      if(input)input.click();
    }));

    document.querySelectorAll('[data-image-input]').forEach(el=>el.addEventListener('change',async e=>{
      const idx=+e.currentTarget.dataset.imageInput;
      const file=e.currentTarget.files&&e.currentTarget.files[0];
      if(!file)return;
      $('statusText').textContent=t('image.processing');
      try{
        const data=await resizeImage(file);
        s.rows[idx].image=data;
        renderAll();
        scheduleSave(t('image.added'));
      }catch(err){
        $('statusText').textContent=t('image.readFailed');
      }
    }));

    document.querySelectorAll('[data-remove-image]').forEach(el=>el.addEventListener('click',e=>{
      const idx=+e.currentTarget.dataset.removeImage;
      s.rows[idx].image='';
      renderAll();scheduleSave(t('image.removed'));
    }));
  }


  function sortRowsOnce(key,desc){
    const s=activeSheet();

    // Preserve compare selections even though the underlying row order changes.
    const selectedRows=(s.compare||[]).map(i=>s.rows[i]).filter(Boolean);

    const decorated=s.rows.map((row,index)=>({
      row,
      index,
      value:metricValue(row,key)
    }));

    decorated.sort((a,b)=>{
      const av=a.value, bv=b.value;

      // Unrated rows always stay at the bottom.
      const aNull=av==null || !Number.isFinite(Number(av));
      const bNull=bv==null || !Number.isFinite(Number(bv));
      if(aNull && bNull)return a.index-b.index;
      if(aNull)return 1;
      if(bNull)return -1;

      const diff=Number(av)-Number(bv);
      if(diff===0)return a.index-b.index;
      return desc ? -diff : diff;
    });

    s.rows=decorated.map(x=>x.row);
    s.compare=selectedRows.map(row=>s.rows.indexOf(row)).filter(i=>i>=0);

    // Sorting is a one-time action, not a persistent/live sort mode.
    s.sortKey=null;
    s.sortDesc=true;

    renderAll();
    $('statusText').textContent=t('sort.done',{metric:metricLabel(key),direction:desc?t('sort.desc'):t('sort.asc')});
    scheduleSave('');
  }


  async function resizeImage(file){
    if(!file.type.startsWith('image/'))throw new Error('not image');
    const dataUrl=await new Promise((resolve,reject)=>{
      const fr=new FileReader();
      fr.onload=()=>resolve(fr.result);
      fr.onerror=reject;
      fr.readAsDataURL(file);
    });
    const img=await new Promise((resolve,reject)=>{
      const im=new Image();
      im.onload=()=>resolve(im);
      im.onerror=reject;
      im.src=dataUrl;
    });

    const side=Math.min(img.naturalWidth,img.naturalHeight);
    const sx=Math.max(0,(img.naturalWidth-side)/2);
    const sy=Math.max(0,(img.naturalHeight-side)/2);
    const canvas=document.createElement('canvas');
    canvas.width=IMAGE_SIZE;canvas.height=IMAGE_SIZE;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#101c30';ctx.fillRect(0,0,IMAGE_SIZE,IMAGE_SIZE);
    ctx.drawImage(img,sx,sy,side,side,0,0,IMAGE_SIZE,IMAGE_SIZE);
    return canvas.toDataURL('image/jpeg',IMAGE_QUALITY);
  }

  function renderRanking(){
    const s=activeSheet();
    $('rankMetric').innerHTML=`<option value="avg">${esc(t('metric.overallAverage'))}</option>`+s.cols.map((c,i)=>`<option value="${i}">${esc(c||t('fallback.metric',{n:i+1}))}</option>`).join('');
    $('rankMetric').value=String(s.rankMetric);

    $('rankTopBtn').classList.toggle('active',s.rankMode!=='bottom');
    $('rankBottomBtn').classList.toggle('active',s.rankMode==='bottom');

    const list=filteredRows().map(({row,index})=>({
      row,index,
      name:row.name.trim()||t('fallback.target',{n:index+1}),
      value:metricValue(row,s.rankMetric)
    })).sort((a,b)=>{
      if(s.rankMode==='bottom')return (a.value??Infinity)-(b.value??Infinity);
      return (b.value??-Infinity)-(a.value??-Infinity);
    });

    $('ranking').innerHTML=list.map((x,rank)=>{
      const topClass=s.rankMode!=='bottom' && rank<3 ? ` top${rank+1}` : '';
      return `<div class="rankRow${topClass}">
        <div class="rankNo">${rank+1}</div>
        <div class="rankThumb">${x.row.image?`<img src="${x.row.image}" alt="">`:'—'}</div>
        <div class="rankName">${esc(x.name)}</div>
        <div class="rankScore">${fmt(x.value)}<span class="rankGrade">${grade(x.value)}</span></div>
      </div>`;
    }).join('');
  }


  function compareColor(index,total,alpha=1){
    const count=Math.max(1,total||1);
    const hue=Math.round((index*360/count + 216) % 360);
    return alpha===1
      ? `hsl(${hue} 78% 68%)`
      : `hsl(${hue} 78% 68% / ${alpha})`;
  }

  function renderCompare(){
    const s=activeSheet();

    // Keep only valid indices and remove duplicates.
    s.compare=[...new Set((s.compare||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<s.rows.length))];

    $('compareChips').innerHTML=s.rows.map((r,i)=>`<button class="chip${s.compare.includes(i)?' active':''}" data-compare="${i}" type="button">${esc(r.name.trim()||t('fallback.target',{n:i+1}))}</button>`).join('');

    document.querySelectorAll('[data-compare]').forEach(el=>el.addEventListener('click',e=>{
      const i=+e.currentTarget.dataset.compare;
      if(s.compare.includes(i)){
        s.compare=s.compare.filter(x=>x!==i);
      }else{
        s.compare.push(i);
      }
      renderCompare();
      scheduleSave('');
    }));

    const total=s.compare.length;
    $('compareLegend').innerHTML=s.compare.map((ri,idx)=>`
      <div class="legendItem">
        <span class="legendDot" style="background:${compareColor(idx,total)}"></span>
        <span class="legendText">${esc(s.rows[ri]?.name.trim()||t('fallback.target',{n:ri+1}))}</span>
      </div>`).join('');

    $('radarTab').classList.toggle('active',s.compareView==='radar');
    $('barTab').classList.toggle('active',s.compareView==='bar');
    $('radarBox').classList.toggle('hidden',s.compareView!=='radar');
    $('barBox').classList.toggle('hidden',s.compareView!=='bar');

    if(!s.compare.length){
      $('compareHint').textContent=t('compare.none');
    }else if(s.compare.length>=8 && s.compareView==='radar'){
      $('compareHint').textContent=t('compare.many',{count:s.compare.length});
    }else{
      $('compareHint').textContent=t('compare.count',{count:s.compare.length});
    }

    renderCompareStats();

    if(s.compareView==='radar')drawRadar();
    else renderBarCompare();
  }

  function renderCompareStats(){
    const s=activeSheet();
    if(!s.compare.length){
      $('compareStats').innerHTML='';
      return;
    }
    $('compareStats').innerHTML=s.compare.map(ri=>{
      const row=s.rows[ri];
      const a=avg(row);
      const vals=row.scores.filter(v=>Number.isFinite(v));
      const max=vals.length?Math.max(...vals):null;
      const min=vals.length?Math.min(...vals):null;
      return `<div class="compareStat">
        <div class="compareStatLabel">${esc(row?.name.trim()||t('fallback.target',{n:ri+1}))}</div>
        <div class="compareStatValue">${fmt(a)} <span class="rankGrade">${grade(a)}</span></div>
        <div class="rankGrade">MAX ${fmt(max)} / MIN ${fmt(min)}</div>
      </div>`;
    }).join('');
  }


  function activeCompareColumnIndices(){
    const s=activeSheet();
    const selected=s.compare||[];

    // Bar chart: an item is useful if at least one selected target has a score.
    return s.cols
      .map((_,ci)=>ci)
      .filter(ci=>selected.some(ri=>Number.isFinite(s.rows[ri]?.scores?.[ci])));
  }

  function commonRadarColumnIndices(){
    const s=activeSheet();
    const selected=s.compare||[];
    if(!selected.length)return [];

    // Radar polygons must be comparable on the same axes.
    // Drop any axis with a missing value instead of drawing missing as 0.
    return s.cols
      .map((_,ci)=>ci)
      .filter(ci=>selected.every(ri=>Number.isFinite(s.rows[ri]?.scores?.[ci])));
  }

  function drawRadar(){
    const s=activeSheet(), canvas=$('radarCanvas');
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(240,rect.width||280), h=Math.max(220,rect.height||230);
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(w*dpr);
    canvas.height=Math.round(h*dpr);

    const ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);

    const cols=commonRadarColumnIndices();
    const n=cols.length;

    if(!s.compare.length){
      ctx.fillStyle='#73859e';
      ctx.font='10px sans-serif';
      ctx.textAlign='center';
      ctx.fillText(t('compare.choose'),w/2,h/2);
      return;
    }

    if(n<3){
      ctx.fillStyle='#73859e';
      ctx.font='10px sans-serif';
      ctx.textAlign='center';
      ctx.fillText(n===0?t('compare.noCommon'):t('compare.needThree'),w/2,h/2);
      return;
    }

    const cx=w/2,cy=h/2+3,r=Math.min(w,h)*.31,start=-Math.PI/2;
    const point=(i,scale)=>{
      const a=start+Math.PI*2*i/n;
      return{x:cx+Math.cos(a)*r*scale,y:cy+Math.sin(a)*r*scale};
    };

    ctx.lineWidth=1;
    for(let level=1;level<=4;level++){
      ctx.beginPath();
      for(let i=0;i<n;i++){
        const p=point(i,level/4);
        i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);
      }
      ctx.closePath();
      ctx.strokeStyle=level===4?'#40536d':'#27384e';
      ctx.stroke();
    }

    ctx.font='9px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.fillStyle='#9aaac0';
    ctx.textAlign='center';
    ctx.textBaseline='middle';

    cols.forEach((ci,i)=>{
      const p=point(i,1);
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(p.x,p.y);
      ctx.strokeStyle='#28394f';
      ctx.stroke();

      const lp=point(i,1.22);
      let label=s.cols[ci]||t('fallback.metric',{n:ci+1});
      if(label.length>7)label=label.slice(0,7)+'…';
      ctx.fillText(label,lp.x,lp.y);
    });

    const compareCount=s.compare.length;
    s.compare.forEach((ri,si)=>{
      const row=s.rows[ri];
      ctx.beginPath();

      cols.forEach((ci,i)=>{
        const v=row.scores[ci];
        const p=point(i,v/(s.scale||100));
        i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);
      });

      ctx.closePath();
      ctx.fillStyle=compareColor(si,compareCount,compareCount>6?.035:.08);
      ctx.fill();
      ctx.strokeStyle=compareColor(si,compareCount);
      ctx.lineWidth=compareCount>10?1.25:1.8;
      ctx.stroke();
    });
  }

  function renderBarCompare(){
    const s=activeSheet();
    const cols=activeCompareColumnIndices();

    if(!s.compare.length){
      $('barCompare').innerHTML=`<div class="status">${esc(t('compare.chooseLong'))}</div>`;
      return;
    }

    if(!cols.length){
      $('barCompare').innerHTML=`<div class="status">${esc(t('compare.noScored'))}</div>`;
      return;
    }

    $('barCompare').innerHTML=cols.map(ci=>{
      const c=s.cols[ci]||t('fallback.metric',{n:ci+1});

      const rows=s.compare.map((ri,idx)=>{
        const row=s.rows[ri];
        const v=Number.isFinite(row?.scores?.[ci])?row.scores[ci]:null;
        return `<div class="barRow">
          <div class="barName">${esc(row?.name.trim()||t('fallback.target',{n:ri+1}))}</div>
          <div class="barTrack">
            <div class="barFill" style="width:${v==null?0:(v/(s.scale||100))*100}%;background:${compareColor(idx,s.compare.length)}"></div>
          </div>
          <div class="barValue">${fmt(v)}</div>
        </div>`;
      }).join('');

      return `<div>
        <div class="barGroupTitle">${esc(c)}</div>
        ${rows}
      </div>`;
    }).join('');
  }



  function renderSummary(){
    const s=activeSheet(),avgs=s.rows.map(avg).filter(v=>v!=null);
    $('rowCount').textContent=s.rows.length;
    $('colCount').textContent=s.cols.length;
    $('topAverage').textContent=avgs.length?fmt(Math.max(...avgs)):'--';
    $('completionRate').textContent=`${overallProgress()}%`;
    renderWeightMode();
  }



  let weightDraft=[];

  function normalizedWeightPercentages(weights){
    const safe=weights.map(v=>{
      const n=Number(v);
      return Number.isFinite(n)&&n>0?n:0;
    });
    const total=safe.reduce((a,b)=>a+b,0);
    if(total<=0){
      const equal=safe.length?100/safe.length:0;
      return safe.map(()=>equal);
    }
    return safe.map(v=>v/total*100);
  }

  function renderWeightMode(){
    const s=activeSheet();
    $('weightOffBtn').classList.toggle('active',!s.weighted);
    $('weightOnBtn').classList.toggle('active',!!s.weighted);
    $('weightSettingsBtn').classList.toggle('hidden',!s.weighted);
    $('weightSummary').classList.toggle('hidden',!s.weighted);
    if(s.weighted){
      const pct=normalizedWeightPercentages(s.weights);
      const parts=s.cols.map((c,i)=>`${c} ${pct[i].toFixed(1).replace('.0','')}%`).join(' / ');
      $('weightSummary').textContent=t('weight.weightedSummary',{parts});
    }
  }

  function setWeighted(enabled){
    const s=activeSheet();
    s.weighted=!!enabled;
    renderAll();
    scheduleSave(enabled?t('weight.enabled'):t('weight.disabled'));
    if(enabled)setTimeout(openWeightDialog,30);
  }

  function openWeightDialog(){
    const s=activeSheet();
    weightDraft=s.weights.map(v=>{
      const n=Number(v);
      return Number.isFinite(n)&&n>=0?n:1;
    });
    while(weightDraft.length<s.cols.length)weightDraft.push(1);
    weightDraft=weightDraft.slice(0,s.cols.length);
    renderWeightDialogRows();
    $('weightDialogBackdrop').classList.remove('hidden');
  }

  function closeWeightDialog(){
    $('weightDialogBackdrop').classList.add('hidden');
  }

  function refreshWeightDialogPercentages(){
    const pct=normalizedWeightPercentages(weightDraft);
    const palette=['#6f98ff','#54d89a','#f2c860','#ae8dff','#f39a62','#5fc4d7','#ef7fa2','#8acb73','#d4a968','#8fa3ff'];

    document.querySelectorAll('[data-weight-pct]').forEach(el=>{
      const i=+el.dataset.weightPct;
      el.innerHTML=`${pct[i].toFixed(1).replace('.0','')}%<small>${esc(t('weight.distribution'))}</small>`;
    });

    $('weightMiniBar').innerHTML=pct.map((p,i)=>
      `<div class="weightMiniSeg" style="width:${p}%;background:${palette[i%palette.length]}"></div>`
    ).join('');
    $('weightTotal').textContent=t('weight.total');
  }

  function renderWeightDialogRows(){
    const s=activeSheet();
    $('weightRows').innerHTML=s.cols.map((c,i)=>`
      <div class="weightRow">
        <div class="weightRowName">${esc(c||t('fallback.metric',{n:i+1}))}</div>
        <input class="weightRange" data-weight-range="${i}" type="range" min="0" max="100" step="1" value="${Math.max(0,Math.min(100,Math.round(Number(weightDraft[i])||0)))}">
        <div class="weightPct" data-weight-pct="${i}">0%<small>${esc(t('weight.distribution'))}</small></div>
      </div>`).join('');

    document.querySelectorAll('[data-weight-range]').forEach(el=>{
      el.addEventListener('input',e=>{
        const i=+e.currentTarget.dataset.weightRange;
        weightDraft[i]=Math.max(0,Math.min(100,Number(e.currentTarget.value)||0));
        // Update only percentages/bars. Never recreate the range input mid-drag.
        refreshWeightDialogPercentages();
      });
    });

    refreshWeightDialogPercentages();
  }

  function equalizeWeights(){
    weightDraft=activeSheet().cols.map(()=>1);
    document.querySelectorAll('[data-weight-range]').forEach(el=>{
      el.value=1;
    });
    refreshWeightDialogPercentages();
  }

  function saveWeightDialog(){
    const s=activeSheet();
    const any=weightDraft.some(v=>Number(v)>0);
    s.weights=(any?weightDraft:s.cols.map(()=>1)).map(v=>Math.max(0,Number(v)||0));
    closeWeightDialog();
    renderAll();
    scheduleSave(t('weight.updated'));
  }

  function renderScaleMode(){
    const scale=activeSheet().scale||100;
    $('scale100Btn').classList.toggle('active',scale===100);
    $('scale10Btn').classList.toggle('active',scale===10);
  }

  function changeScale(nextScale){
    const s=activeSheet();
    const prev=s.scale||100;
    if(prev===nextScale)return;
    const factor=nextScale/prev;
    s.rows.forEach(row=>{
      row.scores=row.scores.map(v=>{
        if(v==null)return null;
        const converted=v*factor;
        return nextScale===10
          ? Math.max(0,Math.min(10,Math.round(converted*10)/10))
          : Math.max(0,Math.min(100,Math.round(converted)));
      });
    });
    s.scale=nextScale;
    renderAll();
    scheduleSave(t('scale.changed',{scale:nextScale}));
  }


  function renderViewMode(){
    const s=activeSheet();
    const mode=s.viewMode||'sheet';
    $('normalSheetView').classList.toggle('hidden',mode!=='sheet');
    $('overviewSheetView').classList.toggle('hidden',mode!=='overview');
    $('fitSheetView').classList.toggle('hidden',mode!=='fit');
    $('sheetViewBtn').classList.toggle('active',mode==='sheet');
    $('overviewViewBtn').classList.toggle('active',mode==='overview');
    $('fitViewBtn').classList.toggle('active',mode==='fit');
    syncColumnManagerVisibility();
    if(mode==='fit'){
      setTimeout(()=>{renderFitTable();applyFitScale();},0);
    }
  }

  function renderOverview(){
    const s=activeSheet();
    $('overviewGrid').innerHTML=filteredRows().map(({row,index:ri})=>{
      const a=avg(row);
      const metrics=s.cols.map((c,ci)=>{
        const v=row.scores[ci];
        return `<div class="overviewMetric ${heatClass(v)}">
          <div class="overviewMetricName">${esc(c||t('fallback.metric',{n:ci+1}))}</div>
          <div class="overviewMetricValue">${fmt(v)}</div>
        </div>`;
      }).join('');
      const rp=rowProgress(row);
      return `<div class="overviewCard">
        <div class="overviewCardTop">
          <div class="overviewThumb">${row.image?`<img src="${row.image}" alt="">`:'—'}</div>
          <div class="overviewName">
            ${esc(row.name.trim()||t('fallback.target',{n:ri+1}))}
            <div class="overviewMeta">
              <span class="progressPill ${rp.pct===100?'complete':''}">${rp.done}/${rp.total}</span>
              ${row.note?`<span class="overviewNote">${esc(row.note)}</span>`:''}
            </div>
          </div>
          <div class="overviewAvg">
            <div class="overviewAvgValue">${fmt(a)}</div>
            <div class="overviewAvgGrade">${grade(a)}</div>
          </div>
        </div>
        <div class="overviewMetrics">${metrics}</div>
      </div>`;
    }).join('');
  }


  function renderFitTable(){
    const s=activeSheet();
    let h=`<thead><tr><th>#</th><th class="fitName">${esc(t('table.target'))}</th>`;
    s.cols.forEach(c=>h+=`<th>${esc(c)}</th>`);
    h+=`<th>${esc(t('table.average'))}</th></tr></thead><tbody>`;
    filteredRows().forEach(({row,index:ri})=>{
      const a=avg(row);
      h+=`<tr><td>${ri+1}</td><td class="fitName"><div class="fitNameInner"><span class="fitThumb">${row.image?`<img src="${row.image}" alt="">`:'—'}</span><span>${esc(row.name.trim()||t('fallback.target',{n:ri+1}))}</span></div></td>`;
      row.scores.slice(0,s.cols.length).forEach(v=>{
        h+=`<td class="${heatClass(v)}">${fmt(v)}</td>`;
      });
      h+=`<td class="${heatClass(a)}"><strong>${fmt(a)}</strong></td></tr>`;
    });
    h+='</tbody>';
    $('fitTable').innerHTML=h;
  }

  function getFitBaseSize(){
    const table=$('fitTable');
    return {
      w:Math.max(table.scrollWidth,table.offsetWidth,1),
      h:Math.max(table.scrollHeight,table.offsetHeight,1)
    };
  }

  function calculateFitScale(mode){
    const viewport=$('fitViewport');
    const base=getFitBaseSize();
    const pad=16;
    const availW=Math.max(120,viewport.clientWidth-pad);
    const availH=Math.max(120,viewport.clientHeight-pad);
    const widthScale=availW/base.w;
    const allScale=Math.min(widthScale,availH/base.h);
    if(mode==='width')return Math.min(1.35,widthScale);
    if(mode==='all')return Math.min(1.15,allScale);
    const mobile=window.matchMedia('(max-width: 760px)').matches;
    return mobile ? Math.min(1.15,allScale) : Math.min(1.15,widthScale);
  }

  function applyFitScale(){
    const s=activeSheet();
    if(s.viewMode!=='fit')return;
    const mode=s.fitMode||'auto';
    const autoScale=calculateFitScale(mode);
    const zoom=Number.isFinite(s.fitZoom)?s.fitZoom:1;
    const scale=Math.max(.18,Math.min(1.5,autoScale*zoom));
    $('fitCanvas').style.transform=`scale(${scale})`;

    // Match viewport height to the actual scaled table instead of keeping
    // a large fixed black area below short tables.
    const base=getFitBaseSize();
    const contentH=base.h*scale+16;
    const maxH=Math.min(window.innerHeight*0.62,560);
    const targetH=Math.max(140,Math.min(maxH,contentH));
    $('fitViewport').style.height=`${Math.round(targetH)}px`;

    $('zoomReadout').textContent=`${Math.round(scale*100)}%`;
    $('fitAutoBtn').classList.toggle('active',mode==='auto');
    $('fitWidthBtn').classList.toggle('active',mode==='width');
    $('fitAllBtn').classList.toggle('active',mode==='all');
  }

  function setFitMode(mode){
    const s=activeSheet();
    s.fitMode=mode;
    s.fitZoom=1;
    renderFitTable();
    applyFitScale();
    scheduleSave('');
  }

  function adjustFitZoom(delta){
    const s=activeSheet();
    s.fitZoom=Math.max(.35,Math.min(2.2,(s.fitZoom||1)+delta));
    applyFitScale();
    scheduleSave('');
  }

  function renderColumnManager(){
    const s=activeSheet();
    $('columnManage').innerHTML=s.cols.map((c,ci)=>`
      <div class="columnChip">
        <button class="columnMoveBtn" data-move-col-left="${ci}" type="button" aria-label="${esc(t('aria.left'))}">◀</button>
        <span class="columnChipName">${esc(c||t('fallback.metric',{n:ci+1}))}</span>
        <button class="columnMoveBtn" data-move-col-right="${ci}" type="button" aria-label="${esc(t('aria.right'))}">▶</button>
        <button class="columnDeleteBtn" data-delete-col="${ci}" type="button" aria-label="${esc(t('aria.deleteMetric',{name:c||t('fallback.metric',{n:ci+1})}))}">×</button>
      </div>`).join('');

    document.querySelectorAll('[data-delete-col]').forEach(el=>el.addEventListener('click',e=>{
      deleteColumn(+e.currentTarget.dataset.deleteCol);
    }));
    document.querySelectorAll('[data-move-col-left]').forEach(el=>el.addEventListener('click',e=>{
      moveColumn(+e.currentTarget.dataset.moveColLeft,-1);
    }));
    document.querySelectorAll('[data-move-col-right]').forEach(el=>el.addEventListener('click',e=>{
      moveColumn(+e.currentTarget.dataset.moveColRight,1);
    }));
  }

  function moveColumn(ci,dir){
    const s=activeSheet();
    const ni=ci+dir;
    if(ni<0||ni>=s.cols.length)return;
    [s.cols[ci],s.cols[ni]]=[s.cols[ni],s.cols[ci]];
    [s.weights[ci],s.weights[ni]]=[s.weights[ni],s.weights[ci]];
    s.rows.forEach(r=>{
      [r.scores[ci],r.scores[ni]]=[r.scores[ni],r.scores[ci]];
    });

    if(typeof s.sortKey==='number'){
      if(s.sortKey===ci)s.sortKey=ni;
      else if(s.sortKey===ni)s.sortKey=ci;
    }
    if(typeof s.rankMetric==='number'){
      if(s.rankMetric===ci)s.rankMetric=ni;
      else if(s.rankMetric===ni)s.rankMetric=ci;
    }

    renderAll();
    scheduleSave(t('metric.moved'));
  }

  function deleteColumn(ci){
    const s=activeSheet();
    if(s.cols.length<=1){
      $('statusText').textContent=t('metric.lastCannotDelete');
      return;
    }
    const name=s.cols[ci]||t('fallback.metric',{n:ci+1});
    s.cols.splice(ci,1);
    s.weights.splice(ci,1);
    s.rows.forEach(r=>r.scores.splice(ci,1));

    if(typeof s.sortKey==='number'){
      if(s.sortKey===ci)s.sortKey=null;
      else if(s.sortKey>ci)s.sortKey-=1;
    }
    if(typeof s.rankMetric==='number'){
      if(s.rankMetric===ci)s.rankMetric='avg';
      else if(s.rankMetric>ci)s.rankMetric-=1;
    }

    renderAll();
    scheduleSave(t('metric.deleted',{name}));
  }

  function renderSidebar(){renderRanking();renderCompare();renderSummary()}
  function renderAll(){
    const s=activeSheet();
    renderHeader();
    renderScaleMode();
    renderWeightMode();
    $('searchInput').value=s.search||'';
    $('gradeFilter').value=s.gradeFilter||'all';
    renderTable();
    renderOverview();
    renderFitTable();
    renderColumnManager();
    syncColumnManagerVisibility();
    renderSidebar();
    $('filterCount').textContent=t('count.filtered',{visible:filteredRows().length,total:s.rows.length});
    renderViewMode();
  }



  let noteEditingRow=null;

  function openNoteDialog(index){
    const s=activeSheet();
    noteEditingRow=index;
    const row=s.rows[index];
    $('noteDialogTitle').textContent=t('note.forTarget',{name:row.name.trim()||t('fallback.target',{n:index+1})});
    $('noteTextarea').value=row.note||'';
    $('noteDialogBackdrop').classList.remove('hidden');
    setTimeout(()=>$('noteTextarea').focus(),30);
  }

  function closeNoteDialog(){
    noteEditingRow=null;
    $('noteDialogBackdrop').classList.add('hidden');
  }

  function saveNoteDialog(){
    if(noteEditingRow===null)return closeNoteDialog();
    const s=activeSheet();
    if(!s.rows[noteEditingRow])return closeNoteDialog();
    s.rows[noteEditingRow].note=$('noteTextarea').value.trim();
    closeNoteDialog();
    renderAll();
    scheduleSave(t('note.saved'));
  }

  function moveRow(index,dir){
    const s=activeSheet();
    const ni=index+dir;
    if(ni<0||ni>=s.rows.length)return;
    [s.rows[index],s.rows[ni]]=[s.rows[ni],s.rows[index]];

    s.compare=s.compare.map(i=>{
      if(i===index)return ni;
      if(i===ni)return index;
      return i;
    });

    renderAll();
    scheduleSave(t('row.moved'));
  }

  function addRow(){
    const s=activeSheet();
    if(!s || !Array.isArray(s.rows))return;

    if(s.rows.length>=MAX_ROWS){
      $('statusText').textContent=t('row.max',{max:MAX_ROWS});
      return;
    }

    s.rows.push({
      name:'',
      image:'',
      note:'',
      scores:Array(s.cols.length).fill(null)
    });

    // New blank rows would be hidden by grade/search filters.
    // Reset filters so the user can immediately see and edit the row.
    s.search='';
    s.gradeFilter='all';
    s.viewMode='sheet';

    renderAll();

    requestAnimationFrame(()=>{
      const wrap=document.querySelector('.tableWrap');
      if(wrap){
        wrap.scrollTop=wrap.scrollHeight;
      }
      const nameInputs=document.querySelectorAll('.nameInput');
      const last=nameInputs[nameInputs.length-1];
      if(last){
        try{
          last.scrollIntoView({block:'center',inline:'nearest'});
          last.focus({preventScroll:true});
        }catch(e){
          last.focus();
        }
      }
    });

    scheduleSave(t('row.added'));
  }

  function addColumn(){
    const s=activeSheet();
    if(s.cols.length>=MAX_COLS){$('statusText').textContent=t('metric.max',{max:MAX_COLS});return;}
    s.cols.push(t('fallback.metric',{n:s.cols.length+1}));
    s.weights.push(1);
    s.rows.forEach(r=>r.scores.push(null));
    renderAll();scheduleSave(t('metric.added'));
  }


  function syncColumnManagerVisibility(){
    const panel=$('columnManage');
    if(!panel)return;
    panel.classList.toggle('hidden',!columnManagerVisible);

    const button=$('columnManageBtn');
    if(button){
      button.textContent=columnManagerVisible
        ? t('action.hideMetrics')
        : t('action.manageMetrics');
    }
  }

  function toggleScoreSettings(){
    const panel=$('scoreSettingsPanel');
    panel.classList.toggle('hidden');
    if(!panel.classList.contains('hidden')){
      $('utilityBar').classList.add('hidden');
      $('columnManage').classList.add('hidden');
    }else{
      syncColumnManagerVisibility();
    }
  }

  function toggleColumnManage(){
    columnManagerVisible=!columnManagerVisible;
    if(columnManagerVisible){
      $('scoreSettingsPanel').classList.add('hidden');
      $('utilityBar').classList.add('hidden');
    }
    syncColumnManagerVisibility();
  }

  function toggleMoreTools(){
    const panel=$('utilityBar');
    panel.classList.toggle('hidden');
    if(!panel.classList.contains('hidden')){
      $('scoreSettingsPanel').classList.add('hidden');
      $('columnManage').classList.add('hidden');
    }else{
      syncColumnManagerVisibility();
    }
  }

  function createNewSheet(){
    const s=blankSheet(`${t('fallback.newTopic')} ${library.sheets.length+1}`);
    library.sheets.push(s);library.activeId=s.id;renderAll();scheduleSave(t('sheet.created'));
  }

  function duplicateSheet(){
    const src=activeSheet(),copy=clone(src);
    copy.id=makeId();copy.title=(src.title||t('fallback.untitledSheet'))+t('fallback.copySuffix');copy.updatedAt=Date.now();
    library.sheets.push(copy);library.activeId=copy.id;renderAll();scheduleSave(t('sheet.duplicated'));
  }

  function deleteActiveSheet(){
    if(library.sheets.length<=1){$('statusText').textContent=t('sheet.lastCannotDelete');return;}
    const current=activeSheet();
    if(!window.confirm(t('sheet.deleteConfirm',{name:current.title||t('fallback.untitledSheet')})))return;
    const idx=library.sheets.findIndex(s=>s.id===library.activeId);
    library.sheets.splice(idx,1);
    library.activeId=library.sheets[Math.max(0,idx-1)].id;
    renderAll();scheduleSave(t('sheet.deleted'));
  }

  $('titleInput').addEventListener('input',e=>{activeSheet().title=e.currentTarget.value;renderSheetSelect();scheduleSave('');});
  $('descInput').addEventListener('input',e=>{activeSheet().desc=e.currentTarget.value;scheduleSave('');});
  $('sheetSelect').addEventListener('change',e=>{library.activeId=e.currentTarget.value;renderAll();scheduleSave(t('sheet.switched'));});
  $('viewOnlyBtn').addEventListener('click',()=>setViewOnly(!viewOnlyMode));
  $('exitViewOnlyBtn').addEventListener('click',()=>setViewOnly(false));
  $('exportJsonBtn').addEventListener('click',exportBackup);
  $('importJsonBtn').addEventListener('click',openImportDialog);
  $('exportCsvBtn').addEventListener('click',exportCsv);
  $('shareImageBtn').addEventListener('click',openShareImage);
  $('importCancelBtn').addEventListener('click',closeImportDialog);
  $('importBackdrop').addEventListener('click',e=>{
    if(e.target===$('importBackdrop'))closeImportDialog();
  });
  $('importFileInput').addEventListener('change',e=>{
    importBackupFile(e.currentTarget.files?.[0]);
  });
  $('sharePreviewCloseBtn').addEventListener('click',closeSharePreview);
  $('sharePreviewSaveBtn').addEventListener('click',saveOrShareImage);
  $('sharePreviewBackdrop').addEventListener('click',e=>{
    if(e.target===$('sharePreviewBackdrop'))closeSharePreview();
  });

  $('newSheetBtn').addEventListener('click',createNewSheet);
  $('duplicateBtn').addEventListener('click',duplicateSheet);
  $('deleteSheetBtn').addEventListener('click',deleteActiveSheet);
  $('addRowBtn').addEventListener('click',addRow);
  $('addRowWideBtn').addEventListener('click',addRow);
  $('addColBtn').addEventListener('click',addColumn);
  $('columnManageBtn').addEventListener('click',toggleColumnManage);
  $('scoreSettingsBtn').addEventListener('click',toggleScoreSettings);
  $('moreToolsBtn').addEventListener('click',toggleMoreTools);
  $('fitAutoBtn').addEventListener('click',()=>setFitMode('auto'));
  $('fitWidthBtn').addEventListener('click',()=>setFitMode('width'));
  $('fitAllBtn').addEventListener('click',()=>setFitMode('all'));
  $('zoomOutBtn').addEventListener('click',()=>adjustFitZoom(-0.1));
  $('zoomInBtn').addEventListener('click',()=>adjustFitZoom(0.1));
  $('scale100Btn').addEventListener('click',()=>changeScale(100));
  $('scale10Btn').addEventListener('click',()=>changeScale(10));
  $('weightOffBtn').addEventListener('click',()=>setWeighted(false));
  $('weightOnBtn').addEventListener('click',()=>setWeighted(true));
  $('weightSettingsBtn').addEventListener('click',openWeightDialog);
  $('weightEqualBtn').addEventListener('click',equalizeWeights);
  $('weightCancelBtn').addEventListener('click',closeWeightDialog);
  $('weightSaveBtn').addEventListener('click',saveWeightDialog);
  $('weightDialogBackdrop').addEventListener('click',e=>{
    if(e.target===$('weightDialogBackdrop'))closeWeightDialog();
  });
  $('noteCancelBtn').addEventListener('click',closeNoteDialog);
  $('noteSaveBtn').addEventListener('click',saveNoteDialog);
  $('noteDialogBackdrop').addEventListener('click',e=>{
    if(e.target===$('noteDialogBackdrop'))closeNoteDialog();
  });
  $('sheetViewBtn').addEventListener('click',()=>{
    activeSheet().viewMode='sheet';
    renderViewMode();
    scheduleSave('');
  });
  $('overviewViewBtn').addEventListener('click',()=>{
    activeSheet().viewMode='overview';
    renderOverview();
    renderViewMode();
    scheduleSave('');
  });
  $('fitViewBtn').addEventListener('click',()=>{
    activeSheet().viewMode='fit';
    renderFitTable();
    renderViewMode();
    scheduleSave('');
  });
  $('rankMetric').addEventListener('change',e=>{const v=e.currentTarget.value;activeSheet().rankMetric=v==='avg'?'avg':Number(v);renderRanking();scheduleSave('');});
  $('rankTopBtn').addEventListener('click',()=>{
    activeSheet().rankMode='top';
    renderRanking();
    scheduleSave('');
  });
  $('rankBottomBtn').addEventListener('click',()=>{
    activeSheet().rankMode='bottom';
    renderRanking();
    scheduleSave('');
  });
  $('searchInput').addEventListener('input',e=>{
    activeSheet().search=e.currentTarget.value;
    renderTable();
    renderOverview();
    renderFitTable();
    renderSidebar();
    $('filterCount').textContent=t('count.filtered',{visible:filteredRows().length,total:activeSheet().rows.length});
    scheduleSave('');
  });
  $('gradeFilter').addEventListener('change',e=>{
    activeSheet().gradeFilter=e.currentTarget.value;
    renderTable();
    renderOverview();
    renderFitTable();
    renderSidebar();
    $('filterCount').textContent=t('count.filtered',{visible:filteredRows().length,total:activeSheet().rows.length});
    scheduleSave('');
  });
  $('compareAllBtn').addEventListener('click',()=>{
    const s=activeSheet();
    s.compare=s.rows.map((_,i)=>i);
    renderCompare();
    scheduleSave(t('compare.addAll'));
  });
  $('compareClearBtn').addEventListener('click',()=>{
    activeSheet().compare=[];
    renderCompare();
    scheduleSave(t('compare.clearAll'));
  });
  $('radarTab').addEventListener('click',()=>{activeSheet().compareView='radar';renderCompare();scheduleSave('');});
  $('barTab').addEventListener('click',()=>{activeSheet().compareView='bar';renderCompare();scheduleSave('');});

  window.addEventListener('resize',()=>{
    clearTimeout(window.__smv03Resize);
    window.__smv03Resize=setTimeout(()=>{if(activeSheet().compareView==='radar')drawRadar();if(activeSheet().viewMode==='fit')applyFitScale();},100);
  });

  window.addEventListener('statsmaker:languagechange',()=>{
    window.SM_I18N?.applyTranslations();
    renderAll();
    if(viewOnlyMode)$('viewOnlyBtn').textContent=t('tools.viewing');
  });

  renderAll();
  window.SM_I18N?.applyTranslations();
  scheduleSave('');

  // R10 bridge for source-linked visual extensions.
  window.__statsMakerGetActiveSheet = () => clone(activeSheet());
  window.__statsMakerGetLibrary = () => clone(library);

})();
