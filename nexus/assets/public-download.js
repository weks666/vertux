(() => {
  const link=document.getElementById('publicDownload'), status=document.getElementById('publicDownloadStatus');
  if(!link||!status)return;
  const retry=document.getElementById('retryPublicDownload');
  let state='loading';
  function render(){
    const en=document.documentElement.lang==='en';
    const copy={loading:['Проверяем доступность установщика…','Checking installer availability…'],ready:['Установщик доступен. После установки войдите в свой аккаунт.','The installer is ready. Sign in after installation.'],unavailable:['Публичное скачивание готовится. Ваш аккаунт доступен по ссылке ниже.','Public download is being prepared. Your account is available below.'],error:['Не удалось проверить загрузку. Проверьте соединение и повторите попытку.','Could not check download availability. Check your connection and try again.']};
    link.hidden=state!=='ready';status.textContent=copy[state][en?1:0];
    if(retry)retry.hidden=!['unavailable','error'].includes(state);
  }
  async function check(){
    state='loading';render();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try{const response=await fetch('https://nexus.vertux.online/api/desktop/download/status',{credentials:'omit',cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Unavailable status');const result=await response.json();if(result?.ok!==true||typeof result.data?.available!=='boolean')throw new Error('Invalid status');state=result.data.available?'ready':'unavailable';}
    catch{state='error';}finally{clearTimeout(timeout);render();}
  }
  retry?.addEventListener('click',check);
  document.addEventListener('nexus:language-change',render);
  check();
})();
