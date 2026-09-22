(() => {
  'use strict';
  const node=document.getElementById('nexus-pricing-data');
  if(!node)return;
  let data;
  try{data=JSON.parse(node.textContent);}catch{return;}
  const controls=[...document.querySelectorAll('[data-subscription-term]')];
  const en=()=>document.documentElement.lang==='en';
  const rub=value=>Math.round(value).toLocaleString(en()?'en-US':'ru-RU')+' ₽';
  let selected=data.terms[0];
  function paint(announce=false){
    controls.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.subscriptionTerm===selected.id)));
    for(const plan of data.plans){
      const card=document.querySelector('[data-tier-card="'+plan.id+'"]');
      if(!card)continue;
      const total=Math.round(plan.monthlyRub*selected.factor);
      const price=card.querySelector('[data-tier-total] strong span');
      if(plan.id==='free'){
        price.dataset.priceRub='0';price.textContent=en()?'$0':rub(0);
        card.querySelector('[data-term-label]').textContent=en()?'Free access':'Бесплатный режим';
        card.querySelector('[data-tier-equivalent]').textContent=en()?'No time limit':'Без ограничения по времени';
        continue;
      }
      price.dataset.priceRub=String(total);
      price.textContent=en()?'$'+Math.round(total/84.1975).toLocaleString('en-US'):rub(total);
      card.querySelector('[data-term-label]').textContent=en()?'for '+selected.en:'за '+selected.label;
      card.querySelector('[data-tier-equivalent]').textContent=en()
        ?'Charged in RUB: '+rub(total)+(selected.months>1?' · '+rub(total/selected.months)+'/month':'')
        :selected.months>1?rub(total/selected.months)+' / месяц · оплата за весь срок':'Без автоматических списаний';
    }
    if(announce){
      document.querySelector('[data-pricing-announcement]').textContent=(en()?'Selected term: ':'Выбран срок: ')+(en()?selected.en:selected.label)+'. '+data.plans.map(p=>(en()?p.en:p.name)+' — '+rub(Math.round(p.monthlyRub*selected.factor))).join('; ')+'.';
    }
  }
  controls.forEach((button,index)=>{
    button.disabled=false;
    button.addEventListener('click',()=>{selected=data.terms.find(t=>t.id===button.dataset.subscriptionTerm)||data.terms[0];paint(true);});
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?0:event.key==='End'?controls.length-1:(index+(event.key==='ArrowRight'?1:-1)+controls.length)%controls.length;
      controls[next].focus();controls[next].click();
    });
  });
  document.addEventListener('nexus:language-change',()=>paint(false));
  paint();
})();
