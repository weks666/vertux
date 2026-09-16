import { sortRows, connectTableSort } from './table-sort.js';
import { money, decimalNanos, positionQuantity, convertNanos } from './number-format.js';
import { instrumentMark, watchInstrumentImages } from './instrument-mark.js';
import { ui, setLanguage, startTranslation } from './ui-language.js';
import { createWorkspaceNavigation } from './account-module/v1.2.0/workspace-navigation.js';
import { initWorkspacePreferences } from './personal-workspace.js';
import { FEATURE_TERMS, searchProduct } from './product-features.js';
import { initMarketCalendar } from './market-calendar.js';
import { createEquityChart, createMarketChart, createAnalyticsReturnChart, normalizeEquityPoints, normalizeMarketCandles, setChartPresentation } from './charts.js';
import { runtimeAdapter } from './demo-runtime.js';
import { initPriceAlerts } from './price-alerts.js';
import { calculateRiskDraft } from './risk-calculator.js';
import { initTradingPlan } from './trading-plan-ui.js';

const state = {
  bootstrap: null,
  sorts: {},
  displayCurrency: 'RUB',
  language: 'ru',
  currentView: 'overview',
  equityChart: null,
  marketChart: null,
  analyticsReturnChart: null,
  session: null,
  stream: null,
  streamRetryAttempts: 0,
  streamRetryTimer: null,
  equityRange: '1m',
  connection: null,
  connectionPhase: 'loading',
  captureDialogMode: 'connect',
  captureAttempt: null,
  statisticsRange: 'month',
  glossaryCategory: 'all',
  glossaryFilter: '',
  operationPage: 0,
  operationRows: [],
  instrumentLabels: new Map(),
  portfolioLabels: new Map(),
  selectedPeriod: { period: 'month' },
  periodRequest: 0,
  periodLoading: false,
  listPages: new Map(),
  analyticsAccount: '',
  analyticsChartMode: 'percent',
  marketOverview: null,
  marketOverviewPending: false,
  tradingPlanUi: null,
  companyAvailability: null,
  companyRequest: 0,
  companyViews: new Map(),
  companyPending: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatMoney(value, currency = 'RUB', { native = false } = {}) {
  return money(value,currency,{locale:state.language,target:native?currency:state.displayCurrency,rates:state.bootstrap?.displayFx?.rates});
}
function formatQuantity(value) { return decimalNanos(value,{digits:9,locale:state.language}); }
function quoteMoney(value,currency) { return formatMoney(value,currency,{native:true}); }
function positionShare(row,data=state.bootstrap) {
  // Contract notionals cannot be presented as capital allocations.
  if(row.assetType==='future' || row.positionValueNanos==null)return null;
  const total=data?.portfolio?.currentTotalNanos??data?.portfolio?.totalNanos;
  const value=convertNanos(row.positionValueNanos,row.positionValueCurrency||row.priceCurrency,'RUB',data?.displayFx?.rates);
  return value!=null&&total!=null&&BigInt(total)>0n?Number(BigInt(value)*1000000n/BigInt(total))/1000000:null;
}
const positionReaders={name:r=>instrumentDisplay(r).ticker||instrumentDisplay(r).name,type:r=>r.assetType+':'+r.direction,openedAt:r=>r.openedAt?Date.parse(r.openedAt):null,quantityNanos:r=>r.quantityNanos==null?null:BigInt(r.quantityNanos)<0n?-BigInt(r.quantityNanos):BigInt(r.quantityNanos),share:r=>positionShare(r)};

function formatPercentage(value, { signed = false } = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const number = Number(value) * 100;
  const sign = signed && number > 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat(state.language||'ru',{minimumFractionDigits:2,maximumFractionDigits:2}).format(number)}%`;
}

function formatLeverage(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `×${Number(value).toFixed(2).replace('.', ',')}`;
}

function evidenceLabel(kind, data = state.bootstrap) {
  const labels = data?.clientProduct?.evidenceLegend || {};
  return labels[kind] || ({ direct: 'Прямое поле', derived: 'Расчёт', estimated: 'Оценка', unsupported: 'Нет источника', fixture: 'Учебные данные' })[kind] || 'Не подтверждено';
}

function formatMoneyAndRate(amountNanos, rate, currency = 'RUB') {
  const amount = formatMoney(amountNanos, currency);
  const percent = formatPercentage(rate, { signed: true });
  return `<strong>${escapeText(amount)}</strong><small>${escapeText(percent)}</small>`;
}

function formatDate(value, withSeconds = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat(state.language==='en'?'en-GB':'ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: withSeconds ? '2-digit' : undefined }).format(date)} ${state.language==='en'?'MSK':'мск'}`;
}

function formatAge(milliseconds) {
  if (milliseconds === null || milliseconds === undefined || !Number.isFinite(Number(milliseconds))) return 'время неизвестно';
  const seconds = Math.max(0, Math.floor(Number(milliseconds) / 1000));
  if (seconds < 1) return 'только что';
  if (seconds < 60) return `${seconds} сек. назад`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
  return `${Math.floor(seconds / 86400)} дн. назад`;
}

function formatHoldingTime(hours) {
  if (hours === null || hours === undefined || hours === '') return 'Срок не определён';
  const value = Number(hours);
  if (!Number.isFinite(value) || value < 0) return 'Срок не определён';
  if (value < 24) return `${Math.max(1, Math.round(value))} ч. удержания`;
  if (value < 168) return `${Math.round(value / 24)} дн. удержания`;
  if (value < 730) return `${(value / 168).toFixed(1).replace('.', ',')} нед. удержания`;
  return `${(value / 730).toFixed(1).replace('.', ',')} мес. удержания`;
}

function pagedRows(key, rows, size = 8, renderPage = null) {
  if (!state.listPages) state.listPages = new Map();
  const previous = state.listPages.get(key) || {};
  const page = Math.max(0, Math.min(previous.page || 0, Math.ceil(rows.length / size) - 1));
  state.listPages.set(key, { page, rows, size, renderPage });
  const start = page * size;
  const count = $('#' + key + 'Count');
  if (count) count.textContent = rows.length ? `${start + 1}–${Math.min(start + size, rows.length)} из ${rows.length.toLocaleString('ru-RU')}` : 'Нет записей';
  const previousButton = $('#' + key + 'Previous');
  const nextButton = $('#' + key + 'Next');
  if (previousButton) previousButton.disabled = page === 0;
  if (nextButton) nextButton.disabled = start + size >= rows.length;
  const navigation = $('#' + key + 'Pagination');
  if (navigation) navigation.hidden = rows.length <= size;
  return rows.slice(start, start + size);
}

function changeListPage(key, direction) {
  const list = state.listPages?.get(key);
  if (!list) return;
  list.page += direction;
  list.renderPage?.();
}

function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 4400);
}

async function request(path, options = {}) {
  if (!runtimeAdapter) throw new Error('Static fixture runtime is unavailable.');
  return runtimeAdapter.request(path, options);
}

const connectionErrorCopy = {
  NATIVE_CREDENTIAL_CAPTURE_FAILED: 'Подключение не завершено из-за ошибки системного окна. Повторите попытку; если ошибка повторится, обратитесь в поддержку.',
  NATIVE_CREDENTIAL_CAPTURE_TOKEN_MALFORMED: 'Ключ введён не полностью или содержит пробелы. Скопируйте API-токен целиком и повторите ввод в окне Windows.',
  NATIVE_CREDENTIAL_CAPTURE_TOKEN_REJECTED: 'Т‑Банк не принял ключ. Проверьте срок действия токена и выбранный контур; при необходимости создайте новый токен только для чтения.',
  NATIVE_CREDENTIAL_CAPTURE_ACCESS_DENIED: 'Т‑Банк запретил доступ к счетам. Проверьте разрешения токена и доступ к выбранному контуру.',
  NATIVE_CREDENTIAL_CAPTURE_RATE_LIMITED: 'Т‑Банк временно ограничил число запросов. Подождите немного и повторите подключение.',
  NATIVE_CREDENTIAL_CAPTURE_BROKER_UNAVAILABLE: 'Сервис Т‑Банка временно недоступен. Повторите подключение позже.',
  NATIVE_CREDENTIAL_CAPTURE_NETWORK_TIMEOUT: 'Т‑Банк не ответил вовремя. Проверьте интернет-соединение и повторите подключение.',
  NATIVE_CREDENTIAL_CAPTURE_TLS_CONFIGURATION: 'Не удалось загрузить сертификаты Т‑Банка. Установите доступное обновление Invest и повторите подключение.',
  NATIVE_CREDENTIAL_CAPTURE_TLS_REJECTED: 'Не удалось проверить защищённое соединение с Т‑Банком. Проверьте дату и время Windows; если они верны, передайте эту ошибку в поддержку.',
  NATIVE_CREDENTIAL_CAPTURE_DNS_FAILED: 'Не удалось найти сервер Т‑Банка. Проверьте подключение к сети и повторите попытку.',
  NATIVE_CREDENTIAL_CAPTURE_NETWORK_ERROR: 'Не удалось связаться с Т‑Банком. Проверьте интернет-соединение и повторите подключение.',
  NATIVE_CREDENTIAL_CAPTURE_RESPONSE_INVALID: 'Т‑Банк вернул неожиданный ответ со счетами. Повторите попытку; если ошибка повторится, обратитесь в поддержку.',
  NATIVE_CREDENTIAL_CAPTURE_NO_OPEN_ACCOUNTS: 'Этот токен не даёт доступа к открытым счетам. Проверьте счёт и выбранный контур Т‑Банка.',
  NATIVE_CREDENTIAL_CAPTURE_READ_ONLY_REQUIRED: 'Нужен API-токен «Только для чтения». Ключ с правом торговли не подходит: создайте токен только для чтения всех нужных счетов.',
  NATIVE_CREDENTIAL_CAPTURE_STORAGE_FAILED: 'Windows не удалось сохранить подключение на этом компьютере. Проверьте свободное место и доступ к папке приложения, затем повторите ввод.',
  NATIVE_CREDENTIAL_CAPTURE_UNEXPECTED: 'Подключение не завершено из-за ошибки системного окна. Повторите попытку; если ошибка повторится, обратитесь в поддержку.',

  ACCOUNT_SCOPE_REQUIRED: 'Для этой операции выберите один из счетов с подтверждённым доступом только для чтения.',
  ACCOUNT_NOT_OPEN: 'T‑Invest не подтвердил ни одного открытого брокерского счёта.',
  READ_ONLY_TOKEN_REQUIRED: 'Все открытые счета токена должны иметь доступ «только чтение».',
  NATIVE_CREDENTIAL_CAPTURE_REQUIRED: 'Ввод доступен только в отдельном защищённом окне Windows. Откройте его заново из Workspace.',
  NATIVE_CREDENTIAL_CAPTURE_UI_TIMEOUT: 'Windows не показала окно ввода. Нажмите «Открыть системное окно» ещё раз.',
  NATIVE_CREDENTIAL_CAPTURE_TIMEOUT: 'Время ввода истекло. Откройте окно Windows заново и повторите подключение.',
  NATIVE_CREDENTIAL_CAPTURE_UNAVAILABLE: 'Не удалось запустить окно Windows. Закройте и заново откройте Investor из Nexus.',
  NATIVE_CREDENTIAL_CAPTURE_IN_PROGRESS: 'Окно ввода уже открыто. Завершите или отмените ввод в нём.',
  NATIVE_CREDENTIAL_CAPTURE_COOLDOWN: 'Подождите несколько секунд перед повторным открытием окна.',
  CAPTURE_IN_PROGRESS: 'Системное окно Windows уже открыто. Завершите или отмените ввод в нём.',
  CAPTURE_COOLDOWN: 'Новая попытка временно недоступна. Подождите немного и откройте системное окно снова.',
  CAPTURE_CANCELLED: 'Ввод отменён в системном окне Windows. Данные подключения не изменены.',
  NATIVE_CREDENTIAL_CAPTURE_CANCELLED: 'Ввод отменён в системном окне Windows. Данные подключения не изменены.',
  SIGNED_RELEASE_REQUIRED: 'Подключение недоступно: установите подтверждённую версию приложения из Nexus.',
  RELEASE_INTEGRITY_MISMATCH: 'Локальный пакет изменён после установки. Переустановите пилотную версию из приватного источника.',
  RELEASE_VERSION_MISMATCH: 'Версия Local Node не совпадает с версией продукта в Nexus.',
  RELEASE_PATH_MISMATCH: 'Local Node запущен не из разрешённой папки установки.',
  RELEASE_ARTIFACT_UNAVAILABLE: 'Локальный пакет не найден. Переустановите пилотную версию.',
  OWNER_REQUIRED: 'Подключать и отключать T‑Invest может только владелец организации.',
  CAPABILITY_DENIED: 'Нет права на настройку подключения. Обратитесь к владельцу организации.',
  PRODUCT_SESSION_REQUIRED: 'Сессия продукта не подтверждена Nexus. Откройте Workspace из Nexus заново.',
};

function connectionErrorMessage(error) {
  return Object.hasOwn(connectionErrorCopy, error?.code || '') ? connectionErrorCopy[error.code] : 'Нативное подключение не завершено. Проверьте системное окно Windows и повторите попытку.';
}

function maskedConnectionStatus(value) {
  const source = value?.connection && typeof value.connection === 'object' ? value.connection : value;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { connected: false };
  const environment = ['live', 'sandbox'].includes(source.environment) ? source.environment : null;
  const rawAccounts = Array.isArray(source.accounts) && source.accounts.length
    ? source.accounts
    : source.account && typeof source.account === 'object' && !Array.isArray(source.account)
      ? [source.account]
      : [];
  const accounts = rawAccounts.slice(0, 64).map((accountSource) => ({
    name: typeof accountSource?.name === 'string' ? accountSource.name.slice(0, 120) : '',
    idMasked: typeof accountSource?.idMasked === 'string' && /[•*]/u.test(accountSource.idMasked)
      ? accountSource.idMasked.slice(0, 80)
      : '',
    type: typeof accountSource?.type === 'string' ? accountSource.type.slice(0, 80) : '',
    status: typeof accountSource?.status === 'string' ? accountSource.status.slice(0, 80) : '',
    accessLevel: accountSource?.accessLevel === 'ACCOUNT_ACCESS_LEVEL_READ_ONLY'
      ? 'ACCOUNT_ACCESS_LEVEL_READ_ONLY'
      : '',
  }));
  const connected = source.connected === true;
  return {
    connected,
    ...(source.provider === 't-invest' ? { provider: 't-invest' } : {}),
    ...(environment ? { environment } : {}),
    account: connected ? accounts[0] || {} : {},
    accounts: connected ? accounts : [],
    accountCount: connected ? accounts.length : 0,
    validatedAt: typeof source.validatedAt === 'string' ? source.validatedAt.slice(0, 64) : null,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt.slice(0, 64) : null,
    cleanupPending: source.cleanupPending === true,
  };
}

function safeInitials(value) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  return words.length ? words.slice(0, 2).map((word) => [...word][0]).join('').toLocaleUpperCase('ru') : '—';
}

function localEnvironment(data = state.bootstrap) {
  return data && data.environment !== 'fixture' && !data.preview?.static;
}

function resetCredentialCaptureDialog({ reset = false } = {}) {
  const form = $('#credentialCaptureForm');
  if (reset && form) form.reset();
  if ($('#captureError')) $('#captureError').textContent = '';
  if ($('#captureProgress')) $('#captureProgress').textContent = '';
}

function openCredentialCaptureDialog(mode = 'connect') {
  if (!localEnvironment()) {
    showToast(state.bootstrap?.preview?.static ? 'Веб-просмотр не открывает системное окно Windows.' : 'Учебный режим не открывает системное окно Windows.', true);
    return;
  }
  state.captureDialogMode = mode;
  $('#captureSubmitButton').disabled = false;
  resetCredentialCaptureDialog({ reset: true });
  $('#credentialCaptureTitle').textContent = mode === 'replace' ? 'Заменить подключение через Windows?' : 'Открыть защищённый ввод Windows?';
  $('#captureSubmitButton').textContent = mode === 'replace' ? 'Открыть окно замены' : 'Открыть системное окно';
  if (state.connection?.environment) $('#captureEnvironment').value = state.connection.environment;
  $('#credentialCaptureDialog').showModal();
  requestAnimationFrame(() => $('#captureEnvironment').focus());
}

function closeCredentialCaptureDialog() {
  const attempt = state.captureAttempt;
  if (attempt && !attempt.completed) {
    state.captureAttempt = null;
    attempt.controller.abort();
    if (state.bootstrap) renderConnection(state.bootstrap);
  }
  resetCredentialCaptureDialog({ reset: true });
  $('#credentialCaptureDialog').close();
}

async function checkConnection() {
  const button = $('#connectionCheckButton');
  button.disabled = true;
  renderConnection(state.bootstrap, { phase: 'rechecking' });
  try {
    const result = await request('/api/connection/check', { method: 'POST', body: '{}' });
    const connection = { ...(state.connection || {}), connected: true, validatedAt: result.checkedAt || state.connection?.validatedAt };
    state.bootstrap = { ...state.bootstrap, connection };
    renderConnection(state.bootstrap);
    showToast('T‑Invest подтвердил подключение только для чтения.');
  } catch (error) {
    renderConnection(state.bootstrap, { phase: 'error', errorMessage: connectionErrorMessage(error) });
    showToast(connectionErrorMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

async function disconnectConnection() {
  const button = $('#disconnectConfirmButton');
  button.disabled = true;
  $('#disconnectError').textContent = '';
  try {
    const connection = maskedConnectionStatus(await request('/api/connection', { method: 'DELETE', body: '{}' }));
    state.bootstrap = { ...state.bootstrap, connection, syncRuns: state.bootstrap?.syncRuns || [] };
    state.connection = connection;
    $('#disconnectDialog').close();
    renderConnection(state.bootstrap);
    $('#syncButton').disabled = true;
    showToast(connection.cleanupPending ? 'Подключение отключено; удаление старой secret-ссылки будет повторено локально.' : 'Подключение отключено, локальная secret-ссылка удалена.');
  } catch (error) {
    $('#disconnectError').textContent = connectionErrorMessage(error);
  } finally {
    button.disabled = false;
  }
}

const viewMeta = {
  settings: ['Настройки', 'Приложение и этот Workspace'],
  profile: ['Профиль', 'Общий аккаунт Vertux Nexus'],
  events: ['События и новости', 'Даты, публикации и ваши напоминания'],
  alerts: ['Ценовые алерты', 'Ваши уровни и история сигналов'],
  overview: ['Обзор портфеля', 'Портфель и качество данных'],
  operations: ['Сделки и операции', 'История и происхождение данных'],
  analytics: ['Аналитика', 'Воспроизводимые расчёты'],
  'risk-plan': ['Риск и торговый план', 'Оценка риска и план действий'],
  instruments: ['Инструменты и график', 'Котировки и история цен'],
  ai: ['Фундаментальный анализ', 'Показатели компании и источники'],
  sync: ['Синхронизация', 'Качество данных и история проверок'],
  system: ['Системный раздел', 'Vertux Service Center'],
  glossary: ['Словарь терминов', 'Инвестиционный справочник и формулы'],
};

function activateView(view, trigger = null, { focusMain = true } = {}) {
  state.currentView = view;
  document.body.dataset.currentView=view;
  $('.quality-strip').hidden=view!=='sync';
  $$('.view').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  $$('.nav-item').forEach((button) => {
    const active = button === trigger || (button.dataset.view === view && !trigger);
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const [title, context] = viewMeta[view] || viewMeta.overview;
  $('#viewTitle').textContent = title;
  $('#viewContext').textContent = context;
  document.body.classList.remove('rail-open');
  $('[data-open-rail]').setAttribute('aria-expanded', 'false');
  if (view === 'instruments') requestAnimationFrame(renderMarketChart);
  if (view === 'overview') requestAnimationFrame(renderEquityChart);
  if (view === 'analytics') { requestAnimationFrame(renderAnalyticsChartOnView); void refreshMarketVision(); }
  if (view === 'glossary') requestAnimationFrame(renderGlossary);
  if (view === 'events') void state.marketCalendarUi?.ensureNews();
  if (['settings','profile'].includes(view)) void mountAccountCenter(view);
  if (focusMain) $('#mainContent').focus({ preventScroll: true });
}

let accountCenter = null;
const workspaceNavigation=createWorkspaceNavigation({key:'vertux-invest',title:'Invest Workspace',actions:[
  {id:'overview',label:'Обзор портфеля',shortcut:'Ctrl+1'},
  {id:'operations',label:'Сделки и операции',shortcut:'Ctrl+2'},
  {id:'analytics',label:'Аналитика',shortcut:'Ctrl+3'},
  {id:'instruments',label:'Инструменты и график',shortcut:'Ctrl+4'},
  {id:'glossary',label:'Словарь терминов',shortcut:'Ctrl+5'},
  {id:'settings',label:'Настройки',shortcut:'Ctrl+,'},
],navigate:activateView});
async function mountAccountCenter(section) {
  const host = $(section === 'profile' ? '#accountProfileHost' : '#accountSettingsHost');
  if (!host) return;
  if (runtimeAdapter || state.bootstrap?.preview?.localReview === true) {
    host.innerHTML = '<div class="empty-state"><h3>Общий аккаунт Nexus</h3><p>Профиль и настройки аккаунта доступны после входа в Nexus.</p></div>';
    return;
  }
  try {
    await import('./account-module/v1.2.0/vertux-account-center.js');
    if (state.currentView !== section) return;
    if (!accountCenter) {
      accountCenter = document.createElement('vertux-account-center');
      accountCenter.workspaceNavigation=workspaceNavigation;
      $('#personalSettings').hidden = false;
      accountCenter.addEventListener('vertux-account-changed', event => {
        if (event.detail?.name) $('#identityName').textContent = event.detail.name;
      });
    }
    accountCenter.setAttribute('section',section);
    if (accountCenter.parentElement !== host) host.replaceChildren(accountCenter);
    else await accountCenter.refresh();
  } catch { host.innerHTML = '<div class="empty-state"><h3>Не удалось открыть аккаунт</h3><p>Перезапустите Workspace и повторите.</p></div>'; }
}
function applyInvestTheme(value, { persist = !runtimeAdapter } = {}) {
  const theme = value === 'graphite' ? 'graphite' : 'invest';
  document.documentElement.dataset.workspaceTheme = theme;
  const selector = $('#workspaceTheme');if (selector) selector.value=theme;
  if (persist) { try { localStorage.setItem('vertux-invest:appearance',theme); } catch { /* Device preference is optional. */ } }
}
try { applyInvestTheme(runtimeAdapter ? 'invest' : localStorage.getItem('vertux-invest:appearance'), { persist: false }); } catch { applyInvestTheme('invest', { persist: false }); }

async function requestNexusShellAction(action) {
  if (!['products', 'profile', 'settings'].includes(action)) return false;
  const nexusProduct = globalThis.nexusProduct;
  if (typeof nexusProduct?.close === 'function') {
    const result = await nexusProduct.close(action);
    if (result !== false && result?.closed !== false && result?.ok !== false) return true;
  }
  const target = new URL('/launch?choose=1', 'https://nexus.vertux.online');
  if (action !== 'products') target.hash = action;
  location.assign(target.href);
  return true;
}

async function openProductSwitcher() {
  try {
    await requestNexusShellAction('products');
  } catch {
    showToast('Не удалось открыть Nexus. Попробуйте ещё раз.');
  }
}

async function openProfileSettings() { activateView('profile'); }

function mountServiceCenter(section) {
  const host = $('#serviceCenterHost');
  if (!host) return;
  if (!globalThis.customElements?.get('vertux-service-center')) {
    host.innerHTML = '<div class="empty-state"><h3>Service Center не загрузился</h3><p>Перезапустите Workspace. Если ошибка повторится, обновите Nexus.</p></div>';
    return;
  }
  if (!globalThis.nexusProduct) {
    globalThis.nexusProduct = { service: {
      overview: async () => ({ ok: false, error: { message: 'Учебный режим запущен вне Nexus: данные подписки, поддержки и доступа недоступны.' } }),
    } };
  }
  let component = $('vertux-service-center', host);
  if (!component) {
    host.replaceChildren();
    component = document.createElement('vertux-service-center');
    component.setAttribute('hide-header', '');
    host.append(component);
  }
  component.setAttribute('section', section);
}

function renderRuntimeTruth(data) {
  const staticPreview = data.environment === 'fixture' && data.preview?.static;
  const fixture = data.environment === 'fixture';
  const nodeStatus = $('#nodeStatus');
  const runtime = data.runtime || {};
  const identity = data.identity || data.session?.identity || {};
  if (staticPreview) {
    nodeStatus.dataset.state = 'preview';
    $('#nodeState').textContent = 'Демо-среда';
    $('#nodeVersion').textContent = 'Предпросмотр без подключения';
    $('#identityName').textContent = 'Демо-профиль';
    $('#identityRole').textContent = 'Профиль';
    $('#identityInitials').textContent = 'FX';
    $('#identityStatus').setAttribute('aria-label', 'Открыть демо-профиль');
    return;
  }
  if (fixture) {
    nodeStatus.dataset.state = 'fixture';
    $('#nodeState').textContent = 'Демо-среда';
    $('#nodeVersion').textContent = `Версия ${runtime.version || 'локальная'}`;
    $('#identityName').textContent = 'Демо-профиль';
    $('#identityRole').textContent = 'Профиль';
    $('#identityInitials').textContent = 'FX';
    $('#identityStatus').setAttribute('aria-label', 'Открыть демо-профиль');
    return;
  }
  nodeStatus.dataset.state = 'ready';
  $('#nodeState').textContent = 'Рабочая среда готова';
  $('#nodeVersion').textContent = `Версия ${runtime.version || data.version || 'не указана'}`;
  const displayName = identity.displayName || identity.name || 'Invest Workspace';
  const roleMap = { owner: 'Владелец', admin: 'Администратор', manager: 'Менеджер', viewer: 'Наблюдатель' };
  const role = identity.roleLabel || roleMap[identity.role] || 'Профиль';
  $('#identityName').textContent = displayName;
  $('#identityRole').textContent = 'Профиль';
  $('#identityInitials').textContent = safeInitials(displayName);
  $('#identityStatus').setAttribute('aria-label', `Открыть профиль: ${displayName}, ${role}`);
}

function setConnectionSteps(phase) {
  const steps = $$('[data-connection-step]');
  steps.forEach((step) => step.classList.remove('complete', 'active', 'error'));
  const complete = (...names) => names.forEach((name) => $(`[data-connection-step="${name}"]`)?.classList.add('complete'));
  if (phase === 'checking') {
    $('[data-connection-step="scope"]')?.classList.add('active');
  } else if (phase === 'rechecking') {
    complete('scope', 'secret');
    $('[data-connection-step="verified"]')?.classList.add('active');
  } else if (phase === 'verified') {
    complete('scope', 'secret', 'verified');
  } else if (phase === 'syncing') {
    complete('scope', 'secret', 'verified');
    $('[data-connection-step="sync"]')?.classList.add('active');
  } else if (phase === 'ready') {
    complete('scope', 'secret', 'verified', 'sync');
  } else if (phase === 'sync-error') {
    complete('scope', 'secret', 'verified');
    $('[data-connection-step="sync"]')?.classList.add('error');
  } else if (phase === 'error') {
    $('[data-connection-step="scope"]')?.classList.add('error');
  }
}

function renderConnection(data, { phase = null, errorMessage = '' } = {}) {
  const staticPreview = data.environment === 'fixture' && data.preview?.static;
  const fixture = data.environment === 'fixture';
  const connection = maskedConnectionStatus(data.connection);
  const hasSuccessfulSync = (data.syncRuns || []).some((run) => run.status === 'completed');
  const currentPhase = phase || (staticPreview ? 'preview' : fixture ? 'fixture' : connection.connected ? (hasSuccessfulSync ? 'ready' : 'verified') : 'disconnected');
  state.connection = connection;
  state.connectionPhase = currentPhase;

  const surface = $('#connectionSurface');
  surface.dataset.state = currentPhase;
  setConnectionSteps(currentPhase);
  const summary = $('#connectionSummary');
  const badge = $('#connectionBadge');
  const messages = {
    preview: ['GitHub Pages — учебный веб-просмотр без локального подключения и входа в Nexus.', 'Просмотр · без входа'],
    fixture: ['Учебный режим не открывает системный ввод Windows и не обращается к T‑Invest.', 'Учебный режим · ввод закрыт'],
    disconnected: ['Откройте защищённый ввод в отдельном окне Windows. Кабинет не увидит введённый токен.', 'Не подключено'],
    checking: ['Ожидаем отдельное системное окно Windows. Проверка доступа и шифрование выполняются на этом устройстве.', 'Ожидаем Windows'],
    rechecking: ['Повторно проверяем сохранённое подключение только для чтения у T‑Invest. Токен остаётся в защищённом хранилище Windows.', 'Проверяем соединение'],
    verified: ['Доступ только для чтения подтверждён. Следующий шаг — первая синхронизация.', 'Доступ подтверждён'],
    syncing: ['Соединение подтверждено. Сохраняем портфель, позиции и операции на этом устройстве.', 'Первая синхронизация'],
    ready: ['Подключение и первая синхронизация подтверждены. Повторные запуски доступны в верхней панели.', 'Готово'],
    'sync-error': ['Подключение только для чтения сохранено, но первая синхронизация не завершилась. Повторите запуск.', 'Ошибка синхронизации'],
    error: [errorMessage || 'Подключение не подтверждено. Исправьте причину и повторите попытку.', 'Нужна проверка'],
    'runtime-error': [errorMessage || 'Local Node не ответил. Откройте Workspace из Nexus заново.', 'Local Node недоступен'],
  };
  [summary.textContent, badge.textContent] = messages[currentPhase] || messages.disconnected;

  const account = connection.account || {};
  const accounts = connection.accounts || [];
  const accountSummary = accounts.length > 1
    ? `${accounts.length} счёта · ${accounts.map((item) => [item.name, item.idMasked].filter(Boolean).join(' ')).join('; ')}`
    : [account.name, account.idMasked].filter(Boolean).join(' · ');
  $('#connectionEnvironment').textContent = staticPreview ? 'Учебный веб-просмотр' : fixture ? 'Учебный режим · без сети' : connection.environment === 'sandbox' ? 'Тестовый контур T‑Invest · только чтение' : connection.environment === 'live' ? 'T‑Invest основной · только чтение' : 'Не выбрана';
  $('#connectionAccount').textContent = connection.connected ? accountSummary : 'Не подключён';
  $('#connectionAccess').textContent = connection.connected && accounts.length > 0 && accounts.every((item) => item.accessLevel === 'ACCOUNT_ACCESS_LEVEL_READ_ONLY') ? 'Все счета · только чтение' : 'Нужен доступ только для чтения';
  $('#connectionVerifiedAt').textContent = connection.validatedAt ? formatDate(connection.validatedAt, true) : '—';

  const local = !fixture && !staticPreview && currentPhase !== 'runtime-error';
  const connected = local && connection.connected;
  const busy = ['checking', 'rechecking', 'syncing'].includes(currentPhase);
  const primary = $('#connectionPrimaryButton');
  primary.hidden = connected;
  primary.disabled = !local || busy;
  primary.textContent = staticPreview ? 'Недоступно в веб-просмотре' : fixture ? 'Недоступно в учебном режиме' : 'Подключить через Windows';
  $('#connectionCheckButton').hidden = !connected;
  $('#connectionCheckButton').disabled = busy;
  $('#firstSyncButton').hidden = !connected || hasSuccessfulSync;
  $('#firstSyncButton').disabled = busy;
  $('#replaceConnectionButton').hidden = !connected;
  $('#replaceConnectionButton').disabled = busy;
  $('#disconnectButton').hidden = !connected;
  $('#disconnectButton').disabled = busy;
  $('#connectionPreviewNote').hidden = !staticPreview;

  const connectButton = $('#connectButton');
  connectButton.disabled = !local || busy;
  connectButton.textContent = connected ? 'Заменить через Windows' : staticPreview ? 'Подключение недоступно в веб-просмотре' : fixture ? 'Подключение недоступно в учебном режиме' : 'Подключить через Windows';
  if (local && !connected) $('#syncButton').disabled = true;
}

function renderQuality(data) {
  const quality = data.quality || {};
  const issue=quality.error||quality.stale;
  $('#dataStateStatus').hidden=!issue||data.environment==='fixture';
  $('#dataStateStatus').textContent=quality.error?'Не удалось обновить данные · Синхронизация':quality.stale?'Данные устарели · Синхронизация':'';
  $('#qualitySource').textContent = quality.source || 'Учебный источник';
  $('#qualityConnector').textContent = quality.connector || '';
  $('#qualityConnector').hidden = !quality.connector || /только чтение|read.only/iu.test(quality.connector);
  $('#qualityAccount').textContent = quality.accountName || 'Не выбран';
  const portfolioCount = data.clientProduct?.portfolios?.length || 0;
  $('#qualityScope').textContent = portfolioCount > 1
    ? `${portfolioCount} счёта · маржа по каждому счёту`
    : 'Маржа рассчитывается по счёту';
  $('#qualityEvent').textContent = formatDate(quality.lastEventAt, true);
  $('#qualityAge').textContent = formatAge(quality.dataAgeMs);
  $('#qualityAge').className = quality.stale ? 'stale' : quality.lastEventAt ? 'ready' : '';
  $('#qualityReconcile').textContent = quality.reconciliation === 'matched' ? 'Сопоставлено' : quality.reconciliation === 'warning' ? 'Есть расхождения' : 'Не выполнена';
  $('#qualityCoverage').textContent = quality.coverage || 'Отчёт брокера не загружен';
  $('#qualityState').textContent = quality.stateLabel || 'Готово';
  $('#qualityState').className = quality.stale ? 'stale' : quality.error ? 'error' : 'ready';
  $('#qualityNote').textContent = quality.note || 'локальное хранилище';
}

function coverageSummary(coverage, fallback = 'Недостаточно данных за период.') {
  return ({ empty: 'Нет оценки стоимости за период.', partial_history: 'Нет оценки на начало периода.',
    insufficient_history: 'Нужны оценки в разные даты.', invalid_starting_value: 'Начальная стоимость не положительна.',
    unsupported_transfers: 'Нет оценки перенесённых бумаг.', missing_fx: 'Не сохранён курс денежных потоков.',
    incomplete_operations: 'История операций неполная.', unaligned_accounts: 'Выберите отдельный счёт.' })[coverage?.state] || fallback;
}

function renderEvidenceNote(element, summary, detail = '') {
  element.textContent = summary;
  if (detail && detail !== summary) element.innerHTML = `${escapeText(summary)} <button class="term-help" type="button" data-evidence-note="${escapeText(detail)}" aria-label="Подробнее: ${escapeText(summary)}" aria-expanded="false">?</button>`;
}

function renderPortfolio(data) {
  const portfolio = data.portfolio || {};
  const selected = data.selectedPeriod;
  const coverage = data.dataCoverage || {};
  $('#portfolioValue').textContent = formatMoney(portfolio.totalNanos, portfolio.currency);
  $('#portfolioValueLabel').textContent = selected ? 'Стоимость на конец периода' : 'Стоимость портфеля';
  const valuationDetails = [`Оценка стоимости: ${formatDate(portfolio.asOf)}.`,
    portfolio.startTotalNanos != null ? `Первая оценка в периоде: ${formatMoney(portfolio.startTotalNanos, portfolio.currency)} · ${formatDate(portfolio.startAsOf)}.` : 'Начальная оценка не сохранена.',
    portfolio.currentTotalNanos != null ? `Последняя стоимость: ${formatMoney(portfolio.currentTotalNanos, portfolio.currency)} · ${formatDate(portfolio.currentAsOf)}.` : '', coverage.reason || ''].filter(Boolean).join(' ');
  $('#portfolioValueHelp').setAttribute('data-evidence-note', valuationDetails);
  $('#netPnl').textContent = formatMoney(portfolio.netPnlNanos, portfolio.currency);
  renderEvidenceNote($('#netPnlMeta'), portfolio.pnlReason ? coverageSummary(coverage) : 'После комиссий', portfolio.pnlReason);
  $('#netPnl').className = BigInt(portfolio.netPnlNanos || '0') < 0n ? 'negative' : 'positive';
  $('#realizedPnl').textContent = formatMoney(portfolio.realizedNanos, portfolio.currency);
  $('#unrealizedPnl').textContent = formatMoney(portfolio.unrealizedNanos, portfolio.currency);
  renderEvidenceNote($('#markFreshness'), portfolio.unrealizedNanos != null
    ? `По текущим позициям · ${formatDate(portfolio.currentAsOf || portfolio.asOf)}`
    : 'Нет оценки открытых позиций.', portfolio.unrealizedReason || '');
  $('#feesValue').textContent = formatMoney(portfolio.feesNanos, portfolio.currency);
  $('#drawdownValue').textContent = formatPercentage(portfolio.maxDrawdownRate);
  renderEvidenceNote($('#drawdownPeriod'), portfolio.maxDrawdownRate === null || portfolio.maxDrawdownRate === undefined
    ? coverageSummary(coverage, 'Нужны оценки в разные даты.')
    : portfolio.riskCoverage?.state === 'partial' ? 'По активным интервалам.' : 'По оценкам стоимости за период.', portfolio.maxDrawdownRate == null ? coverage.reason : portfolio.riskCoverage?.reason || portfolio.drawdownPeriod);
  $('#equityVersion').textContent = data.calculationVersion || 'Версия расчёта не указана';

  const portfolioRows = data.clientProduct?.portfolios || [];
  $('#portfolioCards').innerHTML = portfolioRows.length ? portfolioRows.map((row) => `
    <div class="portfolio-row">
      <span><strong>${escapeText(row.label)}</strong><small>${escapeText(formatDate(row.asOf))}</small></span>
      <span class="numeric"><strong>${escapeText(formatMoney(row.valueNanos, row.currency || 'RUB'))}</strong><small>${escapeText(formatPercentage(row.shareOfTotalRate))} от общей суммы</small></span>
      <div class="allocation-track" aria-label="${escapeText(formatPercentage(row.shareOfTotalRate))} от общей суммы"><i style="--allocation:${Math.max(0, Math.min(100, Number(row.shareOfTotalRate || 0) * 100))}%"></i></div>
    </div>`).join('') : '<p class="empty-copy">Нет сохранённых портфелей. Запустите синхронизацию.</p>';

  const rows = sortRows(data.clientProduct?.openPositions || [],state.sorts.positions,positionReaders);
  $('#positionsBody').innerHTML = rows.length ? rows.map((row) => {
    const display=instrumentDisplay(row),currency=row.pnlCurrency||row.currency||'RUB';
    const resultClass=value=>value==null?'':BigInt(value)<0n?'negative':'positive';
    const share=positionShare(row,data);
    return `<tr>
      <td><span class="instrument-with-mark">${instrumentMark(row,display)}<span class="instrument-cell"><strong>${escapeText(display.ticker||display.name)}</strong><small title="${escapeText(display.name)}">${escapeText(display.name!==display.ticker?display.name:'')}</small></span></span></td>
      <td><span class="asset-type">${ui(row.assetType==='future'?'Фьючерс':'Акция')}</span><small class="position-direction">${row.direction==='short'?'Short':'Long'}</small></td>
      <td title="${escapeText(row.openedAtNote||'')}">${escapeText(row.openedAt?formatDate(row.openedAt):ui('Нужна история'))}</td>
      <td class="numeric">${escapeText(positionQuantity(row,{locale:state.language}))}</td>
      <td class="numeric" title="${escapeText(row.entryPriceNote||'')}">${escapeText(quoteMoney(row.averagePriceNanos,row.priceCurrency))}</td>
      <td class="numeric" title="${escapeText(row.positionValue?.note||'')}">${escapeText(formatMoney(row.positionValueNanos,row.positionValueCurrency||row.currency||row.priceCurrency))}</td>
      <td class="numeric">${share==null?'—':escapeText(formatPercentage(share))}</td>
      <td class="numeric ${resultClass(row.dayPnlNanos)}">${escapeText(formatMoney(row.dayPnlNanos,currency))}</td>
      <td class="numeric ${resultClass(row.totalPnlNanos)}"><strong>${escapeText(formatMoney(row.totalPnlNanos,currency))}</strong>${row.totalReturnRate==null?'':`<small class="return-rate">${escapeText(formatPercentage(row.totalReturnRate,{signed:true}))}${row.assetType==='future'?' '+ui('цены'):''}</small>`}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="9" class="empty-cell">Нет сохранённых открытых позиций. Запустите синхронизацию.</td></tr>';
  watchInstrumentImages($('#positionsBody'));

}

const OPERATIONS_PAGE_SIZE = 100;

function usableInstrumentText(value, uid) {
  const text = String(value || '').trim();
  if (!text || (uid && (text === uid || text === uid.slice(0, 12)))) return '';
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(text)) return '';
  return text;
}

function prepareDisplayLabels(data) {
  state.portfolioLabels = new Map((data.clientProduct?.portfolios || []).map((item) => [item.id, item.label]));
  state.instrumentLabels = new Map();
  for (const row of [...(data.instruments || []), ...(data.positions || []), ...(data.clientProduct?.openPositions || []), ...(data.clientProduct?.closedPositions || [])]) {
    if (!row.instrumentUid) continue;
    const key = row.instrumentUid;
    const previous = state.instrumentLabels.get(key) || {};
    state.instrumentLabels.set(key, {
      name: usableInstrumentText(row.name, key) || previous.name || '',
      ticker: usableInstrumentText(row.ticker, key) || previous.ticker || '',
    });
  }
}

function instrumentDisplay(row) {
  const uid = String(row.instrumentUid || '');
  const metadata = state.instrumentLabels.get(uid) || {};
  const ticker = usableInstrumentText(row.ticker, uid) || metadata.ticker || '';
  const name = usableInstrumentText(row.name, uid) || metadata.name || ticker
    || (uid ? 'Название недоступно' : 'Событие счёта');
  return { name, ticker, instrumentUid:uid, logoName:row.logoName || metadata.logoName };
}

function portfolioDisplay(row) {
  return state.portfolioLabels.get(row.portfolioId) || row.portfolioLabel || 'Текущий портфель';
}

function renderOperations(data, { page = 0 } = {}) {
  const rows = sortRows(Array.isArray(data.operations)?data.operations:[],state.sorts.operations,{name:r=>instrumentDisplay(r).ticker||instrumentDisplay(r).name,occurredAt:r=>r.occurredAt?Date.parse(r.occurredAt):null,type:r=>r.label||r.type,state:r=>r.stateLabel||r.state});
  state.operationRows = rows;
  state.operationPage = Math.max(0, Math.min(Math.trunc(page) || 0, Math.ceil(rows.length / OPERATIONS_PAGE_SIZE) - 1));
  const start = state.operationPage * OPERATIONS_PAGE_SIZE;
  const pageRows = rows.slice(start, start + OPERATIONS_PAGE_SIZE);
  $('#operationsBody').innerHTML = pageRows.length ? pageRows.map((row) => {
    const display = instrumentDisplay(row);
    const detail = [display.ticker && display.name !== display.ticker ? display.name : '', portfolioDisplay(row)].filter(Boolean).join(' · ');
    return `<tr><td>${escapeText(formatDate(row.occurredAt, true))}</td><td><span class="instrument-with-mark">${row.instrumentUid?instrumentMark(display):''}<span class="instrument-cell"><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText(detail)}</small></span></span></td><td>${escapeText(row.label || row.type)}</td><td class="numeric">${escapeText(formatQuantity(row.quantityNanos))}</td><td class="numeric">${escapeText(formatMoney(row.paymentNanos, row.currency))}</td><td class="numeric">${escapeText(formatMoney(row.commissionNanos, row.currency))}</td><td><span class="status-chip fresh">${escapeText(row.stateLabel || 'Исполнено')}</span></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty-cell">Нет нормализованных операций для выбранного периода.</td></tr>';
  watchInstrumentImages($('#operationsBody'));
  $('#operationsCount').textContent = rows.length
    ? `Операции ${(start + 1).toLocaleString('ru-RU')}–${Math.min(start + OPERATIONS_PAGE_SIZE, rows.length).toLocaleString('ru-RU')} из ${rows.length.toLocaleString('ru-RU')}`
    : 'Операций не найдено';
  $('#operationsPrevious').disabled = state.operationPage === 0;
  $('#operationsNext').disabled = start + OPERATIONS_PAGE_SIZE >= rows.length;
}

function changeOperationPage(direction) {
  renderOperations({ operations: state.operationRows }, { page: state.operationPage + direction });
}

function renderClosedPositions(data) {
  const rows = sortRows(data.clientProduct?.closedPositions||[],state.sorts.closed,{...positionReaders,closedAt:r=>r.closedAt?Date.parse(r.closedAt):null});
  const showCost = rows.some(row => row.positionCostNanos != null);
  $('#closedPositionCostHeader').hidden = !showCost;
  const pageRows = pagedRows('closedPositions', rows, 20, () => renderClosedPositions(data));
  $('#closedPositionsBody').innerHTML = pageRows.length ? pageRows.map((row) => {
    const pnl = row.pnlNanos == null ? null : BigInt(row.pnlNanos);
    const priceCurrency = row.assetType === 'future' ? 'PTS' : row.currency || 'RUB';
    const display = instrumentDisplay(row);
    return `<tr>
      <td><span class="instrument-with-mark">${instrumentMark(display)}<span class="instrument-cell"><strong>${escapeText(display.ticker||display.name)}</strong><small>${escapeText([display.name!==display.ticker?display.name:'',portfolioDisplay(row)].filter(Boolean).join(' · '))}</small></span></span></td>
      <td><span class="asset-chip">${row.assetType === 'future' ? 'Фьючерс' : 'Акция'}</span><small class="cell-note">${row.direction === 'short' ? 'Шорт' : 'Лонг'}</small></td>
      <td class="numeric"><strong>${escapeText(quoteMoney(row.entryPriceNanos, priceCurrency))}</strong><small class="cell-note">→ ${escapeText(quoteMoney(row.exitPriceNanos, priceCurrency))}</small></td>
      <td><strong>${escapeText(row.openedAt ? formatDate(row.openedAt, true) : '—')}</strong><small class="cell-note">→ ${escapeText(row.closedAt ? formatDate(row.closedAt, true) : '—')}</small></td>
      <td class="numeric">${escapeText(positionQuantity(row,{locale:state.language}))}</td>
${showCost ? `<td class="numeric">${row.positionCostNanos == null ? '<span aria-label="Стоимость для этой позиции недоступна">—</span>' : escapeText(formatMoney(row.positionCostNanos, row.currency || 'RUB'))}</td>` : ''}
      <td class="numeric ${pnl == null ? '' : pnl < 0n ? 'negative' : 'positive'}">${row.assetType === 'future' && pnl == null
        ? `<strong class="${row.returnRate == null ? '' : Number(row.returnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))} цены</strong><small class="cell-note">Вариационная маржа — отдельно <button class="term-help" type="button" data-evidence-note="${escapeText(row.pnlReason || 'Вариационная маржа показана отдельно за период.')}" aria-label="Сведения о результате фьючерса" aria-expanded="false">?</button></small>`
        : formatMoneyAndRate(row.pnlNanos, row.returnRate, row.currency || 'RUB')}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="${showCost ? 7 : 6}" class="empty-cell">За выбранный период нет восстановленных закрытых позиций. Выберите другой период; для расчёта нужны обе стороны сделки.</td></tr>`;
  watchInstrumentImages($('#closedPositionsBody'));
}

function applyOperationFilters({ announce = true } = {}) {
  if (!state.bootstrap) return;
  const form = $('#operationFilters');
  const values = Object.fromEntries(new FormData(form));
  const instrumentQuery = String(values.instrument || '').trim().toLocaleLowerCase('ru');
  const rows = (state.bootstrap.operations || []).filter((row) => {
    const calendarDate = String(row.occurredAt || '').slice(0, 10);
    if (values.from && calendarDate < values.from) return false;
    if (values.to && calendarDate > values.to) return false;
    if (values.account && values.account !== row.portfolioId) return false;
    if (instrumentQuery && ![row.instrumentUid, instrumentDisplay(row).ticker, instrumentDisplay(row).name, portfolioDisplay(row)]
      .some((value) => String(value || '').toLocaleLowerCase('ru').includes(instrumentQuery))) return false;
    if (values.asset && row.assetType !== values.asset) return false;
    return true;
  });
  renderOperations({ operations: rows });
  if (announce) showToast(`Фильтры применены: ${rows.length} операций.`);
}

function renderAnalytics(data) {
  const analytics = data.analytics || {};
  $('#analyticsVersion').textContent = data.calculationVersion || 'Версия расчёта не указана';
  const percentage = value => formatPercentage(value);
  $('#grossReturn').textContent = percentage(analytics.grossReturn);
  $('#netReturn').textContent = percentage(analytics.netReturn);
  renderEvidenceNote($('#grossReturn').nextElementSibling, analytics.returnReason ? coverageSummary(data.dataCoverage) : 'для выбранного периода', analytics.returnReason);
  renderEvidenceNote($('#netReturn').nextElementSibling, analytics.returnReason ? coverageSummary(data.dataCoverage) : 'с учётом комиссий', analytics.returnReason);
  $('#volatilityValue').textContent = percentage(analytics.volatility);
  renderEvidenceNote($('#volatilityMeta'), analytics.volatilityState === 'ready'
    ? `${analytics.volatilityObservations} наблюдений`
    : analytics.volatilityState === 'partial-active-intervals'
      ? `${analytics.volatilityObservations} активных интервалов`
    : analytics.volatilityState === 'unsupported-multi-account-unaligned'
      ? 'Расчёт доступен по отдельному счёту.'
      : 'Нет равномерного ряда оценок.', analytics.volatilityReason || analytics.volatilityMethod || 'Для волатильности нужны оценки стоимости через одинаковые интервалы.');
  $('#winRateValue').textContent = percentage(analytics.winRate);
  $('#profitFactorValue').textContent = analytics.profitFactor === null || analytics.profitFactor === undefined ? (analytics.profitFactorState === 'no-losses' ? 'Без убытков' : '—') : analytics.profitFactor.toFixed(2).replace('.', ',');
  $('#profitFactorValue').nextElementSibling.textContent = analytics.profitFactor === null || analytics.profitFactor === undefined
    ? analytics.profitFactorState === 'no-losses' ? 'В выбранном периоде нет убыточных закрытых сделок.' : 'Для отношения прибыли к убытку нужны закрытые сделки за период.'
    : 'отношение прибыли к убытку по закрытым сделкам';
  $('#variationMargin').textContent = formatMoney(analytics.variationMarginNanos, 'RUB');
  const ranking = analytics.instrumentRanking || [];
  const rankingPage = pagedRows('instrumentRanking', ranking, 8, () => renderAnalytics(data));
  $('#instrumentRanking').innerHTML = rankingPage.length ? rankingPage.map((item) => {
    const display = instrumentDisplay(item);
    return `<div class="ranking-row"><strong>${escapeText(display.ticker || display.name)}</strong><span class="${BigInt(item.pnlNanos || '0') < 0n ? 'negative' : 'positive'}">${escapeText(formatMoney(item.pnlNanos, item.currency || 'RUB'))}</span><small>${escapeText([display.name !== display.ticker ? display.name : '', item.portfolioLabel, item.returnRate != null ? `${formatPercentage(item.returnRate, { signed: true })} за срок позиции` : 'Процент не рассчитан'].filter(Boolean).join(' · '))}</small></div>`;
  }).join('') : '<p class="empty-copy">За период пока нет результата, который можно отнести к конкретным инструментам. Выберите более длинный период или синхронизируйте сделки.</p>';

  const statistics = data.clientProduct?.statistics || {};
  const overall = statistics.overall || {};
  $('#tradeOutcomeMeta').textContent = `${overall.winCount || 0} прибыльных · ${overall.lossCount || 0} убыточных · ${overall.tradeCount || 0} закрытых`;
  const portfolioRows = statistics.perPortfolio || [];
  $('#portfolioStatistics').innerHTML = portfolioRows.length ? portfolioRows.map((row) => `
    <div class="stat-comparison-row"><span><strong>${escapeText(row.label)}</strong><small>${escapeText(row.returnReason || row.returnMethod || 'Результат за выбранный период')}</small></span><dl><div><dt>Доходность до комиссий</dt><dd class="${row.grossReturnRate == null ? '' : Number(row.grossReturnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.grossReturnRate, { signed: true }))}</dd></div><div><dt>Доходность после комиссий</dt><dd class="${row.netReturnRate == null ? '' : Number(row.netReturnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.netReturnRate, { signed: true }))}</dd></div><div><dt>Просадка</dt><dd>${escapeText(formatPercentage(row.maxDrawdownRate))}</dd></div><div><dt>Доля прибыльных сделок</dt><dd>${escapeText(formatPercentage(row.winRate))}</dd></div></dl></div>`).join('') : '<p class="empty-copy">Нет данных по счетам за выбранный период. Выберите другой диапазон.</p>';

  const cashFlows = statistics.cashFlows || [];
  const cashPage = pagedRows('cashFlowStatistics', cashFlows, 8, () => renderAnalytics(data));
  $('#cashFlowSummary').textContent = cashFlows.length ? `${cashFlows.length.toLocaleString('ru-RU')} движений за выбранный период` : 'За выбранный период движений нет';
  $('#cashFlowStatistics').innerHTML = cashPage.length ? cashPage.map((row) => `
    <div class="cash-flow-row ${row.kind === 'deposit' ? 'deposit' : 'withdrawal'}"><span><strong>${row.kind === 'deposit' ? 'Пополнение' : 'Вывод средств'}</strong><small>${escapeText([formatDate(row.occurredAt, true), row.portfolioLabel].filter(Boolean).join(' · '))}</small></span><span class="numeric"><strong>${escapeText(formatMoney(row.amountNanos, row.currency || 'RUB'))}</strong><small>${row.portfolioShareRate == null ? 'Нет оценки на начало периода' : `${escapeText(formatPercentage(row.portfolioShareRate))} от портфеля на начало`}</small></span></div>`).join('') : '<p class="empty-copy">В выбранном периоде нет пополнений и выводов.</p>';

  const rankingState = $('#rankingPositionState')?.value || 'open';
  const currentHoldings = statistics.holdings || data.clientProduct?.openPositions || [];
  const monthlyAssets = statistics.rankings?.[rankingState] || (rankingState === 'closed' ? statistics.monthlyAssets || []
    : currentHoldings.map((row) => ({ ...row, returnRate: row.returnRate ?? row.totalReturnRate })).filter((row) => row.returnRate != null)
      .sort((left, right) => right.returnRate - left.returnRate));
  $('#rankingSummary').textContent = rankingState === 'open'
    ? 'Открытые сейчас позиции: изменение цены с момента входа. Сначала лучшие, затем худшие.'
    : 'Сделки, закрытые за выбранный период: доходность за весь срок. Сначала лучшие, затем худшие.';
  const maxMonthly = monthlyAssets.reduce((maximum, row) => Math.max(maximum, Math.abs(Number(row.returnRate || 0))), 0.01);
  const assetPage = pagedRows('monthlyAssetChart', monthlyAssets, 8, () => renderAnalytics(data));
  $('#monthlyAssetChart').innerHTML = assetPage.length ? assetPage.map((row) => {
    const width = Math.max(4, Math.abs(Number(row.returnRate || 0)) / maxMonthly * 100);
    const display = instrumentDisplay(row);
    return `<div class="relative-bar-row ${Number(row.returnRate || 0) < 0 ? 'worst' : 'best'}"><span><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText([display.name !== display.ticker ? display.name : '', row.portfolioLabel, row.assetType === 'future' ? 'Фьючерс · изменение цены контракта' : '', row.month].filter(Boolean).join(' · '))}</small></span><div class="relative-bar"><i style="--bar:${width}%"></i></div><strong class="${Number(row.returnRate || 0) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))}</strong></div>`;
  }).join('') : `<p class="empty-copy">${rankingState === 'open' ? 'Для открытых позиций ещё нет сопоставимых цен входа и текущей цены. Обновите данные.' : 'В выбранном периоде нет закрытых сделок с подтверждённой доходностью. Выберите другой период.'}</p>`;

  const holdingState = $('#holdingPositionState')?.value || 'open';
  const efficiency = holdingState === 'closed' ? statistics.efficiency || [] : currentHoldings;
  const holdingRange = $('#holdingRange')?.value || 'all';
  const minHoldingHours = { week: 168, fortnight: 336, month: 730 }[holdingRange] || 0;
  const holdingRows = efficiency.filter((row) => holdingRange === 'all' || row.holdingHours != null && Number(row.holdingHours) >= minHoldingHours)
    .sort((left, right) => (right.holdingHours ?? -1) - (left.holdingHours ?? -1));
  const holdingPage = pagedRows('efficiencyChart', holdingRows, 8, () => renderAnalytics(data));
  $('#holdingSummary').textContent = `${holdingRows.length.toLocaleString('ru-RU')} ${holdingState === 'open' ? 'открытых сейчас' : 'закрытых за период'} позиций · сначала самый долгий срок`;
  const offset = (state.listPages?.get('efficiencyChart')?.page || 0) * 8;
  $('#efficiencyChart').innerHTML = holdingPage.length ? holdingPage.map((row, index) => {
    const display = instrumentDisplay(row);
    return `<div class="efficiency-row"><span>${offset + index + 1}</span><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText(formatHoldingTime(row.holdingHours))}</small><b class="${row.returnRate == null ? '' : Number(row.returnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))}</b><em>${escapeText([row.portfolioLabel, display.name !== display.ticker ? display.name : '', row.assetType === 'future' ? 'Фьючерс · изменение цены контракта' : '', row.holdingHours == null ? row.holdingReason : ''].filter(Boolean).join(' · '))}</em></div>`;
  }).join('') : `<p class="empty-copy">Нет ${holdingState === 'open' ? 'открытых' : 'закрытых за период'} позиций с таким сроком удержания. Выберите другой срок${holdingState === 'closed' ? ' или расширьте период статистики' : ''}.</p>`;

  const series = overall.equitySeries || [];
  renderAnalyticsReturnChart(series, data.dataCoverage, data.selectedPeriod);
}

function reconstructedHistoryExplanation(coverage) {
  const base = 'История восстановлена от оценки брокера с полной историей операций по дневным ценам. Фьючерсы учитываются по зачисленной и списанной вариационной марже; внутридневная переоценка прошлых дат не восстанавливается.'
    + (coverage?.pendingOperationTail && coverage.valuationAt ? ` Операции учтены по ${formatDate(coverage.valuationAt, true)}. Текущая стоимость имеет собственную дату обновления.` : '');
  const sources = coverage?.reconstruction?.priceSources || [];
  if (!sources.length) return base;
  const labels = [...new Set(sources.map(source => `${source.sourceTicker} (${source.sourceClassCode})`))].join(', ');
  return `${base} Дневные цены той же бумаги: ${labels}. Используется другой режим торгов с теми же активом, ISIN и валютой; это расчётная оценка.`;
}

function renderAnalyticsReturnChart(points, coverage = state.bootstrap?.dataCoverage, selectedPeriod = state.bootstrap?.selectedPeriod) {
  const host = $('#analyticsReturnChart');
  const empty = $('#analyticsReturnEmpty');
  if (!host) return;
  const reconstructed = coverage?.evidence === 'reconstructed';
  renderEvidenceNote($('#analyticsChartSubtitle'), reconstructed
    ? 'Восстановленная история. Пополнения и выводы влияют на линию.'
    : 'По оценкам стоимости портфеля. Пополнения и выводы влияют на линию.', reconstructed
      ? reconstructedHistoryExplanation(coverage) : 'Доходность после комиссий показана отдельно ниже.');
  if (!points || points.length < 2 || (state.analyticsChartMode === 'percent' && BigInt(points[0]?.equityNanos || '0') === 0n)) {
    state.analyticsReturnChart?.setData([]);
    host.hidden = true;
    if (empty) {
      empty.hidden = false;
      renderEvidenceNote(empty, points?.length === 1 ? 'Одна оценка. Для графика нужна ещё одна дата.'
        : coverageSummary(coverage, 'Нет сопоставимых оценок за период.'), coverage?.reason);
    }
    return;
  }
  host.hidden = false;
  if (empty) empty.hidden = true;

  const firstEquity = BigInt(points[0].equityNanos || 0);
  const chartPoints = points.map((p) => {
    const equity = BigInt(p.equityNanos || 0);
    const capitalChangeRate = firstEquity === 0n ? 0 : Number(((equity - firstEquity) * 1_000_000n) / firstEquity) / 1_000_000;
    return {
      time: p.time,
      capitalChangeRate,
      equityValue: Number(equity) / 1e9,
    };
  });

  if (state.analyticsReturnChart) {
    state.analyticsReturnChart.setData(chartPoints, selectedPeriod, { mode: state.analyticsChartMode, scope: state.analyticsAccount });
  } else {
    state.analyticsReturnChart = createAnalyticsReturnChart(host, chartPoints, selectedPeriod, { mode: state.analyticsChartMode, scope: state.analyticsAccount });
  }
}

function renderAnalyticsChartOnView() {
  $$('[data-analytics-unit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.analyticsUnit === state.analyticsChartMode)));
  $('#analyticsChartUnit').textContent = state.analyticsChartMode === 'rubles' ? 'Стоимость портфеля, ₽' : 'Изменение капитала, %';
  const data = analyticsDisplayData();
  renderAnalyticsReturnChart(data?.clientProduct?.statistics?.overall?.equitySeries || [], data?.dataCoverage, data?.selectedPeriod);
}

function analyticsDisplayData(data = state.bootstrap) {
  if (!data || !state.analyticsAccount) return data;
  const account = (data.equityCurvesByPortfolio || []).find((row) => row.portfolioId === state.analyticsAccount);
  if (!account) return data;
  return { ...data, portfolio: account.portfolio, analytics: account.analytics, equityCurve: account.equityCurve,
    dataCoverage: account.dataCoverage, clientProduct: { ...data.clientProduct,
      statistics: account.statistics, closedPositions: account.closedPositions || [],
      portfolios: (data.clientProduct?.portfolios || []).filter((row) => row.id === account.portfolioId),
      openPositions: (data.clientProduct?.openPositions || []).filter((row) => row.portfolioId === account.portfolioId) } };
}

function periodQuery(selection = state.selectedPeriod) {
  const query = new URLSearchParams({ period: selection?.period || 'month' });
  if (selection?.period === 'custom') {
    if (selection.from) query.set('from', selection.from);
    if (selection.to) query.set('to', selection.to);
  }
  return query.toString();
}

function renderSelectedPeriod(data) {
  const selected = data.selectedPeriod;
  const label = selected?.label || 'Вся сохранённая история';
  $('#statisticsPeriodStatus').textContent = `Все показатели: ${label}.`;
  $('#overviewPeriodStatus').textContent = label;
  $('#closedPositionsPeriod').textContent = `Закрыты за период: ${label}. Цена входа учитывает более ранние покупки.`;
  if (selected) {
    $('#statisticsFrom').value = selected.fromDate || String(selected.from || '').slice(0, 10);
    $('#statisticsTo').value = selected.toDate || String(selected.to || '').slice(0, 10);
  }
  $$('[data-stat-range]').forEach((button) => {
    const active = button.dataset.statRange === state.selectedPeriod.period;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  const overviewRanges = { '1m': 'month', '3m': 'quarter', '1y': 'year', all: 'all' };
  $$('[data-range]').forEach((button) => {
    const active = overviewRanges[button.dataset.range] === state.selectedPeriod.period;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  const accounts = state.bootstrap?.equityCurvesByPortfolio || [];
  const options = '<option value="">Все счета</option>' + accounts.map((row) => `<option value="${escapeText(row.portfolioId)}">${escapeText(row.portfolioLabel)}</option>`).join('');
  for (const id of ['overviewAccount', 'statisticsAccount']) {
    const control = $('#' + id);
    control.innerHTML = options; control.value = state.analyticsAccount;
    control.disabled = accounts.length < 2;
  }
}

function renderPeriodViews() {
  const data = analyticsDisplayData();
  if (!data) return;
  renderSelectedPeriod(data);
  renderPortfolio(data);
  renderClosedPositions(data);
  renderAnalytics(data);
  renderEquityChart();
}

async function selectPeriod(selection, { announce = true } = {}) {
  const requestNumber = ++state.periodRequest;
  state.periodLoading = true;
  $('#statisticsPeriodStatus').textContent = 'Пересчитываем все показатели за выбранный период…';
  $('#overviewPeriodStatus').textContent = 'Пересчитываем все показатели за выбранный период…';
  $('#statisticsPeriodForm').setAttribute('aria-busy', 'true');
  try {
    const data = await request(`/api/bootstrap?${periodQuery(selection)}`);
    if (requestNumber !== state.periodRequest) return;
    // Older static fixtures have no period contract. Keep their current range explicit.
    if (!data.selectedPeriod) throw new Error('Эта версия просмотра ещё не поддерживает пересчёт периода. Откройте обновлённую локальную проверку.');
    state.selectedPeriod = { ...selection };
    state.statisticsRange = selection.period;
    state.listPages = new Map();
    renderBootstrap(data);
    if (announce) showToast('Период применён к графику, метрикам и спискам.');
  } catch (error) {
    if (requestNumber !== state.periodRequest) return;
    renderSelectedPeriod(analyticsDisplayData());
    showToast(error.message || 'Период не обновлён. Повторите попытку.', true);
  } finally {
    if (requestNumber === state.periodRequest) {
      state.periodLoading = false;
      $('#statisticsPeriodForm').setAttribute('aria-busy', 'false');
    }
  }
}

async function applyStatisticsPeriod({ announce = true } = {}) {
  const from = $('#statisticsFrom').value;
  const to = $('#statisticsTo').value;
  if (!from || !to || from > to) {
    showToast('Укажите начало и конец периода. Начало не может быть позже конца.', true);
    return;
  }
  await selectPeriod({ period: 'custom', from, to }, { announce });
}

async function selectStatisticsRange(range) {
  await selectPeriod({ period: range });
}

function renderMarketVision(data) {
  const vision = state.marketOverview || data.clientProduct?.marketVision || {};
  $('#marketVisionCoverage').textContent = (vision.stale ? 'Сохранённые данные · ' : '') + (vision.coverage || 'Обновите обзор, чтобы получить цены завершённых торгов.');
  const rows = vision.rows || [];
  $('#marketVisionRows').innerHTML = rows.length ? rows.map((row) => `
    <div class="market-vision-row ${row.side}"><span><strong>${escapeText(row.ticker || row.name)}</strong><small>${row.assetType === 'future' ? 'Фьючерс' : 'Акция'} · ${row.side === 'loser' ? 'снижение' : row.side === 'unchanged' ? 'без изменения' : 'рост'}${row.to ? ' · ' + escapeText(new Date(row.to).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short' })) : ''}</small></span><dl><div><dt>За день</dt><dd class="${Number(row.dayReturnRate || 0) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.dayReturnRate, { signed: true }))}</dd></div><div><dt>Объём</dt><dd class="${Number(row.volumeChangeRate || 0) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.volumeChangeRate, { signed: true }))}</dd></div></dl></div>`).join('') : '<p class="empty-copy">Для выбранных инструментов пока нет двух завершённых торговых дней. Обновите обзор, чтобы получить данные брокера.</p>';
}

async function refreshMarketVision(force = false) {
  if (state.marketOverviewPending || runtimeAdapter || state.bootstrap?.capabilities?.marketCalendar !== true) return;
  if (state.bootstrap?.environment === 'fixture') { renderMarketVision(state.bootstrap); return; }
  state.marketOverviewPending = true; $('#marketVisionRefresh').disabled = true;
  $('#marketVisionCoverage').textContent = 'Получаем завершённые торги по выбранным акциям и фьючерсам…';
  try { state.marketOverview = await request('/api/market/overview' + (force ? '?force=1' : '')); renderMarketVision(state.bootstrap); }
  catch (error) { $('#marketVisionCoverage').textContent = error.message; }
  finally { state.marketOverviewPending = false; $('#marketVisionRefresh').disabled = false; }
}

function evidenceNote(field, data) {
  if (data?.environment === 'fixture' || data?.preview?.static) return 'Учебный пример';
  return ({ direct: 'Данные брокера', derived: 'Расчёт по данным брокера', estimated: 'Расчёт по данным брокера' })[field?.evidence] || 'Источник не подтверждён';
}

function renderRiskPlan(data) {
  const slice = data.clientProduct || {};
  const risk = slice.futuresRisk || {};
  const riskAccounts = (risk.accounts || []).length
    ? risk.accounts
    : [{ portfolioId: 'portfolio-1', label: slice.portfolios?.[0]?.label || 'Текущий портфель', ...risk }];
  const supportedAccounts = riskAccounts.filter((account) => account.liquidPortfolio?.value !== null && account.liquidPortfolio?.value !== undefined).length;
  $('#marginCoverage').textContent = supportedAccounts
    ? `${supportedAccounts} ${supportedAccounts === 1 ? 'счёт' : 'счёта'} · отдельно`
    : 'Источник не подключён';
  const moneyFields = [
    ['Гарантийное обеспечение', 'guaranteeNanos', '', 'guaranteeMargin', 'Средства для обеспечения фьючерсных позиций.'],
    ['Ликвидный портфель', 'liquidPortfolio', '', 'liquidPortfolio', 'Стоимость активов, которые брокер учитывает для обеспечения.'],
    ['Начальная маржа', 'startingMargin', '', '', 'Обеспечение, требуемое брокером для открытия позиций.'],
    ['Минимальная маржа', 'minimumMargin', '', '', 'Нижний порог обеспечения по оценке брокера.'],
    ['Вариационная маржа за день', 'variationMarginDayNanos', '', 'vm', 'Начисление или списание по фьючерсам за день.'],
    ['Запас относительно начальной маржи', 'maxAvailableBeforeMarginCallNanos', 'margin-buffer', 'marginBuffer', 'Ликвидный портфель минус начальная маржа, минимум 0 ₽. Только по свежей оценке в рублях.'],
  ];
  $('#marginSourceNote').textContent = supportedAccounts
    ? 'Показатели сохранены из Т‑Инвест и считаются отдельно по каждому счёту. Сверяйте дату оценки.'
    : 'Маржинальные показатели появятся после синхронизации, если брокер предоставляет их для счёта. Ниже доступен ручной расчёт размера позиции.';
  $('#marginAccountLedgers').innerHTML = riskAccounts.map((account) => {
    const availableFields = moneyFields.filter(([, key]) => account[key]?.value !== null && account[key]?.value !== undefined);
    if (!availableFields.length) return `<section class="margin-account margin-account-empty"><header><strong>${escapeText(account.label)}</strong><span class="status-chip">Нет оценки</span></header><p>${escapeText(account.reason || account.liquidPortfolio?.note || 'Брокер ещё не вернул маржинальные показатели. Обновите данные в основной версии; для немаржинального счёта часть показателей не применяется.')}</p></section>`;
    return `
    <section class="margin-account" aria-label="Маржинальные показатели: ${escapeText(account.label)}">
      <header><strong>${escapeText(account.label)}</strong><small>${escapeText(account.capturedAt ? `${formatDate(account.capturedAt)}${account.stale ? ' · требуется обновление' : ''}` : 'Отдельный счёт · значения не суммируются')}</small></header>
      <dl class="margin-ledger">${availableFields.map(([label, key, className, termKey, explanation]) => {
        const field = account[key] || {};
        const fixtureReserve = key === 'maxAvailableBeforeMarginCallNanos' && (data.environment === 'fixture' || data.preview?.static)
          && BigInt(account.stressReserveNanos || '0') > 0n;
        const displayLabel = fixtureReserve ? 'Учебный запас маржи · с резервом' : label;
        const displayExplanation = fixtureReserve ? `Учебный расчёт с дополнительным резервом ${formatMoney(account.stressReserveNanos, account.currency || 'RUB')}.` : explanation;
        const helpBtn = fixtureReserve
          ? `<button class="term-help" type="button" data-evidence-note="${escapeText(field.note || displayExplanation)}" aria-label="Справка: ${escapeText(displayLabel)}">?</button>`
          : termKey ? `<button class="term-help" type="button" data-term="${termKey}" aria-label="Справка: ${escapeText(label)}">?</button>` : '';
        return `<div class="${className}"><dt>${displayLabel} ${helpBtn}</dt><dd>${escapeText(formatMoney(field.value, account.currency || 'RUB'))}</dd><small class="metric-explanation">${escapeText(displayExplanation)}</small><small class="metric-source">${escapeText(evidenceNote(field, data))}</small></div>`;
      }).join('')}</dl>
    </section>`;
  }).join('') || '<p class="empty-copy">Сначала синхронизируйте счета. Ручной расчёт размера позиции доступен ниже.</p>';
  const futuresRows = riskAccounts.flatMap((account) => (account.instruments || []).map((row) => ({ ...row, portfolioLabel: account.label })));
  const futuresPage = pagedRows('futuresRiskRows', futuresRows, 8, () => renderRiskPlan(data));
  $('#futuresRiskRows').innerHTML = futuresPage.length ? futuresPage.map((row) => `
    <div class="futures-risk-row"><span><strong>${escapeText(instrumentDisplay(row).ticker || instrumentDisplay(row).name)}</strong><small>${escapeText(row.portfolioLabel)}</small></span><dl><div><dt>ГО <button class="term-help" type="button" data-term="guaranteeMargin" aria-label="Справка: Гарантийное обеспечение">?</button></dt><dd>${escapeText(formatMoney(row.guaranteeNanos, row.currency || 'RUB'))}</dd></div></dl></div>`).join('') : '';

  const plan = slice.tradingPlan || {};
  $('#generatedPlanSurface').hidden = !(plan.items || []).length;
  $('#tradingPlanDate').textContent = plan.date ? `План на ${plan.date} · черновик, без исполнения` : 'Дата не задана. Черновик не исполняется автоматически.';
  const planPage = pagedRows('tradingPlan', sortRows(plan.items || [],state.sorts.plan,{name:r=>r.ticker||r.name}), 10, () => renderRiskPlan(data));
  $('#tradingPlanBody').innerHTML = planPage.length ? planPage.map((row) => `
    <tr><td><span class="instrument-cell"><strong>${escapeText(row.name)}</strong><small>${escapeText([row.ticker, row.portfolioLabel].filter(Boolean).join(' · '))}</small></span></td><td><span class="status-chip ${row.direction === 'short' ? 'stale' : 'fresh'}">${row.direction === 'short' ? 'Шорт' : 'Лонг'}</span></td><td class="numeric"><strong>${escapeText(formatPercentage(row.allocationRate))}</strong><small class="cell-note">${escapeText(formatMoney(row.positionAmountNanos, 'RUB'))}</small></td><td class="numeric">${escapeText(quoteMoney(row.entryPriceNanos, row.priceCurrency))}</td><td class="numeric">${escapeText(quoteMoney(row.exitPriceNanos, row.priceCurrency))}</td><td>${escapeText(row.expectedHold)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">План заполняется вручную. Укажите инструмент, цену входа, цель и срок; приложение не создаёт сделки автоматически.</td></tr>';

  const advisor = slice.riskAdvisor || {};
  const advisorPage = pagedRows('riskAdvisorRows', advisor.recommendations || [], 8, () => renderRiskPlan(data));
  $('#riskAdvisorRows').innerHTML = advisorPage.length ? advisorPage.map((row) => `
    <div class="advisor-row"><span><strong>${escapeText(instrumentDisplay(row).ticker || instrumentDisplay(row).name)}</strong><small>${escapeText([row.assetType === 'future' ? 'Фьючерс' : 'Акция', row.portfolioLabel, evidenceLabel(row.evidence, data)].filter(Boolean).join(' · '))}</small></span><div><strong>${escapeText(formatPercentage(row.recommendedMaxRate))}</strong><small>${escapeText(formatMoney(row.recommendedMaxNanos, 'RUB'))} максимум по политике</small></div><ul>${(row.reasons || []).slice(0, 5).map((reason) => `<li>${escapeText(reason)}</li>`).join('')}</ul></div>`).join('') : '<p class="empty-copy">Автоматическая оценка появится после получения позиций и маржинальных показателей. Пока рассчитайте размер вручную по сумме риска и стоп-цене.</p>';
  $('#riskAdvisorWarning').textContent = advisor.warning || 'Оценка не гарантирует, что брокер не потребует дополнительное обеспечение.';
}

function inputMoneyNanos(value) {
  const text = String(value || '').trim().replace(',', '.');
  if (!/^\d{1,15}(?:\.\d{1,9})?$/u.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return (BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'))).toString();
}

function updateRiskCalculator() {
  const values = Object.fromEntries(new FormData($('#riskCalculatorForm')));
  const future = values.assetType === 'future';
  $('#riskFutureFields').hidden = !future;
  const result = calculateRiskDraft({
    capitalNanos: inputMoneyNanos(values.capital), riskBudgetNanos: inputMoneyNanos(values.riskAmount),
    entryPriceNanos: inputMoneyNanos(values.entryPrice), stopPriceNanos: inputMoneyNanos(values.stopPrice),
    lotSize: values.lotSize, direction: values.direction, assetType: values.assetType,
    minPriceIncrementNanos: future ? inputMoneyNanos(values.priceStep) : undefined,
    minPriceIncrementAmountNanos: future ? inputMoneyNanos(values.stepValue) : undefined,
    guaranteePerLotNanos: future ? inputMoneyNanos(values.guaranteePerLot) : undefined,
  });
  const output = $('#riskCalculatorResult');
  if (result.state !== 'calculated') {
    output.innerHTML = `<p class="empty-copy">${escapeText(result.reason || 'Введите капитал, допустимый риск, цену входа и стоп-цену.')}</p>`;
    return;
  }
  output.innerHTML = `<dl class="calculator-metrics"><div><dt>Количество лотов</dt><dd>${escapeText(result.lots)} лот.</dd><small>${escapeText(result.units)} ед.</small></div><div><dt>Убыток при стоп-цене</dt><dd>${escapeText(formatMoney(result.actualRiskNanos))}</dd><small>Допустимый убыток: ${escapeText(formatMoney(result.riskBudgetNanos))}</small></div><div><dt>Сумма позиции</dt><dd>${escapeText(formatMoney(result.positionAmountNanos))}</dd><small>без комиссий и проскальзывания</small></div></dl><p class="surface-note">${escapeText(result.reason || '')} ${escapeText(result.warning || '')}</p>`;
}

function renderSync(data) {
  const runs = data.syncRuns || [];
  const runPage = pagedRows('syncRuns', runs, 5, () => renderSync(data));
  $('#syncSummary').textContent = runs.length ? `${runs.length} запуск(а)` : 'нет данных';
  $('#syncRuns').innerHTML = runPage.length ? runPage.map((run) => `<div class="run-row"><strong>${escapeText(formatDate(run.startedAt, true))}</strong><span class="${run.status === 'failed' ? 'negative' : run.status === 'warning' ? '' : 'positive'}">${escapeText(run.statusLabel || run.status)}</span><small>${escapeText(`${run.portfolioLabel || 'Текущий портфель'} · ${run.rawCount} исходных · ${run.normalizedCount} обработанных · ${run.durationMs} мс`)}</small></div>`).join('') : '<p class="empty-copy">Запуски синхронизации не найдены.</p>';
  const latest = runs[0];
  if (latest) $$('#syncStages li').forEach((item) => item.classList.toggle('complete', latest.completedStages?.includes(item.dataset.stage)));
  const latency = data.latency || {};
  $('#latencyP50').textContent = latency.p50 === null || latency.p50 === undefined ? '—' : `${latency.p50} мс`;
  $('#latencyP95').textContent = latency.p95 === null || latency.p95 === undefined ? '—' : `${latency.p95} мс`;
  $('#latencyP99').textContent = latency.p99 === null || latency.p99 === undefined ? '—' : `${latency.p99} мс`;
  $('#latencyStatus').textContent = latency.clientVerified ? `Подтверждено на клиентском ПК · n=${latency.samples}` : `Проверка на учебных данных · измерений: ${latency.samples || 0}; не подтверждает клиентскую задержку.`;
}

function renderInstruments(data) {
  const selectedMarket = $('#instrumentSelect').value;
  const instruments = [...(data.instruments || [])];
  if (state.marketInstrument && !instruments.some(row => (row.viewKey || row.instrumentUid) === state.marketInstrument.instrumentUid)) instruments.push(state.marketInstrument);
  const optionLabel = (item) => {
    const display = instrumentDisplay(item);
    return [display.ticker, display.name !== display.ticker ? display.name : '', item.portfolioLabel ? portfolioDisplay(item) : ''].filter(Boolean).join(' · ');
  };
  const options = instruments.map((item) => `<option value="${escapeText(item.viewKey || item.instrumentUid)}">${escapeText(optionLabel(item))}</option>`).join('');
  $('#instrumentSelect').innerHTML = options || '<option value="">Нет доступных инструментов</option>';
  const selectedCompany = $('#aiInstrument').value;
  const companyInstruments = (data.companyAnalysisInstruments || []).filter((item) => item.assetType === 'share');
  const aiOptions = companyInstruments.map((item) => `<option value="${escapeText(item.instrumentUid)}">${escapeText(`${optionLabel(item)}${item.source === 'history' ? ' · из истории операций' : ''}`)}</option>`).join('');
  $('#aiInstrument').innerHTML = `<option value="">Выберите инструмент</option>${aiOptions}`;
  $('#aiInstrument').value = companyInstruments.some((item) => item.instrumentUid === selectedCompany) ? selectedCompany : '';
  if ($('#aiInstrument').value !== selectedCompany) renderSelectedCompany();
  const preferredInstrument = instruments.some(row => (row.viewKey || row.instrumentUid) === selectedMarket) ? selectedMarket : data.candles?.[0]?.viewKey || data.candles?.[0]?.instrumentUid;
  if (preferredInstrument && instruments.some((item) => (item.viewKey || item.instrumentUid) === preferredInstrument)) {
    $('#instrumentSelect').value = preferredInstrument;
  }
}

function renderEquityChart() {
  const data = analyticsDisplayData();
  const sourcePoints = data?.equityCurve || [];
  const batchPoints = !state.analyticsAccount && !sourcePoints.length ? data?.snapshotBatchCurve || [] : [];
  const points = normalizeEquityPoints(sourcePoints.length ? sourcePoints : batchPoints);
  const enoughHistory = points.length >= 2;
  $('#equityChart').hidden = !enoughHistory;
  $('#equityChart').parentElement.classList.toggle('chart-frame-empty', !enoughHistory);
  $('#equityEmpty').hidden = enoughHistory;
  renderEvidenceNote($('#equityEmpty'), points.length === 1
    ? 'За выбранный период доступна одна оценка. Обновите историю портфеля.'
    : coverageSummary(data?.dataCoverage, 'Нет оценок стоимости за период. Обновите данные или выберите другой период.'), data?.dataCoverage?.reason);
  $('#equityObservationNote').hidden = !enoughHistory;
  const reconstructed = data?.dataCoverage?.evidence === 'reconstructed';
  renderEvidenceNote($('#equityObservationNote'), enoughHistory && batchPoints.length
    ? 'Последовательный опрос счетов; точки не используются для доходности.'
    : enoughHistory ? `${reconstructed ? 'Восстановленная история · ' : ''}${points.length.toLocaleString('ru-RU')} оценок. Пополнения и выводы влияют на стоимость.` : '', batchPoints.length ? data.snapshotBatchCurveNote
      : reconstructed ? reconstructedHistoryExplanation(data?.dataCoverage) : '');
  if (!enoughHistory) state.equityChart?.setData([], data?.selectedPeriod, state.analyticsAccount);
  else if (state.equityChart) state.equityChart.setData(points, data?.selectedPeriod, state.analyticsAccount);
  else state.equityChart = createEquityChart($('#equityChart'), points, data?.selectedPeriod, state.analyticsAccount);
}

async function renderMarketChart() {
  const sequence = (state.chartRequest || 0) + 1;
  state.chartRequest = sequence;
  const instrumentKey = $('#instrumentSelect').value;
  const selected = [...(state.bootstrap?.instruments || []), ...(state.marketInstrument ? [state.marketInstrument] : [])].find(row => (row.viewKey || row.instrumentUid) === instrumentKey);
  const instrumentUid = selected?.instrumentUid || instrumentKey;
  let candles = (state.bootstrap?.candles || []).filter(row => row.instrumentUid === instrumentUid || row.viewKey === instrumentKey);
  let unavailable = null;
  if (state.bootstrap?.capabilities?.marketCalendar === true && state.bootstrap?.environment !== 'fixture' && !state.bootstrap?.preview?.localReview && instrumentUid) {
    $('#marketStatus').textContent = 'Обновляем котировки…';
    try {
      const result = await request('/api/market/candles?' + new URLSearchParams({ instrumentUid, interval: $('#marketInterval').value }));
      if (sequence !== state.chartRequest) return;
      candles = result.data;
      unavailable = result.warning || (result.stale ? 'Сохранённые котировки · обновление задерживается' : null);
    } catch (error) { unavailable = error.message; }
  }
  if (sequence !== state.chartRequest) return;
  state.marketChart?.destroy();state.marketChart = null;
  $('#marketChart').replaceChildren();
  try {
    state.marketChart = createMarketChart($('#marketChart'), candles);
    if (!state.marketChart) {
      $('#marketChart').innerHTML = '<div class="empty-state"><h3>Свечи пока недоступны</h3><p>Выберите другой интервал или инструмент. Для нового контракта и закрытого режима торгов истории может не быть.</p></div>';
      $('#marketStatus').textContent = unavailable || 'Т‑Инвест не вернул свечи за этот интервал';
      $('#marketEventTime').textContent='—';$('#marketAge').textContent='Нет свежих котировок';return;
    }
    const normalized = normalizeMarketCandles(candles), last = normalized.at(-1);
    $('#marketStatus').textContent = unavailable || (state.bootstrap?.environment === 'fixture' ? 'Учебные котировки' : 'Котировки Т‑Инвест · обновление раз в минуту');
    const source = candles.find(candle => candle.priceSource)?.priceSource;
    if (source) $('#marketStatus').textContent = 'Дневные цены ' + source.sourceTicker + ' (' + source.sourceClassCode + ') · проверен тот же актив и ISIN';
    $('#marketEventTime').textContent = formatDate(last.sourceEventTime || new Date(last.time * 1000).toISOString(), true);
    $('#marketAge').textContent = last.capturedAt ? 'Получено ' + formatDate(last.capturedAt, true) : formatAge(last.ageMs);
    $$('[data-indicator]').forEach(button => state.marketChart.toggle(button.dataset.indicator, button.getAttribute('aria-pressed') === 'true'));
  } catch {
    state.marketChart?.destroy();state.marketChart=null;
    $('#marketChart').replaceChildren();
    $('#marketStatus').textContent = 'Не удалось построить график. Обновите котировки или выберите другой интервал.';
    $('#marketAge').textContent='Ошибка графика';
  }
}

function renderLocalReview(data) {
  if (data.preview?.localReview !== true) return;
  $('#nodeStatus').dataset.state = 'preview';
  $('#nodeState').textContent = 'Проверка исправлений';
  $('#nodeVersion').textContent = 'Локальная версия · сохранённые данные';
  $('#environmentBanner').classList.remove('live');
  $('#environmentBanner').hidden = false;
  $('#environmentBanner strong').textContent = 'Локальная проверка';
  const snapshotDate = formatDate(data.preview.snapshotAt || data.generatedAt || data.portfolio?.asOf, true);
  $('#environmentBanner span').textContent = `Локальная проверка: данные на ${snapshotDate}. Основная версия не изменена.`;
  $('#environmentCode').textContent = 'СОХРАНЁННЫЕ ДАННЫЕ · ТОЛЬКО ПРОСМОТР';
  if (data.capabilities?.tradingPlan === true) $('#environmentCode').textContent = 'КОПИЯ ДАННЫХ · ЛОКАЛЬНЫЙ ПЛАН';
  $('#connectionSummary').textContent = 'Открыта копия сохранённых данных. Подключение и синхронизация доступны в основной версии.';
  $('#connectionBadge').textContent = 'Только просмотр';
  for (const id of ['syncButton', 'connectButton', 'connectionPrimaryButton', 'connectionCheckButton', 'firstSyncButton', 'replaceConnectionButton', 'disconnectButton', 'captureEnvironment', 'captureConsent', 'captureSubmitButton', 'disconnectConfirmButton', 'exportButton', 'identityStatus', 'navProductSwitcher']) {
    const control = $('#' + id);
    if (control) { control.disabled = true; control.title = 'Доступно в основной версии приложения'; }
  }
  renderCompanyStatus();
  $$('[data-system-section]').forEach((control) => { control.disabled = true; control.title = 'Доступно в основной версии приложения'; });
}

function renderBootstrap(data) {
  data = { ...data, connection: maskedConnectionStatus(data.connection) };
  if (!data.displayFx?.rates?.USD && state.bootstrap?.displayFx?.rates?.USD) data.displayFx=state.bootstrap.displayFx;
  state.bootstrap = data;
  setChartPresentation({language:state.language,displayCurrency:state.displayCurrency,rates:data.displayFx?.rates||{}});
  prepareDisplayLabels(data);
  $('#syncButton').disabled = false;
  $('#equityEmpty').textContent = 'Нет сохранённых оценок стоимости за выбранный период.';
  const fixture = data.environment === 'fixture';
  const staticPreview = fixture && data.preview?.static;
  $('#environmentBanner').hidden = !fixture;
  $('#environmentBanner').classList.toggle('live', !fixture);
  $('#environmentBanner strong').textContent = staticPreview ? 'Учебный веб-просмотр' : fixture ? 'Учебные данные' : '';
  $('#environmentBanner span').textContent = staticPreview
    ? 'Учебные данные работают только в браузере. Синхронизация и котировки имитируются; подключение брокера, личные данные и облачная модель недоступны.'
    : fixture
      ? 'Это проверочные данные, не портфель клиента. Реальное подключение не настроено.'
      : '';
  $('#environmentCode').textContent = staticPreview ? 'УЧЕБНЫЙ ПРОСМОТР · БЕЗ ЛИЧНЫХ ДАННЫХ' : fixture ? 'УЧЕБНЫЕ ДАННЫЕ · БЕЗ ЛИЧНОГО ПОРТФЕЛЯ' : '';
  $('#captureEnvironment').disabled = fixture;
  $('#captureConsent').disabled = fixture;
  $('#captureSubmitButton').disabled = fixture;
  $('#credentialCaptureWarning').innerHTML = fixture
    ? staticPreview
      ? '<strong>Нативный ввод недоступен.</strong><span>GitHub Pages работает без Nexus-сессии и Local Node; системное окно Windows здесь не откроется.</span>'
      : '<strong>Нативный ввод недоступен.</strong><span>Учебный режим не обращается к T‑Invest. Подключение доступно только в разрешённом Local Node после входа из Nexus.</span>'
    : '<strong>Ввод выполняется вне Workspace.</strong><span>Эта веб-страница не увидит введённые данные. Нативное окно Windows проверит доступ только для чтения каждого открытого счёта и сохранит токен через DPAPI для текущего пользователя.</span>';
  renderRuntimeTruth(data);
  renderConnection(data);
  renderQuality(data);
  const accountSelect = $('#operationFilters').elements.account;
  const selectedAccount = accountSelect.value;
  const portfolioOptions = (data.clientProduct?.portfolios || []).map((portfolio) => `<option value="${escapeText(portfolio.id)}">${escapeText(portfolio.label)}</option>`).join('');
  accountSelect.innerHTML = `<option value="">Все портфели</option>${portfolioOptions}`;
  if ((data.clientProduct?.portfolios || []).some((item) => item.id === selectedAccount)) accountSelect.value = selectedAccount;
  applyOperationFilters({ announce: false });
  renderInstruments(data);
  renderCompanyAvailability(data.aiAvailability || state.companyAvailability);
  renderMarketVision(data);
  renderRiskPlan(data);
  renderSync(data);
  renderPeriodViews();
  renderLocalReview(data);
  if (state.tradingPlanUi) void state.tradingPlanUi.refresh();
  void state.marketCalendarUi?.refreshHoldings();
}

async function loadBootstrap() {
  try {
    let data = await request(`/api/bootstrap?${periodQuery()}`);
    state.session = { csrfToken: data.csrfToken };
    if (localEnvironment(data) && data.preview?.localReview !== true) {
      try {
        const connection = maskedConnectionStatus(await request('/api/connection'));
        data = { ...data, connection };
      } catch (error) {
        data = { ...data, connection: { connected: false } };
        renderBootstrap(data);
        renderConnection(data, { phase: 'error', errorMessage: connectionErrorMessage(error) });
        return;
      }
    }
    renderBootstrap(data);
  } catch (error) {
    state.bootstrap = null;
    state.equityChart?.destroy();
    state.equityChart = null;
    $('#qualityState').textContent = 'Рабочая среда недоступна';
    $('#qualityState').className = 'error';
    $('#qualityNote').textContent = 'откройте приложение из Nexus заново';
    $('#nodeStatus').dataset.state = 'error';
    $('#nodeState').textContent = 'Рабочая среда недоступна';
    $('#nodeVersion').textContent = 'данные не загружены';
    $('#identityName').textContent = 'Профиль недоступен';
    $('#identityRole').textContent = 'Профиль';
    $('#identityInitials').textContent = '—';
    renderConnection({ environment: 'local', connection: { connected: false }, syncRuns: [] }, { phase: 'runtime-error', errorMessage: 'Local Node не ответил. Запустите Nexus и откройте Workspace заново.' });
    $('#positionsBody').innerHTML = '<tr><td colspan="9" class="empty-cell">Локальные данные недоступны. Проверьте рабочую среду и обновите страницу.</td></tr>';
    $('#closedPositionsBody').innerHTML = '<tr><td colspan="8" class="empty-cell">Закрытые позиции недоступны: рабочая среда не ответила.</td></tr>';
    state.operationRows = [];
    state.operationPage = 0;
    $('#operationsPrevious').disabled = true;
    $('#operationsNext').disabled = true;
    $('#operationsCount').textContent = 'Операции не загружены';
    $('#operationsBody').innerHTML = '<tr><td colspan="7" class="empty-cell">Операции не загружены: Local Node недоступен.</td></tr>';
    $('#equityEmpty').hidden = false;
    $('#equityEmpty').textContent = 'Кривая капитала недоступна до загрузки оценок стоимости.';
    $('#syncButton').disabled = true;
    showToast(error.message, true);
  }
}

async function startSync() {
  if (localEnvironment() && !state.connection?.connected) {
    showToast('Сначала подтвердите доступ только для чтения всех открытых счетов.', true);
    activateView('sync');
    $('#connectionPrimaryButton').focus();
    return false;
  }
  const button = $('#syncButton');
  button.disabled = true;
  button.querySelector('span').textContent = 'Синхронизация…';
  if (localEnvironment()) renderConnection(state.bootstrap, { phase: 'syncing' });
  $$('#syncStages li').forEach((item) => item.classList.remove('complete', 'active', 'error'));
  try {
    const result = await request('/api/sync', { method: 'POST', body: JSON.stringify({}) });
    showToast(`Синхронизация завершена: ${result.normalizedCount} нормализованных операций.`);
    await loadBootstrap();
    return true;
  } catch (error) {
    showToast(error.message, true);
    $('#syncAlert').hidden = false;
    if (localEnvironment()) renderConnection(state.bootstrap, { phase: 'sync-error' });
    return false;
  } finally {
    button.disabled = localEnvironment() && !state.connection?.connected;
    button.querySelector('span').textContent = 'Синхронизировать';
  }
}

const MAX_STREAM_RETRIES = 5;

function streamUnavailable(message) {
  $('#marketStatus').textContent = message;
  $('#marketAge').textContent = 'поток котировок не подключён';
}

function scheduleStreamRetry() {
  if (document.hidden || state.streamRetryAttempts >= MAX_STREAM_RETRIES) {
    streamUnavailable('Поток котировок не подключён · автоматические повторы завершены');
    return;
  }
  const delay = Math.min(16_000, 1_000 * (2 ** state.streamRetryAttempts));
  state.streamRetryAttempts += 1;
  clearTimeout(state.streamRetryTimer);
  state.streamRetryTimer = setTimeout(openStream, delay);
  $('#marketStatus').textContent = `Поток котировок переподключается · попытка ${state.streamRetryAttempts}/${MAX_STREAM_RETRIES}`;
}

function openStream() {
  clearTimeout(state.streamRetryTimer);
  state.streamRetryTimer = null;
  if (state.bootstrap?.preview?.localReview === true || state.bootstrap?.capabilities?.marketStream !== true) {
    state.stream = null;
    streamUnavailable(state.bootstrap?.capabilities?.marketStreamReason || 'Поток котировок не подключён в этой версии приложения.');
    return;
  }
  const handleMessage = (message, { reportPaint = true } = {}) => {
    if (message.type !== 'market.candle' || !state.marketChart) return;
    const selectedInstrument = $('#instrumentSelect').value;
    if (selectedInstrument && message.candle.instrumentUid !== selectedInstrument) return;
    state.marketChart.updateCandle(message.candle);
    requestAnimationFrame(() => {
      $('#marketEventTime').textContent = formatDate(message.sourceEventTime, true);
      const age = Math.max(0, Date.now() - new Date(message.sourceEventTime).getTime());
      $('#marketAge').textContent = message.simulated ? `${formatAge(age)} · тестовый поток` : formatAge(age);
      $('#marketAge').classList.remove('live-flash');
      requestAnimationFrame(() => $('#marketAge').classList.add('live-flash'));
      if (reportPaint) {
        void request('/api/latency/paint', { method: 'POST', body: JSON.stringify({ eventId: message.eventId, uiPaintedAt: new Date().toISOString() }) }).catch(() => {});
      }
    });
  };
  if (!runtimeAdapter) {
    showToast('Static fixture runtime is unavailable.', true);
    return;
  }
  state.stream = runtimeAdapter.startMarketStream((message) => handleMessage(message, { reportPaint: false }));
}

async function generateAiReport() {
  if (state.companyPending) return;
  if (state.companyAvailability?.available !== true) {
    showToast(state.companyAvailability?.message || 'Модель для анализа компаний ещё не подключена. Сохранённые факты можно открыть отдельно.', true);
    renderCompanyStatus();
    return;
  }
  const selection = companySelection();
  const { instrumentUid, focus } = selection;
  if (!instrumentUid) { showToast('Выберите компанию для анализа.', true); return; }
  if (state.bootstrap?.capabilities?.companyFacts !== true) return;
  const view = companyView(selection);
  const requestNumber = ++state.companyRequest;
  state.companyPending = { ...selection, requestNumber, kind: 'analysis' };
  view.phase = 'loading';
  view.message = 'Готовим AI-разбор по публичным сведениям компании…';
  renderSelectedCompany();
  try {
    const result = await request('/api/ai/company-analysis', { method: 'POST', body: JSON.stringify({ instrumentUid, focus }) });
    if (state.companyPending?.requestNumber !== requestNumber) return;
    if (result.llmUsed !== true) throw new Error('AI-разбор не получен. Сохранённые факты доступны отдельно.');
    view.report = result;
    view.phase = 'success';
    view.message = 'AI-разбор получен. Сверяйте выводы с датами и источниками отчётности.';
    view.factsMessage = 'Показан AI-разбор. Сохранённые факты можно открыть отдельно.';
  } catch (error) {
    if (state.companyPending?.requestNumber === requestNumber) {
      view.phase = 'error';
      view.message = `AI-разбор не получен. ${error.message || 'Не удалось завершить запрос.'}`;
      if (companySelection().key === selection.key) showToast(view.message, true);
    }
  } finally {
    if (state.companyPending?.requestNumber === requestNumber) {
      state.companyPending = null;
      renderSelectedCompany();
      if (['success', 'error'].includes(view.phase) && companySelection().key === selection.key && state.currentView === 'ai') {
        const report = $('#aiReport');
        report.setAttribute('tabindex', '-1');
        report.focus({ preventScroll: true });
        report.scrollIntoView({ block: 'start', behavior: 'instant' });
        const topbar = $('.topbar')?.getBoundingClientRect?.();
        if (topbar && topbar.top <= 0 && topbar.bottom > 0) window.scrollBy({ top: -topbar.bottom - 16, behavior: 'instant' });
      }
    }
  }
}

function companySelection() {
  const instrumentUid = $('#aiInstrument').value;
  const focus = $('#aiFocus').value;
  return { instrumentUid, focus, key: JSON.stringify([instrumentUid, focus]) };
}

function companyView(selection = companySelection()) {
  state.companyViews ||= new Map();
  if (!state.companyViews.has(selection.key)) state.companyViews.set(selection.key, { phase: 'idle', message: '', factsMessage: '', report: null });
  return state.companyViews.get(selection.key);
}

function renderCompanyStatus() {
  const selection = companySelection();
  const view = companyView(selection);
  const pending = Boolean(state.companyPending);
  const factsAvailable = state.bootstrap?.capabilities?.companyFacts === true && Boolean(selection.instrumentUid);
  const availability = $('#aiAvailability');
  availability.textContent = view.message || state.companyAvailability?.message || 'Проверяем подключение модели…';
  availability.setAttribute('role', 'status');
  availability.setAttribute('aria-live', 'polite');
  availability.setAttribute('aria-atomic', 'true');
  $('#aiAnalyzeButton').disabled = pending || !factsAvailable || state.companyAvailability?.available !== true;
  $('#companyFactsButton').disabled = pending || !factsAvailable;
  $('#aiInstrument').disabled = pending;
  $('#aiFocus').disabled = pending;
  $('#companyFactsStatus').textContent = state.companyPending?.key === selection.key && state.companyPending.kind === 'facts'
    ? 'Загружаем сохранённые факты…' : view.factsMessage || 'Откройте факты выбранной компании.';
  $('#aiReport').setAttribute('aria-busy', String(pending && state.companyPending.key === selection.key));
}

function renderSelectedCompany() {
  const selection = companySelection();
  const view = companyView(selection);
  let notice = '';
  if (view.phase === 'loading' || view.phase === 'error') {
    const title = view.phase === 'loading' ? 'Готовим AI-разбор' : 'AI-разбор не получен';
    const retained = view.report ? view.report.llmUsed === true ? 'Ниже показан предыдущий AI-разбор.' : 'Ниже показаны сохранённые факты без AI.' : '';
    notice = `<section role="status" aria-live="polite"><h4>${title}</h4><p>${escapeText(view.message)} ${retained}</p></section>`;
  }
  if (view.report) renderCompanyReport(view.report, notice);
  else $('#aiReport').innerHTML = `<div class="ai-report-content">${notice || `<div class="empty-state"><h3>${selection.instrumentUid ? 'Компания выбрана' : 'Выберите компанию для разбора'}</h3><p>Нажмите «Показать сохранённые факты», чтобы открыть показатели и источники.</p></div>`}</div>`;
  renderCompanyStatus();
}

function renderCompanyAvailability(status) {
  state.companyAvailability = status || { state: 'not_configured', available: false, message: 'Модель для анализа компаний ещё не подключена. Сохранённые факты доступны без AI.' };
  renderCompanyStatus();
}

function safeCompanySourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}

function renderCompanyReport(report, notice = '') {
  const sources = Array.isArray(report.sources) ? report.sources.slice(0, 24) : [];
  const metrics = (Array.isArray(report.metrics) ? report.metrics : Array.isArray(report.facts) ? report.facts : []).slice(0, 40);
  const sections = (Array.isArray(report.sections) ? report.sections.slice(0, 16) : [])
    .filter((section) => !(report.llmUsed !== true && metrics.length && section.title === 'Сохранённые показатели'));
  const existingNotes = new Set(sections.flatMap((section) => section.items || []));
  const limitations = (report.limitations || []).filter((item) => !existingNotes.has(item)).slice(0, 20);
  const sourceRows = sources.map((source, index) => {
    const url = safeCompanySourceUrl(source.url);
    const title = source.title || `Источник ${index + 1}`;
    const dates = [source.asOf ? `Отчётность: ${formatDate(source.asOf)}` : 'Отчётная дата не указана', source.retrievedAt ? `Получено: ${formatDate(source.retrievedAt)}` : ''].filter(Boolean).join(' · ');
    return `<li>${url ? `<a href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">${escapeText(title)}</a>` : escapeText(title)}<small>${escapeText(dates)}</small></li>`;
  }).join('');
  const knownMetrics = metrics.filter((metric) => metric.value !== null && metric.value !== undefined);
  const metricValue = (value) => {
    if (value == null) return 'Нет данных';
    const text = String(value);
    if (!/^-?\d+(?:\.\d+)?$/u.test(text)) return text;
    const [whole, fraction] = text.split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ' ')}${fraction ? `,${fraction}` : ''}`;
  };
  const metricUnit = (unit) => ({ RUB: '₽', USD: '$', EUR: '€', CNY: '¥', PTS: 'п.', currency: 'ден. ед.', ratio: '×', shares: 'акций', units: 'ед.', years: 'лет', days: 'дн.' })[unit] || unit;
  const metricTable = (rows) => `<div class="table-scroll"><table class="company-metrics"><thead><tr><th>Показатель</th><th>Значение</th><th>Отчётный период</th></tr></thead><tbody>${rows.map((metric) => `<tr><th scope="row">${escapeText(metric.label || metric.key)}</th><td>${escapeText(metricValue(metric.value))}${metric.value != null && metric.unit ? ` ${escapeText(metricUnit(metric.unit))}` : ''}</td><td>${escapeText(metric.period || 'Период не указан')}</td></tr>`).join('')}</tbody></table></div>`;
  const metricSection = knownMetrics.length ? metricTable(knownMetrics.slice(0, 8)) : '<p class="empty-copy">Финансовые показатели компании пока не сохранены. Нужны данные отчётности с указанным периодом.</p>';
  const extraMetrics = metrics.filter((metric) => !knownMetrics.slice(0, 8).includes(metric));
  const sectionMarkup = sections.map((section) => `<section><h4>${escapeText(section.title)}</h4>${section.items?.length ? `<ul>${section.items.slice(0, 30).map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul>` : `<p>${escapeText(section.text || 'Данных недостаточно.')}</p>`}</section>`).join('');
  const metricMarkup = `${metricSection}${extraMetrics.length ? `<details class="company-extra-metrics"><summary>Остальные показатели: ${extraMetrics.length}</summary>${metricTable(extraMetrics)}</details>` : ''}`;
  $('#aiReport').innerHTML = `<div class="ai-report-content">${notice}<header><span class="analysis-label">${report.llmUsed === true ? 'AI-разбор публичных сведений' : 'Сохранённые факты · без AI'}</span><h3>${escapeText(report.title || 'Факты о компании')}</h3><p>${escapeText(report.dataAsOf ? `Отчётность на ${formatDate(report.dataAsOf)}` : 'Отчётная дата не указана в источнике.')}</p></header>${report.llmUsed === true ? sectionMarkup + metricMarkup : metricMarkup + sectionMarkup}${limitations.length ? `<section><h4>Что учитывать</h4><ul>${limitations.map((item) => `<li>${escapeText(item)}</li>`).join('')}</ul></section>` : ''}${sourceRows ? `<section><h4>Источники</h4><ol class="company-sources">${sourceRows}</ol></section>` : '<p class="surface-note">Источники финансовой отчётности пока не подключены. Показатели компании не рассчитаны.</p>'}</div>`;
}

async function loadCompanyFacts() {
  if (state.companyPending) return;
  const selection = companySelection();
  const { instrumentUid } = selection;
  if (!instrumentUid) { showToast('Выберите компанию, чтобы открыть факты.', true); return; }
  if (state.bootstrap?.capabilities?.companyFacts !== true) return;
  const view = companyView(selection);
  const requestNumber = ++state.companyRequest;
  state.companyPending = { ...selection, requestNumber, kind: 'facts' };
  renderCompanyStatus();
  try {
    const result = await request(`/api/ai/company-facts?instrumentUid=${encodeURIComponent(instrumentUid)}`);
    if (state.companyPending?.requestNumber !== requestNumber) return;
    view.report = { ...result, llmUsed: false };
    view.factsMessage = 'Показаны сохранённые факты. AI не использовался.';
    if (view.phase === 'success') { view.phase = 'idle'; view.message = ''; }
  } catch (error) {
    if (state.companyPending?.requestNumber === requestNumber) {
      view.factsMessage = error.message || 'Факты не загружены. Повторите попытку.';
      if (companySelection().key === selection.key) showToast(view.factsMessage, true);
    }
  } finally {
    if (state.companyPending?.requestNumber === requestNumber) {
      state.companyPending = null;
      renderSelectedCompany();
    }
  }
}

function bindUi() {
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.view, button)));
  $$('[data-go-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.goView)));
  $$('[data-system-section]').forEach((button) => button.addEventListener('click', () => {
    activateView('system', button);
    const labels = { subscription: 'Подписка', support: 'Поддержка', access: 'Доступы' };
    $('#systemTitle').textContent = labels[button.dataset.systemSection];
    mountServiceCenter(button.dataset.systemSection);
  }));
  $('[data-open-rail]').addEventListener('click', () => {
    document.body.classList.add('rail-open');
    $('[data-open-rail]').setAttribute('aria-expanded', 'true');
  });
  $('[data-close-rail]').addEventListener('click', () => {
    document.body.classList.remove('rail-open');
    $('[data-open-rail]').setAttribute('aria-expanded', 'false');
  });
  $('#navProductSwitcher')?.addEventListener('click', openProductSwitcher);
  $('#syncButton').addEventListener('click', startSync);
  $('#exportButton').addEventListener('click', () => {
    if (!runtimeAdapter) {
      showToast('Static fixture runtime is unavailable.', true);
      return;
    }
    runtimeAdapter.downloadStatisticsPercentCsv();
  });
  $('#identityStatus').addEventListener('click', openProfileSettings);
  $('#instrumentSelect').addEventListener('change', renderMarketChart);
  $('#marketInterval').addEventListener('change', renderMarketChart);
  $('#operationsPrevious').addEventListener('click', () => changeOperationPage(-1));
  $('#operationsNext').addEventListener('click', () => changeOperationPage(1));
  $('#riskCalculatorForm').addEventListener('submit', (event) => { event.preventDefault(); updateRiskCalculator(); });
  $('#riskCalculatorForm').elements.assetType.addEventListener('change', updateRiskCalculator);
  $$('[data-list-page]').forEach((button) => button.addEventListener('click', () => changeListPage(button.dataset.listPage, Number(button.dataset.pageDirection))));
  $('#holdingRange').addEventListener('change', () => {
    state.listPages.delete('efficiencyChart');
    renderAnalytics(analyticsDisplayData());
  });
  for (const [id, list] of [['holdingPositionState', 'efficiencyChart'], ['rankingPositionState', 'monthlyAssetChart']]) $('#' + id).addEventListener('change', () => {
    state.listPages.delete(list);
    renderAnalytics(analyticsDisplayData());
  });
  for (const id of ['overviewAccount', 'statisticsAccount']) $('#' + id).addEventListener('change', (event) => {
    state.analyticsAccount = event.target.value;
    state.listPages = new Map();
    renderPeriodViews();
  });
  $$('[data-range]').forEach((button) => button.addEventListener('click', () => {
    void selectStatisticsRange(({ '1m': 'month', '3m': 'quarter', '1y': 'year', all: 'all' })[button.dataset.range] || 'month');
  }));
  $$('.chart-toolbar [data-indicator]').forEach((button) => button.addEventListener('click', () => {
    const active = !button.classList.contains('active');
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    state.marketChart?.toggle(button.dataset.indicator, active);
  }));
  $$('.chart-toolbar [data-drawing]').forEach((button) => button.addEventListener('click', () => { state.marketChart?.beginDrawing(button.dataset.drawing); showToast(button.dataset.drawing === 'trend' ? 'Укажите две точки на графике.' : 'Укажите уровень на графике.'); }));
  $('#aiAnalyzeButton').addEventListener('click', generateAiReport);
  $('#companyFactsButton').addEventListener('click', loadCompanyFacts);
  $('#aiInstrument').addEventListener('change', renderSelectedCompany);
  $('#aiFocus').addEventListener('change', renderSelectedCompany);
  $('#connectButton').addEventListener('click', () => openCredentialCaptureDialog(state.connection?.connected ? 'replace' : 'connect'));
  $('#connectionPrimaryButton').addEventListener('click', () => openCredentialCaptureDialog('connect'));
  $('#replaceConnectionButton').addEventListener('click', () => openCredentialCaptureDialog('replace'));
  $('#connectionCheckButton').addEventListener('click', checkConnection);
  $('#firstSyncButton').addEventListener('click', startSync);
  $('#disconnectButton').addEventListener('click', () => {
    $('#disconnectError').textContent = '';
    $('#disconnectDialog').showModal();
  });
  $$('[data-close-capture]').forEach((button) => button.addEventListener('click', closeCredentialCaptureDialog));
  $$('[data-close-disconnect]').forEach((button) => button.addEventListener('click', () => $('#disconnectDialog').close()));
  $('#credentialCaptureForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!$('#captureConsent').checked) {
      $('#captureError').textContent = 'Подтвердите готовность ввода в системном окне Windows.';
      return;
    }
    const environment = $('#captureEnvironment').value;
    if (!['live', 'sandbox'].includes(environment)) {
      $('#captureError').textContent = 'Выберите доступную среду T‑Invest.';
      return;
    }
    if (state.captureAttempt) return;
    const attempt = { controller: new AbortController(), completed: false, timedOut: false };
    state.captureAttempt = attempt;
    const submitButton = $('#captureSubmitButton');
    submitButton.disabled = true;
    submitButton.textContent = 'Ожидаем ввод в Windows…';
    const deadline = setTimeout(() => { attempt.timedOut = true; attempt.controller.abort(); }, 330_000);
    $('#captureError').textContent = '';
    $('#captureProgress').textContent = 'Открываем системное окно Windows. Вставьте в него API-токен…';
    try {
      renderConnection(state.bootstrap, { phase: 'checking' });
      const captureResult = await request('/api/connection/capture', {
        method: 'POST',
        body: JSON.stringify({ environment, idempotencyKey: crypto.randomUUID() }),
        signal: attempt.controller.signal,
      });
      if (state.captureAttempt !== attempt) return;
      if (captureResult?.cancelled === true || captureResult?.status === 'cancelled') {
        const error = new Error('Ввод отменён в системном окне Windows.');
        error.code = 'CAPTURE_CANCELLED';
        throw error;
      }
      const connection = maskedConnectionStatus(captureResult);
      if (!connection.connected) {
        const error = new Error('Native credential capture did not return a connected status.');
        error.code = 'NATIVE_CREDENTIAL_CAPTURE_REQUIRED';
        throw error;
      }
      state.bootstrap = { ...state.bootstrap, connection };
      state.connection = connection;
      $('#captureProgress').textContent = 'Доступ только для чтения подтверждён; кабинет получил только защищённый статус подключения.';
      renderConnection(state.bootstrap, { phase: 'verified' });
      attempt.completed = true;
      closeCredentialCaptureDialog();
      showToast('Доступ к счёту только для чтения подтверждён. Запускаем первую синхронизацию.');
      await startSync();
    } catch (error) {
      if (state.captureAttempt !== attempt) return;
      const safeMessage = connectionErrorMessage(attempt.timedOut ? { code: 'NATIVE_CREDENTIAL_CAPTURE_TIMEOUT' } : error);
      $('#captureError').textContent = safeMessage;
      $('#captureProgress').textContent = '';
      renderConnection(state.bootstrap, { phase: 'error', errorMessage: safeMessage });
    } finally {
      clearTimeout(deadline);
      if (state.captureAttempt === attempt) {
        state.captureAttempt = null;
        submitButton.disabled = false;
        submitButton.textContent = state.captureDialogMode === 'replace' ? 'Открыть окно замены' : 'Открыть системное окно';
      }
    }
  });
  $('#disconnectForm').addEventListener('submit', (event) => { event.preventDefault(); void disconnectConnection(); });
  $('#credentialCaptureDialog').addEventListener('cancel', (event) => { event.preventDefault(); closeCredentialCaptureDialog(); });
  $('#credentialCaptureDialog').addEventListener('close', () => resetCredentialCaptureDialog({ reset: true }));
  $('#disconnectDialog').addEventListener('cancel', (event) => { event.preventDefault(); $('#disconnectDialog').close(); });
  $('#operationFilters').addEventListener('submit', (event) => { event.preventDefault(); applyOperationFilters(); });
  $('#statisticsPeriodForm').addEventListener('submit', (event) => { event.preventDefault(); applyStatisticsPeriod(); });
  $$('[data-stat-range]').forEach((button) => button.addEventListener('click', () => selectStatisticsRange(button.dataset.statRange)));

  initTermTooltips();
  initGlossary();
  initGlobalSearch();

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.body.classList.remove('rail-open');
      $('[data-open-rail]').setAttribute('aria-expanded', 'false');
    }
  });
}

export const FINANCIAL_TERMS = FEATURE_TERMS;
Object.assign(FINANCIAL_TERMS, {
  periodInstruments: {
    abbr: 'P&L', name: 'Инструменты периода', nameEn: 'Instrument contribution', category: 'Доходность и риск',
    summary: 'Список инструментов, которым можно отнести прибыль или убыток за выбранные даты. У каждого показаны денежный результат и доходность, если известна цена входа.',
    details: 'Для акций учитываются закрытые за период сделки с известной ценой входа и комиссии. Для фьючерсов учитывается полученная за период вариационная маржа. Это результат ваших операций по инструменту, а не изменение рыночной цены компании за период.',
    formula: 'Результат инструмента = атрибутируемая прибыль − атрибутируемые убытки − комиссии',
    variables: [{ name: 'Период', desc: 'Общий диапазон дат над статистикой' }, { name: 'Атрибуция', desc: 'Результат включается только когда его можно связать с конкретным инструментом' }],
    example: 'В выбранном месяце закрытая позиция принесла 3 000 ₽, комиссии составили 100 ₽. В списке будет результат +2 900 ₽. Он не означает, что рыночная цена акции выросла на 2 900 ₽.',
  },
  vm: {
    abbr: 'VM',
    name: 'Вариационная маржа',
    nameEn: 'Variation Margin',
    category: 'Фьючерсы и маржа',
    summary: 'Результат переоценки открытых фьючерсных позиций во время клиринга по действующему расписанию биржи.',
    details: 'В отличие от акций, где результат сделки фиксируется при закрытии, биржа рассчитывает промежуточную прибыль или убыток по фьючерсам во время клиринга. Точное расписание следует проверять у биржи и брокера.',
    formula: 'VM = (P_текущая - P_расчётная) × (Стоимость_шага / Цена_шага) × Количество_лотов',
    variables: [
      { name: 'P_текущая', desc: 'Текущая расчётная цена котировки фьючерсного контракта на бирже' },
      { name: 'P_расчётная', desc: 'Цена предыдущего клиринга (или цена открытия позиции)' },
      { name: 'Стоимость_шага', desc: 'Денежная стоимость минимального изменения цены (в рублях)' },
      { name: 'Цена_шага', desc: 'Минимальный шаг цены инструмента (например, 1 или 10 пунктов)' },
      { name: 'Количество_лотов', desc: 'Число контрактов в портфеле (для шорт-позиций результат инвертируется)' }
    ],
    example: 'Покупка 2 контрактов фьючерса на индекс Мосбиржи (цена шага 10 п., стоимость шага 15 ₽). Рост котировки с 3200 до 3250 п. даёт VM = (3250 - 3200) / 10 × 15 × 2 = +1 500 ₽ начислений на баланс.',
  },
  profitFactor: {
    abbr: 'PF',
    name: 'Профит-фактор',
    nameEn: 'Profit Factor',
    category: 'Доходность и риск',
    summary: 'Отношение суммарной прибыли от прибыльных сделок к суммарному убытку от убыточных сделок.',
    details: 'Показатель помогает сравнить валовую прибыль и валовый убыток, но сам по себе не доказывает устойчивость стратегии. Его нужно оценивать вместе с числом сделок, просадкой, комиссиями и периодом наблюдения.',
    formula: 'Profit Factor = Валовая прибыль / |Валовый убыток|',
    variables: [
      { name: 'Валовая прибыль', desc: 'Сумма всей зафиксированной прибыли по закрытым сделкам (> 0 ₽)' },
      { name: 'Валовый убыток', desc: 'Модуль суммы всех зафиксированных убытков по закрытым сделкам (< 0 ₽)' }
    ],
    example: 'Если за месяц сумма прибыльных сделок составила 180 000 ₽, а сумма убыточных — 60 000 ₽, то Profit Factor = 180 000 / 60 000 = 3.0 (высокая эффективность).',
  },
  winRate: {
    abbr: 'WR',
    name: 'Винрейт (Доля прибыльных сделок)',
    nameEn: 'Win Rate',
    category: 'Сделки и исполнение',
    summary: 'Процент закрытых сделок, принесших положительный доход, от общего количества сделок.',
    details: 'Отражает точность входов в рынок. Даже при Win Rate 40% стратегия может быть прибыльной, если средняя прибыль на сделку существенно превышает средний убыток.',
    formula: 'Win Rate = (Количество прибыльных сделок / Всего закрытых сделок) × 100%',
    variables: [
      { name: 'Количество прибыльных', desc: 'Число сделок с чистым финансовым результатом строго больше 0 ₽' },
      { name: 'Всего закрытых', desc: 'Общее число завершённых торговых циклов за выбранный период' }
    ],
    example: 'Из 50 закрытых сделок 32 закрылись в плюс. Win Rate = (32 / 50) × 100% = 64%.',
  },
  drawdown: {
    abbr: 'Max DD',
    name: 'Максимальная просадка',
    nameEn: 'Maximum Drawdown',
    category: 'Доходность и риск',
    summary: 'Наибольшее падение стоимости капитала от исторического пика до локального минимума.',
    details: 'Показывает максимальный риск потерь, с которым инвестор столкнулся за анализируемый период, до момента достижения нового пика капитала.',
    formula: 'Max Drawdown = ((Пик баланса - Дно просадки) / Пик баланса) × 100%',
    variables: [
      { name: 'Пик баланса', desc: 'Максимальное значение капитала портфеля до начала падения' },
      { name: 'Дно просадки', desc: 'Минимальное значение портфеля до восстановления к новому пику' }
    ],
    example: 'Портфель вырос до 1 000 000 ₽, затем снизился до 850 000 ₽, после чего пошёл в рост. Просадка составила (1 000 000 - 850 000) / 1 000 000 = 15%.',
  },
  netReturn: {
    abbr: 'Net %',
    name: 'Доходность после комиссий',
    nameEn: 'Net Return',
    category: 'Доходность и риск',
    summary: 'Изменение сохранённой стоимости портфеля за выбранный период после исключения внешних денежных потоков.',
    details: 'Удержанные комиссии уже отражены в стоимости счёта и повторно не вычитаются. Показатель доступен при полной истории денежных потоков и оценках на границах периода. Это простая доходность к начальному капиталу, не TWR и не IRR.',
    formula: 'Net Return = ((Капитал_конец - Капитал_начало - Пополнения + Выводы) / Начальный_капитал) × 100%',
    variables: [
      { name: 'Капитал_конец / начало', desc: 'Оценка стоимости портфеля на конец и начало выбранного периода' },
      { name: 'Пополнения / Выводы', desc: 'Денежные потоки на брокерский счёт, исключаемые из торгового результата' },
      { name: 'Комиссии', desc: 'Сумма удержанных брокером и биржей сборов за операции' }
    ],
    example: 'При начальном балансе 500 000 ₽ и доходе 60 000 ₽, если брокер удержал 4 500 ₽ комиссий, чистый результат равен 55 500 ₽, а Net Return = 11.1%.',
  },
  fees: {
    abbr: 'Fees',
    name: 'Комиссии',
    nameEn: 'Broker and Exchange Fees',
    category: 'Базовые метрики портфеля',
    summary: 'Явно переданные брокером и биржей удержания, сохранённые в локальной истории операций.',
    details: 'Workspace не подставляет приблизительные комиссии и не включает налоги или иные списания без подтверждённого поля источника.',
    formula: 'Комиссии = сумма подтверждённых комиссионных операций за выбранный период',
    variables: [
      { name: 'Комиссионная операция', desc: 'Отдельное списание, которое источник явно пометил как комиссию брокера или биржи' },
      { name: 'Период', desc: 'Интервал сохранённых операций, использованный для расчёта' }
    ],
    example: 'Если источник передал комиссии 120 ₽ и 80 ₽, Workspace покажет 200 ₽. Неподтверждённые сборы не добавляются.',
  },
  grossReturn: {
    abbr: 'Gross %',
    name: 'Доходность до комиссий',
    nameEn: 'Gross Return',
    category: 'Доходность и риск',
    summary: 'Доходность к начальному капиталу до вычета явно сохранённых комиссий за тот же период.',
    details: 'К чистому изменению стоимости возвращаются комиссии, уже удержанные брокером. Если валюта комиссии отличается и её курс неизвестен, общий показатель не строится.',
    formula: 'Gross Return = (Чистый результат + Явные комиссии) / Начальный капитал × 100%',
    variables: [
      { name: 'Валовый фин. результат', desc: 'Суммарный доход от изменения рыночных цен активов' },
      { name: 'Начальный капитал', desc: 'Стоимость портфеля на старте периода' }
    ],
    example: 'Прибыль от движения акций 60 000 ₽ на капитал 500 000 ₽ даёт Gross Return = 12.0%.',
  },
  volatility: {
    abbr: 'Vol',
    name: 'Волатильность портфеля',
    nameEn: 'Portfolio Volatility',
    category: 'Доходность и риск',
    summary: 'Разброс изменений стоимости между сопоставимыми сохранёнными оценками внутри выбранного периода.',
    details: 'Пополнения и выводы исключаются. Нужны минимум три оценки через одинаковые интервалы. Значение показывается за интервал наблюдения и не пересчитывается в годовую ставку.',
    formula: 'σ = √( (1 / (N - 1)) × ∑(R_i - R_среднее)² )',
    variables: [
      { name: 'R_i', desc: 'Изменение стоимости за один интервал с исключением внешних денежных потоков' },
      { name: 'R_среднее', desc: 'Среднее изменение стоимости по сопоставимым интервалам' },
      { name: 'N', desc: 'Количество интервалов между сохранёнными оценками' }
    ],
    example: 'Если оценки сохранялись раз в день, волатильность 2% описывает разброс дневных изменений внутри выбранного периода. Она не означает доходность 2% или прогноз на год.',
  },
  fifoRealized: {
    abbr: 'FIFO P&L',
    name: 'Реализованный P&L (FIFO)',
    nameEn: 'Realized FIFO P&L',
    category: 'Сделки и исполнение',
    summary: 'Фактическая прибыль от закрытых позиций по акциям, рассчитанная методом First In, First Out.',
    details: 'При частичной продаже пакета акций первыми списываются те лоты, которые были куплены раньше всего по соответствующей цене приобретения.',
    formula: 'P&L_FIFO = ∑ (Цена_продажи - Цена_ранней_покупки) × Лоты - Комиссии',
    variables: [
      { name: 'Цена_ранней_покупки', desc: 'Цена лотов из самых первых по времени открытых покупок' },
      { name: 'Цена_продажи', desc: 'Фактическая цена исполнения закрывающей сделки' }
    ],
    example: 'Купили 10 акций по 100 ₽, затем 10 акций по 120 ₽. При продаже 10 акций по 140 ₽ списывается первая партия (по 100 ₽): прибыль (140 - 100) × 10 = +400 ₽.',
  },
  unrealizedPnl: {
    abbr: 'Paper P&L',
    name: 'Нереализованный P&L',
    nameEn: 'Unrealized (Mark-to-Market) P&L',
    category: 'Базовые метрики портфеля',
    summary: 'Текущая плавающая прибыль или убыток по незакрытым позициям, оцениваемая по последней рыночной цене.',
    details: 'Пока позиция не закрыта, этот результат остаётся бумажным и может измениться вместе с рынком в любой момент.',
    formula: 'Unrealized P&L = (Текущая цена Mark - Средняя цена покупки) × Количество лотов',
    variables: [
      { name: 'Текущая цена Mark', desc: 'Последняя цена сделки или средняя между лучшим спросом и предложением' },
      { name: 'Средняя цена покупки', desc: 'Средневзвешенная цена приобретения удерживаемой позиции' }
    ],
    example: 'Удержание 100 акций Сбербанка со средней ценой 280 ₽ при текущей котировке 295 ₽ даёт нереализованную прибыль (295 - 280) × 100 = +1 500 ₽.',
  },
  guaranteeMargin: {
    abbr: 'ГО',
    name: 'Гарантийное обеспечение (ГО)',
    nameEn: 'Initial / Maintenance Margin',
    category: 'Фьючерсы и маржа',
    summary: 'Залог, который биржа блокирует на счёте инвестора при открытии фьючерсного контракта.',
    details: 'Размер ГО устанавливается биржей исходя из риска актива и составляет обычно от 8% до 25% от полной стоимости базового актива контракта.',
    formula: 'ГО = Базовое_ГО_биржи × Коэффициент_риска_брокера × Число_контрактов',
    variables: [
      { name: 'Базовое ГО биржи', desc: 'Минимальный гарантийный залог, регламентированный Мосбиржей' },
      { name: 'Число контрактов', desc: 'Количество лотов открытых фьючерсных позиций' }
    ],
    example: 'При стоимости базового актива 100 000 ₽ биржа может заблокировать ГО всего 15 000 ₽, предоставляя встроенное кредитное плечо.',
  },
  liquidPortfolio: {
    abbr: 'Ликвидность',
    name: 'Стоимость ликвидного портфеля',
    nameEn: 'Liquid Portfolio Value',
    category: 'Базовые метрики портфеля',
    summary: 'Суммарная стоимость денежных средств и высоколиквидных ценных бумаг с учётом дисконтов риска.',
    details: 'Определяет фактическую финансовую обеспеченность инвестора, доступную для покрытия обязательств по маржинальным сделкам.',
    formula: 'Ликвидный портфель = Свободные рубли + ∑ (Стоимость_активов × (1 - Дисконт_риска))',
    variables: [
      { name: 'Свободные рубли', desc: 'Остаток свободных денег на брокерском счёте' },
      { name: 'Дисконт риска', desc: 'Процент понижения стоимости ценных бумаг, устанавливаемый клиринговым центром' }
    ],
    example: '100 000 ₽ на счёте + акции на 300 000 ₽ с дисконтом 20% дают ликвидный портфель = 100 000 + 240 000 = 340 000 ₽.',
  },
  marginBuffer: {
    abbr: 'Запас маржи',
    name: 'Запас относительно начальной маржи',
    nameEn: 'Initial Margin Surplus',
    category: 'Фьючерсы и маржа',
    summary: 'Разница между ликвидным портфелем и начальной маржей по свежим данным брокера в рублях; отрицательный результат показывается как 0 ₽.',
    details: 'Расчёт показывает превышение обеспечения над начальной маржей. Он не определяет порог margin call или принудительного закрытия; эти условия устанавливает брокер.',
    formula: 'Запас = max(0, Ликвидный портфель − Начальная маржа)',
    variables: [
      { name: 'Ликвидный портфель', desc: 'Текущий размер обеспечения с учётом рыночной переоценки' },
      { name: 'Начальная маржа', desc: 'Обеспечение, требуемое брокером для открытия позиций' }
    ],
    example: 'При ликвидном портфеле 250 000 ₽ и начальной марже 180 000 ₽ запас относительно начальной маржи равен 70 000 ₽.',
  }
});

function initTermTooltips() {
  const popover = $('#termPopover');
  if (!popover) return;
  $$('.term-help').forEach((button) => {
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-describedby', 'termPopover');
  });
  let activeHelpBtn = null;
  let hideTimer = null;

  function closeTooltip({ immediate = false } = {}) {
    clearTimeout(hideTimer);
    const close = () => {
      popover.classList.remove('visible');
      popover.hidden = true;
      activeHelpBtn?.setAttribute('aria-expanded', 'false');
      activeHelpBtn = null;
    };
    if (immediate) close();
    else hideTimer = setTimeout(close, 120);
  }

  function showTooltip(button) {
    clearTimeout(hideTimer);
    if (activeHelpBtn && activeHelpBtn !== button) activeHelpBtn.setAttribute('aria-expanded', 'false');
    activeHelpBtn = button;
    const termKey = button.dataset.term;
    const term = FINANCIAL_TERMS[termKey];
    const evidenceNote = button.dataset.evidenceNote;
    if (!term && !evidenceNote) return;

    popover.innerHTML = evidenceNote ? `<div class="term-popover-header"><strong>О данных расчёта</strong></div><p class="term-popover-desc">${escapeText(evidenceNote)}</p>` : `
      <div class="term-popover-header">
        <div class="term-popover-title">
          <strong>${escapeText(term.name)}</strong>
          ${term.nameEn && term.nameEn.toLocaleLowerCase() !== term.name.toLocaleLowerCase() ? `${term.nameEn && term.nameEn.toLocaleLowerCase() !== term.name.toLocaleLowerCase() ? `<small>${escapeText(term.nameEn)}</small>` : ''}` : ''}
        </div>
        ${term.abbr && term.abbr.length <= 12 && ![term.name,term.nameEn].some(value=>String(value).toLocaleLowerCase()===term.abbr.toLocaleLowerCase()) ? `<span class="term-popover-badge">${escapeText(term.abbr)}</span>` : ''}
      </div>
      <p class="term-popover-desc">${escapeText(term.summary)}</p>
${term.formula?.trim() ? `<div class="term-popover-formula">${escapeText(term.formula)}</div>` : ''}
${term.variables?.length ? `<div class="term-popover-vars">${term.variables.map((v) => `<div><b>${escapeText(v.name)}:</b> ${escapeText(v.desc)}</div>`).join('')}</div>` : ''}
      <div class="term-popover-example">
        <strong>Пример расчёта:</strong>
        ${escapeText(term.example)}
      </div>
    `;

    popover.hidden = false;
    popover.classList.add('visible');
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-describedby', 'termPopover');

    const rect = button.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left - (popoverRect.width / 2) + (rect.width / 2);

    if (top + popoverRect.height > window.innerHeight - 10) {
      top = Math.max(10, rect.top - popoverRect.height - 8);
    }
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popoverRect.width - 10;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  document.addEventListener('pointerover', (e) => {
    const btn = e.target.closest('.term-help');
    if (btn) showTooltip(btn);
    else if (popover.contains(e.target)) clearTimeout(hideTimer);
    else if (activeHelpBtn && document.activeElement !== activeHelpBtn) closeTooltip();
  });

  document.addEventListener('pointerout', (e) => {
    if (e.target.closest('.term-help') && document.activeElement !== activeHelpBtn) closeTooltip();
  });

  document.addEventListener('focusin', (e) => {
    const button = e.target.closest?.('.term-help');
    if (button) showTooltip(button);
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.closest?.('.term-help') && !popover.contains(e.relatedTarget)) closeTooltip();
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.term-help');
    if (btn) {
      e.stopPropagation();
      showTooltip(btn);
    } else if (!popover.contains(e.target)) {
      closeTooltip({ immediate: true });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeHelpBtn) closeTooltip({ immediate: true });
  });
  window.addEventListener('resize', () => closeTooltip({ immediate: true }));
  window.addEventListener('scroll', () => {
    if (activeHelpBtn && document.activeElement === activeHelpBtn) showTooltip(activeHelpBtn);
    else closeTooltip({ immediate: true });
  }, true);
}

function renderGlossary() {
  const grid = $('#glossaryGrid');
  const countEl = $('#glossaryCount');
  if (!grid) return;

  const category = state.glossaryCategory || 'all';
  const filter = (state.glossaryFilter || '').trim().toLocaleLowerCase('ru');

  const terms = Object.entries(FINANCIAL_TERMS).filter(([key, term]) => {
    if (category !== 'all' && term.category !== category) return false;
    if (filter) {
      const match = [term.abbr, term.name, term.nameEn, term.summary, term.formula, term.example]
        .some((val) => String(val || '').toLocaleLowerCase('ru').includes(filter));
      if (!match) return false;
    }
    return true;
  });

  if (countEl) countEl.textContent = `${terms.length} ${terms.length === 1 ? 'термин' : terms.length < 5 ? 'термина' : 'терминов'}`;

  if (terms.length === 0) {
    grid.innerHTML = '<p class="empty-copy">Ничего не найдено по данному запросу.</p>';
    return;
  }

  grid.innerHTML = terms.map(([key, term]) => `
    <article class="term-card">
      <header class="term-card-header">
        <div class="term-card-title">
          <h3>${escapeText(term.name)}</h3>
          ${term.nameEn && term.nameEn.toLocaleLowerCase() !== term.name.toLocaleLowerCase() ? `<small>${escapeText(term.nameEn)}</small>` : ''}
        </div>
        ${term.abbr && term.abbr.length <= 12 && ![term.name,term.nameEn].some(value=>String(value).toLocaleLowerCase()===term.abbr.toLocaleLowerCase()) ? `<span class="term-popover-badge">${escapeText(term.abbr)}</span>` : ''}
      </header>
      <p class="term-card-desc">${escapeText(term.summary)}</p>
<details class="term-card-details"><summary>${term.formula?.trim() ? 'Формула и пример' : 'Подробнее'}</summary>
${term.formula?.trim() ? `<div class="term-card-formula">${escapeText(term.formula)}</div>` : ''}
${term.variables?.length ? `<div class="term-popover-vars">${term.variables.map((v) => `<div><b>${escapeText(v.name)}:</b> ${escapeText(v.desc)}</div>`).join('')}</div>` : ''}
      <div class="term-card-example">
        <strong>Пример:</strong>
        ${escapeText(term.example)}
      </div>
      </details>
    </article>
  `).join('');
}

function initGlossary() {
  $$('[data-glossary-cat]').forEach((btn) => btn.addEventListener('click', () => {
    state.glossaryCategory = btn.dataset.glossaryCat;
    $$('[data-glossary-cat]').forEach((b) => {
      const active = b === btn;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    renderGlossary();
  }));

  $('#glossaryInlineSearch')?.addEventListener('input', (e) => {
    state.glossaryFilter = e.target.value;
    renderGlossary();
  });
}

function initGlobalSearch() {
  const input=$('#globalSearch'),list=$('#globalSearchResults');if(!input||!list)return;
  let rows=[],active=-1;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const choose=index=>{
    const row=rows[index];if(!row)return;
    close();activateView(row.view);
    if(row.term){state.glossaryFilter=FINANCIAL_TERMS[row.term]?.name||row.title;state.glossaryCategory='all';$('#glossaryInlineSearch').value=state.glossaryFilter;
      $$('[data-glossary-cat]').forEach(b=>{const selected=b.dataset.glossaryCat==='all';b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});renderGlossary();
    } else if(row.instrumentUid)state.marketCalendarUi?.openCatalogInstrument(row.instrumentUid);
    requestAnimationFrame(()=>{const target=row.target&&document.getElementById(row.target);if(target){target.scrollIntoView({block:'start'});if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true});}});
  };
  const mark=index=>{active=(index+rows.length)%rows.length;[...list.querySelectorAll('[data-search-index]')].forEach((button,i)=>button.setAttribute('aria-selected',String(i===active)));
    const selected=list.querySelector('[data-search-index="'+active+'"]');if(selected){input.setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});}};
  input.addEventListener('input',()=>{
    const pages=[...document.querySelectorAll('.view h2,.view h3,.view label')].filter(el=>!el.closest('[data-view-panel="glossary"]')).map((el,i)=>{
      const view=el.closest('[data-view-panel]')?.dataset.viewPanel;const title=(el.querySelector('span')?.textContent||el.childNodes[0]?.textContent||el.textContent).trim();
      if(!el.id)el.id='search-surface-'+i;return{id:el.id,title,view,target:el.id,kind:'На экране',search:''};
    }).filter(row=>row.title&&row.title.length<100);
    rows=searchProduct(input.value,{terms:FINANCIAL_TERMS,catalog:state.marketCalendarUi?.getCatalog()||[],pages});
    if(!input.value.trim()){close();return;}
    active=-1;input.removeAttribute('aria-activedescendant');
    list.innerHTML=rows.map((row,i)=>'<button type="button" role="option" tabindex="-1" aria-selected="false" id="search-result-'+i+'" data-search-index="'+i+'"><strong>'+escapeText(row.title)+'</strong><small>'+escapeText(row.kind)+'</small></button>').join('')||'<p>Ничего не найдено. Попробуйте название раздела, термин или тикер.</p>';
    list.hidden=false;input.setAttribute('aria-expanded','true');
  });
  list.addEventListener('click',event=>{const button=event.target.closest('[data-search-index]');if(button)choose(Number(button.dataset.searchIndex));});
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();return;}
    if(!list.hidden&&rows.length&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){event.preventDefault();if(event.key==='Enter')choose(active<0?0:active);else mark(active+(event.key==='ArrowDown'?1:-1));}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('.topbar-search'))close();});
  window.addEventListener('keydown',event=>{if(event.defaultPrevented || event.composedPath().some(node=>node?.matches?.('input,textarea,select,[contenteditable="true"]')))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();input.focus();input.select();}});
}

bindUi();
globalThis.nexusProduct?.onNavigate?.(view => { if (['settings','profile'].includes(view)) activateView(view); });
$('#workspaceTheme').addEventListener('change', event => applyInvestTheme(event.currentTarget.value));
await loadBootstrap();
$('#marketVisionRefresh').addEventListener('click', () => void refreshMarketVision(true));
state.tradingPlanUi = initTradingPlan({ request, showToast, getBootstrap: () => state.bootstrap });
await state.tradingPlanUi.refresh();
state.marketCalendarUi=initMarketCalendar({
  request,getBootstrap:()=>state.bootstrap,showToast,
  onChartSelect:instrument=>{
    if(!instrument)return;
    state.marketInstrument=instrument;
    renderInstruments(state.bootstrap);
    $('#instrumentSelect').value=instrument.instrumentUid;
    void renderMarketChart();
    $('#marketChart').scrollIntoView({block:'center'});
  },
  refreshPortfolio:async()=>{
    const version=state.periodRequest;
    await request('/api/portfolio/refresh',{method:'POST',body:'{}'});
    const data=await request('/api/bootstrap?'+periodQuery());
    if(version!==state.periodRequest || state.periodLoading)return;
    state.session={csrfToken:data.csrfToken};
    renderBootstrap(data);
    if(state.currentView==='instruments')void renderMarketChart();
  }
});
for (const button of $$('[data-analytics-unit]')) button.addEventListener('click', () => { state.analyticsChartMode = button.dataset.analyticsUnit; renderAnalyticsChartOnView(); });
const personalAvailable=(!runtimeAdapter || state.bootstrap?.preview?.interactiveTutorial===true) && state.bootstrap?.preview?.localReview!==true;
if(personalAvailable) { $('#personalSettings').hidden=false; state.personalUi = initWorkspacePreferences({ request, showToast, onPresentation:applyPresentation }); }
else $('#personalSettings').hidden = true;
if (!runtimeAdapter) initPriceAlerts({ request, readOnly: state.bootstrap?.preview?.localReview === true, showToast: (message, error) => showToast(message, error), activateView });
openStream();
// GitHub Pages fixture intentionally has no service worker.

function applyPresentation(preferences) {
  state.language=preferences.language||'ru';state.displayCurrency=preferences.displayCurrency||'RUB';
  setLanguage(state.language);
  setChartPresentation({language:state.language,displayCurrency:state.displayCurrency,rates:state.bootstrap?.displayFx?.rates||{}});
  if(state.bootstrap) { renderPeriodViews(); renderOperations({operations:state.operationRows},{page:state.operationPage}); }
  const fx=state.bootstrap?.displayFx?.rates?.USD;
  $('#displayCurrencyNote').textContent=state.displayCurrency==='USD'
    ? fx?`${fx.source==='fixture'?ui('Учебный курс на'):ui('Показ сумм по курсу ЦБ на')} ${fx.date}. ${ui('Котировки — в валюте инструмента. Проценты — в рублях.')}`:ui('Нет сохранённого курса USD. Обновите данные: непересчитанные суммы отмечены прочерком.')
    :ui('Суммы портфеля и результатов — в рублях. Котировки — в валюте инструмента.');
  if(state.displayCurrency==='USD' && !state.fxRequested && !state.bootstrap?.preview?.static) {
    state.fxRequested=true;
    void request('/api/display-fx/refresh',{method:'POST',body:'{}'}).then(value=>{
      state.bootstrap.displayFx=value;
      applyPresentation({language:state.language,displayCurrency:state.displayCurrency});
    }).catch(()=>{ $('#displayCurrencyNote').textContent=ui('Курс ЦБ сейчас недоступен. Показан последний сохранённый курс; без курса суммы отмечены прочерком.'); });
  }
}
connectTableSort($('#positionsBody').closest('table'),['name','type','openedAt','quantityNanos','averagePriceNanos','positionValueNanos','share','dayPnlNanos','totalPnlNanos'],sort=>{state.sorts.positions=sort;renderPortfolio(analyticsDisplayData());});
connectTableSort($('#operationsBody').closest('table'),['occurredAt','name','type','quantityNanos','paymentNanos','commissionNanos','state'],sort=>{state.sorts.operations=sort;renderOperations({operations:state.operationRows});});
connectTableSort($('#closedPositionsBody').closest('table'),['name','type','entryPriceNanos','closedAt','quantityNanos','positionCostNanos','pnlNanos'],sort=>{state.sorts.closed=sort;state.listPages.delete('closedPositions');renderClosedPositions(analyticsDisplayData());});
connectTableSort($('#tradingPlanBody').closest('table'),['name','direction','allocationRate','entryPriceNanos','exitPriceNanos','expectedHold'],sort=>{state.sorts.plan=sort;state.listPages.delete('tradingPlan');renderRiskPlan(analyticsDisplayData());});
startTranslation();
