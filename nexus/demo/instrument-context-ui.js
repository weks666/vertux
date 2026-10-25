import {catalogSourceLabel} from './instrument-catalog-links.js';
import {instrumentMark, watchInstrumentImages} from './instrument-mark.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types={share:'Акция',future:'Фьючерс',bond:'Облигация',etf:'Фонд',currency:'Валюта',crypto:'Криптовалютный рынок'};
export const instrumentContextReason=snapshot=>snapshot?.reason==='catalog-loading'&&snapshot?.ref?.instrumentUid?'Загружаем каталог инструментов…':snapshot?.resolution==='ambiguous'?'Идентификатор совпал у разных записей. Откройте другой инструмент или обновите каталог.':snapshot?.ref?.instrumentUid?'Выбранный инструмент отсутствует в доступном каталоге. Выберите инструмент заново.':'Выберите инструмент из каталога.';

/** One identity header; buttons remain mounted to preserve keyboard focus. */
export function mountInstrumentContextHeader({host,context,surface,onResearch,onChart,onCompany,onPortfolio,onReturn,returnState=()=>null,companyEligible=()=>false}) {
 host.classList.add('instrument-context');host.dataset.contextSurface=surface;
 host.innerHTML='<div class="instrument-context-main"><div data-context-mark aria-hidden="true"></div><div class="instrument-context-label"><strong data-context-title></strong><span data-context-subtitle></span></div></div><div class="instrument-context-actions"><button type="button" class="button secondary" data-context-pin aria-pressed="false"></button><button type="button" class="button secondary" data-context-research>Исследовать</button><button type="button" class="button secondary" data-context-chart>Открыть график</button><button type="button" class="button secondary" data-context-company>Факты компании</button></div><p class="instrument-context-state" data-context-state role="status"></p><details class="instrument-context-details"><summary>Инструмент и источник</summary><dl data-context-details></dl></details>';
 const node=key=>host.querySelector('[data-context-'+key+']');
 if(onReturn||onPortfolio){
  const back=document.createElement('button');back.type='button';back.className='button secondary';back.dataset.contextReturn='';
  back.addEventListener('click',onReturn||onPortfolio);host.querySelector('.instrument-context-actions').prepend(back);
 }
 node('pin').hidden=surface==='terminal';node('research').hidden=!onResearch;node('chart').hidden=!onChart;node('company').hidden=!onCompany;
 node('pin').addEventListener('click',()=>context.pin(surface,!context.get(surface).pinned));
 for(const [key,action] of [['research',onResearch],['chart',onChart],['company',onCompany]])node(key).addEventListener('click',()=>{const snapshot=context.get(surface);if(snapshot.meta)action?.(snapshot.meta);});
 function update(){
  const back=node('return');if(back){const target=returnState()||{route:'portfolio',label:'К портфелю'};back.textContent=target.label;back.toggleAttribute('data-context-portfolio',target.route==='portfolio');}
  const snap=context.get(surface),meta=snap.meta||{},usable=Boolean(snap.meta),pinned=snap.pinned;
  host.dataset.instrumentUid=snap.ref?.instrumentUid||'';host.dataset.resolution=snap.resolution;
  node('mark').innerHTML=usable?instrumentMark(meta):'';watchInstrumentImages(node('mark'));
  node('title').textContent=usable?[meta.ticker,meta.name!==meta.ticker?meta.name:''].filter(Boolean).join(' · '):snap.ref?.instrumentUid?'Выбранный инструмент недоступен':'Выберите инструмент';
  const venue=[meta.exchange,meta.classCode].filter(v=>v&&!/UNSPECIFIED|UNKNOWN/i.test(v)).join(' · ');
  const unit=meta.priceUnit==='points'||meta.assetType==='future'?'пункты':meta.priceUnit==='percent-of-nominal'?'% номинала':meta.currency?.toUpperCase();
  node('subtitle').textContent=usable?[types[meta.assetType]||'Класс не определён',venue,unit].filter(Boolean).join(' · '):'';
  node('pin').disabled=!usable&&!pinned;node('pin').setAttribute('aria-pressed',String(pinned));node('pin').textContent=pinned?'Открепить':'Закрепить';
  node('pin').title='Закрепление действует до закрытия или обновления страницы';
  node('state').textContent=!usable?instrumentContextReason(snap):surface==='terminal'?'Активная вкладка графика':pinned?'Закреплён в текущем сеансе':'Следует общему выбору · закрепление на текущий сеанс';
  node('research').disabled=!usable;node('chart').disabled=!usable;node('company').disabled=!usable||!companyEligible(meta);
  node('company').title=usable&&!companyEligible(meta)?meta.assetType==='share'?'Факты этой акции недоступны в текущем контексте':'Факты компании не применимы к этому инструменту':'';
  const origin=meta.instrumentOrigin,source=origin?[origin.provider,origin.market].join(' · '):'Источник идентичности не указан; ограниченный локальный контекст';
  const rows=[['Инструмент источника',snap.ref?.instrumentUid||'Не выбран'],['Источник',source],['UID актива источника',meta.assetUid||'Не передан'],['Эмитент',snap.identity?.issuer.state==='not-applicable'?'Отчётность компании не применима':'Связь с эмитентом не подтверждена'],['Листинг',usable?'Известен инструмент источника; канонический ID не определён':'Не определён'],['Площадка / MIC',venue?venue+' · MIC не определён':'Не определена'],['ISIN / FIGI',[meta.isin,meta.figi].filter(Boolean).join(' · ')||'Не переданы']];
  if(meta.catalogIdentity?.state==='verified')rows.push(['UID позиции источника',meta.catalogIdentity.position.uid||'Не передан'],['Получение каталога',catalogSourceLabel(meta.catalogIdentity.source)]);
  if(meta.assetType==='future')rows.push(['Контракт',meta.expirationDate?'Экспирация '+meta.expirationDate.slice(0,10):'Дата экспирации не передана'],['Базовый актив',meta.catalogIdentity?.state==='verified'&&meta.catalogIdentity.underlyingPosition.uid?[meta.basicAsset,'UID позиции '+meta.catalogIdentity.underlyingPosition.uid].filter(Boolean).join(' · '):meta.basicAsset?meta.basicAsset+' · UID не определён':'Не определён']);
  if(meta.assetType==='crypto')rows.push(['Рынок',origin?.market==='spot'?'Spot':'Не подтверждён'],['Сеть / адрес контракта','Не определены']);
  node('details').innerHTML=rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('');
 }
 const unsubscribe=context.subscribe(update);update();return {update,destroy:unsubscribe};
}
