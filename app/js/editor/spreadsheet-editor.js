export function createSpreadsheetEditor({
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
