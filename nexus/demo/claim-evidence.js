import {financialMetric} from './number-format.js';
import {fundamentalPeriod} from './financial-metric.js';

const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const one=(rows,predicate)=>{const matches=Array.isArray(rows)?rows.filter(predicate):[];return matches.length===1?matches[0]:null;};
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))
  ?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+' мск':'Не указано';
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/u.test(value)&&Number.isFinite(Date.parse(value))?value.slice(0,10):'Не указана';
function sourceUrl(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash
    &&![...url.searchParams.keys()].some(key=>/token|secret|password|authorization|session|credential|api.?key/iu.test(key))?url.href:null;}catch{return null;}
}
const gap=(label='Основание недоступно')=>({label,text:'В текущем разборе не удалось однозначно найти эти данные. Откройте актуальные факты или публикацию и повторите разбор.',missing:true});
const descriptions={
  observation:'Наблюдение по сохранённому показателю.',
  definition:'Пояснение смысла показателя. Оно не подтверждает будущий результат компании.',
  positive:'Положительное значение в этом срезе. Устойчивость результата из его знака не следует.',
  negative:'Отрицательное значение в этом срезе. Причины и повторяемость требуют отдельной проверки.',
  zero:'Известное нулевое значение в этом срезе.',
  'sign-comparison':'Сопоставление знаков показателей. Точное совпадение отчётных границ и причины расхождения не установлены.',
  limitation:'Ограничение вывода: необходимых данных в этом срезе нет или их недостаточно.',
  source_quote:'Текст указанного источника. Разбор не подтверждает истинность сообщения.',
  relation_limit:'Основание связи с компанией. Оно не доказывает её участие в событии или финансовый эффект.',
  conditional_mechanism:'Условный канал влияния. Источники объясняют выбор темы, но не подтверждают, что условие выполнено.',
  topic_comparison:'Сопоставление по теме. Одинаковое влияние событий и причинность движения цены не установлены.',
  conditional_scenario:'Условный сценарий для проверки. Условие не является установленным фактом или прогнозом.',
};
const coverage={
  'coverage:freeCashFlowTtm:unavailable':['Свободный денежный поток','В этом срезе показатель недоступен. Неизвестное значение не равно нулю.'],
  'coverage:totalDebtMrq:unavailable':['Общий долг','В этом срезе показатель недоступен. Неизвестное значение не равно нулю.'],
  'coverage:debt-schedule:absent':['Обслуживание долга','В пакет не входят график погашения и стоимость обслуживания долга.'],
  'coverage:peers:absent':['Сопоставимые компании','В пакет не входят показатели сопоставимых компаний и методика их сравнения.'],
  'coverage:quarterly-reports:absent':['История отчётности','В пакет не входит ряд квартальных отчётов.'],
  'coverage:forecast:absent':['Прогноз','В пакет не входит прогнозная модель.'],
  'coverage:causal-analysis:absent':['Причины изменений','В пакет не входят события и анализ причинности.'],
};
function evidence(claim,resolve){
  const ids=claim?.factIds;
  const items=Array.isArray(ids)&&ids.length>0&&ids.length<=16&&new Set(ids).size===ids.length
    ?ids.map(id=>typeof id==='string'?resolve(id)||gap():gap()):[gap()];
  return {claimId:claim?.claimId||'',description:descriptions[claim?.relationType]||'Характер утверждения не указан.',
    state:items.some(item=>item.missing)?'incomplete':'ready',items};
}

/** Presentation of an already checked report, never an authorization or model-output validator. */
export function companyClaimEvidence(report,statement){
  if(report?.claimContract!=='company-claims-v1')return null;
  if(!report.sections?.some(section=>section.statements?.includes(statement)))return evidence(null,()=>null);
  return evidence(statement,id=>{
    if(coverage[id]){const[label,text]=coverage[id];return {label,text};}
    if(!id.startsWith('metric:'))return null;
    const metric=one(report.metrics||report.facts,row=>row.key===id.slice(7));
    if(!metric||metric.status!=='available'||metric.value==null)return null;
    const sources=(metric.sourceIds||[]).map(id=>one(report.sources,source=>source.id===id));
    return {label:metric.label||metric.key,text:'Сохранённое значение: '+financialMetric(metric,{mode:'exact'}),
      fields:[['Период показателя',fundamentalPeriod(metric.period)],
        ...(metric.unit==='provider_value'?[['Единица','Масштаб не указан; значение не преобразовано в процент.']]:[]),
        ...(metric.unit==='unknown_currency'?[['Валюта','Не указана; валюта торгов не подставляется.']]:[]),
        ...(metric.calculationVersion?[['Расчёт',metric.calculationVersion]]:[])],
      sources:sources.filter(Boolean).map(source=>({title:source.title||'Источник показателя',url:source.url,
        fields:[['Дата данных источника',day(source.asOf)],['Получено',stamp(source.retrievedAt)]]})),
      missing:!sources.length||sources.some(source=>!source),
      note:'Период относится к показателю компании. Время получения не заменяет отчётную дату; точные границы периода могут быть неизвестны.'};
  });
}

export function newsClaimEvidence(report,row,claim){
  if(report?.analysis?.claimContract!=='news-claims-v1')return null;
  const analysis=report.analysis,claims=[analysis.summaryEvidence,...analysis.impacts,...analysis.history,...analysis.scenarios];
  if(!row||report.newsId!==row.id||!claims.includes(claim)
    ||row.analysisVersion!==undefined&&report.analysisVersion!==row.analysisVersion)return evidence(null,()=>null);
  const prefix='news:'+row.id+':';
  return evidence(claim,id=>{
    if(id===prefix+'title')return {label:'Заголовок публикации',text:row.title,
      sources:[{title:row.source||'Источник публикации',url:row.url,fields:[['Время сообщения поставщика',stamp(row.at)]]}],
      note:'Время сообщения не подтверждает время события или первичной публикации.'};
    if(id===prefix+'summary')return typeof row.summary==='string'&&row.summary.length?{label:'Фрагмент, использованный в разборе',text:row.summary.slice(0,4000),
      note:row.summary.length>4000?'В разбор переданы первые 4000 символов загруженного текста. Полный загруженный фрагмент доступен в публикации.':'Загруженный фрагмент может не содержать полный текст публикации.'}:null;
    if(id.startsWith(prefix+'relation:')){
      const ticker=id.slice((prefix+'relation:').length),company=one(report.companies,item=>item.ticker===ticker);
      if(!company||claim.ticker!==ticker)return null;
      return {label:[company.ticker,company.name].filter(Boolean).join(' · '),text:company.reason,
        fields:[['Связь',({direct:'Связь от брокера',mentioned:'Упоминание в тексте',theme:'Возможная связь по теме'})[company.relation]||'Не подтверждена']],
        note:'Связь не измеряет фактическую экспозицию компании. Отметка «В портфеле» не является основанием этого утверждения.'};
    }
    if(id.startsWith('event:')){
      const event=one(report.historicalCases,item=>item.id===id.slice(6));if(!event||claim.caseId!==event.id)return null;
      return {label:event.title,text:event.fact,fields:[['Дата справочного события',day(event.date)]],sources:[{title:event.source,url:event.url}],
        note:'Справочное событие относится к той же теме. Оно не устанавливает причины текущего события или движения цены.'};
    }
    return null;
  });
}

/** Shared, closed disclosure. It performs no requests, writes, or navigation. */
export function renderClaimEvidence(view){
  if(!view)return '';
  const fields=rows=>rows?.length?'<dl>'+rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>':'';
  const source=row=>{const url=sourceUrl(row.url),title=esc(row.title||'Источник');return '<div class="claim-evidence-source">'
    +(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+title+'</a>':'<span>'+title+'</span>')+fields(row.fields)+'</div>';};
  return '<details class="claim-evidence" data-claim-id="'+esc(view.claimId)+'" data-evidence-state="'+esc(view.state)+'"><summary>На чём основано</summary>'
    +'<div class="claim-evidence-body"><p>'+esc(view.description)+'</p>'+(view.state==='incomplete'?'<p>Часть оснований в текущем разборе недоступна.</p>':'')
    +view.items.map(item=>'<section class="claim-evidence-item"><h5>'+esc(item.label)+'</h5>'+(item.text?'<p class="claim-evidence-text">'+esc(item.text)+'</p>':'')
      +fields(item.fields)+(item.sources||[]).map(source).join('')+(item.missing?'<p>Источник или исходные данные не подтверждены в этом разборе.</p>':'')
      +(item.note?'<p class="claim-evidence-note">'+esc(item.note)+'</p>':'')+'</section>').join('')+'</div></details>';
}
