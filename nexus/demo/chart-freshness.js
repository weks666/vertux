const blocked=new Set(['unavailable','stale','reconnecting','resyncing','connecting','paused','partial']);
export function chartFreshness({receivedAt,sourceEventTime,streamState,fixture=false,history=false,replay=false,now=Date.now()}={}){
 const age=value=>{const at=Date.parse(value);return Number.isFinite(at)&&at<=now+1000?Math.max(0,Math.floor((now-at)/1000)):null;};
 const seconds=age(receivedAt),sourceAge=age(sourceEventTime);
 const ago=value=>value<60?`${value} сек. назад`:value<3600?`${Math.floor(value/60)} мин. назад`:`${Math.floor(value/3600)} ч. назад`;
 if(replay)return {state:'history',text:'Воспроизведение истории',seconds,sourceAge};
 if(history)return {state:'history',text:'Исторический период',seconds,sourceAge};
 const live=!fixture&&!blocked.has(streamState)&&streamState==='live'&&seconds!==null&&seconds<=45&&sourceAge!==null&&sourceAge<=45;
 return {state:live?'live':blocked.has(streamState)||seconds>45?'stale':'waiting',seconds,sourceAge,
  text:fixture?`Учебные данные${seconds===null?'':' · получено '+ago(seconds)}`:
   live?`Поток · обновлено ${ago(seconds)}`:
   ['reconnecting','resyncing','connecting'].includes(streamState)?'Восстанавливаем поток':
   streamState==='unavailable'?'Поток недоступен · показаны сохранённые данные':
   sourceAge!==null?`Последняя сделка ${ago(sourceAge)}`:seconds!==null?`Ответ получен ${ago(seconds)} · ожидаем событие рынка`:'Ожидаем данные рынка'};
}
