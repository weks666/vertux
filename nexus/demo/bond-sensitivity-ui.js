import {prepareBondSensitivity,BOND_SENSITIVITY_LIMITS,BOND_SENSITIVITY_SOURCES,sensitivityNumber,sensitivityPercent,sensitivityMoney} from './bond-sensitivity-model.js';
const esc=value=>String(value??'').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decimal=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value).replace('-','−');
const signed=value=>(value>0?'+':'')+decimal(value);
export function mountBondSensitivity(host,response,selection,{bp=BOND_SENSITIVITY_LIMITS.defaultBp,onChange=()=>{}}={}){
 const model=prepareBondSensitivity(response,selection);
 if(model.state!=='ready'){host.innerHTML='<p class="bond-yield-note">'+esc(model.reason)+'</p>';return;}
 host.innerHTML='<details data-bond-sensitivity><summary data-by="sensitivity-summary">Как цена реагирует на доходность</summary>'
  +'<p>Условный сценарий на '+esc(model.valuationDate)+' UTC, на одну облигацию. Меняется собственная эффективная годовая YTM; даты, выплаты и НКД зафиксированы на дату исходной цены.</p>'
  +'<dl><div><dt>Модифицированная дюрация</dt><dd data-bs="duration">'+esc(sensitivityNumber(model.modifiedDurationYears,{unit:'лет'}))+'</dd></div><div><dt>Выпуклость к годовой YTM</dt><dd data-bs="convexity">'+esc(sensitivityNumber(model.convexityYearsSquared,{unit:'лет²'}))+'</dd></div></dl>'
  +'<p class="bond-yield-note">Дюрация оценивает линейный эффект небольшого сдвига. Выпуклость добавляет поправку на кривизну; полный пересчёт ниже использует все те же выплаты.</p>'
  +'<label class="bond-sensitivity-control"><span>Сдвиг YTM · 100 б.п. = 1 процентный пункт</span><input type="range" min="-200" max="200" step="1" value="'+bp+'" data-by="shock" aria-label="Сдвиг YTM, в базисных пунктах"><output data-bs="shift"></output></label><button type="button" class="button secondary" data-by="shock-reset">Без сдвига</button>'
  +'<p data-bs="rate"></p><div class="bond-sensitivity-result" role="status" aria-live="polite" aria-atomic="true" data-bs="result"></div>'
  +'<dl class="bond-sensitivity-estimates"><div><dt>Линейная оценка по дюрации</dt><dd data-bs="linear"></dd></div><div><dt>С поправкой на выпуклость</dt><dd data-bs="quadratic"></dd></div></dl>'
  +'<figure class="bond-sensitivity-plot"><figcaption>Изменение цены с НКД при пересчёте выплат</figcaption><div class="bond-sensitivity-y"><span data-bs="upper"></span><span data-bs="lower"></span></div><svg viewBox="0 0 500 220" role="img" data-bs="plot" aria-label="Зависимость изменения цены от сдвига YTM"></svg><div class="bond-sensitivity-axis"><span>−200 б.п.</span><span>0</span><span>+200 б.п.</span></div><p class="bond-yield-note" data-bs="plot-note"></p></figure>'
  +'<details><summary data-by="sensitivity-method">Формулы и ограничения сценария</summary><p>При t = дни / 365 и r = годовая YTM цена P(r) = Σ CF / (1 + r)<sup>t</sup>. Веса выплат w равны их приведённым суммам, делённым на P(r). Дюрация D = Σ(w × t) / (1 + r); выпуклость C = Σ(w × t × (t + 1)) / (1 + r)².</p>'
  +'<p>Оценки изменения цены: −D × Δr и −D × Δr + ½ × C × Δr². Для полного пересчёта исходная цена с НКД умножается на P(r + Δr) / P(r). Поэтому нулевой сдвиг сохраняет исходную цену. Показанные числа приблизительны; отрицательное изменение означает снижение цены.</p>'
  +'<p>Модель условно предполагает получение всех выплат. Это чувствительность к YTM этой бумаги, а не к ключевой ставке или сдвигу рыночной кривой. Право на купон, дефолт, оферты, налоги, комиссии, FX и реинвестирование не моделируются. Стоимость позиции и риск портфеля не рассчитаны.</p>'
  +'<p><a href="'+BOND_SENSITIVITY_SOURCES.duration+'" target="_blank" rel="noopener noreferrer">Определение дюрации</a> · <a href="'+BOND_SENSITIVITY_SOURCES.convexity+'" target="_blank" rel="noopener noreferrer">Определение выпуклости</a></p></details></details>';
 const get=name=>host.querySelector('[data-bs="'+name+'"]'),input=host.querySelector('[data-by="shock"]');
 const points=Array.from({length:9},(_,i)=>({bp:-200+i*50,result:model.scenario(-200+i*50)}));
 function draw(current){
  const good=points.filter(p=>p.result.state==='ready'),values=[0,...good.map(p=>p.result.relativeChange),...(current.state==='ready'?[current.relativeChange]:[])],min=Math.min(...values),max=Math.max(...values),range=max-min;
  const svg=get('plot');
  if(good.length<2||!Number.isFinite(range)||range<=0){svg.innerHTML='';svg.hidden=true;get('upper').textContent='';get('lower').textContent='';get('plot-note').textContent='Для графика недостаточно допустимых значений.';return;}
  svg.hidden=false;const x=v=>16+(v+200)/400*468,y=v=>16+(max-v)/range*188;
  let path='',connected=false;for(const p of points){if(p.result.state!=='ready'){connected=false;continue;}path+=(connected?'L':'M')+x(p.bp).toFixed(3)+' '+y(p.result.relativeChange).toFixed(3)+' ';connected=true;}
  svg.innerHTML='<path class="bond-sensitivity-zero" d="M16 '+y(0).toFixed(3)+' H484"/><path class="bond-sensitivity-curve" d="'+path+'"/>'+(current.state==='ready'?'<circle class="bond-sensitivity-point" cx="'+x(current.bp).toFixed(3)+'" cy="'+y(current.relativeChange).toFixed(3)+'" r="5"/>':'');
  get('upper').textContent='Макс. '+sensitivityPercent(max);get('lower').textContent='Мин. '+sensitivityPercent(min);
  get('plot-note').textContent='Кривая: девять сдвигов от −200 до +200 б.п. Точка — выбранный сценарий.'+(good.length<points.length?' Недопустимые сдвиги пропущены.':'');
 }
 function update(value){
  const current=model.scenario(value);input.value=String(value);get('shift').textContent=signed(value)+' б.п. · '+signed(value/100)+' п.п.';input.setAttribute('aria-valuetext',signed(value)+' базисных пунктов; '+signed(value/100)+' процентных пункта');
  get('rate').textContent='Исходная YTM: '+sensitivityNumber(model.rate*100,{unit:'% в год'})+(current.state==='ready'?'. После сдвига: '+sensitivityNumber(current.shiftedRate*100,{unit:'% в год'}):'.');
  host.dataset.sensitivityState=current.state;
  if(current.state!=='ready'){get('result').textContent=current.reason;get('linear').textContent='Не рассчитано';get('quadratic').textContent='Не рассчитано';}
  else{
   get('result').innerHTML='<span>Сценарная цена с НКД</span><strong data-bs="price">'+esc(sensitivityMoney(current.dirtyPrice,model.currency))+'</strong><span data-bs="change">Изменение: '+esc(sensitivityMoney(current.moneyChange,model.currency,true))+' · '+esc(sensitivityPercent(current.relativeChange))+'</span><span>Полный пересчёт выплат; исходная цена '+esc(sensitivityMoney(model.dirtyPrice,model.currency))+'.</span>';
   get('linear').textContent=sensitivityPercent(current.linearChange);get('quadratic').textContent=sensitivityPercent(current.quadraticChange);
  }
  draw(current);
 }
 input.addEventListener('input',()=>{const value=Number(input.value);update(value);onChange(value);});host.querySelector('[data-by="shock-reset"]').addEventListener('click',()=>{update(0);onChange(0);});update(bp);
}
