const escape = value => String(value ?? '').replace(/[&<>"']/gu, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const date = value => { const parsed=new Date(value);return value&&!Number.isNaN(parsed.getTime())?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(parsed):'—'; };

/** Shared browser/embedded controls. request uses the existing authenticated adapter. */
export function createProfileSecurity({ root, request, onEmailChanged=async()=>{}, onSessionRevoked=async()=>{} }) {
  const emailHost=root.querySelector('[data-email-settings]');
  const sessionsHost=root.querySelector('[data-session-settings]');
  let profile=null, challenge=null, busy=false, generation=0;
  const dialog=document.createElement('dialog');dialog.className='account-security-dialog';
  dialog.setAttribute('aria-label','Изменение электронной почты');
  dialog.innerHTML='<button type="button" class="security-dialog-close" aria-label="Закрыть">×</button><h2>Изменить почту</h2><form data-email-start><p>Подтвердите текущий пароль, затем введите код, отправленный на новый адрес.</p><label>Новая электронная почта<input name="email" type="email" maxlength="254" autocomplete="email" required></label><label>Текущий пароль<input name="currentPassword" type="password" autocomplete="current-password" required></label><button type="submit" class="button primary">Отправить код</button><small>Если вы входили только через Google, сначала задайте пароль через восстановление доступа.</small></form><form data-email-verify hidden><p data-delivery-hint></p><label>Код из письма<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button type="submit" class="button primary">Подтвердить новую почту</button><small>Остальные сеансы будут завершены.</small></form><p data-security-message role="status" aria-live="polite"></p>';
  (root.nodeType===9?root.body:root).append(dialog);
  const start=dialog.querySelector('[data-email-start]'),verify=dialog.querySelector('[data-email-verify]'),feedback=dialog.querySelector('[data-security-message]');
  dialog.querySelector('.security-dialog-close').addEventListener('click',()=>{if(!busy)dialog.close();});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{challenge=null;start.reset();verify.reset();feedback.textContent='';});
  function setBusy(value){busy=value;dialog.querySelectorAll('button').forEach(button=>button.disabled=value);}
  emailHost?.addEventListener('click',event=>{
    if(!event.target.closest('[data-change-email]')||!profile?.emailChangeAvailable)return;
    start.hidden=false;verify.hidden=true;feedback.textContent='';challenge=null;dialog.showModal();start.elements.email.focus();
  });
  start.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!start.reportValidity())return;setBusy(true);feedback.textContent='';
    try{const result=await request('/api/profile/email/start',{method:'POST',body:{email:start.elements.email.value.trim(),currentPassword:start.elements.currentPassword.value}});if(!result?.challengeId)throw new Error('Не удалось подтвердить отправку кода. Повторите попытку.');challenge=result.challengeId;start.reset();start.hidden=true;verify.hidden=false;dialog.querySelector('[data-delivery-hint]').textContent=result.deliveryHint||'Введите код, отправленный на новый адрес.';verify.elements.code.focus();}
    catch(error){feedback.textContent=error.message;}finally{setBusy(false);}
  });
  verify.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!challenge||!verify.reportValidity())return;setBusy(true);feedback.textContent='';let confirmed=false;
    try{const result=await request('/api/profile/email/verify',{method:'POST',body:{challengeId:challenge,code:verify.elements.code.value.trim()}});if(result?.changed!==true)throw new Error('Смена почты не подтверждена. Повторите попытку.');confirmed=true;profile={...profile,email:result.email,emailVerified:true};dialog.close();await onEmailChanged(result);await load(profile);const notice=emailHost?.querySelector('[data-email-state]');if(notice)notice.textContent='Почта изменена и подтверждена. Остальные сеансы завершены.';emailHost?.querySelector('[data-change-email]')?.focus();}
    catch(error){if(confirmed){emailView(profile);const notice=emailHost?.querySelector('[data-email-state]');if(notice)notice.textContent='Почта изменена. Не удалось обновить профиль — перезагрузите раздел.';}else feedback.textContent=error.message;}finally{setBusy(false);}
  });
  function emailView(value){
    if(!emailHost)return;
    const verified=value?.emailVerified===true;
    emailHost.innerHTML='<p class="settings-copy" data-email-state>'+ (verified?'Электронная почта подтверждена.':'Состояние подтверждения почты пока не получено.')+'</p><button class="button ghost" type="button" data-change-email '+(value?.emailChangeAvailable?'':'disabled')+'>Изменить почту</button>'+(value?.emailChangeAvailable?'':'<p class="settings-copy">Смена почты сейчас недоступна. <a href="mailto:support@vertux.online">Написать в поддержку</a></p>');
  }
  async function sessions(){
    if(!sessionsHost)return;
    const currentGeneration=++generation;
    sessionsHost.setAttribute('aria-busy','true');
    try{const data=await request('/api/profile/sessions');if(currentGeneration!==generation)return;
      if(!Array.isArray(data?.sessions))throw new Error('Не удалось получить сеансы входа.');
      sessionsHost.innerHTML='<div class="profile-session-list">'+data.sessions.map((session,index)=>'<div class="profile-session-row"><div><strong>'+(session.current?'Этот сеанс':'Сеанс '+(index+1))+'</strong><p>Вход '+escape(date(session.createdAt))+' · активность '+escape(date(session.lastSeenAt||session.createdAt))+'</p></div>'+(session.current?'<span class="profile-current-session">Текущий</span>':'<button class="button ghost" type="button" data-revoke-session="'+escape(session.id)+'">Завершить</button>')+'</div>').join('')+'</div><p class="settings-copy">Это сеансы входа в Nexus. Они учитываются отдельно от лимита установленных устройств.</p><p data-session-feedback role="status" aria-live="polite"></p>';
    }catch(error){if(currentGeneration!==generation)return;sessionsHost.innerHTML='<p class="settings-copy">'+escape(error.message)+'</p><button class="button ghost" type="button" data-refresh-sessions>Повторить</button>';}
    finally{if(currentGeneration===generation)sessionsHost.setAttribute('aria-busy','false');}
  }
  sessionsHost?.addEventListener('click',async event=>{
    if(event.target.closest('[data-refresh-sessions]')){await sessions();return;}
    const button=event.target.closest('[data-revoke-session]');if(!button)return;
    if(button.dataset.confirm!=='yes'){button.dataset.confirm='yes';button.textContent='Подтвердить завершение';return;}
    button.disabled=true;const note=sessionsHost.querySelector('[data-session-feedback]');
    try{const result=await request('/api/profile/sessions/revoke',{method:'POST',body:{sessionId:button.dataset.revokeSession}});if(result?.revoked!==true)throw new Error('Завершение сеанса не подтверждено.');if(result.currentSessionRevoked){await onSessionRevoked();return;}await sessions();const notice=sessionsHost.querySelector('[data-session-feedback]');notice.textContent='Сеанс завершён.';notice.setAttribute('tabindex','-1');notice.focus();}
    catch(error){if(note)note.textContent=error.message;button.disabled=false;}
  });
  async function load(value){profile=value;emailView(value);await sessions();}
  return {load,dispose(){generation++;dialog.remove();}};
}
