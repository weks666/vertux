export const drawingGroups=[
 {id:'lines',label:'Линии и каналы',icon:'trend',tools:[['trend','Линия тренда'],['ray','Луч'],['extended','Продлённая линия'],['arrow','Стрелка'],['doubleArrow','Двойная стрелка'],['trendAngle','Угол тренда'],['horizontal','Горизонтальная линия'],['horizontalRay','Горизонтальный луч'],['vertical','Вертикальная линия'],['cross','Перекрестие'],['channel','Параллельный канал'],['horizontalChannel','Горизонтальный канал'],['pitchfork','Вилы Эндрюса'],['schiffPitchfork','Вилы Шиффа'],['regression','Регрессионный канал']]},
 {id:'fibonacci',label:'Фибоначчи',icon:'fibonacci',tools:[['fibonacci','Коррекция Фибоначчи'],['fibExtension','Расширение Фибоначчи'],['fibChannel','Канал Фибоначчи'],['fibTime','Временные зоны Фибоначчи'],['fibFan','Веер Фибоначчи'],['fibArcs','Дуги Фибоначчи'],['fibCircles','Окружности Фибоначчи']]},
 {id:'shapes',label:'Фигуры',icon:'rectangle',tools:[['rectangle','Прямоугольник'],['rotatedRectangle','Наклонный прямоугольник'],['parallelogram','Параллелограмм'],['ellipse','Эллипс'],['circle','Окружность'],['triangle','Треугольник'],['arc','Дуга'],['freehand','Кисть'],['highlighter','Маркер']]},
 {id:'measure',label:'Измерения и текст',icon:'horizontal',tools:[['measure','Цена и время'],['priceRange','Диапазон цен'],['dateRange','Диапазон дат'],['text','Текст'],['callout','Выноска'],['priceLabel','Ценовая метка'],['longPosition','Длинная позиция'],['shortPosition','Короткая позиция'],['anchoredVwap','Привязанный VWAP']]},
];
export const drawingTypes=drawingGroups.flatMap(group=>group.tools.map(([type])=>type));
export const onePointTools=['horizontal','horizontalRay','vertical','cross','text','priceLabel','anchoredVwap'];
export const threePointTools=['channel','triangle','fibExtension','fibChannel','pitchfork','schiffPitchfork','longPosition','shortPosition','rotatedRectangle','parallelogram','arc'];
export const fibLevelColors=['#ef5350','#f59e42','#e5bc54','#55b87c','#4a9dd9','#9270db','#9aa9bb'];
export function drawingStyle(value={},type='') {
 value=value&&typeof value==='object'?value:{};
 return {color:/^#[0-9a-f]{6}$/i.test(value.color)?value.color:'#b9a9ff',
  opacity:Math.max(.05,Math.min(1,Number.isFinite(value.opacity)?value.opacity:type==='highlighter'?.35:1)),
  width:Math.max(1,Math.min(12,Number(value.width)||(type==='highlighter'?10:1.5))),
  fill:Math.max(0,Math.min(1,Number.isFinite(value.fill)?value.fill:.1)),
  dash:['solid','dash','dot'].includes(value.dash)?value.dash:'solid',
  extend:value.extend===true,prices:value.prices!==false,multicolor:value.multicolor!==false,
  levelColors:(Array.isArray(value.levelColors)&&value.levelColors.length?value.levelColors:fibLevelColors).slice(0,24).map((c,i)=>/^#[0-9a-f]{6}$/i.test(c)?c:fibLevelColors[i%fibLevelColors.length]),
  levels:(Array.isArray(value.levels)?value.levels:type==='fibTime'?[0,1,2,3,5,8,13,21]:[0,.236,.382,.5,.618,.786,1]).filter(n=>Number.isFinite(n)&&Math.abs(n)<=100).slice(0,24),
  text:typeof value.text==='string'?value.text.slice(0,300):'Текст'};
}
export function drawingIcon(type){
 const paths={trend:'M4 19 20 5',ray:'M3 20 20 4M14 4h6v6',extended:'M2 22 22 2M2 17v5h5M17 2h5v5',arrow:'M4 20 20 4M12 4h8v8',doubleArrow:'M4 20 20 4M12 4h8v8M4 12v8h8',horizontal:'M2 12h20',horizontalRay:'M5 12h17M5 10v4',vertical:'M12 2v20',cross:'M12 2v20M2 12h20',channel:'M3 16 18 4M6 21 21 9',horizontalChannel:'M2 6h20M2 18h20M2 12h20',pitchfork:'M4 21 20 5M9 21 22 8M2 16 14 4M5 10l10 10',rectangle:'M4 5h16v14H4z',rotatedRectangle:'M2 14 16 3l6 7L8 21z',parallelogram:'M8 5h14l-6 14H2z',triangle:'M12 3 22 21H2z',arc:'M3 19Q12 -7 21 19',freehand:'M3 16C5 2 8 23 12 9s5 9 9-4',highlighter:'m5 17 11-13 5 5-12 12H4v-4M2 23h20',text:'M4 4h16M12 4v17M7 21h10',callout:'M3 3h18v13H9l-6 5z',priceLabel:'M2 12 8 5h14v14H8z',measure:'M3 3v18h18M7 17 21 3M14 3h7v7',priceRange:'M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5',dateRange:'M3 12h18M8 7l-5 5 5 5M16 7l5 5-5 5'};
 if(type.startsWith('fib'))return '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="#ef5350" d="M3 4h18"/><path stroke="#e5bc54" d="M3 10h18"/><path stroke="#55b87c" d="M3 15h18"/><path stroke="#4a9dd9" d="M3 20h18"/></svg>';
 if(['circle','ellipse'].includes(type))return `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="${type==='circle'?9:6}"/></svg>`;
 return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[type]||paths[drawingGroups.find(g=>g.tools.some(([t])=>t===type))?.icon]||paths.measure}"/></svg>`;
}
