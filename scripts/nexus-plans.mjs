import { participantsSection } from './nexus-participants.mjs';
import { readFile, writeFile } from 'node:fs/promises';

const catalogPath = new URL('../nexus/plans.json', import.meta.url);
export const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
export const priceFor = (plan, term) => Math.round(plan.monthlyRub * term.factor);
const rub = value => value.toLocaleString('ru-RU').replace(/\u00a0/g, ' ') + ' ₽';

export function validateCatalog() {
  if (catalog.currency !== 'RUB') throw new Error('Checkout currency must be RUB');
  if (new Set(catalog.plans.map(p => p.id)).size !== 4) throw new Error('Four distinct plans required');
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

export function buildPricing({tr, icon, link, faq}) {
  const first = catalog.terms[0];
  const price = (p,t=first) => '<span data-price-rub="'+priceFor(p,t)+'">'+rub(priceFor(p,t))+'</span>';
  const details={one:['1','1'],multiple:['Несколько','Multiple'],three:['До трёх','Up to three'],basic:['Базовая','Basic']};
  const state = (value, compact=false) => value === 'no'
    ? icon('cross')+'<span class="nx-visually-hidden">'+tr('Не включено','Not included')+'</span>'
    : icon('check')+'<span class="'+(compact&&details[value]?'':'nx-visually-hidden')+'">'+(details[value]?tr(...details[value]):tr('В составе тарифа','Part of the plan'))+'</span>';
  const cards = catalog.plans.map((p,i) => '<article class="nx-tier-card'+(p.id==='plus'?' nx-annual':'')+'" data-tier-card="'+p.id+'" aria-labelledby="tier-'+p.id+'">'+
    '<div class="nx-tier-title"><h2 id="tier-'+p.id+'">'+tr(p.name,p.en)+'</h2>'+
    (p.id==='plus'?'<span class="nx-tier-status">'+tr('Выгодный выбор','Best value')+'</span>':'')+'</div>'+
    '<p class="nx-tier-description">'+tr(p.description,p.descriptionEn)+'</p>'+
    '<div class="nx-tier-price" data-tier-total><strong>'+price(p)+'</strong><span data-term-label>'+tr(p.id==='free'?'Бесплатный режим':'за 1 месяц',p.id==='free'?'Free access':'for 1 month')+'</span></div>'+
    '<p class="nx-tier-equivalent" data-tier-equivalent>'+tr(p.id==='free'?'Без ограничения по времени':'Без автоматических списаний',p.id==='free'?'No time limit':'No automatic charges')+'</p>'+
    link('invest.html#demo',p.status==='planned'?'Посмотреть возможности':'Попробовать демо',p.status==='planned'?'Explore features':'Try the demo',p.id==='plus'?'primary':'quiet')+
    '<ul class="nx-tier-features">'+catalog.features.map(f=>'<li class="is-'+f.values[i]+'">'+state(f.values[i])+'<span>'+tr(f.ru,f.en)+(details[f.values[i]]?'<small>'+tr(...details[f.values[i]])+'</small>':'')+'</span></li>').join('')+'</ul></article>').join('');
  const comparison = catalog.features.map(f=>'<tr><th scope="row">'+tr(f.ru,f.en)+'</th>'+f.values.map(v=>'<td class="is-'+v+'">'+state(v,true)+'</td>').join('')+'</tr>').join('');
  return '<section class="nx-pricing-hero shell"><h1>'+tr('Один Invest.','One Invest.')+'<br><em>'+tr('Для знакомства и для работы.','For exploring and working.')+'</em></h1><p>'+tr('Выберите свой набор инструментов и срок доступа. Полная стоимость — в каждой карточке.','Choose your tools and access term. Each card shows the full price.')+'</p>'+
    '<p class="nx-trial-note">'+tr('7 дней пробного доступа без привязки карты.','A 7-day trial with no card required.')+'</p>'+
    '<div class="nx-term-controls" role="group" aria-label="Срок подписки" data-nx-aria-en="Subscription term">'+catalog.terms.map((t,i)=>'<button type="button" disabled data-subscription-term="'+t.id+'" aria-pressed="'+(i===0)+'">'+tr(t.label,t.en)+(t.discount?'<small>−'+t.discount+'%</small>':t.months===12&&t.factor<t.months?'<small>'+tr((t.months-t.factor)+' месяца в подарок',(t.months-t.factor)+' months included')+'</small>':'')+'</button>').join('')+'</div><noscript><p>Без JavaScript показана цена за месяц. <a href="offer.html#section-3">Все сроки и суммы — в оферте.</a></p></noscript></section>'+
    '<section class="nx-tier-section shell" aria-label="Тарифы Invest" data-nx-aria-en="Invest plans"><div class="nx-tier-grid">'+cards+'</div><p class="nx-pricing-announcement" role="status" aria-live="polite" data-pricing-announcement></p>'+
    '<p class="nx-pricing-note">'+tr('Показана линейка тарифов. Бесплатный режим и расширенные возможности готовятся к запуску; оплата пока закрыта. Цены указаны в рублях за выбранный срок.','These are proposed plans. Free access and extended features are being prepared; checkout is closed. Exact totals are in RUB for the selected term; USD values are indicative.')+'</p>'+
    '<div class="nx-pricing-links"><a href="offer.html#section-3">'+tr('Стоимость и условия','Prices and terms')+'</a><a href="offer.html#section-6">'+tr('Возврат оплаты','Refunds')+'</a><a href="offer.html#section-8">'+tr('Продавец и контакты','Seller and contacts')+'</a></div></section>'+
    '<section class="nx-plan-comparison nx-tier-comparison shell"><div><h2>'+tr('Что входит в каждый тариф.','What each plan includes.')+'</h2><p>'+tr('Бесплатный — базовый обзор одного счёта. Обычный — подробный учёт, Plus — расширенные инструменты, Pro — данные об участниках рынка.','Free covers one account. Standard adds detailed tracking, Plus extends your tools and Pro adds market participant data.')+'</p></div><div class="nx-comparison-scroll" role="region" aria-label="Сравнение четырёх тарифов" data-nx-aria-en="Plan comparison" tabindex="0"><table><caption class="nx-visually-hidden">'+tr('Возможности четырёх тарифов','Features across four plans')+'</caption><thead><tr><th scope="col">'+tr('Возможности','Features')+'</th>'+catalog.plans.map(p=>'<th scope="col">'+tr(p.name,p.en)+'</th>').join('')+'</tr></thead><tbody>'+comparison+'</tbody></table></div>'+
    '<p class="nx-comparison-note">'+tr('AI-лимиты и условия автоматизации будут опубликованы до открытия тарифов. Сейчас доступ к брокеру — только для чтения.','AI limits and automation terms will be published before plans open. Current broker access is read-only.')+'</p></section>'+
    participantsSection({tr,link,monthlyUpgrade:catalog.plans.find(p=>p.id==='pro').monthlyRub-catalog.plans.find(p=>p.id==='plus').monthlyRub})+
    '<section class="nx-faq-section shell"><h2>'+tr('Перед оформлением.','Before you subscribe.')+'</h2>'+faq([
      ['Бесплатный режим уже работает?','Is free access available now?','Пока нет: режим готовится к запуску. Планируется обзор одного счёта, история операций и базовая аналитика на трёх устройствах, без платных данных FUTOI и облачного AI. Пробный период платного тарифа — отдельное условие.','Not yet: this mode is being prepared for launch. The scope is one account, transaction history and basic analytics on up to three devices, without paid FUTOI data or cloud AI. A paid plan trial is a separate offer.'],
      ['Сколько длится пробный доступ?','How long is the trial?','7 дней без оплаты и привязки карты при первой регистрации. Для приглашённых участников отдельного тестирования возможен доступ на 30 дней. Сроки приглашения отображаются в кабинете.','7 days with no payment or card on your first registration. Invited participants of a separate pilot may receive 30 days. Invitation dates are shown in the account.'],
      ['Будут автоматические списания?','Are there automatic charges?','Нет. Вы оплачиваете выбранный срок один раз. Продление оформляется отдельно.','No. You pay once for your selected term. Renewal is a separate order.'],
      ['Как предоставляется доступ?','How is access delivered?','После открытия оплаты доступ будет выдаваться в личном кабинете Nexus: автоматически после подтверждения платежа, при технической задержке — в течение одного рабочего дня. Физическая доставка не нужна.','Once payments open, access is provided through your Nexus account: automatically after payment confirmation or within one business day in case of a technical delay. No physical delivery is required.'],
      ['Можно купить Plus или Pro сейчас?','Can I buy Plus or Pro now?','Нет. Расширенные тарифы готовятся. Покупка и предоплата откроются после готовности функций и публикации точных условий.','No. The extended plans are in development. Purchase and advance payment are unavailable until the features and exact terms are ready.'],
      ['Как отказаться и вернуть оплату?','How do I cancel and request a refund?','Напишите на support@vertux.online, укажите почту аккаунта и номер заказа либо дату и сумму оплаты. Если доступ не предоставлен, возвращается вся сумма; после начала периода — стоимость неиспользованной части по оферте.','Write to support@vertux.online with your account email and order number or payment date and amount. Undelivered access receives a full refund; after the period starts, the unused part is refunded under the public offer.'],
      ['Кто продаёт подписку?','Who sells the subscription?','Самозанятый Носырев Степан Константинович, ИНН 781436013120, Санкт-Петербург. Вы приобретаете право использовать программу, а не инвестиционный продукт.','Stepan Nosyrev, a self-employed software provider, INN 781436013120, Saint Petersburg. You purchase software access, not an investment product.']
    ])+'</section>'+
    '<script type="application/json" id="nexus-pricing-data">'+JSON.stringify(catalog).replace(/</g,'\\u003c')+'</script>';
}

export async function buildOffer() {
  const path = new URL('../nexus/legal/offer-template.md', import.meta.url);
  let md = await readFile(path, 'utf8');
  const table = ['| Срок | '+catalog.plans.map(p=>p.name).join(' | ')+' |','| '+Array(catalog.plans.length+1).fill('---').join(' | ')+' |',
    ...catalog.terms.map(t=>'| '+t.label+' | '+catalog.plans.map(p=>rub(priceFor(p,t))).join(' | ')+' |')].join('\n');
  const termRules=catalog.terms.map(t=>t.label+': '+(t.factor===t.months?'без скидки.':t.discount?'скидка '+t.discount+'% от суммы ежемесячной оплаты.':'цена равна '+t.factor+' месячным платежам.')).join(' ');
  md=md.replace('{{TERM_RULES}}',termRules).replace('{{REVISION}}',catalog.revision).replace('{{PRICE_TABLE}}',table)
    .replace('{{APPROVAL_NOTE}}',catalog.approval==='approved'?'Редакция от 22 сентября 2026 года.':'Локальный проект для согласования. Цены и состав бесплатного режима не утверждены; документ не опубликован и не заменяет действующую оферту.');
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const inline=s=>esc(s).replace(/(https?:\/\/[^\s<]*[^\s<.,)])/g,'<a href="$1">$1</a>').replace(/support@vertux\.online/g,'<a href="mailto:support@vertux.online">support@vertux.online</a>');
  const blocks=md.trim().split(/\r?\n\r?\n/);
  const toc=[];
  const html=blocks.map(block=>{
    if(block.startsWith('# '))return '<h1>'+inline(block.slice(2))+'</h1>';
    if(block.startsWith('## ')){
      const title=block.slice(3),id='section-'+title.match(/^\d+/)[0];toc.push({id,title});
      return '<h2 id="'+id+'">'+inline(title)+'</h2>';
    }
    if(block.startsWith('### '))return '<h3>'+inline(block.slice(4))+'</h3>';
    if(block.startsWith('| ')){
      const rows=block.split('\n').filter((_,i)=>i!==1).map(row=>row.split('|').slice(1,-1).map(s=>s.trim()));
      return '<div class="legal-table" role="region" aria-label="Стоимость подписки" tabindex="0"><table><caption class="nx-visually-hidden">Полные цены подписки в рублях</caption><thead><tr>'+rows[0].map(c=>'<th scope="col">'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(row=>'<tr>'+row.map((c,i)=>i===0?'<th scope="row">'+inline(c)+'</th>':'<td>'+inline(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    }
    return '<p'+(block.startsWith('Редакция')?' class="legal-revision"':'')+'>'+inline(block)+'</p>';
  }).join('\n');
  const nav='<nav class="legal-toc" aria-label="На этой странице"><strong>На этой странице</strong><ol>'+toc.map(t=>'<li><a href="#'+t.id+'">'+esc(t.title)+'</a></li>').join('')+'</ol></nav>';
  const content=html.replace('</h1>','</h1>\n'+nav);
  const htmlPath=new URL('../nexus/offer.html',import.meta.url);
  const page=await readFile(htmlPath,'utf8');
  if(!/<main class="legal-document"[\s\S]*?<\/main>/.test(page))throw new Error('Offer reader not found');
  await writeFile(htmlPath,page.replace(/<main class="legal-document"[\s\S]*?<\/main>/,'<main class="legal-document" id="content" lang="ru">'+content+'</main>'));
  await writeFile(new URL('../nexus/legal/offer.md',import.meta.url),md);
}
