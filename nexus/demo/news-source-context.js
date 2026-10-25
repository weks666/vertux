const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,128}$/u.test(value)?value:null;
const instant=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function observation(value,now){
 if(!value||value.contractVersion!=='local-news-observation-v1'||value.timeBasis!=='local-receive-clock'||value.continuity!=='bounded-cache')return null;
 const first=instant(value.firstObservedAt),content=instant(value.contentObservedAt),last=instant(value.lastObservedAt);
 if(value.firstObservedAt!==null&&!first||value.contentObservedAt!==null&&!content||!last||Date.parse(last)>now||first&&first>last||content&&content>last||first&&content&&first>content)return null;
 return {firstObservedAt:first,contentObservedAt:content,lastObservedAt:last};
}

export function newsSourceUrl(value){
 if(typeof value!=='string'||value.length>2048)return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash
  &&![...url.searchParams.keys()].some(key=>/token|secret|password|authorization|session|credential|api.?key/iu.test(key))?url.href:null;}catch{return null;}
}
function project(row){
 if(!row||!id(row.id)||!text(row.title,500)||!instant(row.at))return null;
 if(row.relations!==undefined&&(!Array.isArray(row.relations)||row.relations.length>10000))return null;
 if(row.instruments!==undefined&&(!Array.isArray(row.instruments)||row.instruments.length>10000))return null;
 return {id:row.id,title:text(row.title,500),summary:text(row.summary,6000),source:text(row.source,160),url:newsSourceUrl(row.url),at:instant(row.at),
  instruments:(row.instruments||[]).map(item=>id(item?.instrumentUid)).filter(Boolean),
  relations:(row.relations||[]).map(item=>({instrumentUid:id(item?.instrumentUid),ticker:text(item?.ticker,64),name:text(item?.name,240),
   classCode:text(item?.classCode,64),relation:['direct','mentioned','theme'].includes(item?.relation)?item.relation:'unknown',
   reason:text(item?.reason,500),inPortfolio:item?.inPortfolio===true})).filter(item=>item.instrumentUid)};
}
// A local comparison key, never a provider revision or a request payload.
export function newsContextRevision(row){
 const value=project(row);if(!value)return null;
 if(row.analysisVersion!==undefined)value.analysisVersion=typeof row.analysisVersion==='string'?row.analysisVersion.slice(0,128):null;
 return JSON.stringify(value);
}

export function buildLoadedNewsContext({row,fixture=false,feedState='unknown',cacheCapturedAt=null,now=new Date()}={}){
 const value=project(row);if(!value||!Number.isFinite(now?.getTime?.()))return null;
 const tagged=new Set(value.instruments),relations=value.relations.slice(0,12).map(item=>{
  const basis=item.relation==='direct'?(tagged.has(item.instrumentUid)?'provider-uid':'catalogue'):item.relation;
  return {instrumentUid:item.instrumentUid,ticker:item.ticker,name:item.name,classCode:item.classCode,basis,
   portfolioLink:item.inPortfolio?'held-in-allowed-accounts':'not-confirmed'};
 });
 return freeze({contractVersion:'loaded-news-context-v1',intent:'news.loaded-source',llmUsed:false,
  dataMode:fixture===true?'synthetic':'loaded-source',news:{id:value.id,title:value.title,source:value.source,url:value.url},
  clocks:{providerMessageAt:value.at,eventAt:null,originalPublishedAt:null,sourceUpdatedAt:null,firstReceivedAt:null,
   feedCacheCapturedAt:instant(cacheCapturedAt),generatedAt:now.toISOString()},
  localObservation:observation(row.localObservation,now.getTime()),
  feedState:['ready','empty','stale','error','loading','unknown','idle','demo'].includes(feedState)?feedState:'unknown',
  relations,omittedRelations:Math.max(0,value.relations.length-relations.length),
  limitations:['Время сообщения поставщика не подтверждает время события или первичной публикации.',
   'Сохранение общего кэша ленты не является временем первого получения этой новости.',
   'Локальные отметки относятся только к непрерывно сохранённому кэшу; очистка, срок хранения и смена подключения ограничивают историю. Они не подтверждают, что пользователь уже прочитал новость.',
   'Связь с инструментом не доказывает влияние на цену. Направление будущей доходности не установлено.',
   'Отметка портфеля сформирована локально по разрешённым счетам; доля и величина экспозиции не рассчитаны.']});
}

export function renderLoadedNewsContext(packet){
 if(!packet)return '<p class="news-data-gap">Контекст публикации не подтверждён.</p>';
 const stamp=value=>value?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date(value))+' мск':'Неизвестно';
 const states={ready:'Публикация из загруженной ленты; актуальность самого сообщения не подтверждена.',stale:'Сохранённая лента может быть устаревшей.',error:'Обновление ленты не удалось; показаны ранее загруженные сведения.',loading:'Лента обновляется; показан прежний загруженный контекст.',unknown:'Текущее состояние источника не подтверждено.'};
 const labels={'provider-uid':'Точная привязка UID поставщиком',catalogue:'Сопоставление через каталог',mentioned:'Упоминание названия или тикера',theme:'Возможная тематическая связь',unknown:'Основание не подтверждено'};
 const clocks=[['Время сообщения поставщика',packet.clocks.providerMessageAt],['Время события',null],['Первичная публикация',null],['Исправление источником',null],['Первое получение новости',null],['Сохранение общего кэша ленты',packet.clocks.feedCacheCapturedAt],['Формирование этого среза',packet.clocks.generatedAt]];
 if(packet.localObservation)clocks.splice(5,0,['Первое наблюдение в сохранённом кэше',packet.localObservation.firstObservedAt],['Текущее содержимое наблюдается с',packet.localObservation.contentObservedAt],['Последнее получение этой записи',packet.localObservation.lastObservedAt]);
 return '<details class="news-limitations news-source-context"><summary>О публикации и связях</summary><p>'
  +(packet.dataMode==='synthetic'?'Учебная публикация. ':'')+'Этот срез использует уже загруженные сведения; источник и модель не вызываются.</p><p>'
  +esc(states[packet.feedState]||states.unknown)+'</p><p>Указанный источник: '+esc(packet.news.source||'неизвестен')+'. '
  +(packet.news.url?'<a href="'+esc(packet.news.url)+'" target="_blank" rel="noopener noreferrer">Открыть источник ↗</a>':'Подтверждённой ссылки нет.')+'</p><dl>'
  +clocks.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(stamp(value))+'</dd></div>').join('')+'</dl><h4>Основания связей</h4>'
  +(packet.relations.length?'<ul>'+packet.relations.map(item=>'<li><strong>'+esc([item.ticker,item.name,item.classCode].filter(Boolean).join(' · '))+'</strong>: '+esc(labels[item.basis])
   +(item.portfolioLink==='held-in-allowed-accounts'?' · инструмент найден в разрешённых счетах.':' · принадлежность портфелю не подтверждена.')+'</li>').join('')+'</ul>':'<p>Подтверждённых связей в загруженном срезе нет.</p>')
  +(packet.omittedRelations?'<p>Ещё связей в загруженных данных: '+packet.omittedRelations+'.</p>':'')
  +packet.limitations.map(value=>'<p>'+esc(value)+'</p>').join('')+'</details>';
}
