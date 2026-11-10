// Public website demo of the confectionery Workspace. The real storefront and
// cabinet run unchanged; this module answers their /api/ calls from a fictional
// shop kept in sessionStorage of this browser tab. Nothing leaves the browser.
import * as model from './model.mjs';

const KEY = 'nexus-confectionery-demo-v2';
const PRODUCT_ID = '00000000-0000-4000-8000-00000000c0de';
const SLUG = 'vanilnoe-oblako';
const MEDIA = { logo:'0a11ce0000000000000000000000000a', cover1:'c0ffee0000000000000000000000000b', cover2:'c0ffee0000000000000000000000000c', cover3:'c0ffee0000000000000000000000000d',
  honey:'a0000000000000000000000000000001', cocoa:'a0000000000000000000000000000002', cupcakes:'a0000000000000000000000000000003',
  eclairs:'a0000000000000000000000000000004', macarons:'a0000000000000000000000000000005', cheesecake:'a0000000000000000000000000000006' };
const ACTIVE = model.ORDER_STATUSES.filter(status => status !== 'cancelled');
const fail = (message, status = 400, code = 'DEMO_INPUT_INVALID') => Object.assign(new Error(message), { status, code });
const id = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
const nowIso = () => new Date().toISOString();

function seed() {
  const today = model.localToday('Europe/Moscow');
  // Order dates must fall on working days (Tue–Sun) after the lead time.
  const nextOpen = (from) => { let date = model.addDays(today, from); while (model.weekday(date) === 1) date = model.addDays(date, 1); return date; };
  const option = (label, price = null) => ({ label, priceMinor: price === null ? null : price * 100 });
  const item = (key, title, summary, details) => ({ id: id(), status: 'active', sortOrder: 0, title, summary, description: details.description || '', composition: details.composition || '',
    priceMinor: details.price * 100, priceFrom: details.from === true, unit: details.unit || 'шт.', leadDays: details.lead ?? null, capacityUnits: details.slots || 1, notes: details.notes || '',
    sizes: details.sizes || [], decorations: details.decorations || [], fillings: details.fillings || [], mediaIds: [MEDIA[key], ...(details.photos || []).map(photo => MEDIA[photo])], photoAutoplay: details.autoplay || { on: false, seconds: 5, direction: 'forward' }, minQuantity: details.min || 1, maxQuantity: details.max || 50,
    revision: 1, createdAt: nowIso(), updatedAt: nowIso() });
  const items = [
    item('honey', 'Медовик', 'Тонкие медовые коржи и нежный сметанный крем', { price: 2400, from: true, lead: 2, composition: 'Мёд, мука, сметана, сливки, сливочное масло',
      sizes: [option('1,5 кг', 2400), option('2 кг', 3100), option('3 кг', 4500)], fillings: [option('Классический'), option('С черносливом', 300)], decorations: [option('Надпись'), option('Свежие ягоды', 500)] }),
    item('cocoa', 'Шоколадный с вишней', 'Шоколадный бисквит, вишнёвый конфитюр, крем на сливках', { price: 3200, from: true, lead: 3, slots: 2,
      composition: 'Шоколадный бисквит, вишня, сливки, тёмный шоколад 70%', sizes: [option('1,5 кг', 3200), option('2 кг', 4100)], decorations: [option('Надпись'), option('Шоколадный декор', 400)],
      notes: 'Большие торты занимают два производственных слота' }),
    item('cupcakes', 'Капкейки', 'Ванильные и шоколадные, с кремом-чиз', { price: 180, unit: 'шт.', min: 6, max: 48, photos: ['cover2', 'cover3'], autoplay: { on: true, seconds: 3, direction: 'forward' }, fillings: [option('Ваниль'), option('Шоколад'), option('Солёная карамель', 20)] }),
    item('eclairs', 'Эклеры', 'Заварное тесто, крем пломбир, глазурь', { price: 150, unit: 'шт.', min: 6, max: 60 }),
    item('macarons', 'Макарон, набор', '12 штук: фисташка, малина, лаванда, шоколад', { price: 1300, unit: 'набор', max: 10 }),
    item('cheesecake', 'Чизкейк Нью-Йорк', 'Плотный сливочный, на песочной основе', { price: 2200, from: true, lead: 2, sizes: [option('1 кг', 2200), option('1,5 кг', 3100)] }),
  ];
  const order = (number, date, target, status, customer, contactMethod, contactValue, extra = {}) => ({ id: id(), number, token: `demo${String(number).padStart(28, '0')}`, status, date,
    itemId: target.id, itemTitle: target.title, size: extra.size || '', decoration: extra.decoration || '', filling: extra.filling || '', quantity: extra.quantity || 1,
    capacityUnits: target.capacityUnits, wishes: extra.wishes || '', customerName: customer, contactMethod, contactValue,
    estimateMinor: extra.estimate ?? target.priceMinor, estimateFrom: target.priceFrom, ownerNote: extra.note || '', createdAt: model.addDays(today, -extra.ago || 0) + 'T09:30:00.000Z',
    updatedAt: nowIso(), events: [{ fromStatus: null, toStatus: 'new', actorUserId: null, createdAt: model.addDays(today, -extra.ago || 0) + 'T09:30:00.000Z' }] });
  const [honey, cocoa, cupcakes, eclairs, macarons] = items;
  const busy = nextOpen(4), full = nextOpen(9);
  const orders = [
    order(41, busy, cocoa, 'new', 'Ольга (пример)', 'telegram', '@olga_example', { size: '2 кг', decoration: 'Надпись', wishes: 'Надпись «С юбилеем, мама!»', estimate: 410000 }),
    order(40, nextOpen(6), cupcakes, 'new', 'Игорь (пример)', 'phone', '+7 900 000-00-01', { quantity: 12, filling: 'Солёная карамель', estimate: 240000 }),
    order(39, busy, honey, 'contacted', 'Анна (пример)', 'whatsapp', '+7 900 000-00-02', { size: '2 кг', estimate: 310000, ago: 1 }),
    order(38, nextOpen(5), macarons, 'confirmed', 'Мария (пример)', 'email', 'maria@example.com', { quantity: 2, estimate: 260000, ago: 2, note: 'Предоплата получена' }),
    order(37, nextOpen(3), eclairs, 'in_progress', 'Сергей (пример)', 'telegram', '@sergey_example', { quantity: 20, estimate: 300000, ago: 3 }),
    order(36, nextOpen(2), honey, 'ready', 'Елена (пример)', 'phone', '+7 900 000-00-03', { size: '1,5 кг', estimate: 240000, ago: 4 }),
    order(35, full, cocoa, 'confirmed', 'Дмитрий (пример)', 'telegram', '@dmitry_example', { size: '2 кг', estimate: 410000, ago: 5 }),
  ];
  return {
    version: 2,
    prefs: model.defaultCabinetPreferences(),
    storefront: { name: 'Ванильное облако', tagline: 'Торты и десерты на заказ', description: 'Домашняя кондитерская: натуральные сливки, сезонные ягоды и бельгийский шоколад. Это пример витрины с вымышленными данными.',
      format: 'custom', theme: 'cream', accentColor: '#E8792B', logoMediaId: MEDIA.logo, coverMediaIds: [MEDIA.cover1, MEDIA.cover2, MEDIA.cover3],
      contacts: { phone: '+7 900 000-00-00', telegram: '@vanilla_cloud_demo', whatsapp: '', vk: '', email: '', instagram: '', address: 'Самовывоз в центре города (пример)', hours: 'Вт–Вс, 10:00–19:00' },
      orderNote: 'Предоплата 50%. Самовывоз или доставка по городу.', privacyUrl: '', published: true, acceptingOrders: true, revision: 3, updatedAt: nowIso() },
    calendar: { configured: true, workingDays: [2, 3, 4, 5, 6, 7], dailyCapacity: 3, leadDays: 2, horizonDays: 60, timeZone: 'Europe/Moscow', revision: 2, updatedAt: nowIso() },
    overrides: { [full]: { kind: 'full', capacity: null, note: 'Большой свадебный заказ' }, [nextOpen(16)]: { kind: 'closed', capacity: null, note: 'Выходной' } },
    items, orders,
    waitlist: [{ id: id(), date: full, itemId: honey.id, itemTitle: honey.title, customerName: 'Татьяна (пример)', contactMethod: 'telegram', contactValue: '@tatiana_example',
      note: 'Подойдёт и соседний день', status: 'waiting', createdAt: nowIso(), updatedAt: nowIso() }],
  };
}

let memory = null;
function load() {
  if (memory) return memory;
  try { const stored = JSON.parse(sessionStorage.getItem(KEY)); if (stored?.version === 2) return (memory = stored); } catch { /* fresh demo */ }
  memory = seed(); save(); return memory;
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* demo continues in memory */ } }

const today = () => model.localToday(load().calendar.timeZone);
const usedUnits = date => load().orders.filter(order => order.date === date && ACTIVE.includes(order.status)).reduce((sum, order) => sum + order.capacityUnits, 0);
const dateStatus = (date, target = null) => model.dateStatus({ date, today: today(), calendar: load().calendar, override: load().overrides[date] || null, usedUnits: usedUnits(date),
  units: target?.capacityUnits || 1, leadDays: target?.leadDays || 0 });
// The cart switch of the demo cabinet; customer accounts need the Nexus mail and stay off here.
const ordering = () => ({ cart: load().ordering?.cart === true, accounts: false, revision: load().ordering?.revision || 0 });
// Several cart lines take their slots together and wait for the longest lead time.
const cartTarget = ids => { const targets = ids.map(findItem); return targets.some(item => !item) ? null
  : { capacityUnits: targets.reduce((sum, item) => sum + item.capacityUnits, 0), leadDays: Math.max(...targets.map(item => item.leadDays || 0)) }; };
const activeItems = () => load().items.filter(item => item.status === 'active');
const findItem = itemId => load().items.find(item => item.id === itemId && item.status !== 'archived');
const publicItem = ({ status, sortOrder, capacityUnits, revision, createdAt, updatedAt, ...item }) => item;
const orderView = ({ token, events, ...order }) => ({ ...order, pickupWindow: order.pickupWindow || '', customerId: null, discountPercent: 0, discountLabel: '',
  totalMinor: order.estimateMinor, lines: order.lines || [{ itemId: order.itemId, itemTitle: order.itemTitle, size: order.size, decoration: order.decoration,
    filling: order.filling, quantity: order.quantity, estimateMinor: order.estimateMinor, estimateFrom: order.estimateFrom }] });
function summary() {
  const counts = {};
  for (const order of load().orders) counts[order.status] = (counts[order.status] || 0) + 1;
  return { orders: counts, newOrders: counts.new || 0, waiting: load().waitlist.filter(entry => entry.status === 'waiting').length, activeItems: activeItems().length };
}
function onboarding() {
  const state = load();
  const steps = [
    { key: 'storefront', label: 'Название и контакты', done: Boolean(state.storefront.name && model.hasContact(state.storefront)) },
    { key: 'calendar', label: 'Рабочие дни и лимит заказов', done: state.calendar.configured },
    { key: 'catalog', label: 'Хотя бы одно изделие в каталоге', done: activeItems().length > 0 },
  ];
  return { steps, readyToPublish: steps.every(step => step.done), published: state.storefront.published, summary: summary() };
}
function choice(options, label, name) {
  if (!label) return '';
  if (!options.some(option => option.label === label)) throw fail(`${name}: выберите вариант из карточки.`);
  return label;
}

// Normalisers from the product throw {statusCode, apiCode}; keep their wording.
function guard(fn) {
  try { return fn(); } catch (error) { throw fail(error.message, error.statusCode || 400, error.apiCode || 'DEMO_INPUT_INVALID'); }
}

function shopRoute(path, method, body, query) {
  const state = load();
  if (path === '' && method === 'GET') {
    return { preview: false, accepting: state.storefront.published && state.storefront.acceptingOrders && state.calendar.configured, today: today(), mediaBase: './media/',
      shop: { ...state.storefront, action: model.FORMATS[state.storefront.format]?.action || 'Оставить заявку', formatLabel: model.FORMATS[state.storefront.format]?.label || '' },
      calendar: { configured: state.calendar.configured, leadDays: state.calendar.leadDays, horizonDays: state.calendar.horizonDays, timeZone: state.calendar.timeZone },
      ordering: { cart: ordering().cart, accounts: false }, pickup: { enabled: false, windows: [] }, customer: null,
      catalog: activeItems().map(publicItem), contactMethods: model.CONTACT_METHODS };
  }
  if (path === '/availability' && method === 'GET') {
    const ids = (query.get('items') || query.get('item') || '').split(',').filter(Boolean);
    const target = ids.length ? cartTarget(ids) : null;
    const month = query.get('month') || today().slice(0, 7);
    return { month, dates: guard(() => model.monthDates(month)).map(date => ({ date, status: dateStatus(date, target).status })) };
  }
  const tokenMatch = path.match(/^\/orders\/([A-Za-z0-9_-]{32})$/u);
  if (tokenMatch && method === 'GET') {
    const order = state.orders.find(entry => entry.token === tokenMatch[1]);
    if (!order) throw fail('Заявка не найдена.', 404);
    return { number: order.number, status: order.status, statusLabel: model.ORDER_STATUS_LABELS[order.status], date: order.date, itemTitle: order.itemTitle, createdAt: order.createdAt };
  }
  if (path === '/orders' && method === 'POST') {
    const request = guard(() => model.normalizeOrderRequest(body));
    const prior = state.orders.find(order => order.requestId === request.requestId);
    if (prior) return { number: prior.number, status: prior.status, statusLabel: model.ORDER_STATUS_LABELS[prior.status], date: prior.date, itemTitle: prior.itemTitle, token: null, reused: true };
    if (request.lines.length > 1 && !ordering().cart) throw fail('Корзина выключена: отправьте каждое изделие отдельной заявкой.', 400, 'CONFECTIONERY_CART_DISABLED');
    const lines = request.lines.map(line => {
      const item = findItem(line.itemId);
      if (!item || item.status !== 'active') throw fail('Это изделие сейчас недоступно для заказа.', 409);
      if (line.quantity < item.minQuantity || line.quantity > item.maxQuantity) throw fail(`«${item.title}»: количество от ${item.minQuantity} до ${item.maxQuantity} ${item.unit}`);
      const size = choice(item.sizes, line.size, 'Размер'), decoration = choice(item.decorations, line.decoration, 'Оформление'), filling = choice(item.fillings, line.filling, 'Начинка');
      const price = model.estimate(item, { ...line, size, decoration, filling });
      return { itemId: item.id, itemTitle: item.title, size, decoration, filling, quantity: line.quantity, capacityUnits: item.capacityUnits, leadDays: item.leadDays, ...price };
    });
    const target = { capacityUnits: lines.reduce((sum, line) => sum + line.capacityUnits, 0), leadDays: Math.max(...lines.map(line => line.leadDays || 0)) };
    const status = dateStatus(request.date, target).status;
    if (status === 'full') throw fail('На эту дату мест больше нет. Выберите другую дату или встаньте в лист ожидания.', 409, 'CONFECTIONERY_DATE_FULL');
    if (status === 'unavailable') throw fail('Эта дата недоступна для заказа. Выберите другую.', 409, 'CONFECTIONERY_DATE_UNAVAILABLE');
    const priced = lines.filter(line => line.estimateMinor !== null), first = lines[0], single = lines.length === 1;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[byte % 64]).join('');
    const order = { id: id(), number: Math.max(0, ...state.orders.map(entry => entry.number)) + 1, token, requestId: request.requestId, status: 'new', date: request.date,
      itemId: first.itemId, itemTitle: single ? first.itemTitle : `${first.itemTitle} и ещё ${lines.length - 1}`, size: single ? first.size : '', decoration: single ? first.decoration : '',
      filling: single ? first.filling : '', quantity: lines.reduce((sum, line) => sum + line.quantity, 0), capacityUnits: target.capacityUnits, wishes: request.wishes,
      customerName: request.customerName, contactMethod: request.contactMethod, contactValue: request.contactValue,
      estimateMinor: priced.length ? priced.reduce((sum, line) => sum + line.estimateMinor, 0) : null, estimateFrom: lines.some(line => line.estimateFrom) || (priced.length > 0 && priced.length < lines.length),
      lines: lines.map(({ capacityUnits, leadDays, ...line }) => line), ownerNote: '', createdAt: nowIso(), updatedAt: nowIso(), events: [{ fromStatus: null, toStatus: 'new', actorUserId: null, createdAt: nowIso() }] };
    state.orders.unshift(order); save();
    return { number: order.number, status: 'new', statusLabel: model.ORDER_STATUS_LABELS.new, date: order.date, itemTitle: order.itemTitle, estimateMinor: order.estimateMinor,
      estimateFrom: order.estimateFrom, lines: order.lines.map(line => ({ itemTitle: line.itemTitle, quantity: line.quantity })), pickupWindow: '', discountPercent: 0,
      totalMinor: order.estimateMinor, token, reused: false };
  }
  if (path === '/waitlist' && method === 'POST') {
    const request = guard(() => model.normalizeWaitlistRequest(body));
    const ids = request.itemIds?.length ? request.itemIds : request.itemId ? [request.itemId] : [];
    const target = ids.length ? findItem(ids[0]) : null, units = ids.length ? cartTarget(ids) : null;
    if (dateStatus(request.date, units).status !== 'full') throw fail('Дата свободна — можно сразу отправить заявку.', 409, 'CONFECTIONERY_WAITLIST_NOT_NEEDED');
    state.waitlist.push({ id: id(), date: request.date, itemId: target?.id || null, itemTitle: target?.title || '', customerName: request.customerName, contactMethod: request.contactMethod,
      contactValue: request.contactValue, note: request.note, status: 'waiting', createdAt: nowIso(), updatedAt: nowIso() });
    save();
    return { date: request.date, status: 'waiting', reused: false };
  }
  throw fail('Метод не найден.', 404);
}

function cabinetRoute(section, target, action, method, body, query) {
  const state = load();
  if (section === 'context' && method === 'GET') {
    return { product: { id: PRODUCT_ID, name: state.storefront.name, organizationName: 'Пример: Ванильное облако' }, role: 'owner', setup: false,
      capabilities: { viewOrders: true, manageStorefront: true, manageCatalog: true, manageCalendar: true, manageDomain: false, manageOrders: true, manageWaitlist: true, manageAccess: false,
        viewCustomers: false, manageCustomers: false },
      publicPath: './storefront.html', vertuxSetup: true, domain: { domain: null, status: 'none', target: 'nexus.vertux.online' },
      storefront: state.storefront, calendar: state.calendar, ordering: ordering(), loyalty: { ...model.defaultLoyalty(), revision: 0 }, accountsAvailable: false,
      onboarding: onboarding(), today: today(),
      options: { formats: model.FORMATS, contactMethods: model.CONTACT_METHODS, statuses: model.ORDER_STATUS_LABELS, timeZones: model.TIME_ZONES,
        storefrontThemes: model.STOREFRONT_THEMES, cabinetThemes: model.CABINET_THEMES, cardLights: model.CARD_LIGHTS, wallpaperLimit: model.WALLPAPER_LIMIT, loyaltyBases: model.LOYALTY_BASES, loyaltyScopes: model.LOYALTY_SCOPES } };
  }
  if (section === 'ordering' && method === 'PUT') {
    const value = guard(() => model.normalizeOrdering(body));
    if (value.accounts) throw fail('В демо кабинет покупателя не включается: для входа по почте нужен настоящий Nexus.', 400);
    state.ordering = { cart: value.cart, accounts: false, revision: ordering().revision + 1 }; save(); return state.ordering;
  }
  if (section === 'preferences' && method === 'GET') return state.prefs;
  if (section === 'preferences' && method === 'PUT') { state.prefs = guard(() => model.normalizeCabinetPreferences(body)); save(); return state.prefs; }
  if (section === 'storefront' && method === 'PUT') {
    const value = guard(() => model.normalizeStorefront({ ...body, logoMediaId: state.storefront.logoMediaId, coverMediaIds: state.storefront.coverMediaIds }));
    state.storefront = { ...value, logoMediaId: state.storefront.logoMediaId, coverMediaIds: state.storefront.coverMediaIds, revision: state.storefront.revision + 1, updatedAt: nowIso() };
    save(); return state.storefront;
  }
  if (section === 'media') throw fail('В демо фотографии не загружаются. В своём кабинете можно добавить до 8 фото к каждому изделию.', 400);
  if (section === 'catalog' && method === 'GET' && !target) return { items: state.items.filter(item => item.status !== 'archived') };
  if (section === 'catalog' && method === 'POST' && !target) {
    const value = guard(() => model.normalizeItem({ ...body, mediaIds: [] }));
    const created = { ...value, id: id(), revision: 1, createdAt: nowIso(), updatedAt: nowIso() };
    state.items.push(created); save(); return created;
  }
  // Same rule as the product: listed items take the slots they already hold.
  if (section === 'catalog' && target === 'order' && method === 'PUT') {
    const ids = guard(() => model.normalizeItemOrder(body));
    const current = state.items.filter(item => item.status !== 'archived');
    if (ids.some(itemId => !current.some(item => item.id === itemId))) throw fail('Изделие не найдено. Обновите страницу.', 404);
    const listed = new Set(ids), queue = [...ids];
    const next = current.map(item => { if (!listed.has(item.id)) return item; const nextId = queue.shift(); return current.find(entry => entry.id === nextId); });
    next.forEach((item, index) => { if (item.sortOrder !== index * 10) { item.sortOrder = index * 10; item.revision += 1; } });
    state.items = [...next, ...state.items.filter(item => item.status === 'archived')];
    save(); return { items: next };
  }
  if (section === 'catalog' && target) {
    const index = state.items.findIndex(item => item.id === target && item.status !== 'archived');
    if (index < 0) throw fail('Изделие не найдено.', 404);
    if (method === 'POST' && action === 'archive') { state.items[index].status = 'archived'; save(); return { archived: true }; }
    if (method === 'PUT') {
      const value = guard(() => model.normalizeItem({ ...body, mediaIds: [] }));
      state.items[index] = { ...state.items[index], ...value, mediaIds: state.items[index].mediaIds, revision: state.items[index].revision + 1, updatedAt: nowIso() };
      save(); return state.items[index];
    }
  }
  if (section === 'calendar' && method === 'GET') {
    const month = query.get('month') || today().slice(0, 7);
    const dates = guard(() => model.monthDates(month)).map(date => {
      const status = dateStatus(date);
      return { date, override: state.overrides[date] || null, usedUnits: usedUnits(date), capacity: model.dayCapacity(state.calendar, date, state.overrides[date] || null),
        orders: state.orders.filter(order => order.date === date && ACTIVE.includes(order.status)).length,
        waiting: state.waitlist.filter(entry => entry.date === date && entry.status === 'waiting').length, ...status };
    });
    return { calendar: state.calendar, month, today: today(), dates };
  }
  if (section === 'calendar' && method === 'PUT') {
    state.calendar = { ...guard(() => model.normalizeCalendar(body)), revision: state.calendar.revision + 1, updatedAt: nowIso() }; save(); return state.calendar;
  }
  if (section === 'dates' && target === 'range' && method === 'PUT') {
    const range = guard(() => model.normalizeDateRange(body));
    let dates = 0, orders = 0;
    for (let date = range.from; date <= range.to; date = model.addDays(date, 1)) {
      if (range.kind === 'default') delete state.overrides[date]; else state.overrides[date] = { kind: 'closed', capacity: null, note: range.note };
      orders += state.orders.filter(order => order.date === date && ACTIVE.includes(order.status)).length; dates += 1;
    }
    save(); return { dates, orders };
  }
  if (section === 'dates' && method === 'PUT') {
    if (!model.isDate(target)) throw fail('Неверная дата.');
    const value = guard(() => model.normalizeOverride(body));
    if (value.kind === 'default') delete state.overrides[target]; else state.overrides[target] = value;
    save(); return { date: target, override: state.overrides[target] || null, status: dateStatus(target).status };
  }
  if (section === 'orders' && method === 'GET' && !target) {
    const filter = query.get('status');
    const from = model.addDays(today(), -30);
    const orders = (filter ? state.orders.filter(order => order.status === filter) : state.orders.filter(order => !['completed', 'cancelled'].includes(order.status) || order.date >= from))
      .slice().sort((a, b) => (a.status === 'new' ? 0 : 1) - (b.status === 'new' ? 0 : 1) || a.date.localeCompare(b.date) || a.number - b.number);
    return { orders: orders.map(orderView), summary: summary(), today: today() };
  }
  const order = target && state.orders.find(entry => entry.id === target);
  if (section === 'orders' && target && !order) throw fail('Заказ не найден.', 404);
  if (section === 'orders' && method === 'GET') return { ...orderView(order), events: order.events };
  if (section === 'orders' && method === 'POST' && action === 'status') {
    if (order.status !== body.expectedStatus) throw fail('Статус заказа уже изменили. Обновите список.', 409);
    if (!model.ORDER_STATUSES.includes(body.status)) throw fail('Неизвестный статус заказа.');
    order.events.push({ fromStatus: order.status, toStatus: body.status, actorUserId: 'demo-owner', createdAt: nowIso() });
    order.status = body.status; order.updatedAt = nowIso(); save(); return orderView(order);
  }
  if (section === 'orders' && method === 'PUT' && action === 'note') {
    order.ownerNote = guard(() => model.text(body.note, 1500, { name: 'Заметка', multiline: true })); save(); return orderView(order);
  }
  if (section === 'waitlist' && method === 'GET') return { entries: state.waitlist.filter(entry => entry.status !== 'closed').map(entry => ({ ...entry, dateStatus: dateStatus(entry.date).status })) };
  if (section === 'waitlist' && method === 'POST' && action === 'status') {
    const entry = state.waitlist.find(item => item.id === target);
    if (!entry) throw fail('Запись не найдена.', 404);
    entry.status = body.status; entry.updatedAt = nowIso(); save(); return entry;
  }
  if (section === 'domain' || section === 'access') throw fail('В демо свой домен и доступы не настраиваются.', 400);
  throw fail('Метод не найден.', 404);
}

function respond(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

const networkFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return networkFetch(input, init);
  const method = (init.method || 'GET').toUpperCase();
  let body = {};
  try { body = init.body ? JSON.parse(init.body) : {}; } catch { return respond(400, { ok: false, error: { code: 'DEMO_JSON', message: 'Некорректный запрос.' } }); }
  try {
    let data;
    if (url.pathname === '/api/me') data = { id: 'demo-owner', name: 'Мария', email: 'owner@example.com', csrfToken: 'demo' };
    // The demo account has no other workspaces, so «Продукты» stays hidden.
    else if (url.pathname === '/api/products') data = [];
    else if (url.pathname.startsWith(`/api/shop/${SLUG}`)) data = shopRoute(url.pathname.slice(`/api/shop/${SLUG}`.length), method, body, url.searchParams);
    else {
      const match = url.pathname.match(/^\/api\/confectionery\/[a-f0-9-]{36}\/([a-z]+)(?:\/([A-Za-z0-9-]{1,40}))?(?:\/([a-z]+))?$/u);
      if (!match) throw fail('Метод не найден.', 404);
      data = cabinetRoute(match[1], match[2], match[3], method, body, url.searchParams);
    }
    return respond(method === 'POST' && data && data.reused === false ? 201 : 200, { ok: true, data });
  } catch (error) {
    return respond(error.status || 400, { ok: false, error: { code: error.code || 'DEMO_ERROR', message: error.message || 'Не получилось.' } });
  }
};

// Subscription and support need a real Nexus account; the demo explains them instead.
const SERVICE_TEXT = {
  subscription: ['Подписка', 'Здесь владелец видит тариф, срок оплаты и историю платежей. Стоимость задаёт Vertux в тарифе Nexus — в демо оплата не подключена.'],
  support: ['Поддержка', 'Здесь владелец пишет в поддержку Vertux и видит ответы. В демо обращения не отправляются.'],
};
if (!customElements.get('vertux-service-center')) customElements.define('vertux-service-center', class extends HTMLElement {
  connectedCallback() {
    const [title, text] = SERVICE_TEXT[this.getAttribute('section')] || SERVICE_TEXT.subscription;
    const box = document.createElement('div'), heading = document.createElement('h3'), body = document.createElement('p');
    box.className = 'empty-state cx-empty'; heading.textContent = `${title} — в вашем кабинете`; body.textContent = text;
    box.append(heading, body); this.replaceChildren(box);
  }
});
document.documentElement.dataset.demoReady = 'true';
