// Sorting uses raw fields before pagination, never the formatted cell strings.
export function sortRows(rows, sort, readers = {}) {
  if (!sort?.key) return rows;
  const read = readers[sort.key] || (row => row[sort.key]);
  const compare = new Intl.Collator('ru', {numeric:true,sensitivity:'base'}).compare;
  return rows.map((row,index)=>({row,index,value:read(row)})).sort((a,b)=>{
    const empty = value => value == null || value === '' || typeof value === 'number' && !Number.isFinite(value);
    if (empty(a.value) || empty(b.value)) return Number(empty(a.value))-Number(empty(b.value)) || a.index-b.index;
    let result;
    if (/^-?\d+$/.test(String(a.value)) && /^-?\d+$/.test(String(b.value))) {
      const left=BigInt(a.value),right=BigInt(b.value); result=left<right?-1:left>right?1:0;
    } else if (typeof a.value==='number' && typeof b.value==='number') result=a.value-b.value;
    else result=compare(String(a.value),String(b.value));
    return (sort.direction==='desc'?-result:result) || a.index-b.index;
  }).map(item=>item.row);
}

export function connectTableSort(table, keys, onChange) {
  if (!table?.tHead) return;
  let sort=null;
  const headers=[...table.tHead.rows[0].cells];
  headers.forEach((header,index)=>{
    if (!keys[index]) return;
    const button=document.createElement('button');
    button.type='button'; button.className='column-sort';
    const label=document.createElement('span'); label.textContent=header.textContent;
    const arrow=document.createElement('span'); arrow.className='sort-direction';arrow.setAttribute('aria-hidden','true');arrow.textContent='↕';
    button.append(label,arrow);header.replaceChildren(button);header.setAttribute('aria-sort','none');
    button.addEventListener('click',()=>{
      sort={key:keys[index],direction:sort?.key===keys[index]&&sort.direction==='asc'?'desc':'asc'};
      headers.forEach(h=>{h.setAttribute('aria-sort','none');const icon=h.querySelector('.sort-direction');if(icon)icon.textContent='↕';});
      header.setAttribute('aria-sort',sort.direction==='asc'?'ascending':'descending');
      arrow.textContent=sort.direction==='asc'?'↑':'↓';onChange(sort);
    });
  });
}
