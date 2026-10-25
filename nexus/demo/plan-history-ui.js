import { validPlanDetails } from './nexus-ai-contract.js';
import { appendPlanDetails } from './plan-details-ui.js';
import { validPlanRiskScenario } from './plan-risk-scenario.js';
import { appendPlanRiskScenario } from './plan-risk-scenario-ui.js';
const KINDS={created:'Идея сохранена',edited:'Содержание изменено',status:'Статус изменён','legacy-observation':'Прежнее содержание впервые зафиксировано'};
const ACTIONS={watch:'Наблюдение',buy:'Покупка',sell:'Продажа'};
const STATUSES={draft:'Черновик',watching:'Наблюдаю',completed:'Завершено пользователем',cancelled:'Отменено'};
const VALUE_KEYS=['id','portfolioId','instrumentUid','plannedFor','action','entryPrice','stopPrice','targetPrice','note','status','createdAt','updatedAt'];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed)=>object(value)&&Object.keys(value).length===allowed.length&&Object.keys(value).every(key=>allowed.includes(key));
const iso=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))return false;const date=new Date(value);return Number.isFinite(date.getTime())&&date.toISOString()===value;};
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(value)&&iso(value+'T00:00:00.000Z');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9._:@/-]{1,160}$/u.test(value);
const price=value=>{if(value===null)return true;if(typeof value!=='string'||!/^(?:0|[1-9]\d{0,17})(?:\.\d{1,9})?$/u.test(value))return false;return BigInt(value.replace('.',''))>0n;};
function invalid(){throw Object.assign(new Error('Не удалось проверить историю этой идеи.'),{code:'TRADING_PLAN_HISTORY_RESPONSE_INVALID'});}
export function validatePlanHistory(data,{planId,portfolioIds}){
 if(!keys(data,['schema','planId','execution','coverage','items'])||!['trading-plan-history-v1','trading-plan-history-v2','trading-plan-history-v3','trading-plan-history-v4'].includes(data.schema)||data.planId!==planId||data.execution!=='none'||!Array.isArray(data.items)||data.items.length>50)invalid();
 const c=data.coverage;
 if(!keys(c,['origin','retainedLimit','earlierVersionsDropped','someAccountVersionsUnavailable','clock','semantics'])||!['from-local-create','unknown-before-first-observation'].includes(c.origin)
  ||c.retainedLimit!==50||typeof c.earlierVersionsDropped!=='boolean'||typeof c.someAccountVersionsUnavailable!=='boolean'||c.clock!=='local-device-clock'||c.semantics!=='accepted-local-writes')invalid();
 let previous;
 for(const row of data.items){
  if(!keys(row,['sequence','kind','recordedAt','clockRegressed','value'])||!Number.isSafeInteger(row.sequence)||row.sequence<1||!Object.hasOwn(KINDS,row.kind)||!iso(row.recordedAt)||typeof row.clockRegressed!=='boolean')invalid();
  const v=row.value;
  const withBasis=Object.hasOwn(v||{},'priceBasis');
  const withRisk=Object.hasOwn(v||{},'riskScenario');
  const withDetails=Object.hasOwn(v||{},'planDetails');
  if(!keys(v,[...VALUE_KEYS,...(withBasis?['priceBasis']:[]),...(withRisk?['riskScenario']:[]),...(withDetails?['planDetails']:[])])||withBasis&&(data.schema==='trading-plan-history-v1'||!validPlanPriceBasis(v.priceBasis))
   ||withRisk&&(!['trading-plan-history-v3','trading-plan-history-v4'].includes(data.schema)||!validPlanRiskScenario(v.riskScenario,v))
   ||withDetails&&(data.schema!=='trading-plan-history-v4'||!validPlanDetails(v.planDetails))
   ||v.id!==planId||!id(v.id)||!id(v.instrumentUid)||!portfolioIds.includes(v.portfolioId)||!day(v.plannedFor)||!Object.hasOwn(ACTIONS,v.action)||!Object.hasOwn(STATUSES,v.status)
   ||!['entryPrice','stopPrice','targetPrice'].every(key=>price(v[key]))||typeof v.note!=='string'||v.note.length>2000||!iso(v.createdAt)||!iso(v.updatedAt))invalid();
  if(previous&&(row.sequence<=previous.sequence||(!c.someAccountVersionsUnavailable&&row.sequence!==previous.sequence+1)
   ||(row.sequence===previous.sequence+1&&row.recordedAt<previous.recordedAt&&!row.clockRegressed)))invalid();
  if(row.sequence===1&&row.clockRegressed)invalid();
  previous=row;
 }
 if(c.origin==='from-local-create'&&(data.items[0]?.sequence!==1||data.items[0]?.kind!=='created'||c.earlierVersionsDropped))invalid();
 if(c.earlierVersionsDropped&&data.items[0]?.sequence===1)invalid();
 return data;
}
const localTime=value=>new Intl.DateTimeFormat('ru-RU',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(new Date(value));
const reviewDate=value=>value.split('-').reverse().join('.');
let disclosureId=0;
export function createPlanHistoryDisclosure({planId,request,getRevision,isCurrent,getPortfolios,labelInstrument,canOpen,review=false,onOpenSource,onInvalidateSource=()=>{},getCachedHistory=()=>null}){
 const node=(tag,text,className)=>{const value=document.createElement(tag);if(text!==undefined)value.textContent=text;if(className)value.className=className;return value;};
 const button=node('button','История изменений','button plan-history-toggle');button.type='button';button.setAttribute('aria-expanded','false');
 const region=node('section',undefined,'plan-history');region.id='plan-history-'+(++disclosureId);region.hidden=true;region.setAttribute('role','region');region.setAttribute('aria-label','История изменений идеи');button.setAttribute('aria-controls',region.id);
 let generation=0,active=true,controller;
 function close(){generation++;controller?.abort();controller=null;onInvalidateSource();region.hidden=true;region.replaceChildren();region.setAttribute('aria-busy','false');button.setAttribute('aria-expanded','false');}
 function render(data){
  const c=data.coverage;region.replaceChildren(node('h5','Сохранённые версии'),node('p',c.origin==='from-local-create'?'История с первого локального сохранения.':'Начало истории неизвестно. Прежние версии не восстановлены.'));
  region.append(node('p','Время фиксации — по часам этого устройства. Дата пересмотра указана отдельно. Версии не подтверждают сделку или прочтение.','plan-history-caption'));
  region.append(node('p','Хранятся последние 50 версий. Удаление идеи удаляет её историю.','plan-history-caption'));
  if(c.earlierVersionsDropped)region.append(node('p','Более ранние версии уже удалены из истории.'));
  if(c.someAccountVersionsUnavailable)region.append(node('p','Часть версий относится к недоступным счетам и не показана.'));
  if(!data.items.length){region.dataset.state='empty';region.append(node('p','Пока нет сохранённых версий. Это не означает, что идея раньше не менялась.'));return;}
  region.dataset.state='ready';const count=node('p',undefined,'plan-history-caption'),list=node('div',undefined,'plan-history-versions');count.setAttribute('role','status');region.append(count,list);
  const rows=[...data.items].reverse();let shown=0;
  function appendPage(){let first;
  for(const row of rows.slice(shown,shown+5)){
   const record=node(review?'article':'details',undefined,'plan-history-version'),summary=node(review?'h6':'summary',`Версия ${row.sequence} · ${KINDS[row.kind]}`),details=review?node('div'):record;record.append(summary);
   first ||= summary;
   const v=row.value;details.append(node('p','Зафиксировано: '+localTime(row.recordedAt)));
   if(row.kind==='legacy-observation')details.append(node('p','Прежнее содержание впервые зафиксировано в этот момент. Его более ранняя история неизвестна.'));
   if(row.clockRegressed)details.append(node('p','Часы устройства показывали более раннее время. Порядок сохранений указан номерами версий.'));
   const values=node('dl');for(const [label,value]of [
    ['Инструмент (текущее название)',labelInstrument(v)],['Счёт',getPortfolios().find(p=>p.id===v.portfolioId)?.label||'Название недоступно'],
    ['Пересмотреть',reviewDate(v.plannedFor)],['Намерение',ACTIONS[v.action]],['Отметка',STATUSES[v.status]],
   ]){const pair=node('div');pair.append(node('dt',label+': '),node('dd',value));values.append(pair);}details.append(values);
   const prices=[['Уровень входа',v.entryPrice],['Стоп',v.stopPrice],['Цель',v.targetPrice]].filter(([,value])=>value!==null);
   if(prices.length){const unit=planPriceUnitLabel(v.priceBasis);details.append(node('p',unit?'Единицы цен указаны владельцем при сохранении: '+unit+'.':'Единицы уровней в истории не сохранены.','plan-history-caption'));for(const [label,value]of prices)details.append(node('p',label+': '+value.replace('.',',')+(unit?' '+unit:'')));}
   appendPlanRiskScenario(details,v,{inline:review});
   details.append(node('p',v.note||'Заметка отсутствует.','plan-history-note'));
   if(review){
    record.append(node('p',localTime(row.recordedAt),'plan-link-caption'),node('p',`${ACTIONS[v.action]} · ${STATUSES[v.status]} · пересмотреть ${reviewDate(v.plannedFor)}`),node('p',v.note||'Заметка отсутствует.','plan-review-record-summary'));
    if(v.planDetails)appendPlanDetails(record,v.planDetails);
    if(v.riskScenario)record.append(node('p',`Сохранённый расчёт: ${v.riskScenario.result.units} ${v.riskScenario.input.assetType==='share'?'акций':'контрактов'}.`));
    if(row.clockRegressed)record.append(node('p','Часы устройства сдвинулись назад. Порядок указан номерами версий.','plan-review-limit'));
    const source=node('button','Источник версии','button');source.type='button';source.dataset.planReviewVersion=String(row.sequence);
    source.addEventListener('click',()=>{if(active&&canOpen()&&!region.hidden)onOpenSource?.({title:`Сохранённая версия ${row.sequence}`,body:details,opener:source});});record.append(source);first=first===summary?source:first;
   }
   list.append(record);
  }
  shown=Math.min(shown+5,rows.length);count.textContent=`Показано ${shown} из ${rows.length} доступных версий.`;return first;
  }
  appendPage();if(shown<rows.length){
   const more=node('button','Показать предыдущие версии','button');more.type='button';more.dataset.planHistoryMore='true';
   more.addEventListener('click',()=>{if(!canOpen())return;const first=appendPage();more.hidden=shown===rows.length;first?.focus();first?.scrollIntoView?.({block:'nearest'});});region.append(more);
  }
 }
 async function load(){
  if(!active||!canOpen())return;
  const ticket=++generation,version=getRevision(),focus=document.activeElement;
  onInvalidateSource();
  controller?.abort();controller=new AbortController();region.hidden=false;region.dataset.state='loading';region.setAttribute('aria-busy','true');button.setAttribute('aria-expanded','true');
  const loading=node('p','Загружаем историю…');loading.setAttribute('role','status');
  // Keep an explicitly focused retry connected while its read is pending.
  const retrying=region.contains(focus)&&focus?.dataset.planHistoryRetry==='true';
  if(retrying){region.children[0].textContent=loading.textContent;focus.setAttribute('aria-disabled','true');}else region.replaceChildren(loading);
  const valid=()=>active&&ticket===generation&&isCurrent(version);
  try{
   const data=getCachedHistory()||await request(`/api/trading-plan/${encodeURIComponent(planId)}/history`,{signal:controller.signal});
   if(!valid()){if(ticket===generation)close();return;}
   const parsed=validatePlanHistory(data,{planId,portfolioIds:getPortfolios().map(row=>row.id)}),restore=retrying&&document.activeElement===focus;
   render(parsed);if(restore){button.focus();button.scrollIntoView?.({block:'nearest'});}
  }catch{
   if(!valid()){if(ticket===generation)close();return;}
   region.dataset.state='error';const message=node('p','Не удалось открыть историю. Её содержимое пока неизвестно.');message.setAttribute('role','status');
   const retry=retrying?focus:node('button','Повторить загрузку истории','button');retry.type='button';retry.dataset.planHistoryRetry='true';retry.removeAttribute('aria-disabled');
   if(!retrying){retry.addEventListener('click',()=>{if(region.dataset.state!=='loading')void load();});region.replaceChildren(message,retry);}else region.children[0].textContent=message.textContent;
  }finally{if(valid())region.setAttribute('aria-busy','false');}
 }
 button.addEventListener('click',()=>{if(!region.hidden)close();else void load();});
 return {button,region,close,dispose(){active=false;close();}};
}
import { validPlanPriceBasis, planPriceUnitLabel } from './plan-price-basis.js';
