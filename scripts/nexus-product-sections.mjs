// Plans, security and updates per product. A product page and its own
// sections link that product's sections in the header and footer; every page
// has one «Продукты» menu with each product and its sections side by side.
export const PRODUCTS = {
  invest:{name:['Invest Workspace', 'Invest Workspace'], note:['Портфель, аналитика и ваш план', 'Portfolio, analytics and your plan'],
    overview:'invest.html', plans:'pricing.html', security:'security.html', updates:'updates.html'},
  confectionery:{name:['Pastry Workspace', 'Pastry Workspace'], note:['Каталог, заявки и календарь заказов', 'Catalogue, requests and order calendar'],
    overview:'confectionery.html', plans:'confectionery-plans.html', security:'confectionery-security.html', updates:'confectionery-updates.html'},
  workspace:{name:['Custom Workspace', 'Custom Workspace'], note:['Для себя, проекта или команды', 'For you, a project or a team'],
    overview:'workspace.html', plans:'workspace-plans.html', security:'workspace-security.html', updates:'workspace-updates.html'},
};
const SECTIONS = [['plans', 'Тарифы', 'Plans'], ['security', 'Безопасность', 'Security'], ['updates', 'Обновления', 'Updates']];
const ORDER = ['invest', 'confectionery', 'workspace'];
const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';
const PRODUCTS_SLOT = /<!-- nx-products -->[\s\S]*?<!-- \/nx-products -->|<details class="nav-product"><summary><span data-nx-en="Products">[\s\S]*?<\/details>/;
const productsMenu = tr => `<!-- nx-products --><details class="nav-product nav-mega"><summary><span data-nx-en="Products">Продукты</span>${CHEVRON}</summary>
          <div class="nav-dropdown nav-mega-panel"><div class="nav-mega-grid">${ORDER.map(id => {
    const item = PRODUCTS[id];
    return `<div class="nav-mega-col"><a class="nav-mega-product" href="${item.overview}"><b data-nx-en="${item.name[1]}">${item.name[0]}</b>${tr(...item.note)}</a>`
      + `<div class="nav-mega-links">${SECTIONS.map(([key, ru, en]) => `<a class="nav-mega-link" href="${item[key]}" data-nx-en="${en}">${ru}</a>`).join('')}</div></div>`;
  }).join('')}</div>
          <div class="nav-mega-foot"><a class="nav-mega-home" href="index.html" data-nx-home-link><b>Nexus</b>${tr('Обзор и выбор продукта', 'Overview and product selection')}</a><a class="nav-download" href="download.html" data-i18n="newnav.desktop">Приложение Nexus для Windows ↗</a></div></div>
        </details><!-- /nx-products -->`;
const HEADER_SLOT = /<!-- nx-sections -->[\s\S]*?<!-- \/nx-sections -->|<a href="pricing\.html" data-nx-en="Plans">Тарифы<\/a>\s*<a href="security\.html" data-i18n="newnav\.security">Безопасность<\/a>\s*<a href="updates\.html" data-i18n="nav\.updates">Обновления<\/a>/;
const FOOTER_PLANS = /<!-- nx-footer-plans -->[\s\S]*?<!-- \/nx-footer-plans -->|<a href="pricing\.html" data-nx-en="Plans">Тарифы<\/a>/;
const FOOTER_INFO = /<!-- nx-footer-info -->[\s\S]*?<!-- \/nx-footer-info -->|<a href="security\.html" data-i18n="newnav\.security">Безопасность<\/a><a href="updates\.html" data-i18n="nav\.updates">Обновления<\/a>/;

export function productChrome({header, footer, product, tr}) {
  if (!PRODUCTS_SLOT.test(header) || !HEADER_SLOT.test(header) || !FOOTER_PLANS.test(footer) || !FOOTER_INFO.test(footer)) throw new Error('Site navigation slots are missing');
  const own = PRODUCTS[product];
  // A shared page has no product of its own: its sections are in the «Продукты» menu.
  const links = own ? SECTIONS.map(([key, ru, en]) => `<a href="${own[key]}" data-nx-en="${en}">${ru}</a>`).join('\n        ') : '';
  return {
    header:header.replace(PRODUCTS_SLOT, () => productsMenu(tr)).replace(HEADER_SLOT, () => `<!-- nx-sections -->${links}<!-- /nx-sections -->`),
    footer:footer
      .replace(FOOTER_PLANS, () => `<!-- nx-footer-plans -->${own ? `<a href="${own.plans}" data-nx-en="Plans">Тарифы</a>` : ''}<!-- /nx-footer-plans -->`)
      .replace(FOOTER_INFO, () => `<!-- nx-footer-info -->${own ? `<a href="${own.security}" data-nx-en="Security">Безопасность</a><a href="${own.updates}" data-nx-en="Updates">Обновления</a>` : ''}<!-- /nx-footer-info -->`),
  };
}

const glyph = path => `<svg viewBox="0 0 24 24" aria-hidden="true" class="nx-icon">${path}</svg>`;
const ICONS = {
  check:'<path d="m5 12 4 4L19 6"/>', dash:'<path d="M7 12h10"/>', arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  people:'<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3 6"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-3c0-3 3-5 8-5s8 2 8 5v3"/>',
  tool:'<path d="M14 6a4 4 0 0 0 5 5l-8 8a2 2 0 0 1-3-3l8-8a4 4 0 0 0-2-2Z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  link:'<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  journal:'<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h3"/>',
  refresh:'<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
};
const icon = name => glyph(ICONS[name]);
const CONTACT = 'https://t.me/VertuxManager';
const contactLink = (tr, ru, en, kind = 'primary') => `<a class="nx-button nx-button-${kind}" href="${CONTACT}" target="_blank" rel="noopener noreferrer">${tr(ru, en)}${icon('arrow')}</a>`;
const hero = ({tr, product, current, title, lede}) => `<section class="nx-section-hero shell"><nav class="nx-breadcrumb" aria-label="Путь по сайту" data-nx-aria-en="Breadcrumb"><a href="index.html">Nexus</a><span aria-hidden="true">/</span><a href="${PRODUCTS[product].overview}">${tr(...PRODUCTS[product].name)}</a><span aria-hidden="true">/</span><span aria-current="page">${tr(...SECTIONS.find(([key]) => key === current).slice(1))}</span></nav>
<h1>${tr(...title[0])}<br><em>${tr(...title[1])}</em></h1><p>${tr(...lede)}</p></section>`;
const rows = (tr, items) => `<div class="nx-section-rows">${items.map(([name, ru, en, text, textEn]) => `<article>${icon(name)}<div><h2>${tr(ru, en)}</h2><p>${tr(text, textEn)}</p></div></article>`).join('')}</div>`;
const faqBlock = (tr, title, items) => `<section class="nx-section-faq shell"><h2>${tr(...title)}</h2><div>${items.map(([q, qe, a, ae]) => `<details><summary>${tr(q, qe)}<span aria-hidden="true">+</span></summary><p>${tr(a, ae)}</p></details>`).join('')}</div></section>`;
const note = (tr, ru, en) => `<p class="nx-section-note">${tr(ru, en)}</p>`;

// ---------- Кондитерская ----------
export function confectioneryPlansPage({tr, plan, tiers}) {
  const marks = {yes:icon('check'), no:`<span class="nx-section-none">${icon('dash')}</span>`};
  const table = [
    ['Витрина с каталогом, фото и ценами', 'Storefront with catalogue, photos and prices', 'yes', 'yes', 'yes'],
    ['Заявки, статусы и история заказа', 'Requests, statuses and order history', 'yes', 'yes', 'yes'],
    ['Календарь: лимиты по дням, отпуск, время получения', 'Calendar: daily limits, holidays, pickup times', 'yes', 'yes', 'yes'],
    ['Корзина и лист ожидания', 'Cart and waitlist', 'yes', 'yes', 'yes'],
    ['Кабинет покупателя и скидки постоянным', 'Customer accounts and loyalty discounts', 'yes', 'yes', 'yes'],
    ['Онлайн-оплата заказов через свой магазин Робокассы', 'Online order payment through your own Robokassa shop', 'yes', 'yes', 'yes'],
    ['Свой домен для витрины', 'Your own domain for the storefront', 'no', 'yes', 'yes'],
    ['Места в календаре для постоянных', 'Calendar places kept for regulars', 'no', 'yes', 'yes'],
    ['Людей с доступом к кабинету', 'People with workspace access', '1', 'до 3', 'до 20', ['1', 'up to 3', 'up to 20']],
  ];
  const cell = (value, en) => marks[value] || tr(value, en);
  const compare = `<section class="nx-section-block shell"><div class="nx-cf-head"><h2>${tr('Что входит', 'What each plan')}<br><em>${tr('в каждый тариф.', 'includes.')}</em></h2><p>${tr('Все тарифы — один и тот же кабинет. Отличаются домен, места для постоянных и число людей с доступом.', 'Every plan is the same workspace. The domain, places for regulars and the number of people differ.')}</p></div>
<div class="nx-section-table" role="region" aria-label="Сравнение тарифов" data-nx-aria-en="Plan comparison" tabindex="0"><table><thead><tr><th scope="col"><span class="nx-visually-hidden">${tr('Возможность', 'Feature')}</span></th>${['Базовый|Basic', 'Расширенный|Extended', 'Индивидуальный|Custom'].map(name => `<th scope="col">${tr(...name.split('|'))}</th>`).join('')}</tr></thead>
<tbody>${table.map(([ru, en, a, b, c, own]) => `<tr><th scope="row">${tr(ru, en)}</th><td>${cell(a, own?.[0])}</td><td>${cell(b, own?.[1])}</td><td>${cell(c, own?.[2])}</td></tr>`).join('')}</tbody></table></div></section>`;
  const steps = `<section class="nx-cf-rules shell"><div><h2>${tr('Как подключиться.', 'How to connect.')}</h2><p>${tr('Подключение по заявке: выберите тариф, мы создадим кабинет и витрину.', 'Connection on request: pick a plan and we set up your workspace and storefront.')}</p></div><ol>${[
    ['Заявка', 'Request', 'Напишите нам в Telegram — расскажите о кондитерской и выберите тариф.', 'Message us on Telegram — tell us about your bakery and pick a plan.'],
    ['Пробный период', 'Trial period', 'Создаём кабинет и витрину, вы настраиваете каталог и календарь.', 'We create your workspace and storefront; you set up the catalogue and calendar.'],
    ['Подписка', 'Subscription', 'Цена — по выбранному тарифу. Срок и сумма видны в разделе «Подписка» кабинета.', 'The price follows your plan. The term and amount are shown in the workspace Subscription section.'],
    ['Смена тарифа', 'Changing plans', 'В любой момент через поддержку. Каталог, заказы и покупатели остаются на месте.', 'Any time through support. Your catalogue, orders and customers stay in place.'],
  ].map(([ru, en, text, textEn]) => `<li><b>${tr(ru, en)}</b><span>${tr(text, textEn)}</span></li>`).join('')}</ol></section>`;
  const faq = faqBlock(tr, ['Перед подключением.', 'Before you connect.'], [
    ['Можно начать с Базового и перейти позже?', 'Can I start with Basic and upgrade later?', 'Да. Тариф меняется через поддержку, данные кабинета и витрины остаются прежними.', 'Yes. Plans change through support; your workspace and storefront data stay the same.'],
    ['Что будет со своим доменом, если вернуться на Базовый?', 'What happens to my domain if I go back to Basic?', 'Перед переходом домен нужно отключить: на Базовом витрина работает по адресу Nexus.', 'The domain has to be switched off first: on Basic the storefront works at its Nexus address.'],
    ['Покупатели платят через витрину?', 'Do customers pay through the storefront?', 'Да, если подключить свой магазин Робокассы: в заказе появляется ссылка на оплату согласованной суммы, покупатель платит на странице Робокассы, деньги приходят напрямую вам. Сама заявка ничего не списывает; без подключения расчёт — напрямую с клиентом.', 'Yes, if you connect your own Robokassa shop: an order gets a payment link for the agreed amount, the customer pays on the Robokassa page and the money goes straight to you. A request itself never charges anything; without a shop you settle with the customer directly.'],
    ['Как оплатить подписку?', 'How do I pay for the subscription?', 'После подключения кабинета мы выставляем счёт по цене выбранного тарифа. Чек самозанятого приходит на почту.', 'Once your workspace is set up we send an invoice at your plan price. The self-employed receipt arrives by email.'],
  ]);
  return hero({tr, product:'confectionery', current:'plans', title:[['Тарифы Pastry Workspace.', 'Pastry Workspace plans.'], ['Начните с базового.', 'Start with Basic.']],
    lede:['Один кабинет и одна витрина на всех тарифах. Цены указаны за месяц.', 'One workspace and storefront on every plan. Prices are per month.']})
    + `<section class="nx-section-block shell"><div class="nx-cf-price-grid">${plan.tiers.map(tiers).join('')}</div></section>` + compare + steps + faq
    + `<section class="nx-cf-final shell"><h2>${tr('Выберите тариф.', 'Pick a plan.')}<br><em>${tr('Остальное настроим вместе.', 'We’ll set up the rest together.')}</em></h2><p>${tr('Напишите нам — подключим кондитерскую и поможем с первым запуском.', 'Message us — we’ll connect your bakery and help with the first launch.')}</p>${contactLink(tr, 'Подключить кондитерскую', 'Connect your bakery')}</section>`;
}

export function confectionerySecurityPage({tr}) {
  return hero({tr, product:'confectionery', current:'security', title:[['Ваши клиенты —', 'Your customers'], ['только ваши.', 'stay yours.']],
    lede:['Каталог, заказы и покупатели каждой кондитерской хранятся отдельно. Nexus управляет аккаунтами, доступом и подпиской.', 'The catalogue, orders and customers of each bakery are kept apart. Nexus manages accounts, access and the subscription.']})
    + `<section class="nx-section-block shell">${rows(tr, [
      ['database', 'Отдельная база у каждой кондитерской', 'A separate database for every bakery', 'Каталог, календарь, заказы, лист ожидания и покупатели лежат в своей базе кондитерской. Другие компании их не видят.', 'Catalogue, calendar, orders, waitlist and customers live in the bakery’s own database. Other companies never see them.'],
      ['people', 'Вход по аккаунту и роли', 'Access by account and role', 'В кабинет входят по аккаунту Nexus. Владелец и администратор настраивают витрину, менеджер ведёт заказы, наблюдатель только смотрит. Каждый запрос проверяет роль и подписку.', 'The workspace is opened with a Nexus account. Owners and admins set up the storefront, managers handle orders, viewers can only look. Every request checks the role and subscription.'],
      ['user', 'Покупатели — в базе кондитерской', 'Customers stay in the bakery’s database', 'Кабинет покупателя открывается по одноразовому коду из письма, без пароля. Покупатели не получают доступа к Nexus и могут сами удалить свой аккаунт.', 'Customer accounts open with a one-time code from email, without a password. Customers get no access to Nexus and can delete their account themselves.'],
      ['tool', 'Помощь Vertux — с вашего разрешения', 'Help from Vertux only with your permission', 'Vertux может настроить каталог, витрину, календарь и домен, если владелец это разрешил. Заказы и контакты клиентов при этом недоступны, каждое изменение записывается в журнал. Владелец отключает доступ одной кнопкой.', 'Vertux can set up the catalogue, storefront, calendar and domain if the owner allows it. Orders and customer contacts stay closed, and every change is logged. The owner switches access off with one button.'],
      ['globe', 'Свой домен открывает только витрину', 'Your domain opens only the storefront', 'На своём домене нет входа, кабинета и других страниц Nexus — только витрина этой кондитерской. Домен подключается после проверки записи DNS.', 'Your domain has no sign-in, workspace or other Nexus pages — only this bakery’s storefront. A domain connects after a DNS record check.'],
      ['card', 'Деньги идут напрямую кондитерской', 'Money goes straight to the bakery', 'Заявка ничего не списывает. Если подключена онлайн-оплата, покупатель платит на странице Робокассы: данные карты не попадают ни на витрину, ни в Nexus, а деньги приходят в магазин кондитерской. Пароли магазина хранятся отдельно от данных кабинета и не попадают в резервные копии.', 'A request never charges anything. With online payment connected, the customer pays on the Robokassa page: card details never reach the storefront or Nexus, and the money goes to the bakery’s own shop. Shop passwords are stored apart from workspace data and stay out of backups.'],
    ])}${note(tr, 'Данные клиентов из заявок обрабатываете вы: на витрине можно указать ссылку на свою политику обработки данных. Эта страница описывает устройство продукта и не заменяет политику или договор.', 'You handle the customer data from requests, and you can link your own privacy policy on the storefront. This page describes how the product works and does not replace a policy or contract.')}</section>`
    + `<section class="nx-cf-final shell"><h2>${tr('Остались вопросы?', 'Any questions?')}</h2><p>${tr('Расскажем, как устроены доступ и хранение данных в вашем случае.', 'We’ll explain how access and storage work for you.')}</p>${contactLink(tr, 'Задать вопрос', 'Ask a question')}</section>`;
}

export function confectioneryUpdatesPage({tr}) {
  return hero({tr, product:'confectionery', current:'updates', title:[['Обновления', 'Pastry Workspace'], ['Pastry Workspace.', 'updates.']],
    lede:['Кабинет и витрина работают в браузере: обновления приходят сами, устанавливать ничего не нужно.', 'The workspace and storefront run in the browser: updates arrive on their own, nothing to install.']})
    + `<section class="nx-section-block shell"><div class="nx-section-empty">${icon('refresh')}<div><h2>${tr('13 ноября 2026 года — онлайн-оплата заказов.', '13 November 2026 — online order payment.')}</h2><p>${tr('Кондитерская подключает свой магазин Робокассы, и покупатель оплачивает согласованную сумму по ссылке из заказа. Каждый следующий выпуск появится здесь с датой и списком изменений.', 'A bakery connects its own Robokassa shop, and the customer pays the agreed amount from a link in the order. Every next release will appear here with its date and list of changes.')}</p></div></div>
<ul class="nx-section-list">${[
      ['Онлайн-оплата через свой магазин Робокассы: деньги приходят напрямую кондитерской', 'Online payment through your own Robokassa shop: the money goes straight to the bakery'],
      ['Ссылка на оплату в заказе и кнопка «Оплатить» на странице статуса заказа', 'A payment link in the order and a «Pay» button on the order status page'],
      ['Оплата записывается в заказ сама после подтверждения Робокассы', 'The payment is recorded in the order once Robokassa confirms it'],
      ['Пароли магазина только на запись и не попадают в резервные копии', 'Shop passwords are write-only and stay out of backups'],
      ['Свой домен: после проверки DNS Vertux включает HTTPS одной командой', 'Own domain: after the DNS check Vertux switches on HTTPS with one command'],
    ].map(([ru, en]) => `<li><span class="nx-section-tag">${tr('ВЫПУЩЕНО', 'RELEASED')}</span>${tr(ru, en)}</li>`).join('')}</ul>
<div class="nx-cf-head nx-section-subhead"><h2>${tr('Первый выпуск', 'The first release')}<br><em>${tr('13 ноября 2026 года.', '13 November 2026.')}</em></h2><p>${tr('Pastry Workspace подключается по заявке: Vertux создаёт кабинет и передаёт владельцу код входа. Кабинет и витрина работают в браузере на компьютере и телефоне.', 'Pastry Workspace is connected on request: Vertux creates the workspace and gives the owner a sign-in code. The workspace and storefront run in the browser on a computer and a phone.')}</p></div>
<ul class="nx-section-list">${[
      ['Витрина с каталогом, фото, размерами и начинками', 'Storefront with catalogue, photos, sizes and fillings'],
      ['Календарь: лимиты по дням недели, отпуск, время получения', 'Calendar: weekday limits, holidays, pickup times'],
      ['Заявки и корзина из нескольких изделий', 'Requests and a multi-item cart'],
      ['Лист ожидания на занятые даты', 'Waitlist for booked dates'],
      ['Кабинет покупателя по коду из письма и скидки постоянным', 'Customer accounts by email code and loyalty discounts'],
      ['Свой домен и места для постоянных — на тарифе «Расширенный»; домен подключает Vertux по заявке', 'Own domain and places for regulars — on Extended; Vertux connects the domain on request'],
    ].map(([ru, en]) => `<li><span class="nx-section-tag">${tr('ВЫПУЩЕНО', 'RELEASED')}</span>${tr(ru, en)}</li>`).join('')}</ul></section>`
    + `<section class="nx-cf-final shell"><h2>${tr('Хотите посмотреть?', 'Want to take a look?')}</h2><p>${tr('Демо витрины и кабинета работает на вымышленных данных.', 'The storefront and workspace demo runs on fictional data.')}</p><a class="nx-button nx-button-primary" href="confectionery.html#demo">${tr('Открыть демо', 'Open the demo')}${icon('arrow')}</a></section>`;
}

// ---------- Custom Workspace ----------
export function workspacePlansPage({tr}) {
  return hero({tr, product:'workspace', current:'plans', title:[['Стоимость', 'Pricing'], ['под ваш проект.', 'for your project.']],
    lede:['Custom Workspace — индивидуальный проект. Состав, сроки и стоимость обсуждаются отдельно, после разбора задачи.', 'Custom Workspace is an individual project. Scope, timeline and price are discussed separately, once we understand the task.']})
    + `<section class="nx-section-block shell"><div class="nx-section-steps">${[
      ['1', 'Разбор задачи', 'Understanding the task', 'Что вы хотите организовать, какие данные нужны и что должно происходить автоматически. От этого зависят состав и стоимость.', 'What you want to organise, which data you need and what should happen automatically. Scope and price depend on it.'],
      ['2', 'Прототип', 'Prototype', 'Проверяем структуру и основной сценарий на рабочем примере до основной разработки.', 'We check the structure and main scenario on a working example before the main build.'],
      ['3', 'Запуск и сопровождение', 'Launch and support', 'Согласуем доступы, подключения и порядок дальнейших обновлений.', 'We agree access, connections and how further updates are made.'],
    ].map(([n, ru, en, text, textEn]) => `<article><span class="nx-section-step">${n}</span><h2>${tr(ru, en)}</h2><p>${tr(text, textEn)}</p></article>`).join('')}</div></section>`
    + faqBlock(tr, ['Частые вопросы.', 'Questions.'], [
      ['Сколько стоит Custom Workspace?', 'How much does a Custom Workspace cost?', 'Зависит от задачи: разделов, данных и подключений. Стоимость обсуждаем после разбора процесса.', 'It depends on the task: sections, data and connections. We discuss the price once we understand the process.'],
      ['Есть ли готовые тарифы?', 'Are there fixed plans?', 'Для готовых шаблонов — да: например, у Pastry Workspace три тарифа. Custom Workspace собирается под вас, поэтому тарифной сетки у него нет.', 'Ready templates have them — Pastry Workspace has three plans. A Custom Workspace is built for you, so it has no fixed plans.'],
      ['Можно ли начать с небольшой задачи?', 'Can we start small?', 'Да. Удобно начать с одного процесса и расширять систему по мере необходимости.', 'Yes. It is convenient to start with one process and grow the system as needed.'],
    ])
    + `<section class="nx-final shell"><h2>${tr('Расскажите о своей задаче.', 'Tell us about your task.')}</h2><p>${tr('Обсудим нужные разделы и действия — для вас, вашего проекта или команды.', 'We’ll discuss the sections and actions you need — for you, your project or your team.')}</p>${contactLink(tr, 'Написать в Telegram', 'Message on Telegram')}</section>`;
}

export function workspaceSecurityPage({tr}) {
  return hero({tr, product:'workspace', current:'security', title:[['Данные компании', 'Company data,'], ['под вашим контролем.', 'under your control.']],
    lede:['Nexus управляет аккаунтами, доступом и подпиской. Рабочие данные компании хранятся отдельно от других клиентов.', 'Nexus manages accounts, access and the subscription. Company working data is kept apart from other clients.']})
    + `<section class="nx-section-block shell">${rows(tr, [
      ['database', 'Отдельно от других компаний', 'Apart from other companies', 'Рабочие данные каждой компании хранятся отдельно. Доступ к ним проверяется при каждом запросе.', 'Each company’s working data is kept separately. Access to it is checked on every request.'],
      ['people', 'Роли и доступ', 'Roles and access', 'Участники видят свои задачи и разрешённые разделы. Доступ выдают владелец или администратор компании, его можно отозвать.', 'Members see their tasks and the sections they are allowed. Owners or company admins grant access and can revoke it.'],
      ['link', 'Подключения — по согласованию', 'Connections by agreement', 'Почта, таблицы и учётные системы подключаются только те, что согласованы в проекте, и с правами, которые нужны для задачи.', 'Only the email, spreadsheets and accounting systems agreed in the project are connected, with just the rights the task needs.'],
      ['journal', 'Журнал изменений доступа', 'Access change log', 'Выдача и отзыв доступа и другие важные действия записываются в журнал.', 'Granting and revoking access and other important actions are logged.'],
    ])}${note(tr, 'Конкретная схема хранения и подключений описывается в проекте. Эта страница не заменяет политику обработки персональных данных или договор.', 'The exact storage and connection setup is described in the project. This page does not replace a privacy policy or contract.')}</section>`
    + `<section class="nx-final shell"><h2>${tr('Обсудим требования.', 'Let’s discuss your requirements.')}</h2><p>${tr('Расскажите, какие данные и системы нужно связать — предложим подходящую схему.', 'Tell us which data and systems need to be connected — we’ll suggest a suitable setup.')}</p>${contactLink(tr, 'Задать вопрос', 'Ask a question')}</section>`;
}

export function workspaceUpdatesPage({tr}) {
  return hero({tr, product:'workspace', current:'updates', title:[['Обновления', 'Updates'], ['по договорённости.', 'by agreement.']],
    lede:['Каждый Custom Workspace собирается под задачу, поэтому общей истории выпусков у него нет.', 'Every Custom Workspace is built for its task, so there is no shared release history.']})
    + `<section class="nx-section-block shell">${rows(tr, [
      ['refresh', 'Изменения согласуем с вами', 'Changes are agreed with you', 'Новые разделы и доработки обсуждаем заранее и выпускаем в согласованном порядке.', 'New sections and improvements are discussed in advance and released in the agreed order.'],
      ['card', 'Приложение Nexus обновляется для всех', 'The Nexus app updates for everyone', 'Приложение Nexus для Windows выходит общими выпусками. Их история опубликована на странице обновлений Nexus и Invest.', 'The Nexus app for Windows ships shared releases. Their history is on the Nexus and Invest updates page.'],
    ])}<p class="nx-section-more"><a class="nx-button nx-button-quiet" href="updates.html">${tr('Выпуски Nexus и Invest', 'Nexus and Invest releases')}${icon('arrow')}</a></p></section>`
    + `<section class="nx-final shell"><h2>${tr('Нужна доработка?', 'Need a change?')}</h2><p>${tr('Опишите, что хотите изменить, — согласуем состав и срок.', 'Describe what you want to change — we’ll agree the scope and timing.')}</p>${contactLink(tr, 'Написать в Telegram', 'Message on Telegram')}</section>`;
}
