import { instrumentMark, watchInstrumentImages } from './instrument-mark.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const date=value=>new Date(value+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
const relationLabels={direct:'Связь от брокера',mentioned:'Упоминание в тексте',theme:'Возможная связь по теме'};
const directions={positive:'Возможный положительный эффект',negative:'Возможный отрицательный эффект',mixed:'Разнонаправленный эффект',unclear:'Направление не установлено'};
const price=(value,currency)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency,maximumFractionDigits:4}).format(Number(BigInt(value))/1e9);
const link=(url,title)=>typeof url==='string'&&/^https:\/\//.test(url)?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(title)+'</a>':'';

export function initNewsPanel({request,getCatalog=()=>[],onMore=()=>{}}) {
 const $=id=>document.getElementById(id);
 let items=[],selected='',report=null,busy=false,issue='',generation=0,hasMore=false;
 const filterChoices={newsCompany:new Set(),newsSource:new Set()};
 function filtered(){return items;}
 function mark(row){const relation=row.relations?.[0];const company=relation&&getCatalog().find(item=>item.instrumentUid===relation.instrumentUid);return relation?instrumentMark({...relation,...company}):'<span class="instrument-mark mark-news" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg></span>';}
 const stamp=value=>'<span>'+esc(new Date(value).toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',year:'numeric'}))+'</span><span>'+esc(new Date(value).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}))+'</span>';
 function renderList(){
  const list=$('marketNewsList'),scrollTop=list.scrollTop;
  const rows=filtered(),n=rows.length,last=n%10,lastTwo=n%100;
  $('newsFilterCount').textContent=n+' '+(last===1&&lastTwo!==11?'публикация':last>=2&&last<=4&&(lastTwo<12||lastTwo>14)?'публикации':'публикаций');
  $('marketNewsList').innerHTML=rows.map(row=>'<article class="news-item'+(row.id===selected?' selected':'')+'">'+mark(row)+'<div class="news-item-copy">'
   +'<button class="news-select" type="button" data-news-id="'+esc(row.id)+'" aria-pressed="'+(row.id===selected)+'"><h4>'+esc(row.title)+'</h4></button>'
   +'<p>'+esc(row.summary.slice(0,180))+(row.summary.length>180?'…':'')+'</p></div><div class="news-item-meta"><strong>'+esc(row.source)+'</strong><time datetime="'+esc(row.at)+'">'+stamp(row.at)+'</time>'
   +(row.inPortfolio?'<span class="news-relation-dot direct" title="Актив из вашего портфеля" aria-label="Актив из вашего портфеля"></span>':row.relatedToPortfolio?'<span class="news-relation-dot related" title="Возможная связь с портфелем" aria-label="Возможная связь с портфелем"></span>':'')+'</div></article>').join('')
   ||'<p class="empty-copy">В загруженных публикациях нет новостей по этим условиям. Можно загрузить более ранние публикации или изменить фильтры.</p>';
  list.scrollTop=scrollTop;
  $('newsMore').hidden=!hasMore;
  watchInstrumentImages($('marketNewsList'));
 }
 function renderReport(){
  const row=items.find(item=>item.id===selected),panel=$('newsAnalysisContent');
  $('newsGenerate').hidden=!row;
  $('newsGenerate').disabled=busy;
  $('newsGenerate').textContent=busy?'Готовим разбор…':report?'Обновить разбор':'Подготовить AI-разбор';
  $('newsAnalysisStatus').textContent=issue||(busy?'Готовим разбор…':report?(report.fixture?'Учебный пример':'Разбор подготовлен · '+report.model):'');
  $('newsAnalysisStatus').classList.toggle('negative',Boolean(issue));
  panel.setAttribute('aria-busy',String(busy));
  if(!row){panel.innerHTML='<p class="empty-copy">Выберите публикацию в ленте. Здесь появятся связанные компании, сравнение с прошлым и возможные сценарии.</p>';return;}
  let html='<header class="news-detail-identity">'+mark(row)+'<div><strong>'+esc(row.relations?.[0]?.name||row.source)+'</strong><small>'+esc(row.relations?.[0]?.ticker||'Новости рынка')+'</small></div><div class="news-detail-stamp"><strong>'+esc(row.source)+'</strong><time datetime="'+esc(row.at)+'">'+stamp(row.at)+'</time></div></header><h3 class="news-detail-title" tabindex="-1" id="newsSelectedTitle">'+esc(row.title)+'</h3>';
  if(!report){
   const seen=new Set(),relations=(row.relations||[]).filter(item=>{if(seen.has(item.ticker))return false;seen.add(item.ticker);return true;}).slice(0,6);
   const originalLink=link(row.url,'Читать на сайте '+row.source+' ↗');
   html+='<p class="news-original">'+esc(row.summary)+'</p>'+(originalLink?'<div class="news-detail-link">'+originalLink+'</div>':'')+'<div class="news-company-tags">'
    +relations.map(item=>'<span title="'+esc(relationLabels[item.relation]+': '+item.reason)+'">'+esc(item.ticker)+'</span>').join('')+'</div>';
  }else{
   const analysis=report.analysis;
   html+='<section class="news-analysis-section"><h4>Что произошло</h4><p>'+esc(analysis.summary)+'</p></section>';
   html+='<section class="news-analysis-section"><h4>Возможное влияние</h4>'+(analysis.impacts.map(impact=>{
    const company=report.companies.find(item=>item.ticker===impact.ticker);
    return '<div class="news-company"><strong>'+esc(impact.ticker)+' · '+esc(company?.name||'')+'</strong>'+(company?.inPortfolio?'<span class="portfolio-mark">В портфеле</span>':'')
     +'<small>'+esc(directions[impact.direction])+' · '+esc(relationLabels[company?.relation]||'')+'</small><p>'+esc(impact.mechanism)+'</p></div>';
   }).join('')||'<p>Сведений для вывода по конкретной компании недостаточно.</p>')+'</section>';
   html+='<section class="news-analysis-section"><h4>Сравнение с прошлым</h4>'+(report.historicalCases.map(item=>{
    const comparison=analysis.history.find(row=>row.caseId===item.id);
    return '<div class="news-history"><h5>'+esc(item.title)+'</h5><small>'+esc(date(item.date))+' · '+esc(item.source)+'</small><p>'+esc(item.fact)+'</p>'
     +(comparison?'<p><strong>Сходство.</strong> '+esc(comparison.similarity)+'</p><p><strong>Отличие.</strong> '+esc(comparison.difference)+'</p>':'')
     +(item.moves.length?'<div class="news-price-moves">'+item.moves.map(move=>'<p><strong>'+esc(move.ticker)+' <span class="'+(move.changePercent>=0?'positive':'negative')+'">'+esc(new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,signDisplay:'always'}).format(move.changePercent))+'%</span></strong><span>'+esc(date(move.beforeDate))+' → '+esc(date(move.afterDate))+'</span><small>'+esc(price(move.beforeCloseNanos,move.currency))+' → '+esc(price(move.afterCloseNanos,move.currency))+' · закрытия Т‑Инвест</small></p>').join('')+'</div>':'<p class="news-data-gap">У брокера не найдена полная пара исторических цен для выбранных компаний. Изменение акции не рассчитано.</p>')
     +link(item.url,'Источник события')+'</div>';
   }).join('')||'<p>В проверенном справочнике нет подходящего события для этой темы. Сравнение с прошлым не построено.</p>')+'</section>';
   html+='<section class="news-analysis-section"><h4>Условные сценарии</h4>'+analysis.scenarios.map(item=>'<div class="news-scenario"><strong>'+esc(item.condition)+'</strong><p>'+esc(item.effect)+'</p><p class="news-watch">Проверить: '+esc(item.watch)+'</p></div>').join('')+'</section>';
   html+='<details class="news-limitations"><summary>Источники, метод и ограничения</summary>'+report.limitations.map(item=>'<p>'+esc(item)+'</p>').join('')+'</details>';
  }
  panel.innerHTML=html;watchInstrumentImages(panel);
 }
 function choose(id){selected=id;report=null;issue='';renderList();renderReport();if(matchMedia('(max-width: 1100px)').matches)$('newsAnalysisPanel').scrollIntoView({block:'start'});$('newsSelectedTitle')?.focus({preventScroll:true});}
 $('marketNewsList').addEventListener('click',event=>{const button=event.target.closest('[data-news-id]');if(button)choose(button.dataset.newsId);});
 $('newsMore').addEventListener('click',()=>void onMore());
 $('newsGenerate').addEventListener('click',async()=>{
  if(busy||!selected)return;const id=selected,serial=generation;busy=true;issue='';renderReport();
  try{const result=await request('/api/market/news/analyze',{method:'POST',body:JSON.stringify({newsId:id})});if(serial===generation&&id===selected)report=result;}
  catch(error){if(serial===generation&&id===selected)issue=error.message;}
  finally{if(serial===generation){busy=false;renderReport();}}
 });
 return {
  show(data,{append=false,refresh=false}={}){const old=items.find(item=>item.id===selected);
   if(!append&&!refresh)$('marketNewsList').scrollTop=0;
   const next=append||refresh?[...new Map([...items,...(data.items||[])].map(row=>[row.id,row])).values()]:data.items||[];
   items=next.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id));
   if(!refresh)hasMore=data.hasMore===true;
   const current=items.find(item=>item.id===selected);
   for(const [id,title,values] of [['newsCompany','Компании',items.flatMap(row=>(row.relations||[]).map(company=>company.ticker))],['newsSource','Источники',items.map(row=>row.source)]]) {
    const control=$(id);if(!control)continue;const previous=control.value;
    for(const value of [...values,previous].filter(Boolean))filterChoices[id].add(value);
    const choices=[...filterChoices[id]].sort((a,b)=>a.localeCompare(b,'ru'));
    control.innerHTML='<option value="">'+title+'</option>'+choices.map(value=>'<option value="'+esc(value)+'">'+esc(value)+'</option>').join('');control.value=choices.includes(previous)?previous:'';
   }
   if(!current||old&&(old.title!==current.title||old.summary!==current.summary)){report=null;selected=filtered()[0]?.id||'';}
   renderList();renderReport();},
  reset(){generation++;for(const choices of Object.values(filterChoices))choices.clear();items=[];selected='';report=null;issue='';busy=false;hasMore=false;renderList();renderReport();}
 };
}
