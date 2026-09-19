(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const english=()=>document.documentElement.lang==='en';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton=$('[data-motion-toggle]');
  let paused=false;
  function tabs(selector,onChange=()=>{}) {
    const items=$$(selector);
    if(!items.length)return null;
    function choose(index,focus=false) {
      items.forEach((button,i)=>{
        const active=i===index;
        button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
        const panel=document.getElementById(button.getAttribute('aria-controls'));
        if(panel)panel.hidden=!active;
        if(active&&focus)button.focus({preventScroll:true});
      });
      onChange(index);
    }
    items.forEach((button,index)=>{
      button.addEventListener('click',()=>choose(index));
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+items.length)%items.length;
        choose(next,true);
      });
    });
    return choose;
  }
  tabs('[data-product-choice]');tabs('[data-setup-step]');
  // Authored sample periods. The embedded app retains its own independent data model.
  const periods={
    month:{rub:67500,percent:6.82,ru:'12 июля',en:'12 July',points:[170,158,160,138,150,108,116,86,98,55,65,31,44,20,27]},
    quarter:{rub:103510,percent:9.02,ru:'12 мая',en:'12 May',points:[179,160,138,149,125,146,100,114,94,59,75,46,36,54,27]},
    year:{rub:240860,percent:23.68,ru:'12 августа 2025',en:'12 August 2025',points:[187,169,178,142,155,131,147,122,138,91,77,97,60,43,27]}
  };
  const previews=$$('[data-portfolio-preview]');
  function paintPreview(root,period,animate=false) {
    const sample=periods[period]||periods.month,locale=english()?'en-US':'ru-RU';root.dataset.period=period;
    $('[data-preview-return]',root).textContent=`+${sample.rub.toLocaleString(locale)} ₽`;
    $('[data-preview-percent]',root).textContent=`+${sample.percent.toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
    $('[data-preview-start]',root).textContent=english()?sample.en:sample.ru;
    $$('[data-preview-period]',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.previewPeriod===period)));
    const path=sample.points.map((y,i)=>`${i?'':'M'}${i*50} ${y}`).join(' ');
    $('.nx-preview-line',root).setAttribute('d',path);$('.nx-preview-area',root).setAttribute('d',`${path}V210H0Z`);
    if(animate&&!reduced.matches&&!paused){const chart=$('.nx-preview-chart',root);chart.classList.remove('nx-chart-changing');requestAnimationFrame(()=>chart.classList.add('nx-chart-changing'));}
  }
  previews.forEach(root=>{
    $$('[data-preview-period]',root).forEach(b=>b.addEventListener('click',()=>paintPreview(root,b.dataset.previewPeriod,true)));
    $('.nx-preview-chart',root).addEventListener('animationend',e=>e.currentTarget.classList.remove('nx-chart-changing'));
  });
  const stages=[
    ['Заявка','Request','Новый запрос принят. Следующий шаг — уточнить задачу.','The request is received. Next, clarify what is needed.'],
    ['В работе','In progress','Команда собирает материалы и готовит решение.','The team gathers inputs and prepares the solution.'],
    ['Проверка','Review','Результат готов к проверке. Комментарии остаются рядом с задачей.','The result is ready for review. Feedback stays with the task.'],
    ['Готово','Done','Этап завершён. Решение и история доступны команде.','The stage is complete. The result and its history stay available.']
  ];
  const workflows=$$('.nx-pv-business');
  function paintWorkflow(root,index){
    root.dataset.stage=String(index);const sample=stages[index],en=english();
    $$('[data-workflow-step]',root).forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.workflowStep)===index)));
    $('[data-workflow-label]',root).textContent=sample[en?1:0];$('[data-workflow-copy]',root).textContent=sample[en?3:2];
  }
  workflows.forEach(root=>$$('[data-workflow-step]',root).forEach(b=>b.addEventListener('click',()=>paintWorkflow(root,Number(b.dataset.workflowStep)))));
  const tour=$('[data-scroll-tour]'),desktopTour=matchMedia('(min-width:1000px) and (min-height:720px)');
  let manualTourY=null,scrollSelection=false,activeTour=0,scrollPending=false,keyboardNavigation=false;
  document.addEventListener('keydown',event=>{if(['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))keyboardNavigation=true;});
  document.addEventListener('pointerdown',()=>{keyboardNavigation=false;});
  const selectTour=tabs('[data-tour-tab]',index=>{activeTour=index;if(!scrollSelection)manualTourY=window.scrollY;});
  function paintTour(){
    scrollPending=false;if(!tour||!selectTour)return;
    const enabled=desktopTour.matches&&!reduced.matches;tour.dataset.enhanced=String(enabled);if(!enabled)return;
    const rect=tour.getBoundingClientRect(),distance=Math.max(1,rect.height-680);
    const progress=Math.min(1,Math.max(0,(120-rect.top)/distance));
    tour.style.setProperty('--tour-progress',Math.max(.04,progress));
    if(manualTourY!==null&&Math.abs(window.scrollY-manualTourY)<100)return;
    manualTourY=null;if(rect.top>180||rect.bottom<200)return;
    const selected=Math.min(2,Math.floor(progress*3));
    // Keep a keyboard user's panel in place until focus leaves the tour.
    if(selected!==activeTour&&!(keyboardNavigation&&tour.contains(document.activeElement))){scrollSelection=true;selectTour(selected);scrollSelection=false;}
  }
  function queueScroll(){if(!scrollPending){scrollPending=true;requestAnimationFrame(paintTour);}}
  if(tour){window.addEventListener('scroll',queueScroll,{passive:true});window.addEventListener('resize',queueScroll,{passive:true});desktopTour.addEventListener('change',queueScroll);reduced.addEventListener('change',queueScroll);paintTour();}
  // Dated display equivalent, never an alternative checkout currency.
  const exchangeRate=84.1975;
  let displayCurrency=english()?'USD':'RUB';const currencySelect=$('[data-currency]');
  function paintPrices(){
    const en=english(),usd=displayCurrency==='USD',locale=en?'en-US':'ru-RU';if(currencySelect)currencySelect.value=displayCurrency;
    $$('[data-price-rub]').forEach(node=>{const rub=Number(node.dataset.priceRub);if(!Number.isFinite(rub))return;const amount=Math.round(usd?rub/exchangeRate:rub).toLocaleString(locale);node.textContent=usd?`≈ $${amount}`:`${Number.isInteger(rub)?'':'≈ '}${amount} ₽`;});
    const note=$('[data-currency-note]');
    if(note){note.hidden=!usd;const anchor=$('a',note);const copy=en?'USD is an approximate equivalent at the Bank of Russia rate of 19 Sep 2026 (₽84.1975 / $1). Checkout is in RUB. ':'USD — приблизительный эквивалент по курсу Банка России на 19.09.2026 (84,1975 ₽ за $1). Оплата в рублях. ';note.replaceChildren(document.createTextNode(copy),anchor);anchor.textContent=en?'Exchange rate source':'Источник курса';}
  }
  currencySelect?.addEventListener('change',()=>{displayCurrency=currencySelect.value==='USD'?'USD':'RUB';paintPrices();});
  function paintMotion(){
    document.body.dataset.motion=paused?'paused':'running';if(!motionButton)return;motionButton.hidden=false;
    motionButton.setAttribute('aria-pressed',String(paused));motionButton.setAttribute('aria-label',english()?(paused?'Resume animations':'Pause animations'):(paused?'Возобновить анимации':'Приостановить анимации'));
    $('span',motionButton).textContent=paused?'▷':'Ⅱ';$('[data-motion-label]',motionButton).textContent=english()?(paused?'Paused':'Motion'):(paused?'Пауза':'Движение');
  }
  motionButton?.addEventListener('click',()=>{paused=!paused;paintMotion();$$('.nx-enter').forEach(node=>node.dataset.visible='true');});
  function repaint(){previews.forEach(root=>paintPreview(root,root.dataset.period||'month'));workflows.forEach(root=>paintWorkflow(root,Number(root.dataset.stage??1)));paintPrices();paintMotion();}
  document.addEventListener('nexus:language-change',()=>{displayCurrency=english()?'USD':'RUB';repaint();});repaint();
  // Large editorial groups appear once. Without JS all content stays visible.
  if('IntersectionObserver' in window&&!reduced.matches){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.dataset.visible='true';observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px 35px 0px'});
    $$('.nx-product-feature,.nx-connection-section,.nx-account-section,.nx-business-steps,.nx-requirements-section').forEach(node=>{if(node.getBoundingClientRect().top>innerHeight){node.classList.add('nx-enter');node.dataset.visible='false';observer.observe(node);}});
  }
})();
