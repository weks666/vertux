const esc=value=>String(value??'Не подтверждено').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(value)?value.toLocaleString('ru-RU',{maximumFractionDigits:8}):'—';
const date=value=>value?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск':'Не подтверждено';
const completion={complete:'Завершена',incomplete:'Не завершена',unknown:'Не подтверждено'};

/** An explicit inline disclosure of the report bound to the rendered radar row. */
export function createTerminalVolumeExplanationUi({host,getContext,readOnly=false}){
 const section=document.createElement('section');section.className='terminal-radar-explanation';section.hidden=true;
 section.id='terminalRadarExplanation';section.setAttribute('aria-label','Расчёт объёма радара');host.querySelector('.terminal-radar-table').before(section);
 let reports=new Map(),context=null,anchor=null,disposed=false;
 function close(focus=false){section.hidden=true;section.replaceChildren();anchor?.setAttribute('aria-expanded','false');if(focus&&anchor?.isConnected)anchor.focus({preventScroll:true});anchor=null;}
 function open(button){
  close();if(disposed||context!==getContext())return;
  const report=reports.get(button.dataset.radarVolume);if(!report)return;
  anchor=button;button.setAttribute('aria-controls',section.id);button.setAttribute('aria-expanded','true');
  const s=report.series,fact=(label,value)=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';
  section.dataset.state=report.state;
  section.innerHTML='<header><h3 tabindex="-1">Объём · '+esc(s?.instrument.ticker||'Инструмент')+'</h3><button type="button" data-volume-close>Закрыть расчёт</button></header>'+
   '<p>Снимок строки радара · дневные свечи · без AI-модели</p>'+
   (report.state==='ready'?'<p class="radar-volume-equation" data-volume-ratio="'+report.ratio+'">'+number(report.current.value)+' / ('+number(report.sum)+' / '+report.sampleSize+') = '+number(report.ratio)+'×</p>':
    '<p role="status">'+esc(report.reason)+'</p>')+
   (report.current?'<p>Последняя свеча: '+esc(date(report.current.at))+' · '+completion[report.current.completion]+'. Предыдущих свечей: '+report.sampleSize+' из максимум 20.</p>':'')+
   (report.current?'<details data-volume-evidence><summary>Свечи расчёта · '+(report.baseline.length+1)+'</summary><dl class="radar-volume-facts">'+fact('Последняя свеча',date(report.current.at))+fact('Её объём',number(report.current.value))+
    fact('Завершённость',completion[report.current.completion])+fact('Предыдущих свечей',report.sampleSize+' из максимум 20')+
    fact('Сумма предыдущих объёмов',number(report.sum))+fact('Средний объём',number(report.mean))+'</dl>'+
    (report.baseline.length?'<div class="radar-volume-table" tabindex="0" role="region" aria-label="Объёмы предыдущих свечей"><table><caption>Предыдущие свечи · начало по Москве · единицы объёма источника</caption><thead><tr><th scope="col">Время</th><th scope="col">Объём</th><th scope="col">Завершённость</th></tr></thead><tbody>'+report.baseline.map(row=>'<tr data-volume-ref="'+row.ref+'"><td>'+esc(date(row.at))+'</td><td>'+number(row.value)+'</td><td>'+completion[row.completion]+'</td></tr>').join('')+'</tbody></table></div>':'')+'</details>':'')+
   (s?'<details><summary>Источник и контекст</summary><dl class="radar-volume-facts">'+fact('Инструмент',s.instrument.name)+fact('Площадка / класс',s.instrument.exchange||s.instrument.classCode)+
    fact('Источник',s.source.dataMode==='synthetic'?'Учебные данные':s.source.label)+fact('Получен ответ',date(s.source.receivedAt))+
    fact('Актуальность рынка',s.source.freshness==='delayed'?'Обновление задерживается':'Не подтверждена')+'</dl></details>':'')+
   '<p>'+(readOnly?'В демо показан фиксированный снимок объёма.':'Снимок не обновляется автоматически. «Применить» в фильтре пересобирает радар из уже загруженных данных.')+'</p>'+
   '<details><summary>Метод и ограничения</summary>'+[...(report.limits||[]),...(s?.limits||[]).slice(0,2)].map(text=>'<p>'+esc(text)+'</p>').join('')+'</details>';
  section.hidden=false;section.scrollIntoView({block:'start',behavior:'instant'});section.querySelector('h3').focus({preventScroll:true});
 }
 const click=event=>{const b=event.target.closest('[data-radar-volume]');if(b&&host.contains(b))open(b);else if(event.target.closest('[data-volume-close]'))close(true);};
 const escape=event=>{if(!section.hidden&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}};
 const invalidate=()=>{close();reports.clear();context=null;};
 const identityChanged=()=>{if(context!==getContext())invalidate();};
 host.addEventListener('click',click);host.addEventListener('keydown',escape);document.addEventListener('invest:identity',identityChanged);
 return Object.freeze({setReports(rows){close();reports=new Map(rows);context=getContext();},close,dispose(){if(disposed)return;disposed=true;invalidate();host.removeEventListener('click',click);host.removeEventListener('keydown',escape);document.removeEventListener('invest:identity',identityChanged);section.remove();}});
}
