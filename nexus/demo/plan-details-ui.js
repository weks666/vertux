import { assertNexusAiContract, validPlanDetails } from './nexus-ai-contract.js';
const fields = [
 ['intent','Намерение','select',[['watch','Наблюдать'],['enter','Открыть позицию'],['increase','Увеличить'],['reduce','Уменьшить'],['close','Закрыть']]],
 ['direction','Направление позиции','select',[['long','Лонг'],['short','Шорт']]],
 ['horizonDays','Срок удержания, дней','number'],['validUntil','Идея действует до','date'],
 ['thesis','Почему ожидаю движение','textarea'],['catalysts','События и основания — по одному в строке','textarea'],
 ['entryCondition','Условия входа','textarea'],['invalidation','Когда идея перестаёт работать','textarea'],
 ['exitRules','Выход по времени или событию','textarea'],
 ['rangeMin','Диапазон входа: от','text'],['rangeMax','Диапазон входа: до','text'],
 ['exitTargets','Частичные цели: цена; доля в % — по одной в строке','textarea'],
];
const node=(doc,tag,text,className)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
export function createPlanDetailsEditor(form,before) {
 const doc=form.ownerDocument||globalThis.document, region=node(doc,'details',undefined,'plan-details-editor'),summary=node(doc,'summary','Условия и срок идеи'),grid=node(doc,'div',undefined,'plan-details-grid');
 const inputs=new Map();let original;
 region.append(summary,node(doc,'p','Дополнительные поля необязательны. Цены используют единицы основного плана.','muted'),grid);
 for(const [key,label,type,options] of fields){
  const row=node(doc,'label',undefined,type==='textarea'?'plan-details-wide':undefined),input=node(doc,type==='select'?'select':type==='textarea'?'textarea':'input');
  input.id='planDetail-'+key; input.dataset.planDetail=key;
  if(type==='select'){input.append(node(doc,'option','Не указано'));input.options[0].value='';for(const [value,title] of options){const opt=node(doc,'option',title);opt.value=value;input.append(opt);}}
  else if(type==='textarea'){input.rows=2;input.maxLength=key==='catalysts'?5000:2000;}
  else{input.type=type;if(type==='number'){input.min='1';input.max='36500';input.step='1';}if(type==='text'){input.inputMode='decimal';input.maxLength=28;}}
  row.append(node(doc,'span',label),input);grid.append(row);inputs.set(key,input);
 }
 const clear=node(doc,'button','Очистить дополнительные условия','button secondary');clear.type='button';clear.addEventListener('click',()=>set());region.append(clear);
 if(typeof form.insertBefore==='function')form.insertBefore(region,before);else form.append(region);
 function set(value){original=value;for(const [key,input] of inputs){let v=value?.[key];if(key==='catalysts')v=v?.join('\n');if(key==='exitTargets')v=v?.map(t=>`${t.price}; ${t.fractionPct}`).join('\n');if(key==='rangeMin')v=value?.entryRange?.min;if(key==='rangeMax')v=value?.entryRange?.max;input.value=v??'';}}
 function read(){
  const result={schema:'plan-details-v1',...(original?.sources?{sources:original.sources}:{}),...(original?.lifecycle?{lifecycle:original.lifecycle}:{})};
  for(const [key,input] of inputs){const v=input.value.trim();if(!v||['rangeMin','rangeMax'].includes(key))continue;
   if(key==='horizonDays')result[key]=Number(v);
   else if(key==='catalysts')result[key]=v.split('\n').map(s=>s.trim()).filter(Boolean);
   else if(key==='exitTargets')result[key]=v.split('\n').filter(s=>s.trim()).map(line=>{const parts=line.split(';');if(parts.length!==2)throw new TypeError('Для каждой цели укажите цену и долю через точку с запятой.');return {price:parts[0].trim().replace(',','.'),fractionPct:parts[1].trim().replace(',','.')};});
   else result[key]=v;
  }
  const min=inputs.get('rangeMin').value.trim(),max=inputs.get('rangeMax').value.trim();if(min||max)result.entryRange={min:min.replace(',','.'),max:max.replace(',','.')};
  try{return Object.keys(result).length===1?null:assertNexusAiContract('PlanExtension',result);}catch{throw new TypeError('Проверьте срок, диапазон входа и доли целей: их сумма не должна превышать 100%.');}
 }
 return {element:region,set,read,disable(value){for(const input of inputs.values())input.disabled=value;clear.disabled=value;},focus(){region.open=true;inputs.get('thesis').focus();}};
}
export function appendPlanDetails(host,value) {
 if(!validPlanDetails(value))return;
 const doc=host.ownerDocument||globalThis.document, region=node(doc,'details',undefined,'plan-details-read'),body=node(doc,'dl');region.append(node(doc,'summary','Условия идеи'),body);
 const add=(label,text)=>{if(text===undefined||text===null||text==='')return;body.append(node(doc,'dt',label),node(doc,'dd',String(text)));};
 for(const [key,label,type,options]of fields){if(['rangeMin','rangeMax'].includes(key))continue;let v=value[key];if(type==='select')v=options.find(([id])=>id===v)?.[1];if(key==='catalysts')v=v?.join('\n');if(key==='exitTargets')v=v?.map(t=>`${t.price} · ${t.fractionPct}%`).join('\n');add(label,v);}
 if(value.entryRange)add('Диапазон входа',`${value.entryRange.min} — ${value.entryRange.max}`);
 if(value.sources?.length)add('Сохранённые источники',value.sources.map(s=>`${s.title} · ${s.url}`).join('\n'));
 host.append(region);
}
