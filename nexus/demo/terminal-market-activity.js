const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number.isFinite(value)?value.toLocaleString('ru-RU',{maximumFractionDigits:5}):'—';
const timestamp=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour12:false}):'—';
const labels={waiting:'Ожидаем котировки',connecting:'Подключаем поток',resyncing:'Восстанавливаем историю',reconnecting:'Переподключаем поток',stale:'Обновление задерживается',partial:'Часть подписок недоступна',unavailable:'Поток недоступен',live:'Поток подключён',fixture:'Демонстрационный снимок',paused:'Поток приостановлен'};
const normalize=value=>({depth:value?.depth===20?20:10,tapeMinimum:Number.isSafeInteger(value?.tapeMinimum)&&value.tapeMinimum>=0&&value.tapeMinimum<=1000000000?value.tapeMinimum:0});
export function createMarketActivity({bookHost,tapeHost,statusHost,clock=()=>Date.parse('2026-08-12T12:00:00Z'),onPreferencesChange=()=>{}}){
 let instrument={},book=null,trades=[],phase='waiting',simulated=false,gap=false,lastReceived=0,warning='',frame=0,settings=normalize();
 bookHost.innerHTML='<div class="terminal-activity-heading"><strong></strong><label>Уровни <select aria-label="Число уровней стакана"><option value="10">10</option><option value="20">20</option></select></label></div><p class="terminal-activity-meta" data-book-status></p><div class="terminal-activity-scroll" data-book-body></div><div data-book-balance></div><p class="terminal-activity-meta" data-book-note></p><button type="button" class="terminal-activity-link" data-panel="tape">Последние сделки <span aria-hidden="true">→</span></button>';
 tapeHost.innerHTML='<div class="terminal-activity-heading"><strong></strong><label>Лоты от <input type="number" min="0" max="1000000000" step="1" value="0" aria-label="Минимальный размер сделки в лотах"></label></div><p class="terminal-activity-meta" data-tape-status></p><div class="terminal-activity-scroll" data-tape-body></div><p class="terminal-activity-meta">Время сделки — МСК · размер в лотах · <span data-tape-unit></span></p>';
 const depth=bookHost.querySelector('select'),minimum=tapeHost.querySelector('input'),bookBody=bookHost.querySelector('[data-book-body]'),tapeBody=tapeHost.querySelector('[data-tape-body]'),balance=bookHost.querySelector('[data-book-balance]');
 depth.addEventListener('change',()=>{settings=normalize({...settings,depth:Number(depth.value)});onPreferencesChange({...settings});render();});
 minimum.addEventListener('input',()=>{if(minimum.value===''||!minimum.validity.valid)return;settings=normalize({...settings,tapeMinimum:Number(minimum.value)});onPreferencesChange({...settings});render();});
 function scheduleRender(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});}
 function unavailable(message){
  bookBody.innerHTML=tapeBody.innerHTML='<p class="empty-copy">'+escape(message)+'</p>';balance.replaceChildren();
  bookHost.querySelector('[data-book-status]').textContent=tapeHost.querySelector('[data-tape-status]').textContent='';
  bookHost.querySelector('[data-book-note]').textContent='';depth.disabled=minimum.disabled=true;
 }
 function render(){
  for(const host of [bookHost,tapeHost])host.querySelector('.terminal-activity-heading strong').textContent=instrument.ticker||'Инструмент не выбран';
  const priceUnit=instrument.assetType==='future'||instrument.priceUnit==='points'?'п.':instrument.assetType==='bond'?'% ном.':instrument.currency?.toUpperCase()||'';
  tapeHost.querySelector('[data-tape-unit]').textContent=priceUnit==='п.'?'цена в пунктах':priceUnit==='% ном.'?'цена в процентах номинала':'цена в '+(priceUnit||'валюте инструмента');
  if(instrument.chartProvider==='tradingview'){statusHost.textContent='TradingView · источник и задержка на графике';statusHost.dataset.state='external';unavailable('Стакан и лента этого источника не подключены.');return;}
  if(instrument.publicMarketData){statusHost.textContent=(instrument.exchange||'Крипторынок')+' · публичные свечи, обновление 5 с';statusHost.dataset.state='public';unavailable('Подключены публичные свечи. Стакан и лента этой биржи пока не подключены.');return;}
  depth.disabled=minimum.disabled=false;
  const bookScroll=bookBody.scrollTop,tapeScroll=tapeBody.scrollTop;
  const stale=['stale','reconnecting','resyncing','unavailable','paused'].includes(phase)||!!lastReceived&&clock()-lastReceived>45000;
  const state=stale&&!['resyncing','unavailable','paused'].includes(phase)?'stale':phase,label=(simulated?'Тестовые данные · ':'')+(labels[state]||labels.waiting);
  statusHost.textContent=label;statusHost.dataset.state=state;statusHost.title=state==='waiting'?'Ожидаем первые данные выбранного инструмента: цену, сделки и стакан.':'Состояние потока рыночных данных';
  const validBook=book?.consistent===true,bookStale=stale||!!book&&clock()-Date.parse(book.connectorReceivedAt)>45000,n=settings.depth/2;
  const bids=validBook?book.bids.slice(0,n):[],asks=validBook?book.asks.slice(0,n):[],max=Math.max(1,...bids.map(x=>x.quantity),...asks.map(x=>x.quantity));
  const spread=bids.length&&asks.length?asks[0].price-bids[0].price:null,unit=priceUnit;
  bookHost.classList.toggle('market-data-stale',bookStale);
  bookHost.querySelector('[data-book-status]').textContent=book?'Событие '+timestamp(book.sourceEventTime)+' · получено '+timestamp(book.connectorReceivedAt)+(bookStale?' · снимок может устареть':''):'Ожидаем первый снимок стакана';
  const quantity=row=>'<span class="terminal-book-depth" style="width:'+Math.max(0,Math.min(100,row.quantity/max*100))+'%"></span><span class="terminal-book-quantity">'+number(row.quantity)+'</span>';
  const rows=asks.slice().reverse().map(row=>'<tr class="terminal-book-ask"><td></td><td class="terminal-book-price">'+number(row.price)+'</td><td>'+quantity(row)+'</td></tr>').join('')+
   (spread!==null?'<tr class="terminal-book-mid"><td colspan="3">Спред <strong>'+number(spread)+' '+escape(unit)+'</strong></td></tr>':'')+
   bids.map(row=>'<tr class="terminal-book-bid"><td>'+quantity(row)+'</td><td class="terminal-book-price">'+number(row.price)+'</td><td></td></tr>').join('');
  bookBody.innerHTML=rows?'<table class="terminal-book-table" aria-label="Биржевой стакан"><thead><tr><th>Покупка</th><th>Цена'+(unit?', '+escape(unit):'')+'</th><th>Продажа</th></tr></thead><tbody>'+rows+'</tbody></table>':
   '<p class="empty-copy">'+(book&&!validBook?'Снимок стакана не согласован. Ожидаем подтверждённые уровни.':validBook?'В стакане нет заявок.':'Уровни появятся после подключения потока выбранного инструмента.')+'</p>';
  const bidTotal=bids.reduce((sum,row)=>sum+row.quantity,0),askTotal=asks.reduce((sum,row)=>sum+row.quantity,0),total=bidTotal+askTotal,buy=total?Math.round(100*bidTotal/total):0;
  balance.innerHTML=total?'<div class="terminal-book-balance"><div><span class="positive">Покупка '+buy+'%</span><span class="negative">'+(100-buy)+'% Продажа</span></div><div class="terminal-book-balance-track" role="img" aria-label="Объём показанных уровней: покупка '+buy+' процентов, продажа '+(100-buy)+' процентов"><span style="width:'+buy+'%"></span><span style="width:'+(100-buy)+'%"></span></div><p>Объём показанных уровней</p></div>':'';
  bookHost.querySelector('[data-book-note]').textContent='До '+n+' уровней с каждой стороны · количество в лотах';
  tapeHost.classList.toggle('market-data-stale',stale);
  tapeHost.querySelector('[data-tape-status]').textContent=(gap?'В потоке был разрыв. Сделки до восстановления не показаны.':'Вымышленные сделки для просмотра ленты.')+(warning?' '+warning:'');
  const visible=trades.filter(row=>row.quantity>=settings.tapeMinimum);
  tapeBody.innerHTML=visible.length?'<table class="terminal-tape-table" aria-label="Биржевая лента сделок"><thead><tr><th>Время</th><th>Цена'+(unit?', '+escape(unit):'')+'</th><th>Лоты</th></tr></thead><tbody>'+visible.map(row=>'<tr><td>'+timestamp(row.sourceEventTime)+'</td><td class="'+(row.side==='buy'?'positive':row.side==='sell'?'negative':'')+'"><span aria-label="'+({buy:'Покупка',sell:'Продажа'}[row.side]||'Направление не указано')+'">'+({buy:'↑',sell:'↓'}[row.side]||'·')+'</span> '+number(row.price)+'</td><td>'+number(row.quantity)+'</td></tr>').join('')+'</tbody></table>':
   '<p class="empty-copy">'+(trades.length?'Нет сделок с выбранным размером. Уменьшите фильтр «Лоты от».':'Новых сделок пока нет. Лента заполняется при поступлении биржевых событий.')+'</p>';
  bookBody.scrollTop=bookScroll;tapeBody.scrollTop=tapeScroll;
 }
 function reset(){book=null;trades=[];gap=false;lastReceived=0;warning='';}
 return {
  preferences(value){const next=normalize(value);if(next.depth===settings.depth&&next.tapeMinimum===settings.tapeMinimum)return;settings=next;depth.value=String(next.depth);minimum.value=String(next.tapeMinimum);render();},
  select(meta){if(meta.instrumentUid!==instrument.instrumentUid||meta.chartProvider!==instrument.chartProvider){instrument=meta;reset();if(['live','fixture','waiting','stale'].includes(phase))phase='waiting';render();}else instrument=meta;},
  state(value){phase=labels[value.state]?value.state:'waiting';if(value.simulated)simulated=true;if(value.metrics?.dropped)warning='Часть событий пропущена из-за переполнения очереди.';render();},
  receive(event){
   if(event.instrumentUid!==instrument.instrumentUid)return;
   if(event.type==='market.tape-reset'){trades=[];gap=event.reason==='reconnect_gap';render();return;}
   if(event.type==='market.book')book=event;else if(event.type==='market.trade'){trades.unshift(event);trades.length=Math.min(trades.length,200);}else if(!['market.status','market.candle'].includes(event.type))return;
   simulated=event.simulated===true;lastReceived=Date.parse(event.connectorReceivedAt)||clock();if(['waiting','connecting','live','fixture','stale'].includes(phase))phase=simulated?'fixture':'live';scheduleRender();
  },
  tick(){if(lastReceived&&clock()-lastReceived>45000&&['live','fixture','waiting'].includes(phase)){phase='stale';render();}},
  reset(){reset();phase='waiting';render();}
 };
}
