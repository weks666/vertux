const copy={
  ALERT_TELEGRAM_LINK_STALE:'Ссылка устарела или подключение изменилось. Получите новую ссылку.',
  ALERT_TELEGRAM_ALREADY_LINKED:'Этот Telegram уже связан с другим аккаунтом Invest. Сначала отключите прежнюю привязку.',
  ALERT_TELEGRAM_LINK_BUSY:'Ссылка уже создаётся. Подождите несколько секунд.',
  ALERT_NOTIFICATION_UNAVAILABLE:'Доставка в Telegram сейчас недоступна на сервере. Подключение заработает после запуска сервиса уведомлений.',
  ALERT_NATIVE_UNAVAILABLE:'Доставка в Telegram сейчас недоступна на сервере. Подключение заработает после запуска сервиса уведомлений.',
};
function packet(value) {
  if(!value||typeof value!=='object'||!/^[A-Za-z][A-Za-z0-9_]{4,31}$/u.test(value.botUsername||'')
    ||typeof value.connected!=='boolean'||!Number.isSafeInteger(value.revision)||value.revision<0)throw Error('Invalid Telegram state');
  if(value.recipientLabel!==null&&(typeof value.recipientLabel!=='string'||value.recipientLabel.length>65))throw Error('Invalid recipient');
  if(value.pending!==null&&(!value.pending||!['start','confirmation'].includes(value.pending.phase)
    ||!/^[a-f0-9-]{36}$/u.test(value.pending.id)||!Number.isFinite(Date.parse(value.pending.expiresAt))
    ||value.pending.recipientLabel!==null&&(typeof value.pending.recipientLabel!=='string'||value.pending.recipientLabel.length>65)))throw Error('Invalid pending link');
  if(value.url!==undefined) {
    const url=new URL(value.url);
    if(url.origin!=='https://t.me'||url.pathname!=='/'+value.botUsername||url.hash||url.username||url.password
      ||[...url.searchParams.keys()].join(',')!=='start'||!/^iv_[A-Za-z0-9_-]{32}$/u.test(url.searchParams.get('start')||''))throw Error('Invalid Telegram link');
  }
  return value;
}
export function createTelegramConnection({host,request,getAccess,onConnected=()=>{},onAccessRejected=()=>{}}) {
  host.innerHTML='<div><h3>Доставка в Telegram</h3><p data-tg-status role="status">Проверяем подключение…</p><small>Бот @invworknot_bot · Telegram Premium не нужен.</small></div><div class="telegram-connection-actions"><button type="button" class="button" data-tg-link>Подключить Telegram</button><a class="button primary" data-tg-open target="_blank" rel="noopener noreferrer" hidden>Открыть бота</a><button type="button" class="button primary" data-tg-confirm hidden>Подтвердить аккаунт</button><button type="button" class="button" data-tg-disconnect hidden>Отключить Telegram</button><button type="button" class="button" data-tg-retry hidden>Повторить проверку</button></div>';
  const node=name=>host.querySelector('[data-tg-'+name+']');
  const abort=new AbortController();let access=null,state=null,url=null,error=null,busy=false,timer=null,revision=0,disposed=false;
  const current=ticket=>!disposed&&ticket===revision&&access?.enabled&&access.authority?.isCurrent();
  function render() {
    host.hidden=!access?.enabled;
    node('status').textContent=error|| (state?.pending?.phase==='confirmation'
      ?`Подключить ${state.pending.recipientLabel||'этот Telegram-аккаунт'}? Подтвердите, если это вы.`
      :state?.pending? 'Откройте бота и нажмите «Начать». Затем вернитесь сюда для подтверждения.'
        :state?.connected?`Подключён ${state.recipientLabel||'Telegram'}. Ценовые сигналы будут приходить в бот.`
          :busy?'Проверяем подключение…':'Подключите бота, чтобы получать ценовые сигналы при закрытом Workspace.');
    node('link').hidden=Boolean(state?.connected&&!state?.pending);
    node('link').textContent=state?.pending?'Получить новую ссылку':'Подключить Telegram';
    node('open').hidden=!url||state?.pending?.phase!=='start';
    if(url)node('open').href=url;else node('open').removeAttribute('href');
    node('confirm').hidden=state?.pending?.phase!=='confirmation';
    node('disconnect').hidden=!state?.connected;
    node('retry').hidden=!error;
    for(const button of host.querySelectorAll('button'))button.disabled=busy;
    host.setAttribute('aria-busy',String(busy));
  }
  function plan() {
    clearTimeout(timer);timer=null;
    if(!disposed&&state?.pending&&access?.enabled)timer=setTimeout(()=>{if(!document.hidden)void call('');else plan();},3000);
  }
  async function call(action,body={}) {
    const ticket=revision;if(busy||!current(ticket))return;
    busy=true;error=null;render();
    try{
      const response=await request({method:action?'POST':'GET',path:'/api/alerts/telegram'+(action?'/'+action:''),...(action?{body:JSON.stringify(body)}:{})},
        {signal:abort.signal,onAccessRejected});
      if(!current(ticket))return;
      if(response?.status!==200)throw Object.assign(Error('Telegram request failed'),{code:response?.payload?.code});
      const next=packet(response.payload?.data);
      if(state?.pending?.id!==next.pending?.id)url=null;
      state=next;
      if(next.url)url=next.url;else if(!next.pending||next.pending.phase!=='start')url=null;
      if(action==='confirm'||action==='disconnect')onConnected();
    }catch(reason){if(current(ticket))error=copy[reason?.code]||'Не удалось проверить Telegram. Повторите попытку.';}
    finally{if(current(ticket)){busy=false;render();plan();}}
  }
  for(const [name,action]of [['link','link'],['retry',''],['confirm','confirm'],['disconnect','disconnect']])node(name).addEventListener('click',()=>{
    const body=action==='confirm'?{id:state?.pending?.id,revision:state?.revision}:action==='disconnect'?{revision:state?.revision}:{};
    void call(action,body);
  },{signal:abort.signal});
  return Object.freeze({
    update(){const next=getAccess();if(access?.enabled===next.enabled&&access?.authority===next.authority)return;
      revision++;access=next;state=null;url=null;error=null;busy=false;clearTimeout(timer);render();if(next.enabled)void call('');},
    dispose(){disposed=true;revision++;clearTimeout(timer);abort.abort();host.replaceChildren();},
  });
}
