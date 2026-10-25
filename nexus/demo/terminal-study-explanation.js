import {calculateStudy} from './chart-indicators.js';
import {buildTerminalSeriesPassport} from './terminal-series-passport.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const reasons={loading:'Серия загружается. Откройте расчёт после загрузки.',empty:'В текущем ответе нет свечей. Выберите другой интервал или загрузите историю.',
 error:'Не удалось обновить серию. Прежний результат здесь не используется.',unavailable:'Серия или её контекст не подтверждены.',
 study_unavailable:'Выбранный индикатор больше не показан на этом графике или его метод пока не поддерживается. Выберите его заново в индикаторах.',
 insufficient_history:'Для этого периода не хватает загруженных свечей. Уменьшите период или загрузите историю.',
 invalid_prices:'Цены или их связь с исходными свечами не подтверждены. Обновите серию.',
 point_unavailable:'Выбранной точки нет в доступном срезе или она находится после курсора воспроизведения. Откройте актуальный расчёт.',
 calculation_unavailable:'Расчёт по этому ряду не удалось подтвердить. Значение не показано.'};
const iso=time=>new Date(time*1000).toISOString();
const rsiValue=(gain,loss)=>loss===0?(gain===0?50:100):100-100/(1+gain/loss);

// Trace the implemented chart recurrence, including hidden warm-up. A separate
// calculateStudy call confirms the plotted endpoint. Tests use independent oracles.
function recursiveTrace(rows,study,evidenceRow){
 const trace=[],period=study.period;let value=null,gain=0,loss=0,seed=null;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],entry=evidenceRow(row,i);
  if(study.type==='ema'){
   const previousValue=value;value=value===null?row.close:value+(row.close-value)*2/(period+1);
   if(!Number.isFinite(value))return null;
   trace.push({...entry,previousValue,value,phase:i===0?'seed':i<period-1?'warmup':'calculated',plotted:i>=period-1});
   if(i===0)seed={method:'first-close',at:entry.at,value};
  }else if(i===0){
   trace.push({...entry,change:null,gain:null,loss:null,averageGain:null,averageLoss:null,value:null,phase:'baseline',plotted:false});
  }else{
   const change=row.close-rows[i-1].close,up=Math.max(0,change),down=Math.max(0,-change),previousAverageGain=gain,previousAverageLoss=loss;
   if(i<=period){gain+=up/period;loss+=down/period;}else{gain=(gain*(period-1)+up)/period;loss=(loss*(period-1)+down)/period;}
   if(![change,gain,loss].every(Number.isFinite))return null;
   const plotted=i>=period;value=plotted?rsiValue(gain,loss):null;
   if(plotted&&(!Number.isFinite(value)||value<0||value>100))return null;
   trace.push({...entry,change,gain:up,loss:down,averageGain:plotted?gain:null,averageLoss:plotted?loss:null,
    previousAverageGain:i>period?previousAverageGain:null,previousAverageLoss:i>period?previousAverageLoss:null,
    value,phase:i<period?'warmup':i===period?'seed':'calculated',plotted});
   if(i===period)seed={method:'mean-first-changes',fromAt:iso(rows[0].time),at:entry.at,changeCount:period,averageGain:gain,averageLoss:loss,value};
  }
 }
 return {trace,seed};
}

/** Read-only explanation of the selected plotted study. supportedTypes keeps
 * the previous SMA-only entry point compatible. No network, model or storage. */
export function buildTerminalStudyExplanation(input,studyId,{supportedTypes=['sma','ema','rsi'],pointTime=null}={}){
 const series=buildTerminalSeriesPassport(input),studies=input.view?.studies;
 const base={contractVersion:'terminal-study-explanation-v1',intent:'terminal.indicator-method',llmUsed:false,series,
  study:null,value:null,windowSum:null,window:[],trace:[],history:null,unit:'quote-unit',unitLabel:'В единицах котировки инструмента'};
 const unavailable=code=>freeze({...base,state:'unavailable',reasonCode:code,reason:reasons[code]||reasons.unavailable});
 if(series.state!=='ready')return unavailable(series.state);
 if(typeof studyId!=='string'||!Array.isArray(studies)||studies.length>24)return unavailable('study_unavailable');
 const matches=studies.filter(study=>study?.id===studyId),study=matches[0];
 if(matches.length!==1||!['sma','ema','rsi'].includes(study.type)||!supportedTypes.includes(study.type)||study.visible!==true
  ||!Number.isInteger(study.period)||study.period<1||study.period>500)return unavailable('study_unavailable');
 base.study={id:studyId,type:study.type,period:study.period};
 if(study.type==='rsi'){base.unit='index-point';base.unitLabel='Пункты шкалы 0–100';}
 const supplied=input.calculationRows;
 if(!Array.isArray(supplied)||supplied.length>100000)return unavailable('invalid_prices');
 const replayCutoff=series.replay.active?Date.parse(series.replay.cursorTime)/1000:Infinity;
 if(pointTime!==null&&(!Number.isFinite(pointTime)||!Number.isFinite(new Date(pointTime*1000).getTime())||pointTime>replayCutoff))return unavailable('point_unavailable');
 const cutoff=pointTime===null?replayCutoff:pointTime;
 const raw=new Map(input.rows.filter(row=>row.time<=cutoff).map(row=>[row.time,row]));
 if(pointTime!==null&&!raw.has(pointTime))return unavailable('point_unavailable');
 if(pointTime!==null)base.pointSelection={mode:'selected',at:iso(pointTime),laterBarsExcluded:input.rows.filter(row=>row.time>cutoff&&row.time<=replayCutoff).length};
 const rows=[];let previous=-Infinity;
 for(const row of supplied){
  if(!row||!Number.isFinite(row.time)||row.time<=previous)return unavailable('invalid_prices');
  previous=row.time;if(row.time>cutoff)continue;
  if(!raw.has(row.time)||!Number.isFinite(row.close)||row.instrumentUid&&row.instrumentUid!==series.context.instrumentUid
   ||row.interval&&row.interval!==series.context.interval)return unavailable('invalid_prices');
  rows.push({time:row.time,close:row.close});
 }
 if(rows.length!==raw.size)return unavailable('invalid_prices');
 const requiredBars=study.period+(study.type==='rsi'?1:0);
 base.history={loadedBars:rows.length,requiredBars,missingBars:Math.max(0,requiredBars-rows.length),
  firstPlottedAt:rows.length>=requiredBars?iso(rows[requiredBars-1].time):null};
 if(rows.length<requiredBars)return unavailable('insufficient_history');
 const evidenceRow=(row,index)=>({ref:'close-'+index,at:iso(row.time),close:row.close,
  completion:series.method.aggregated?'unknown':raw.get(row.time).isComplete===true?'complete':raw.get(row.time).isComplete===false?'incomplete':'unknown'});
 const point=calculateStudy(rows,study)[0]?.data.at(-1);
 if(!point||point.time!==rows.at(-1).time||!Number.isFinite(point.value))return unavailable('calculation_unavailable');
 let method;
 if(study.type==='sma'){
  const selected=rows.slice(-study.period),windowSum=selected.reduce((sum,row)=>sum+row.close,0);
  if(!Number.isFinite(windowSum))return unavailable('calculation_unavailable');
  const scale=Math.max(1,Math.abs(point.value),...selected.map(row=>Math.abs(row.close)));
  if(Math.abs(point.value-windowSum/study.period)>scale*Number.EPSILON*rows.length*8)return unavailable('calculation_unavailable');
  method={windowSum,window:selected.map(evidenceRow),trace:[]};
 }else{
  method=recursiveTrace(rows,study,evidenceRow);
  // Exact agreement is expected: operations mirror the current chart calculator.
  // Reject even a finite endpoint if any intermediate state was invalid.
  if(!method||method.trace.at(-1).value!==point.value)return unavailable('calculation_unavailable');
  method.alpha=study.type==='ema'?2/(study.period+1):1/study.period;
  method.lastStep=method.trace.at(-1);
 }
 const evidence=study.type==='sma'?method.window:method.trace,completion={complete:0,incomplete:0,unknown:0};
 for(const row of evidence)completion[row.completion]++;
 return freeze({...base,...method,state:'ready',reasonCode:null,reason:null,value:point.value,completion,
  pointAt:iso(rows.at(-1).time),calculationVersion:'chart-'+study.type+'-close-v1',basis:series.method.dividendAdjusted?'dividend-adjusted-close':'close',
  limits:[study.type==='sma'?'Это среднее последних N загруженных цен закрытия.':
   'Расчёт зависит от всей загруженной истории: её начало и добавление более ранних свечей могут изменить результат.',
   'Период задан в свечах выбранного интервала. Торговые пропуски не заполняются.',
   ...(pointTime!==null?['Расчёт заканчивается на выбранной свече; более поздние цены не использованы. Это проверка загруженного сейчас среза, а не подтверждение того, какие данные были известны в прошлом.']:[]),
   'Числа в формулах показаны с округлением. Исходные цены доступны ниже.',
   ...(study.type==='rsi'?['RSI выражен в пунктах шкалы 0–100, а не в процентах доходности.']:[]),
   ...(completion.incomplete?['В расчёт входят незавершённые свечи: их цены и индикатор могут измениться.']:[]),
   ...(completion.unknown?['Завершённость части свечей не подтверждена.']:[]),
   ...(series.method.dividendAdjusted?['Использованы цены с текущей поправкой на дивиденды. Её доступность в прошлом не подтверждена.']:[]),
   ...(series.replay.active?['Свечи после курсора исключены. Загруженный сейчас архив не доказывает знание этих данных в прошлом.']:[]),
   'Это описание расчёта, не рекомендация или прогноз. Актуальность рынка и полнота истории этим расчётом не подтверждаются.']});
}
