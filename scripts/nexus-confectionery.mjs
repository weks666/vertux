// Authored product page for the confectionery Workspace template.
// Every interface fragment below is a labelled illustrative example.
const glyph = name => `<svg viewBox="0 0 24 24" aria-hidden="true" class="nx-icon">${({
  orders:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  catalog:'<path d="M4 10h16v10H4zM6 10V8a6 6 0 0 1 12 0v2M4 14h16"/>',
  store:'<path d="M3 9 5 4h14l2 5M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  wait:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  phone:'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4M11 19h2"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
})[name]}</svg>`;

export function confectioneryPage({tr, link, plan}) {
  const contact = 'https://t.me/VertuxManager';
  const price = Number(plan.monthlyRubReference).toLocaleString('ru-RU');
  const hero = `<section class="nx-cf-hero shell"><div class="nx-cf-hero-copy"><nav class="nx-breadcrumb" aria-label="Путь по сайту" data-nx-aria-en="Breadcrumb"><a href="index.html">Nexus</a><span aria-hidden="true">/</span><span aria-current="page">${tr('Кондитерская', 'Confectionery')}</span></nav>
<h1>${tr('Ваши десерты.', 'Your desserts.')}<br><em>${tr('Заказы — в одном месте.', 'Orders in one place.')}</em></h1>
<p>${tr('Витрина с каталогом, календарь свободных дат и заявки клиентов. Клиент выбирает торт и дату — вы видите заказ в кабинете и сами подтверждаете детали.', 'A storefront with your catalogue, a calendar of open dates and customer requests. Customers pick a cake and a date — you see the order in your workspace and confirm the details yourself.')}</p>
<div class="nx-actions"><a class="nx-button nx-button-primary" href="${contact}" target="_blank" rel="noopener noreferrer">${tr('Подключить кондитерскую', 'Connect your bakery')}${glyph('arrow')}</a><a class="nx-button nx-button-quiet" href="#demo">${tr('Попробовать демо', 'Try the demo')}${glyph('arrow')}</a></div>
<p class="nx-cf-small">${tr(`Подписка — от ${price} ₽ в месяц, ориентир. Условия фиксируются при подключении.`, `Subscription from ${price} RUB per month as a guide. Terms are agreed when you connect.`)}</p></div></section>`;

  // The real storefront and cabinet, built from the Nexus app with fictional data.
  const views = [['storefront', 'Витрина клиента', 'Customer storefront', 'Демо: витрина кондитерской', 'Demo: bakery storefront'],
    ['cabinet', 'Кабинет владельца', 'Owner workspace', 'Демо: кабинет владельца кондитерской', 'Demo: bakery owner workspace']];
  const demo = `<section class="nx-cf-live shell" id="demo" aria-labelledby="cf-demo-title"><div class="nx-cf-live-head"><h2 id="cf-demo-title">${tr('Попробуйте в деле.', 'Try it yourself.')}</h2><p>${tr('Настоящая витрина и кабинет кондитерской на вымышленных данных. Оформите заявку на витрине — и откройте кабинет: она появится там.', 'The real bakery storefront and workspace with fictional data. Send a request from the storefront, then open the workspace to find it there.')}</p></div>
<div class="nx-cf-window" data-cf-live><div class="nx-cf-window-bar"><span class="nx-cf-window-mark"><img src="assets/vertux-mark.png" width="22" height="22" alt="">${tr('Кондитерская', 'Confectionery')}</span><div class="nx-cf-switch" role="tablist" aria-label="Что показать" data-nx-aria-en="Choose a view">${views.map(([id, ru, en], index) => `<button type="button" role="tab" id="cf-live-tab-${id}" aria-controls="cf-live-${id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${tr(ru, en)}</button>`).join('')}</div><span class="nx-cf-window-tag">${tr('Демо', 'Demo')}</span></div>
<div class="nx-cf-frames">${views.map(([id, , , title, titleEn], index) => `<iframe id="cf-live-${id}" role="tabpanel" aria-labelledby="cf-live-tab-${id}" ${index === 0 ? `src="demo-confectionery/${id}.html" loading="lazy"` : `data-src="demo-confectionery/${id}.html" hidden`} title="${title}" data-nx-title-en="${titleEn}" referrerpolicy="no-referrer"></iframe>`).join('')}</div></div>
<div class="nx-cf-live-foot"><p>${tr('Вымышленные данные. Заявки и изменения хранятся только в этой вкладке браузера и никуда не отправляются.', 'Fictional data. Requests and edits stay in this browser tab and are never sent anywhere.')}</p><span><a class="nx-cf-text-link" href="demo-confectionery/storefront.html" target="_blank" rel="noopener">${tr('Витрина на весь экран', 'Storefront full screen')}${glyph('arrow')}</a><a class="nx-cf-text-link" href="demo-confectionery/cabinet.html" target="_blank" rel="noopener">${tr('Кабинет на весь экран', 'Workspace full screen')}${glyph('arrow')}</a></span></div></section>`;

  const strip = `<section class="nx-cf-strip shell" aria-label="Что меняется" data-nx-aria-en="What changes"><div>${glyph('catalog')}<b>${tr('Каталог вместо фото в переписке', 'A catalogue instead of photos in chats')}</b><span>${tr('Цены, начинки, размеры и сроки в одной карточке.', 'Prices, fillings, sizes and lead times on one card.')}</span></div><div>${glyph('calendar')}<b>${tr('Календарь сам закрывает даты', 'The calendar closes dates for you')}</b><span>${tr('Выходные, лимит в день и срок предзаказа учитываются автоматически.', 'Days off, daily limits and lead times are applied automatically.')}</span></div><div>${glyph('orders')}<b>${tr('Заявки не теряются', 'Requests don’t get lost')}</b><span>${tr('Каждая заявка получает номер и понятный статус.', 'Every request gets a number and a clear status.')}</span></div></section>`;

  const features = [
    ['orders', 'Заказы', 'Orders', 'Список заявок, подробности, история статусов и заметки для команды.', 'Requests, details, status history and team notes.'],
    ['calendar', 'Календарь', 'Calendar', 'Рабочие дни, выходные, лимит заказов и занятые даты.', 'Working days, days off, daily limits and booked dates.'],
    ['catalog', 'Каталог', 'Catalogue', 'Фото, описание, состав, размеры, начинки, цены и цена «от».', 'Photos, descriptions, ingredients, sizes, fillings and “from” prices.'],
    ['store', 'Витрина и домен', 'Storefront and domain', 'Витрина прямо в кабинете: нажмите на блок, чтобы изменить его, перетащите торты, чтобы поменять порядок. Четыре темы и свой цвет, на «Расширенном» — свой домен.', 'The storefront right in your workspace: click a block to edit it, drag cakes to reorder them. Four themes and your own colour, plus your own domain on Extended.'],
    ['wait', 'Лист ожидания', 'Waitlist', 'Клиенты на занятые даты. Освободилась дата — сразу видно, кому написать.', 'Customers waiting for booked dates. When a date frees up, you see who to contact.'],
  ];
  const cabinet = `<section class="nx-cf-features shell"><div class="nx-cf-head"><h2>${tr('Кабинет владельца.', 'Your workspace.')}<br><em>${tr('Всё, что нужно для заказов.', 'Everything an order needs.')}</em></h2><p>${tr('Без лишней CRM: только каталог, заявки, даты и клиенты, которые ждут.', 'No bloated CRM: just your catalogue, requests, dates and waiting customers.')}</p></div><div class="nx-cf-feature-grid">${features.map(([name, ru, en, text, textEn]) => `<article>${glyph(name)}<h3>${tr(ru, en)}</h3><p>${tr(text, textEn)}</p></article>`).join('')}<article class="nx-cf-feature-note">${glyph('phone')}<h3>${tr('С телефона и компьютера', 'On phone and desktop')}</h3><p>${tr('Кабинет и витрина работают в браузере — установка не нужна.', 'Both the workspace and the storefront run in the browser — nothing to install.')}</p></article></div></section>`;

  const rules = `<section class="nx-cf-rules shell"><div><h2>${tr('Календарь знает,', 'A calendar that knows')}<br><em>${tr('сколько вы успеваете.', 'how much you can bake.')}</em></h2><p>${tr('Клиент видит только статус даты: свободно, мало мест или занято. Чужие заказы и контакты на витрине не показываются.', 'Customers only see a date’s status: open, few slots or booked. Other orders and contacts never appear on the storefront.')}</p></div><ol>${[
    ['Выходные дни', 'Days off', 'Отметьте дни недели, когда не принимаете заказы.', 'Mark the weekdays when you don’t take orders.'],
    ['Занятые даты', 'Booked dates', 'Закройте отпуск или отметьте дату полностью занятой.', 'Close a holiday or mark a date as fully booked.'],
    ['Срок предзаказа', 'Lead time', 'Общий срок и свой срок у сложных изделий.', 'A default lead time plus longer ones for complex cakes.'],
    ['Лимит и слоты', 'Limits and slots', 'Сколько заказов в день; большой торт может занимать несколько слотов.', 'Orders per day; a large cake can take several slots.'],
  ].map(([ru, en, text, textEn]) => `<li><b>${tr(ru, en)}</b><span>${tr(text, textEn)}</span></li>`).join('')}</ol></section>`;

  const formats = `<section class="nx-cf-formats shell"><div class="nx-cf-head"><h2>${tr('Один шаблон — разные форматы.', 'One template, different formats.')}</h2><p>${tr('Название, тексты, фото, изделия и цены — ваши. Интерфейс подстраивается под формат.', 'Name, texts, photos, products and prices are yours. The interface adapts to your format.')}</p></div><div class="nx-cf-format-grid">${[
    ['Кондитер на заказ', 'Home baker', 'Торты к датам, начинки и надписи, лимит заказов в день.', 'Celebration cakes, fillings and inscriptions, a daily order limit.'],
    ['Мастерская', 'Bakery workshop', 'Несколько кондитеров, роли в команде, производственные слоты.', 'Several pastry chefs, team roles, production slots.'],
    ['Магазин десертов', 'Dessert shop', 'Предзаказ наборов и штучных десертов к удобной дате.', 'Pre-orders of boxes and single desserts for a chosen date.'],
  ].map(([ru, en, text, textEn]) => `<article><h3>${tr(ru, en)}</h3><p>${tr(text, textEn)}</p></article>`).join('')}</div></section>`;

  const trust = `<section class="nx-cf-trust shell">${glyph('lock')}<div><h2>${tr('Ваши клиенты — только ваши.', 'Your customers stay yours.')}</h2><p>${tr('У каждой кондитерской отдельная рабочая база. Доступ в кабинет — по аккаунту Nexus и роли в команде. Данные клиентов из заявок обрабатываете вы: на витрине можно указать ссылку на свою политику обработки данных.', 'Every bakery has its own workspace database. Access requires a Nexus account and a team role. You handle the customer data from requests, and you can link your own privacy policy on the storefront.')}</p></div><a class="nx-cf-text-link" href="security.html">${tr('Как устроена защита', 'How security works')}${glyph('arrow')}</a></section>`;

  // What each tariff opens matches the Nexus template; guide prices come from confectionery.json.
  const tierCopy = {
    base:{name:['Базовый', 'Basic'], tag:['Всё для заказов', 'Everything for orders'], items:[
      ['Витрина с каталогом и фото', 'Storefront with catalogue and photos'], ['Заявки, корзина и время получения', 'Requests, cart and pickup times'],
      ['Календарь: лимиты, отпуск, лист ожидания', 'Calendar: limits, holidays, waitlist'], ['Кабинет покупателя и скидки постоянным', 'Customer accounts and loyalty discounts'],
      ['Доступ для одного человека', 'Access for one person']]},
    extended:{name:['Расширенный', 'Extended'], tag:['Для мастерской', 'For a workshop'], items:[
      ['Всё из «Базового»', 'Everything in Basic'], ['Свой домен для витрины', 'Your own domain for the storefront'],
      ['Места в календаре для постоянных', 'Calendar places kept for regulars'], ['Доступ до 3 человек', 'Access for up to 3 people']]},
    individual:{name:['Индивидуальный', 'Custom'], tag:['По договорённости', 'By agreement'], items:[
      ['Всё из «Расширенного»', 'Everything in Extended'], ['Команда до 20 человек', 'A team of up to 20'],
      ['Перенос клиентов и настройка под ключ', 'Customer import and turnkey setup'], ['ИИ-консультант на витрине — обсуждаем отдельно', 'An AI assistant on the storefront — discussed separately']]},
  };
  const tierCard = ({key, monthlyRubReference}, index) => {
    const copy = tierCopy[key], amount = monthlyRubReference == null ? null : Number(monthlyRubReference).toLocaleString('ru-RU');
    return `<article class="nx-cf-price-card${index === 0 ? ' is-main' : ''}"><p class="nx-cf-tag">${tr(...copy.tag)}</p><h3>${tr(...copy.name)}</h3>`
      + (amount ? `<strong>${tr(`около ${amount} ₽`, `about ${amount} RUB`)}<small>${tr('в месяц', 'per month')}</small></strong>` : `<strong class="is-text">${tr('по договорённости', 'by agreement')}</strong>`)
      + `<ul>${copy.items.map(([ru, en]) => `<li>${glyph('check')}${tr(ru, en)}</li>`).join('')}</ul>`
      + `<a class="nx-button ${index === 0 ? 'nx-button-primary' : 'nx-button-quiet'}" href="${contact}" target="_blank" rel="noopener noreferrer">${tr(amount ? 'Оставить заявку' : 'Обсудить', amount ? 'Request a connection' : 'Discuss')}${glyph('arrow')}</a></article>`;
  };
  const pricing = `<section class="nx-cf-pricing shell" id="pricing"><div class="nx-cf-head"><h2>${tr('Три тарифа.', 'Three plans.')}<br><em>${tr('Начните с базового.', 'Start with Basic.')}</em></h2><p>${tr('Подключение — по заявке, пробный период на старте. Тариф можно сменить в любой момент через поддержку: данные остаются на месте.', 'Connection on request, with a trial period at the start. You can switch plans at any time through support: your data stays in place.')}</p></div>
<div class="nx-cf-price-grid">${plan.tiers.map(tierCard).join('')}</div>
<p class="nx-cf-small nx-cf-price-note">${tr('Цены — ориентир: точная стоимость фиксируется при подключении. Онлайн-оплата подписки пока не подключена.', 'Prices are a guide: the exact price is agreed when you connect. Online subscription payment is not available yet.')}</p></section>`;

  const questions = [
    ['Нужен ли свой сайт?', 'Do I need my own website?', 'Нет. Витрина получает свою ссылку — её можно отправлять клиентам и ставить в профили соцсетей.', 'No. The storefront has its own link to share with customers and add to social profiles.'],
    ['Как я узнаю о новой заявке?', 'How will I know about a new request?', 'Заявка появляется в кабинете с отметкой «Нужно связаться». Автоматические уведомления пока не подключены, поэтому клиенту вы пишете или звоните сами.', 'The request appears in your workspace marked “Get in touch”. Automatic notifications are not connected yet, so you contact the customer yourself.'],
    ['Принимает ли витрина оплату?', 'Does the storefront take payments?', 'Нет. Заявка не списывает деньги: стоимость и предоплату вы согласуете с клиентом напрямую.', 'No. A request never charges money: you agree the price and deposit with the customer directly.'],
    ['Можно ли работать командой?', 'Can a team use it?', 'Да, на «Расширенном» — до 3 человек, на «Индивидуальном» — до 20. Используются роли Nexus: владелец и администратор настраивают витрину, менеджер ведёт заказы, наблюдатель только смотрит. На «Базовом» доступ у одного человека.', 'Yes: up to 3 people on Extended and up to 20 on Custom. It uses Nexus roles: owners and admins set up the storefront, managers handle orders, viewers can only look. Basic gives access to one person.'],
  ];
  const faq = `<section class="nx-cf-faq shell"><h2>${tr('Частые вопросы.', 'Questions.')}</h2><div>${questions.map(([q, qe, a, ae]) => `<details><summary>${tr(q, qe)}<span aria-hidden="true">+</span></summary><p>${tr(a, ae)}</p></details>`).join('')}</div></section>`;

  const final = `<section class="nx-cf-final shell"><h2>${tr('Покажите десерты.', 'Show your desserts.')}<br><em>${tr('Заявки придут сами.', 'Requests will follow.')}</em></h2><p>${tr('Напишите нам — подключим кондитерскую, а витрину, каталог и календарь вы настроите за вечер.', 'Message us — we’ll connect your bakery, and you can set up the storefront, catalogue and calendar in an evening.')}</p>${link(contact, 'Подключить кондитерскую', 'Connect your bakery').replace('href=', 'target="_blank" rel="noopener noreferrer" href=')}</section>`;

  return hero + demo + strip + cabinet + rules + formats + trust + pricing + faq + final;
}
