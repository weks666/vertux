// Public storefront of a confectionery workspace. It only receives public
// shop fields and one status per date; other customers' data never reaches it.
// On a verified custom domain the server names the shop on <html data-shop>.
const slug = document.documentElement.dataset.shop || location.pathname.split('/')[2] || '';
// A lead demo (/demo/<token>) is a sample built for one confectioner from their
// public posts: the form works the same, but nothing is sent or stored.
const leadDemo = document.documentElement.dataset.demo || '';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DATE_LABEL = { available:'можно заказать', few:'осталось мало мест', full:'занято, можно встать в лист ожидания', unavailable:'недоступно' };
const CONTACT_HINTS = { phone:'+7 900 000-00-00', telegram:'@username', whatsapp:'+7 900 000-00-00', vk:'https://vk.com/…', email:'name@example.ru' };
const state = { shop:null, item:null, month:'', date:null, dateStatus:null, mode:'order', requestId:'', submitting:false,
  cart:[], checkout:false, account:null, tiers:[], windows:[] };
// Inside the owner cabinet the page runs as a same-origin preview frame: no orders
// are sent from it, and in edit mode clicks become edit requests to the cabinet.
const embedded = new URLSearchParams(location.search).get('embed') === 'cabinet' && window.parent !== window;
const editor = { on:false, canCatalog:false, canStorefront:false, drag:null, suppressClick:false };
const demoOnly = () => state.shop.preview || embedded;
// Owner switches: a cart for several items, sign-in for customers, pickup windows.
const cartOn = () => state.shop?.ordering?.cart === true;
const accountsOn = () => state.shop?.ordering?.accounts === true && !embedded;
const pickupOn = () => state.shop?.pickup?.enabled === true;
const catalogItem = id => state.shop.catalog.find(item => item.id === id);

function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') element.className = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) element.append(child instanceof Node ? child : String(child));
  return element;
}
const money = minor => `${(minor / 100).toLocaleString('ru-RU', { maximumFractionDigits:2 })} ₽`;
const dateText = (date, options = { day:'numeric', month:'long', weekday:'long' }) => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`));
const monthShift = (month, delta) => { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); return date.toISOString().slice(0, 7); };
const addDays = (date, days) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const media = id => `${state.shop.mediaBase}${id}.svg`;
const uuid = () => crypto.randomUUID?.() || '10000000-1000-4000-8000-100000000000'.replace(/[018]/gu, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

async function request(path, body, method = body ? 'POST' : 'GET') {
  let response;
  try {
    response = await fetch(path, { method, credentials:'same-origin', cache:'no-store',
      headers:{ Accept:'application/json', ...(body ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
  } catch { throw Object.assign(new Error('Нет связи. Проверьте интернет и попробуйте снова.'), { code:'NETWORK' }); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw Object.assign(new Error(payload.error?.message || 'Не получилось. Попробуйте ещё раз.'), { code:payload.error?.code, status:response.status });
  return payload.data;
}
const api = (path = '', body, method) => request(leadDemo ? `/api/demo/${encodeURIComponent(leadDemo)}${path}` : `/api/shop/${encodeURIComponent(slug)}${path}`, body, method);

// Owner theme and accent with a readable text colour; set through CSSOM so the strict CSP holds.
const THEME_COLORS = { cream:'#FFF8F1', white:'#FFFFFF', blush:'#FFF4F3', chocolate:'#21150F' };
function applyTheme(theme) {
  const value = Object.hasOwn(THEME_COLORS, theme) ? theme : 'cream';
  if (value === 'cream') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[value]);
}
function applyAccent(hex) {
  const value = /^#[0-9a-f]{6}$/iu.test(hex || '') ? hex : '#E8792B';
  const [r, g, b] = [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  document.documentElement.style.setProperty('--sf-accent', value);
  document.documentElement.style.setProperty('--sf-on-accent', luminance > 0.36 ? '#2A1A0E' : '#FFFFFF');
}

// Background colour, card lighting and a background photo, as in Invest's appearance settings.
function applyLook(shop) {
  const root = document.documentElement, light = shop.cardLight || {};
  if (/^#[0-9a-f]{6}$/iu.test(shop.backgroundColor || '')) root.style.setProperty('--sf-bg', shop.backgroundColor); else root.style.removeProperty('--sf-bg');
  if (['diffuse','full','corner'].includes(light.style)) root.dataset.cardLight = light.style; else delete root.dataset.cardLight;
  const strength = Math.max(0, Math.min(100, Number(light.intensity ?? 30)));
  root.style.setProperty('--sf-light', /^#[0-9a-f]{6}$/iu.test(light.color || '') ? light.color : 'var(--sf-accent)');
  root.style.setProperty('--sf-light-strength', `${Math.round(strength * 0.4)}%`);
  root.style.setProperty('--sf-light-soft', `${Math.round(strength * 0.14)}%`);
  if (/^[a-f0-9]{32}$/u.test(shop.backgroundMediaId || '')) {
    root.dataset.wallpaper = '';
    root.style.setProperty('--sf-wallpaper', `url("${media(shop.backgroundMediaId)}")`);
    root.style.setProperty('--sf-wallpaper-shade', `${Math.max(20, Math.min(90, Number(shop.backgroundShade ?? 65)))}%`);
  } else { delete root.dataset.wallpaper; root.style.removeProperty('--sf-wallpaper'); }
}

// Estimate of one line: size price or the base price, plus paid options, times quantity.
function lineEstimate(item, line) {
  const pick = (list, label) => list.find(option => option.label === label);
  const size = pick(item.sizes, line.size), base = size?.priceMinor ?? item.priceMinor;
  if (base === null || base === undefined) return null;
  const extra = [pick(item.fillings, line.filling), pick(item.decorations, line.decoration)].reduce((sum, option) => sum + (option?.priceMinor || 0), 0);
  return { minor:(base + extra) * line.quantity, from:item.priceFrom || (!size && item.sizes.length > 0) };
}
function estimateText(estimates) {
  const known = estimates.filter(Boolean);
  if (!known.length) return 'Стоимость кондитерская назовёт после уточнения деталей.';
  const total = known.reduce((sum, value) => sum + value.minor, 0), from = known.some(value => value.from) || known.length < estimates.length;
  const percent = state.account?.standing?.percent || 0;
  const discount = percent ? ` Ваша скидка ${percent}% — около ${money(Math.round(total * (100 - percent) / 100))}.` : '';
  return `Ориентировочно ${from ? 'от ' : ''}${money(total)}.${discount} Итоговую стоимость подтвердит кондитерская.`;
}

function priceText(item) {
  const prices = [item.priceMinor, ...item.sizes.map(size => size.priceMinor)].filter(value => value !== null && value !== undefined);
  if (!prices.length) return 'Цена по запросу';
  return `${item.priceFrom || prices.length > 1 ? 'от ' : ''}${money(Math.min(...prices))}${item.unit ? ` / ${item.unit}` : ''}`;
}

function contactHref(method, value) {
  const digits = String(value).replace(/[^\d+]/gu, '');
  if (method === 'phone' && /^\+?\d{6,15}$/u.test(digits)) return `tel:${digits}`;
  if (method === 'whatsapp' && /^\+?\d{6,15}$/u.test(digits)) return `https://wa.me/${digits.replace('+', '')}`;
  if (method === 'telegram') { const name = String(value).replace(/^@|^https:\/\/t\.me\//u, ''); if (/^[A-Za-z0-9_]{4,32}$/u.test(name)) return `https://t.me/${name}`; }
  if (method === 'instagram') { const name = String(value).replace(/^@|^https:\/\/(?:www\.)?instagram\.com\//u, '').replace(/\/$/u, ''); if (/^[A-Za-z0-9_.]{1,30}$/u.test(name)) return `https://www.instagram.com/${name}/`; }
  if (method === 'email' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value)) return `mailto:${value}`;
  if (method === 'vk' && /^https:\/\/(?:m\.)?vk\.com\/[A-Za-z0-9_.]{1,64}$/u.test(value)) return value;
  return null;
}

const QUICK_CONTACTS = [['telegram','Telegram'],['whatsapp','WhatsApp'],['instagram','Instagram'],['vk','ВКонтакте'],['phone','Позвонить']];
function renderShop() {
  const { shop, catalog } = state.shop;
  document.title = shop.name;
  applyTheme(shop.theme); applyAccent(shop.accentColor); applyLook(shop);
  $('#sfName').textContent = shop.name; $('#sfTagline').textContent = shop.tagline; $('#sfTagline').hidden = !shop.tagline;
  $('#sfLogo').replaceChildren(shop.logoMediaId ? h('img', { src:media(shop.logoMediaId), alt:'' }) : shop.name.slice(0, 1));
  $('#sfQuick').replaceChildren(...QUICK_CONTACTS.map(([key, label]) => [label, contactHref(key, shop.contacts?.[key] || '')]).filter(([, href]) => href).slice(0, 2)
    .map(([label, href]) => h('a', { class:'sf-pill', href, ...(href.startsWith('https:') ? { target:'_blank', rel:'noopener' } : {}) }, label)));
  const ordering = state.shop.accepting || demoOnly();
  $('#sfEyebrow').textContent = shop.formatLabel || 'Кондитерская'; $('#sfEyebrow').hidden = !shop.formatLabel;
  $('#sfHeroTitle').textContent = shop.tagline || shop.name;
  $('#sfDescription').textContent = shop.description; $('#sfDescription').hidden = !shop.description;
  $('#sfOrderNote').textContent = shop.orderNote; $('#sfOrderNoteBlock').hidden = !shop.orderNote;
  $('#sfSteps').hidden = !ordering; $('#sfStepAction').textContent = shop.action;
  const covers = shop.coverMediaIds.slice(0, 3), frame = $('#sfCovers');
  frame.replaceChildren(...(covers.length ? covers.map((id, index) => h('img', { src:media(id), alt:index === 0 ? `${shop.name}: фото изделий` : '', loading:index ? 'lazy' : 'eager' }))
    : editor.on && editor.canStorefront ? [h('span', { class:'sf-card-placeholder' }, h('small', {}, 'Добавьте фото обложки'))] : []));
  frame.dataset.count = String(Math.max(1, covers.length));
  const showMedia = covers.length > 0 || (editor.on && editor.canStorefront);
  $('#sfHero').classList.toggle('no-media', !showMedia); frame.parentElement.hidden = !showMedia;
  $('#sfPreviewBanner').hidden = !state.shop.preview || embedded;
  $('#sfDemoBanner').hidden = !state.shop.demo;
  if (state.shop.demo) $('#sfDemoBanner').textContent = `Это демо витрины для «${shop.name}». Мы собрали его из публичных постов вашего канала, чтобы показать, как клиенты будут выбирать десерт и дату. Заявки отсюда не отправляются. Демо удалится ${dateText(state.shop.demo.expiresAt.slice(0, 10), { day:'numeric', month:'long' })}.`;
  $('#sfClosedBanner').hidden = state.shop.preview || state.shop.accepting;
  $('#sfHeroAction').textContent = ordering ? shop.action : 'Посмотреть каталог';
  $('#sfCatalogNote').textContent = cartOn() ? 'Добавьте изделия в корзину, затем выберите дату для всего заказа.' : 'Нажмите на изделие, чтобы увидеть подробности и выбрать дату.';
  renderCatalog(catalog);
  renderContacts(shop.contacts);
  renderTools();
  applyEditing();
}

// ---------- cart and account buttons ----------
const cartKey = () => `nx-cart:${slug}`;
function loadCart() {
  if (!cartOn()) { state.cart = []; return; }
  try {
    const saved = JSON.parse(localStorage.getItem(cartKey()) || '[]');
    state.cart = (Array.isArray(saved) ? saved : []).filter(line => catalogItem(line?.itemId)).slice(0, 10).map(line => ({ key:String(line.key || uuid()),
      itemId:line.itemId, size:String(line.size || ''), filling:String(line.filling || ''), decoration:String(line.decoration || ''), quantity:Math.max(1, Math.floor(Number(line.quantity)) || 1) }));
  } catch { state.cart = []; }
}
function saveCart() {
  try { localStorage.setItem(cartKey(), JSON.stringify(state.cart)); } catch { /* the cart lives for this visit only */ }
  renderTools();
}
function renderTools() {
  const count = state.cart.reduce((sum, line) => sum + line.quantity, 0), cart = cartOn() && (state.shop.accepting || demoOnly());
  $('#sfCartButton').hidden = !cart;
  $('#sfCartCount').textContent = String(count);
  $('#sfCartButton').setAttribute('aria-label', `Корзина: ${count ? `${count} ${plural(count, 'изделие', 'изделия', 'изделий')}` : 'пусто'}`);
  $('#sfAccountButton').hidden = !accountsOn();
  $('#sfAccountButton').textContent = state.account ? state.account.profile.name.split(' ')[0] : 'Войти';
  $('#sfAccountButton').setAttribute('aria-label', state.account ? `Кабинет покупателя: ${state.account.profile.name}` : 'Войти в кабинет покупателя');
  $('#sfTools').hidden = $('#sfCartButton').hidden && $('#sfAccountButton').hidden;
}

function renderCatalog(catalog) {
  const host = $('#sfCatalog'), canMove = editor.on && editor.canCatalog;
  const addCard = canMove ? h('button', { type:'button', class:'sf-add-card', onclick:() => post('add-item') }, h('b', { 'aria-hidden':'true' }, '+'), 'Добавить изделие') : null;
  if (!catalog.length) {
    host.replaceChildren(addCard || h('div', { class:'sf-empty' }, h('h3', {}, 'Каталог скоро появится'), h('p', {}, 'Кондитерская ещё добавляет изделия. Пока можно связаться с ней напрямую — контакты ниже.')));
    return;
  }
  const accepting = state.shop.accepting || demoOnly();
  const cta = !accepting ? 'Подробнее' : cartOn() ? 'Выбрать' : 'Выбрать дату';
  // «Добавить» on the photo only with the owner's cart; a tap on the card opens the item as before.
  const quickAdd = accepting && cartOn() && !(editor.on && editor.canCatalog);
  host.replaceChildren(...catalog.map((item, index) => {
    const lead = Math.max(item.leadDays || 0, state.shop.calendar.leadDays || 0);
    const card = h('article', { class:'sf-card', 'data-id':item.id },
      h('button', { type:'button', class:'sf-card-open', onclick:() => openCard(item), 'aria-label':`${item.title}, ${priceText(item)} — ${editor.on && editor.canCatalog ? 'изменить' : 'подробнее'}` },
        h('span', { class:'sf-card-photo' }, item.mediaIds[0] ? h('img', { src:media(item.mediaIds[0]), alt:'', loading:'lazy', draggable:'false' }) : h('span', { class:'sf-card-placeholder', 'aria-hidden':'true' }, item.title.slice(0, 1)),
          lead ? h('span', { class:'sf-card-badge' }, clockIcon(), `${lead} ${plural(lead, 'день', 'дня', 'дней')}`) : null),
        h('span', { class:'sf-card-body' }, h('b', { class:'sf-card-price' }, priceText(item)), h('strong', {}, item.title),
          item.summary ? h('span', { class:'sf-card-summary' }, item.summary) : null,
          h('span', { class:'sf-card-meta' }, lead ? h('span', { class:'sf-card-lead' }, clockIcon(), `Срок от ${lead} ${plural(lead, 'дня', 'дней', 'дней')}`) : h('span'),
            h('span', { class:'sf-card-cta', 'aria-hidden':'true' }, cta, ' →')))),
      quickAdd ? h('button', { type:'button', class:'sf-card-add', 'aria-label':`Добавить «${item.title}» в корзину`, onclick:event => quickAddItem(item, event.currentTarget) }, 'Добавить') : null,
      canMove ? h('div', { class:'sf-card-tools' },
        h('button', { type:'button', class:'sf-handle', 'aria-label':`Переместить «${item.title}». Стрелки меняют место`, title:'Перетащите, чтобы поменять порядок', onkeydown:event => moveByKey(event, item.id) }, '⋮⋮'),
        h('button', { type:'button', class:'sf-card-edit', onclick:() => post('edit', { target:'item', id:item.id }) }, 'Изменить')) : null);
    card.style.setProperty('--sf-card-index', String(Math.min(index, 8)));
    return card;
  }), ...(addCard ? [addCard] : []));
}
function clockIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('sf-clock');
  path.setAttribute('d', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2');
  svg.append(path);
  return svg;
}
// An item with sizes, fillings or decorations needs a choice first, so it opens on its cart form.
function quickAddItem(item, button) {
  if (item.sizes.length || item.fillings.length || item.decorations.length) { openItem(item); return; }
  const same = state.cart.find(entry => entry.itemId === item.id && !entry.size && !entry.filling && !entry.decoration);
  if (same) same.quantity = Math.min(item.maxQuantity, same.quantity + item.minQuantity);
  else if (state.cart.length >= 10) { openCart(); return; }
  else state.cart.push({ key:uuid(), itemId:item.id, size:'', filling:'', decoration:'', quantity:item.minQuantity });
  saveCart();
  button.textContent = 'В корзине ✓'; button.classList.add('is-added');
  $('#sfCartButton').classList.remove('sf-bump'); void $('#sfCartButton').offsetWidth; $('#sfCartButton').classList.add('sf-bump');
  setTimeout(() => { button.textContent = 'Добавить'; button.classList.remove('is-added'); }, 1600);
}
function openCard(item) {
  if (editor.suppressClick) return;
  if (editor.on && editor.canCatalog) post('edit', { target:'item', id:item.id });
  else openItem(item);
}

function renderContacts(contacts) {
  const labels = { phone:'Телефон', telegram:'Telegram', whatsapp:'WhatsApp', vk:'ВКонтакте', instagram:'Instagram', email:'Почта', address:'Адрес', hours:'Часы работы' };
  const entries = Object.entries(labels).filter(([key]) => contacts?.[key]);
  $('#sfContactList').replaceChildren(...(entries.length ? entries.flatMap(([key, label]) => {
    const href = contactHref(key, contacts[key]);
    return [h('dt', {}, label), h('dd', {}, href ? h('a', { href, ...(href.startsWith('https:') ? { target:'_blank', rel:'noopener' } : {}) }, contacts[key]) : contacts[key])];
  }) : [h('dd', {}, 'Контакты появятся позже.')]));
}

// ---------- item dialog ----------
function showPane(name) {
  $$('#sfItemDialog .sf-pane').forEach(pane => { pane.hidden = pane.dataset.pane !== name; });
  const step = { cart:'details', done:'form' }[name] || name;
  $('.sf-steps [data-step="details"]').textContent = state.checkout ? 'Корзина' : 'Изделие';
  $$('.sf-steps span').forEach(item => item.classList.toggle('active', item.dataset.step === step));
  const pane = $(`.sf-pane[data-pane="${name}"]`), heading = pane.querySelector('h2') || pane;
  heading.setAttribute('tabindex', '-1');
  heading.focus();
}

function openItem(item) {
  state.item = item; state.date = null; state.requestId = ''; state.checkout = false;
  $('#sfItemTitle').textContent = item.title;
  $('#sfItemPrice').textContent = priceText(item);
  $('#sfItemDescription').textContent = item.description || item.summary || '';
  const gallery = $('#sfGallery');
  gallery.replaceChildren(...(item.mediaIds.length ? item.mediaIds.map((id, index) => h('img', { src:media(id), alt:index === 0 ? item.title : `${item.title}, фото ${index + 1}`, loading:index ? 'lazy' : 'eager' }))
    : [h('span', { class:'sf-card-placeholder', 'aria-hidden':'true' }, item.title.slice(0, 1))]));
  const lead = Math.max(item.leadDays || 0, state.shop.calendar.leadDays || 0);
  const option = list => list.map(entry => entry.priceMinor === null ? entry.label : `${entry.label} — ${money(entry.priceMinor)}`).join('\n');
  const facts = [['Состав и начинка', item.composition], ['Размеры', option(item.sizes)], ['Начинки на выбор', option(item.fillings)], ['Оформление', option(item.decorations)],
    ['Срок изготовления', lead ? `заказ минимум за ${lead} ${plural(lead, 'день', 'дня', 'дней')}` : 'можно заказать на ближайшие свободные даты'], ['Примечания', item.notes]].filter(([, value]) => value);
  $('#sfItemFacts').replaceChildren(...facts.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)]));
  const chooser = $('#sfChooseDate'), ordering = state.shop.accepting || demoOnly();
  chooser.hidden = !ordering || cartOn();
  chooser.textContent = demoOnly() ? 'Посмотреть календарь (предпросмотр)' : 'Выбрать дату';
  $('#sfCartConfig').hidden = !ordering || !cartOn();
  if (cartOn()) renderCartConfig(item);
  if (!$('#sfItemDialog').open) $('#sfItemDialog').showModal();
  showPane('details');
}
const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : [2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100) ? few : many;

// ---------- cart ----------
function renderCartConfig(item) {
  const form = $('#sfCartConfig');
  form.reset();
  $('#sfCartChoices').replaceChildren(...[selectField('size', 'Размер', item.sizes), selectField('filling', 'Начинка', item.fillings), selectField('decoration', 'Оформление', item.decorations)].filter(Boolean));
  $('#sfCartChoices').hidden = !$('#sfCartChoices').children.length;
  const quantity = form.elements.quantity;
  quantity.min = String(item.minQuantity); quantity.max = String(item.maxQuantity); quantity.value = String(item.minQuantity);
  $('#sfCartError').textContent = ''; $('#sfCartAdded').hidden = true;
  updateCartEstimate();
}
const configLine = () => {
  const form = $('#sfCartConfig');
  return { itemId:state.item.id, size:form.elements.size?.value || '', filling:form.elements.filling?.value || '', decoration:form.elements.decoration?.value || '',
    quantity:Math.floor(Number(form.elements.quantity.value)) || 0 };
};
function updateCartEstimate() {
  const line = configLine();
  $('#sfCartEstimate').textContent = estimateText([lineEstimate(state.item, { ...line, quantity:Math.max(1, line.quantity) })]);
}
function addToCart(event) {
  event.preventDefault();
  const item = state.item, line = configLine(), error = $('#sfCartError');
  error.textContent = '';
  if (line.quantity < item.minQuantity || line.quantity > item.maxQuantity) { error.textContent = `Количество: от ${item.minQuantity} до ${item.maxQuantity} ${item.unit}.`; return; }
  const same = state.cart.find(entry => entry.itemId === line.itemId && entry.size === line.size && entry.filling === line.filling && entry.decoration === line.decoration);
  if (same) same.quantity = Math.min(item.maxQuantity, same.quantity + line.quantity);
  else if (state.cart.length >= 10) { error.textContent = 'В корзине уже 10 позиций. Оформите этот заказ, а остальное — следующей заявкой.'; return; }
  else state.cart.push({ key:uuid(), ...line });
  saveCart();
  const added = $('#sfCartAdded');
  added.replaceChildren(`«${item.title}» в корзине. `, h('button', { type:'button', class:'sf-link', onclick:openCart }, 'Перейти в корзину'),
    ' или ', h('button', { type:'button', class:'sf-link', onclick:() => $('#sfItemDialog').close() }, 'выбрать ещё'));
  added.hidden = false;
}
function openCart() {
  state.checkout = true; state.item = null; state.date = null; state.requestId = '';
  renderCart();
  if (!$('#sfItemDialog').open) $('#sfItemDialog').showModal();
  showPane('cart');
}
const cartEntries = () => state.cart.map(line => ({ line, item:catalogItem(line.itemId) })).filter(entry => entry.item);
const optionsText = line => [line.size, line.filling, line.decoration].filter(Boolean).join(' · ');
function renderCart() {
  const entries = cartEntries(), list = $('#sfCartList');
  $('#sfCartCheckout').hidden = !entries.length || !(state.shop.accepting || demoOnly());
  if (!entries.length) {
    list.replaceChildren(h('li', { class:'sf-cart-empty' }, 'Корзина пуста. Выберите изделие в каталоге.'));
    $('#sfCartTotal').textContent = '';
    return;
  }
  list.replaceChildren(...entries.map(({ line, item }) => {
    const estimate = lineEstimate(item, line);
    return h('li', { class:'sf-cart-line' },
      h('span', { class:'sf-cart-photo' }, item.mediaIds[0] ? h('img', { src:media(item.mediaIds[0]), alt:'' }) : h('span', { class:'sf-card-placeholder', 'aria-hidden':'true' }, item.title.slice(0, 1))),
      h('span', { class:'sf-cart-copy' }, h('strong', {}, item.title), h('small', {}, optionsText(line) || 'Варианты не выбраны'),
        h('small', {}, estimate ? `${estimate.from ? 'от ' : ''}${money(estimate.minor)}` : 'Цена по запросу')),
      h('input', { class:'sf-cart-qty', type:'number', inputmode:'numeric', min:String(item.minQuantity), max:String(item.maxQuantity), value:String(line.quantity),
        'aria-label':`Количество: ${item.title}`, onchange:event => {
          line.quantity = Math.min(item.maxQuantity, Math.max(item.minQuantity, Math.floor(Number(event.currentTarget.value)) || item.minQuantity));
          saveCart(); renderCart();
        } }),
      h('button', { type:'button', class:'sf-cart-remove', 'aria-label':`Убрать из корзины: ${item.title}`, onclick:() => {
        state.cart = state.cart.filter(entry => entry.key !== line.key); saveCart(); renderCart();
        $('#sfCartList button, #sfCartCheckout')?.focus();
      } }, '×'));
  }));
  $('#sfCartTotal').textContent = estimateText(entries.map(({ line, item }) => lineEstimate(item, line)));
}
// The whole order needs the longest lead time of its items.
const orderLead = () => Math.max(state.shop.calendar.leadDays || 0, ...(state.checkout ? cartEntries().map(({ item }) => item.leadDays || 0) : [state.item.leadDays || 0]));
function chooseDateStep() {
  const lead = orderLead();
  $('#sfLeadNote').textContent = lead ? `Ближайшая дата — через ${lead} ${plural(lead, 'день', 'дня', 'дней')}: столько нужно на изготовление.` : 'Выберите свободную дату.';
  state.month = addDays(state.shop.today, lead).slice(0, 7); showPane('date'); void loadMonth();
}

async function loadMonth() {
  const host = $('#sfCalendarState');
  host.textContent = 'Загружаем свободные даты…'; host.className = 'sf-calendar-state loading';
  const monthTitle = new Intl.DateTimeFormat('ru-RU', { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${state.month}-01T00:00:00Z`));
  $('#sfMonthTitle').textContent = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
  const today = state.shop.today, last = addDays(today, state.shop.calendar.horizonDays);
  $('#sfPrevMonth').disabled = state.month <= today.slice(0, 7);
  $('#sfNextMonth').disabled = state.month >= last.slice(0, 7);
  try {
    const target = state.checkout ? `items=${cartEntries().map(({ line }) => encodeURIComponent(line.itemId)).join(',')}` : `item=${encodeURIComponent(state.item.id)}`;
    const data = await api(`/availability?month=${state.month}&${target}`);
    host.textContent = ''; host.className = 'sf-calendar-state';
    renderMonth(data.dates);
    if (!data.dates.some(day => ['available','few'].includes(day.status))) {
      host.textContent = data.dates.some(day => day.status === 'full') ? 'В этом месяце свободных дат нет — выберите занятую дату, чтобы встать в лист ожидания, или посмотрите следующий месяц.' : 'В этом месяце нет дат для заказа. Посмотрите следующий месяц.';
      host.className = 'sf-calendar-state info';
    }
  } catch (error) {
    host.replaceChildren(error.message, ' ', h('button', { type:'button', class:'sf-link', onclick:loadMonth }, 'Повторить'));
    host.className = 'sf-calendar-state error'; $('#sfCalendar').replaceChildren();
  }
}

function renderMonth(dates) {
  const offset = (new Date(`${state.month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  $('#sfCalendar').replaceChildren(
    ...WEEKDAYS.map(day => h('span', { class:'sf-weekday', role:'columnheader' }, day)),
    ...Array.from({ length:offset }, () => h('span', { 'aria-hidden':'true' })),
    ...dates.map(day => h('button', { type:'button', role:'gridcell', class:`sf-day ${day.status}${state.date === day.date ? ' selected' : ''}`,
      disabled:day.status === 'unavailable', 'aria-label':`${dateText(day.date)}: ${DATE_LABEL[day.status]}`, 'aria-pressed':String(state.date === day.date),
      onclick:() => chooseDate(day) }, h('b', {}, Number(day.date.slice(8))), day.status === 'few' ? h('small', {}, 'мало') : day.status === 'full' ? h('small', {}, 'занято') : null)));
}

async function chooseDate(day) {
  state.date = day.date; state.dateStatus = day.status;
  state.mode = day.status === 'full' ? 'waitlist' : 'order';
  state.requestId = uuid();
  state.windows = [];
  if (pickupOn() && state.mode === 'order' && !demoOnly()) {
    try { state.windows = (await api(`/windows?date=${day.date}`)).windows; }
    catch { state.windows = state.shop.pickup.windows.map(label => ({ label, status:'available' })); }
  } else if (pickupOn()) state.windows = state.shop.pickup.windows.map(label => ({ label, status:'available' }));
  renderForm();
  showPane('form');
}

function renderPickup() {
  const field = $('#sfPickupField'), select = $('#sfPickup'), free = state.windows.filter(window => window.status !== 'full');
  field.hidden = state.mode === 'waitlist' || !pickupOn();
  if (field.hidden) { select.replaceChildren(); return; }
  select.replaceChildren(h('option', { value:'' }, free.length ? 'Выберите время' : 'Всё время на эту дату занято'),
    ...state.windows.map(window => h('option', { value:window.label, disabled:window.status === 'full' }, window.status === 'full' ? `${window.label} — занято` : window.label)));
}

function selectField(name, label, options) {
  if (!options.length) return null;
  return h('label', {}, label, h('select', { name }, h('option', { value:'' }, 'Не выбрано'),
    ...options.map(option => h('option', { value:option.label }, option.priceMinor === null ? option.label : `${option.label} — ${money(option.priceMinor)}`))));
}

function renderForm() {
  const form = $('#sfOrderForm'), item = state.item, waitlist = state.mode === 'waitlist', checkout = state.checkout;
  form.reset();
  const entries = checkout ? cartEntries() : [];
  const subject = checkout ? `${entries.length} ${plural(entries.length, 'позиция', 'позиции', 'позиций')} из корзины` : item.title;
  $('#sfFormTitle').textContent = waitlist ? 'Лист ожидания' : 'Заявка';
  $('#sfFormDate').textContent = waitlist
    ? `${dateText(state.date)} уже занято. Оставьте контакт — если место освободится, кондитерская свяжется с вами.`
    : `${subject} · ${dateText(state.date)}${state.dateStatus === 'few' ? ' · осталось мало мест' : ''}`;
  $('#sfFormLines').hidden = !checkout;
  $('#sfFormLines').replaceChildren(...entries.map(({ line, item: entry }) => h('li', { class:'sf-cart-line compact' },
    h('span', { class:'sf-cart-copy' }, h('strong', {}, `${entry.title} × ${line.quantity}`), optionsText(line) ? h('small', {}, optionsText(line)) : null))));
  $('#sfChoiceRow').replaceChildren(...(checkout ? [] : [selectField('size', 'Размер', item.sizes), selectField('filling', 'Начинка', item.fillings), selectField('decoration', 'Оформление', item.decorations)].filter(Boolean)));
  $('#sfChoiceRow').hidden = waitlist || !$('#sfChoiceRow').children.length;
  const quantity = form.elements.quantity;
  quantity.closest('label').hidden = waitlist || checkout;
  if (!checkout) { quantity.min = String(item.minQuantity); quantity.max = String(item.maxQuantity); quantity.value = String(item.minQuantity); }
  renderPickup();
  // A signed-in customer's details fill in by themselves.
  const profile = state.account?.profile;
  if (profile) { form.elements.customerName.value = profile.name; }
  $('#sfWishesField').firstChild.textContent = waitlist ? 'Комментарий' : 'Пожелания';
  form.elements.wishes.placeholder = waitlist ? 'Например, подойдёт и соседняя дата' : 'Надпись, цвет, повод, аллергии';
  $('#sfContactMethod').replaceChildren(...Object.entries(state.shop.contactMethods).map(([key, label]) => h('option', { value:key, selected:profile?.contactMethod === key }, label)));
  if (profile) $('#sfContactValue').value = profile.contactValue;
  syncContactHint();
  const offer = $('#sfAccountOffer');
  offer.hidden = waitlist || !accountsOn() || Boolean(state.account) || demoOnly();
  offer.replaceChildren(...(offer.hidden ? [] : ['Есть кабинет покупателя? ', h('button', { type:'button', class:'sf-link', onclick:() => openAccount(() => { renderForm(); }) }, 'Войдите'),
    ' — имя и контакт подставятся, а заказ учтётся для скидок.']));
  const shopName = state.shop.shop.name, privacy = state.shop.shop.privacyUrl;
  $('#sfConsentText').replaceChildren(`Передаю имя и контакт кондитерской «${shopName}», чтобы она ответила по ${waitlist ? 'листу ожидания' : 'заявке'}.`,
    ...(privacy ? [h('span', {}, ' ', h('a', { href:privacy, target:'_blank', rel:'noopener' }, 'Политика обработки данных'))] : []));
  $('#sfSubmit').textContent = waitlist ? 'Встать в лист ожидания' : state.shop.shop.action;
  $('#sfSubmit').disabled = demoOnly();
  $('#sfFormError').textContent = embedded ? 'Это предпросмотр в кабинете: заявки отсюда не отправляются.'
    : state.shop.preview ? 'Это предпросмотр: отправка заявок отключена до публикации витрины.' : '';
  updateEstimate();
}

function syncContactHint() {
  const method = $('#sfContactMethod').value, input = $('#sfContactValue');
  input.placeholder = CONTACT_HINTS[method] || '';
  input.type = method === 'email' ? 'email' : ['phone','whatsapp'].includes(method) ? 'tel' : 'text';
  input.autocomplete = method === 'email' ? 'email' : ['phone','whatsapp'].includes(method) ? 'tel' : 'off';
}

function updateEstimate() {
  const form = $('#sfOrderForm'), target = $('#sfEstimate');
  if (state.mode === 'waitlist') { target.textContent = ''; return; }
  if (state.checkout) { target.textContent = estimateText(cartEntries().map(({ line, item }) => lineEstimate(item, line))); return; }
  const line = { size:form.elements.size?.value || '', filling:form.elements.filling?.value || '', decoration:form.elements.decoration?.value || '',
    quantity:Math.max(1, Number(form.elements.quantity.value) || 1) };
  target.textContent = estimateText([lineEstimate(state.item, line)]);
}

async function submit(event) {
  event.preventDefault();
  if (state.submitting || demoOnly()) return;
  const form = event.currentTarget, error = $('#sfFormError'), button = $('#sfSubmit');
  error.textContent = '';
  const required = [form.elements.customerName, form.elements.contactValue];
  const missing = required.find(input => !input.value.trim());
  if (missing) { error.textContent = 'Укажите имя и контакт для ответа.'; missing.focus(); return; }
  if (!form.elements.consent.checked) { error.textContent = 'Подтвердите передачу контакта кондитерской.'; form.elements.consent.focus(); return; }
  const pickupWindow = state.mode === 'order' && pickupOn() ? form.elements.pickupWindow.value : '';
  if (state.mode === 'order' && pickupOn() && !pickupWindow) { error.textContent = 'Выберите время получения.'; form.elements.pickupWindow.focus(); return; }
  const common = { requestId:state.requestId, date:state.date, customerName:form.elements.customerName.value, contactMethod:form.elements.contactMethod.value,
    contactValue:form.elements.contactValue.value, consent:true, website:form.elements.website.value };
  const entries = state.checkout ? cartEntries() : [];
  state.submitting = true; button.disabled = true; button.setAttribute('aria-busy', 'true');
  try {
    if (state.mode === 'waitlist') {
      // The waitlist keeps one item; the rest of the cart goes into the comment.
      const summary = entries.map(({ line, item }) => `${item.title} × ${line.quantity}`).join(', ');
      const note = state.checkout ? `Корзина: ${summary}. ${form.elements.wishes.value}`.slice(0, 600) : form.elements.wishes.value;
      const result = await api('/waitlist', { ...common, ...(state.checkout ? { itemIds:entries.map(({ line }) => line.itemId) } : { itemId:state.item.id }), note });
      renderDone({ waitlist:true, demo:result.demo === true });
    } else if (state.checkout) {
      const lines = entries.map(({ line }) => ({ itemId:line.itemId, size:line.size, filling:line.filling, decoration:line.decoration, quantity:line.quantity }));
      const result = await api('/orders', { ...common, lines, pickupWindow, wishes:form.elements.wishes.value });
      if (!result.demo) { state.cart = []; saveCart(); }
      renderDone(result);
    } else {
      const result = await api('/orders', { ...common, itemId:state.item.id, quantity:Number(form.elements.quantity.value) || 1, pickupWindow,
        size:form.elements.size?.value || '', filling:form.elements.filling?.value || '', decoration:form.elements.decoration?.value || '', wishes:form.elements.wishes.value });
      renderDone(result);
    }
    if (state.account && state.mode === 'order') void loadAccount();
  } catch (failure) {
    error.textContent = failure.message;
    if (failure.code === 'CONFECTIONERY_DATE_FULL') {
      error.append(' ', h('button', { type:'button', class:'sf-link', onclick:() => { state.mode = 'waitlist'; state.dateStatus = 'full'; state.requestId = uuid(); renderForm(); } }, 'Встать в лист ожидания'));
    }
    if (failure.code === 'CONFECTIONERY_WINDOW_FULL') { state.requestId = uuid(); void chooseDate({ date:state.date, status:state.dateStatus }); }
    if (['CONFECTIONERY_DATE_FULL','CONFECTIONERY_DATE_UNAVAILABLE'].includes(failure.code)) { state.requestId = uuid(); void loadMonth(); }
  } finally { state.submitting = false; button.disabled = demoOnly(); button.removeAttribute('aria-busy'); }
}

function renderDone(result) {
  const pane = $('#sfDone'), shopName = state.shop.shop.name;
  if (result.demo) {
    pane.replaceChildren(h('div', { class:'sf-done-mark', 'aria-hidden':'true' }, '✓'), h('h2', {}, result.waitlist ? 'Так клиент встаёт в лист ожидания' : 'Так клиент отправляет заявку'),
      h('p', {}, result.waitlist
        ? `В вашей витрине клиент попал бы в лист ожидания на ${dateText(state.date, { day:'numeric', month:'long' })}, а вы увидели бы его в кабинете, когда дата освободится.`
        : 'В вашей витрине эта заявка пришла бы вам в кабинет с пометкой «Нужно связаться», а клиент получил бы ссылку, чтобы проверять статус.'),
      h('p', {}, 'Это демо: ничего не отправлено и не сохранено.'),
      h('button', { type:'button', class:'sf-button', onclick:() => $('#sfItemDialog').close() }, 'Вернуться к каталогу'));
  } else if (result.waitlist) {
    pane.replaceChildren(h('div', { class:'sf-done-mark', 'aria-hidden':'true' }, '✓'), h('h2', {}, 'Вы в листе ожидания'),
      h('p', {}, `Если ${dateText(state.date, { day:'numeric', month:'long' })} освободится, «${shopName}» свяжется с вами по указанному контакту.`),
      h('button', { type:'button', class:'sf-button', onclick:() => $('#sfItemDialog').close() }, 'Вернуться к каталогу'));
  } else {
    const link = result.token ? `${location.origin}${location.pathname}?order=${result.token}` : '';
    const what = result.lines?.length > 1 ? result.lines.map(line => `${line.itemTitle} × ${line.quantity}`).join(', ') : result.itemTitle;
    const when = `${dateText(result.date, { day:'numeric', month:'long' })}${result.pickupWindow ? `, ${result.pickupWindow}` : ''}`;
    pane.replaceChildren(...[h('div', { class:'sf-done-mark', 'aria-hidden':'true' }, '✓'), h('h2', {}, `Заявка №${result.number} отправлена`),
      h('p', {}, `${what} на ${when}. Статус: «${result.statusLabel}». Кондитерская свяжется с вами, чтобы подтвердить детали и стоимость.`),
      result.discountPercent ? h('p', { class:'sf-done-discount' }, `Скидка постоянного покупателя ${result.discountPercent}%${result.totalMinor !== null && result.totalMinor !== undefined ? `: ориентировочно ${result.estimateFrom ? 'от ' : ''}${money(result.totalMinor)}` : ''}.`) : null,
      state.account ? h('p', {}, 'Заявка уже в вашем кабинете покупателя.') : link ? h('p', { class:'sf-done-link' }, 'Статус заявки можно проверить по ссылке — сохраните её: ', h('a', { href:link }, 'открыть статус')) : null,
      h('button', { type:'button', class:'sf-button', onclick:() => $('#sfItemDialog').close() }, 'Готово')].filter(Boolean));
  }
  showPane('done');
}

async function showOrderStatus(token) {
  const host = $('#sfOrderStatus');
  host.hidden = false; host.replaceChildren(h('p', {}, 'Проверяем статус заявки…'));
  try {
    const order = await api(`/orders/${encodeURIComponent(token)}`);
    host.replaceChildren(h('p', { class:'sf-status-label' }, `Заявка №${order.number}`), h('h2', {}, order.statusLabel),
      h('p', {}, `${order.itemTitle} · ${dateText(order.date, { day:'numeric', month:'long', weekday:'long' })}${order.pickupWindow ? `, ${order.pickupWindow}` : ''}`));
    host.dataset.status = order.status;
  } catch (error) { host.replaceChildren(h('p', {}, error.message)); host.dataset.status = 'error'; }
}

// ---------- customer account: sign in by a one-time email code ----------
const signIn = { step:'email', email:'', code:'', after:null };
async function loadAccount() {
  if (!accountsOn()) return;
  try { const data = await api('/account'); state.account = data.customer; state.tiers = data.tiers || []; }
  catch { state.account = null; }
  renderTools();
  if ($('#sfAccountDialog').open) renderAccount();
}
function openAccount(after = null) {
  signIn.after = after; signIn.step = state.account ? 'home' : 'email';
  $('#sfAccountDialog').showModal();
  renderAccount();
}
function accountForm(fields, submitLabel, onSubmit) {
  const error = h('p', { class:'sf-error', role:'alert' });
  const button = h('button', { class:'sf-button sf-button-wide', type:'submit' }, submitLabel);
  const form = h('form', { class:'sf-form', novalidate:true, onsubmit:async event => {
    event.preventDefault(); error.textContent = '';
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { await onSubmit(event.currentTarget); }
    catch (failure) { error.textContent = failure.message; }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  } }, ...fields, error, button);
  return form;
}
const contactFields = profile => {
  const select = h('select', { name:'contactMethod' }, ...Object.entries(state.shop.contactMethods).map(([key, label]) => h('option', { value:key, selected:profile?.contactMethod === key }, label)));
  return [h('label', {}, 'Имя', h('input', { name:'name', maxlength:'80', autocomplete:'name', required:true, value:profile?.name || '' })),
    h('div', { class:'sf-row' }, h('label', {}, 'Как связаться', select), h('label', {}, 'Контакт', h('input', { name:'contactValue', maxlength:'120', required:true, value:profile?.contactValue || '' })))];
};
const profileBody = form => ({ name:form.elements.name.value, contactMethod:form.elements.contactMethod.value, contactValue:form.elements.contactValue.value });
async function signedIn(data) {
  state.account = data.customer; state.tiers = data.tiers || [];
  signIn.step = 'home'; signIn.code = '';
  renderTools(); renderAccount();
  const after = signIn.after; signIn.after = null;
  if (after) { $('#sfAccountDialog').close(); after(); }
}
// replaceChildren would print a skipped optional block as the text «null».
const fill = (host, ...nodes) => host.replaceChildren(...nodes.filter(node => node !== null && node !== undefined && node !== false));
function renderAccount() {
  const host = $('#sfAccount'), shopName = state.shop.shop.name;
  if (state.account) { renderAccountHome(host); return; }
  const tiers = state.tiers.filter(tier => tier.percent > 0 || tier.priority);
  if (signIn.step === 'code') {
    host.replaceChildren(h('h2', { id:'sfAccountTitle', tabindex:'-1' }, 'Введите код'),
      h('p', {}, `Мы отправили шесть цифр на ${signIn.email}. Код действует 10 минут.`),
      accountForm([h('label', {}, 'Код из письма', h('input', { name:'code', inputmode:'numeric', autocomplete:'one-time-code', maxlength:'6', pattern:'[0-9]{6}', required:true }))], 'Войти',
        async form => {
          signIn.code = form.elements.code.value.trim();
          const data = await api('/account/verify', { email:signIn.email, code:signIn.code });
          if (data.needsProfile) { signIn.step = 'profile'; renderAccount(); return; }
          await signedIn(data);
        }),
      h('p', { class:'sf-account-links' }, h('button', { type:'button', class:'sf-link', onclick:() => { signIn.step = 'email'; renderAccount(); } }, 'Изменить почту')));
  } else if (signIn.step === 'profile') {
    const privacy = state.shop.shop.privacyUrl;
    host.replaceChildren(h('h2', { id:'sfAccountTitle', tabindex:'-1' }, 'Как к вам обращаться'),
      h('p', {}, 'Имя и контакт подставятся в следующие заявки. Изменить их можно в кабинете.'),
      accountForm([...contactFields(null),
        h('label', { class:'sf-check' }, h('input', { type:'checkbox', name:'consent', required:true }),
          h('span', {}, `Разрешаю «${shopName}» хранить моё имя, контакт и историю заказов для заказов и скидок. Аккаунт можно удалить в любой момент.`,
            ...(privacy ? [' ', h('a', { href:privacy, target:'_blank', rel:'noopener' }, 'Политика обработки данных')] : [])))], 'Создать кабинет',
        async form => {
          if (!form.elements.consent.checked) throw new Error('Подтвердите согласие на хранение данных.');
          await signedIn(await api('/account/verify', { email:signIn.email, code:signIn.code, profile:profileBody(form), consent:true }));
        }));
  } else {
    fill(host, h('h2', { id:'sfAccountTitle', tabindex:'-1' }, 'Кабинет покупателя'),
      h('p', {}, 'Вход по почте, без пароля. Имя и контакт сохранятся для следующих заявок, а все заказы будут в одном месте.'),
      tiers.length ? h('div', { class:'sf-tiers' }, h('strong', {}, 'Постоянным покупателям'), h('ul', {}, ...tiers.map(tier => h('li', {}, tier.label)))) : null,
      accountForm([h('label', {}, 'Почта', h('input', { name:'email', type:'email', autocomplete:'email', maxlength:'120', required:true, value:signIn.email }))], 'Получить код',
        async form => {
          signIn.email = form.elements.email.value.trim();
          await api('/account/code', { email:signIn.email });
          signIn.step = 'code'; renderAccount();
        }),
      h('p', { class:'sf-account-note' }, 'Заказать можно и без входа. Кабинет работает на Vertux Nexus.'));
  }
  $('#sfAccountTitle').focus();
}
function standingNode(standing) {
  if (!standing) return null;
  const lines = [];
  if (standing.percent) lines.push(h('strong', {}, `Ваша скидка: ${standing.label}`));
  if (standing.upcoming) {
    const left = standing.upcoming.basis === 'orders' ? `${standing.upcoming.remaining} ${plural(standing.upcoming.remaining, 'заказ', 'заказа', 'заказов')}` : money(standing.upcoming.remaining);
    lines.push(h('span', {}, `Ещё ${left} до скидки ${standing.upcoming.percent}%`));
  }
  if (standing.priority) lines.push(h('span', {}, 'В загруженные дни кондитерская держит для вас места.'));
  return lines.length ? h('div', { class:'sf-standing' }, ...lines) : null;
}
function renderAccountHome(host) {
  const account = state.account, profile = account.profile;
  const orders = account.orders.length ? h('ol', { class:'sf-history' }, ...account.orders.map(order => h('li', {},
    h('span', { class:'sf-history-head' }, h('strong', {}, `№${order.number} · ${dateText(order.date, { day:'numeric', month:'long' })}${order.pickupWindow ? `, ${order.pickupWindow}` : ''}`), h('em', {}, order.statusLabel)),
    h('small', {}, order.lines.map(line => `${line.itemTitle} × ${line.quantity}`).join(', ')),
    order.totalMinor !== null && order.totalMinor !== undefined ? h('small', {}, `${order.estimateFrom ? 'от ' : ''}${money(order.totalMinor)}${order.discountPercent ? ` · скидка ${order.discountPercent}%` : ''}`) : null)))
    : h('p', { class:'sf-account-note' }, 'Заказов пока нет. Оформленные после входа заявки появятся здесь.');
  fill(host, h('h2', { id:'sfAccountTitle', tabindex:'-1' }, `Здравствуйте, ${profile.name}`),
    h('p', { class:'sf-account-note' }, profile.email),
    standingNode(account.standing),
    h('h3', {}, 'Мои заказы'), orders,
    h('details', { class:'sf-account-edit' }, h('summary', {}, 'Имя и контакт'),
      accountForm(contactFields(profile), 'Сохранить', async form => {
        const data = await api('/account', profileBody(form), 'PUT');
        state.account = data.customer; renderTools(); renderAccount();
      })),
    h('div', { class:'sf-account-actions' },
      h('button', { type:'button', class:'sf-button sf-button-ghost', onclick:async () => {
        try { await api('/account/logout', {}); } catch { /* the session may already be closed */ }
        state.account = null; signIn.step = 'email'; renderTools(); renderAccount();
      } }, 'Выйти'),
      h('button', { type:'button', class:'sf-link', onclick:async () => {
        if (!confirm('Удалить кабинет покупателя? Имя, контакт и скидки удалятся. Заявки останутся у кондитерской.')) return;
        try { await api('/account/delete', { confirm:true }); state.account = null; signIn.step = 'email'; renderTools(); renderAccount(); }
        catch (error) { alert(error.message); }
      } }, 'Удалить кабинет')));
  $('#sfAccountTitle').focus();
}

// ---------- cabinet preview and edit mode ----------
function post(type, detail = {}) {
  if (embedded) window.parent.postMessage({ channel:'cx-preview', type, ...detail }, location.origin);
}
function applyEditing() {
  const regions = editor.on && editor.canStorefront;
  document.documentElement.classList.toggle('sf-editing', editor.on);
  $$('[data-edit]').forEach(region => {
    region.toggleAttribute('data-edit-off', !regions);
    if (regions) { region.tabIndex = 0; region.setAttribute('role', 'button'); region.setAttribute('aria-label', `Изменить: ${region.dataset.editLabel}`); }
    else { region.removeAttribute('tabindex'); region.removeAttribute('role'); region.removeAttribute('aria-label'); }
  });
}
function setEditing(message) {
  const next = { on:message.edit === true, canCatalog:message.canCatalog === true, canStorefront:message.canStorefront === true };
  const changed = next.on !== editor.on || next.canCatalog !== editor.canCatalog || next.canStorefront !== editor.canStorefront;
  Object.assign(editor, next);
  if (changed && state.shop) renderShop();
}
// Region clicks are captured before links and the item dialog can react.
function onEditClick(event) {
  if (!editor.on || !editor.canStorefront) return;
  const region = event.target.closest('[data-edit]:not([data-edit-off])');
  if (!region) return;
  event.preventDefault(); event.stopPropagation();
  post('edit', { target:region.dataset.edit });
}
function onEditKey(event) {
  if (!editor.on || !['Enter',' '].includes(event.key) || !event.target.matches?.('[data-edit]:not([data-edit-off])')) return;
  event.preventDefault(); post('edit', { target:event.target.dataset.edit });
}
async function reload() {
  try { state.shop = await api(); loadCart(); renderShop(); }
  catch (error) { post('error', { message:error.message }); }
}
function applyDraft(draft) {
  if (!state.shop || !draft || typeof draft !== 'object') return;
  const shop = state.shop.shop;
  for (const key of ['name','tagline','description','orderNote']) if (typeof draft[key] === 'string') shop[key] = draft[key];
  if (draft.contacts && typeof draft.contacts === 'object') shop.contacts = { ...draft.contacts };
  if ('logoMediaId' in draft) shop.logoMediaId = draft.logoMediaId || null;
  if (Array.isArray(draft.coverMediaIds)) shop.coverMediaIds = draft.coverMediaIds.filter(id => typeof id === 'string');
  renderShop();
}

// Drag cards with a mouse, or with a finger on the handle; the card follows the
// pointer and the grid reorders under it. Arrow keys on the handle do the same.
const cardOrder = () => $$('#sfCatalog .sf-card[data-id]').map(card => card.dataset.id);
// The moved DOM becomes the page state, so a later re-render keeps the new order.
function sendOrder() {
  const ids = cardOrder();
  state.shop.catalog.sort((left, right) => ids.indexOf(left.id) - ids.indexOf(right.id));
  post('reorder', { ids });
}
function announce(text) {
  let live = $('#sfLive');
  if (!live) { live = h('p', { id:'sfLive', class:'sf-hp', role:'status', 'aria-live':'polite' }); document.body.append(live); }
  live.textContent = text;
}
function moveByKey(event, id) {
  const delta = { ArrowLeft:-1, ArrowUp:-1, ArrowRight:1, ArrowDown:1 }[event.key];
  if (!delta) return;
  event.preventDefault();
  const cards = $$('#sfCatalog .sf-card[data-id]'), index = cards.findIndex(card => card.dataset.id === id), target = cards[index + delta];
  if (!target) return;
  const card = cards[index];
  if (delta < 0) target.before(card); else target.after(card);
  card.querySelector('.sf-handle').focus();
  announce(`«${card.querySelector('strong').textContent}» теперь на месте ${index + delta + 1} из ${cards.length}`);
  sendOrder();
}
function onDragStart(event) {
  if (!editor.on || !editor.canCatalog || editor.drag) return;
  const card = event.target.closest('#sfCatalog .sf-card[data-id]');
  if (!card || event.target.closest('.sf-card-edit')) return;
  if (event.pointerType === 'mouse' ? event.button !== 0 : !event.target.closest('.sf-handle')) return;
  editor.drag = { card, id:event.pointerId, x:event.pageX, y:event.pageY, left:card.offsetLeft, top:card.offsetTop, started:false, before:cardOrder().join() };
}
function onDragMove(event) {
  const drag = editor.drag;
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.started) {
    if (Math.hypot(event.pageX - drag.x, event.pageY - drag.y) < 6) return;
    drag.started = true; drag.card.classList.add('sf-dragging'); document.documentElement.classList.add('sf-drag-active');
  }
  event.preventDefault();
  const below = document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest?.('#sfCatalog .sf-card[data-id]')).find(card => card && card !== drag.card);
  if (below) {
    const cards = $$('#sfCatalog .sf-card[data-id]');
    if (cards.indexOf(below) < cards.indexOf(drag.card)) below.before(drag.card); else below.after(drag.card);
  }
  const dx = drag.left + event.pageX - drag.x - drag.card.offsetLeft, dy = drag.top + event.pageY - drag.y - drag.card.offsetTop;
  drag.card.style.setProperty('transform', `translate(${dx}px, ${dy}px)`);
  if (event.clientY < 70) window.scrollBy(0, -14); else if (event.clientY > innerHeight - 70) window.scrollBy(0, 14);
}
function onDragEnd(event) {
  const drag = editor.drag;
  if (!drag || event.pointerId !== drag.id) return;
  editor.drag = null;
  if (!drag.started) return;
  drag.card.classList.remove('sf-dragging'); drag.card.style.removeProperty('transform');
  document.documentElement.classList.remove('sf-drag-active');
  editor.suppressClick = true; setTimeout(() => { editor.suppressClick = false; }, 0);
  if (cardOrder().join() !== drag.before) {
    drag.card.classList.add('sf-moved');
    announce(`Порядок изменён: «${drag.card.querySelector('strong').textContent}» на месте ${cardOrder().indexOf(drag.card.dataset.id) + 1}`);
    sendOrder();
  }
}
function bindEmbedded() {
  if (!embedded) return;
  document.documentElement.dataset.embed = 'cabinet';
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.channel !== 'cx-cabinet') return;
    if (message.type === 'mode') setEditing(message);
    else if (message.type === 'refresh') void reload();
    else if (message.type === 'draft') applyDraft(message.shop);
  });
  document.addEventListener('click', onEditClick, true);
  document.addEventListener('keydown', onEditKey, true);
  document.addEventListener('pointerdown', onDragStart);
  document.addEventListener('pointermove', onDragMove, { passive:false });
  document.addEventListener('pointerup', onDragEnd);
  document.addEventListener('pointercancel', onDragEnd);
  document.addEventListener('dragstart', event => { if (editor.on) event.preventDefault(); });
}

function fatal(title, text) {
  $('#sfBoot').hidden = true; $('#sfPage').hidden = true;
  $('#sfFatalTitle').textContent = title; $('#sfFatalText').textContent = text; $('#sfFatal').hidden = false;
}

function bind() {
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('[data-back]').forEach(button => button.addEventListener('click', () => {
    // From the date step the cart goes back to the cart, a single item to its card.
    const target = button.dataset.back === 'details' && state.checkout ? 'cart' : button.dataset.back;
    if (target === 'cart') renderCart();
    showPane(target); if (target === 'date') void loadMonth();
  }));
  $('#sfChooseDate').addEventListener('click', chooseDateStep);
  $('#sfCartConfig').addEventListener('submit', addToCart);
  $('#sfCartConfig').addEventListener('input', updateCartEstimate);
  $('#sfCartCheckout').addEventListener('click', chooseDateStep);
  $('#sfCartButton').addEventListener('click', openCart);
  $('#sfAccountButton').addEventListener('click', () => openAccount());
  $('#sfPrevMonth').addEventListener('click', () => { state.month = monthShift(state.month, -1); void loadMonth(); });
  $('#sfNextMonth').addEventListener('click', () => { state.month = monthShift(state.month, 1); void loadMonth(); });
  $('#sfOrderForm').addEventListener('submit', submit);
  $('#sfOrderForm').addEventListener('input', updateEstimate);
  $('#sfContactMethod').addEventListener('change', syncContactHint);
  $('#sfFatalRetry').addEventListener('click', () => location.reload());
  // The close event arrives as a later task: skip it if the dialog was opened again meanwhile.
  $('#sfItemDialog').addEventListener('close', event => { if (!event.currentTarget.open) { state.requestId = ''; state.checkout = false; } });
}

async function start() {
  try { state.shop = await api(); }
  catch (error) {
    if (leadDemo && [404,410].includes(error.status)) fatal('Демо удалено', 'Демо витрины хранится не больше 14 дней. Если нужна новая ссылка, ответьте на наше сообщение.');
    else fatal(error.status === 404 ? 'Витрина не найдена' : 'Витрина недоступна', error.status === 404 ? 'Проверьте адрес или спросите ссылку у кондитерской.' : error.message);
    post('error', { message:error.message });
    return;
  }
  loadCart();
  bind(); bindEmbedded(); renderShop();
  $('#sfBoot').hidden = true; $('#sfPage').hidden = false;
  post('ready');
  void loadAccount();
  const token = new URL(location.href).searchParams.get('order');
  if (token && !leadDemo) void showOrderStatus(token);
}

void start();
