// Local chart transforms use observed OHLC values. No intrabar path is invented.
export const chartTypes=[
 ['candles','Японские свечи','Цена','Открытие, максимум, минимум и закрытие каждого интервала.'],
 ['bars','Бары','Цена','OHLC: слева открытие, справа закрытие.'],
 ['hollow','Пустые свечи','Цена','Полое тело при закрытии выше открытия, заполненное при снижении.'],
 ['volumeCandles','Свечи объёма','Цена','Толщина тела пропорциональна объёму относительно соседних свечей.'],
 ['line','Линия','Линии','Соединяет цены закрытия.'],['lineDots','Линия с точками','Линии','Закрытия отмечены точками.'],
 ['stepLine','Ступенчатая линия','Линии','Цена меняется ступенью на закрытии следующей свечи.'],
 ['area','Область','Линии','Линия закрытий с заливкой снизу.'],['hlc','Область HLC','Линии','Коридор минимум–максимум и линия закрытия.'],
 ['baseline','Базовая линия','Линии','Изменение относительно первой видимой в расчёте цены.'],['columns','Столбцы','Линии','Высота столбца равна цене закрытия.'],
 ['highLow','Мин–Макс','Цена','Только диапазон между минимумом и максимумом свечи.'],
 ['heikinAshi','Хейкен Аши','Преобразованные','Сглаженные OHLC; полученные цены не являются ценами исполнения.'],
 ['renko','Ренко','Преобразованные','Кирпичи фиксированного размера по закрытиям. Разворот — два кирпича; внутрисвечные движения не восстанавливаются.'],
 ['lineBreak','Линейный прорыв','Преобразованные','Новая линия при пробое; разворот требует выхода за последние три линии.'],
 ['kagi','Каги','Преобразованные','Линия продолжается до разворота на заданную величину. Расчёт по закрытиям.'],
 ['pointFigure','Крестики-нолики','Преобразованные','Колонки X при росте, O при падении; разворот — три клетки. Расчёт по закрытиям.'],
 ['range','Range','Преобразованные','Шаг цены фиксирован. Расчёт по закрытиям, без восстановления тиков внутри свечи.'],
 ['footprint','Кластерный объём','Объём','Нужны исторические сделки с ценой, объёмом и направлением. Текущий источник не передаёт такую историю.','Нужна история сделок'],
 ['tpo','Time Price Opportunity','Объём','Нужны внутридневные блоки цены по сессиям. В текущей истории этих данных нет.','Нужна история внутри сессии'],
 ['sessionVolume','Профиль объёма за сессию','Объём','Нужен объём по уровням цены. Общий объём свечи не распределяется по ценам предположительно.','Нужен объём по ценам'],
].map(([id,label,group,help,unavailable])=>({id,label,group,help,unavailable}));
export const validChartTypes=chartTypes.filter(x=>!x.unavailable).map(x=>x.id);
export const baseChartType=t=>['hollow','heikinAshi','renko','lineBreak','range'].includes(t)?'candles':['volumeCandles','highLow','pointFigure'].includes(t)?'bars':['lineDots','stepLine','kagi','hlc'].includes(t)?'line':t;
export function normalizeSeriesOptions(v={}){return {boxSize:Number.isFinite(Number(v.boxSize))&&Number(v.boxSize)>0?Number(v.boxSize):null,reversal:Math.max(1,Math.min(10,Math.round(Number(v.reversal)||3)))};}
export function priceBox(rows,options={}){if(options.boxSize>0)return options.boxSize;const sample=rows.slice(0,Math.min(14,rows.length));return Math.max(1e-8,sample.reduce((s,r)=>s+r.high-r.low,0)/Math.max(1,sample.length)||Math.abs(rows[0]?.close||1)*.01);}
export function transformPrices(rows,type,options={}){
 if(!rows.length)return [];if(type==='heikinAshi'){let prev;return rows.map(r=>{const close=(r.open+r.high+r.low+r.close)/4,open=prev?(prev.open+prev.close)/2:(r.open+r.close)/2;prev={...r,open,high:Math.max(r.high,open,close),low:Math.min(r.low,open,close),close};return prev;});}
 if(!['renko','range','lineBreak','kagi','pointFigure'].includes(type))return rows;
 const box=priceBox(rows,options),out=[],max=12000;let last=rows[0].close,direction=0;
 const push=(r,open,close,time=r.time)=>out.push({...r,time,open,close,high:Math.max(open,close),low:Math.min(open,close),sourceTime:r.time});
 if(type==='lineBreak'){push(rows[0],rows[0].open,last);for(const r of rows.slice(1)){const recent=out.slice(-3),hi=Math.max(...recent.map(x=>x.high)),lo=Math.min(...recent.map(x=>x.low));if((direction>=0&&r.close>last)||(direction<0&&r.close<last)||r.close>hi||r.close<lo){const dir=Math.sign(r.close-last);push(r,last,r.close);last=r.close;direction=dir;}}return out;}
 if(type==='kagi'){let start=last,at=rows[0].time;for(const r of rows.slice(1)){const dir=Math.sign(r.close-last);if(!direction)direction=dir;if(dir===direction){last=r.close;at=r.time;}else if(Math.abs(r.close-last)>=box){push({...r,time:at},start,last);start=last;last=r.close;at=r.time;direction=dir;}}push({...rows.at(-1),time:at},start,last);return out;}
 if(type==='pointFigure'){let start=last,at=rows[0].time;for(const r of rows.slice(1)){const steps=Math.floor(Math.abs(r.close-last)/box+1e-10),dir=Math.sign(r.close-last);if(!steps)continue;if(!direction)direction=dir;if(dir===direction){last+=dir*steps*box;at=r.time;}else if(steps>=(options.reversal||3)){push({...r,time:at},start,last);start=last+dir*box;last+=dir*steps*box;direction=dir;at=r.time;}}push({...rows.at(-1),time:at},start,last);return out;}
 let work=0;for(let i=1;i<rows.length;i++){const r=rows[i],dir=Math.sign(r.close-last),steps=Math.floor(Math.abs(r.close-last)/box+1e-10),turn=type==='renko'&&direction&&direction!==dir;if(steps<(turn?2:1))continue;let count=steps-(turn?1:0);work+=Math.min(count,max);if(work>200000)throw new RangeError('Слишком маленький шаг цены для этой истории. Увеличьте шаг или сократите период.');if(turn)last+=dir*box;const skipped=Math.max(0,count-max);if(skipped){last+=dir*skipped*box;out.length=0;}for(let n=skipped;n<count;n++){const next=last+dir*box,time=rows[i-1].time+(r.time-rows[i-1].time)*(n+1)/(count+1);push(r,last,next,time);last=next;}if(out.length>max)out.splice(0,out.length-max);direction=dir;}
 return out.length?out:[{...rows[0],open:last,high:last,low:last,close:last}];
}
export function seriesIcon(type){const paths={candles:'M6 2v20M3 7h6v10H3zM18 2v20M15 5h6v9h-6z',bars:'M6 2v20M2 8h4M6 16h4M18 2v20M14 5h4M18 13h4',hollow:'M6 2v20M3 7h6v10H3zM18 2v20M15 5h6v9h-6z',volumeCandles:'M5 2v20M2 7h6v10H2zM18 2v20M12 5h10v9H12z',line:'M2 18 7 10l4 5 6-11 5 5',lineDots:'M2 18 7 10l4 5 6-11 5 5M6 10h2M10 15h2M16 4h2',stepLine:'M2 18h6v-7h8V4h6',area:'M2 18 7 10l4 5 6-11 5 5v13H2z',hlc:'M2 8 8 3l7 7 7-6M2 15l6-5 7 7 7-6M2 21l6-4 7 5 7-5',baseline:'M2 12h20M2 18 7 8l5 9 5-13 5 5',columns:'M3 21V12h4v9M10 21V7h4v14M17 21V3h4v18',highLow:'M5 4v14M12 8v12M19 2v13',heikinAshi:'M5 3v18M2 7h6v9H2zM13 2v18M10 6h6v10h-6zM21 1v16M18 4h5v9h-5',renko:'M2 16h6v6H2zM8 10h6v6H8zM14 4h6v6h-6z',lineBreak:'M3 14h5v8H3zM8 8h5v6H8zM13 3h5v5h-5zM18 8h4v12h-4z',kagi:'M3 20V5h7v13h6V2h5v9',pointFigure:'M2 3l6 6M2 9l6-6M2 13l6 6M2 19l6-6M13 4a3 3 0 1 0 6 0 3 3 0 0 0-6 0M13 13a3 3 0 1 0 6 0 3 3 0 0 0-6 0',range:'M2 12h5v7H2zM7 5h5v7H7zM12 12h5v7h-5zM17 5h5v7h-5z'};return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[type]||paths.columns}"/></svg>`;}
