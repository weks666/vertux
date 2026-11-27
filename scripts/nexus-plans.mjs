import { subscriptionPaymentInfo } from './nexus-product-sections.mjs';
import { participantsSection } from './nexus-participants.mjs';
import { readFile } from 'node:fs/promises';
import { buildLegalDocuments } from './nexus-legal.mjs';

const catalogPath = new URL('../nexus/plans.json', import.meta.url);
export const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
export const priceFor = (plan, term) => Math.round(plan.monthlyRub * term.factor);
const rub = value => value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₽';

export function validateCatalog() {
  if (catalog.currency !== 'RUB') throw new Error('Checkout currency must be RUB');
  if (new Set(catalog.plans.map(p => p.id)).size !== 3) throw new Error('Three distinct paid plans required');
  // 'available' is published only together with the server and application
  // release that really provide the free plan; 'proposal' keeps the preview card.
  if (catalog.freePlan?.id !== 'free' || catalog.freePlan.monthlyRub !== 0 || !['proposal','available'].includes(catalog.freePlan.status)) throw new Error('Free plan must be a zero-price plan, announced or available');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.revisionDate || '') || ![catalog.revision, catalog.privacyRevision, catalog.consentRevision].every(r => typeof r === 'string' && r.includes(catalog.revisionDate))) throw new Error('Offer, privacy and consent revisions must carry the revision date');
  for (const f of catalog.features) if (f.values.length !== catalog.plans.length || !f.freeValue) throw new Error('Feature columns must match the displayed plans');
  for (const t of catalog.terms) {
    if (!Number.isInteger(t.months)||t.months<1||!Number.isFinite(t.factor)||t.factor<=0||t.factor>t.months) throw new Error('Invalid term');
    if (t.discount && Math.abs(t.factor-t.months*(1-t.discount/100))>0.000001) throw new Error('Discount does not match full total');
  }
  for (const p of catalog.plans) {
    if (!Number.isSafeInteger(p.monthlyRub) || (p.id==='free'?p.monthlyRub!==0:p.monthlyRub<=0)) throw new Error('Invalid monthly price');
    for (const t of catalog.terms) if (!Number.isSafeInteger(priceFor(p,t))) throw new Error('Invalid total');
  }
  if (process.argv.includes('--release') && catalog.approval !== 'approved') {
    throw new Error('RELEASE_BLOCKED: owner approval of prices and terms is pending');
  }
  if (catalog.salesEnabled) throw new Error('Website build cannot enable checkout; verify server and provider separately');
}
validateCatalog();

export const freeAvailable = catalog.freePlan.status === 'available';
const ruDate = iso => { const [y,m,d] = iso.split('-').map(Number);
  return d+' '+['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][m-1]+' '+y+' года'; };

export function buildPricing({tr, icon, link, faq}) {
  // Free is never bought: it sits outside the paid offer/checkout catalog. A new
  // account starts on Free; the Pro trial is switched on in the account, once.
  const plans = [catalog.freePlan, ...catalog.plans];
  const features = catalog.features.map(f => ({...f, values:[f.freeValue, ...f.values]}));
  const first = catalog.terms[0];
  const price = (p,t=first) => '<span data-price-rub="'+priceFor(p,t)+'">'+rub(priceFor(p,t))+'</span>';
  const details={one:['1','1'],multiple:['Несколько','Multiple'],three:['До трёх','Up to three'],basic:['Базовая','Basic']};
  const state = (value, compact=false) => value === 'no'
    ? icon('cross')+'<span class="nx-visually-hidden">'+tr('Не включено','Not included')+'</span>'
    : icon('check')+'<span class="'+(compact&&details[value]?'':'nx-visually-hidden')+'">'+(details[value]?tr(...details[value]):tr('В составе тарифа','Part of the plan'))+'</span>';
  const cards = plans.map((p,i) => '<article class="nx-tier-card'+(p.id==='plus'?' nx-annual':'')+'" data-tier-card="'+p.id+'" aria-labelledby="tier-'+p.id+'">'+
    '<div class="nx-tier-title"><h2 id="tier-'+p.id+'">'+icon({free:'person',standard:'cube',plus:'diamond',pro:'crown'}[p.id])+tr(p.name,p.en)+'</h2>'+
    (p.id==='plus'?'<span class="nx-tier-status">'+tr('Выгодный выбор','Best value')+'</span>':'')+'</div>'+
    '<p class="nx-tier-description">'+tr(p.description,p.descriptionEn)+'</p>'+
    '<div class="nx-tier-price" data-tier-total><strong>'+price(p)+'</strong><span data-term-label>'+tr(p.id==='free'?'Бесплатный режим':'за 1 месяц',p.id==='free'?'Free access':'for 1 month')+'</span></div>'+
    '<p class="nx-tier-equivalent" data-tier-equivalent>'+tr(p.id==='free'?'Без ограничения по времени':'Без автоматических списаний',p.id==='free'?'No time limit':'No automatic charges')+'</p>'+
    '<ul class="nx-tier-features">'+features.map(f=>'<li class="is-'+f.values[i]+'">'+state(f.values[i])+'<span>'+tr(f.ru,f.en)+(details[f.values[i]]?'<small>'+tr(...details[f.values[i]])+'</small>':'')+'</span></li>').join('')+'</ul>'+
    (p.id==='free'?(freeAvailable?link('https://nexus.vertux.online/account.html?product=invest&register=1','Начать бесплатно','Start for free','quiet'):link('invest.html#demo','Попробовать демо','Try the demo','quiet')):link('https://nexus.vertux.online/account.html?plan=invest-'+p.id+'&months=1','Оформить подписку','Choose this plan',p.id==='plus'?'primary':'quiet'))+'</article>').join('');
  const comparison = features.map(f=>'<tr><th scope="row">'+tr(f.ru,f.en)+'</th>'+f.values.map(v=>'<td class="is-'+v+'">'+state(v,true)+'</td>').join('')+'</tr>').join('');
  return '<section class="nx-pricing-hero shell"><h1>'+tr('Один Invest.','One Invest.')+'<br><em>'+tr('Для знакомства и для работы.','For exploring and working.')+'</em></h1><p>'+tr('Выберите свой набор инструментов и срок доступа. Полная стоимость — в каждой карточке.','Choose your tools and access term. Each card shows the full price. USD amounts are estimates. You pay in RUB.')+'</p>'+
    '<p class="nx-trial-note">'+(freeAvailable?tr('Бесплатный тариф без срока — сразу после регистрации. 30 дней тарифа Pro включаются кнопкой в кабинете, без привязки карты.','The free plan with no time limit starts right after registration. 30 days of Pro start with one button in your account, no card required.'):tr('30 дней пробного доступа без привязки карты.','A 30-day trial with no card required.'))+'</p>'+
    '<div class="nx-term-controls" role="group" aria-label="Срок подписки" data-nx-aria-en="Subscription term">'+catalog.terms.map((t,i)=>'<button type="button" disabled data-subscription-term="'+t.id+'" aria-pressed="'+(i===0)+'">'+tr(t.label,t.en)+(t.discount?'<small>−'+t.discount+'%</small>':t.months===12&&t.factor<t.months?'<small>'+tr((t.months-t.factor)+' месяца в подарок',(t.months-t.factor)+' months included')+'</small>':'')+'</button>').join('')+'</div><noscript><p>Без JavaScript показана цена за месяц. <a href="offer.html#section-7">Все сроки и суммы — в оферте.</a></p></noscript></section>'+
    '<section class="nx-tier-section shell" aria-label="Тарифы Invest" data-nx-aria-en="Invest plans"><div class="nx-tier-grid">'+cards+'</div><p class="nx-pricing-announcement" role="status" aria-live="polite" data-pricing-announcement></p>'+
    subscriptionPaymentInfo(tr, [
      ['payment.html#section-3', 'Порядок оплаты', 'How to pay'],
      ['offer.html#section-7', 'Стоимость и условия', 'Prices and terms'],
      ['payment.html#section-7', 'Возврат оплаты', 'Refunds'],
      ['offer.html#section-18', 'Продавец и контакты', 'Seller and contacts'],
    ])+'</section>'+
    '<section class="nx-plan-comparison nx-tier-comparison shell"><div><h2>'+tr('Что входит в каждый тариф.','What each plan includes.')+'</h2><p>'+(freeAvailable
      ?tr('Бесплатный — обзор одного счёта, история операций и базовая аналитика. Обычный — подробный учёт, Plus — терминал и исследование инструментов, Pro — исторические данные об участниках рынка.','Free covers one account, transaction history and basic analytics. Standard covers portfolio tracking, Plus adds the terminal and instrument research, and Pro includes historical market participant data.')
      :tr('Бесплатный — базовый обзор одного счёта, готовится к запуску. Обычный — подробный учёт, Plus — терминал и исследование инструментов, Pro — исторические данные об участниках рынка.','Free is being prepared for a basic overview of one account. Standard covers portfolio tracking, Plus adds the terminal and instrument research, and Pro includes historical market participant data.'))+'</p></div><div class="nx-comparison-scroll" role="region" aria-label="Сравнение четырёх тарифов" data-nx-aria-en="Plan comparison" tabindex="0"><table><caption class="nx-visually-hidden">'+tr('Возможности четырёх тарифов','Features across four plans')+'</caption><thead><tr><th scope="col">'+tr('Возможности','Features')+'</th>'+plans.map(p=>'<th scope="col">'+tr(p.name,p.en)+'</th>').join('')+'</tr></thead><tbody>'+comparison+'</tbody></table></div>'+
    '<p class="nx-comparison-note">'+tr('Все тарифы работают с брокерским доступом только для чтения. Исполнение торговых поручений и облачные AI-разборы в подписку не входят.','All plans use read-only broker access. Order execution and cloud AI analysis are not included.')+'</p></section>'+
    participantsSection({tr,link,monthlyUpgrade:catalog.plans.find(p=>p.id==='pro').monthlyRub-catalog.plans.find(p=>p.id==='plus').monthlyRub})+
    '<section class="nx-faq-section shell"><h2>'+tr('Перед оформлением.','Before you subscribe.')+'</h2>'+faq([
      ...(freeAvailable?[
      ['Что входит в бесплатный тариф?','What does the free plan include?','Обзор одного брокерского счёта, история сделок и операций и базовая аналитика за стандартные периоды — на трёх устройствах и без ограничения по времени. Заметки, план и расчёт риска, календарь с напоминаниями, терминал, данные FUTOI и AI относятся к платным тарифам.','An overview of one brokerage account, trade and transaction history and basic analytics for the standard periods — on up to three devices, with no time limit. Notes, plans and risk calculations, the calendar with reminders, the terminal, FUTOI data and AI belong to the paid plans.'],
      ['Как перейти на бесплатный тариф?','How do I get the free plan?','Оформлять его не нужно: новый аккаунт начинает с бесплатного тарифа. Когда пробный доступ или оплаченный срок заканчивается, аккаунт сам возвращается на него: приложение продолжает работать, данные на вашем компьютере сохраняются. Платный тариф можно выбрать в кабинете в любой момент.','There is nothing to order: a new account starts on the free plan. When the trial or a paid term ends, your account returns to it by itself: the application keeps working and the data on your computer stays. You can choose a paid plan in your account at any time.'],
      ]:[]),
      ...(freeAvailable?[]:[['Бесплатный режим уже работает?','Is free access available now?','Пока нет: режим готовится к запуску. Планируется обзор одного счёта, история операций и базовая аналитика на трёх устройствах, без платных данных FUTOI и облачного AI. Сейчас можно открыть демо с вымышленными данными. При первой подтверждённой регистрации предоставляется 30 дней пробного доступа — это отдельное условие.','Not yet: this mode is being prepared for launch. The scope is one account, transaction history and basic analytics on up to three devices, without paid FUTOI data or cloud AI. You can explore the demo with fictional data now. Your first verified registration includes a separate 30-day trial.']]),
      ['Сколько длится пробный доступ?','How long is the trial?','30 дней тарифа Pro без оплаты и привязки карты. Пробный доступ включается кнопкой в личном кабинете, один раз на аккаунт. Бета-доступ может быть назначен отдельно; его фактический срок отображается в кабинете.','30 days of Pro with no payment or card. You start the trial with one button in your account, once per account. Beta access may be assigned separately; its actual expiry is shown in your account.'],
      ['Будут автоматические списания?','Are there automatic charges?','Нет. Вы оплачиваете выбранный срок один раз. Продление оформляется отдельно.','No. You pay once for your selected term. Renewal is a separate order.'],
      ['Как предоставляется доступ?','How is access delivered?','Доступ предоставляется в личном кабинете Nexus: автоматически после подтверждения платежа, при технической задержке — в течение одного рабочего дня. Физическая доставка не нужна.','Access is provided through your Nexus account: automatically after payment confirmation or within one business day in case of a technical delay. No physical delivery is required.'],
      ['Как оформить Plus или Pro?','How do I choose Plus or Pro?','Выберите тариф и срок, войдите или зарегистрируйтесь в Nexus. Кабинет покажет полную сумму, условия и доступность оплаты. Доступ изменится после подтверждения платежа.','Choose a plan and term, then sign in or register with Nexus. Your account shows the full amount, terms and payment availability. Access changes after payment confirmation.'],
      ['Как отказаться и вернуть оплату?','How do I cancel and request a refund?','Напишите на support@vertux.online, укажите почту аккаунта и номер заказа либо дату и сумму оплаты. Если доступ не предоставлен, возвращается вся сумма; после начала периода — стоимость неиспользованной части по оферте.','Write to support@vertux.online with your account email and order number or payment date and amount. Undelivered access receives a full refund; after the period starts, the unused part is refunded under the public offer.'],
      ['Кто продаёт подписку?','Who sells the subscription?','Самозанятый Носырев Степан Константинович, ИНН 781436013120, Санкт-Петербург. Вы приобретаете право использовать программу, а не инвестиционный продукт.','Stepan Nosyrev, a self-employed software provider, INN 781436013120, Saint Petersburg. You purchase software access, not an investment product.']
    ])+'</section>'+
    '<script type="application/json" id="nexus-pricing-data">'+JSON.stringify({...catalog,plans,features}).replace(/</g,'\\u003c')+'</script>';
}

export async function buildOffer() {
  const table = ['| Срок | '+catalog.plans.map(p=>p.name).join(' | ')+' |','| '+Array(catalog.plans.length+1).fill('---').join(' | ')+' |',
    ...catalog.terms.map(t=>'| '+t.label+' | '+catalog.plans.map(p=>rub(priceFor(p,t))).join(' | ')+' |')].join('\n');
  const termRules=catalog.terms.map(t=>t.label+': '+(t.factor===t.months?'без скидки.':t.discount?'скидка '+t.discount+'% от суммы ежемесячной оплаты.':'цена равна '+t.factor+' месячным платежам.')).join(' ');
  // Pastry Workspace prices come from confectionery.json; the same term factors apply.
  const pastry = JSON.parse(await readFile(new URL('../nexus/confectionery.json', import.meta.url), 'utf8'));
  const pastryNames = {base:'Базовый', extended:'Расширенный'};
  const pastryTiers = pastry.tiers.filter(tier => pastryNames[tier.key] && Number.isSafeInteger(tier.monthlyRubReference) && tier.monthlyRubReference > 0);
  if (pastryTiers.length !== 2) throw new Error('Pastry Workspace needs two priced tiers');
  const pastryTable = ['| Срок | '+pastryTiers.map(tier=>pastryNames[tier.key]).join(' | ')+' |','| '+Array(pastryTiers.length+1).fill('---').join(' | ')+' |',
    ...catalog.terms.map(t=>'| '+t.label+' | '+pastryTiers.map(tier=>rub(Math.round(tier.monthlyRubReference*t.factor))).join(' | ')+' |')].join('\n');
  if (!freeAvailable) throw new Error('The legal documents describe the free plan as available');
  // One approval covers the whole package: offer, payment terms, privacy policy and consent.
  await buildLegalDocuments({
    REVISION: catalog.revision, PRIVACY_REVISION: catalog.privacyRevision, CONSENT_REVISION: catalog.consentRevision,
    PRIVACY_DATE: ruDate(catalog.revisionDate), PRICE_TABLE: table, PASTRY_TABLE: pastryTable, TERM_RULES: termRules,
    APPROVAL_NOTE: catalog.approval==='approved'?'Редакция от '+ruDate(catalog.revisionDate)+'.':'Проект редакции для согласования с владельцем. Документ не опубликован и не заменяет действующую редакцию.',
  });
}
