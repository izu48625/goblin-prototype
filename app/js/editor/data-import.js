
import {
  parseTableText,
  mapRankingRows,
  mapQuadrantRows,
  mapStatRows,
  mapRadarMatrix,
  mapRangeRows,
  mapRingRows,
  mapWaffleRows,
  mapHeatmapMatrix,
  previewRows
} from "../core/import.js";

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

export function createDataImport({
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
