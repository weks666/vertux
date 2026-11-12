const createAccountServiceAdapter = () => ({}); // Service Center is not part of the website demo.

// Owner cabinet of the confectionery template. The server re-checks the Nexus
// session, membership, role and subscription on every request; this page only
// renders what the API returns and never stores customer data in the browser.
const productId = '00000000-0000-4000-8000-00000000c0de';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const SECTIONS = ['orders','calendar','waitlist','catalog','storefront','customers'];
const SYSTEM_ACTIONS = ['subscription','support','settings','profile'];
const VIEWS = { orders:'Заказы', calendar:'Календарь', waitlist:'Лист ожидания', catalog:'Каталог', storefront:'Витрина', customers:'Покупатели',
  subscription:'Подписка', support:'Поддержка', settings:'Настройки', profile:'Профиль' };
// Subscription and support share the Service Center view.
const VIEW_SECTION = { subscription:'service', support:'service' };
const ROLE_LABELS = { owner:'Владелец', admin:'Администратор', manager:'Менеджер', viewer:'Наблюдатель', vertux_setup:'Настройка Vertux' };
// Views that show orders, customers or billing; Vertux setup mode never opens them.
const PRIVATE_VIEWS = new Set(['orders','waitlist','subscription','support','customers']);
const LIGHT_DEFAULT = Object.freeze({ style:'off', color:null, intensity:30 });
const HEX = /^#[0-9A-F]{6}$/iu;
const DEFAULT_PREFS = { theme:'confectionery', accent:null, background:null, cardLight:{ ...LIGHT_DEFAULT }, wallpaper:null, order:[...SECTIONS], hidden:[], pinned:[], compact:false,
  shortcuts:{ orders:'Alt+1', calendar:'Alt+2', waitlist:'Alt+3', catalog:'Alt+4', storefront:'Alt+5', customers:'', subscription:'', support:'', settings:'Alt+0', profile:'' } };
const THEME_SURFACE = { confectionery:'#FFF8F1', chocolate:'#1E1510', nexus:'#131318' };
const SHOP_SURFACE = { cream:'#FFF8F1', white:'#FFFFFF', blush:'#FFF4F3', chocolate:'#21150F' };
const DOMAIN_STATES = { none:['Не подключён',''], pending:['Ждёт проверки DNS','trial'], verified:['Подключён','active'] };
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const STATUS_FLOW = ['new','contacted','confirmed','in_progress','ready','completed'];
const DATE_STATE = { available:'Свободно', few:'Мало мест', full:'Занято', unavailable:'Не принимаем' };
const REASONS = { lead_time:'раньше минимального срока', horizon:'дальше горизонта приёма', closed:'закрыто вручную', booked:'отмечено занятым', day_off:'выходной', capacity:'лимит исчерпан', not_configured:'календарь не настроен' };
const state = { me:null, context:null, prefs:structuredClone(DEFAULT_PREFS), otherProducts:[], view:'orders', settingsPage:'appearance', shopDraft:null,
  filter:'', month:'', selectedDate:null, orders:[], items:[], waitlist:[], calendar:null, editing:null, itemMedia:[], logoId:null, coverIds:[], poll:null,
  customers:[], customerFilter:'all', customerSearch:'', customerTab:'list', loyaltyDraft:null,
  preview:{ loaded:false, ready:false, mode:'view', device:'desktop', dirty:false, draftFrame:0, orderTimer:0, readyTimer:0 } };

function h(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') element.className = value;
    else if (key === 'dataset') Object.assign(element.dataset, value);
    else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
    else element.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) element.append(child instanceof Node ? child : String(child));
  return element;
}
function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); shape.setAttribute('d', path); svg.append(shape);
  return svg;
}
const money = minor => minor === null || minor === undefined ? '' : `${(minor / 100).toLocaleString('ru-RU', { maximumFractionDigits:2 })} ₽`;
const dateText = (date, options = { day:'numeric', month:'long', weekday:'short' }) => new Intl.DateTimeFormat('ru-RU', { ...options, timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`));
const timeText = value => new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
const monthShift = (month, delta) => { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); return date.toISOString().slice(0, 7); };
const can = capability => state.context?.capabilities?.[capability] === true;
// Tariff features: a domain and priority places. Without plan data everything stays open.
const planAllows = feature => state.context?.plan?.[feature] !== false;
const setup = () => state.context?.setup === true;

async function request(path, { method = 'GET', body } = {}) {
  const headers = { Accept:'application/json' };
  if (method !== 'GET') { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = state.me?.csrfToken || ''; }
  let response;
  try { response = await fetch(path, { method, headers, credentials:'same-origin', cache:'no-store', ...(method === 'GET' ? {} : { body:JSON.stringify(body ?? {}) }) }); }
  catch { throw Object.assign(new Error('Нет связи с Nexus. Проверьте интернет и повторите.'), { code:'NETWORK' }); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok !== true) throw Object.assign(new Error(payload.error?.message || 'Действие не выполнено. Повторите.'), { code:payload.error?.code, status:response.status });
  return payload.data;
}
const api = (section, options) => request(`/api/confectionery/${encodeURIComponent(productId)}/${section}`, options);

let toastTimer = null;
function toast(message, error = false) {
  // Sonner-style stack (toaster.js); the old single toast stays as a fallback.
  if (window.NexusToaster) { window.NexusToaster.show(message, { kind: error ? 'error' : 'success' }); return; }
  const element = $('#cxToast'); element.textContent = message; element.hidden = false; element.classList.toggle('cx-toast-error', error);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; }, 4200);
}
function setState(element, message, kind = '') {
  element.replaceChildren(); element.className = `cx-state${kind ? ` ${kind}` : ''}`;
  if (message) element.append(message instanceof Node ? message : h('p', {}, message));
}
function busy(button, active) { if (button) { button.disabled = active; button.setAttribute('aria-busy', String(active)); } }

// ---------- colors: a custom accent keeps readable text on the chosen background ----------
const rgb = hex => { const value = parseInt(hex.slice(1), 16); return [value >> 16 & 255, value >> 8 & 255, value & 255]; };
const mix = (hex, target, ratio) => `#${rgb(hex).map((channel, index) => Math.round(channel + (rgb(target)[index] - channel) * ratio).toString(16).padStart(2, '0')).join('')}`;
const luminance = hex => rgb(hex).map(channel => { const value = channel / 255; return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; })
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light + 0.05) / (dark + 0.05); };
function readable(accent, surface) {
  const target = luminance(surface) > 0.5 ? '#000000' : '#FFFFFF';
  for (let ratio = 0; ratio <= 0.9; ratio += 0.05) { const color = mix(accent, target, ratio); if (contrast(color, surface) >= 4.5) return color; }
  return target === '#000000' ? '#2B1A10' : '#FFFFFF';
}
function accentTokens(accent, surface) {
  const light = luminance(surface) > 0.5;
  return { '--accent':accent, '--accent-hover':mix(accent, light ? '#000000' : '#FFFFFF', 0.12), '--accent-2':readable(accent, surface),
    '--accent-dark':mix(accent, '#000000', 0.25), '--on-accent':contrast(accent, '#FFFFFF') >= contrast(accent, '#2A1A0E') ? '#FFFFFF' : '#2A1A0E' };
}
function paint(element, tokens) {
  for (const name of ['--accent','--accent-hover','--accent-2','--accent-dark','--on-accent']) element.style.removeProperty(name);
  for (const [name, value] of Object.entries(tokens || {})) element.style.setProperty(name, value);
}

// ---------- personal look, menu and shortcuts ----------
function remember(key, value) { try { localStorage.setItem(key, value); } catch { /* the look is reapplied from the account */ } }
// Card lighting and a background photo dimmed by the page colour, as in Invest.
function paintLook(element, { background, cardLight, wallpaper }, { bgName, prefix }) {
  const light = cardLight || LIGHT_DEFAULT, strength = Math.max(0, Math.min(100, Number(light.intensity ?? 30)));
  if (background) element.style.setProperty(bgName, background); else element.style.removeProperty(bgName);
  if (['diffuse','full','corner'].includes(light.style)) element.dataset.cardLight = light.style; else delete element.dataset.cardLight;
  element.style.setProperty(`--${prefix}-light`, light.color || 'var(--accent)');
  element.style.setProperty(`--${prefix}-light-strength`, `${Math.round(strength * 0.4)}%`);
  element.style.setProperty(`--${prefix}-light-soft`, `${Math.round(strength * 0.14)}%`);
  if (wallpaper?.url) {
    element.dataset.wallpaper = '';
    element.style.setProperty(`--${prefix}-wallpaper`, `url("${wallpaper.url}")`);
    element.style.setProperty(`--${prefix}-wallpaper-shade`, `${wallpaper.shade}%`);
  } else { delete element.dataset.wallpaper; element.style.removeProperty(`--${prefix}-wallpaper`); }
}
function applyLook() {
  const { theme, accent, background, cardLight, wallpaper } = state.prefs, root = document.documentElement;
  root.dataset.cabinetTheme = theme;
  paint(root, accent ? accentTokens(accent, THEME_SURFACE[theme]) : null);
  paintLook(root, { background, cardLight, wallpaper:wallpaper && { url:wallpaper.data, shade:wallpaper.shade } }, { bgName:'--bg', prefix:'cx' });
  $('meta[name="theme-color"]')?.setAttribute('content', background || THEME_SURFACE[theme]);
  // The photo stays in the account settings only: it is too large to keep per device.
  remember('cx-cabinet-look', JSON.stringify({ theme, accent, background, cardLight }));
}
function restoreLook() {
  try {
    const saved = JSON.parse(localStorage.getItem('cx-cabinet-look') || 'null');
    if (saved && THEME_SURFACE[saved.theme]) {
      state.prefs.theme = saved.theme; state.prefs.accent = HEX.test(saved.accent || '') ? saved.accent : null;
      state.prefs.background = HEX.test(saved.background || '') ? saved.background : null;
      if (['diffuse','full','corner','off'].includes(saved.cardLight?.style)) state.prefs.cardLight = { style:saved.cardLight.style,
        color:HEX.test(saved.cardLight.color || '') ? saved.cardLight.color : null, intensity:Number.isInteger(saved.cardLight.intensity) ? saved.cardLight.intensity : 30 };
      applyLook();
    }
  } catch { /* first visit on this device */ }
}

const customersOn = () => state.context?.ordering?.accounts === true && can('viewCustomers');
const allowedView = view => VIEWS[view] && !(setup() && PRIVATE_VIEWS.has(view)) && (view !== 'customers' || customersOn());
function menuSections() {
  const { order, pinned } = state.prefs, all = [...new Set([...order, ...SECTIONS])].filter(id => SECTIONS.includes(id));
  return [...all.filter(id => pinned.includes(id)), ...all.filter(id => !pinned.includes(id))];
}
function visibleSections() {
  const allowed = menuSections().filter(allowedView), shown = allowed.filter(id => !state.prefs.hidden.includes(id));
  return shown.length ? shown : allowed;
}
const homeView = () => visibleSections()[0] || 'catalog';
const shortcutHint = action => state.prefs.shortcuts[action] ? ` (${state.prefs.shortcuts[action]})` : '';

function renderMenu() {
  const nav = $('#cxNav'), visible = visibleSections();
  for (const id of menuSections()) {
    const button = $(`[data-section="${id}"]`, nav);
    nav.append(button);
    button.hidden = !visible.includes(id);
    button.classList.toggle('is-pinned', state.prefs.pinned.includes(id));
    button.title = `${VIEWS[id]}${shortcutHint(id)}`;
    if (state.prefs.shortcuts[id]) button.setAttribute('aria-keyshortcuts', state.prefs.shortcuts[id]); else button.removeAttribute('aria-keyshortcuts');
  }
  $$('.cx-foot [data-view-link]').forEach(button => {
    const action = button.dataset.viewLink;
    button.hidden = !allowedView(action);
    button.title = `${VIEWS[action]}${shortcutHint(action)}`;
  });
  document.body.classList.toggle('cx-compact', state.prefs.compact);
  $('#cxCollapse').setAttribute('aria-label', state.prefs.compact ? 'Развернуть меню' : 'Свернуть меню');
  $('#cxCollapse').title = $('#cxCollapse').getAttribute('aria-label');
  renderMobileNav(visible);
  markActive();
}

// The phone bar keeps the first four sections; everything else lives in «Ещё».
function renderMobileNav(visible) {
  const main = visible.slice(0, 4), rest = visible.slice(4);
  const link = (view, label) => h('button', { type:'button', dataset:{ viewLink:view } }, label);
  $('#cxMobileNav').replaceChildren(...main.map(id => link(id, VIEWS[id])), h('button', { type:'button', dataset:{ more:'' }, 'aria-expanded':String(!$('#cxMore').hidden), 'aria-controls':'cxMore' }, 'Ещё'));
  $('#cxMore').replaceChildren(
    ...rest.map(id => link(id, VIEWS[id])),
    ...SYSTEM_ACTIONS.filter(allowedView).map(id => link(id, VIEWS[id])),
    ...(state.otherProducts.length ? [h('a', { href:'/launch?choose=1' }, 'Другие продукты')] : []),
    ...(state.context ? [h('a', { href:state.context.publicPath, target:'_blank', rel:'noopener' }, 'Открыть витрину')] : []));
}
function markActive() {
  $$('[data-view-link]').forEach(button => {
    const active = button.dataset.viewLink === state.view;
    button.classList.toggle('active', active);
    button.toggleAttribute('aria-current', active);
  });
}

let saveTimer = null, savedPrefs = null;
function updatePrefs(change, { immediate = false } = {}) {
  savedPrefs ??= structuredClone(state.prefs);
  change(state.prefs);
  applyLook(); renderMenu();
  if (state.view === 'settings') renderSettingsPage();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePrefs, immediate ? 0 : 450);
}
async function savePrefs() {
  const status = $('#cxSettingsStatus'), before = savedPrefs; savedPrefs = null;
  status.textContent = 'Сохраняем…';
  try { state.prefs = await api('preferences', { method:'PUT', body:state.prefs }); status.textContent = 'Сохранено в вашем аккаунте'; }
  catch (error) {
    status.textContent = '';
    toast(error.message, true);
    if (before) state.prefs = before;
  }
  applyLook(); renderMenu();
  if (state.view === 'settings') renderSettingsPage();
}

const CODE_KEYS = { Comma:',', Period:'.', Slash:'/', Semicolon:';', Quote:"'", BracketLeft:'[', BracketRight:']', Backslash:'\\', Backquote:'`', Equal:'=', Minus:'-' };
// Physical keys keep Alt shortcuts the same on Russian and English layouts.
function comboFromEvent(event) {
  let key = null;
  if (/^Key[A-Z]$/u.test(event.code)) key = event.code.slice(3);
  else if (/^(?:Digit|Numpad)\d$/u.test(event.code)) key = event.code.slice(-1);
  else if (/^F(?:[1-9]|1[0-2])$/u.test(event.code)) key = event.code;
  else if (CODE_KEYS[event.code]) key = CODE_KEYS[event.code];
  if (!key) return null;
  const modifiers = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean);
  if (!modifiers.some(modifier => modifier !== 'Shift') || modifiers.length > 3) return null;
  return [...modifiers, key].join('+');
}
function onShortcut(event) {
  if (event.repeat || event.defaultPrevented || event.target.closest?.('[data-shortcut-for]') || document.querySelector('dialog[open]')) return;
  const combo = comboFromEvent(event);
  if (!combo) return;
  const action = Object.entries(state.prefs.shortcuts).find(([, value]) => value === combo)?.[0];
  if (!action || !allowedView(action)) return;
  event.preventDefault();
  showView(action);
}

// ---------- contact links: only safe schemes, built from validated values ----------
function contactLink(method, value) {
  const digits = value.replace(/[^\d+]/gu, '');
  if (method === 'phone' && /^\+?\d{6,15}$/u.test(digits)) return `tel:${digits}`;
  if (method === 'whatsapp' && /^\+?\d{6,15}$/u.test(digits)) return `https://wa.me/${digits.replace('+', '')}`;
  if (method === 'telegram') { const name = value.replace(/^@|^https:\/\/t\.me\//u, ''); if (/^[A-Za-z0-9_]{4,32}$/u.test(name)) return `https://t.me/${name}`; }
  if (method === 'email' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value)) return `mailto:${value}`;
  if (method === 'vk' && /^https:\/\/(?:m\.)?vk\.com\/[A-Za-z0-9_.]{1,64}$/u.test(value)) return value;
  return null;
}
function contactNode(method, value) {
  const label = state.context.options.contactMethods[method] || method, href = contactLink(method, value);
  return h('span', { class:'cx-contact' }, h('small', {}, label), href ? h('a', { href, ...(href.startsWith('https:') ? { target:'_blank', rel:'noopener' } : {}) }, value) : h('span', {}, value));
}

// ---------- shell ----------
function showView(view, { focus = true } = {}) {
  if (!allowedView(view)) view = homeView();
  state.view = view;
  const section = VIEW_SECTION[view] || view;
  $$('.view').forEach(element => element.classList.toggle('active', element.dataset.view === section));
  markActive();
  closeMore();
  $('#cxTitle').textContent = VIEWS[view];
  if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  renderOnboarding();
  if (focus) $('#cxTitle').focus({ preventScroll:true });
  const loaders = { orders:loadOrders, calendar:loadCalendar, catalog:loadCatalog, storefront:renderStorefront, waitlist:loadWaitlist, customers:loadCustomers,
    subscription:renderService, support:renderService, settings:renderSettings, profile:renderProfile };
  void loaders[view]();
}
function closeMore() {
  $('#cxMore').hidden = true;
  $('[data-more]')?.setAttribute('aria-expanded', 'false');
}

function renderOnboarding() {
  const onboarding = state.context?.onboarding, panel = $('#cxOnboarding');
  const show = onboarding && (!onboarding.readyToPublish || !onboarding.published) && ['orders','catalog','calendar','storefront'].includes(state.view);
  panel.hidden = !show;
  if (!show) return;
  const target = { storefront:'storefront', calendar:'calendar', catalog:'catalog' };
  const steps = [...onboarding.steps, { key:'publish', label:'Опубликовать витрину', done:onboarding.published }];
  $('#cxSteps').replaceChildren(...steps.map((step, index) => h('li', { class:step.done ? 'done' : '' },
    h('button', { type:'button', onclick:() => showView(target[step.key] || 'storefront') },
      h('b', { 'aria-hidden':'true' }, step.done ? '✓' : String(index + 1)), h('span', {}, step.label), h('small', {}, step.done ? 'Готово' : 'Настроить')))));
}

function renderShell() {
  const context = state.context, storefront = context.storefront;
  document.title = `${context.product.name} · кабинет кондитерской`;
  $('#cxBrandName').textContent = storefront.name || context.product.name;
  $('#cxBrandMark').replaceChildren(storefront.logoMediaId ? h('img', { src:mediaUrl(storefront.logoMediaId), alt:'' }) : (storefront.name || context.product.name || 'К').trim().slice(0, 1).toUpperCase());
  $('#cxEyebrow').textContent = context.product.organizationName;
  $('#cxUserName').textContent = state.me.name; $('#cxUserRole').textContent = ROLE_LABELS[context.role] || context.role;
  $('#cxAvatar').textContent = (state.me.name || '·').trim().slice(0, 1).toUpperCase();
  for (const link of [$('#cxTopStorefront'), $('#cxShopThemeOpen')]) link.href = context.publicPath;
  const pill = $('#cxPublishState');
  pill.className = `status-pill ${storefront.published ? 'active' : 'trial'}`;
  pill.lastElementChild.textContent = storefront.published ? (storefront.acceptingOrders ? 'Витрина принимает заявки' : 'Заявки онлайн выключены') : 'Витрина не опубликована';
  const summary = context.onboarding.summary;
  $('#cxNewBadge').hidden = !summary.newOrders; $('#cxNewBadge').textContent = summary.newOrders;
  $('#cxWaitBadge').hidden = !summary.waiting; $('#cxWaitBadge').textContent = summary.waiting;
  document.body.classList.toggle('cx-readonly', !can('manageOrders'));
  document.body.classList.toggle('cx-setup', setup());
  $('#cxSetupBanner').hidden = !setup();
  renderMenu();
}

async function loadContext() {
  state.context = await api('context');
  renderShell();
}

// «Продукты» appears only when the account has another workspace to switch to.
async function loadOtherProducts() {
  try {
    const products = await request('/api/products');
    state.otherProducts = (Array.isArray(products) ? products : []).filter(product => product.product_type === 'workspace' && product.id !== productId);
  } catch { state.otherProducts = []; }
  $('#cxProducts').hidden = !state.otherProducts.length;
  $('#cxProfileProducts').hidden = !state.otherProducts.length;
  renderMenu();
}

// ---------- orders ----------
const FILTERS = [['', 'Текущие'], ['new', 'Новые'], ['confirmed', 'Подтверждённые'], ['in_progress', 'В работе'], ['ready', 'Готовы'], ['completed', 'Выданы'], ['cancelled', 'Отменённые']];
function renderFilters() {
  $('#cxOrderFilters').replaceChildren(...FILTERS.map(([value, label]) => h('button', { type:'button', class:state.filter === value ? 'active' : '', 'aria-pressed':String(state.filter === value),
    onclick:() => { state.filter = value; renderFilters(); void loadOrders(); } }, label)));
}

async function loadOrders({ quiet = false } = {}) {
  renderFilters();
  const host = $('#cxOrdersState');
  if (!quiet) setState(host, 'Загружаем заказы…', 'loading');
  try {
    const data = await api(`orders${state.filter ? `?status=${state.filter}` : ''}`);
    state.orders = data.orders;
    state.context.onboarding.summary = { ...state.context.onboarding.summary, ...data.summary };
    renderShell(); setState(host, ''); renderOrders(data.today);
  } catch (error) {
    if (!quiet) { setState(host, h('div', {}, h('p', {}, error.message), h('button', { class:'button ghost compact-button', type:'button', onclick:() => loadOrders() }, 'Повторить')), 'error'); $('#cxOrders').replaceChildren(); }
  }
}

function orderStatusPill(status) {
  return h('span', { class:`cx-status cx-status-${status}` }, state.context.options.statuses[status] || status);
}

function renderOrders(today) {
  const list = $('#cxOrders'), orders = state.orders;
  $('#cxManualNote').hidden = !orders.some(order => order.status === 'new');
  if (!orders.length) {
    const ready = state.context.onboarding.published;
    list.replaceChildren(h('div', { class:'empty-state cx-empty' },
      h('h3', {}, state.filter ? 'Заказов с таким статусом нет' : 'Заявок пока нет'),
      h('p', {}, ready ? 'Поделитесь ссылкой на витрину с клиентами — новые заявки появятся здесь.' : 'Сначала опубликуйте витрину: клиенты смогут выбрать изделие и дату.'),
      ready ? h('button', { class:'button ghost compact-button', type:'button', onclick:() => copyPublicUrl() }, 'Скопировать ссылку на витрину')
        : h('button', { class:'button primary compact-button', type:'button', onclick:() => showView('storefront') }, 'Перейти к витрине')));
    return;
  }
  list.replaceChildren(...orders.map(order => {
    const soon = order.date <= today && !['completed','cancelled'].includes(order.status);
    return h('article', { class:`cx-order${order.status === 'new' ? ' is-new' : ''}` },
      h('button', { class:'cx-order-open', type:'button', onclick:() => openOrder(order.id), 'aria-label':`Заказ №${order.number}, ${order.itemTitle}` },
        h('span', { class:'cx-order-date' }, h('strong', {}, dateText(order.date, { day:'numeric', month:'short' })), h('small', {}, dateText(order.date, { weekday:'short' }))),
        h('span', { class:'cx-order-main' },
          h('span', { class:'cx-order-title' }, h('b', {}, `№${order.number}`), ' ', order.itemTitle),
          h('small', {}, order.lines?.length > 1 ? order.lines.map(line => `${line.itemTitle} × ${line.quantity}`).join(', ')
            : [order.size, order.filling, order.decoration, `${order.quantity} шт.`].filter(Boolean).join(' · ')),
          h('small', {}, order.customerName, order.pickupWindow ? ` · ${order.pickupWindow}` : '', order.customerId ? h('em', { class:'cx-buyer' }, ' · кабинет покупателя') : null,
            order.discountPercent ? h('em', { class:'cx-buyer' }, ` · скидка ${order.discountPercent}%`) : null, soon ? h('em', { class:'cx-soon' }, ' · срок сегодня или прошёл') : null)),
        h('span', { class:'cx-order-side' }, orderStatusPill(order.status), order.status === 'new' ? h('small', { class:'cx-need-contact' }, 'Нужно связаться') : null)),
      h('div', { class:'cx-order-contact' }, contactNode(order.contactMethod, order.contactValue)));
  }));
}

async function openOrder(id) {
  const dialog = $('#cxOrderDialog'), panel = $('#cxOrderPanel');
  panel.replaceChildren(h('p', { class:'cx-state loading' }, 'Загружаем заказ…'));
  if (!dialog.open) dialog.showModal();
  let order;
  try { order = await api(`orders/${id}`); }
  catch (error) { panel.replaceChildren(h('p', { class:'cx-state error' }, error.message), h('button', { class:'button ghost', value:'close' }, 'Закрыть')); return; }
  const statuses = state.context.options.statuses;
  const single = !(order.lines?.length > 1);
  const details = [['Дата', dateText(order.date)], ['Время получения', order.pickupWindow], ...(single ? [['Изделие', order.itemTitle], ['Размер', order.size], ['Начинка', order.filling],
    ['Оформление', order.decoration], ['Количество', `${order.quantity}`]] : []),
    ['Ориентировочно', order.estimateMinor !== null ? `${order.estimateFrom ? 'от ' : ''}${money(order.estimateMinor)}` : 'Цена по запросу'],
    ['Скидка', order.discountPercent ? `${order.discountLabel}. С учётом скидки: ${order.estimateFrom ? 'от ' : ''}${money(order.totalMinor)}` : ''],
    ['Пожелания', order.wishes]].filter(([, value]) => value);
  const lines = single ? null : h('ol', { class:'cx-lines' }, ...order.lines.map(line => h('li', {}, h('strong', {}, `${line.itemTitle} × ${line.quantity}`),
    h('small', {}, [line.size, line.filling, line.decoration].filter(Boolean).join(' · ') || 'Без выбора вариантов'),
    h('small', {}, line.estimateMinor !== null ? `${line.estimateFrom ? 'от ' : ''}${money(line.estimateMinor)}` : 'Цена по запросу'))));
  const buyer = order.customer ? h('p', { class:'cx-buyer-note' }, `Покупатель с кабинетом: ${order.customer.standing.completedOrders} выданных заказов`,
    order.customer.standing.priority ? ' · приоритет' : '', can('viewCustomers') ? ' · ' : '',
    can('viewCustomers') ? h('button', { type:'button', class:'text-button', onclick:() => { $('#cxOrderDialog').close(); void openCustomer(order.customer.id); } }, 'Карточка покупателя') : null) : null;
  const note = h('textarea', { rows:'3', maxlength:'1500', id:'cxOrderNote', disabled:!can('manageOrders') }); note.value = order.ownerNote || '';
  const actions = can('manageOrders') ? h('div', { class:'cx-status-actions', role:'group', 'aria-label':'Сменить статус' },
    ...[...STATUS_FLOW, 'cancelled'].filter(status => status !== order.status).map(status => h('button', { type:'button', class:`button compact-button ${status === 'cancelled' ? 'danger' : 'ghost'}`,
      onclick:async event => {
        busy(event.currentTarget, true);
        try { await api(`orders/${order.id}/status`, { method:'POST', body:{ status, expectedStatus:order.status } }); toast(`Заказ №${order.number}: ${statuses[status]}`); await openOrder(order.id); void loadOrders({ quiet:true }); }
        catch (error) { toast(error.message, true); busy(event.currentTarget, false); }
      } }, statuses[status]))) : h('p', { class:'cx-hint' }, 'Ваша роль позволяет только просматривать заказы.');
  panel.replaceChildren(
    h('div', { class:'panel-head' }, h('div', {}, h('p', { class:'eyebrow' }, `Заказ №${order.number}`), h('h3', { id:'cxOrderTitle' }, order.itemTitle)), orderStatusPill(order.status),
      h('button', { class:'icon-button', value:'close', 'aria-label':'Закрыть' }, h('span', { 'aria-hidden':'true' }, '×'))),
    h('div', { class:'cx-dialog-scroll' },
      order.status === 'new' ? h('p', { class:'cx-manual-note' }, 'Свяжитесь с клиентом вручную по контакту ниже: Nexus не отправляет ему уведомления. После разговора смените статус.') : null,
      h('div', { class:'cx-customer' }, h('strong', {}, order.customerName), contactNode(order.contactMethod, order.contactValue), buyer),
      lines,
      h('dl', { class:'cx-details' }, ...details.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)])),
      can('manageOrders') ? h('h4', {}, 'Сменить статус') : null,
      actions,
      h('label', {}, 'Заметка для команды', note),
      can('manageOrders') ? h('button', { type:'button', class:'button ghost compact-button', onclick:async event => {
        busy(event.currentTarget, true);
        try { await api(`orders/${order.id}/note`, { method:'PUT', body:{ note:note.value } }); toast('Заметка сохранена'); }
        catch (error) { toast(error.message, true); } finally { busy(event.currentTarget, false); }
      } }, 'Сохранить заметку') : null,
      h('h4', {}, 'История'),
      h('ol', { class:'cx-history' }, ...order.events.map(event => h('li', {}, h('span', {}, statuses[event.toStatus] || event.toStatus), h('small', {}, timeText(event.createdAt), event.actorUserId ? '' : ' · клиент'))))));
}

// ---------- calendar ----------
async function loadCalendar() {
  const host = $('#cxCalendarState');
  state.month ||= (state.context.today || new Date().toISOString()).slice(0, 7);
  setState(host, 'Загружаем календарь…', 'loading');
  try {
    state.calendar = await api(`calendar?month=${state.month}`);
    setState(host, state.calendar.calendar.configured ? '' : 'Календарь ещё не настроен: выберите рабочие дни и лимит справа и сохраните. До этого заявки не принимаются.', state.calendar.calendar.configured ? '' : 'warning');
    renderCalendar(); renderCalendarForm();
  } catch (error) { setState(host, error.message, 'error'); }
}

function renderCalendar() {
  const { dates, month, today } = state.calendar;
  $('#cxMonthTitle').textContent = new Intl.DateTimeFormat('ru-RU', { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
  const offset = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const head = WEEKDAYS.map(day => h('span', { class:'cx-weekday', role:'columnheader' }, day));
  const blanks = Array.from({ length:offset }, () => h('span', { class:'cx-day-blank', 'aria-hidden':'true' }));
  const days = dates.map(day => {
    const capacity = Number.isInteger(day.capacity) ? day.capacity : state.calendar.calendar.dailyCapacity;
    const counts = day.orders === null ? `. Лимит: ${capacity}` : `. Заказов: ${day.orders}${day.waiting ? `, в ожидании: ${day.waiting}` : ''}`;
    const label = `${dateText(day.date)}: ${DATE_STATE[day.status]}${day.reason ? `, ${REASONS[day.reason]}` : ''}${counts}`;
    return h('button', { type:'button', role:'gridcell', class:`cx-day ${day.status}${day.date === today ? ' today' : ''}${state.selectedDate === day.date ? ' selected' : ''}`, 'aria-label':label,
      disabled:!can('manageCalendar'), onclick:() => openDate(day) },
      h('b', {}, Number(day.date.slice(8))),
      h('small', {}, day.status === 'unavailable' && !day.orders ? '—' : day.usedUnits === null ? `лимит ${capacity}` : `${day.usedUnits}/${capacity}`),
      day.waiting ? h('i', { class:'cx-day-wait', title:`В листе ожидания: ${day.waiting}` }, day.waiting) : null,
      day.override ? h('i', { class:'cx-day-mark', 'aria-hidden':'true' }) : null);
  });
  $('#cxCalendar').replaceChildren(...head, ...blanks, ...days);
}

function renderCalendarForm() {
  const form = $('#cxCalendarForm'), settings = state.calendar.calendar;
  $('#cxWeekdays').replaceChildren(...WEEKDAYS.map((label, index) => h('label', { class:'cx-weekday-toggle' },
    h('input', { type:'checkbox', name:'workingDays', value:String(index + 1), checked:settings.workingDays.includes(index + 1), disabled:!can('manageCalendar') }), h('span', {}, label))));
  $('#cxTimeZone').replaceChildren(...state.context.options.timeZones.map(zone => h('option', { value:zone, selected:zone === settings.timeZone }, zone.replace('_', ' '))));
  for (const name of ['dailyCapacity','leadDays','horizonDays']) { form.elements[name].value = settings[name]; form.elements[name].disabled = !can('manageCalendar'); }
  form.elements.timeZone.disabled = !can('manageCalendar');
  form.querySelector('button[type="submit"]').hidden = !can('manageCalendar');
  const own = settings.weekdayCapacity || null;
  $('#cxWeekdayToggle').checked = Boolean(own); $('#cxWeekdayToggle').disabled = !can('manageCalendar');
  $('#cxWeekdayLimits').replaceChildren(...WEEKDAYS.map((label, index) => h('label', {}, label,
    h('input', { type:'number', min:'0', max:'200', inputmode:'numeric', dataset:{ weekdayLimit:String(index + 1) }, value:String(own?.[index + 1] ?? settings.dailyCapacity), disabled:!can('manageCalendar') }))));
  const pickup = settings.pickup || { enabled:false, windows:[], perWindow:null };
  $('#cxPickupToggle').checked = pickup.enabled === true; $('#cxPickupToggle').disabled = !can('manageCalendar');
  form.elements.pickupWindows.value = (pickup.windows || []).map(window => `${window.from}–${window.to}`).join('\n');
  form.elements.perWindow.value = pickup.perWindow ?? '';
  for (const name of ['pickupWindows','perWindow']) form.elements[name].disabled = !can('manageCalendar');
  syncCalendarBlocks();
  const reserved = state.calendar.reservedPerDay || 0;
  $('#cxReservedHint').hidden = !reserved;
  $('#cxReservedHint').textContent = reserved ? `Для постоянных покупателей в каждом дне держится ${reserved} ${reserved === 1 ? 'место' : reserved < 5 ? 'места' : 'мест'} — гости видят дату занятой раньше. Настраивается в разделе «Покупатели».` : '';
  $('#cxRangeForm').hidden = !can('manageCalendar');
}
function syncCalendarBlocks() {
  $('#cxWeekdayLimits').hidden = !$('#cxWeekdayToggle').checked;
  $('#cxPickupBlock').hidden = !$('#cxPickupToggle').checked;
}
// «10:00–12:00», «10.00-12.00» or «9:00 — 11:30», one interval per line.
function parseWindows(value) {
  const pad = time => time.replace('.', ':').padStart(5, '0');
  return value.split(/\r?\n/u).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(\d{1,2}[:.]\d{2})\s*[–—-]\s*(\d{1,2}[:.]\d{2})$/u);
    if (!match) throw new Error(`Строка «${line}»: укажите интервал как 10:00–12:00.`);
    return { from:pad(match[1]), to:pad(match[2]) };
  });
}

function openDate(day) {
  if (!can('manageCalendar')) return;
  state.selectedDate = day.date; renderCalendar();
  const form = $('#cxDateForm'); form.hidden = false;
  $('#cxDateTitle').textContent = dateText(day.date);
  $('#cxDateLoad').textContent = `${DATE_STATE[day.status]}${day.reason ? ` — ${REASONS[day.reason]}` : ''}.`
    + (day.orders === null ? '' : ` Заказов: ${day.orders}, занято слотов: ${day.usedUnits}${day.waiting ? `, в листе ожидания: ${day.waiting}` : ''}.`);
  const kind = day.override?.kind || 'default';
  $$('input[name="kind"]', form).forEach(input => { input.checked = input.value === kind; });
  form.elements.capacity.value = day.override?.capacity ?? '';
  form.elements.note.value = day.override?.note || '';
  syncDateCapacity();
  form.elements.kind[0].focus();
}
function syncDateCapacity() {
  const kind = $('#cxDateForm').elements.kind.value;
  $('#cxDateCapacity').hidden = !['limit','open'].includes(kind);
}

// ---------- catalog ----------
async function loadCatalog() {
  const host = $('#cxCatalogState');
  $('#cxAddItem').hidden = !can('manageCatalog');
  setState(host, 'Загружаем каталог…', 'loading');
  try { state.items = (await api('catalog')).items; setState(host, ''); renderCatalog(); }
  catch (error) { setState(host, error.message, 'error'); }
}
const mediaUrl = id => `./media/${id}.svg`;
function priceText(item) {
  if (item.priceMinor === null && !item.sizes.some(size => size.priceMinor !== null)) return 'Цена по запросу';
  const prices = [item.priceMinor, ...item.sizes.map(size => size.priceMinor)].filter(value => value !== null);
  const min = Math.min(...prices);
  return `${item.priceFrom || prices.length > 1 ? 'от ' : ''}${money(min)}${item.unit ? ` / ${item.unit}` : ''}`;
}
function renderCatalog() {
  const list = $('#cxCatalog');
  if (!state.items.length) {
    list.replaceChildren(h('div', { class:'empty-state cx-empty' }, h('h3', {}, 'Каталог пока пуст'),
      h('p', {}, 'Добавьте первое изделие: название, фото и цену или цену «от». Начинки, размеры и сроки можно уточнить позже.'),
      can('manageCatalog') ? h('button', { class:'button primary compact-button', type:'button', onclick:() => openItem(null) }, 'Добавить изделие') : null));
    return;
  }
  list.replaceChildren(...state.items.map(item => h('article', { class:`cx-item${item.status === 'hidden' ? ' is-hidden' : ''}` },
    h('div', { class:'cx-item-photo' }, item.mediaIds[0] ? h('img', { src:mediaUrl(item.mediaIds[0]), alt:'', loading:'lazy' }) : h('span', { 'aria-hidden':'true' }, item.title.slice(0, 1))),
    h('div', { class:'cx-item-body' }, h('h3', {}, item.title), h('p', {}, item.summary || 'Без краткого описания'),
      h('strong', {}, priceText(item)), item.status === 'hidden' ? h('small', { class:'cx-hidden-tag' }, 'Скрыто с витрины') : null),
    can('manageCatalog') ? h('button', { class:'button ghost compact-button', type:'button', onclick:() => openItem(item) }, 'Изменить') : null)));
}

const optionLines = options => options.map(option => option.priceMinor === null ? option.label : `${option.label} — ${option.priceMinor / 100}`).join('\n');
function parseOptions(value) {
  return value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(.*?)\s+[—–-]\s+([\d\s.,]+)\s*(?:₽|руб\.?)?$/u);
    return match ? { label:match[1].trim(), price:match[2].replace(/\s+/gu, '') } : { label:line, price:null };
  });
}
function openItem(item) {
  state.editing = item; state.itemMedia = [...(item?.mediaIds || [])];
  const form = $('#cxItemForm'); form.reset();
  $('#cxItemTitle').textContent = item ? item.title : 'Новое изделие';
  $('#cxItemError').textContent = '';
  $('#cxItemArchive').hidden = !item;
  if (item) {
    for (const name of ['title','summary','description','composition','unit','notes']) form.elements[name].value = item[name] || '';
    form.elements.price.value = item.priceMinor === null ? '' : item.priceMinor / 100;
    form.elements.priceFrom.checked = item.priceFrom; form.elements.hidden.checked = item.status === 'hidden';
    form.elements.leadDays.value = item.leadDays ?? ''; form.elements.capacityUnits.value = item.capacityUnits;
    form.elements.minQuantity.value = item.minQuantity; form.elements.maxQuantity.value = item.maxQuantity;
    form.elements.sizes.value = optionLines(item.sizes); form.elements.decorations.value = optionLines(item.decorations); form.elements.fillings.value = optionLines(item.fillings);
    const autoplay = item.photoAutoplay || {};
    form.elements.autoplay.checked = autoplay.on === true;
    form.elements.autoplaySeconds.value = String(autoplay.seconds || 5); form.elements.autoplayDirection.value = autoplay.direction || 'forward';
  }
  renderItemMedia();
  $('#cxItemDialog').showModal();
  form.elements.title.focus();
}
function renderThumbs(host, ids, onRemove) {
  host.replaceChildren(...ids.map((id, index) => h('figure', { class:'cx-thumb' }, h('img', { src:mediaUrl(id), alt:`Фото ${index + 1}` }),
    h('button', { type:'button', class:'cx-thumb-remove', 'aria-label':`Убрать фото ${index + 1}`, onclick:() => onRemove(index) }, '×'))));
}
function renderItemMedia() { renderThumbs($('#cxItemMedia'), state.itemMedia, index => { state.itemMedia.splice(index, 1); renderItemMedia(); }); }

// Photos are re-encoded in the browser: smaller uploads and no original metadata.
async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/u.test(file.type)) throw new Error('Выберите фото в формате JPEG, PNG или WebP.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Фото больше 25 МБ. Выберите другое.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Не удалось прочитать фото. Попробуйте другое.'); });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = h('canvas', { width:String(Math.round(bitmap.width * scale)), height:String(Math.round(bitmap.height * scale)) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const encode = (type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
  // The photo travels as base64 inside JSON and the production proxy accepts 2 MB per request.
  const limit = 1.4 * 1024 * 1024;
  let blob = await encode('image/webp', 0.84);
  if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg', 0.84);
  for (const quality of [0.7, 0.55, 0.4]) { if (blob.size <= limit) break; blob = await encode('image/jpeg', quality); }
  if (blob.size > limit) throw new Error('Фото слишком большое даже после сжатия. Выберите другое.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
async function uploadFiles(input, onUploaded) {
  const files = [...input.files]; input.value = '';
  for (const file of files) {
    try { const data = await compressImage(file); const media = await api('media', { method:'POST', body:{ data } }); onUploaded(media.id); }
    catch (error) { toast(error.message, true); }
  }
}

// ---------- storefront content ----------
function renderStorefront() {
  renderPreviewToolbar(); loadPreview();
  // Unsaved edits stay in the form while the owner looks at other sections.
  if (state.preview.dirty) return;
  const form = $('#cxStorefrontForm'), value = state.context.storefront, options = state.context.options;
  $('#cxFormat').replaceChildren(...Object.entries(options.formats).map(([key, format]) => h('option', { value:key, selected:key === value.format }, format.label)));
  for (const name of ['name','tagline','description','orderNote','privacyUrl']) form.elements[name].value = value[name] || '';
  for (const [key, contact] of Object.entries(value.contacts || {})) if (form.elements[key]) form.elements[key].value = contact;
  form.elements.published.checked = value.published; form.elements.acceptingOrders.checked = value.acceptingOrders;
  state.logoId = value.logoMediaId; state.coverIds = [...(value.coverMediaIds || [])];
  renderStorefrontMedia();
  const url = `${location.origin}${state.context.publicPath}`;
  $('#cxPublicUrl').replaceChildren('Адрес витрины: ', h('a', { href:state.context.publicPath, target:'_blank', rel:'noopener' }, url), ' ',
    h('button', { type:'button', class:'text-button', onclick:() => copyPublicUrl() }, 'Скопировать'));
  const editable = can('manageStorefront');
  $$('input,select,textarea,button[type="submit"]', form).forEach(element => { element.disabled = !editable; });
  $$('.cx-file input', form).forEach(element => { element.disabled = !editable; });
  setStorefrontDirty(false);
}
function storefrontMediaChanged() { renderStorefrontMedia(); setStorefrontDirty(true); }

// ---------- storefront preview ----------
// The real storefront runs in a same-origin frame. It only sends requests
// ("edit this block", "new order"); every change is saved here through the cabinet API.
const previewFrame = () => $('#cxSfFrame');
function toPreview(message) {
  const target = previewFrame()?.contentWindow;
  if (state.preview.ready && target) target.postMessage({ channel:'cx-cabinet', ...message }, location.origin);
}
const canEditPreview = () => can('manageStorefront') || can('manageCatalog');
function renderPreviewToolbar() {
  const preview = state.preview, storefront = state.context.storefront;
  if (!canEditPreview()) preview.mode = 'view';
  $('#cxSfModes').hidden = !canEditPreview();
  $$('[data-sf-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sfMode === preview.mode)));
  $$('[data-sf-device]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sfDevice === preview.device)));
  $('#cxSfStage').dataset.device = preview.device;
  const badge = $('#cxSfBadge');
  badge.textContent = storefront.published ? (storefront.acceptingOrders ? 'Опубликована · заявки открыты' : 'Опубликована · заявки закрыты') : 'Черновик · видите только вы';
  badge.dataset.state = storefront.published ? 'live' : 'draft';
  $('#cxSfOpen').href = state.context.publicPath;
  $('#cxSfHint').textContent = preview.mode === 'edit'
    ? [can('manageStorefront') ? 'Нажмите на блок витрины, чтобы изменить его справа.' : '', can('manageCatalog') ? 'Изделие откроется в карточке; перетащите изделия, чтобы поменять порядок.' : ''].filter(Boolean).join(' ')
    : 'Так витрину видят клиенты. Заявки из предпросмотра не отправляются.';
}
function loadPreview() {
  const frame = previewFrame(), preview = state.preview;
  if (preview.loaded) { refreshPreview(); return; }
  preview.loaded = true; preview.ready = false;
  showPreviewCover('Загружаем витрину…');
  frame.src = `${state.context.publicPath}?embed=cabinet`;
  clearTimeout(preview.readyTimer);
  preview.readyTimer = setTimeout(() => { if (!preview.ready) showPreviewCover('Предпросмотр не загрузился. Проверьте связь и попробуйте ещё раз.', true); }, 15000);
}
function reloadPreview() {
  state.preview.loaded = false;
  loadPreview();
}
function showPreviewCover(text, failed = false) {
  $('#cxSfCover').hidden = false; $('#cxSfCoverText').textContent = text;
  $('#cxSfCover').classList.toggle('is-error', failed); $('#cxSfRetry').hidden = !failed;
}
function refreshPreview() { toPreview({ type:'refresh' }); }
function sendPreviewMode() {
  toPreview({ type:'mode', edit:state.preview.mode === 'edit', canCatalog:can('manageCatalog'), canStorefront:can('manageStorefront') });
}
function setStorefrontDirty(dirty) {
  state.preview.dirty = dirty;
  $('#cxSfDirty').textContent = dirty ? 'Есть несохранённые изменения — в предпросмотре они уже видны' : '';
  $('.cx-sf-savebar')?.classList.toggle('is-dirty', dirty);
}
// Unsaved text and photos are shown in the preview right away.
function sendDraft() {
  cancelAnimationFrame(state.preview.draftFrame);
  state.preview.draftFrame = requestAnimationFrame(() => {
    const form = $('#cxStorefrontForm'), field = name => form.elements[name].value;
    toPreview({ type:'draft', shop:{ name:field('name'), tagline:field('tagline'), description:field('description'), orderNote:field('orderNote'),
      contacts:Object.fromEntries(['phone','telegram','whatsapp','vk','email','instagram','address','hours'].map(name => [name, field(name).trim()])),
      logoMediaId:state.logoId, coverMediaIds:state.coverIds } });
  });
}
const PREVIEW_SECTIONS = { brand:['brand','name'], hero:['brand','tagline'], terms:['brand','orderNote'], covers:['media',null], contacts:['contacts','phone'] };
function focusStorefrontSection(target) {
  const [section, field] = PREVIEW_SECTIONS[target] || [];
  const article = section && $(`#cxStorefrontForm [data-sf-section="${section}"]`);
  if (!article) return;
  article.classList.remove('is-target'); void article.offsetWidth; article.classList.add('is-target');
  // Beside the preview the editor scrolls on its own; below it the page scrolls.
  const inspector = $('#cxStorefrontForm'), behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  if (getComputedStyle(inspector).overflowY === 'auto') inspector.scrollTo({ top:article.offsetTop - inspector.offsetTop, behavior });
  else article.scrollIntoView({ block:'start', behavior });
  const input = field ? $('#cxStorefrontForm').elements[field] : article.querySelector('.cx-file input');
  input?.focus({ preventScroll:true });
}
async function onPreviewEdit(target, id) {
  if (target === 'item') {
    if (!can('manageCatalog')) return;
    try {
      let item = state.items.find(entry => entry.id === id);
      if (!item) { state.items = (await api('catalog')).items; item = state.items.find(entry => entry.id === id); }
      if (item) openItem(item); else { toast('Изделие не найдено. Обновляем предпросмотр.', true); refreshPreview(); }
    } catch (error) { toast(error.message, true); }
    return;
  }
  if (!can('manageStorefront')) { toast('Изменять витрину может владелец или администратор компании.', true); return; }
  focusStorefrontSection(target);
}
// Keyboard moves send one request per key press; only the last order is saved.
function savePreviewOrder(ids) {
  clearTimeout(state.preview.orderTimer);
  state.preview.orderTimer = setTimeout(async () => {
    try { state.items = (await api('catalog/order', { method:'PUT', body:{ ids } })).items; toast('Порядок изделий сохранён'); }
    catch (error) { toast(error.message, true); refreshPreview(); }
  }, 350);
}
function onPreviewMessage(event) {
  const frame = previewFrame();
  if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin) return;
  const message = event.data;
  if (!message || message.channel !== 'cx-preview') return;
  if (message.type === 'ready') {
    state.preview.ready = true; clearTimeout(state.preview.readyTimer);
    $('#cxSfCover').hidden = true;
    sendPreviewMode();
    if (state.preview.dirty) sendDraft();
  } else if (message.type === 'error') {
    showPreviewCover(typeof message.message === 'string' ? message.message : 'Витрина не загрузилась.', true);
  } else if (message.type === 'edit' && state.preview.mode === 'edit') {
    void onPreviewEdit(String(message.target || ''), String(message.id || ''));
  } else if (message.type === 'add-item' && state.preview.mode === 'edit' && can('manageCatalog')) {
    // New items go to the end, so the current order has to be known first.
    void api('catalog').then(data => { state.items = data.items; }, () => {}).then(() => openItem(null));
  } else if (message.type === 'reorder' && state.preview.mode === 'edit' && can('manageCatalog') && Array.isArray(message.ids)) {
    savePreviewOrder(message.ids.filter(id => typeof id === 'string').slice(0, 200));
  }
}
function renderStorefrontMedia() {
  const logo = $('#cxLogoPreview');
  logo.replaceChildren(state.logoId ? h('img', { src:mediaUrl(state.logoId), alt:'Логотип' }) : h('span', {}, 'Логотип'));
  $('#cxLogoRemove').hidden = !state.logoId;
  renderThumbs($('#cxCoverPreview'), state.coverIds, index => { state.coverIds.splice(index, 1); storefrontMediaChanged(); sendDraft(); });
}
async function copyPublicUrl() {
  const url = `${location.origin}${state.context.publicPath}`;
  try { await navigator.clipboard.writeText(url); toast('Ссылка на витрину скопирована'); } catch { toast(`Ссылка: ${url}`); }
}
async function saveStorefront(changes, message) {
  const current = state.context.storefront;
  await api('storefront', { method:'PUT', body:{ ...current, ...changes, revision:current.revision } });
  toast(message);
  await loadContext(); renderOnboarding();
  if (state.preview.loaded) { renderPreviewToolbar(); refreshPreview(); }
}

// ---------- settings ----------
const SETTINGS_PAGES = { appearance:() => true, menu:() => true, shop:() => can('manageStorefront'), ordering:() => can('manageStorefront') || can('manageCustomers'),
  // The domain and Vertux access share one page; each card shows only with its right.
  domain:() => can('manageDomain') || can('manageAccess') };
function renderSettings() {
  $$('#cxSettingsNav [data-settings-page]').forEach(button => { button.hidden = !SETTINGS_PAGES[button.dataset.settingsPage](); });
  openSettingsPage(state.settingsPage);
}
function openSettingsPage(page) {
  if (page === 'access') page = 'domain';
  if (!SETTINGS_PAGES[page]?.()) page = 'appearance';
  if (page !== state.settingsPage) state.shopDraft = null;
  state.settingsPage = page;
  $$('#cxSettingsNav [data-settings-page]').forEach(button => {
    const active = button.dataset.settingsPage === page;
    button.classList.toggle('active', active); button.toggleAttribute('aria-current', active);
  });
  $$('[data-settings-panel]').forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== page; });
  $('#cxSettingsStatus').textContent = '';
  renderSettingsPage();
}
function renderSettingsPage() {
  const renderers = { appearance:renderAppearance, menu:renderMenuSettings, shop:renderShopTheme, ordering:renderOrdering, domain:renderDomainAndAccess };
  renderers[state.settingsPage]();
}

function themeCard({ label, note, checked, preview, onSelect }) {
  return h('button', { type:'button', role:'radio', class:'cx-theme-card', 'aria-checked':String(checked), onclick:onSelect },
    h('span', { class:`cx-theme-preview ${preview}`, 'aria-hidden':'true' }, h('i'), h('i'), h('i'), h('b')),
    h('span', { class:'cx-theme-text' }, h('strong', {}, label), h('small', {}, note)),
    h('span', { class:'cx-theme-check', 'aria-hidden':'true' }, checked ? '✓' : ''));
}
function renderAppearance() {
  const themes = state.context.options.cabinetThemes;
  $('#cxCabinetThemes').replaceChildren(...Object.entries(themes).map(([key, theme]) => themeCard({ label:theme.label, note:theme.note,
    checked:state.prefs.theme === key, preview:`cabinet-${key}`, onSelect:() => updatePrefs(prefs => { prefs.theme = key; }, { immediate:true }) })));
  const computed = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim().slice(0, 7);
  $('#cxCabinetAccent').value = state.prefs.accent || computed('--accent') || '#E8792B';
  $('#cxCabinetBackground').value = state.prefs.background || THEME_SURFACE[state.prefs.theme] || '#FFF8F1';
  $('#cxCabinetAccentReset').disabled = !state.prefs.accent && !state.prefs.background;
  renderLookControls('cabinet', { cardLight:state.prefs.cardLight, hasWallpaper:Boolean(state.prefs.wallpaper), shade:state.prefs.wallpaper?.shade ?? 65,
    accent:state.prefs.accent || computed('--accent') || '#E8792B' });
}

// The same lighting and background controls for the cabinet and the storefront.
function renderLookControls(scope, { cardLight, hasWallpaper, shade, accent, editable = true }) {
  const [lights, wallpaper] = $$(`[data-look="${scope}"]`), light = cardLight || LIGHT_DEFAULT;
  lights.querySelector('[data-light-options]').replaceChildren(...Object.entries(state.context.options.cardLights || {}).map(([key, label]) =>
    h('button', { type:'button', class:'cx-light-option', 'aria-pressed':String(light.style === key), disabled:!editable, dataset:{ lightStyle:key } },
      h('span', { class:'cx-light-sample', dataset:{ lightSample:key }, 'aria-hidden':'true' }), h('span', {}, label))));
  const color = lights.querySelector('[data-light-color]'), intensity = lights.querySelector('[data-light-intensity]');
  color.value = light.color || accent; intensity.value = String(light.intensity ?? 30);
  lights.querySelector('[data-light-output]').value = `${light.intensity ?? 30}%`;
  color.disabled = intensity.disabled = !editable || light.style === 'off';
  lights.querySelector('[data-light-reset]').disabled = !editable || (!light.color && (light.intensity ?? 30) === 30);
  const shadeInput = wallpaper.querySelector('[data-wallpaper-shade]');
  shadeInput.value = String(shade); wallpaper.querySelector('[data-wallpaper-output]').value = `${shade}%`;
  shadeInput.disabled = !editable || !hasWallpaper;
  wallpaper.querySelector('[data-wallpaper-file]').disabled = !editable;
  wallpaper.querySelector('[data-wallpaper-remove]').hidden = !hasWallpaper;
}
function bindLookControls(scope, { light, setLight, shade, setShade, upload, remove }) {
  const [lights, wallpaper] = $$(`[data-look="${scope}"]`);
  lights.addEventListener('click', event => {
    const option = event.target.closest('[data-light-style]');
    if (option) setLight({ ...light(), style:option.dataset.lightStyle }, true);
    if (event.target.closest('[data-light-reset]')) setLight({ ...light(), color:null, intensity:30 }, true);
  });
  // Dragging previews at once; the value is kept when the control is released.
  lights.querySelector('[data-light-color]').addEventListener('input', event => setLight({ ...light(), color:event.currentTarget.value.toUpperCase() }, false));
  lights.querySelector('[data-light-color]').addEventListener('change', event => setLight({ ...light(), color:event.currentTarget.value.toUpperCase() }, true));
  lights.querySelector('[data-light-intensity]').addEventListener('input', event => {
    lights.querySelector('[data-light-output]').value = `${event.currentTarget.value}%`; setLight({ ...light(), intensity:Number(event.currentTarget.value) }, false);
  });
  lights.querySelector('[data-light-intensity]').addEventListener('change', event => setLight({ ...light(), intensity:Number(event.currentTarget.value) }, true));
  wallpaper.querySelector('[data-wallpaper-shade]').addEventListener('input', event => {
    wallpaper.querySelector('[data-wallpaper-output]').value = `${event.currentTarget.value}%`; setShade(Number(event.currentTarget.value), false);
  });
  wallpaper.querySelector('[data-wallpaper-shade]').addEventListener('change', event => setShade(Number(event.currentTarget.value), true));
  wallpaper.querySelector('[data-wallpaper-remove]').addEventListener('click', () => { remove(); wallpaper.querySelector('[data-wallpaper-status]').textContent = 'Фон убран.'; });
  wallpaper.querySelector('[data-wallpaper-file]').addEventListener('change', async event => {
    const input = event.currentTarget, file = input.files?.[0], status = wallpaper.querySelector('[data-wallpaper-status]');
    input.value = '';
    if (!file) return;
    status.textContent = 'Подготавливаем фон…'; input.disabled = true;
    try { status.textContent = await upload(file); }
    catch (error) { status.textContent = error.message; }
    finally { input.disabled = false; }
  });
}
// A cabinet background lives in the account settings, so it is shrunk to a small JPEG.
async function wallpaperData(file) {
  if (!/^image\/(jpeg|png|webp)$/u.test(file.type)) throw new Error('Выберите изображение PNG, JPEG или WebP.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Изображение больше 25 МБ. Выберите другое.');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('Не удалось прочитать изображение. Попробуйте другое.'); });
  try {
    const limit = state.context.options.wallpaperLimit || 56000;
    for (const bound of [1280, 1024, 800, 640, 480]) {
      const scale = Math.min(1, bound / Math.max(bitmap.width, bitmap.height));
      const canvas = h('canvas', { width:String(Math.max(1, Math.round(bitmap.width * scale))), height:String(Math.max(1, Math.round(bitmap.height * scale))) });
      const context = canvas.getContext('2d');
      context.fillStyle = THEME_SURFACE[state.prefs.theme] || '#FFF8F1'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.72, 0.58, 0.45, 0.34]) { const data = canvas.toDataURL('image/jpeg', quality); if (data.length <= limit) return data; }
    }
    throw new Error('Не удалось уменьшить изображение. Выберите картинку попроще.');
  } finally { bitmap.close?.(); }
}

function shortcutField(action) {
  const value = state.prefs.shortcuts[action] || '';
  return h('input', { class:'cx-shortcut', type:'text', readonly:true, value, placeholder:'Не задано', 'aria-label':`Сочетание клавиш: ${VIEWS[action]}`,
    dataset:{ shortcutFor:action }, onkeydown:event => captureShortcut(event, action) });
}
function captureShortcut(event, action) {
  if (event.key === 'Tab') return;
  event.preventDefault();
  const status = $('#cxSettingsStatus');
  if (event.key === 'Escape') { event.currentTarget.value = state.prefs.shortcuts[action] || ''; event.currentTarget.blur(); return; }
  if (event.key === 'Delete' || event.key === 'Backspace') { updatePrefs(prefs => { prefs.shortcuts[action] = ''; }); return; }
  if (['Control','Alt','Shift','Meta','AltGraph'].includes(event.key)) return;
  const combo = comboFromEvent(event);
  if (!combo) { status.textContent = 'Добавьте Ctrl, Alt или ⌘ и одну клавишу: букву, цифру или F1–F12.'; return; }
  const taken = Object.entries(state.prefs.shortcuts).find(([other, value]) => other !== action && value === combo);
  if (taken) { status.textContent = `${combo} уже занято: ${VIEWS[taken[0]]}. Сначала уберите его там.`; return; }
  updatePrefs(prefs => { prefs.shortcuts[action] = combo; });
  requestAnimationFrame(() => $(`[data-shortcut-for="${action}"]`)?.focus());
}

let dragged = null;
function moveSection(id, delta) {
  const order = menuSections(), index = order.indexOf(id), target = index + delta;
  if (target < 0 || target >= order.length) return;
  const pinned = state.prefs.pinned.includes(id);
  if (pinned !== state.prefs.pinned.includes(order[target])) return;
  [order[index], order[target]] = [order[target], order[index]];
  updatePrefs(prefs => { prefs.order = order; });
  requestAnimationFrame(() => $(`[data-menu-row="${id}"] [data-move="${delta < 0 ? 'up' : 'down'}"]`)?.focus());
}
function dropSection(id, beforeId) {
  if (!id || id === beforeId) return;
  const order = menuSections().filter(item => item !== id);
  const index = beforeId ? order.indexOf(beforeId) : order.length;
  order.splice(index < 0 ? order.length : index, 0, id);
  updatePrefs(prefs => {
    prefs.order = order;
    // Dropping into the other group changes whether the section is pinned.
    const neighbour = order[order.indexOf(id) + 1] ?? order[order.indexOf(id) - 1];
    if (neighbour && prefs.pinned.includes(neighbour) !== prefs.pinned.includes(id)) prefs.pinned = prefs.pinned.includes(id) ? prefs.pinned.filter(item => item !== id) : [...prefs.pinned, id];
  });
}
function renderMenuSettings() {
  const prefs = state.prefs, order = menuSections(), locked = id => (setup() && PRIVATE_VIEWS.has(id)) || (id === 'customers' && !customersOn());
  const visibleCount = order.filter(id => !prefs.hidden.includes(id) && !locked(id)).length;
  $('#cxCompact').checked = prefs.compact;
  $('#cxMenuList').replaceChildren(...order.map((id, index) => {
    const pinned = prefs.pinned.includes(id), shown = !prefs.hidden.includes(id);
    const sameGroup = offset => order[index + offset] && prefs.pinned.includes(order[index + offset]) === pinned;
    return h('li', { class:`cx-menu-row${pinned ? ' is-pinned' : ''}${shown ? '' : ' is-hidden'}`, draggable:'true', dataset:{ menuRow:id },
      ondragstart:event => { dragged = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); event.currentTarget.classList.add('is-dragging'); },
      ondragend:event => { dragged = null; event.currentTarget.classList.remove('is-dragging'); },
      ondragover:event => { if (dragged && dragged !== id) { event.preventDefault(); event.currentTarget.classList.add('is-drop'); } },
      ondragleave:event => event.currentTarget.classList.remove('is-drop'),
      ondrop:event => { event.preventDefault(); event.currentTarget.classList.remove('is-drop'); dropSection(dragged, id); } },
      h('span', { class:'cx-grip', 'aria-hidden':'true' }, '⋮⋮'),
      h('span', { class:'cx-menu-name' }, h('strong', {}, VIEWS[id]), locked(id) ? h('small', {}, setup() ? 'Недоступно в режиме настройки' : 'Появится с кабинетом покупателя — Настройки → Заказы') : pinned ? h('small', {}, 'Закреплено') : null),
      h('span', { class:'cx-menu-tools' },
        h('button', { type:'button', class:'icon-button', dataset:{ move:'up' }, 'aria-label':`Поднять: ${VIEWS[id]}`, disabled:!sameGroup(-1), onclick:() => moveSection(id, -1) }, '↑'),
        h('button', { type:'button', class:'icon-button', dataset:{ move:'down' }, 'aria-label':`Опустить: ${VIEWS[id]}`, disabled:!sameGroup(1), onclick:() => moveSection(id, 1) }, '↓'),
        h('button', { type:'button', class:`icon-button cx-pin${pinned ? ' active' : ''}`, 'aria-pressed':String(pinned), 'aria-label':`${pinned ? 'Открепить' : 'Закрепить'}: ${VIEWS[id]}`, title:pinned ? 'Открепить' : 'Закрепить наверху',
          onclick:() => updatePrefs(next => { next.pinned = pinned ? next.pinned.filter(item => item !== id) : [...next.pinned, id]; }) },
          icon('M9 4h6l-1 6 4 4H6l4-4-1-6ZM12 14v6')),
        h('label', { class:'cx-toggle', title:shown ? 'Скрыть из меню' : 'Показать в меню' },
          h('input', { type:'checkbox', checked:shown, disabled:shown && visibleCount <= 1, 'aria-label':`Показывать в меню: ${VIEWS[id]}`,
            onchange:event => updatePrefs(next => { next.hidden = event.currentTarget.checked ? next.hidden.filter(item => item !== id) : [...next.hidden, id]; }) }),
          h('span', { 'aria-hidden':'true' })),
        shortcutField(id)));
  }));
  $('#cxSystemList').replaceChildren(...SYSTEM_ACTIONS.filter(allowedView).map(id => h('li', { class:'cx-menu-row is-system' },
    h('span', { class:'cx-grip', 'aria-hidden':'true' }),
    h('span', { class:'cx-menu-name' }, h('strong', {}, VIEWS[id]), h('small', {}, 'Всегда внизу меню')),
    h('span', { class:'cx-menu-tools' }, shortcutField(id)))));
}

function shopDraft() {
  const storefront = state.context.storefront;
  state.shopDraft ??= { theme:storefront.theme || 'cream', accentColor:storefront.accentColor || '#E8792B', backgroundColor:storefront.backgroundColor || null,
    cardLight:{ ...LIGHT_DEFAULT, ...(storefront.cardLight || {}) }, backgroundMediaId:storefront.backgroundMediaId || null, backgroundShade:storefront.backgroundShade ?? 65 };
  return state.shopDraft;
}
const shopLook = value => JSON.stringify([value.theme || 'cream', (value.accentColor || '#E8792B').toUpperCase(), value.backgroundColor || null,
  { ...LIGHT_DEFAULT, ...(value.cardLight || {}) }, value.backgroundMediaId || null, value.backgroundShade ?? 65]);
function renderShopTheme() {
  const draft = shopDraft(), themes = state.context.options.storefrontThemes, saved = state.context.storefront;
  $('#cxShopThemes').replaceChildren(...Object.entries(themes).map(([key, theme]) => themeCard({ label:theme.label, note:theme.note,
    checked:draft.theme === key, preview:`shop-${key}`, onSelect:() => { draft.theme = key; renderShopTheme(); } })));
  $('#cxShopAccent').value = draft.accentColor;
  $('#cxShopBackground').value = draft.backgroundColor || SHOP_SURFACE[draft.theme];
  const preview = $('#cxShopPreview');
  preview.dataset.shopTheme = draft.theme;
  paint(preview, accentTokens(draft.accentColor, SHOP_SURFACE[draft.theme]));
  paintLook(preview, { background:draft.backgroundColor, cardLight:draft.cardLight,
    wallpaper:draft.backgroundMediaId && { url:`${state.context.publicPath}/media/${draft.backgroundMediaId}`, shade:draft.backgroundShade } }, { bgName:'--p-bg', prefix:'p' });
  renderLookControls('shop', { cardLight:draft.cardLight, hasWallpaper:Boolean(draft.backgroundMediaId), shade:draft.backgroundShade, accent:draft.accentColor,
    editable:can('manageStorefront') });
  $$('.cx-theme-preview[class*="shop-"]').forEach(element => paint(element, accentTokens(draft.accentColor, SHOP_SURFACE[draft.theme])));
  $('#cxShopThemeSave').disabled = shopLook(draft) === shopLook(saved);
  $('#cxShopAccentReset').disabled = draft.accentColor.toUpperCase() === '#E8792B' && !draft.backgroundColor;
}

function copyButton(value) {
  return h('button', { type:'button', class:'text-button', onclick:async () => {
    try { await navigator.clipboard.writeText(value); toast('Скопировано'); } catch { toast(value); }
  } }, 'Копировать');
}
function renderDomain(info) {
  const form = $('#cxDomainForm'), [label, tone] = DOMAIN_STATES[info?.status] || DOMAIN_STATES.none;
  // A domain saved before a tariff change stays editable so it can be switched off.
  const locked = !planAllows('domain') && !info?.domain;
  $('#cxDomainLocked').hidden = !locked; form.hidden = locked;
  $$('#cxDomainLocked [data-view-link]').forEach(button => { button.hidden = state.context.setup === true; });
  const pill = $('#cxDomainState'); pill.className = `status-pill ${tone}`; pill.lastElementChild.textContent = label;
  form.elements.domain.value = info?.domain || '';
  const editable = can('manageDomain');
  $$('input,button', form).forEach(element => { element.disabled = !editable; });
  $('#cxDomainVerify').hidden = !info?.domain || info.status === 'verified';
  $('#cxDomainRemove').hidden = !info?.domain;
  $('#cxDomainError').textContent = info?.status === 'pending' && info.lastError ? info.lastError : '';
  const dns = $('#cxDomainDns');
  dns.hidden = !info?.domain;
  if (!info?.domain) { dns.replaceChildren(); return; }
  const row = (type, name, value) => h('div', { class:'cx-dns-row' }, h('b', {}, type), h('span', {}, h('small', {}, 'Имя'), h('code', {}, name)),
    h('span', {}, h('small', {}, 'Значение'), h('code', {}, value)), copyButton(value));
  dns.replaceChildren(
    info.status === 'verified'
      ? h('p', {}, 'Домен подтверждён: ', h('a', { href:info.url, target:'_blank', rel:'noopener' }, info.url), '. Если страница пока не открывается по HTTPS, сертификат для домена ещё выпускается администратором Vertux.')
      : h('p', {}, 'Добавьте у регистратора домена две записи и нажмите «Проверить DNS». Изменения DNS могут появляться до суток.'),
    row('CNAME', info.domain, info.target),
    row('TXT', info.txtName, info.txtValue));
}
async function saveDomain(value) {
  const button = $('#cxDomainForm [type="submit"]'); busy(button, true); $('#cxDomainError').textContent = '';
  try {
    state.context.domain = await api('domain', { method:'PUT', body:{ domain:value } });
    toast(value ? 'Домен сохранён — добавьте записи DNS' : 'Домен отключён');
    renderDomain(state.context.domain);
  } catch (error) {
    busy(button, false);
    $('#cxDomainError').textContent = error.message;
    return;
  }
  busy(button, false);
}
function renderDomainAndAccess() {
  const domain = can('manageDomain'), access = can('manageAccess');
  for (const id of ['cxDomainTitle', 'cxDomainLocked', 'cxDomainForm']) if (!domain) $('#' + id).hidden = true;
  $('#cxDomainTitle').hidden = !domain;
  $('#cxAccessTitle').hidden = !access; $('#cxAccessPanel').hidden = !access;
  if (domain) renderDomain(state.context.domain);
  if (access) renderAccess();
}
function renderAccess() { $('#cxVertuxSetup').checked = state.context.vertuxSetup === true; }

// ---------- profile ----------
function renderProfile() {
  const me = state.me, context = state.context;
  $('#cxProfileAvatar').textContent = (me.name || '·').trim().slice(0, 1).toUpperCase();
  $('#cxProfileName').textContent = me.name || 'Без имени';
  $('#cxProfileEmail').textContent = me.email || '';
  const facts = [['Роль', ROLE_LABELS[context.role] || context.role], ['Компания', context.product.organizationName], ['Кабинет', context.product.name],
    ['Горячие клавиши', Object.values(state.prefs.shortcuts).some(Boolean) ? 'Настроены — см. Настройки → Меню и клавиши' : 'Не заданы']];
  $('#cxProfileFacts').replaceChildren(...facts.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)]));
}

// ---------- waitlist ----------
async function loadWaitlist() {
  const host = $('#cxWaitState');
  setState(host, 'Загружаем лист ожидания…', 'loading');
  try { state.waitlist = (await api('waitlist')).entries; setState(host, ''); renderWaitlist(); }
  catch (error) { setState(host, error.message, 'error'); }
}
function renderWaitlist() {
  const list = $('#cxWaitlist'), statuses = { waiting:'Ждёт', contacted:'Связались', closed:'Закрыто' };
  if (!state.waitlist.length) {
    list.replaceChildren(h('div', { class:'empty-state cx-empty' }, h('h3', {}, 'В листе ожидания никого нет'),
      h('p', {}, 'Когда дата занята, клиент может оставить контакт. Отметьте дату занятой в календаре или дождитесь заполнения лимита.')));
    return;
  }
  list.replaceChildren(...state.waitlist.map(entry => {
    const freed = entry.status === 'waiting' && ['available','few'].includes(entry.dateStatus);
    return h('article', { class:`cx-wait${freed ? ' is-freed' : ''}` },
      h('div', { class:'cx-wait-date' }, h('strong', {}, dateText(entry.date, { day:'numeric', month:'short' })), h('small', {}, DATE_STATE[entry.dateStatus])),
      h('div', { class:'cx-wait-main' }, h('strong', {}, entry.customerName), contactNode(entry.contactMethod, entry.contactValue),
        h('small', {}, [entry.itemTitle, entry.note].filter(Boolean).join(' · ') || 'Без комментария'),
        freed ? h('p', { class:'cx-need-contact' }, 'Дата освободилась — свяжитесь с клиентом') : null),
      h('div', { class:'cx-wait-actions' }, h('span', { class:'cx-status' }, statuses[entry.status]),
        ...(can('manageWaitlist') ? ['contacted','closed'].filter(status => status !== entry.status).map(status => h('button', { type:'button', class:'button ghost compact-button',
          onclick:async event => { busy(event.currentTarget, true); try { await api(`waitlist/${entry.id}/status`, { method:'POST', body:{ status } }); await loadWaitlist(); void loadContext(); } catch (error) { toast(error.message, true); busy(event.currentTarget, false); } } },
          status === 'contacted' ? 'Связались' : 'Закрыть')) : [])));
  }));
}

// ---------- service center: subscription and support ----------
async function renderService() {
  const host = $('#cxServiceHost'), section = state.view === 'support' ? 'support' : 'subscription';
  try {
    await Promise.race([customElements.whenDefined('vertux-service-center'), new Promise((_, reject) => setTimeout(() => reject(new Error('Не удалось загрузить сервисный модуль. Обновите страницу.')), 8000))]);
  } catch (error) { setState(host, error.message, 'error'); return; }
  const component = h('vertux-service-center', { section, 'hide-header':true });
  component.serviceAdapter = createAccountServiceAdapter({ productId, request:(path, body, method = body ? 'POST' : 'GET') => request(path, { method, body }) });
  host.replaceChildren(component);
  themeService(component);
}
const SERVICE_THEME = '.subscription-access::before{display:none}.subscription-hero-note{display:none}.subscription-access-heading{padding-right:0}';
function themeService(component) {
  const root = component.shadowRoot;
  if (!root || !('adoptedStyleSheets' in root)) return;
  try { const sheet = new CSSStyleSheet(); sheet.replaceSync(SERVICE_THEME); root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]; }
  catch { /* the module keeps its own look */ }
}

// ---------- ordering options: cart and customer accounts ----------
function renderOrdering() {
  const ordering = state.context.ordering || { cart:false, accounts:false }, available = state.context.accountsAvailable === true;
  $('#cxCartSwitch').checked = ordering.cart; $('#cxCartSwitch').disabled = !can('manageStorefront');
  $('#cxAccountsSwitch').checked = ordering.accounts;
  $('#cxAccountsSwitch').disabled = !can('manageCustomers') || (!available && !ordering.accounts);
  $('#cxAccountsUnavailable').hidden = available || ordering.accounts;
}
async function saveOrdering(change, input) {
  const before = state.context.ordering || { cart:false, accounts:false, revision:0 };
  input.disabled = true;
  try {
    state.context.ordering = await api('ordering', { method:'PUT', body:{ ...before, ...change, revision:before.revision || 0 } });
    toast(change.cart === true ? 'Корзина включена — клиенты могут заказать несколько изделий сразу'
      : change.cart === false ? 'Корзина выключена — одна заявка на одно изделие'
        : change.accounts ? 'Кабинет покупателя включён. Скидки и список покупателей — в разделе «Покупатели»' : 'Кабинет покупателя выключен. Данные покупателей сохранены');
    renderMenu();
  } catch (error) { toast(error.message, true); }
  renderOrdering();
}

// ---------- customers: registered buyers, their history and discounts ----------
const CUSTOMER_FILTERS = [['all', 'Все'], ['regular', 'Постоянные'], ['discount', 'Со скидкой'], ['priority', 'С приоритетом']];
const LOYALTY_FILTER = { all:() => true, regular:customer => customer.standing.regular, discount:customer => customer.standing.percent > 0, priority:customer => customer.standing.priority };
const ordersWord = count => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'заказ' : [2,3,4].includes(count % 10) && ![12,13,14].includes(count % 100) ? 'заказа' : 'заказов'}`;
function selectCustomerTab(tab) {
  state.customerTab = tab === 'loyalty' ? 'loyalty' : 'list';
  for (const name of ['list', 'loyalty']) {
    const active = name === state.customerTab;
    $(`#cxCustomerTab-${name}`).setAttribute('aria-selected', String(active));
    $(`#cxCustomerTab-${name}`).tabIndex = active ? 0 : -1;
    $(`#cxCustomerPanel-${name}`).hidden = !active;
  }
  $('#cxCustomerSearch').hidden = state.customerTab !== 'list';
  if (state.customerTab === 'loyalty') renderLoyalty();
}
async function loadCustomers() {
  selectCustomerTab(state.customerTab);
  const host = $('#cxCustomersState');
  setState(host, 'Загружаем покупателей…', 'loading');
  try {
    const data = await api('customers');
    state.customers = data.customers; state.context.loyalty = data.loyalty;
    setState(host, ''); renderCustomers();
    if (state.customerTab === 'loyalty') renderLoyalty();
  } catch (error) { setState(host, error.message, 'error'); }
}
function renderCustomers() {
  if (state.customerFilter === 'priority' && !planAllows('priority')) state.customerFilter = 'all';
  $('#cxCustomerFilters').replaceChildren(...CUSTOMER_FILTERS.filter(([value]) => value !== 'priority' || planAllows('priority')).map(([value, label]) => h('button', { type:'button', class:state.customerFilter === value ? 'active' : '',
    'aria-pressed':String(state.customerFilter === value), onclick:() => { state.customerFilter = value; renderCustomers(); } }, label)));
  const query = state.customerSearch.trim().toLowerCase();
  const shown = state.customers.filter(LOYALTY_FILTER[state.customerFilter])
    .filter(customer => !query || [customer.name, customer.email, customer.contactValue].some(value => value.toLowerCase().includes(query)));
  const list = $('#cxCustomers');
  if (!state.customers.length) {
    list.replaceChildren(h('div', { class:'empty-state cx-empty' }, h('h3', {}, 'Покупателей пока нет'),
      h('p', {}, 'Когда клиент войдёт на витрине по почте, он появится здесь со всеми заказами. Попросите постоянных клиентов зарегистрироваться — их прошлые заказы можно добавить в карточке.'),
      h('button', { class:'button ghost compact-button', type:'button', onclick:() => copyPublicUrl() }, 'Скопировать ссылку на витрину')));
    return;
  }
  if (!shown.length) { list.replaceChildren(h('div', { class:'empty-state cx-empty' }, h('h3', {}, 'Никого не нашли'), h('p', {}, 'Измените поиск или фильтр.'))); return; }
  list.replaceChildren(...shown.map(customer => {
    const standing = customer.standing;
    return h('article', { class:`cx-buyer-row${standing.priority ? ' is-priority' : ''}` },
      h('button', { type:'button', class:'cx-buyer-open', onclick:() => openCustomer(customer.id), 'aria-label':`Покупатель ${customer.name}` },
        h('span', { class:'avatar', 'aria-hidden':'true' }, customer.name.trim().slice(0, 1).toUpperCase()),
        h('span', { class:'cx-buyer-main' }, h('strong', {}, customer.name, standing.priority ? h('em', { class:'cx-buyer-flag' }, 'приоритет') : null),
          h('small', {}, `${ordersWord(standing.completedOrders)} выдано · ${money(standing.spentMinor) || '0 ₽'}${customer.lastOrderDate ? ` · последний на ${dateText(customer.lastOrderDate, { day:'numeric', month:'short' })}` : ''}`),
          h('small', {}, customer.email)),
        h('span', { class:'cx-buyer-side' }, standing.percent ? h('span', { class:'cx-status cx-status-ready' }, `скидка ${standing.label}`)
          : standing.upcoming ? h('small', {}, `до скидки ${standing.upcoming.basis === 'orders' ? ordersWord(standing.upcoming.remaining) : money(standing.upcoming.remaining)}`) : null)),
      h('div', { class:'cx-order-contact' }, contactNode(customer.contactMethod, customer.contactValue)));
  }));
}
async function openCustomer(id) {
  const dialog = $('#cxCustomerDialog'), panel = $('#cxCustomerPanel');
  panel.replaceChildren(h('p', { class:'cx-state loading' }, 'Загружаем покупателя…'));
  if (!dialog.open) dialog.showModal();
  let customer;
  try { customer = await api(`customers/${id}`); }
  catch (error) { panel.replaceChildren(h('p', { class:'cx-state error' }, error.message), h('button', { class:'button ghost', value:'close' }, 'Закрыть')); return; }
  const standing = customer.standing, editable = can('manageCustomers');
  const field = (label, input) => h('label', {}, label, input);
  const prior = h('input', { type:'number', min:'0', max:'10000', inputmode:'numeric', value:String(customer.priorOrders), disabled:!editable });
  const priorAmount = h('input', { inputmode:'decimal', maxlength:'12', value:customer.priorAmountMinor ? String(customer.priorAmountMinor / 100) : '', placeholder:'0', disabled:!editable });
  const priority = h('input', { type:'checkbox', checked:customer.priority, disabled:!editable || (!planAllows('priority') && !customer.priority) });
  const note = h('textarea', { rows:'2', maxlength:'600', disabled:!editable }); note.value = customer.ownerNote || '';
  const summary = [standing.percent ? `Скидка сейчас: ${standing.label}` : 'Скидки пока нет',
    standing.upcoming ? `до скидки ${standing.upcoming.percent}% — ещё ${standing.upcoming.basis === 'orders' ? ordersWord(standing.upcoming.remaining) : money(standing.upcoming.remaining)}` : '',
    standing.priority ? 'приоритет в очереди' : ''].filter(Boolean).join(' · ');
  const statuses = state.context.options.statuses;
  panel.replaceChildren(
    h('div', { class:'panel-head' }, h('div', {}, h('p', { class:'eyebrow' }, 'Покупатель'), h('h3', { id:'cxCustomerTitle' }, customer.name)),
      h('button', { class:'icon-button', value:'close', 'aria-label':'Закрыть' }, h('span', { 'aria-hidden':'true' }, '×'))),
    h('div', { class:'cx-dialog-scroll' },
      h('div', { class:'cx-customer' }, h('strong', {}, customer.email), contactNode(customer.contactMethod, customer.contactValue),
        h('small', {}, `Кабинет с ${dateText(customer.createdAt.slice(0, 10), { day:'numeric', month:'long', year:'numeric' })}`)),
      h('p', { class:'cx-buyer-note' }, `${ordersWord(standing.completedOrders)} и ${money(standing.spentMinor) || '0 ₽'} с учётом заказов до Nexus. ${summary}.`),
      h('h4', {}, 'Заказы до Nexus и приоритет'),
      h('div', { class:'form-row' }, field('Выдано заказов до Nexus', prior), field('На сумму, ₽', priorAmount)),
      h('label', { class:'check-row' }, priority, h('span', {}, planAllows('priority') ? 'Приоритет в очереди: видит места, отложенные для постоянных' : 'Приоритет в очереди — на тарифе «Расширенный»')),
      field('Заметка для себя', note),
      editable ? h('button', { type:'button', class:'button primary compact-button', onclick:async event => {
        busy(event.currentTarget, true);
        try {
          await api(`customers/${customer.id}`, { method:'PUT', body:{ priorOrders:Number(prior.value) || 0, priorAmount:priorAmount.value || 0, priority:priority.checked, ownerNote:note.value } });
          toast('Карточка покупателя сохранена'); await openCustomer(customer.id); void loadCustomers();
        } catch (error) { toast(error.message, true); busy(event.currentTarget, false); }
      } }, 'Сохранить') : h('p', { class:'cx-hint' }, 'Менять скидки и заметки может владелец или администратор.'),
      h('h4', {}, 'История заказов'),
      customer.orders.length ? h('ol', { class:'cx-history cx-buyer-orders' }, ...customer.orders.map(order => h('li', {},
        h('button', { type:'button', class:'text-button', onclick:() => { $('#cxCustomerDialog').close(); void openOrder(order.id); } },
          `№${order.number} · ${dateText(order.date, { day:'numeric', month:'short' })}`),
        h('small', {}, `${statuses[order.status] || order.status} · ${order.lines.map(line => `${line.itemTitle} × ${line.quantity}`).join(', ')}`,
          order.totalMinor !== null ? ` · ${order.estimateFrom ? 'от ' : ''}${money(order.totalMinor)}` : '', order.discountPercent ? ` · скидка ${order.discountPercent}%` : ''))))
        : h('p', { class:'cx-hint' }, 'Заказов через кабинет пока нет.')));
}

// Loyalty tiers are edited as rows; amounts are shown in roubles.
function loyaltyDraft() {
  const saved = state.context.loyalty || { tiers:[], reservedPerDay:0, revision:0 };
  state.loyaltyDraft ??= { tiers:saved.tiers.map(tier => ({ ...tier, threshold:tier.basis === 'amount' ? tier.threshold / 100 : tier.threshold })), reservedPerDay:saved.reservedPerDay || 0 };
  return state.loyaltyDraft;
}
function renderLoyalty() {
  const draft = loyaltyDraft(), editable = can('manageCustomers'), form = $('#cxCustomerPanel-loyalty');
  const options = (entries, current) => Object.entries(entries).map(([value, label]) => h('option', { value, selected:value === current }, label));
  $('#cxTiers').replaceChildren(...(draft.tiers.length ? draft.tiers.map((tier, index) => h('li', { class:'cx-tier' },
    h('span', {}, 'После'),
    h('input', { type:'number', min:'1', inputmode:'numeric', value:String(tier.threshold), 'aria-label':'Порог', disabled:!editable, oninput:event => { tier.threshold = event.currentTarget.value; } }),
    h('select', { 'aria-label':'Считать', disabled:!editable, onchange:event => { tier.basis = event.currentTarget.value; } }, ...options(state.context.options.loyaltyBases, tier.basis)),
    h('span', {}, '— скидка'),
    h('input', { type:'number', min:'0', max:'50', inputmode:'numeric', value:String(tier.percent), 'aria-label':'Скидка, %', disabled:!editable, oninput:event => { tier.percent = event.currentTarget.value; } }),
    h('span', {}, '%'),
    h('select', { 'aria-label':'Как действует', disabled:!editable, onchange:event => { tier.scope = event.currentTarget.value; } }, ...options(state.context.options.loyaltyScopes, tier.scope)),
    h('label', { class:'check-row' }, h('input', { type:'checkbox', checked:tier.priority, disabled:!editable || (!planAllows('priority') && !tier.priority), onchange:event => { tier.priority = event.currentTarget.checked; } }), h('span', {}, 'приоритет')),
    editable ? h('button', { type:'button', class:'icon-button', 'aria-label':'Убрать условие', onclick:() => { draft.tiers.splice(index, 1); renderLoyalty(); } }, '×') : null))
    : [h('li', { class:'cx-hint' }, 'Условий пока нет. Например: после 5 заказов — 5% на следующий, после 30 — 10% на все заказы.')]));
  form.elements.reservedPerDay.value = String(draft.reservedPerDay);
  form.elements.reservedPerDay.disabled = !editable || (!planAllows('priority') && !Number(draft.reservedPerDay));
  // Without the tariff the kept places can only go down.
  form.elements.reservedPerDay.max = planAllows('priority') ? '50' : String(state.context.loyalty?.reservedPerDay || 0);
  $('#cxPriorityPlan').hidden = planAllows('priority');
  $('#cxTierAdd').hidden = !editable || draft.tiers.length >= 8;
  form.querySelector('[type="submit"]').hidden = !editable;
}
function bindCustomers() {
  $$('[data-customer-tab]').forEach(button => button.addEventListener('click', () => selectCustomerTab(button.dataset.customerTab)));
  $('#cxCustomerTabs').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); selectCustomerTab(state.customerTab === 'list' ? 'loyalty' : 'list'); $(`#cxCustomerTab-${state.customerTab}`).focus();
  });
  $('#cxCustomerSearch').addEventListener('input', event => { state.customerSearch = event.currentTarget.value; renderCustomers(); });
  $('#cxCustomerDialog').addEventListener('close', () => $('#cxCustomerPanel').replaceChildren());
  $('#cxTierAdd').addEventListener('click', () => {
    const draft = loyaltyDraft(), last = draft.tiers.at(-1);
    draft.tiers.push({ basis:'orders', threshold:last?.basis === 'orders' ? Number(last.threshold) * 2 || 5 : 5, percent:5, scope:'next', priority:false });
    renderLoyalty();
  });
  $('#cxCustomerPanel-loyalty').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('[type="submit"]'), draft = loyaltyDraft();
    busy(button, true);
    try {
      const body = { tiers:draft.tiers.map(tier => ({ basis:tier.basis, threshold:tier.basis === 'orders' ? Number(tier.threshold) : String(tier.threshold), percent:Number(tier.percent),
        scope:tier.scope, priority:tier.priority === true })), reservedPerDay:Number(form.elements.reservedPerDay.value) || 0, revision:state.context.loyalty?.revision || 0 };
      state.context.loyalty = await api('loyalty', { method:'PUT', body });
      state.loyaltyDraft = null; renderLoyalty(); toast('Скидки сохранены — покупатели увидят их на витрине');
      void loadCustomers();
    } catch (error) { toast(error.message, true); } finally { busy(button, false); }
  });
  $('#cxCartSwitch').addEventListener('change', event => void saveOrdering({ cart:event.currentTarget.checked }, event.currentTarget));
  $('#cxAccountsSwitch').addEventListener('change', event => {
    const input = event.currentTarget;
    if (!input.checked && !confirm('Выключить кабинет покупателя? Покупатели не смогут войти и получать скидки, но их данные и история сохранятся.')) { input.checked = true; return; }
    void saveOrdering({ accounts:input.checked }, input);
  });
}

// ---------- events ----------
function bindEvents() {
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-view-link]');
    if (link) { event.preventDefault(); showView(link.dataset.viewLink); return; }
    if (event.target.closest('[data-home-link]')) { event.preventDefault(); showView(homeView()); return; }
    const more = event.target.closest('[data-more]');
    if (more) { const menu = $('#cxMore'); menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); return; }
    const settingsLink = event.target.closest('[data-settings-link]');
    if (settingsLink) { state.settingsPage = settingsLink.dataset.settingsLink; showView('settings'); return; }
    if (!event.target.closest('#cxMore')) closeMore();
  });
  document.addEventListener('keydown', onShortcut);
  $('#cxProducts').addEventListener('click', () => location.assign('/launch?choose=1'));
  $('#cxProfileProducts').addEventListener('click', () => location.assign('/launch?choose=1'));
  $('#cxCollapse').addEventListener('click', () => updatePrefs(prefs => { prefs.compact = !prefs.compact; }, { immediate:true }));
  $$('#cxSettingsNav [data-settings-page]').forEach(button => button.addEventListener('click', () => openSettingsPage(button.dataset.settingsPage)));
  $('#cxCabinetAccent').addEventListener('input', event => { state.prefs.accent = event.currentTarget.value.toUpperCase(); applyLook(); });
  $('#cxCabinetAccent').addEventListener('change', event => updatePrefs(prefs => { prefs.accent = event.currentTarget.value.toUpperCase(); }, { immediate:true }));
  $('#cxCabinetAccentReset').addEventListener('click', () => updatePrefs(prefs => { prefs.accent = null; prefs.background = null; }, { immediate:true }));
  $('#cxCabinetBackground').addEventListener('input', event => { state.prefs.background = event.currentTarget.value.toUpperCase(); applyLook(); });
  $('#cxCabinetBackground').addEventListener('change', event => updatePrefs(prefs => { prefs.background = event.currentTarget.value.toUpperCase(); }, { immediate:true }));
  bindLookControls('cabinet', {
    light:() => ({ ...LIGHT_DEFAULT, ...(state.prefs.cardLight || {}) }),
    setLight:(value, save) => { if (save) updatePrefs(prefs => { prefs.cardLight = value; }, { immediate:true }); else { state.prefs.cardLight = value; applyLook(); } },
    setShade:(value, save) => {
      if (!state.prefs.wallpaper) return;
      if (save) updatePrefs(prefs => { prefs.wallpaper = { ...prefs.wallpaper, shade:value }; }, { immediate:true }); else { state.prefs.wallpaper = { ...state.prefs.wallpaper, shade:value }; applyLook(); }
    },
    upload:async file => { const data = await wallpaperData(file); updatePrefs(prefs => { prefs.wallpaper = { data, shade:prefs.wallpaper?.shade ?? 65 }; }, { immediate:true }); return 'Фон применён и сохранён в вашем аккаунте.'; },
    remove:() => updatePrefs(prefs => { prefs.wallpaper = null; }, { immediate:true }),
  });
  $('#cxLookReset').addEventListener('click', () => {
    if (!confirm('Вернуть стандартное оформление кабинета? Тема, цвета, подсветка и свой фон сбросятся.')) return;
    updatePrefs(prefs => { Object.assign(prefs, { theme:DEFAULT_PREFS.theme, accent:null, background:null, cardLight:{ ...LIGHT_DEFAULT }, wallpaper:null }); }, { immediate:true });
  });
  $('#cxCompact').addEventListener('change', event => updatePrefs(prefs => { prefs.compact = event.currentTarget.checked; }, { immediate:true }));
  $('#cxMenuReset').addEventListener('click', () => updatePrefs(prefs => {
    Object.assign(prefs, { order:[...DEFAULT_PREFS.order], hidden:[], pinned:[], compact:false, shortcuts:{ ...DEFAULT_PREFS.shortcuts } });
  }, { immediate:true }));
  $('#cxShopAccent').addEventListener('input', event => { shopDraft().accentColor = event.currentTarget.value.toUpperCase(); renderShopTheme(); });
  $('#cxShopAccentReset').addEventListener('click', () => { Object.assign(shopDraft(), { accentColor:'#E8792B', backgroundColor:null }); renderShopTheme(); });
  $('#cxShopBackground').addEventListener('input', event => { shopDraft().backgroundColor = event.currentTarget.value.toUpperCase(); renderShopTheme(); });
  bindLookControls('shop', {
    light:() => shopDraft().cardLight,
    setLight:value => { shopDraft().cardLight = value; renderShopTheme(); },
    setShade:value => { shopDraft().backgroundShade = value; renderShopTheme(); },
    upload:async file => { const media = await api('media', { method:'POST', body:{ data:await compressImage(file) } }); shopDraft().backgroundMediaId = media.id; renderShopTheme(); return 'Фото загружено. Сохраните оформление, чтобы клиенты его увидели.'; },
    remove:() => { shopDraft().backgroundMediaId = null; renderShopTheme(); },
  });
  $('#cxShopThemeSave').addEventListener('click', async event => {
    const button = event.currentTarget, draft = shopDraft(); busy(button, true);
    try {
      await saveStorefront({ theme:draft.theme, accentColor:draft.accentColor, backgroundColor:draft.backgroundColor, cardLight:draft.cardLight,
        backgroundMediaId:draft.backgroundMediaId, backgroundShade:draft.backgroundShade }, 'Оформление витрины сохранено — клиенты увидят его сразу');
      state.shopDraft = null; renderShopTheme();
    }
    catch (error) { toast(error.message, true); }
    finally { busy(button, false); renderShopTheme(); }
  });
  $('#cxLogout').addEventListener('click', async event => {
    busy(event.currentTarget, true);
    try { await request('/api/logout', { method:'POST', body:{} }); } catch { /* the session may already be gone */ }
    location.replace('/');
  });
  $('#cxOrdersRefresh').addEventListener('click', () => loadOrders());
  $('#cxOrderDialog').addEventListener('close', () => $('#cxOrderPanel').replaceChildren());
  $('#cxPrevMonth').addEventListener('click', () => { state.month = monthShift(state.month, -1); void loadCalendar(); });
  $('#cxNextMonth').addEventListener('click', () => { state.month = monthShift(state.month, 1); void loadCalendar(); });
  $('#cxDateClose').addEventListener('click', () => { $('#cxDateForm').hidden = true; state.selectedDate = null; renderCalendar(); });
  $$('#cxDateForm input[name="kind"]').forEach(input => input.addEventListener('change', syncDateCapacity));
  $('#cxWeekdayToggle').addEventListener('change', syncCalendarBlocks);
  $('#cxPickupToggle').addEventListener('change', syncCalendarBlocks);
  const saveRange = async (kind, button) => {
    const form = $('#cxRangeForm');
    if (!form.elements.from.value || !form.elements.to.value) { toast('Укажите первую и последнюю дату периода.', true); return; }
    busy(button, true);
    try {
      const result = await api('dates/range', { method:'PUT', body:{ from:form.elements.from.value, to:form.elements.to.value, kind, note:form.elements.note.value } });
      const orders = result.orders ? ` На эти даты уже есть заказы (${result.orders}) — они остались, свяжитесь с клиентами.` : '';
      toast(kind === 'closed' ? `Закрыто дат: ${result.dates}.${orders}` : `Даты вернулись к общим правилам: ${result.dates}.`);
      await loadCalendar();
    } catch (error) { toast(error.message, true); } finally { busy(button, false); }
  };
  $('#cxRangeForm').addEventListener('submit', event => { event.preventDefault(); void saveRange('closed', event.currentTarget.querySelector('[type="submit"]')); });
  $('#cxRangeOpen').addEventListener('click', event => void saveRange('default', event.currentTarget));
  bindCustomers();
  $('#cxCalendarForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type="submit"]'); busy(button, true);
    try {
      const weekdayCapacity = $('#cxWeekdayToggle').checked
        ? Object.fromEntries($$('[data-weekday-limit]', form).map(input => [input.dataset.weekdayLimit, Number(input.value)])) : null;
      const pickup = $('#cxPickupToggle').checked
        ? { enabled:true, windows:parseWindows(form.elements.pickupWindows.value), perWindow:form.elements.perWindow.value === '' ? null : Number(form.elements.perWindow.value) }
        : { enabled:false };
      const body = { workingDays:$$('input[name="workingDays"]:checked', form).map(input => Number(input.value)), dailyCapacity:Number(form.elements.dailyCapacity.value),
        weekdayCapacity, pickup, leadDays:Number(form.elements.leadDays.value), horizonDays:Number(form.elements.horizonDays.value), timeZone:form.elements.timeZone.value,
        revision:state.calendar.calendar.revision };
      if (!body.workingDays.length) throw new Error('Выберите хотя бы один рабочий день.');
      await api('calendar', { method:'PUT', body }); toast('Правила календаря сохранены'); await loadContext(); await loadCalendar();
    } catch (error) { toast(error.message, true); } finally { busy(button, false); }
  });
  $('#cxDateForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type="submit"]'); busy(button, true);
    try {
      const kind = form.elements.kind.value;
      if (!kind) throw new Error('Выберите состояние даты.');
      const capacity = form.elements.capacity.value === '' ? null : Number(form.elements.capacity.value);
      if (kind === 'limit' && capacity === null) throw new Error('Укажите лимит заказов на эту дату.');
      await api(`dates/${state.selectedDate}`, { method:'PUT', body:{ kind, capacity, note:form.elements.note.value } });
      toast('Дата обновлена'); await loadCalendar();
      const day = state.calendar.dates.find(item => item.date === state.selectedDate); if (day) openDate(day);
    } catch (error) { toast(error.message, true); } finally { busy(button, false); }
  });
  $('#cxAddItem').addEventListener('click', () => openItem(null));
  $$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('#cxItemMediaInput').addEventListener('change', event => uploadFiles(event.currentTarget, id => { if (state.itemMedia.length < 8 && !state.itemMedia.includes(id)) state.itemMedia.push(id); renderItemMedia(); }));
  $('#cxItemForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type="submit"]'), error = $('#cxItemError'); busy(button, true); error.textContent = '';
    try {
      const value = name => form.elements[name].value;
      const body = { title:value('title'), summary:value('summary'), description:value('description'), composition:value('composition'), unit:value('unit') || 'шт.',
        notes:value('notes'), price:value('price') || null, priceFrom:form.elements.priceFrom.checked, status:form.elements.hidden.checked ? 'hidden' : 'active',
        leadDays:value('leadDays') === '' ? null : Number(value('leadDays')), capacityUnits:Number(value('capacityUnits') || 1),
        minQuantity:Number(value('minQuantity') || 1), maxQuantity:Number(value('maxQuantity') || 50),
        sizes:parseOptions(value('sizes')), decorations:parseOptions(value('decorations')), fillings:parseOptions(value('fillings')), mediaIds:state.itemMedia,
        photoAutoplay:{ on:form.elements.autoplay.checked, seconds:Number(value('autoplaySeconds') || 5), direction:value('autoplayDirection') || 'forward' },
        sortOrder:state.editing?.sortOrder ?? Math.min(10000, Math.max(0, ...state.items.map(item => item.sortOrder)) + 10) };
      if (state.editing) await api(`catalog/${state.editing.id}`, { method:'PUT', body:{ ...body, revision:state.editing.revision } });
      else await api('catalog', { method:'POST', body });
      $('#cxItemDialog').close(); toast('Изделие сохранено'); await Promise.all([loadCatalog(), loadContext()]); renderOnboarding(); refreshPreview();
    } catch (failure) { error.textContent = failure.message; } finally { busy(button, false); }
  });
  $('#cxItemArchive').addEventListener('click', async event => {
    if (!state.editing || !confirm(`Удалить «${state.editing.title}» из каталога? Существующие заказы сохранятся.`)) return;
    busy(event.currentTarget, true);
    try { await api(`catalog/${state.editing.id}/archive`, { method:'POST', body:{} }); $('#cxItemDialog').close(); toast('Изделие удалено из каталога'); await Promise.all([loadCatalog(), loadContext()]); renderOnboarding(); refreshPreview(); }
    catch (error) { toast(error.message, true); } finally { busy(event.currentTarget, false); }
  });
  $('#cxLogoInput').addEventListener('change', event => uploadFiles(event.currentTarget, id => { state.logoId = id; storefrontMediaChanged(); sendDraft(); }));
  $('#cxLogoRemove').addEventListener('click', () => { state.logoId = null; storefrontMediaChanged(); sendDraft(); });
  $('#cxCoverInput').addEventListener('change', event => uploadFiles(event.currentTarget, id => { if (state.coverIds.length < 6 && !state.coverIds.includes(id)) state.coverIds.push(id); storefrontMediaChanged(); sendDraft(); }));
  $('#cxStorefrontForm').addEventListener('input', () => { setStorefrontDirty(true); sendDraft(); });
  window.addEventListener('message', onPreviewMessage);
  $$('[data-sf-mode]').forEach(button => button.addEventListener('click', () => { state.preview.mode = button.dataset.sfMode; renderPreviewToolbar(); sendPreviewMode(); }));
  $$('[data-sf-device]').forEach(button => button.addEventListener('click', () => { state.preview.device = button.dataset.sfDevice; renderPreviewToolbar(); }));
  $('#cxSfReload').addEventListener('click', reloadPreview);
  window.addEventListener('beforeunload', event => { if (state.preview.dirty) { event.preventDefault(); event.returnValue = ''; } });
  $('#cxSfRetry').addEventListener('click', reloadPreview);
  $('#cxStorefrontForm').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('[type="submit"]'); busy(button, true);
    try {
      const field = name => form.elements[name].value;
      const changes = { name:field('name'), tagline:field('tagline'), description:field('description'), format:field('format'),
        orderNote:field('orderNote'), privacyUrl:field('privacyUrl'), logoMediaId:state.logoId, coverMediaIds:state.coverIds,
        contacts:Object.fromEntries(['phone','telegram','whatsapp','vk','email','instagram','address','hours'].map(name => [name, field(name)])),
        published:form.elements.published.checked, acceptingOrders:form.elements.acceptingOrders.checked };
      await saveStorefront(changes, changes.published ? 'Витрина сохранена и опубликована' : 'Витрина сохранена');
      setStorefrontDirty(false); renderStorefront();
    } catch (error) { toast(error.message, true); } finally { busy(button, false); }
  });
  $('#cxDomainForm').addEventListener('submit', event => { event.preventDefault(); void saveDomain(event.currentTarget.elements.domain.value.trim()); });
  $('#cxDomainRemove').addEventListener('click', () => { if (confirm('Отключить свой домен? Витрина останется доступной по адресу Nexus.')) void saveDomain(''); });
  $('#cxDomainVerify').addEventListener('click', async event => {
    const button = event.currentTarget; busy(button, true);
    try { state.context.domain = await api('domain/verify', { method:'POST', body:{} }); toast(state.context.domain.status === 'verified' ? 'Домен подтверждён' : 'Записи DNS пока не найдены'); renderDomain(state.context.domain); }
    catch (error) { $('#cxDomainError').textContent = error.message; }
    finally { busy(button, false); }
  });
  $('#cxVertuxSetup').addEventListener('change', async event => {
    const input = event.currentTarget; input.disabled = true;
    try { const result = await api('access', { method:'PUT', body:{ vertuxSetup:input.checked } }); state.context.vertuxSetup = result.vertuxSetup; toast(result.vertuxSetup ? 'Настройка Vertux разрешена' : 'Настройка Vertux отключена'); }
    catch (error) { input.checked = !input.checked; toast(error.message, true); }
    finally { input.disabled = false; }
  });
  $('#cxRetry').addEventListener('click', () => location.reload());
  window.addEventListener('hashchange', () => { const view = location.hash.slice(1); if (view !== state.view && VIEWS[view]) showView(view, { focus:false }); });
  // While the order list is open, new public requests appear without a reload.
  state.poll = setInterval(() => { if (!setup() && state.view === 'orders' && document.visibilityState === 'visible') void loadOrders({ quiet:true }); }, 60000);
}

// ---------- welcome: a short tour the first time someone opens this cabinet ----------
const WELCOME_STEPS = [
  { view:'catalog', icon:'M4 10h16v10H4zM6 10V8a6 6 0 0 1 12 0v2M4 14h16', title:'Каталог',
    text:'Добавьте изделия: фото, цены, размеры и начинки. Покупатели увидят их на витрине.', action:'Открыть каталог' },
  { view:'calendar', icon:'M7 3v4m10-4v4M3 11h18M4 6h16v15H4z', title:'Календарь',
    text:'Отметьте выходные и сколько заказов берёте в день — занятые даты закроются сами.', action:'Открыть календарь' },
  { view:'storefront', icon:'M3 9 5 4h14l2 5M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0', title:'Витрина',
    text:'Выберите оформление, опубликуйте витрину и поделитесь ссылкой с покупателями.', action:'Открыть витрину' },
  { view:'orders', icon:'M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6M9 16h3', title:'Заказы',
    text:'Новые заявки приходят сюда. Свяжитесь с покупателем и меняйте статус — он видит, как идёт его заказ.', action:'К заказам' },
];
// Shown once per person and cabinet; never in Vertux setup mode. Without
// browser storage it is not shown at all rather than on every visit.
const welcomeKey = () => `nexus-cx-welcome:${productId}:${state.me?.id || state.me?.email || state.me?.name || ''}`;
function maybeWelcome() {
  if (setup() || !state.context || !state.me) return;
  let seen = true;
  try { seen = localStorage.getItem(welcomeKey()) === '1'; } catch { return; }
  if (!seen) setTimeout(openWelcome, 450);
}
function openWelcome() {
  const context = state.context, shop = context.storefront.name || context.product.name;
  const first = String(state.me.name || '').trim().split(/\s+/u)[0];
  const total = WELCOME_STEPS.length;
  let step = 0;
  const remember = () => { try { localStorage.setItem(welcomeKey(), '1'); } catch { /* storage closed: nothing to remember */ } };
  const slides = WELCOME_STEPS.map((item, index) => h('section', { class:'cx-welcome-slide', 'aria-label':`Шаг ${index + 1} из ${total}: ${item.title}` },
    h('span', { class:'cx-welcome-icon' }, icon(item.icon)),
    h('small', {}, `Шаг ${index + 1} из ${total}`), h('h3', {}, item.title), h('p', {}, item.text),
    allowedView(item.view) ? h('button', { type:'button', class:'cx-welcome-link', onclick:() => finish(item.view) }, `${item.action} →`) : null));
  const track = h('div', { class:'cx-welcome-track', 'data-step':'0' }, ...slides);
  const dots = WELCOME_STEPS.map((item, index) => h('button', { type:'button', class:'cx-welcome-dot', 'aria-label':`Шаг ${index + 1}: ${item.title}`, onclick:() => go(index) }));
  const back = h('button', { type:'button', class:'button ghost compact-button', onclick:() => go(step - 1) }, 'Назад');
  const next = h('button', { type:'button', class:'button primary compact-button', onclick:() => (step === total - 1 ? finish('catalog') : go(step + 1)) });
  const mark = context.storefront.logoMediaId ? h('img', { src:mediaUrl(context.storefront.logoMediaId), alt:'' }) : (shop || 'К').trim().slice(0, 1).toUpperCase();
  const dialog = h('dialog', { class:'cx-dialog cx-welcome', 'aria-labelledby':'cxWelcomeTitle' },
    h('div', { class:'cx-welcome-hero' },
      h('button', { type:'button', class:'cx-welcome-skip', onclick:() => finish(null) }, 'Пропустить'),
      h('span', { class:'cx-welcome-mark', 'aria-hidden':'true' }, mark),
      h('h2', { id:'cxWelcomeTitle' }, first ? `Добро пожаловать, ${first}!` : 'Добро пожаловать!'),
      h('p', {}, `Кабинет «${shop}» готов. Четыре шага — и витрина начнёт принимать заявки.`)),
    h('div', { class:'cx-welcome-body' }, track),
    h('div', { class:'cx-welcome-foot' }, back, h('div', { class:'cx-welcome-dots' }, ...dots), next));
  function go(index) {
    step = Math.max(0, Math.min(total - 1, index));
    track.dataset.step = String(step);
    slides.forEach((slide, position) => { slide.inert = position !== step; });
    dots.forEach((dot, position) => dot.setAttribute('aria-current', String(position === step)));
    back.disabled = step === 0;
    next.textContent = step === total - 1 ? 'Начать с каталога' : 'Далее';
  }
  function finish(view) {
    remember();
    dialog.close();
    if (view && allowedView(view)) showView(view);
  }
  dialog.addEventListener('keydown', event => {
    if (event.target.closest('input, textarea, select')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); go(step + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(step - 1); }
  });
  dialog.addEventListener('close', () => { remember(); dialog.remove(); });
  document.body.append(dialog);
  go(0);
  dialog.showModal();
  next.focus();
}

function fatal(title, text) {
  $('#cxBoot').hidden = true; $('#cxShell').hidden = true;
  $('#cxFatalTitle').textContent = title; $('#cxFatalText').textContent = text; $('#cxFatal').hidden = false;
}

async function start() {
  restoreLook();
  if (!/^[a-f0-9-]{36}$/iu.test(productId)) { fatal('Кабинет не найден', 'Откройте кабинет из списка ваших продуктов Nexus.'); return; }
  try {
    state.me = await request('/api/me');
    await loadContext();
  } catch (error) {
    if (error.status === 401) { location.replace('/'); return; }
    fatal(error.code === 'PLATFORM_ADMIN_DATA_PLANE_FORBIDDEN' ? 'Рабочие данные компании закрыты' : error.status === 403 ? 'Доступ приостановлен' : 'Кабинет недоступен', error.message);
    return;
  }
  // A failed preferences read keeps the default look; the cabinet still works.
  try { state.prefs = await api('preferences'); } catch { toast('Не удалось загрузить ваши настройки меню — показан вид по умолчанию.', true); }
  applyLook(); renderMenu();
  bindEvents();
  void loadOtherProducts();
  $('#cxBoot').hidden = true; $('#cxShell').hidden = false;
  showView(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : homeView(), { focus:false });
  maybeWelcome();
}

void start();
