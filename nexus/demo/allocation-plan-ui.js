import { ALLOCATION_CLASSES, allocationHash, allocationPercentInput, allocationFractionText, parseAllocationDraft, validateAllocationQuery, validateAllocationResponse } from './allocation-plan-contract.js';
import { decimalNanos } from './number-format.js';
const PATH='/api/allocation-plan';
const esc=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const time=value=>value?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})+' мск':'Нет данных';
const blank=()=>Object.fromEntries(ALLOCATION_CLASSES.map(([key])=>[key,'']));
const messages={ALLOCATION_PLAN_CONFLICT:'План изменился в другой вкладке. Перечитайте сохранённый план и проверьте свои доли перед сохранением.',ALLOCATION_PLAN_SCOPE:'Счёт или подключение изменились. Загрузите раздел заново.',ALLOCATION_PLAN_CORRUPT:'Не удалось проверить сохранённый план. Данные не изменены.',ALLOCATION_PLAN_LIMIT:'Достигнут предел локальных планов.',ALLOCATION_PLAN_CLOCK:'Не удалось подтвердить время сохранения.'};
export function createAllocationPlanUi({host,request,canUseContext=()=>true}) {
  let context=null,signature='',active=false,phase='idle',data=null,draft=blank(),dirty=false,sequence=0,controller=null,message='',confirmClear=false,denied=false,disposed=false,preview=false;
  const allowed=()=>{try{return canUseContext()===true;}catch{return false;}};
  const busy=()=>['reading','saving','clearing'].includes(phase);
  const canWrite=()=>Boolean(context&&data&&!busy()&&!denied&&allowed()&&phase==='ready');
  function hasDraftChanges(){const parsed=parseAllocationDraft(draft).targets;return data?.targets?!parsed||ALLOCATION_CLASSES.some(([key])=>parsed[key]!==data.targets[key]):Object.values(draft).some(value=>value.trim()!=='');}
  function focusVisible(target){
    if(!target)return;const bar=document.querySelector('.topbar'),top=bar?.getBoundingClientRect().bottom||0;
    target.style.scrollMarginTop=Math.ceil(top+12)+'px';target.focus({preventScroll:true});
    const rect=target.getBoundingClientRect();if(rect.top<top+4||rect.bottom>innerHeight-4)target.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function restoreFocus(key){if(key)focusVisible(host.querySelector('[data-allocation-action="'+key+'"]')||host.querySelector('[data-allocation-heading]'));}
  function fieldStatus(){
    if(!host)return;const parsed=parseAllocationDraft(draft),sum=host.querySelector('[data-allocation-sum]');
    if(sum)sum.textContent=parsed.invalid.length?'Заполните все четыре доли от 0 до 100 %, не больше двух знаков после запятой.':'Сумма: '+(parsed.total/100).toLocaleString('ru-RU',{maximumFractionDigits:2})+' %'+(parsed.total===10000?' — можно сохранить.':'. Доли должны давать 100 %.');
    const saved=host.querySelector('[data-allocation-dirty]');if(saved)saved.textContent=dirty?'В полях есть несохранённые изменения. Сравнение ниже использует сохранённый план.':'';
    for(const input of host.querySelectorAll('[data-allocation-target]')){const invalid=dirty&&parsed.invalid.includes(input.dataset.allocationTarget);input.setAttribute('aria-invalid',String(invalid));input.readOnly=busy()||!allowed()||denied;}
    const button=host.querySelector('[data-allocation-action="save"]');if(button)button.setAttribute('aria-disabled',String(!canWrite()||!parsed.targets));
  }
  function comparisonMarkup(){
    if(!data)return '';const observation=data.observation;
    const money=value=>value===null?'Нет данных':decimalNanos(value,{digits:9})+' ₽';
    return `<section class="allocation-comparison" aria-label="Отклонение от сохранённого плана"><h4>Сохранённый план и наблюдаемые доли</h4><p>${data.targets?'План сохранён: '+esc(time(data.updatedAt))+'.':'Целевые доли ещё не сохранены.'} Сравнивается текущий личный план со снимком на указанную дату; намерения пользователя в прошлом не восстанавливаются.</p><p data-allocation-observed>Наблюдение: ${esc(time(observation.observedAt))}. ${observation.observedBeforeRequestedStart?'Снимок предшествует началу выбранного периода. ':''}Время состояния у брокера не подтверждено.</p>
      ${observation.reason?'<p class="allocation-note">'+esc(observation.reason)+'</p>':''}
      <div class="allocation-rows">${ALLOCATION_CLASSES.map(([key,label],index)=>{const row=data.comparison[index],source=observation.classes[index];
        const width=row.actual?Number(BigInt(row.actual.numerator)*100n/BigInt(row.actual.denominator))/100:null;
        return `<article class="allocation-row" data-allocation-row="${key}"><h5>${esc(label)}</h5><dl><div><dt>Наблюдаемая доля</dt><dd data-allocation-actual>${esc(allocationFractionText(row.actual))}</dd></div><div><dt>Целевая доля</dt><dd data-allocation-saved>${row.targetBasisPoints===null?'Не задана':esc(allocationPercentInput(row.targetBasisPoints))+' %'}</dd></div><div><dt>Отклонение</dt><dd data-allocation-deviation>${esc(allocationFractionText(row.deviation,{signed:true,unit:'п. п.'}))}</dd></div></dl>${width===null?'':'<div class="allocation-track" aria-hidden="true"><span style="width:'+width+'%"></span></div>'}${source.reason?'<p>'+esc(source.reason)+'</p>':''}<p class="allocation-amount">Сохранённая сумма: ${esc(money(source.amountNanos))}</p></article>`;
      }).join('')}</div><dl class="allocation-totals"><div><dt>Стоимость портфеля</dt><dd>${esc(money(observation.navNanos))}</dd></div><div><dt>Нераспределённый остаток</dt><dd data-allocation-remainder>${esc(money(observation.unallocatedNAVNanos))}</dd></div></dl><p class="allocation-note">Полнота структуры не подтверждена, даже при нулевом остатке. Остаток — разность стоимости портфеля и известных показанных сумм; он не определяет денежный остаток или стоимость неизвестных классов.</p></section>`;
  }
  function render(focused=null){
    if(!host)return;const methodOpen=host.querySelector('[data-allocation-method]')?.open===true;
    host.dataset.state=phase;host.setAttribute('aria-busy',String(busy()));
    const control=(key,label,disabled=false)=>'<button type="button" class="button" data-allocation-action="'+key+'" aria-disabled="'+disabled+'">'+label+'</button>';
    host.innerHTML=`<div class="allocation-plan-body"><h3 data-allocation-heading tabindex="-1">План структуры</h3><p>Задайте собственные целевые доли для одного счёта. Отклонение показывает разницу с сохранённой оценкой брокера в процентных пунктах.</p>${context?'<p class="allocation-context">'+esc(context.label)+' · снимок не позднее '+esc(time(context.query.to))+'.</p>':'<p class="allocation-note">'+(preview?'Личный план доступен в локальном приложении. В этом демонстрационном просмотре он не сохраняется.':'Выберите один счёт, чтобы открыть его личный план.')+'</p>'}<p class="allocation-status" role="status" aria-live="polite">${esc(message|| (phase==='reading'?'Читаем сохранённый план…':phase==='saving'?'Сохраняем целевые доли…':phase==='clearing'?'Удаляем целевые доли…':''))}</p>
      ${context&&!denied?'<div class="allocation-controls">'+control('read','Перечитать сохранённый план',busy()||!allowed())+'</div><form data-allocation-form><fieldset><legend>Ваши целевые доли, %</legend><div class="allocation-fields">'+ALLOCATION_CLASSES.map(([key,label])=>'<label for="allocation-target-'+key+'">'+esc(label)+'<input id="allocation-target-'+key+'" name="'+key+'" type="text" inputmode="decimal" autocomplete="off" maxlength="7" data-allocation-target="'+key+'" aria-describedby="allocation-plan-sum" value="'+esc(draft[key])+'"></label>').join('')+'</div><p id="allocation-plan-sum" data-allocation-sum></p><p class="allocation-note" data-allocation-dirty></p><div class="allocation-controls"><button type="submit" class="button" data-allocation-action="save" aria-disabled="true">Сохранить доли</button>'+control('clear','Удалить план',!canWrite()||!data?.targets)+'</div></fieldset></form>':''}
      ${confirmClear?'<div class="allocation-confirm"><p>Удалить целевые доли этого счёта на этом устройстве?</p><div class="allocation-controls">'+control('confirm-clear','Удалить целевые доли',busy()||!allowed())+control('cancel-clear','Отмена',busy())+'</div></div>':''}${comparisonMarkup()}
      <details data-allocation-method ${methodOpen?'open':''}><summary>Как устроено сравнение</summary><p>Доля класса = его сохранённая сумма / стоимость всего портфеля × 100 %. Отклонение = наблюдаемая доля − целевая доля. +5 п. п. означает превышение цели на пять процентных пунктов, −5 п. п. — меньшую долю.</p><p>Знаменатель — одна и та же подтверждённая стоимость портфеля в RUB. Известные классы не нормализуются на собственный подытог. Пропуски остаются неизвестными; отрицательные суммы, неположительная стоимость или превышение её суммой классов блокируют сравнение.</p><p>Валютные активы — сумма в оценке брокера, а не свободные деньги. Фьючерсы, опционы, структурные продукты и цифровые финансовые активы не входят в этот профиль. Здесь нет раскрытия состава фондов, обязательств, эмитентов или экономического валютного риска.</p><p>Доли отображаются до двух знаков после запятой; ≈ означает усечение. Ненулевая величина меньше 0,01 показана явно. Расчёт использует точные исходные суммы до отображения.</p><p>План хранится локально для пользователя и счёта. Это ваши проценты, а не рекомендуемое распределение, оценка доходности или команда на сделку. Открытие и сохранение плана не запрашивают брокера.</p></details></div>`;
    fieldStatus();restoreFocus(focused);
  }
  function cancel(){sequence++;controller?.abort();controller=null;}
  function invalidate({eraseDraft=false,forbidden=false}={}){
    cancel();data=null;confirmClear=false;phase=forbidden?'forbidden':'idle';denied=forbidden;message=forbidden?'Доступ изменился. План скрыт; загрузите раздел заново.':'';
    if(eraseDraft||forbidden){draft=blank();dirty=false;}render();
  }
  async function perform(action){
    if(disposed||!active||!context||denied||busy()||!allowed())return;
    const parsed=parseAllocationDraft(draft);if(action!=='read'&&(!canWrite()||action==='save'&&!parsed.targets))return;
    const selected=context,id=++sequence;controller?.abort();const current=new AbortController();controller=current;
    const previous=data,originFocus=host?.contains(document.activeElement)?document.activeElement.dataset.allocationAction:null;phase=action==='read'?'reading':action==='save'?'saving':'clearing';message='';render(originFocus);
    try{
      const body=action==='read'?null:{...selected.query,contextKey:previous.contextKey,expectedRevision:previous.revision,...(action==='save'?{targets:parsed.targets}:{})};
      const result=await request(action==='read'?PATH+'?'+new URLSearchParams(selected.query):PATH,{method:action==='read'?'GET':action==='save'?'POST':'DELETE',signal:current.signal,...(body?{body:JSON.stringify(body)}:{})});
      if(id!==sequence||selected!==context||disposed)return;if(!allowed()){invalidate();return;}
      if(!validateAllocationResponse(result,selected.query)||result.contextKey!==selected.contextKey)throw Object.assign(Error('Invalid allocation response'),{code:'ALLOCATION_PLAN_INVALID_RESPONSE'});
      if(action!=='read'&&(result.scopeKey!==previous.scopeKey||result.contextKey!==previous.contextKey||result.revision<previous.revision))throw Object.assign(Error('Allocation context changed'),{code:'ALLOCATION_PLAN_SCOPE'});
      data=result;phase='ready';confirmClear=false;
      if(action!=='read'||!dirty){draft=Object.fromEntries(ALLOCATION_CLASSES.map(([key])=>[key,result.targets?allocationPercentInput(result.targets[key]):'']));dirty=false;}else dirty=hasDraftChanges();
      message=action==='save'?'Целевые доли сохранены на этом устройстве.':action==='clear'?'План удалён. Можно задать новые целевые доли.':dirty?'Сохранённый план перечитан. Ваши несохранённые доли остались в полях; сравнение ниже использует сохранённые значения.':'';
    }catch(error){
      if(id!==sequence||current.signal.aborted||disposed)return;
      confirmClear=false;const forbidden=[401,403].includes(error?.status)||error?.code==='ALLOCATION_PLAN_SCOPE';
      if(forbidden){invalidate({forbidden:true});return;}
      data=action==='read'||error?.status===409||error?.code==='ALLOCATION_PLAN_INVALID_RESPONSE'?null:previous;
      phase='error';message=messages[error?.code]||(action==='read'?'Не удалось прочитать план. Повторите чтение.':'Результат сохранения не подтверждён. Доли в полях сохранены; перечитайте план перед новым действием.');
    }
    if(id!==sequence||disposed)return;controller=null;const focused=host?.contains(document.activeElement)?document.activeElement.dataset.allocationAction:null;
    render(focused==='confirm-clear'?'read':focused);
  }
  host?.addEventListener('input',event=>{const key=event.target.dataset.allocationTarget;if(!ALLOCATION_CLASSES.some(([value])=>value===key))return;draft[key]=event.target.value;dirty=hasDraftChanges();fieldStatus();});
  host?.addEventListener('submit',event=>{if(!event.target.matches('[data-allocation-form]'))return;event.preventDefault();void perform('save');});
  host?.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-allocation-action]');if(!button||button.getAttribute('aria-disabled')==='true'||busy())return;
    const action=button.dataset.allocationAction;
    if(action==='save')return;
    if(action==='clear'){confirmClear=true;render('confirm-clear');}else if(action==='cancel-clear'){confirmClear=false;render('clear');}else if(action==='confirm-clear')void perform('clear');else if(action==='read')void perform('read');
  });
  host?.addEventListener('focusin',event=>{if(event.target.matches?.('input,button,summary')){const rect=event.target.getBoundingClientRect(),top=document.querySelector('.topbar')?.getBoundingClientRect().bottom||0;if(rect.top<top+4||rect.bottom>innerHeight-4)focusVisible(event.target);}});
  host?.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(confirmClear){confirmClear=false;render('clear');event.preventDefault();}else{const details=event.target.closest('details[open]');if(details){details.open=false;details.querySelector('summary')?.focus();event.preventDefault();}}});
  return {
    setActive(value){const changed=active!==Boolean(value);active=Boolean(value);if(!active){if(busy())invalidate();return;}if(context&&phase==='idle'&&allowed())void perform('read');else if(changed)render();},
    contextChanged(){invalidate({forbidden:denied});},getAccessToken(){return sequence;},rejectAccess(token){if(token===undefined||token===sequence)invalidate({forbidden:true});},
    dispose(){disposed=true;cancel();},
    update(next){
      const portfolios=next?.clientProduct?.portfolios||[],period=next?.selectedPeriod;
      preview=next?.preview?.localReview===true||next?.preview?.static===true;
      const query={portfolioId:portfolios[0]?.id,accountKey:portfolios[0]?.preferenceKey,from:period?.from,to:period?.to};
      const descriptor=next?.allocationPlanContext?.accounts?.find(row=>row.portfolioId===query.portfolioId);
      const available=next?.capabilities?.allocationPlan===true&&portfolios.length===1&&!preview&&validateAllocationQuery(query)&&allocationHash(descriptor?.contextKey);
      const key=JSON.stringify([available,preview,next?.identity?.preferenceScope,next?.savedResearch?.ownerScope,query,descriptor?.contextKey,next?.priceAlerts?.accessRevision]);
      if(signature===key)return;signature=key;context=available?{query,contextKey:descriptor.contextKey,label:portfolios[0]?.label||'Выбранный счёт'}:null;
      invalidate({eraseDraft:true});if(active&&context&&allowed())void perform('read');
    }
  };
}
