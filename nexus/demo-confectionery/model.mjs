// Pure rules of the confectionery template: input normalisation and date
// availability. No storage, network or control-plane access lives here.

export const ORDER_STATUSES = Object.freeze(['new','contacted','confirmed','in_progress','ready','completed','cancelled']);
export const ORDER_STATUS_LABELS = Object.freeze({
  new:'Новая', contacted:'Связались', confirmed:'Подтверждена', in_progress:'В работе',
  ready:'Готова', completed:'Выдана', cancelled:'Отменена',
});
export const WAITLIST_STATUSES = Object.freeze(['waiting','contacted','closed']);
export const CONTACT_METHODS = Object.freeze({phone:'Телефон', telegram:'Telegram', whatsapp:'WhatsApp', vk:'ВКонтакте', email:'Почта'});
export const FORMATS = Object.freeze({
  custom:{label:'Кондитер на заказ', action:'Оставить заявку'},
  workshop:{label:'Кондитерская мастерская', action:'Оставить заявку'},
  shop:{label:'Магазин десертов', action:'Сделать предзаказ'},
});
export const TIME_ZONES = Object.freeze(['Europe/Kaliningrad','Europe/Moscow','Europe/Samara','Asia/Yekaterinburg','Asia/Omsk',
  'Asia/Novosibirsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok','Asia/Magadan','Asia/Kamchatka']);
export const DEFAULT_ACCENT = '#E8792B';
// Public storefront look; the owner picks it in the cabinet settings.
export const STOREFRONT_THEMES = Object.freeze({
  cream:{label:'Крем', note:'Тёплый светлый фон'}, white:{label:'Белая', note:'Чистый белый фон'},
  blush:{label:'Пудра', note:'Нежный розовый фон'}, chocolate:{label:'Шоколад', note:'Тёмная витрина'},
});
// Personal cabinet look and menu, stored per user so they follow the account.
export const CABINET_THEMES = Object.freeze({
  confectionery:{label:'Кондитерская', note:'Светлая, крем и оранжевый'}, chocolate:{label:'Шоколад', note:'Тёмная тёплая'},
  nexus:{label:'Nexus', note:'Тёмная фиолетовая'},
});
// Appearance as in Invest: card lighting and a custom background on top of the theme.
export const CARD_LIGHTS = Object.freeze({diffuse:'Рассеянный свет', full:'Вся карточка', corner:'Только угол', off:'Без подсветки'});
// A cabinet background is kept in the user's settings as a small JPEG data URL,
// so one settings request stays under the 64 KB request limit in production.
export const WALLPAPER_LIMIT = 56_000;
export const CABINET_SECTIONS = Object.freeze(['orders','calendar','waitlist','catalog','storefront','customers']);
export const CABINET_ACTIONS = Object.freeze([...CABINET_SECTIONS,'subscription','support','settings','profile']);
// Browsers keep Ctrl+1…9 for their tabs, so the defaults use Alt. «Покупатели»
// has no default: an owner may already use Alt+6 for something else.
export const DEFAULT_SHORTCUTS = Object.freeze({orders:'Alt+1', calendar:'Alt+2', waitlist:'Alt+3', catalog:'Alt+4', storefront:'Alt+5', customers:'',
  subscription:'', support:'', settings:'Alt+0', profile:''});
export const LOYALTY_BASES = Object.freeze({orders:'заказов', amount:'₽'});
export const LOYALTY_SCOPES = Object.freeze({next:'на следующий заказ', always:'на все заказы'});
const SHORTCUT = /^(?:(?:Ctrl|Alt|Shift|Meta)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|[,./;'[\]\\`=-])$/u;

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;
const WEEKDAY_NAMES = ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'];
const MEDIA_ID = /^[a-f0-9]{32}$/u;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const invalid = (message, code = 'CONFECTIONERY_INPUT_INVALID') => Object.assign(new Error(message), {statusCode:400, apiCode:code});

export function text(value, max, {name = 'Поле', required = false, multiline = false} = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw invalid(`${name}: ожидается текст.`);
  const result = (multiline ? value.replace(/\r\n?/gu, '\n') : value.replace(/\s+/gu, ' ')).trim();
  if (CONTROL.test(result)) throw invalid(`${name}: недопустимые символы.`);
  if (result.length > max) throw invalid(`${name}: не больше ${max} символов.`);
  if (required && !result) throw invalid(`${name}: заполните поле.`);
  return result;
}

function integer(value, {name, min, max, optional = false}) {
  if (optional && (value === null || value === undefined || value === '')) return null;
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < min || number > max) throw invalid(`${name}: число от ${min} до ${max}.`);
  return number;
}

// Owner enters roubles; storage keeps kopecks so totals never use floats.
export function priceMinor(value, name = 'Цена') {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'string' ? Number(value.replace(',', '.').replace(/\s+/gu, '')) : value;
  if (!Number.isFinite(number) || number < 0 || number > 10_000_000) throw invalid(`${name}: укажите сумму в рублях.`);
  return Math.round(number * 100);
}

export function isDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addDays(date, days) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

// ISO weekday: Monday = 1 … Sunday = 7.
export function weekday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function localToday(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function options(value, name) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 12) throw invalid(`${name}: до 12 вариантов.`);
  return value.map(item => ({
    label: text(item?.label, 80, {name, required:true}),
    priceMinor: priceMinor(item?.price ?? item?.priceMinor ?? null, `${name}: цена`),
  }));
}

function mediaList(value, max) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max || value.some(id => !MEDIA_ID.test(id))) throw invalid('Фотографии: выберите загруженные изображения.');
  return [...new Set(value)];
}

const HEX_COLOR = /^#[0-9A-F]{6}$/u;
const WALLPAPER = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/u;
function hexColor(value, name) {
  if (value === null || value === undefined || value === '') return null;
  const color = text(value, 7, {name}).toUpperCase();
  if (!HEX_COLOR.test(color)) throw invalid(`${name}: формат #RRGGBB.`);
  return color;
}
function stepped(value, {name, min, max, fallback}) {
  const result = integer(value ?? fallback, {name, min, max});
  if (result % 5) throw invalid(`${name}: шаг 5%.`);
  return result;
}
export const defaultCardLight = () => ({style:'off', color:null, intensity:30});
export function normalizeCardLight(value) {
  if (value === undefined || value === null) return defaultCardLight();
  if (typeof value !== 'object' || Array.isArray(value)) throw invalid('Подсветка карточек не распознана.');
  const style = value.style ?? 'off';
  if (!Object.hasOwn(CARD_LIGHTS, style)) throw invalid('Выберите стиль подсветки карточек.');
  return {style, color:hexColor(value.color, 'Цвет подсветки'), intensity:stepped(value.intensity, {name:'Интенсивность подсветки', min:0, max:100, fallback:30})};
}
function normalizeWallpaper(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || typeof value.data !== 'string') throw invalid('Фоновое изображение не распознано.');
  if (value.data.length > WALLPAPER_LIMIT || !WALLPAPER.test(value.data)) throw invalid('Фон: выберите изображение PNG, JPEG или WebP ещё раз.');
  return {data:value.data, shade:stepped(value.shade, {name:'Затемнение фона', min:20, max:90, fallback:65})};
}

export function defaultStorefront(name = '') {
  return {name, tagline:'', description:'', format:'custom', theme:'cream', accentColor:DEFAULT_ACCENT, logoMediaId:null, coverMediaIds:[],
    backgroundColor:null, cardLight:defaultCardLight(), backgroundMediaId:null, backgroundShade:65,
    contacts:{phone:'', telegram:'', whatsapp:'', vk:'', email:'', instagram:'', address:'', hours:''},
    orderNote:'', privacyUrl:'', published:false, acceptingOrders:true};
}

export function normalizeStorefront(body) {
  if (!body || typeof body !== 'object') throw invalid('Заполните оформление витрины.');
  const accent = text(body.accentColor || DEFAULT_ACCENT, 7, {name:'Акцентный цвет'});
  if (!/^#[0-9a-f]{6}$/iu.test(accent)) throw invalid('Акцентный цвет: формат #RRGGBB.');
  if (!Object.hasOwn(FORMATS, body.format || 'custom')) throw invalid('Выберите формат кондитерской.');
  if (!Object.hasOwn(STOREFRONT_THEMES, body.theme || 'cream')) throw invalid('Выберите оформление витрины.');
  const contacts = body.contacts && typeof body.contacts === 'object' ? body.contacts : {};
  const privacyUrl = text(body.privacyUrl, 300, {name:'Ссылка на политику'});
  if (privacyUrl && !/^https:\/\/[^\s<>"']+$/u.test(privacyUrl)) throw invalid('Ссылка на политику должна начинаться с https://');
  const logo = body.logoMediaId ? mediaList([body.logoMediaId], 1)[0] : null;
  const wallpaper = body.backgroundMediaId ? mediaList([body.backgroundMediaId], 1)[0] : null;
  return {
    name: text(body.name, 80, {name:'Название', required:true}),
    tagline: text(body.tagline, 140, {name:'Короткое описание'}),
    description: text(body.description, 1500, {name:'Описание', multiline:true}),
    format: body.format || 'custom', theme: body.theme || 'cream', accentColor: accent.toUpperCase(), logoMediaId: logo,
    coverMediaIds: mediaList(body.coverMediaIds, 6),
    backgroundColor: hexColor(body.backgroundColor, 'Цвет фона витрины'), cardLight: normalizeCardLight(body.cardLight),
    backgroundMediaId: wallpaper, backgroundShade: stepped(body.backgroundShade, {name:'Затемнение фона', min:20, max:90, fallback:65}),
    contacts: {
      phone: text(contacts.phone, 40, {name:'Телефон'}), telegram: text(contacts.telegram, 64, {name:'Telegram'}),
      whatsapp: text(contacts.whatsapp, 40, {name:'WhatsApp'}), vk: text(contacts.vk, 120, {name:'ВКонтакте'}),
      email: text(contacts.email, 120, {name:'Почта'}), instagram: text(contacts.instagram, 64, {name:'Instagram'}),
      address: text(contacts.address, 200, {name:'Адрес'}), hours: text(contacts.hours, 120, {name:'Часы работы'}),
    },
    orderNote: text(body.orderNote, 600, {name:'Условия заказа', multiline:true}),
    privacyUrl, published: body.published === true, acceptingOrders: body.acceptingOrders !== false,
  };
}

export function defaultCabinetPreferences() {
  return {theme:'confectionery', accent:null, background:null, cardLight:defaultCardLight(), wallpaper:null,
    order:[...CABINET_SECTIONS], hidden:[], pinned:[], compact:false, shortcuts:{...DEFAULT_SHORTCUTS}};
}

export function normalizeCabinetPreferences(body) {
  if (!body || typeof body !== 'object') throw invalid('Настройки кабинета не распознаны.');
  const defaults = defaultCabinetPreferences();
  const theme = body.theme ?? defaults.theme;
  if (!Object.hasOwn(CABINET_THEMES, theme)) throw invalid('Выберите тему кабинета.');
  const accent = body.accent === null || body.accent === undefined || body.accent === '' ? null : text(body.accent, 7, {name:'Акцент'}).toUpperCase();
  if (accent && !/^#[0-9A-F]{6}$/u.test(accent)) throw invalid('Акцент: формат #RRGGBB.');
  const sections = list => Array.isArray(list) ? [...new Set(list.filter(id => CABINET_SECTIONS.includes(id)))] : [];
  const order = [...new Set([...sections(body.order), ...CABINET_SECTIONS])];
  const hidden = sections(body.hidden), pinned = sections(body.pinned);
  // «Покупатели» appears only with customer accounts, so one of the core sections must stay.
  if (CABINET_SECTIONS.filter(id => id !== 'customers').every(id => hidden.includes(id))) throw invalid('Оставьте в меню хотя бы один раздел.');
  const shortcuts = {...defaults.shortcuts}, used = new Map();
  for (const action of CABINET_ACTIONS) {
    const value = body.shortcuts && Object.hasOwn(body.shortcuts, action) ? body.shortcuts[action] : defaults.shortcuts[action];
    if (value === '' || value === null) { shortcuts[action] = ''; continue; }
    if (typeof value !== 'string' || !SHORTCUT.test(value) || !/(?:Ctrl|Alt|Meta)\+/u.test(value)) throw invalid('Сочетание клавиш должно включать Ctrl, Alt или ⌘ и одну клавишу.');
    if (used.has(value)) throw invalid(`Сочетание ${value} уже занято другим действием.`);
    used.set(value, action); shortcuts[action] = value;
  }
  return {theme, accent, background:hexColor(body.background, 'Фон'), cardLight:normalizeCardLight(body.cardLight), wallpaper:normalizeWallpaper(body.wallpaper),
    order, hidden, pinned, compact:body.compact === true, shortcuts};
}

export function hasContact(storefront) {
  return Object.entries(storefront.contacts || {}).some(([key, value]) => !['address','hours'].includes(key) && value);
}

export function defaultCalendar() {
  return {configured:false, workingDays:[2,3,4,5,6,7], dailyCapacity:3, weekdayCapacity:null, leadDays:2, horizonDays:60, timeZone:'Europe/Moscow',
    pickup:{enabled:false, windows:[], perWindow:null}};
}

// Optional own limit per weekday, e.g. 3 on Saturday and 5 on weekdays.
function weekdayCapacity(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw invalid('Лимиты по дням недели не распознаны.');
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 1 || day > 7) throw invalid('Лимиты по дням недели: дни с понедельника по воскресенье.');
    result[day] = integer(raw, {name:`Лимит на ${WEEKDAY_NAMES[day - 1]}`, min:0, max:200});
  }
  return Object.keys(result).length ? result : null;
}

export const pickupLabel = window => `${window.from}–${window.to}`;
// Optional pickup windows so customers do not all come at once.
export function normalizePickup(value) {
  if (!value || value.enabled !== true) return {enabled:false, windows:[], perWindow:null};
  if (!Array.isArray(value.windows) || !value.windows.length || value.windows.length > 12) throw invalid('Время получения: от 1 до 12 интервалов.');
  const windows = value.windows.map(window => {
    const from = text(window?.from, 5, {name:'Начало интервала', required:true}), to = text(window?.to, 5, {name:'Конец интервала', required:true});
    if (!TIME.test(from) || !TIME.test(to) || from >= to) throw invalid('Интервал получения: формат 10:00–12:00, начало раньше конца.');
    return {from, to};
  }).sort((left, right) => left.from.localeCompare(right.from));
  if (windows.some((window, index) => index && window.from < windows[index - 1].to)) throw invalid('Интервалы получения не должны пересекаться.');
  return {enabled:true, windows, perWindow:integer(value.perWindow, {name:'Заказов на один интервал', min:1, max:50, optional:true})};
}

export function normalizeCalendar(body) {
  if (!body || typeof body !== 'object') throw invalid('Заполните настройки календаря.');
  const days = Array.isArray(body.workingDays) ? [...new Set(body.workingDays)].sort() : [];
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) throw invalid('Рабочие дни: выберите дни недели.');
  const timeZone = body.timeZone || 'Europe/Moscow';
  if (!TIME_ZONES.includes(timeZone)) throw invalid('Выберите часовой пояс кондитерской.');
  return {
    configured: true, workingDays: days,
    dailyCapacity: integer(body.dailyCapacity, {name:'Заказов в день', min:1, max:200}),
    weekdayCapacity: weekdayCapacity(body.weekdayCapacity),
    leadDays: integer(body.leadDays, {name:'Заказ минимум за, дней', min:0, max:90}),
    horizonDays: integer(body.horizonDays ?? 60, {name:'Принимать заказы вперёд, дней', min:7, max:180}),
    timeZone, pickup: normalizePickup(body.pickup),
  };
}

// A closed period: vacation or days off, at most four months at once.
export function normalizeDateRange(body) {
  if (!isDate(body?.from) || !isDate(body?.to) || body.from > body.to) throw invalid('Укажите период: дата начала не позже даты окончания.');
  if (addDays(body.from, 120) < body.to) throw invalid('Период — не больше 120 дней за раз.');
  if (!['closed','default'].includes(body.kind)) throw invalid('Выберите: закрыть даты или вернуть общие правила.');
  return {from:body.from, to:body.to, kind:body.kind, note:text(body.note, 200, {name:'Заметка'})};
}

// Storefront ordering options the owner switches on in the settings.
export function defaultOrdering() {
  return {cart:false, accounts:false};
}
export function normalizeOrdering(body) {
  if (!body || typeof body !== 'object') throw invalid('Настройки заказов не распознаны.');
  return {cart:body.cart === true, accounts:body.accounts === true};
}

// Discounts for registered customers: «after 5 orders — 5% on the next one»,
// «from 30 orders — 10% forever». Amounts are stored in kopecks.
export function defaultLoyalty() {
  return {tiers:[], reservedPerDay:0};
}
export const tierKey = tier => `${tier.basis}:${tier.threshold}`;
export function normalizeLoyalty(body) {
  if (!body || typeof body !== 'object') throw invalid('Настройки скидок не распознаны.');
  const tiers = body.tiers ?? [];
  if (!Array.isArray(tiers) || tiers.length > 8) throw invalid('Скидки: не больше 8 условий.');
  const normalized = tiers.map(tier => {
    if (!Object.hasOwn(LOYALTY_BASES, tier?.basis)) throw invalid('Скидка: выберите — по числу заказов или по сумме.');
    if (!Object.hasOwn(LOYALTY_SCOPES, tier.scope)) throw invalid('Скидка: на следующий заказ или на все заказы.');
    const threshold = tier.basis === 'orders'
      ? integer(tier.threshold, {name:'Скидка: число заказов', min:1, max:1000})
      : priceMinor(tier.threshold, 'Скидка: сумма заказов');
    if (!threshold) throw invalid('Скидка: укажите, после какой суммы она действует.');
    const percent = integer(tier.percent, {name:'Скидка, %', min:0, max:50}), priority = tier.priority === true;
    if (!percent && !priority) throw invalid('Условие скидки: укажите процент или отметьте приоритет в очереди.');
    return {basis:tier.basis, threshold, percent, scope:tier.scope, priority};
  }).sort((left, right) => left.basis.localeCompare(right.basis) || left.threshold - right.threshold);
  if (new Set(normalized.map(tierKey)).size !== normalized.length) throw invalid('Два условия скидки с одинаковым порогом. Объедините их.');
  return {tiers:normalized, reservedPerDay:integer(body.reservedPerDay ?? 0, {name:'Мест в день для постоянных', min:0, max:50})};
}

export function tierLabel(tier) {
  const amount = tier.basis === 'orders' ? `${tier.threshold} ${tier.threshold % 10 === 1 && tier.threshold % 100 !== 11 ? 'заказа' : 'заказов'}` : `${(tier.threshold / 100).toLocaleString('ru-RU')} ₽`;
  return `${tier.percent ? `${tier.percent}% ${LOYALTY_SCOPES[tier.scope]}` : 'приоритет в очереди'} — после ${amount}`;
}

// What a customer has earned now: the best discount, whether they skip the
// regular limit, and how far the next reward is. Pure: counts come from the store.
export function customerStanding({tiers = [], completedOrders = 0, spentMinor = 0, usedKeys = new Set(), manualPriority = false}) {
  const progress = tier => tier.basis === 'orders' ? completedOrders : spentMinor;
  const reached = tiers.filter(tier => progress(tier) >= tier.threshold);
  const available = reached.filter(tier => tier.percent > 0 && (tier.scope === 'always' || !usedKeys.has(tierKey(tier))));
  const best = available.sort((left, right) => right.percent - left.percent || (left.scope === 'always' ? -1 : 1))[0] || null;
  const upcoming = tiers.filter(tier => !reached.includes(tier) && tier.percent > 0)
    .map(tier => ({basis:tier.basis, remaining:tier.threshold - progress(tier), percent:tier.percent, scope:tier.scope}))
    .sort((left, right) => (left.basis === right.basis ? left.remaining - right.remaining : left.basis === 'orders' ? -1 : 1))[0] || null;
  return {
    percent:best?.percent || 0, scope:best?.scope || null, label:best ? `${best.percent}% ${LOYALTY_SCOPES[best.scope]}` : '',
    // Using a «next order» reward closes every one-time reward reached so far.
    consumes:best?.scope === 'next' ? reached.filter(tier => tier.scope === 'next').map(tierKey) : [],
    priority:manualPriority || reached.some(tier => tier.priority), regular:reached.length > 0 || manualPriority,
    completedOrders, spentMinor, upcoming,
  };
}

export function normalizeEmail(value) {
  const email = text(value, 120, {name:'Почта', required:true}).toLowerCase();
  if (!EMAIL.test(email)) throw invalid('Проверьте адрес почты.');
  return email;
}

export function normalizeCustomerProfile(body) {
  if (!body || typeof body !== 'object') throw invalid('Заполните профиль.');
  return {name:text(body.name, 80, {name:'Имя', required:true}), ...contact(body)};
}

// Owner-side fields: orders made before Nexus, a manual priority and a note.
export function normalizeCustomerOwnerFields(body) {
  if (!body || typeof body !== 'object') throw invalid('Данные покупателя не распознаны.');
  return {priorOrders:integer(body.priorOrders ?? 0, {name:'Заказов до Nexus', min:0, max:10000}),
    priorAmountMinor:priceMinor(body.priorAmount ?? 0, 'Сумма заказов до Nexus') || 0,
    priority:body.priority === true, ownerNote:text(body.ownerNote, 600, {name:'Заметка', multiline:true})};
}

export function normalizeOverride(body) {
  const kind = body?.kind;
  if (!['closed','full','open','limit','default'].includes(kind)) throw invalid('Выберите состояние даты.');
  const capacity = ['open','limit'].includes(kind) ? integer(body.capacity, {name:'Лимит на дату', min:0, max:200, optional:kind === 'open'}) : null;
  return {kind, capacity, note: text(body.note, 200, {name:'Заметка'})};
}

export function normalizeItem(body) {
  if (!body || typeof body !== 'object') throw invalid('Заполните карточку изделия.');
  if (body.status !== undefined && !['active','hidden'].includes(body.status)) throw invalid('Состояние изделия: в каталоге или скрыто.');
  const minQuantity = integer(body.minQuantity ?? 1, {name:'Минимальное количество', min:1, max:500});
  const maxQuantity = integer(body.maxQuantity ?? 50, {name:'Максимальное количество', min:1, max:1000});
  if (maxQuantity < minQuantity) throw invalid('Максимальное количество меньше минимального.');
  return {
    status: body.status || 'active',
    title: text(body.title, 90, {name:'Название изделия', required:true}),
    summary: text(body.summary, 160, {name:'Кратко'}),
    description: text(body.description, 2000, {name:'Подробности', multiline:true}),
    composition: text(body.composition, 1000, {name:'Состав и начинка', multiline:true}),
    priceMinor: priceMinor(body.price ?? body.priceMinor ?? null),
    priceFrom: body.priceFrom === true,
    unit: text(body.unit || 'шт.', 16, {name:'Единица', required:true}),
    leadDays: integer(body.leadDays, {name:'Срок изготовления, дней', min:0, max:90, optional:true}),
    capacityUnits: integer(body.capacityUnits ?? 1, {name:'Производственных слотов', min:1, max:20}),
    notes: text(body.notes, 600, {name:'Примечания', multiline:true}),
    sizes: options(body.sizes, 'Размеры'),
    decorations: options(body.decorations, 'Оформление'),
    fillings: options(body.fillings, 'Начинки'),
    mediaIds: mediaList(body.mediaIds, 8),
    minQuantity, maxQuantity,
    sortOrder: integer(body.sortOrder ?? 0, {name:'Порядок', min:-10000, max:10000}),
  };
}

// New catalog order from the storefront preview: unique item ids, at most the catalog size.
export function normalizeItemOrder(body) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 200) throw invalid('Передайте новый порядок изделий.');
  if (ids.some(id => typeof id !== 'string' || !/^[a-f0-9-]{36}$/iu.test(id))) throw invalid('Изделие не найдено. Обновите страницу.');
  if (new Set(ids).size !== ids.length) throw invalid('Изделие указано дважды.');
  return ids;
}

function contact(body) {
  const method = body?.contactMethod;
  if (!Object.hasOwn(CONTACT_METHODS, method)) throw invalid('Выберите, как с вами связаться.');
  const value = text(body.contactValue, 120, {name:'Контакт', required:true});
  if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) throw invalid('Проверьте адрес почты.');
  if (['phone','whatsapp'].includes(method) && !/^\+?[\d\s()-]{6,24}$/u.test(value)) throw invalid('Проверьте номер телефона.');
  return {contactMethod:method, contactValue:value};
}

function orderLine(body) {
  return {
    itemId: text(body?.itemId, 36, {name:'Изделие', required:true}),
    quantity: integer(body?.quantity ?? 1, {name:'Количество', min:1, max:1000}),
    size: text(body?.size, 80, {name:'Размер'}), decoration: text(body?.decoration, 80, {name:'Оформление'}),
    filling: text(body?.filling, 80, {name:'Начинка'}),
  };
}

// One item from the item card, or up to ten lines from the cart.
export function normalizeOrderRequest(body) {
  if (!body || typeof body !== 'object') throw invalid('Заполните заявку.');
  if (!/^[a-f0-9-]{36}$/iu.test(body.requestId || '')) throw invalid('Обновите страницу и отправьте заявку снова.');
  if (!isDate(body.date)) throw invalid('Выберите дату в календаре.');
  if (body.consent !== true) throw invalid('Подтвердите согласие на передачу контактов кондитерской.');
  const lines = body.lines === undefined ? [body] : body.lines;
  if (!Array.isArray(lines) || !lines.length || lines.length > 10) throw invalid('В одной заявке — от 1 до 10 изделий.');
  return {
    requestId: body.requestId.toLowerCase(), date: body.date, lines: lines.map(orderLine),
    pickupWindow: text(body.pickupWindow, 11, {name:'Время получения'}),
    wishes: text(body.wishes, 1500, {name:'Пожелания', multiline:true}),
    customerName: text(body.customerName, 80, {name:'Имя', required:true}), ...contact(body),
  };
}

export function normalizeWaitlistRequest(body) {
  if (!body || typeof body !== 'object') throw invalid('Заполните форму листа ожидания.');
  if (!/^[a-f0-9-]{36}$/iu.test(body.requestId || '')) throw invalid('Обновите страницу и повторите.');
  if (!isDate(body.date)) throw invalid('Выберите дату.');
  if (body.consent !== true) throw invalid('Подтвердите согласие на передачу контактов кондитерской.');
  // A cart on a full date: every item counts toward the slots it needs.
  if (body.itemIds !== undefined && (!Array.isArray(body.itemIds) || body.itemIds.length > 10)) throw invalid('В листе ожидания — до 10 изделий.');
  return {
    requestId: body.requestId.toLowerCase(), date: body.date, itemId: text(body.itemId, 36, {name:'Изделие'}) || null,
    itemIds: (body.itemIds || []).map(id => text(id, 36, {name:'Изделие', required:true})),
    customerName: text(body.customerName, 80, {name:'Имя', required:true}), ...contact(body),
    note: text(body.note, 600, {name:'Комментарий', multiline:true}),
  };
}

// Limit of one date: the date's own limit, else the weekday's, else the general one.
export function dayCapacity(calendar, date, override = null) {
  if (['open','limit'].includes(override?.kind) && override.capacity !== null && override.capacity !== undefined) return override.capacity;
  const own = calendar.weekdayCapacity?.[weekday(date)];
  return Number.isInteger(own) ? own : calendar.dailyCapacity;
}

// Public status of one date. Counts never leave the owner's cabinet: the
// storefront only learns available / few / full / unavailable. `reserved`
// slots are kept for regular customers and are hidden from everyone else.
export function dateStatus({date, today, calendar, override = null, usedUnits = 0, units = 1, leadDays = 0, reserved = 0}) {
  const lead = Math.max(calendar.leadDays || 0, leadDays || 0);
  if (!calendar.configured) return {status:'unavailable', reason:'not_configured'};
  if (date < addDays(today, lead)) return {status:'unavailable', reason:'lead_time'};
  if (date > addDays(today, calendar.horizonDays)) return {status:'unavailable', reason:'horizon'};
  if (override?.kind === 'closed') return {status:'unavailable', reason:'closed'};
  if (override?.kind === 'full') return {status:'full', reason:'booked'};
  const open = calendar.workingDays.includes(weekday(date)) || ['open','limit'].includes(override?.kind);
  if (!open) return {status:'unavailable', reason:'day_off'};
  const base = dayCapacity(calendar, date, override);
  // A weekday limit of 0 means the day is off; a date's own limit of 0 means it is booked up.
  if (!base && !['open','limit'].includes(override?.kind)) return {status:'unavailable', reason:'day_off'};
  const capacity = Math.max(0, base - reserved);
  const remaining = capacity - usedUnits;
  if (remaining < units) return {status:'full', reason:'capacity'};
  return {status: remaining - units < Math.max(1, Math.ceil(capacity / 4)) ? 'few' : 'available', reason:null};
}

export function monthDates(month) {
  if (!/^\d{4}-\d{2}$/u.test(month || '') || !isDate(`${month}-01`)) throw invalid('Месяц: формат ГГГГ-ММ.');
  const dates = [];
  for (let date = `${month}-01`; date.startsWith(month); date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function estimate(item, order) {
  const size = item.sizes.find(option => option.label === order.size);
  const extras = [item.decorations.find(option => option.label === order.decoration), item.fillings.find(option => option.label === order.filling)];
  const base = size?.priceMinor ?? item.priceMinor;
  if (base === null || base === undefined) return {estimateMinor:null, estimateFrom:false};
  const extra = extras.reduce((sum, option) => sum + (option?.priceMinor || 0), 0);
  return {estimateMinor:(base + extra) * order.quantity, estimateFrom:item.priceFrom || Boolean(size === undefined && item.sizes.length)};
}
