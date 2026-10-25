import {buildTerminalSeriesPassport} from './terminal-series-passport.js';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const reasons={unavailable:'Контекст дневной серии не подтверждён. Обновите радар.',empty:'В сохранённом ряду нет свечей.',
 insufficient_history:'Нужна хотя бы одна предыдущая дневная свеча для сравнения.',invalid_volume:'Объём в расчётном окне не подтверждён. Неизвестное значение не заменяется нулём.',
 zero_baseline:'Средний объём предыдущих свечей равен нулю. Отношение к нулю не определено.',
 calculation_unavailable:'Отношение объёмов не удалось подтвердить.',mismatch:'Показатель радара не совпал с этим расчётным окном. Обновите радар.'};

/** Explain the existing daily radar ratio from its captured rows. No fetch,
 * model, storage, portfolio linkage, detector or future-return inference. */
export function buildTerminalVolumeExplanation(input){
 let series;
 try{series=buildTerminalSeriesPassport({paneId:'radar',instrument:input?.instrument,interval:'CANDLE_INTERVAL_DAY',
  rows:input?.rows,state:'ready',view:{type:'candles',timezone:'Europe/Moscow'},source:input?.source});}catch{}
 const base={contractVersion:'terminal-volume-explanation-v1',calculationVersion:'radar-relative-volume-20-v1',intent:'terminal.volume-comparison',
  permittedDestinations:['local-ui'],llmUsed:false,provider:null,model:null,usage:null,series:series||null,
  ratio:null,current:null,baseline:[],sum:null,mean:null,sampleSize:0,maximumSamples:20,unit:'source-volume',claimsAllowed:[]};
 const unavailable=code=>freeze({...base,state:'unavailable',reasonCode:code,reason:reasons[code]});
 if(!series)return unavailable('unavailable');
 if(!input.rows.length)return unavailable('empty');
 if(series.state!=='ready')return unavailable('unavailable');
 const selected=input.rows.slice(-21),history=selected.slice(0,-1),last=selected.at(-1);
 if(selected.some(row=>row.volumeKnown===false||typeof row.volume!=='number'||!Number.isFinite(row.volume)||row.volume<0||row.volume>Number.MAX_SAFE_INTEGER))return unavailable('invalid_volume');
 const evidence=(row,ref)=>({ref,at:new Date(row.time*1000).toISOString(),value:row.volume,unit:'source-volume',
  completion:row.isComplete===true?'complete':row.isComplete===false?'incomplete':'unknown'});
 base.current=evidence(last,'volume-current');base.baseline=history.map((row,i)=>evidence(row,'volume-baseline-'+i));base.sampleSize=history.length;
 if(!history.length)return unavailable('insufficient_history');
 const sum=history.reduce((value,row)=>value+row.volume,0),mean=sum/history.length;
 if(!Number.isFinite(sum)||sum>Number.MAX_SAFE_INTEGER)return unavailable('calculation_unavailable');
 base.sum=sum;base.mean=mean;
 if(mean===0)return unavailable('zero_baseline');
 const ratio=last.volume/mean;if(!Number.isFinite(ratio))return unavailable('calculation_unavailable');
 if(Object.hasOwn(input,'expectedRatio')&&input.expectedRatio!==ratio)return unavailable('mismatch');
 const completion={complete:0,incomplete:0,unknown:0};for(const row of [base.current,...base.baseline])completion[row.completion]++;
 return freeze({...base,state:'ready',reasonCode:null,reason:null,ratio,completion,
  claimsAllowed:[{claimId:'relative-volume',relationType:'arithmetic-ratio',factRefs:['volume-current',...base.baseline.map(row=>row.ref)]}],
  limits:['Последняя дневная свеча делится на среднее до 20 предыдущих загруженных дневных свечей. Текущая свеча в среднее не входит.',
   'Объём показан в единицах исходного ряда. Это не денежный оборот и не размер позиции. Разные инструменты по абсолютному объёму здесь не сравниваются.',
   'Пропуски не заполняются. Это доступные свечи, а не обязательно 20 подряд идущих торговых дней.',
   'Радар использует свой последний дневной снимок и не следует за курсором воспроизведения активного графика.',
   'Незавершённая свеча накапливает объём; сравнение с полными днями может измениться. При неизвестной завершённости сопоставимость не подтверждена.',
   'Числа показаны с округлением. Отношение описывает это окно и не доказывает необычность, причину движения или будущую доходность.']});
}
