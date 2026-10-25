import {validWorldSymbol} from './world-market-catalog.js';
import {createWorldMarketTone} from './world-market-tone.js';
export {validWorldSymbol} from './world-market-catalog.js';
// Public display only. Broker IDs, account selections and workspace URLs never
// enter widget settings; prices stay in the provider's cross-origin frame.
export const worldMarketPresets = Object.freeze([
  {symbol:'OANDA:XAUUSD',label:'Золото / USD',description:'XAUUSD · OANDA · внебиржевой металл'},
  {symbol:'OANDA:XAGUSD',label:'Серебро / USD',description:'XAGUSD · OANDA · внебиржевой металл'},
  {symbol:'FX:EURUSD',label:'EUR / USD',description:'EURUSD · FX · валютная пара'},
  {symbol:'NASDAQ:AAPL',label:'Apple',description:'AAPL · NASDAQ · акция'},
  {symbol:'NASDAQ:NVDA',label:'NVIDIA',description:'NVDA · NASDAQ · акция'},
  {symbol:'COMEX:GC1!',label:'Фьючерс на золото',description:'GC1! · COMEX · непрерывный ряд фьючерсов'},
  {symbol:'BINANCE:BTCUSDT',label:'Bitcoin / USDT',description:'BTCUSDT · Binance · криптовалюта'},
].map(Object.freeze));
export function worldMarketChartUrl(symbol='OANDA:XAUUSD',theme='dark',interval='D',colors={}) {
  if(!validWorldSymbol(symbol))throw new TypeError('Invalid public market symbol');
  const url=new URL('https://www.tradingview-widget.com/embed-widget/advanced-chart/');
  url.searchParams.set('locale','ru');
  url.hash=encodeURIComponent(JSON.stringify({symbol,interval:['1','5','15','60','240','D','W','M'].includes(interval)?interval:'D',timezone:'Europe/Moscow',theme:theme==='light'?'light':'dark',
    style:'1',locale:'ru',allow_symbol_change:false,hide_side_toolbar:false,hide_top_toolbar:false,hide_legend:false,withdateranges:true,save_image:false,
    backgroundColor:/^#[0-9a-f]{6}$/i.test(colors.background||'')?colors.background:theme==='light'?'#ffffff':'#0e141c',
    gridColor:/^#[0-9a-f]{6}$/i.test(colors.grid||'')?colors.grid:theme==='light'?'#e8e8e8':'#252c38',
    autosize:true,width:'100%',height:'100%',bodyId:'widget-container',bodyClasses:['chart-page','unselectable','on-widget']}));
  return url.href;
}
export function worldMarketChartLink(symbol='OANDA:XAUUSD') {
  if(!validWorldSymbol(symbol))throw new TypeError('Invalid public market symbol');
  const url=new URL('https://www.tradingview.com/chart/');url.searchParams.set('symbol',symbol);return url.href;
}
export function worldMarketPresetForQuery(query='') {
  const q=String(query).trim().toUpperCase();
  return worldMarketPresets.find(p=>[p.symbol,p.symbol.split(':')[1],p.label.toUpperCase()].includes(q))
    ||(/^(?:GOLD|ЗОЛОТО|XAU)(?:\s|$)/.test(q)?worldMarketPresets[0]:null);
}

export function createWorldMarketChart({host,allowed=()=>false,preview=()=>false}) {
  let symbol='OANDA:XAUUSD',interval='D',frame=null,open=false,timer=null,disposed=false,paletteKey='';
  const doc=host.ownerDocument;
  host.classList.add('terminal-world-market');host.hidden=true;host.setAttribute('aria-label','График TradingView');
  host.innerHTML='<p class="terminal-world-status" role="status"></p><div class="terminal-world-frame"></div><div class="terminal-world-recovery" hidden><button type="button" data-world-reload aria-label="Перезагрузить график TradingView">Повторить загрузку</button><a data-world-link target="_blank" rel="noopener noreferrer">Открыть в TradingView</a></div>';
  const status=host.querySelector('[role=status]'),frameHost=host.querySelector('.terminal-world-frame'),link=host.querySelector('[data-world-link]'),recovery=host.querySelector('.terminal-world-recovery');
  const tone=createWorldMarketTone(host);
  function clear(){clearTimeout(timer);timer=null;frame?.remove();frame=null;frameHost.replaceChildren();}
  function palette(){const style=doc.defaultView.getComputedStyle(host);return {theme:doc.documentElement.dataset.palette||doc.documentElement.dataset.workspaceTheme,background:style.getPropertyValue('--chart-bg').trim(),grid:style.getPropertyValue('--chart-line').trim(),panel:style.getPropertyValue('--surface').trim(),raised:style.getPropertyValue('--surface-raised').trim()};}
  function load(){
    clear();if(!open||!allowed()||disposed)return;
    link.href=worldMarketChartLink(symbol);recovery.hidden=true;
    if(preview()){status.hidden=false;status.textContent='Учебный просмотр. Внешние рыночные данные здесь не загружаются.';return;}
    status.hidden=false;status.textContent='Загружаем график TradingView…';
    const current=doc.createElement('iframe');frame=current;current.title=symbol+' · график TradingView';current.referrerPolicy='no-referrer';
    const colors=palette();paletteKey=JSON.stringify(colors);
    current.setAttribute('sandbox','allow-scripts allow-same-origin');current.src=worldMarketChartUrl(symbol,colors.theme,interval,tone.apply(current,colors));
    current.addEventListener('load',()=>{if(frame!==current)return;clearTimeout(timer);timer=null;status.hidden=true;recovery.hidden=true;});
    // A frame load is not proof of quotes. Do not invent a fresh-market badge.
    current.addEventListener('error',()=>{if(frame===current){status.hidden=false;recovery.hidden=false;status.textContent='График не загрузился. Повторите загрузку или откройте его в TradingView.';}});
    frameHost.append(current);
    timer=setTimeout(()=>{if(frame===current){status.hidden=false;recovery.hidden=false;status.textContent='Загрузка занимает больше времени. Можно повторить её или открыть график в TradingView.';}},15000);
  }
  function close(){open=false;host.hidden=true;clear();}
  function show(next=symbol,nextInterval=interval){if(disposed||!allowed()||!validWorldSymbol(next))return false;
    const changed=!open||symbol!==next||interval!==nextInterval;symbol=next;interval=nextInterval;open=true;host.hidden=false;if(changed||!frame&&!preview())load();else if(preview())load();return true;}
  const onClick=event=>{const b=event.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-world-reload'))load();
  };host.addEventListener('click',onClick);
  const themeObserver=new doc.defaultView.MutationObserver(()=>{if(open&&frame&&!disposed&&JSON.stringify(palette())!==paletteKey)load();});
  themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['style','data-palette','data-workspace-theme']});
  return {show,close,isOpen:()=>open,reset:close,dispose(){disposed=true;themeObserver.disconnect();close();tone.dispose();host.removeEventListener('click',onClick);}};
}
