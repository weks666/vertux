import {defaultResolution,resolution,resolutionLabel} from './chart-resolutions.js';
import {chartFreshness} from './chart-freshness.js';

const text=(value,limit=240)=>typeof value==='string'&&value.length<=limit&&!/[\u0000-\u001f\u007f]/u.test(value)?value:null;
const stamp=value=>typeof value==='number'&&Number.isFinite(value)&&Number.isSafeInteger(value*1000)&&Math.abs(value*1000)<=8640000000000000?new Date(value*1000).toISOString():null;
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const intervals=new Set(['CANDLE_INTERVAL_1_MIN','CANDLE_INTERVAL_5_MIN','CANDLE_INTERVAL_15_MIN','CANDLE_INTERVAL_HOUR','CANDLE_INTERVAL_4_HOUR','CANDLE_INTERVAL_DAY','CANDLE_INTERVAL_WEEK','CANDLE_INTERVAL_MONTH']);
const directTypes=new Set(['candles','bars','line','area','baseline','hollow']);

/** Current client-visible series only. Does not fetch, persist, price, infer
 * LIVE, calculate returns, inspect a portfolio, or retain future replay bars. */
export function buildTerminalSeriesPassport(input){
 const {paneId,instrument,interval,displayResolution,rows,view={},source={},replay={active:false},visibleRange}=input||{};
 if(!text(paneId,128)||!text(instrument?.instrumentUid,256)||!intervals.has(interval)||!Array.isArray(rows)||rows.length>100000)throw new TypeError('Series context unavailable');
 const state=['ready','loading','empty','error'].includes(input.state)?input.state:'unavailable';
 let timezone=text(view.timezone,100);try{new Intl.DateTimeFormat('ru-RU',{timeZone:timezone}).format();}catch{timezone=null;}
 const base=defaultResolution(interval),display=displayResolution==null?base:resolution(displayResolution);
 if(!display||!timezone)throw new TypeError('Series method unavailable');
 const aggregated=base.unit!==display.unit||base.count!==display.count;
 if(replay.active===true&&!stamp(replay.time))throw new TypeError('Replay cutoff unavailable');
 const eligible=[];let prior=-Infinity;
 for(const row of rows){
  if(!row||!stamp(row.time)||row.time<=prior||row.instrumentUid&&row.instrumentUid!==instrument.instrumentUid||row.interval&&row.interval!==interval)throw new TypeError('Series context mismatch');
  prior=row.time;if(replay.active===true&&row.time>replay.time)continue;
  eligible.push({time:row.time,completion:aggregated?'unknown':row.isComplete===true?'complete':row.isComplete===false?'incomplete':'unknown'});
 }
 const available=state==='ready'&&eligible.length>0;
 const selected=available?eligible:[];
 const rangeKnown=directTypes.has(view.type)&&Number.isFinite(visibleRange?.from)&&Number.isFinite(visibleRange?.to)&&visibleRange.from<=visibleRange.to;
 const visible=rangeKnown?selected.filter(row=>row.time>=visibleRange.from&&row.time<=visibleRange.to):null;
 const bounds=list=>list?.length?{from:stamp(list[0].time),to:stamp(list.at(-1).time)}:null;
 const counts={complete:0,incomplete:0,unknown:0};for(const row of selected)counts[row.completion]++;
 const live=available&&chartFreshness({receivedAt:source.liveReceivedAt,sourceEventTime:source.liveEventAt,streamState:source.streamState,
  fixture:source.fixture===true,history:!!input.historyDate,replay:replay.active===true,now:input.now??Date.now()}).state==='live';
 return freeze({contractVersion:'terminal-series-passport-v1',intent:'terminal.series-context',llmUsed:false,provider:null,model:null,usage:null,
  context:{paneId,instrumentUid:instrument.instrumentUid,interval},state:available?'ready':state==='ready'?'unavailable':state,
  instrument:{ticker:text(instrument.ticker,64),name:text(instrument.name),assetType:text(instrument.assetType,32),currency:text(instrument.currency,12),
   exchange:text(instrument.exchange),classCode:text(instrument.classCode,64),expirationDate:iso(instrument.expirationDate)},
  method:{baseInterval:interval,baseLabel:resolutionLabel(base),displayLabel:resolutionLabel(display),aggregated,timezone,
   chartType:text(view.type,32),dividendAdjusted:view.dividendAdjusted===true,visibleBasis:rangeKnown?'source-time-filter':'unavailable'},
  source:{dataMode:source.fixture===true?'synthetic':instrument.publicMarketData===true?'public-crypto':'market-series',
   label:text(source.label,160),receivedAt:iso(source.capturedAt),freshness:live?'live':source.stale===true||state==='error'?'delayed':'unknown',
   liveEventAt:iso(source.liveEventAt),liveReceivedAt:iso(source.liveReceivedAt),
   historyLoading:source.historyLoading===true,historyPartial:source.historyPartial===true,hasMore:typeof source.hasMore==='boolean'?source.hasMore:null},
  replay:{active:replay.active===true,cursorTime:replay.active===true?stamp(replay.time):null},
  loaded:{count:available?selected.length:null,bounds:bounds(selected),completion:available?counts:null},
  visible:{count:available&&visible?visible.length:null,bounds:bounds(visible)},
  limits:['Время свечи обозначает её начало. Полнота всей рыночной истории не подтверждается числом загруженных свечей.',
   live?'Подключён биржевой поток. Время сделки и получения показаны отдельно; новые события применяются по мере поступления.':'Время получения ответа не является временем сделки. Для подтверждения текущей котировки ожидаем свежее событие биржевого потока.',
   ...(aggregated?['Число и границы относятся к свечам серии после агрегации в приложении, а не ко всем исходным свечам. Завершённость агрегированного интервала не подтверждена.']:[]),
   ...(replay.active===true?['Воспроизведение использует загруженную сейчас историю. Это не доказательство того, какие данные были известны в прошлом. Свечи после курсора исключены из паспорта.']:[]),
   ...(view.dividendAdjusted===true?['На графике включена поправка на дивиденды. Её текущие сведения не доказывают историческую доступность поправки.']:[]),
   ...(!rangeKnown?['Видимая часть исходного ряда для этого представления не подтверждена.']:[]),
   'Паспорт относится только к выбранной серии. Стакан, лента, новости, сравнения и индикаторы имеют отдельные источники и периоды.']});
}
