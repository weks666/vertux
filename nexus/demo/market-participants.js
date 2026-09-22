import {formatMarketTick} from './charts.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number=value=>Number.isFinite(value)?value.toLocaleString('ru-RU'):'—';
const signed=value=>(value>0?'+':'')+number(value);
const stamp=value=>new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' мск';
const tones={FIZ:'#9a7cff',YUR:'#45c9cf'};
export function initParticipantsPanel({host,request}){
 let selected=null,days=5,sequence=0,snapshot=null,chart=null,observer=null,loadedKey='',pendingKey='',active=false,loadedAt=0,refreshTimer=null;
 function destroy(){observer?.disconnect();observer=null;chart?.remove();chart=null;}
 function placeholder(message){destroy();host.innerHTML='<p class="empty-copy">'+escape(message)+'</p>';}
 function chartView(){
  destroy();const api=globalThis.LightweightCharts,canvas=host.querySelector('.participants-chart');
  if(!api||!canvas||!snapshot?.items?.length)return;
  chart=api.createChart(canvas,{width:canvas.clientWidth,height:230,layout:{background:{type:'solid',color:'#0d141e'},textColor:'#9daeca',fontFamily:'Rubik, system-ui, sans-serif',attributionLogo:false},
   grid:{vertLines:{color:'#95accc0a'},horzLines:{color:'#95accc1a'}},rightPriceScale:{borderVisible:false},
   timeScale:{tickMarkFormatter:formatMarketTick,timeVisible:true,secondsVisible:false,borderVisible:false,fixLeftEdge:true,fixRightEdge:true,rightOffset:0,minBarSpacing:0.01},
   localization:{locale:'ru-RU',priceFormatter:number,timeFormatter:time=>stamp(time*1000)},crosshair:{horzLine:{visible:false,labelVisible:false}}});
  for(const group of ['FIZ','YUR']){
   const series=chart.addSeries(api.LineSeries,{color:tones[group],lineWidth:2,priceLineVisible:false,title:group==='FIZ'?'Физлица':'Юрлица',priceFormat:{type:'custom',minMove:1,formatter:number}});
   series.setData(snapshot.items.map(row=>({time:Date.parse(row.time)/1000,value:row[group].net})));
  }
  chart.timeScale().fitContent();observer=new ResizeObserver(()=>chart?.applyOptions({width:canvas.clientWidth}));observer.observe(canvas);
  chart.subscribeCrosshairMove(param=>{const row=snapshot?.items?.find(item=>Date.parse(item.time)/1000===param.time)||snapshot?.latest;const legend=host.querySelector('.participants-legend');if(row&&legend)legend.textContent=stamp(row.time)+' · Физлица '+signed(row.FIZ.net)+' · Юрлица '+signed(row.YUR.net);});
 }
 function render(){
  if(!snapshot)return;
  const messages={'not-applicable':'Выберите фьючерс: Мосбиржа публикует эту разбивку для срочного рынка.','unsupported':'Для этого фьючерса источник не публикует позиции участников.','fixture':'В демонстрационном портфеле внешние данные Мосбиржи не загружаются.','empty':'У источника пока нет сопоставимого среза для обеих групп участников.'};
  if(snapshot.state!=='ready'||!snapshot.latest){placeholder(messages[snapshot.state]||'Позиции участников пока недоступны.');return;}
  const row=snapshot.latest;
  host.innerHTML=`<div class="participants-head"><div><strong>Открытые позиции · ${escape(snapshot.ticker)}</strong><p>Все серии фьючерса · контракты</p></div><div class="participants-ranges" role="group" aria-label="Период позиций участников"><button type="button" data-participants-days="1" aria-pressed="${days===1}">День</button><button type="button" data-participants-days="5" aria-pressed="${days===5}">5 дней</button></div><span class="participants-delay">Вымышленный пример</span></div>
   <div class="participants-summary">${['FIZ','YUR'].map(group=>{const value=row[group];return `<article><header><i style="background:${tones[group]}" aria-hidden="true"></i><h3>${group==='FIZ'?'Физические лица':'Юридические лица'}</h3><strong>${signed(value.net)}</strong></header><dl><div><dt>Длинные</dt><dd>${number(value.long)}</dd><small>${number(value.longParticipants)} участников</small></div><div><dt>Короткие</dt><dd>${number(value.short)}</dd><small>${number(value.shortParticipants)} участников</small></div><div><dt>Баланс длинных / коротких</dt><dd class="participants-ratio"><span style="width:${value.long+value.short?value.long/(value.long+value.short)*100:0}%"></span></dd><small>${value.long+value.short?Math.round(value.long/(value.long+value.short)*100):0}% / ${value.long+value.short?Math.round(value.short/(value.long+value.short)*100):0}%</small></div></dl></article>`;}).join('')}</div>
   <div class="participants-chart-title"><strong>Чистая позиция</strong><span class="participants-legend">${escape(stamp(row.time))} · Физлица ${signed(row.FIZ.net)} · Юрлица ${signed(row.YUR.net)}</span></div><div class="participants-chart" aria-label="Динамика чистых позиций физических и юридических лиц"></div>
   <p class="terminal-caption">Демонстрация FUTOI · срез ${escape(stamp(row.time))}${snapshot.partial?' · Часть дней временно недоступна':''}${snapshot.stale?' · Сохранённый срез, обновление задерживается':''}. Данные участников и текущая цена относятся к разным моментам.</p>
   <details class="terminal-method"><summary>Источник и метод расчёта</summary><p>Чистая позиция — длинные контракты минус короткие. Суммируются все сроки исполнения базового актива, а не только ${escape(selected?.ticker)}. Один участник может одновременно входить в обе группы направлений.</p><a href="https://moexalgo.github.io/docs/method/futoi/" target="_blank" rel="noopener noreferrer">Методология Московской биржи ↗</a></details>`;
  if(active)chartView();
 }
 async function load(){
  if(host.hidden||!active)return;
  if(!selected||!['future','futures'].includes(selected.assetType)){placeholder('Выберите фьючерс: здесь будут позиции физических и юридических лиц.');return;}
  const key=selected.instrumentUid+':'+days;
  if(key===loadedKey&&snapshot&&Date.now()-loadedAt<600000){render();return;}
  if(key===pendingKey)return;
  const own=++sequence;pendingKey=key;placeholder('Загружаем позиции участников с Мосбиржи…');
  try{const result=await request('/api/market/participants?'+new URLSearchParams({instrumentUid:selected.instrumentUid,days}));if(own!==sequence)return;snapshot=result;loadedKey=key;loadedAt=Date.now();render();}
  catch{if(own===sequence){if(snapshot&&loadedKey===key){snapshot={...snapshot,stale:true};render();}else placeholder('Мосбиржа сейчас недоступна. При следующем открытии вкладки попробуем снова.');}}
  finally{if(own===sequence)pendingKey='';}
 }
 host.addEventListener('click',event=>{const value=event.target.closest('[data-participants-days]')?.dataset.participantsDays;if(value){days=Number(value);void load();}});
 return {show(){active=true;clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(Date.now()-loadedAt>=600000)void load();},60000);void load();},update(value){if(selected?.instrumentUid===value?.instrumentUid)return;selected=value;sequence++;snapshot=null;loadedKey='';pendingKey='';destroy();if(!host.hidden&&active)void load();},hide(){active=false;clearInterval(refreshTimer);refreshTimer=null;destroy();}};
}
