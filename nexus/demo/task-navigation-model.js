const freeze = value => { Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); }); return Object.freeze(value); };
export const TASK_SECTIONS = freeze([
  { id: 'today', title: 'Сегодня', icon: 'i-overview', routes: ['today', 'events', 'alerts'], legacy: ['events', 'alerts'] },
  { id: 'portfolio', title: 'Портфель', icon: 'i-account', routes: ['portfolio', 'capital', 'reviews', 'operations', 'margin'], legacy: ['overview', 'operations'] },
  { id: 'research', title: 'Исследование', icon: 'i-search', routes: ['research', 'company'], legacy: ['analytics', 'ai'] },
  { id: 'trading', title: 'Моя торговля', icon: 'i-risk', routes: ['trading', 'journal', 'calculator'], legacy: ['risk-plan'] },
  { id: 'terminal', title: 'Терминал', icon: 'i-chart', routes: ['terminal'], legacy: ['terminal', 'instruments'] },
]);
export const TASK_ROUTES = freeze({
  today: { section: 'today', view: 'overview', label: 'Обзор дня', context: 'Ближайшие даты и продолжение исследования', legacy: 'overview' },
  events: { section: 'today', view: 'events', label: 'События и новости', context: 'Даты, публикации и ваши напоминания', legacy: 'events' },
  alerts: { section: 'today', view: 'alerts', label: 'Оповещения', context: 'Ваши уровни и история сигналов', legacy: 'alerts' },
  portfolio: { section: 'portfolio', view: 'overview', label: 'Результат и позиции', context: 'Стоимость, результат и текущие позиции', legacy: 'overview' },
  capital: { section: 'portfolio', view: 'analytics', mode: 'capital', label: 'Доходность и риск', context: 'Методы расчёта, структура и исходные данные', legacy: 'analytics' },
  reviews: { section: 'portfolio', view: 'analytics', mode: 'reviews', label: 'Сравнение обзоров', context: 'Что изменилось между двумя сохранениями', legacy: 'analytics' },
  operations: { section: 'portfolio', view: 'operations', label: 'Операции', context: 'История и происхождение данных', legacy: 'operations' },
  margin: { section: 'portfolio', view: 'risk-plan', riskTab: 'health', label: 'Обеспечение счёта', context: 'Сохранённые сведения о марже и их возраст', legacy: 'risk-plan' },
  research: { section: 'research', view: 'analytics', mode: 'instrument', label: 'Инструмент и сохранения', context: 'Цена, факты и сохранённые исследования', legacy: 'analytics' },
  company: { section: 'research', view: 'ai', label: 'Компания', context: 'Показатели компании и источники', legacy: 'ai' },
  trading: { section: 'trading', view: 'analytics', mode: 'trading', label: 'Результаты сделок', context: 'Допустимые эпизоды, выборки и исходные исполнения', legacy: 'analytics' },
  journal: { section: 'trading', view: 'risk-plan', riskTab: 'journal', label: 'Журнал и планы', context: 'Идеи, принятые изменения и лента записей', legacy: 'risk-plan' },
  calculator: { section: 'trading', view: 'risk-plan', riskTab: 'calculator', label: 'Расчёт сделки', context: 'Ручной расчёт размера позиции', legacy: 'risk-plan' },
  terminal: { section: 'terminal', view: 'terminal', label: 'Рабочее пространство', context: 'График и контекстные панели', legacy: 'terminal' },
});
const ids = TASK_SECTIONS.map(section => section.id), own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idList = value => Array.isArray(value) && value.length <= ids.length && value.every(id => ids.includes(id)) && new Set(value).size === value.length;
const legacyList = value => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string'))].slice(0, 64) : [];
export function migrateTaskNavigation(presentation = {}) {
  const order = legacyList(presentation.order), pinned = new Set(legacyList(presentation.pinned)), hidden = new Set(legacyList(presentation.hidden));
  const rank = section => Math.min(...section.legacy.map(id => { const index = order.indexOf(id); return index < 0 ? 100 : index; }));
  const sections = [...TASK_SECTIONS];
  if (order.length) sections.sort((a, b) => rank(a) - rank(b));
  return { schemaVersion: 1, mode: 'tasks', order: sections.map(section => section.id),
    pinned: sections.filter(section => section.legacy.some(id => pinned.has(id))).map(section => section.id),
    hidden: sections.filter(section => section.routes.every(id => hidden.has(TASK_ROUTES[id].legacy))).map(section => section.id), lastRoute: null };
}
export function validateTaskNavigation(value) {
  if (!object(value) || Object.keys(value).some(key => !['schemaVersion', 'mode', 'order', 'hidden', 'pinned', 'lastRoute'].includes(key))
    || value.schemaVersion !== 1 || !['tasks', 'classic'].includes(value.mode)
    || !idList(value.order) || value.order.length !== ids.length || !idList(value.hidden) || !idList(value.pinned)
    || !(value.lastRoute === null || typeof value.lastRoute === 'string' && own(TASK_ROUTES, value.lastRoute))) throw new Error('TASK_NAVIGATION_INVALID');
  return { schemaVersion: 1, mode: value.mode, order: [...value.order], pinned: [...value.pinned], hidden: [...value.hidden], lastRoute: value.lastRoute };
}
export function readTaskNavigation(presentation = {}) {
  if (!object(presentation)) return { state: { ...migrateTaskNavigation(), mode: 'classic' }, status: 'invalid' };
  if (!own(presentation, 'taskNavigation')) return { state: migrateTaskNavigation(presentation), status: 'migrated' };
  try { return { state: validateTaskNavigation(presentation.taskNavigation), status: 'saved' }; }
  catch { return { state: { ...migrateTaskNavigation(presentation), mode: 'classic' }, status: 'invalid' }; }
}
export function orderedTaskSections(state) {
  const valid = validateTaskNavigation(state), pins = new Set(valid.pinned);
  return valid.order.map(id => TASK_SECTIONS.find(section => section.id === id)).sort((a, b) => Number(pins.has(b.id)) - Number(pins.has(a.id)));
}
export function resolveTaskRoute(id) { return typeof id === 'string' && own(TASK_ROUTES, id) ? TASK_ROUTES[id] : null; }
export function inferTaskRoute({ view, analyticsView = 'instrument', riskTab = 'journal' } = {}) {
  if (view === 'instruments' || view === 'terminal') return 'terminal';
  if (view === 'analytics') return analyticsView === 'reviews' ? 'reviews' : analyticsView === 'capital' ? 'capital' : ['portfolio', 'trading'].includes(analyticsView) ? 'trading' : 'research';
  if (view === 'risk-plan') return riskTab === 'health' ? 'margin' : riskTab === 'calculator' ? 'calculator' : 'journal';
  return ({ overview: 'portfolio', operations: 'operations', events: 'events', alerts: 'alerts', ai: 'company' })[view] || null;
}
