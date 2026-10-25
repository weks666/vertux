const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const date=value=>Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'Дата неизвестна';
function prose(text,sources,cls){
 const p=node('p',undefined,cls),verified=new Set(sources.map(s=>s.url));let cursor=0;
 for(const match of text.matchAll(/\[([^\]\n]{1,320})\]\((https:\/\/[^\s)]+)\)/gu)){
  if(!verified.has(match[2]))continue;p.append(document.createTextNode(text.slice(cursor,match.index)));const link=node('a',match[1]);link.href=match[2];link.target='_blank';link.rel='noopener noreferrer';p.append(link);cursor=match.index+match[0].length;
 }
 p.append(document.createTextNode(text.slice(cursor)));return p;
}
const LABELS={portfolioId:'Счёт',instrumentUid:'Инструмент',plannedFor:'Дата пересмотра',action:'Действие',entryPrice:'Цена входа',stopPrice:'Стоп',targetPrice:'Цель',note:'Заметка',planDetails:'Условия идеи',thesis:'Основание',horizonDays:'Срок, дней',validUntil:'Действует до',invalidation:'Условие отмены',entryCondition:'Условие входа',exitRules:'Правило выхода',direction:'Направление',intent:'Намерение',catalysts:'События',exitTargets:'Частичные цели',entryRange:'Диапазон входа',min:'От',max:'До',sources:'Источники',lifecycle:'Состояние'};
function comparison(value,parent){if(!value)return;
 const wrap=node('div',undefined,'nexus-ai-comparison');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Сравнение планов');
 const table=node('table'),thead=node('thead'),head=node('tr');for(const text of ['Идея','Срок','Риск и единицы','Условия','Пробелы']){const th=node('th',text);th.scope='col';head.append(th);}thead.append(head);table.append(thead);const body=node('tbody');
 for(const row of value.rows){const tr=node('tr');for(const text of [row.label,row.horizon,row.risk+'\n'+row.basis,row.conditions,row.gaps.join('; ')||'Нет в выбранных критериях'])tr.append(node('td',text));body.append(tr);}table.append(body);wrap.append(table);parent.append(wrap);
 parent.append(node('p','Критерии: '+value.criteria.join('; ')),node('p',value.reason));if(value.conditions.length)parent.append(node('p','Условия предпочтения: '+value.conditions.join('; ')));
}
function field(key,value,labels){if(value===undefined||value===null||value==='')return 'Не указано';
 if(key==='portfolioId')return labels.portfolio(value);if(key==='instrumentUid')return labels.instrument(value);
 if(['action','direction','intent','lifecycle'].includes(key))return ({watch:'Наблюдать',buy:'Купить',sell:'Продать',long:'Лонг',short:'Шорт',enter:'Открыть',increase:'Увеличить',reduce:'Уменьшить',close:'Закрыть',draft:'Черновик',watching:'Наблюдение',active:'Активная идея',review:'Пересмотр',closed:'Закрыта',cancelled:'Отменена'})[value]||'Не указано';
 if(typeof value==='object')return Array.isArray(value)?value.map(item=>typeof item==='string'?item:item.title||item.price+' · '+item.fractionPct+'%').join('\n'):
  Object.entries(value).filter(([k])=>k!=='schema').map(([k,v])=>(LABELS[k]||'Условие')+': '+field(k,v,labels)).join('\n');return String(value);
}
export function renderNexusReport(parent,item){const report=item.report;parent.append(prose(report.summary,report.sources,'nexus-ai-answer'));
 if(item.stale)parent.append(node('p','Планы изменились после разбора. Ответ относится к сохранённому снимку.','nexus-ai-stage'));
 comparison(report.comparison,parent);
 const evidence=node('details',undefined,'nexus-ai-evidence');evidence.append(node('summary','Контекст и источники'));
 const gaps=node('ul',undefined,'nexus-ai-gaps');
 for(const block of report.blocks){if(block.kind==='gap'){gaps.append(node('li',block.text));continue;}
  const section=node('section',undefined,'nexus-ai-block');section.dataset.kind=block.kind;
  section.append(node('small',({fact:'Факт источника',calculation:'Расчёт',interpretation:'Разбор',hypothesis:'Предположение'})[block.kind]),prose(block.text,report.sources));
  if(block.assumptions.length)section.append(node('p','Условия: '+block.assumptions.join('; '),'nexus-ai-assumptions'));
  if(block.sourceIds.length)section.append(node('small','Основание: '+block.sourceIds.map(id=>report.sources.find(s=>s.id===id)?.title||'Сохранённый источник').join('; ')));
  if(['fact','calculation'].includes(block.kind))evidence.append(section);else parent.append(section);
 }
 if(gaps.childElementCount)evidence.append(node('h4','Не хватает данных'),gaps);
 if(report.sources.length){const sources=node('details',undefined,'nexus-ai-sources');sources.append(node('summary','Источники · '+report.sources.length));
  for(const source of report.sources){let url;try{url=new URL(source.url);}catch{continue;}if(url.protocol!=='https:'||url.username||url.password)continue;
   const link=node('a',source.title+' · '+url.hostname);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';sources.append(link,node('small','Получено '+date(source.retrievedAt)));}evidence.append(sources);}
 const hasEvidence=report.sources.length||item.context?.planRevisionRefs?.length||item.context?.instrumentRefs?.length||report.blocks.some(block=>['fact','calculation'].includes(block.kind));
 if(hasEvidence){evidence.append(node('small','Снимок данных: '+date(item.context?.createdAt)+' · ответ: '+date(report.createdAt)));parent.append(evidence);}
 else for(const block of report.blocks)if(block.kind==='gap'&&!block.id.startsWith('context-gap-'))parent.append(node('p',block.text,'nexus-ai-assumptions'));
}
export function renderNexusProposal(parent,proposal,{stale,labels,onApply,onReject}){
 const card=node('section',undefined,'nexus-ai-proposal');card.dataset.proposalId=proposal.id;card.append(node('h4',proposal.actionType==='plan.create'?'Новый план · предложение':'Правка плана · предложение'),node('p',proposal.explanation));
 if(proposal.actionType==='plan.update')card.append(node('p','План: '+(proposal.before?.planDetails?.thesis||proposal.before?.note||'Без названия')),node('small',labels.portfolio(proposal.proposedFields.portfolioId)+' · '+labels.instrument(proposal.proposedFields.instrumentUid)));
 const diff=node('dl');for(const [key,value]of Object.entries(proposal.proposedFields)){if(JSON.stringify(value)===JSON.stringify(proposal.before?.[key]))continue;
  const unit=['entryPrice','stopPrice','targetPrice'].includes(key)?' · '+(proposal.before?.priceBasis?.currency||'единицы проверьте в плане'):'';
  diff.append(node('dt',(LABELS[key]||'Условие')+unit),node('dd',(proposal.before?'Было: '+field(key,proposal.before[key],labels)+'\n':'')+'Будет: '+field(key,value,labels)));}card.append(diff);
 const status=node('p');status.setAttribute('role','status');card.append(status);parent.append(card);
 if(proposal.status==='applied'){status.textContent='План сохранён · '+date(proposal.receipt?.appliedAt);return;}
 if(proposal.status!=='proposed'||stale){status.textContent=stale?'Контекст изменился. Нужен новый разбор.':proposal.status==='rejected'?'Предложение отклонено.':'Срок предложения истёк.';return;}
 const apply=node('button',proposal.actionType==='plan.create'?'Сохранить новый план':'Применить правки','button primary');apply.type='button';apply.dataset.aiApply='';
 const reject=node('button','Отклонить','button');reject.type='button';
 async function act(callback){apply.disabled=reject.disabled=true;status.textContent='Сохраняем решение…';try{await callback(proposal);}catch(e){status.textContent=e.message||'Не удалось сохранить решение. Повторите.';apply.disabled=reject.disabled=false;}}
 apply.addEventListener('click',()=>act(onApply));reject.addEventListener('click',()=>act(onReject));card.append(apply,reject);
}
