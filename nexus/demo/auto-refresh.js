export function createAutoRefresh({refresh,eligible,onState=()=>{},interval=10000,setTimer=setTimeout,clearTimer=clearTimeout}) {
 let timer=null,running=false,stopped=false,failures=0;
 const schedule=delay=>{if(!stopped){clearTimer(timer);timer=setTimer(()=>void tick(),delay);}};
 async function tick() {
  if(stopped||running)return;
  if(!eligible()){schedule(interval);return;}
  running=true;onState({state:'updating'});
  try {await refresh();failures=0;onState({state:'ready',at:new Date().toISOString()});}
  catch(error){const waiting=['SYNC_ALREADY_RUNNING','SYNC_COOLDOWN'].includes(error.code);if(!waiting)failures++;onState({state:waiting?'waiting':'error',code:error.code,message:error.message});}
  finally{running=false;schedule(Math.min(300000,interval*2**Math.min(failures,3)));}
 }
 return {start(){stopped=false;schedule(1500);},tick,stop(){stopped=true;clearTimer(timer);}};
}
