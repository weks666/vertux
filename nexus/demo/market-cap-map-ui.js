const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DECIMAL_SCALE=10n**30n;
const scaled=value=>{if(typeof value!=='string'||!/^\d{1,31}(?:\.\d{1,30})?$/.test(value))return null;const [whole,fraction='']=value.split('.');return BigInt(whole)*DECIMAL_SCALE+BigInt(fraction.padEnd(30,'0'));};
export function capitalizationLabel(value,compact=false){
 const number=scaled(value);if(number===null)return 'Нет данных';
 if(compact){for(const [unit,label]of [[1000000000000n*DECIMAL_SCALE,'трлн'],[1000000000n*DECIMAL_SCALE,'млрд'],[1000000n*DECIMAL_SCALE,'млн']])if(number>=unit){const tenth=(number*10n+unit/2n)/unit;return (tenth/10n).toLocaleString('ru-RU')+(tenth%10n?','+tenth%10n:'')+' '+label+' ₽';}}
 const [whole,fraction='']=value.split('.');return BigInt(whole).toLocaleString('ru-RU')+(fraction.replace(/0+$/,'')?','+fraction.replace(/0+$/,''):'')+' ₽';
}
export function capitalizationTiles(rows){
 const values=rows.map(row=>({...row,weight:scaled(row.capitalizationRub)})).filter(row=>row.weight>0n).sort((a,b)=>a.weight===b.weight?a.id.localeCompare(b.id):a.weight>b.weight?-1:1),out=[];
 function split(items,x,y,w,h){
  if(!items.length)return;if(items.length===1){const {weight,...row}=items[0];out.push({...row,x,y,width:w,height:h});return;}
  const sum=items.reduce((a,b)=>a+b.weight,0n);let left=items[0].weight,k=1;
  while(k<items.length-1&&left+items[k].weight<=sum/2n){left+=items[k].weight;k++;}
  const ratio=Number(left*1000000000n/sum)/1000000000;
  if(w>=h){split(items.slice(0,k),x,y,w*ratio,h);split(items.slice(k),x+w*ratio,y,w*(1-ratio),h);}
  else{split(items.slice(0,k),x,y,w,h*ratio);split(items.slice(k),x,y+h*ratio,w,h*(1-ratio));}
 }
 split(values,0,0,1,1);return out;
}
const changeLabel=value=>typeof value==='number'&&Number.isFinite(value)?(value>0?'+':'')+new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' %':'Нет изменения цены';
const shade=value=>value===null?'unknown':value<=-3?'loss-strong':value<-.1?'loss':value>=3?'gain-strong':value>.1?'gain':'flat';
const sectorTitles={financial:'Финансы',it:'Технологии',energy:'Энергетика',materials:'Материалы',industrials:'Промышленность',telecom:'Телекоммуникации',consumer:'Потребительский сектор',utilities:'Электроэнергетика',real_estate:'Недвижимость',health_care:'Здравоохранение',ecomaterials:'Экоматериалы',green_buildings:'Зелёное строительство',green_energy:'Зелёная энергетика',electrocars:'Электромобили',other:'Другое',consumer_discretionary:'Потребительские товары',consumer_staples:'Товары повседневного спроса'};
// An unknown provider code is never shown raw in the Russian interface.
const sectorTitle=value=>value?(sectorTitles[value]||(/^[a-z_]+$/.test(value)?'Другой сектор':value)):'Сектор не указан';
export function capitalizationGroups(rows){
 const groups=new Map();
 for(const row of rows){const id=row.sector||'';if(!groups.has(id))groups.set(id,{id,name:sectorTitle(id),rows:[],amount:0n});const group=groups.get(id);group.rows.push(row);group.amount+=scaled(row.capitalizationRub)||0n;}
 return capitalizationTiles([...groups.values()].map(({amount,...group})=>({...group,capitalizationRub:String(amount/DECIMAL_SCALE)+'.'+String(amount%DECIMAL_SCALE).padStart(30,'0')})));
}
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})+' мск':'Время не передано';

// One world map: TradingView's own top bar switches country, index and exchange,
// so Invest no longer splits it into separate US and German entries.
export function internationalMarketMapUrl(theme='dark'){
 const url=new URL('https://www.tradingview-widget.com/embed-widget/stock-heatmap/');
 url.searchParams.set('locale','ru');
 url.hash=encodeURIComponent(JSON.stringify({dataSource:'SPX500',exchanges:[],grouping:'sector',blockSize:'market_cap_basic',blockColor:'change',hasTopBar:true,isDataSetEnabled:true,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false,colorTheme:theme==='light'?'light':'dark',locale:'ru',width:'100%',height:'100%'}));
 return url.href;
}

/** Opening the market view loads it once through the same
 * owner-authenticated transport as the workspace. No broker account is used. */
export function createMarketCapitalizationUi({host,request,getAccess=()=>({allowed:false,key:''})}){
 let data=null,selected=null,epoch=0,scope=getAccess().key,disposed=false,zoom=1;
 host.classList.add('market-cap-workspace');
 host.innerHTML='<header class="market-cap-heading"><div><h3>Карта рынка</h3><p>Мосбиржа · размер — капитализация, цвет — изменение цены.</p></div><button type="button" class="button secondary" data-market-map-load>Обновить</button></header><p class="market-cap-status" role="status" data-market-map-status>Данные с задержкой. Счёт и период портфеля не влияют на карту.</p><div data-market-map-content></div>';
 const button=host.querySelector('[data-market-map-load]'),status=host.querySelector('[data-market-map-status]'),content=host.querySelector('[data-market-map-content]');
 const marketChoice=host.ownerDocument.createElement('div');marketChoice.className='market-cap-market-choice';marketChoice.setAttribute('role','radiogroup');marketChoice.setAttribute('aria-label','Рынок карты');
 marketChoice.innerHTML='<button type="button" role="radio" data-market-map-region="moex" aria-checked="true">Россия · Мосбиржа</button><button type="button" role="radio" data-market-map-region="international" aria-checked="false">Мировые рынки · TradingView</button>';
 host.querySelector('.market-cap-heading > div').append(marketChoice);
 const choices=[...marketChoice.querySelectorAll('[data-market-map-region]')],region={value:'moex',set disabled(value){choices.forEach(choice=>{choice.disabled=value;});}},description=host.querySelector('.market-cap-heading p');
 const pick=value=>{region.value=value;choices.forEach(choice=>{const on=choice.dataset.marketMapRegion===value;choice.setAttribute('aria-checked',String(on));choice.tabIndex=on?0:-1;});};pick('moex');
 const valid=()=>!disposed&&getAccess().allowed===true;
 function updateAccess(){const access=getAccess();if(scope!==access.key||!access.allowed){scope=access.key;++epoch;data=null;selected=null;content.replaceChildren();host.removeAttribute('aria-busy');button.textContent='Загрузить карту';status.textContent=access.allowed?'Загрузите свежую карту выбранного рынка.':'Карта рынка доступна владельцу Workspace после входа.';}button.disabled=!access.allowed||host.hasAttribute('aria-busy');region.disabled=!access.allowed;}
 function renderInternational(){
  if(!valid())return;content.replaceChildren();host.removeAttribute('aria-busy');button.disabled=false;button.textContent='Перезагрузить карту';
  description.textContent='Мировые рынки · размер — капитализация, цвет — изменение цены.';
  status.textContent='Источник: TradingView. Страну, индекс, размер и цвет блоков выберите в верхней панели карты.';
  const frame=host.ownerDocument.createElement('iframe');frame.className='market-cap-international';frame.title='Карта акций мировых рынков TradingView';
  frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin');
  // Only public widget configuration crosses this origin boundary. No local
  // identity, portfolio selection, session URL or broker data is sent.
  frame.src=internationalMarketMapUrl(host.ownerDocument.documentElement.dataset.workspaceTheme);
  const open=host.ownerDocument.createElement('a');open.className='button secondary market-cap-external';open.href='https://www.tradingview.com/heatmap/stock/';open.target='_blank';open.rel='noopener noreferrer';open.textContent='Открыть карту в браузере';
  const hint=host.ownerDocument.createElement('p');hint.className='market-cap-status';hint.textContent='Если встроенная карта не появилась, откройте её в браузере. Доступность и задержка данных зависят от TradingView и биржи.';
  const source=host.ownerDocument.createElement('div');source.className='tradingview-widget-copyright';
  const attribution=host.ownerDocument.createElement('a');attribution.href='https://www.tradingview.com/heatmap/stock/';attribution.target='_blank';attribution.rel='noopener noreferrer';attribution.textContent='Карта акций';
  source.append(attribution,host.ownerDocument.createTextNode(' от TradingView'));
  const fallback=host.ownerDocument.createElement('p');fallback.className='market-cap-status';fallback.textContent='Если источник недоступен, повторите загрузку или выберите Мосбиржу.';
  content.append(open,hint,frame,source,fallback);
 }
 function choose(id){
  if(!valid()||!data||scope!==getAccess().key)return updateAccess();const row=data.rows.find(row=>row.id===id);if(!row)return;selected=id;
  const picker=content.querySelector('[data-market-map-company]');if(picker)picker.value=id;
  content.querySelectorAll('[data-market-company]').forEach(tile=>tile.dataset.selected=String(tile.dataset.marketCompany===id));
  const detail=content.querySelector('[data-market-map-detail]');
  detail.innerHTML='<h4>'+esc(row.name)+'</h4><p class="market-cap-note">Капитализация компании</p><strong class="market-cap-value">'+esc(capitalizationLabel(row.capitalizationRub,true))+'</strong><p class="market-cap-exact">'+esc(capitalizationLabel(row.capitalizationRub))+'</p><p class="market-cap-change '+(row.changePercent===null?'':row.changePercent<0?'negative':'positive')+'">'+esc(changeLabel(row.changePercent))+'</p><p class="market-cap-note">'+(row.changeBasis==='ordinary-share'?'Изменение '+esc(row.changeTicker)+' к предыдущему торговому дню.':'Нет подтверждённого изменения обыкновенной акции.')+'</p><details class="market-cap-method"><summary>Состав и источник</summary><h4>'+esc(row.name)+'</h4><ul class="market-cap-issues">'+row.issues.map(issue=>'<li><span>'+esc(issue.ticker)+'<small>'+esc(issue.shareType==='preferred'?'Привилегированные акции':'Обыкновенные акции')+'</small></span><strong>'+esc(capitalizationLabel(issue.capitalizationRub))+'</strong></li>').join('')+'</ul><p class="market-cap-note">Сумма известных классов акций на TQBR. Классы, не представленные в этой выборке, не учтены.</p><p class="market-cap-note">Время данных системы: '+esc(date(row.asOf))+'. Отдельную дату оценки капитализации источник не передаёт.</p></details>';
 }
 function render(){
  const rows=data.rows,coverage=data.coverage;
  const tileMarkup=tile=>'<button type="button" tabindex="-1" data-market-company="'+esc(tile.id)+'" data-shade="'+shade(tile.changePercent)+'" data-small="'+String(tile.width*tile.height<.012)+'" style="left:'+tile.x*100+'%;top:'+tile.y*100+'%;width:'+tile.width*100+'%;height:'+tile.height*100+'%" title="'+esc(tile.name+' · '+capitalizationLabel(tile.capitalizationRub)+' · '+changeLabel(tile.changePercent))+'"><span>'+esc(tile.ticker)+'</span><small>'+esc(changeLabel(tile.changePercent))+'</small></button>';
  const groups=capitalizationGroups(rows);
  const tilesMarkup=groups.map(group=>'<section class="market-cap-sector" style="left:'+group.x*100+'%;top:'+group.y*100+'%;width:'+group.width*100+'%;height:'+group.height*100+'%"><h4 title="'+esc(group.name)+'">'+esc(group.name)+'</h4><div class="market-cap-sector-tiles">'+capitalizationTiles(group.rows).map(tileMarkup).join('')+'</div></section>').join('');
  const options=[...rows].sort((a,b)=>{const x=scaled(a.capitalizationRub),y=scaled(b.capitalizationRub);return x===y?a.id.localeCompare(b.id):x>y?-1:1;});
  content.innerHTML='<div class="market-cap-summary"><div><span>Капитализация в выборке</span><strong>'+esc(capitalizationLabel(data.totalCapitalizationRub,true))+'</strong></div><div><span>Компаний на карте</span><strong>'+esc(coverage.includedCompanyCount)+'</strong></div><p>'+esc(data.source.delayLabel)+'<br>Срез получен '+esc(date(data.capturedAt))+'</p></div><div class="market-cap-layout"><div class="market-cap-canvas"><div class="market-cap-map" aria-hidden="true">'+tilesMarkup+'</div><div class="market-cap-legend"><span data-shade="loss-strong">≤ −3 %</span><span data-shade="loss">Снижение</span><span data-shade="flat">Около нуля</span><span data-shade="gain">Рост</span><span data-shade="gain-strong">≥ +3 %</span><span data-shade="unknown">Нет данных</span></div></div><aside class="market-cap-inspector"><label>Выбрать компанию<select data-market-map-company aria-label="Компания на карте рынка">'+options.map(row=>'<option value="'+esc(row.id)+'">'+esc(row.ticker+' · '+row.name)+'</option>').join('')+'</select></label><section data-market-map-detail aria-live="polite" aria-label="Компания и состав капитализации"></section></aside></div><footer class="market-cap-coverage"><strong>Охват: российские акции, основной режим TQBR</strong><p>Учтено '+esc(coverage.includedIssueCount)+' выпусков. Компаний вне карты из-за неполных данных: '+esc(coverage.omittedCompanyCount)+'. Выпусков без подтверждённого эмитента: '+esc(coverage.unresolvedIssuerIssueCount)+'.</p><p>Площадь рассчитана от компаний, включённых в этот срез. Это не все финансовые инструменты российского рынка.</p><a href="https://iss.moex.com/iss/reference/32" target="_blank" rel="noopener noreferrer">Источник: Московская биржа · ISS</a></footer>';
  if(data.sectorCoverage){const note=host.ownerDocument.createElement('p');note.className='market-cap-note';note.textContent='Секторы: '+data.sectorCoverage.source+'. Определены у '+data.sectorCoverage.classified+' из '+rows.length+' компаний; остальные показаны отдельно.';content.querySelector('.market-cap-coverage').append(note);}
  const map=content.querySelector('.market-cap-map'),viewport=host.ownerDocument.createElement('div');
  viewport.className='market-cap-viewport';viewport.setAttribute('aria-label','Карта компаний: прокрутка при увеличении');
  map.before(viewport);viewport.append(map);
  const controls=host.ownerDocument.createElement('div');controls.className='market-cap-map-controls';controls.setAttribute('aria-label','Масштаб карты');
  controls.innerHTML='<button type="button" class="button secondary" data-map-zoom="out" aria-label="Уменьшить карту">−</button><button type="button" class="button secondary" data-map-zoom="reset" aria-label="Сбросить масштаб карты">100 %</button><button type="button" class="button secondary" data-map-zoom="in" aria-label="Увеличить карту">+</button><span>Масштаб карты</span>';
  viewport.before(controls);
  const updateZoom=()=>{viewport.style.setProperty('--map-zoom',String(zoom));viewport.dataset.zoomed=String(zoom>1);controls.querySelector('[data-map-zoom="out"]').disabled=zoom===1;controls.querySelector('[data-map-zoom="in"]').disabled=zoom===4;controls.querySelector('[data-map-zoom="reset"]').textContent=zoom*100+' %';if(zoom===1){viewport.scrollTop=0;viewport.scrollLeft=0;}};
  controls.addEventListener('click',event=>{const direction=event.target.closest('[data-map-zoom]')?.dataset.mapZoom;if(!direction||!valid())return;zoom=direction==='reset'?1:Math.max(1,Math.min(4,zoom+(direction==='in'?1:-1)));updateZoom();});updateZoom();
  content.querySelector('[data-market-map-company]').addEventListener('change',event=>choose(event.target.value));
  choose(rows.some(row=>row.id===selected)?selected:options[0].id);
 }
 async function load(){
  updateAccess();if(!valid()||typeof request!=='function')return;
  if(region.value!=='moex'){++epoch;renderInternational();return;}
  description.textContent='Мосбиржа · размер — капитализация, цвет — изменение цены.';
  const access=getAccess(),ticket=++epoch;button.disabled=true;button.textContent='Загружаем…';host.setAttribute('aria-busy','true');status.textContent='Получаем капитализацию компаний и изменения цены…';
  const current=()=>!disposed&&ticket===epoch&&valid()&&access.key===getAccess().key;
  try{
   const response=await request('/api/market/capitalization-map');if(!current())return;
   if(response?.contractVersion!=='moex-company-cap-map-v1'||!Array.isArray(response.rows)||!response.rows.length||response.rows.some(row=>!row.id||scaled(row.capitalizationRub)<=0n||!Array.isArray(row.issues)||!row.issues.length||!(row.changePercent===null||Number.isFinite(row.changePercent)))||scaled(response.totalCapitalizationRub)<=0n||!response.coverage||!response.source)throw Error('Неполный ответ источника.');
   data=response;scope=access.key;render();status.textContent=response.fixture?'Учебная карта · синтетические компании для локальной проверки интерфейса.':response.source.delayLabel+' · капитализация доступных классов акций объединена по эмитенту.';button.textContent='Обновить карту';
  }catch(error){if(!current())return;data=null;content.replaceChildren();status.textContent='Карта не загружена. '+(error.message||'Повторите попытку.');button.textContent='Повторить загрузку';}
  finally{if(current()){button.disabled=false;host.removeAttribute('aria-busy');}}
 }
 const click=event=>{const tile=event.target.closest('[data-market-company]');if(tile&&host.contains(tile))choose(tile.dataset.marketCompany);};
 const pointer=event=>{if(event.target.closest('[data-market-company]'))event.preventDefault();};
 const changeMarket=()=>{++epoch;content.replaceChildren();host.removeAttribute('aria-busy');updateAccess();if(!valid())return;if(region.value!=='moex')renderInternational();else if(data){description.textContent='Мосбиржа · размер — капитализация, цвет — изменение цены.';render();button.textContent='Обновить карту';status.textContent=data.fixture?'Учебная карта · синтетические компании.':data.source.delayLabel;}else void load();};
 const onChoice=event=>{const choice=event.target.closest('[data-market-map-region]');if(!choice||choice.disabled||region.value===choice.dataset.marketMapRegion)return;pick(choice.dataset.marketMapRegion);changeMarket();};
 const onKey=event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const next=choices[(choices.findIndex(choice=>choice.dataset.marketMapRegion===region.value)+1)%choices.length];next.focus();next.click();};
 marketChoice.addEventListener('click',onChoice);marketChoice.addEventListener('keydown',onKey);
 button.addEventListener('click',load);host.addEventListener('click',click);host.addEventListener('pointerdown',pointer);updateAccess();
 // Keep the public iframe while its panel is hidden: removing it loses the
 // user's country/index/zoom selection and requires another network load.
 return{updateAccess,suspend(){},open(){updateAccess();if(region.value!=='moex'){if(!content.querySelector('iframe'))renderInternational();}else if(!data&&!host.hasAttribute('aria-busy'))void load();},dispose(){disposed=true;++epoch;content.querySelector('iframe')?.remove();marketChoice.removeEventListener('click',onChoice);marketChoice.removeEventListener('keydown',onKey);button.removeEventListener('click',load);host.removeEventListener('click',click);host.removeEventListener('pointerdown',pointer);}};
}
