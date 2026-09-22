(() => {
  'use strict';
  // The local review server may point account links to its isolated loopback fixture.
  const preview=document.querySelector('meta[name="nexus-account-preview"]')?.content;
  if(preview&&['localhost','127.0.0.1'].includes(location.hostname)){
    try{const local=new URL(preview);if(local.protocol==='http:'&&local.hostname==='127.0.0.1'){
      document.querySelectorAll('a[href]').forEach(link=>{const target=new URL(link.href,location.href);if(target.origin==='https://nexus.vertux.online'&&target.pathname==='/account.html')link.href=local.origin+target.pathname+target.search+target.hash;});
    }}catch{/* Invalid preview metadata never changes public routing. */}
  }
  const links=[...document.querySelectorAll('[data-i18n="newnav.login"]')];
  if(!links.length)return;
  let account=null,busy=false;
  function paint(){
    const english=document.documentElement.lang==='en';
    for(const link of links){
      const signed=account?.authenticated===true;
      link.textContent=signed?(account.name||(english?'My account':'Личный кабинет')):account?.authenticated===false?(english?'Log in':'Войти'):(english?'Account':'Кабинет');
      link.classList.toggle('session-authenticated',signed);
      link.dataset.initial=signed?(account.name||'V').slice(0,1).toUpperCase():'';
      link.setAttribute('aria-label',signed?(english?'Open my account':'Открыть личный кабинет'):(english?'Open account sign in':'Открыть вход в кабинет'));
    }
  }
  async function refresh(){
    if(busy||location.hostname!=='vertux.online')return;
    busy=true;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch('https://nexus.vertux.online/api/auth/site-session',{credentials:'include',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)return;
      const payload=await response.json(),data=payload.data;
      if(payload.ok&&data&&typeof data.authenticated==='boolean')account={authenticated:data.authenticated,name:typeof data.name==='string'?data.name.slice(0,80):''};
    }catch{/* Keep the account link usable when the portal cannot be reached. */}
    finally{clearTimeout(timeout);busy=false;paint();}
  }
  document.addEventListener('nexus:language-change',paint);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  window.addEventListener('pageshow',()=>void refresh());
  paint();void refresh();
})();
