// Preview controller. The background is authored here, never loaded from an account.
// A production Pro gate must reject protected requests on the server before rendering.
(() => {
  const dialog=document.querySelector('dialog'),$=id=>document.getElementById(id),workspace=document.querySelector('.sample-workspace');
  let step=0,mode='guide',trigger=null;
  const steps=[
    ['Ваш портфель — целиком','Начните с обзора: общая стоимость, результат за период и позиции по всем счетам.',['Счета и позиции','Результат за период'],'overview'],
    ['Поймите свой результат','В аналитике выберите счёт и период. Графики помогут отделить доходность от пополнений и увидеть структуру портфеля.',['Выбор периода','Структура портфеля'],'analytics'],
    ['Держите план под рукой','Сохраняйте идеи и уровни в заметках. Заглядывайте в календарь, чтобы помнить о важных датах.',['Ручной план','События и напоминания'],'tools']
  ];
  function render(){
    $('guide-next').hidden=mode==='pro';$('guide-upgrade').hidden=mode!=='pro';$('guide-availability').hidden=mode!=='pro';$('guide-progress').hidden=mode!=='guide';
    let title,description,highlights;
    if(mode==='guide'){
      [title,description,highlights]=steps[step];workspace.dataset.guideFocus=steps[step][3];
      $('guide-kind').textContent='Знакомство с Workspace';$('guide-progress').textContent=`${step+1} / ${steps.length}`;$('guide-next').textContent=step===steps.length-1?'Начать работу':'Далее';$('guide-later').textContent='Пропустить';$('guide-art-label').textContent='Invest';
    }else if(mode==='update'){
      title='Посмотрите, что нового';description='Пример карточки обновления: краткое описание изменений, которые стоит попробовать после запуска.';highlights=['Коротко об изменениях','Переход к возможностям'];$('guide-kind').textContent='Пример уведомления';$('guide-next').textContent='Посмотреть сейчас';$('guide-later').textContent='Позже';$('guide-art-label').textContent='Update';delete workspace.dataset.guideFocus;
    }else{
      title='Больше возможностей с Pro';description='Инструменты и их графики, повышенные лимиты AI и следующий уровень работы с инвестиционными идеями.';highlights=['Раздел «Инструменты»','Больше запросов AI'];$('guide-kind').textContent='Invest Pro';$('guide-later').textContent='Пока остаться на обычном';$('guide-art-label').textContent='Pro';delete workspace.dataset.guideFocus;
    }
    $('guide-title').textContent=title;$('guide-description').textContent=description;$('guide-highlights').replaceChildren(...highlights.map(text=>{const el=document.createElement('span');el.textContent=text;return el;}));
  }
  function open(kind,button){trigger=button;mode=kind;step=0;if(mode==='pro')$('sample-view-title').textContent='Инструменты · учебный каталог';render();dialog.showModal();$('guide-later').focus();}
  function close(){dialog.close();}
  document.querySelectorAll('[data-preview-card]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.previewCard,button)));
  $('guide-next').addEventListener('click',()=>{if(mode==='guide'&&step<steps.length-1){step++;render();return;}if(mode==='update'){$('sample-view-title').textContent='Что нового в Workspace';$('sample-note').textContent='Место для описания подтверждённых изменений нового выпуска. Сейчас это учебный пример.';}close();});
  $('guide-later').addEventListener('click',close);document.querySelector('[data-card-close]').addEventListener('click',close);
  dialog.addEventListener('close',()=>{delete workspace.dataset.guideFocus;trigger?.focus();});
  document.querySelectorAll('[data-sample-view]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-sample-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));$('sample-view-title').textContent=button.textContent;
  }));
})();
