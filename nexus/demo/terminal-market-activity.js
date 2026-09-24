const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const number = value => Number.isFinite(value) ? value.toLocaleString('ru-RU', {maximumFractionDigits:5}) : '—';
const timestamp = value => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString('ru-RU', {timeZone:'Europe/Moscow', hour12:false}) + ' мск' : '—';
const labels = {waiting:'Ожидаем события',connecting:'Подключаем поток',resyncing:'Восстанавливаем историю',reconnecting:'Переподключаем поток',stale:'Обновление задерживается',partial:'Часть подписок недоступна',unavailable:'Поток недоступен',live:'Поток подключён',fixture:'Демонстрационный снимок',paused:'Поток приостановлен'};
export function createMarketActivity({bookHost,tapeHost,statusHost,clock=()=>Date.parse('2026-08-12T12:00:00Z')}) {
  let instrument={},book=null,trades=[],phase='waiting',simulated=false,gap=false,lastReceived=0,warning='',frame=0;
  function scheduleRender(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
  function render() {
    const bookScroll=bookHost.querySelector('.terminal-activity-scroll')?.scrollTop||0,tapeScroll=tapeHost.querySelector('.terminal-activity-scroll')?.scrollTop||0;
    const stale=['stale','reconnecting','resyncing','unavailable','paused'].includes(phase) || !!lastReceived && clock()-lastReceived>45000;
    const state=stale&&!['resyncing','unavailable','paused'].includes(phase)?'stale':phase;
    const label=(simulated?'Тестовые данные · ':'')+(labels[state]||labels.waiting);
    if(statusHost.textContent!==label)statusHost.textContent=label;
    statusHost.dataset.state=state;
    const heading='<div class="terminal-activity-heading"><strong>'+escape(instrument.ticker||'Инструмент не выбран')+'</strong><span>'+escape(label)+'</span></div>';
    const validBook=book?.consistent===true;
    const bookStale=stale||!!book&&clock()-Date.parse(book.connectorReceivedAt)>45000;
    const details=book?'Событие '+timestamp(book.sourceEventTime)+' · получено '+timestamp(book.connectorReceivedAt):'Ожидаем первый снимок стакана';
    const rows=validBook?Array.from({length:Math.max(book.bids.length,book.asks.length)},(_,i)=>{
      const bid=book.bids[i],ask=book.asks[i];
      return '<tr><td class="positive">'+number(bid?.quantity)+'</td><td class="positive">'+number(bid?.price)+'</td><td class="negative">'+number(ask?.price)+'</td><td class="negative">'+number(ask?.quantity)+'</td></tr>';
    }).join(''):'';
    const spread=validBook&&book.bids.length&&book.asks.length?book.asks[0].price-book.bids[0].price:null;
    bookHost.classList.toggle('market-data-stale',bookStale);
    bookHost.innerHTML=heading+'<p class="terminal-activity-meta">'+escape(details)+(bookStale?' · снимок может устареть':'')+(spread!==null?' · спред '+number(spread):'')+'</p>'+
      (rows?'<div class="terminal-activity-scroll"><table aria-label="Биржевой стакан"><thead><tr><th>Лоты</th><th>Покупка</th><th>Продажа</th><th>Лоты</th></tr></thead><tbody>'+rows+'</tbody></table></div>':
      '<p class="empty-copy">'+(book&&!validBook?'Снимок стакана не согласован. Ожидаем подтверждённые уровни.':validBook?'В стакане нет заявок.':'Уровни появятся после подключения потока выбранного инструмента.')+'</p>')+
      '<p class="terminal-activity-meta">До 20 уровней с каждой стороны · количество в лотах · '+escape(instrument.currency?.toUpperCase()||'валюта инструмента')+'</p>';
    tapeHost.classList.toggle('market-data-stale',stale);
    tapeHost.innerHTML=heading+'<p class="terminal-activity-meta">'+(gap?'В потоке был разрыв. Сделки до восстановления не показаны.':'Вымышленные сделки для просмотра ленты.')+(warning?' '+escape(warning):'')+'</p>'+
      (trades.length?'<div class="terminal-activity-scroll"><table aria-label="Биржевая лента сделок"><thead><tr><th>Время события</th><th>Направление</th><th>Цена</th><th>Лоты</th></tr></thead><tbody>'+trades.map(row=>'<tr><td>'+timestamp(row.sourceEventTime)+'</td><td class="'+(row.side==='buy'?'positive':row.side==='sell'?'negative':'')+'">'+({buy:'Покупка',sell:'Продажа'}[row.side]||'Не указано')+'</td><td>'+number(row.price)+'</td><td>'+number(row.quantity)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="empty-copy">Новых сделок пока нет. Лента заполняется при поступлении биржевых событий.</p>');
    const bookScroller=bookHost.querySelector('.terminal-activity-scroll'),tapeScroller=tapeHost.querySelector('.terminal-activity-scroll');
    if(bookScroller)bookScroller.scrollTop=bookScroll;if(tapeScroller)tapeScroller.scrollTop=tapeScroll;
  }
  function reset() {book=null;trades=[];gap=false;lastReceived=0;warning='';}
  return {
    select(meta) {if(meta.instrumentUid!==instrument.instrumentUid){instrument=meta;reset();phase='waiting';render();}else instrument=meta;},
    state(value) {phase=labels[value.state]?value.state:'waiting';if(value.simulated)simulated=true;if(value.metrics?.dropped)warning='Часть событий пропущена из-за переполнения очереди.';render();},
    receive(event) {
      if(event.instrumentUid!==instrument.instrumentUid)return;
      if(event.type==='market.tape-reset'){trades=[];gap=event.reason==='reconnect_gap';render();return;}
      if(event.type==='market.book')book=event;
      else if(event.type==='market.trade'){trades.unshift(event);trades.length=Math.min(trades.length,200);}
      else if(!['market.status','market.candle'].includes(event.type))return;
      simulated=event.simulated===true;
      lastReceived=Date.parse(event.connectorReceivedAt)||clock();
      if(['waiting','connecting','live','fixture','stale'].includes(phase))phase=simulated?'fixture':'live';
      scheduleRender();
    },
    tick() {if(lastReceived&&clock()-lastReceived>45000&&phase!=='stale'){phase='stale';render();}},
    reset() {reset();phase='waiting';render();}
  };
}
