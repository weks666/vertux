(() => {
  const link=document.getElementById('publicDownload'), status=document.getElementById('publicDownloadStatus');
  let available=false, loaded=false;
  function render(){
    const en=document.documentElement.lang==='en';
    link.hidden=!available;
    status.textContent=available?(en?'The installer is ready. Sign in after installation.':'Установщик доступен. После установки войдите в свой аккаунт.')
      :loaded?(en?'Public download is being prepared. You can open your account now.':'Публичное скачивание готовится. Вы можете открыть личный кабинет.')
      :(en?'Checking installer availability…':'Проверяем доступность установщика…');
  }
  fetch('https://nexus.vertux.online/api/desktop/download/status',{credentials:'omit',cache:'no-store'})
    .then(response=>response.ok?response.json():null).then(result=>{available=result?.ok===true&&result.data?.available===true;})
    .catch(()=>{}).finally(()=>{loaded=true;render();});
  document.addEventListener('nexus:language-change',render);
  render();
})();
