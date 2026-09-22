export const drawingGroups = [
 {label:'Линии',icon:'trend',tools:[['trend','Линия тренда'],['ray','Луч'],['extended','Удлинённая линия'],['arrow','Стрелка'],['trendAngle','Угол тренда'],['horizontal','Горизонтальная линия'],['horizontalRay','Горизонтальный луч'],['vertical','Вертикальная линия'],['cross','Перекрестие'],['channel','Параллельный канал']]},
 {label:'Фибоначчи',icon:'fibonacci',tools:[['fibonacci','Коррекция Фибоначчи'],['fibExtension','Расширение Фибоначчи'],['fibChannel','Канал Фибоначчи'],['fibTime','Временные зоны Фибоначчи'],['fibFan','Веер Фибоначчи']]},
 {label:'Фигуры',icon:'rectangle',tools:[['rectangle','Прямоугольник'],['ellipse','Эллипс'],['triangle','Треугольник'],['freehand','Кисть']]},
 {label:'Измерения и текст',icon:'horizontal',tools:[['measure','Цена и время'],['priceRange','Диапазон цен'],['dateRange','Диапазон дат'],['text','Текст']]},
];
export const drawingTypes=drawingGroups.flatMap(group=>group.tools.map(([type])=>type));
export const onePointTools=['horizontal','horizontalRay','vertical','cross','text'];
export const threePointTools=['channel','triangle','fibExtension','fibChannel'];
export function drawingStyle(value={}) {
 return {color:/^#[0-9a-f]{6}$/i.test(value.color)?value.color:'#b9a9ff',
  opacity:Math.max(.05,Math.min(1,Number.isFinite(value.opacity)?value.opacity:1)),
  width:Math.max(1,Math.min(6,Number(value.width)||1.5)),
  fill:Math.max(0,Math.min(1,Number.isFinite(value.fill)?value.fill:.1)),
  dash:['solid','dash','dot'].includes(value.dash)?value.dash:'solid',
  extend:value.extend===true,prices:value.prices!==false,
  levels:(Array.isArray(value.levels)?value.levels:[0,.236,.382,.5,.618,.786,1]).filter(n=>Number.isFinite(n)&&Math.abs(n)<=100).slice(0,24),
  text:typeof value.text==='string'?value.text.slice(0,300):'Текст'};
}
