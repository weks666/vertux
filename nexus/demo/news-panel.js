const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const date=value=>new Date(value+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
const relationLabels={direct:'Связь от брокера',mentioned:'Упоминание в тексте',theme:'Возможная связь по теме'};
const directions={positive:'Возможный положительный эффект',negative:'Возможный отрицательный эффект',mixed:'Разнонаправленный эффект',unclear:'Направление не установлено'};
const price=(value,currency)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency,maximumFractionDigits:4}).format(Number(BigInt(value))/1e9);
const link=(url,title)=>typeof url==='string'&&/^https:\/\//.test(url)?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(title)+'</a>':'';

export function initNewsPanel({request}) {
 const $=id=>document.getElementById(id);
 let items=[],selected='',report=null,busy=false,issue='',generation=0,visibleCount=20;
 function filtered(){
  const period=$('newsPeriod').value,scope=$('newsRelevance').value,cutoff=Date.now()-({day:86400000,week:7*86400000})[period];
  return items.filter(row=>(period==='all'||Date.parse(row.at)>=cutoff)
    && (scope==='all'||scope==='direct'&&row.inPortfolio||scope==='related'&&(row.relatedToPortfolio||row.inPortfolio)))
   .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 }
 function renderList(){
  const rows=filtered();
  $('newsFilterCount').textContent='Найдено: '+rows.length+' из '+items.length+' загруженных';
  $('marketNewsList').innerHTML=rows.slice(0,visibleCount).map(row=>'<article class="news-item'+(row.id===selected?' selected':'')+'"><small>'+esc(time(row.at))+' мск · '+esc(row.source)+'</small>'
   +'<button class="news-select" type="button" data-news-id="'+esc(row.id)+'" aria-pressed="'+(row.id===selected)+'"><h4>'+esc(row.title)+'</h4></button>'
   +(row.inPortfolio?'<span class="portfolio-mark">Прямая связь с активом в портфеле</span>':row.relatedToPortfolio?'<span class="news-related">Может касаться портфеля</span>':'')
   +'<p>'+esc(row.summary.slice(0,260))+(row.summary.length>260?'…':'')+'</p></article>').join('')
   ||'<p class="empty-copy">В загруженных публикациях нет новостей по этим условиям. Можно загрузить более ранние публикации или изменить фильтры.</p>';
  $('newsMore').hidden=rows.length<=visibleCount;
 }
 function renderReport(){
  const row=items.find(item=>item.id===selected),panel=$('newsAnalysisContent');
  $('newsGenerate').hidden=!row;
  $('newsGenerate').disabled=busy;
  $('newsGenerate').textContent=busy?'Готовим разбор…':report?'Обновить разбор':'Подготовить AI-разбор';
  $('newsAnalysisStatus').textContent=issue||(busy?'Проверяем исторические котировки и готовим объяснение. Это может занять около минуты.':report?(report.fixture?'Учебный пример · модель не вызывалась':'Разбор подготовлен · '+report.model):'Запускается только по кнопке.');
  $('newsAnalysisStatus').classList.toggle('negative',Boolean(issue));
  panel.setAttribute('aria-busy',String(busy));
  if(!row){panel.innerHTML='<p class="empty-copy">Выберите публикацию в ленте. Здесь появятся связанные компании, сравнение с прошлым и возможные сценарии.</p>';return;}
  let html='<div class="news-selected-source"><h4 tabindex="-1" id="newsSelectedTitle">'+esc(row.title)+'</h4><p>'+esc(time(row.at)+' мск · '+row.source)+'</p>'
    +link(row.url,'Открыть публикацию')+'</div>';
  if(!report){
   const seen=new Set(),relations=(row.relations||[]).filter(item=>{if(seen.has(item.ticker))return false;seen.add(item.ticker);return true;}).slice(0,6);
   html+='<p class="news-original">'+esc(row.summary)+'</p><section class="news-analysis-section"><h4>Какие компании могут быть связаны</h4>'
    +(relations.map(item=>'<div class="news-company"><strong>'+esc(item.ticker)+' · '+esc(item.name)+'</strong>'+(item.inPortfolio?'<span class="portfolio-mark">В портфеле</span>':'')
      +'<small>'+esc(relationLabels[item.relation])+'</small><p>'+esc(item.reason)+'</p></div>').join('')||'<p>В каталоге не найдено подтверждённой связи. Разбор может объяснить общий механизм и пробелы в данных.</p>')+'</section>';
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
  panel.innerHTML=html;
 }
 function choose(id){selected=id;report=null;issue='';renderList();renderReport();if(matchMedia('(max-width: 1100px)').matches)$('newsAnalysisPanel').scrollIntoView({block:'start'});$('newsSelectedTitle')?.focus({preventScroll:true});}
 $('marketNewsList').addEventListener('click',event=>{const button=event.target.closest('[data-news-id]');if(button)choose(button.dataset.newsId);});
 for(const id of ['newsPeriod','newsRelevance'])$(id).addEventListener('change',()=>{visibleCount=20;const rows=filtered();if(!rows.some(row=>row.id===selected)){selected=rows[0]?.id||'';report=null;issue='';}renderList();renderReport();});
 $('newsMore').addEventListener('click',()=>{visibleCount+=20;renderList();});
 $('newsGenerate').addEventListener('click',async()=>{
  if(busy||!selected)return;const id=selected,serial=generation;busy=true;issue='';renderReport();
  try{const result=await request('/api/market/news/analyze',{method:'POST',body:JSON.stringify({newsId:id})});if(serial===generation&&id===selected)report=result;}
  catch(error){if(serial===generation&&id===selected)issue=error.message;}
  finally{if(serial===generation){busy=false;renderReport();}}
 });
 return {
  show(data){const old=items.find(item=>item.id===selected);items=data.items||[];const current=items.find(item=>item.id===selected);
   if(!current||old&&(old.title!==current.title||old.summary!==current.summary)){report=null;selected=filtered()[0]?.id||'';}
   renderList();renderReport();},
  reset(){generation++;items=[];selected='';report=null;issue='';busy=false;visibleCount=20;renderList();renderReport();}
 };
}
