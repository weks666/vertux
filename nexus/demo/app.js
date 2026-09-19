import {tbankIcon} from './brand-icons.js';
import { sortRows, connectTableSort } from './table-sort.js';
import { filterLedgerRows, validDateRange, sumMoneyByCurrency, summarizeOperationFees, relativeBarWidth, createFilterScheduler } from './analytics-filters.js';
import { money, decimalNanos, positionQuantity, convertNanos } from './number-format.js';
import { instrumentMark, issuerName, watchInstrumentImages } from './instrument-mark.js';
import { ui, setLanguage, startTranslation } from './ui-language.js';
import { createWorkspaceNavigation } from './account-module/v1.3.0/workspace-navigation.js';
import { initWorkspacePreferences } from './personal-workspace.js';
import { FEATURE_TERMS, searchProduct } from './product-features.js';
import { initMarketCalendar } from './market-calendar.js';
import { createEquityChart, createMarketChart, createAnalyticsReturnChart, normalizeEquityPoints, normalizeMarketCandles, setChartPresentation } from './charts.js';
import { runtimeAdapter } from './demo-runtime.js';
import { initPriceAlerts } from './price-alerts.js';
import { calculateRiskDraft } from './risk-calculator.js';
import { initTradingPlan } from './trading-plan-ui.js';
import { initLedgerTabs, metricNote, signedClass, resultTrend } from './reference-ui.js';
import { glossaryEntries, glossaryMarkup, initRiskTabs } from './knowledge-workspace.js';
import { orderAccounts, readAccountPins, writeAccountPins, dailyPositionSummary } from './account-layout.js';

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
  companyTab: 'facts',
  companyFacts: new Map(),
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatMoney(value, currency = 'RUB', { native = false } = {}) {
  return money(value,currency,{locale:state.language,target:native?currency:state.displayCurrency,rates:state.bootstrap?.displayFx?.rates});
}
function signedMoney(value,currency='RUB') {
  const formatted=formatMoney(value,currency);
  return value!=null && BigInt(value)>0n && formatted!=='—' ? '+'+formatted : formatted;
}
function formatQuantity(value) { return decimalNanos(value,{digits:9,locale:state.language}); }
function quoteMoney(value,currency) { return formatMoney(value,currency,{native:true}); }
function positionShare(row,data=state.bootstrap) {
  // Futures use the same denominator, but are explicitly labelled as exposure.
  if(row.positionValueNanos==null)return null;
  const total=data?.portfolio?.currentTotalNanos??data?.portfolio?.totalNanos;
  const value=convertNanos(row.positionValueNanos,row.positionValueCurrency||row.priceCurrency,'RUB',data?.displayFx?.rates);
  return value!=null&&total!=null&&BigInt(total)>0n?Number(BigInt(value)*1000000n/BigInt(total))/1000000:null;
}
const positionReaders={name:r=>instrumentDisplay(r).ticker||instrumentDisplay(r).name,type:r=>r.assetType+':'+r.direction,openedAt:r=>r.openedAt?Date.parse(r.openedAt):null,quantityNanos:r=>r.quantityNanos==null?null:BigInt(r.quantityNanos)<0n?-BigInt(r.quantityNanos):BigInt(r.quantityNanos),averagePriceNanos:r=>r.entryPriceNanos??r.averagePriceNanos,share:r=>positionShare(r,analyticsDisplayData())};

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
  const amount = signedMoney(amountNanos, currency);
  const percent = formatPercentage(rate, { signed: true });
  return `<strong>${escapeText(amount)}</strong><small class="return-rate">${escapeText(percent)}</small>`;
}

function formatDate(value, withSeconds = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat(state.language==='en'?'en-GB':'ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: withSeconds ? '2-digit' : undefined }).format(date)} ${state.language==='en'?'MSK':'мск'}`;
}

function formatShortDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(state.language === 'en' ? 'en-GB' : 'ru-RU', {timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
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
  $('#captureEnvironment').value = 'live';
  $('#credentialCaptureDialog').showModal();
  requestAnimationFrame(() => $('#captureConsent').focus());
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
  const viewChanged = state.currentView !== view;
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
  if (viewChanged) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    $('#mainContent').scrollTop = 0;
  }
  if (view === 'instruments') requestAnimationFrame(renderMarketChart);
  if (view === 'overview') requestAnimationFrame(renderEquityChart);
  if (view === 'analytics') { requestAnimationFrame(renderAnalyticsChartOnView); void refreshMarketVision(); }
  if (view === 'glossary') requestAnimationFrame(renderGlossary);
  if (view === 'ai') { renderSelectedCompany(); void ensureCompanyFacts(); }
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
    await import('./account-module/v1.3.0/vertux-account-center.js');
    if (state.currentView !== section) return;
    if (!accountCenter) {
      accountCenter = document.createElement('vertux-account-center');
      accountCenter.workspaceNavigation=workspaceNavigation;
      $('#personalSettings').hidden = false;
      $('#personalSettings').slot = 'workspace-settings';
      accountCenter.append($('#personalSettings'));
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
  primary.hidden = connected || !local;
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
  connectButton.hidden = !local;
  connectButton.textContent = connected ? 'Заменить через Windows' : staticPreview ? 'Подключение недоступно в веб-просмотре' : fixture ? 'Подключение недоступно в учебном режиме' : 'Подключить через Windows';
  if (local && !connected) $('#syncButton').disabled = true;
}

function renderQuality(data) {
  const quality = data.quality || {};
  const issue=quality.error||quality.stale;
  $('#dataStateStatus').hidden=!issue||data.environment==='fixture';
  $('#dataStateStatus').textContent=quality.error?'Не удалось обновить данные · Синхронизация':quality.stale?'Данные устарели · Синхронизация':'';
  $('#qualitySource').textContent = quality.source || (data.environment === 'fixture' ? 'Учебный источник' : 'Источник ещё не подключён');
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

function renderAccountCards(data) {
  const scope = String(state.bootstrap?.identity?.preferenceScope || 'local');
  const pins = readAccountPins(localStorage, scope);
  const rows = orderAccounts((data.clientProduct?.portfolios || []).map(row => ({...row, id:row.preferenceKey || row.id})), pins);
  const host = $('#portfolioCards');
  const expanded = host.querySelector('details')?.open || false;
  const signature = JSON.stringify([rows, pins, state.language, state.displayCurrency, data.displayFx, data.portfolio?.totalNanos]);
  if (host.accountSignature === signature) return;
  host.accountSignature = signature;
  const focusedPin = host.contains(document.activeElement) ? document.activeElement.dataset.pinAccount : null;
  const card = row => `<div class="portfolio-row">
    <span class="account-card-name" title="${escapeText(formatDate(row.asOf))}"><i class="account-dot" aria-hidden="true"></i><strong>${escapeText(row.label)}</strong><button type="button" class="account-pin" data-pin-account="${escapeText(row.id)}" aria-pressed="${pins.includes(row.id)}" aria-label="${pins.includes(row.id) ? 'Открепить' : 'Закрепить'} счёт: ${escapeText(row.label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3 6 0-1 6 4 4v2h-5v6l-1-2-1 2v-6H6v-2l4-4-1-6Z"/></svg></button></span>
    <span class="numeric"><strong>${escapeText(formatMoney(row.valueNanos, row.currency || 'RUB'))}</strong><small>${escapeText(formatPercentage(row.shareOfTotalRate))}</small></span>
    <div class="allocation-track" aria-label="${escapeText(formatPercentage(row.shareOfTotalRate))} от общей суммы"><i style="--allocation:${Math.max(0, Math.min(100, Number(row.shareOfTotalRate || 0) * 100))}%"></i></div>
  </div>`;
  host.innerHTML = rows.length ? rows.slice(0, 2).map(card).join('') + (rows.length > 2 ? `<details class="accounts-more"${expanded ? ' open' : ''}><summary>Все счета · ${rows.length}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></summary><div class="accounts-overflow">${rows.map(card).join('')}</div></details>` : '') + `<div class="accounts-total"><span>Общая стоимость</span><strong>${escapeText(formatMoney(data.portfolio?.totalNanos, data.portfolio?.currency))}</strong></div>` : '<p class="empty-copy">Нет сохранённых портфелей. Запустите синхронизацию.</p>';
  host.querySelectorAll('[data-pin-account]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.pinAccount;
    writeAccountPins(localStorage, scope, pins.includes(id) ? pins.filter(pin => pin !== id) : [...pins, id]);
    renderAccountCards(data);
    host.querySelector(`[data-pin-account="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }));
  if (focusedPin) host.querySelector(`[data-pin-account="${CSS.escape(focusedPin)}"]`)?.focus({ preventScroll:true });
}

function renderPortfolio(data) {
  const portfolio = data.portfolio || {};
  const selected = data.selectedPeriod;
  const coverage = data.dataCoverage || {};
  $('#portfolioValue').textContent = formatMoney(portfolio.totalNanos, portfolio.currency);
  $('#portfolioValueLabel').textContent = 'Стоимость портфеля';
  const today = dailyPositionSummary(data.clientProduct?.openPositions || []);
  const daily = $('#portfolioDayChange');
  daily.className = `portfolio-day-change ${signedClass(today?.pnlNanos)}`;
  daily.innerHTML = today ? `${escapeText(today.rate == null ? signedMoney(today.pnlNanos, today.currency) : formatPercentage(today.rate, {signed:true}))}<small>сегодня по позициям</small>` : '<span>—</span><small>сегодня по позициям</small>';
  daily.title = today ? 'Сумма дневных результатов текущих открытых позиций по данным брокера. Не включает уже закрытые позиции; не является полной доходностью портфеля за день.' : 'Дневные данные не получены для всех текущих позиций либо относятся к прошлой дате.';
  const valuationDetails = [`Оценка стоимости: ${formatDate(portfolio.asOf)}.`,
    portfolio.startTotalNanos != null ? `Первая оценка в периоде: ${formatMoney(portfolio.startTotalNanos, portfolio.currency)} · ${formatDate(portfolio.startAsOf)}.` : 'Начальная оценка не сохранена.',
    portfolio.currentTotalNanos != null ? `Последняя стоимость: ${formatMoney(portfolio.currentTotalNanos, portfolio.currency)} · ${formatDate(portfolio.currentAsOf)}.` : '', coverage.reason || ''].filter(Boolean).join(' ');
  $('#portfolioValueHelp').setAttribute('data-evidence-note', valuationDetails);
  $('#netPnl').textContent = signedMoney(portfolio.netPnlNanos, portfolio.currency);
  renderEvidenceNote($('#netPnlMeta'), portfolio.pnlReason ? coverageSummary(coverage) : 'После комиссий', portfolio.pnlReason);
  $('#netPnl').className = signedClass(portfolio.netPnlNanos);
  $('#netPnlRate').textContent = formatPercentage(data.analytics?.netReturn, { signed: true });
  $('#netPnlRate').className = `metric-rate ${signedClass(portfolio.netPnlNanos)}`;
  $('#netPnlHelp').dataset.evidenceNote = [portfolio.pnlReason, 'Результат за выбранный период после комиссий.'].filter(Boolean).join(' ');
  for (const [id, value] of [['realizedPnl', portfolio.realizedNanos], ['unrealizedPnl', portfolio.unrealizedNanos]]) $('#'+id).className = signedClass(value);
  $('#realizedPnl').textContent = signedMoney(portfolio.realizedNanos, portfolio.currency);
  $('#unrealizedPnl').textContent = signedMoney(portfolio.unrealizedNanos, portfolio.currency);
  renderEvidenceNote($('#markFreshness'), portfolio.unrealizedNanos != null
    ? `По текущим позициям · ${formatDate(portfolio.currentAsOf || portfolio.asOf)}`
    : 'Нет оценки открытых позиций.', portfolio.unrealizedReason || '');
  $('#feesValue').textContent = formatMoney(portfolio.feesNanos, portfolio.currency);
  $('#drawdownValue').textContent = formatPercentage(portfolio.maxDrawdownRate == null ? null : -Math.abs(portfolio.maxDrawdownRate));
  renderEvidenceNote($('#drawdownPeriod'), portfolio.maxDrawdownRate === null || portfolio.maxDrawdownRate === undefined
    ? coverageSummary(coverage, 'Нужны оценки в разные даты.')
    : portfolio.riskCoverage?.state === 'partial' ? 'По активным интервалам.' : 'По оценкам стоимости за период.', portfolio.maxDrawdownRate == null ? coverage.reason : portfolio.riskCoverage?.reason || portfolio.drawdownPeriod);
  metricNote($('#unrealizedPnl'), $('#markFreshness').textContent);
  metricNote($('#drawdownValue'), $('#drawdownPeriod').textContent);
  $('#equityVersion').textContent = data.calculationVersion || 'Версия расчёта не указана';

  renderAccountCards(data);

  const rows = sortRows(data.clientProduct?.openPositions || [],state.sorts.positions,positionReaders);
  $('#positionsBody').innerHTML = rows.length ? rows.map((row) => {
    const display=instrumentDisplay(row),currency=row.pnlCurrency||row.currency||'RUB';
    const resultClass = signedClass;
    const share=positionShare(row,data);
    return `<tr>
      <td><span class="instrument-with-mark">${instrumentMark(row,display)}<span class="instrument-cell"><strong>${escapeText(display.ticker||display.name)}</strong><small title="${escapeText(display.name)}">${escapeText(display.name!==display.ticker?display.name:'')}</small></span></span></td>
      <td><span class="asset-type">${ui(row.assetType==='future'?'Фьючерс':'Акция')}</span><small class="position-direction">${row.direction==='short'?'Short':'Long'}</small></td>
      <td title="${escapeText(row.openedAtNote||'')}">${escapeText(row.openedAt?formatShortDate(row.openedAt):'—')}</td>
      <td class="numeric">${escapeText(positionQuantity(row,{locale:state.language}))}</td>
      <td class="numeric" title="${escapeText(row.entryPriceNote||'')}">${escapeText(quoteMoney(row.entryPriceNanos ?? row.averagePriceNanos,row.priceCurrency))}</td>
      <td class="numeric" title="${escapeText(row.positionValue?.note||'')}">${escapeText(formatMoney(row.positionValueNanos,row.positionValueCurrency||row.currency||row.priceCurrency))}</td>
      <td class="numeric" title="${row.assetType === 'future' ? 'Экспозиция: номинальная стоимость контрактов / капитал. Это не доля вложенных денег и не гарантийное обеспечение.' : 'Стоимость позиции / текущая стоимость выбранных счетов'}">${share==null?'—':escapeText(formatPercentage(share))}${row.assetType === 'future' && share != null ? '<small class="position-exposure">эксп.</small>' : ''}</td>
      <td class="numeric ${resultClass(row.totalPnlNanos)}" title="${escapeText(row.method || '')}"><strong>${escapeText(signedMoney(row.totalPnlNanos,currency))}</strong>${row.totalReturnRate==null?'':`<small class="return-rate">${escapeText(formatPercentage(row.totalReturnRate,{signed:true}))}${row.assetType==='future'?' '+ui('цены'):''}</small>`}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty-cell">Нет сохранённых открытых позиций. Запустите синхронизацию.</td></tr>';
  watchInstrumentImages($('#positionsBody'));

}

const OPERATIONS_PAGE_SIZE = 20;

function usableInstrumentText(value, uid) {
  const text = String(value || '').trim();
  if (!text || (uid && (text === uid || text === uid.slice(0, 12)))) return '';
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(text)) return '';
  return text;
}

function prepareDisplayLabels(data) {
  state.portfolioLabels = new Map((data.clientProduct?.portfolios || []).map((item) => [item.id, item.label]));
  state.instrumentLabels = new Map();
  for (const row of [...(state.marketCalendarUi?.getCatalog() || []), ...(data.instruments || []), ...(data.positions || []), ...(data.clientProduct?.openPositions || []), ...(data.clientProduct?.closedPositions || [])]) {
    if (!row.instrumentUid) continue;
    const key = row.instrumentUid;
    const previous = state.instrumentLabels.get(key) || {};
    state.instrumentLabels.set(key, {
      name: usableInstrumentText(row.name, key) || previous.name || '',
      ticker: usableInstrumentText(row.ticker, key) || previous.ticker || '',
      logoName: row.logoName || previous.logoName || null,
    });
  }
}

function instrumentDisplay(row) {
  const uid = String(row.instrumentUid || '');
  const metadata = state.instrumentLabels.get(uid) || {};
  const ticker = usableInstrumentText(row.ticker, uid) || metadata.ticker || '';
  const name = usableInstrumentText(row.name, uid) || metadata.name || ticker
    || (uid ? 'Название недоступно' : 'Событие счёта');
  return { name:issuerName(ticker,name), ticker, instrumentUid:uid, logoName:row.logoName || metadata.logoName };
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
    return `<tr><td><span class="instrument-with-mark">${row.instrumentUid?instrumentMark(display):''}<span class="instrument-cell"><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText(detail)}</small></span></span></td><td>${escapeText(formatDate(row.occurredAt, true))}</td><td>${escapeText(row.label || row.type)}</td><td class="numeric">${escapeText(formatQuantity(row.quantityNanos))}</td><td class="numeric">${escapeText(formatMoney(row.paymentNanos, row.currency))}</td><td class="numeric">${escapeText(formatMoney(row.commissionNanos, row.currency))}</td><td><span class="status-chip fresh">${escapeText(row.stateLabel || 'Исполнено')}</span></td></tr>`;
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
  const filtered = filterLedgerRows(data.clientProduct?.closedPositions || [], state.operationFilterValues || {}, { dateKey: 'closedAt', display: instrumentDisplay, accountLabel: portfolioDisplay });
  const rows = sortRows(filtered,state.sorts.closed,{...positionReaders,closedAt:r=>r.closedAt?Date.parse(r.closedAt):null});
  const result = sumMoneyByCurrency(rows, 'pnlNanos', 'pnlCurrency');
  $('#closedSummaryCount').textContent = rows.length.toLocaleString(state.language === 'en' ? 'en-US' : 'ru-RU');
  $('#closedSummaryResult').textContent = result.amounts.length ? result.amounts.map(row => formatMoney(row.nanos, row.currency, { native: true })).join(' · ') : '—';
  $('#closedSummaryNote').textContent = result.missing ? `${result.known} из ${rows.length} с денежным результатом. Вариационная маржа — в аналитике.` : rows.length ? 'После комиссий · по выбранным фильтрам' : 'Нет закрытых позиций за период';
  $('#closedSummaryResult').className = result.amounts.length === 1 ? signedClass(result.amounts[0].nanos) : '';
  $('#closedSummaryHelp').dataset.evidenceNote = $('#closedSummaryNote').textContent;
  const showCost = rows.some(row => row.positionCostNanos != null);
  $('#closedPositionCostHeader').hidden = !showCost;
  const pageRows = pagedRows('closedPositions', rows, 20, () => renderClosedPositions(data));
  $('#closedPositionsBody').innerHTML = pageRows.length ? pageRows.map((row) => {
    const pnl = row.pnlNanos == null ? null : BigInt(row.pnlNanos);
    const priceCurrency = row.assetType === 'future' ? 'PTS' : row.currency || 'RUB';
    const display = instrumentDisplay(row);
    return `<tr>
      <td><span class="instrument-with-mark">${instrumentMark(display)}<span class="instrument-cell"><strong>${escapeText(display.ticker||display.name)}</strong><small>${escapeText(display.name!==display.ticker?display.name:'')}</small></span></span></td>
      <td><span class="asset-chip">${row.assetType === 'future' ? 'Фьючерс' : 'Акция'}</span><small class="cell-note">${row.direction === 'short' ? 'Шорт' : 'Лонг'}</small></td>
      <td title="${escapeText(formatDate(row.openedAt, true))}">${escapeText(formatShortDate(row.openedAt))}</td>
      <td title="${escapeText(formatDate(row.closedAt, true))}">${escapeText(formatShortDate(row.closedAt))}</td>
      <td class="numeric">${escapeText(positionQuantity(row,{locale:state.language}))}</td>
      <td class="numeric" title="${escapeText('Цена закрытия: '+quoteMoney(row.exitPriceNanos, priceCurrency))}">${escapeText(quoteMoney(row.entryPriceNanos, priceCurrency))}</td>
${showCost ? `<td class="numeric">${row.positionCostNanos == null ? '<span aria-label="Стоимость для этой позиции недоступна">—</span>' : escapeText(formatMoney(row.positionCostNanos, row.currency || 'RUB'))}</td>` : ''}
      <td class="numeric ${pnl == null ? '' : pnl < 0n ? 'negative' : 'positive'}">${row.assetType === 'future' && pnl == null
        ? `<strong class="${row.returnRate == null ? '' : Number(row.returnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))} цены</strong><small class="cell-note inline-help"><button class="term-help" type="button" data-evidence-note="${escapeText(row.pnlReason || 'Вариационная маржа показана отдельно за период.')}" aria-label="Сведения о результате фьючерса" aria-expanded="false">?</button></small>`
        : formatMoneyAndRate(row.pnlNanos, row.returnRate, row.currency || 'RUB')}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="${showCost ? 8 : 7}" class="empty-cell">За выбранный период нет восстановленных закрытых позиций. Выберите другой период; для расчёта нужны обе стороны сделки.</td></tr>`;
  watchInstrumentImages($('#closedPositionsBody'));
}

function applyOperationFilters({ announce = true } = {}) {
  if (!state.bootstrap) return;
  const form = $('#operationFilters');
  const values = Object.fromEntries(new FormData(form));
  if ((values.from || values.to) && !validDateRange(values.from, values.to)) return;
  state.operationFilterValues = values;
  const rows = filterLedgerRows(state.bootstrap.operations || [], values, { display: instrumentDisplay, accountLabel: portfolioDisplay });
  renderOperations({ operations: rows });
  const fees = summarizeOperationFees(rows);
  $('#operationSummaryFees').textContent = fees.amounts.length ? fees.amounts.map(row => formatMoney(row.nanos, row.currency, { native: true })).join(' · ') : '—';
  $('#operationSummaryFeesNote').textContent = fees.missing ? `${fees.known} из ${fees.known + fees.missing} операций с известной комиссией` : 'По исполненным операциям периода';
  $('#operationFeesHelp').dataset.evidenceNote = $('#operationSummaryFeesNote').textContent;
  state.listPages?.delete('closedPositions');
  renderClosedPositions(state.bootstrap);
  if (announce) showToast(`Фильтры применены: ${rows.length} операций.`);
}

function initAutomaticLedgerFilters() {
  const form = $('#operationFilters');
  const status = $('#operationFilterStatus');
  const invalidatePeriod = () => { state.periodRequest++; state.periodLoading = false; $('#statisticsPeriodForm').setAttribute('aria-busy', 'false'); };
  const scheduler = createFilterScheduler({ apply: async values => {
    if (values.periodChanged) {
      if (values.period === 'custom' && !validDateRange(values.from, values.to)) return;
      await selectPeriod(values.period === 'custom' ? { period: 'custom', from: values.from, to: values.to } : { period: values.period }, { announce: false });
    }
    applyOperationFilters({ announce: false });
  } });
  const onChange = event => {
    const values = Object.fromEntries(new FormData(form));
    const dateChanged = ['from', 'to'].includes(event.target.name);
    const periodChanged = state.operationPeriodDraft || dateChanged || event.target.name === 'period';
    if (dateChanged) { values.period = 'custom'; form.elements.period.value = 'custom'; }
    form.querySelector('.ledger-date-range').hidden = values.period !== 'custom';
    status.textContent = '';
    if (periodChanged) {
      periodScheduler.cancel(); state.statisticsPeriodDraft = false;
      invalidatePeriod(); state.operationPeriodDraft = true;
      if (values.period === 'custom' && !validDateRange(values.from, values.to)) {
        scheduler.cancel(); status.textContent = 'Укажите обе даты: начало не позже окончания.'; return;
      }
    }
    scheduler.schedule({ ...values, periodChanged });
  };
  form.addEventListener('input', onChange);
  form.addEventListener('submit', event => { event.preventDefault(); });
  $('#resetOperationFilters').addEventListener('click', () => {
    scheduler.cancel(); periodScheduler.cancel(); invalidatePeriod(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = false;
    form.reset(); state.operationFilterValues = {}; status.textContent = '';
    void selectPeriod({ period: 'month' }, { announce: false });
  });
  const periodScheduler = createFilterScheduler({ apply: values => selectPeriod(values, { announce: false }) });
  for (const id of ['statisticsFrom', 'statisticsTo']) $('#' + id).addEventListener('input', () => {
    scheduler.cancel(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = true; invalidatePeriod();
    const from = $('#statisticsFrom').value, to = $('#statisticsTo').value;
    if (!validDateRange(from, to)) { periodScheduler.cancel(); $('#statisticsPeriodStatus').textContent = 'Укажите обе даты: начало не позже окончания.'; return; }
    periodScheduler.schedule({ period: 'custom', from, to });
  });
  $('#resetStatisticsPeriod').addEventListener('click', () => {
    periodScheduler.cancel(); scheduler.cancel(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = false;
    state.analyticsAccount = ''; state.listPages = new Map();
    void selectPeriod({ period: 'month' }, { announce: false });
  });
  for (const button of $$('[data-stat-range], [data-range]')) button.addEventListener('click', () => { scheduler.cancel(); periodScheduler.cancel(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = false; });
}

function renderAnalytics(data) {
  const analytics = data.analytics || {};
  $('#analyticsVersion').textContent = data.calculationVersion || 'Версия расчёта не указана';
  const percentage = value => formatPercentage(value);
  $('#grossReturn').textContent = formatPercentage(analytics.grossReturn,{signed:true});
  $('#netReturn').textContent = formatPercentage(analytics.netReturn,{signed:true});
  for (const [id, value] of [['grossReturn', analytics.grossReturn], ['netReturn', analytics.netReturn]]) {
    $('#' + id).classList.toggle('positive', value != null && value >= 0);
    $('#' + id).classList.toggle('negative', value != null && value < 0);
  }
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
  for (const id of ['netReturn','grossReturn','volatilityValue','profitFactorValue']) metricNote($('#'+id), $('#'+id).nextElementSibling.textContent);
  resultTrend($('#netReturn'), analytics.netReturn);
  $('#analyticsChartValue').textContent = formatPercentage(analytics.netReturn, { signed:true });
  $('#analyticsChartValue').className = analytics.netReturn == null ? '' : analytics.netReturn < 0 ? 'negative' : 'positive';
  $('#variationMargin').textContent = formatMoney(analytics.variationMarginNanos, 'RUB');
  const ranking = analytics.instrumentRanking || [];
  const rankingPage = pagedRows('instrumentRanking', ranking, 8, () => renderAnalytics(data));
  $('#instrumentRanking').innerHTML = rankingPage.length ? rankingPage.map((item) => {
    const display = instrumentDisplay(item);
    const currency = item.currency || 'RUB';
    const width = relativeBarWidth(item.pnlNanos, ranking.filter(row => (row.currency || 'RUB') === currency).map(row => row.pnlNanos));
    return `<div class="ranking-row result-bar-row ${item.pnlNanos != null && BigInt(item.pnlNanos) < 0n ? 'worst' : 'best'}"><span class="instrument-with-mark">${instrumentMark(display)}<span class="instrument-cell"><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText(display.name!==display.ticker?display.name:'')}</small></span></span><div class="relative-bar" aria-hidden="true"><i style="--bar:${width}%"></i></div><span class="numeric ${signedClass(item.pnlNanos)}" title="${escapeText(data.analytics?.instrumentRankingMethod || 'Результат закрытых позиций за срок удержания')}"><strong>${escapeText(signedMoney(item.pnlNanos,currency))}</strong>${item.returnRate==null?'':`<small class="return-rate">${escapeText(formatPercentage(item.returnRate,{signed:true}))}</small>`}</span></div>`;
  }).join('') : '<p class="empty-copy">За период пока нет результата, который можно отнести к конкретным инструментам. Выберите более длинный период или синхронизируйте сделки.</p>';
  watchInstrumentImages($('#instrumentRanking'));

  const statistics = data.clientProduct?.statistics || {};
  const overall = statistics.overall || {};
  $('#tradeOutcomeMeta').textContent = `${overall.winCount || 0} из ${overall.tradeCount || 0} закрытых`;
  const portfolioRows = statistics.perPortfolio || [];
  $('#portfolioStatistics').innerHTML = portfolioRows.length ? `<div class="table-scroll"><table class="account-statistics-table"><thead><tr><th>Счёт</th><th class="numeric">На начало</th><th class="numeric">На конец</th><th class="numeric">Результат</th></tr></thead><tbody>${portfolioRows.map(row=>{
    const portfolio=(data.equityCurvesByPortfolio||[]).find(item=>item.portfolioId===row.id)?.portfolio || (portfolioRows.length===1?data.portfolio:null) || {};
    return `<tr><td><span class="account-card-name"><i class="account-dot" aria-hidden="true"></i>${escapeText(row.label)}</span></td><td class="numeric">${escapeText(formatMoney(portfolio.startTotalNanos,portfolio.currency))}</td><td class="numeric">${escapeText(formatMoney(portfolio.totalNanos,portfolio.currency))}</td><td class="numeric ${row.netReturnRate==null?'':row.netReturnRate<0?'negative':'positive'}" title="${escapeText(row.returnReason||row.returnMethod||'')}"><strong>${escapeText(formatPercentage(row.netReturnRate,{signed:true}))}</strong><small class="return-rate">${portfolio.netPnlNanos==null?'':escapeText(signedMoney(portfolio.netPnlNanos,portfolio.currency))}</small>${row.returnReason?`<button class="term-help" type="button" data-evidence-note="${escapeText(row.returnReason)}" aria-label="Сведения о результате счёта">?</button>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>` : '<p class="empty-copy">Нет данных по счетам за выбранный период.</p>';

  const cashFlows = statistics.cashFlows || [];
  const cashPage = pagedRows('cashFlowStatistics', cashFlows, 8, () => renderAnalytics(data));
  $('#cashFlowSummary').textContent = cashFlows.length ? `${cashFlows.length.toLocaleString('ru-RU')} движений за выбранный период` : '';
  $('#cashFlowStatistics').innerHTML = cashPage.length ? cashPage.map((row) => `
    <div class="cash-flow-row ${row.kind === 'deposit' ? 'deposit' : 'withdrawal'}"><span><strong>${row.kind === 'deposit' ? 'Пополнение' : 'Вывод средств'}</strong><small>${escapeText([formatDate(row.occurredAt, true), row.portfolioLabel].filter(Boolean).join(' · '))}</small></span><span class="numeric"><strong>${escapeText(formatMoney(row.amountNanos, row.currency || 'RUB'))}</strong><small>${row.portfolioShareRate == null ? '' : `${escapeText(formatPercentage(row.portfolioShareRate))} от портфеля на начало`}</small></span></div>`).join('') : '<p class="empty-copy">В выбранном периоде нет пополнений и выводов.</p>';

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
  renderAnalyticsReturnChart(series, data.dataCoverage, data.selectedPeriod, analytics.netReturnSeries || []);
}

function reconstructedHistoryExplanation(coverage) {
  const base = 'История восстановлена от оценки брокера с полной историей операций по дневным ценам. Фьючерсы учитываются по зачисленной и списанной вариационной марже; внутридневная переоценка прошлых дат не восстанавливается.'
    + (coverage?.pendingOperationTail && coverage.valuationAt ? ` Операции учтены по ${formatDate(coverage.valuationAt, true)}. Текущая стоимость имеет собственную дату обновления.` : '');
  const sources = coverage?.reconstruction?.priceSources || [];
  if (!sources.length) return base;
  const labels = [...new Set(sources.map(source => `${source.sourceTicker} (${source.sourceClassCode})`))].join(', ');
  return `${base} Дневные цены той же бумаги: ${labels}. Используется другой режим торгов с теми же активом, ISIN и валютой; это расчётная оценка.`;
}

function renderAnalyticsReturnChart(points, coverage = state.bootstrap?.dataCoverage, selectedPeriod = state.bootstrap?.selectedPeriod, netReturnSeries = []) {
  const host = $('#analyticsReturnChart');
  const empty = $('#analyticsReturnEmpty');
  if (!host) return;
  const reconstructed = coverage?.evidence === 'reconstructed';
  const percentMode = state.analyticsChartMode === 'percent';
  const displaySymbol = state.displayCurrency === 'USD' ? '$' : '₽';
  $('#analyticsChartUnit').textContent = percentMode ? ui('Доходность после комиссий, %') : ui('Стоимость портфеля, ₽').replace('₽', displaySymbol);
  const valueButton = $('[data-analytics-unit="rubles"]');
  if (valueButton) valueButton.textContent = ui('Стоимость, ₽').replace('₽', displaySymbol);
  $('#analyticsChartTitle').textContent = percentMode ? 'Динамика доходности портфеля' : 'Изменение стоимости за период';
  renderEvidenceNote($('#analyticsChartSubtitle'), percentMode
    ? 'Пополнения и выводы исключены. Доходность относительно стоимости на начало периода.'
    : reconstructed ? 'Восстановленная история. Пополнения и выводы влияют на линию.' : 'По оценкам стоимости портфеля. Пополнения и выводы влияют на линию.', reconstructed
      ? reconstructedHistoryExplanation(coverage) : percentMode ? 'Накопленный результат после комиссий делится на начальную стоимость портфеля. Метод совпадает с показателем выше; это не TWR и не IRR.' : 'Каждая точка — сохранённая оценка стоимости портфеля.');
  $('#analyticsChartHelp').dataset.evidenceNote = $('#analyticsChartSubtitle').textContent;
  $('#analyticsChartValue').textContent = percentMode ? formatPercentage(analyticsDisplayData()?.analytics?.netReturn, {signed:true}) : formatMoney(analyticsDisplayData()?.portfolio?.totalNanos, 'RUB');
  const sourcePoints = percentMode ? netReturnSeries : points;
  if (!sourcePoints || sourcePoints.length < 2) {
    state.analyticsReturnChart?.setData([]);
    host.hidden = true;
    if (empty) {
      empty.hidden = false;
      renderEvidenceNote(empty, sourcePoints?.length === 1 ? 'Одна оценка. Для графика нужна ещё одна дата.'
        : coverageSummary(coverage, percentMode ? 'Для доходности нужна полная история. Стоимость доступна отдельным графиком.' : 'Нет сопоставимых оценок за период.'), coverage?.reason);
    }
    return;
  }
  host.hidden = false;
  if (empty) empty.hidden = true;

  const chartPoints = percentMode ? netReturnSeries.map(point => ({ time: point.time, netReturnRate: point.netReturnRate }))
    : points.map(point => ({ time: point.time, equityValue: Number(BigInt(point.equityNanos)) / 1e9 }));

  if (state.analyticsReturnChart) {
    state.analyticsReturnChart.setData(chartPoints, selectedPeriod, { mode: state.analyticsChartMode, scope: state.analyticsAccount });
  } else {
    state.analyticsReturnChart = createAnalyticsReturnChart(host, chartPoints, selectedPeriod, { mode: state.analyticsChartMode, scope: state.analyticsAccount });
  }
}

function renderAnalyticsChartOnView() {
  $$('[data-analytics-unit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.analyticsUnit === state.analyticsChartMode)));
  const data = analyticsDisplayData();
  renderAnalyticsReturnChart(data?.clientProduct?.statistics?.overall?.equitySeries || [], data?.dataCoverage, data?.selectedPeriod, data?.analytics?.netReturnSeries || []);
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
  if (!state.statisticsPeriodDraft) $('#statisticsPeriodStatus').textContent = `Все показатели: ${label}.`;
  $('#overviewPeriodStatus').textContent = label;
  $('#closedPositionsPeriod').textContent = `Закрыты за период: ${label}. Цена входа учитывает более ранние покупки.`;
  if (selected) {
    if (!state.statisticsPeriodDraft) {
      $('#statisticsFrom').value = selected.fromDate || String(selected.from || '').slice(0, 10);
      $('#statisticsTo').value = selected.toDate || String(selected.to || '').slice(0, 10);
    }
    if (!state.operationPeriodDraft) {
      const form = $('#operationFilters');
      if (form?.elements) {
        form.elements.period.value = state.selectedPeriod.period;
        form.querySelector('.ledger-date-range').hidden = state.selectedPeriod.period !== 'custom';
        form.elements.from.value = $('#statisticsFrom').value;
        form.elements.to.value = $('#statisticsTo').value;
      }
    }
  }
  $$('[data-stat-range]').forEach((button) => {
    const active = button.dataset.statRange === state.selectedPeriod.period;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  const overviewRanges = { '1m': 'month', '3m': 'quarter', '6m': 'halfyear', '1y': 'year', all: 'all' };
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
  applyOperationFilters({ announce: false });
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
    state.operationPeriodDraft = false;
    state.statisticsPeriodDraft = false;
    state.statisticsRange = selection.period;
    state.listPages = new Map();
    renderBootstrap(data);
    if (announce) showToast('Период применён к графику, метрикам и спискам.');
  } catch (error) {
    if (requestNumber !== state.periodRequest) return;
    state.operationPeriodDraft = false;
    state.statisticsPeriodDraft = false;
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
  const summaryAccount = riskAccounts.find(account => account.portfolioId === state.riskSummaryAccount) || riskAccounts[0];
  $('#riskSummaryAccount').innerHTML = riskAccounts.map(account => `<option value="${escapeText(account.portfolioId)}">${escapeText(account.label || 'Текущий счёт')}</option>`).join('');
  $('#riskSummaryAccount').value = summaryAccount.portfolioId;
  $('#riskSummaryMetrics').innerHTML = [['Ликвидный портфель','liquidPortfolio'],['Начальная маржа','startingMargin'],['Запас маржи','maxAvailableBeforeMarginCallNanos']].map(([label,key]) => `<div><dt>${label}</dt><dd>${escapeText(formatMoney(summaryAccount[key]?.value,summaryAccount.currency || 'RUB'))}</dd></div>`).join('') + `<div><dt>Оценка получена</dt><dd class="risk-evaluation-time">${escapeText(summaryAccount.capturedAt ? formatDate(summaryAccount.capturedAt) : 'Нет данных')}</dd>${summaryAccount.stale ? '<small>Требуется обновление</small>' : ''}</div>`;
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
    ? 'Оценка Т‑Инвест отдельно по каждому счёту. Обеспечение не равно свободным деньгам; сверяйте дату оценки.'
    : 'Оценка обеспечения появится после синхронизации счёта. Калькулятор позиции доступен ниже.';
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
        return `<div class="${className}" title="${escapeText(displayExplanation + ' ' + evidenceNote(field, data))}"><dt>${displayLabel} ${helpBtn}</dt><dd>${escapeText(formatMoney(field.value, account.currency || 'RUB'))}</dd></div>`;
      }).join('')}</dl>
    </section>`;
  }).join('') || '<p class="empty-copy">Сначала синхронизируйте счета. Свой сценарий можно проверить во вкладке «Калькулятор позиции».</p>';
  const futuresRows = riskAccounts.flatMap((account) => (account.instruments || []).map((row) => ({ ...row, portfolioLabel: account.label })));
  const futuresPage = pagedRows('futuresRiskRows', futuresRows, 8, () => renderRiskPlan(data));
  $('#futuresRiskRows').innerHTML = futuresPage.length ? futuresPage.map((row) => `
    <div class="futures-risk-row"><span><strong>${escapeText(instrumentDisplay(row).ticker || instrumentDisplay(row).name)}</strong><small>${escapeText(row.portfolioLabel)}</small></span><dl><div><dt>ГО <button class="term-help" type="button" data-term="guaranteeMargin" aria-label="Справка: Гарантийное обеспечение">?</button></dt><dd>${escapeText(formatMoney(row.guaranteeNanos, row.currency || 'RUB'))}</dd></div></dl></div>`).join('') : '';

  const plan = slice.tradingPlan || {};
  $('#generatedPlanSurface').hidden = !(plan.items || []).length;
  $('#tradingPlanDate').textContent = plan.date ? `План на ${plan.date} · черновик, без исполнения` : 'Дата не задана. Черновик не исполняется автоматически.';
  const planPage = pagedRows('tradingPlan', sortRows(plan.items || [],state.sorts.plan,{name:r=>r.ticker||r.name}), 10, () => renderRiskPlan(data));
  $('#tradingPlanBody').innerHTML = planPage.length ? planPage.map((row) => `
    <tr><td><span class="position-instrument">${instrumentMark(row)}<span class="instrument-cell"><strong>${escapeText(row.ticker || row.name)}</strong><small>${escapeText(issuerName(row.ticker, row.name))}</small></span></span></td><td><span class="status-chip ${row.direction === 'short' ? 'stale' : 'fresh'}">${row.direction === 'short' ? 'Шорт' : 'Лонг'}</span></td><td class="numeric"><strong>${escapeText(formatPercentage(row.allocationRate))}</strong><small class="cell-note">${escapeText(formatMoney(row.positionAmountNanos, 'RUB'))}</small></td><td class="numeric">${escapeText(quoteMoney(row.entryPriceNanos, row.priceCurrency))}</td><td class="numeric">${escapeText(quoteMoney(row.exitPriceNanos, row.priceCurrency))}</td><td>${escapeText(row.expectedHold)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty-cell">План заполняется вручную. Укажите инструмент, цену входа, цель и срок; приложение не создаёт сделки автоматически.</td></tr>';
  watchInstrumentImages($('#tradingPlanBody'));

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
    targetPriceNanos: values.targetPrice?.trim() ? inputMoneyNanos(values.targetPrice) : undefined,
  });
  const output = $('#riskCalculatorResult');
  if (result.state !== 'calculated') {
    output.innerHTML = `<p class="empty-copy">${escapeText(result.reason || 'Введите капитал, допустимый риск, цену входа и стоп-цену.')}</p>`;
    return;
  }
  const rubles = value => formatMoney(value, 'RUB', { native: true });
  const levels = [['Вход',values.entryPrice,'entry'],['Стоп',values.stopPrice,'stop'],...(values.targetPrice?.trim() ? [['Цель',values.targetPrice,'target']] : [])].map(([label,value,kind]) => ({label,kind,value:Number(inputMoneyNanos(value))/1e9,text:quoteMoney(inputMoneyNanos(value),future?'PTS':'RUB')}));
  const low = Math.min(...levels.map(level=>level.value)), high = Math.max(...levels.map(level=>level.value));
  const levelY = level => 35 + (high - level.value) / (high - low || 1) * 150;
  const diagram = `<figure class="risk-level-diagram"><figcaption>Уровни сценария</figcaption><svg viewBox="0 0 450 220" role="img" aria-label="Цены входа, стопа и цели из вашего расчёта">${levels.map(level=>`<g class="risk-level-${level.kind}"><path d="M22 ${levelY(level)}H428"/><circle cx="100" cy="${levelY(level)}" r="4"/><text x="22" y="${levelY(level)-10}">${level.label}</text><text x="428" y="${levelY(level)-10}" text-anchor="end">${escapeText(level.text)}</text></g>`).join('')}</svg></figure>`;
  output.innerHTML = `<dl class="calculator-metrics"><div><dt>${future ? 'Количество контрактов' : 'Количество акций'}</dt><dd>${escapeText(result.units)} ${future ? 'контр.' : 'шт.'}</dd><small>${escapeText(result.lots)} лот.</small></div><div><dt>Убыток при стоп-цене</dt><dd class="negative">${escapeText(rubles(result.actualRiskNanos))}</dd><small>Допустимо: ${escapeText(rubles(result.riskBudgetNanos))}</small></div><div><dt>Сумма позиции</dt><dd>${escapeText(rubles(result.positionAmountNanos))}</dd><small>без комиссий и проскальзывания</small></div>${result.rewardRiskRatio ? `<div><dt>Риск / потенциальная прибыль</dt><dd class="positive">1 : ${escapeText(result.rewardRiskRatio.replace('.', ','))}</dd><small>При достижении цели: ${escapeText(rubles(result.potentialRewardNanos))}</small></div>` : ''}</dl>${diagram}<p class="surface-note">${escapeText(result.reason || '')} ${escapeText(result.warning || '')}</p>`;
}

function renderSync(data) {
  const runs = data.syncRuns || [];
  const success = runs.find(run => run.status === 'completed');
  $('#syncLatestTime').textContent = success ? formatDate(success.finishedAt || success.startedAt, true) : 'Ещё не обновляли';
  $('#syncLatestState').textContent = runs[0]?.status === 'failed' ? 'Последний запуск завершился с ошибкой' : success ? 'Данные сохранены на устройстве' : 'Запустите первую синхронизацию';
  $('#syncAutoState').textContent = data.environment === 'fixture' ? 'Учебный режим' : data.connection?.connected && data.capabilities?.portfolioRefresh ? 'Каждые 10 секунд' : 'Нужно подключение';
  $('#syncNowButton').disabled = $('#syncButton').disabled;
  const accounts=data.clientProduct?.portfolios||[];
  $('#brokerConnectionList').innerHTML=accounts.map(account=>'<div class="broker-connection-row">'+tbankIcon+'<span><strong>Т-Банк · '+escapeText(account.label)+'</strong><small>'+(data.environment==='fixture'?'Учебный счёт':'Брокерский счёт')+'</small></span><span class="'+(data.connection?.connected?'positive':'')+'">'+(data.environment==='fixture'?'Учебные данные':data.connection?.connected?'Подключено':'Не подключено')+'</span></div>').join('');
  const runPage = pagedRows('syncRuns', runs, 5, () => renderSync(data));
  $('#syncSummary').textContent = runs.length ? `${runs.length} запуск(а)` : 'нет данных';
  $('#syncRuns').innerHTML = runPage.length ? runPage.map(run => `<details class="run-row"><summary><time>${escapeText(formatDate(run.startedAt,true))}</time><span><strong class="${run.status==='failed'?'negative':run.status==='completed'?'positive':''}">${escapeText(run.statusLabel||run.status)}</strong><small>${escapeText(run.portfolioLabel||'Текущий портфель')}</small></span><span>${run.normalizedCount} обработано <svg><use href="#i-chevron"/></svg></span></summary><p>${run.rawCount} исходных записей · ${run.durationMs} мс</p></details>`).join('') : '<p class="empty-copy">Запуски синхронизации не найдены.</p>';
  const latest = runs[0];
  if (latest) $$('#syncStages li').forEach((item) => item.classList.toggle('complete', latest.completedStages?.includes(item.dataset.stage)));
  const latency = data.latency || {};
  $('#latencyP50').textContent = latency.p50 === null || latency.p50 === undefined ? '—' : `${latency.p50} мс`;
  $('#latencyP95').textContent = latency.p95 === null || latency.p95 === undefined ? '—' : `${latency.p95} мс`;
  $('#latencyP99').textContent = latency.p99 === null || latency.p99 === undefined ? '—' : `${latency.p99} мс`;
  $('#latencyStatus').textContent = latency.clientVerified ? `Измерено на этом компьютере · обновлений: ${latency.samples}` : data.environment === 'fixture' ? `Проверка на учебных данных · измерений: ${latency.samples || 0}; не подтверждает клиентскую задержку.` : 'Задержка потока ещё не измерена.';
  const latencySurface = $('#latencyStatus').closest?.('.latency-surface');
  if (latencySurface) latencySurface.hidden = data.environment !== 'fixture' && !latency.clientVerified;
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
  $('#aiInstrument').value = companyInstruments.some((item) => item.instrumentUid === selectedCompany) ? selectedCompany : !state.companySelectionInitialized && !selectedCompany ? companyInstruments[0]?.instrumentUid || '' : '';
  if (companyInstruments.length) state.companySelectionInitialized = true;
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
  $('#equityObservationNote').hidden = true;
  const reconstructed = data?.dataCoverage?.evidence === 'reconstructed';
  renderEvidenceNote($('#equityObservationNote'), enoughHistory && batchPoints.length
    ? 'Последовательный опрос счетов; точки не используются для доходности.'
    : enoughHistory ? `${reconstructed ? 'Восстановленная история · ' : ''}${points.length.toLocaleString('ru-RU')} оценок. Пополнения и выводы влияют на стоимость.` : '', batchPoints.length ? data.snapshotBatchCurveNote
      : reconstructed ? reconstructedHistoryExplanation(data?.dataCoverage) : '');
  $('#equityDataHelp').dataset.evidenceNote = $('#equityObservationNote').textContent || data?.dataCoverage?.reason || 'Сохранённые оценки стоимости портфеля.';
  if (!enoughHistory) state.equityChart?.setData([], data?.selectedPeriod, state.analyticsAccount);
  else if (state.equityChart) state.equityChart.setData(points, data?.selectedPeriod, state.analyticsAccount);
  else state.equityChart = createEquityChart($('#equityChart'), points, data?.selectedPeriod, state.analyticsAccount);
}

function renderMarketInstrumentSummary(selected, candles = []) {
  let host = $('#marketInstrumentSummary');
  if (!host) { host = document.createElement('div'); host.id = 'marketInstrumentSummary'; host.className = 'market-instrument-summary'; $('.instrument-surface').prepend(host); }
  const rows = normalizeMarketCandles(candles), last = rows.at(-1), previous = rows.at(-2);
  const currency = String(selected?.assetType === 'future' ? 'PTS' : selected?.currency || selected?.priceCurrency || 'RUB').toUpperCase();
  const price = value => new Intl.NumberFormat(state.language === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 4,
    ...(/^[A-Z]{3}$/.test(currency) && currency !== 'PTS' ? { style: 'currency', currency: currency === 'RUR' ? 'RUB' : currency } : {}) }).format(value) + (currency === 'PTS' ? ' п.' : '');
  const change = last && previous ? last.close - previous.close : null;
  const assetLabel = { share: 'Акции', future: 'Фьючерсы', bond: 'Облигации', etf: 'Фонды', currency: 'Валюта' }[selected?.assetType] || '';
  host.innerHTML = `<div class="market-summary-identity">${instrumentMark(selected || {})}<span><strong>${escapeText(selected?.ticker || 'Инструмент')}</strong><small>${escapeText(selected?.name || 'Выберите актив в каталоге')}</small></span></div><div class="market-summary-quote"><strong>${last ? escapeText(price(last.close)) : '—'}</strong>${change !== null ? `<span class="${change >= 0 ? 'positive' : 'negative'}">${change > 0 ? '+' : ''}${escapeText(price(change))}${previous.close > 0 ? ' (' + (change > 0 ? '+' : '') + (change / previous.close * 100).toLocaleString(state.language === 'en' ? 'en-US' : 'ru-RU', {maximumFractionDigits:2}) + '%)' : ''}</span><small>К предыдущей свече</small>` : '<small>Цена последней свечи</small>'}</div>`;
  const tags = [assetLabel, selected?.exchange || selected?.realExchange].filter(Boolean);
  if (tags.length) host.querySelector('.market-summary-identity > span:last-child').insertAdjacentHTML('beforeend', `<small class="market-asset-tags">${tags.map(tag => `<span>${escapeText(tag)}</span>`).join('')}</small>`);
  const capital = state.companyFacts?.get(selected?.instrumentUid)?.metrics?.find(metric => metric.key === 'marketCapitalization');
  const capitalText = capital?.value != null && Number.isFinite(Number(capital.value)) ? new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:2}).format(Number(capital.value))+' '+(capital.unit === 'currency' ? 'ден. ед.' : capital.unit || '') : '—';
  const items=[['Открытие',last?price(last.open):'—'],['Объём свечи',last&&Number.isFinite(last.volume)?last.volume.toLocaleString('ru-RU'):'—'],['Максимум',last?price(last.high):'—'],['Капитализация',capitalText],['Минимум',last?price(last.low):'—'],['Закрытие',last?price(last.close):'—']];
  host.insertAdjacentHTML('beforeend','<dl class="market-ohlc">'+items.map(([title,value])=>'<div'+(title==='Капитализация'?' title="Из сохранённых фактов компании; прочерк означает отсутствие данных"':'')+'><dt>'+title+'</dt><dd>'+escapeText(value)+'</dd></div>').join('')+'</dl>');
  watchInstrumentImages(host);
}

async function renderMarketChart() {
  const sequence = (state.chartRequest || 0) + 1;
  state.chartRequest = sequence;
  const instrumentKey = $('#instrumentSelect').value;
  const base = (state.bootstrap?.instruments || []).find(row => (row.viewKey || row.instrumentUid) === instrumentKey);
  const selected = state.marketInstrument && [state.marketInstrument.instrumentUid, state.marketInstrument.viewKey].includes(instrumentKey)
    ? { ...base, ...state.marketInstrument } : base;
  const instrumentUid = selected?.instrumentUid || instrumentKey;
  const chartKey = `${instrumentKey}:${$('#marketInterval').value}`;
  if (state.marketSummaryKey !== chartKey) {
    renderMarketInstrumentSummary(selected);
    state.marketSummaryKey = chartKey;
  }
  let candles = (state.bootstrap?.candles || []).filter(row => row.instrumentUid === instrumentUid || row.viewKey === instrumentKey);
  let unavailable = null;
  if (state.bootstrap?.capabilities?.marketCalendar === true && state.bootstrap?.environment !== 'fixture' && !state.bootstrap?.preview?.localReview && instrumentUid) {
    if (state.marketChartKey !== chartKey) $('#marketStatus').textContent = 'Обновляем котировки…';
    try {
      const result = await request('/api/market/candles?' + new URLSearchParams({ instrumentUid, interval: $('#marketInterval').value }));
      if (sequence !== state.chartRequest) return;
      candles = result.data;
      unavailable = result.warning || (result.stale ? 'Сохранённые котировки · обновление задерживается' : null);
    } catch (error) { unavailable = error.message; }
  }
  if (sequence !== state.chartRequest) return;
  const chartSignature = JSON.stringify([chartKey, state.language, candles]);
  if (state.marketChart && state.marketChartSignature === chartSignature) {
    $('#marketStatus').textContent = unavailable || (state.bootstrap?.environment === 'fixture' ? 'Учебные котировки' : 'Котировки Т‑Инвест · обновление раз в минуту');
    return;
  }
  state.marketChartSignature = chartSignature;
  try {
    if (state.marketChart && state.marketChartKey === chartKey) state.marketChart.setData(candles);
    else {
      state.marketChart?.destroy(); state.marketChart = null;
      $('#marketChart').replaceChildren();
      state.marketChart = createMarketChart($('#marketChart'), candles);
      state.marketChartKey = chartKey;
    }
    state.marketChart?.setType($('#marketChartType').value);
    if (!state.marketChart) {
      $('#marketChart').innerHTML = '<div class="empty-state"><h3>Свечи пока недоступны</h3><p>Выберите другой интервал или инструмент. Для нового контракта и закрытого режима торгов истории может не быть.</p></div>';
      $('#marketStatus').textContent = unavailable || 'Т‑Инвест не вернул свечи за этот интервал';
      $('#marketEventTime').textContent='—';$('#marketAge').textContent='Нет свежих котировок';return;
    }
    const normalized = normalizeMarketCandles(candles), last = normalized.at(-1);
    renderMarketInstrumentSummary(selected, candles);
    if (state.bootstrap?.capabilities?.companyFacts && selected?.assetType === 'share' && !state.companyFacts?.has(instrumentUid)
      && state.bootstrap.companyAnalysisInstruments?.some(item=>item.instrumentUid===instrumentUid)) {
      state.marketFactsAttempted ||= new Set();
      if (!state.marketFactsAttempted.has(instrumentUid)) {
        state.marketFactsAttempted.add(instrumentUid);
        void request('/api/ai/company-facts?instrumentUid='+encodeURIComponent(instrumentUid)).then(report=>{
          state.companyFacts ||= new Map();state.companyFacts.set(instrumentUid,report);
          if ($('#instrumentSelect').value===instrumentKey && state.marketChartKey===chartKey) renderMarketInstrumentSummary(selected,candles);
        }).catch(()=>{});
      }
    }
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
    $('#positionsBody').innerHTML = '<tr><td colspan="8" class="empty-cell">Локальные данные недоступны. Проверьте рабочую среду и обновите страницу.</td></tr>';
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
  state.companyTab = 'analysis';
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
    view.analysisReport = result;
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
  const activeTab = state.companyTab || 'analysis';
  $$('[data-company-tab]').forEach(button => {
    const selected = button.dataset.companyTab === activeTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $$('[data-company-controls]').forEach(panel => { panel.hidden = panel.dataset.companyControls !== activeTab; });
  $('#aiReport').setAttribute('aria-labelledby', activeTab === 'facts' ? 'companyFactsTab' : 'companyAnalysisTab');
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
  const identity = $('#companyIdentityMark');
  if (identity) {
    const find = rows => (rows || []).find(row => row.instrumentUid === selection.instrumentUid) || {};
    const company = { ...find(state.bootstrap?.companyAnalysisInstruments), ...find(state.bootstrap?.instruments), ...find(state.marketCalendarUi?.getCatalog()) };
    identity.innerHTML = instrumentMark(company);
    watchInstrumentImages(identity);
    const position = find(state.bootstrap?.clientProduct?.openPositions);
    $('#companyIdentityText').innerHTML = `<h3>${escapeText(company.name || 'Выберите компанию')}</h3><p>${escapeText([company.ticker, company.exchange, company.sector].filter(Boolean).join(' · '))}</p>`;
    $('#companyIdentityQuote').innerHTML = position.currentPriceNanos != null ? `<strong>${escapeText(quoteMoney(position.currentPriceNanos, position.priceCurrency || company.currency))}</strong><small>Котировка: ${escapeText(formatDate(position.asOf))}</small>` : '<small>Текущая котировка не загружена</small>';
  }
  const view = companyView(selection);
  let notice = '';
  const factsTab = state.companyTab === 'facts';
  const factsPending = state.companyPending?.key === selection.key && state.companyPending?.kind === 'facts';
  const report = factsTab ? state.companyFacts?.get(selection.instrumentUid) || (view.report?.llmUsed !== true ? view.report : null) : view.analysisReport || view.report;
  if (!factsTab && (view.phase === 'loading' || view.phase === 'error')) {
    const title = view.phase === 'loading' ? 'Готовим AI-разбор' : 'AI-разбор не получен';
    const retained = view.report ? view.report.llmUsed === true ? 'Ниже показан предыдущий AI-разбор.' : 'Ниже показаны сохранённые факты без AI.' : '';
    notice = `<section role="status" aria-live="polite"><h4>${title}</h4><p>${escapeText(view.message)} ${retained}</p></section>`;
  }
  if (report) renderCompanyReport(report, notice);
  else $('#aiReport').innerHTML = `<div class="ai-report-content">${notice || `<div class="empty-state"><h3>${selection.instrumentUid ? factsPending ? 'Загружаем показатели' : 'Факты пока не загружены' : 'Выберите компанию для разбора'}</h3><p>${escapeText(factsTab ? factsPending ? 'Получаем сохранённые показатели и источники.' : view.factsMessage || 'Выберите компанию. Если данные недоступны, повторите загрузку кнопкой «Обновить факты».' : 'Выберите тему и нажмите «Подготовить AI-разбор». Модель использует публичные сведения о компании.')}</p></div>`}</div>`;
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
  const metricValue = (value, compact = false) => {
    if (value == null) return 'Нет данных';
    const text = String(value);
    if (!/^-?\d+(?:\.\d+)?$/u.test(text)) return text;
    const number = Number(text);
    if (compact && Number.isFinite(number) && Math.abs(number) >= 1e6 && Math.abs(number) <= Number.MAX_SAFE_INTEGER) {
      return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 2 }).format(number);
    }
    const [whole, fraction] = text.split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ' ')}${fraction ? `,${fraction}` : ''}`;
  };
  const metricUnit = (unit) => ({ RUB: '₽', USD: '$', EUR: '€', CNY: '¥', PTS: 'п.', currency: 'ден. ед.', ratio: '×', shares: 'акций', units: 'ед.', years: 'лет', days: 'дн.' })[unit] || unit;
  const metricTable = (rows) => `<div class="table-scroll"><table class="company-metrics"><thead><tr><th>Показатель</th><th>Значение</th><th>Отчётный период</th></tr></thead><tbody>${rows.map((metric) => `<tr><th scope="row">${escapeText(metric.label || metric.key)}</th><td>${escapeText(metricValue(metric.value))}${metric.value != null && metric.unit ? ` ${escapeText(metricUnit(metric.unit))}` : ''}</td><td>${escapeText(metric.period || 'Период не указан')}</td></tr>`).join('')}</tbody></table></div>`;
  const metricIcon = metric => /debt|долг|risk|риск|liabil/iu.test(`${metric.key} ${metric.label}`) ? 'i-shield' : /revenue|profit|income|выруч|прибыл|доход/iu.test(`${metric.key} ${metric.label}`) ? 'i-overview' : 'i-operations';
  const metricSection = knownMetrics.length ? `<dl class="company-key-metrics">${knownMetrics.slice(0, 6).map(metric => `<div><dt><svg aria-hidden="true"><use href="#${metricIcon(metric)}"/></svg>${escapeText(metric.label || metric.key)}</dt><dd title="${escapeText(metricValue(metric.value))}${metric.unit ? ` ${escapeText(metricUnit(metric.unit))}` : ''}" aria-label="${escapeText(metricValue(metric.value))}${metric.unit ? ` ${escapeText(metricUnit(metric.unit))}` : ''}">${escapeText(metricValue(metric.value, true))}${metric.unit ? ` ${escapeText(metricUnit(metric.unit))}` : ''}</dd><small>${escapeText(metric.period || 'Период не указан')}</small></div>`).join('')}</dl>` : '<p class="empty-copy">Финансовые показатели компании пока не сохранены. Нужны данные отчётности с указанным периодом.</p>';
  const extraMetrics = metrics.filter((metric) => !knownMetrics.slice(0, 6).includes(metric));
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
  state.companyTab = 'facts';
  const view = companyView(selection);
  const requestNumber = ++state.companyRequest;
  state.companyPending = { ...selection, requestNumber, kind: 'facts' };
  renderCompanyStatus();
  try {
    const result = await request(`/api/ai/company-facts?instrumentUid=${encodeURIComponent(instrumentUid)}`);
    if (state.companyPending?.requestNumber !== requestNumber) return;
    view.report = { ...result, llmUsed: false };
    state.companyFacts ||= new Map();
    state.companyFacts.set(instrumentUid, view.report);
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
      if (state.currentView === 'ai' && companySelection().instrumentUid !== instrumentUid) void ensureCompanyFacts();
    }
  }
}

function ensureCompanyFacts() {
  const { instrumentUid } = companySelection();
  if (!instrumentUid || state.companyTab !== 'facts' || state.companyPending || state.companyFacts?.has(instrumentUid)) return;
  state.companyFactsAttempted ||= new Set();
  if (state.companyFactsAttempted.has(instrumentUid)) return;
  state.companyFactsAttempted.add(instrumentUid);
  return loadCompanyFacts();
}

function bindUi() {
  $('#riskSummaryAccount').addEventListener('change', event => { state.riskSummaryAccount = event.target.value; renderRiskPlan(state.bootstrap); });
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.view, button)));
  $$('[data-go-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.goView)));
  $$('[data-system-section]').forEach((button) => button.addEventListener('click', () => {
    activateView('system', button);
    const labels = { subscription: 'Подписка', support: 'Поддержка', access: 'Доступы' };
    $('#systemTitle').textContent = labels[button.dataset.systemSection];
    $('#systemDescription').textContent = {subscription:'Возможности вашего плана, срок доступа и продление.',support:'Поможем разобраться с подключением, данными и работой приложения.',access:'Участники и доступ к Workspace.'}[button.dataset.systemSection];
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
  $('#syncNowButton').addEventListener('click', () => { if (!$('#syncButton').disabled) void startSync(); });
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
  $('#marketChartType').addEventListener('change', event => state.marketChart?.setType(event.target.value));
  $('#operationsPrevious').addEventListener('click', () => changeOperationPage(-1));
  $('#operationsNext').addEventListener('click', () => changeOperationPage(1));
  $('#riskCalculatorForm').addEventListener('submit', (event) => { event.preventDefault(); updateRiskCalculator(); });
  $('#riskCalculatorForm').elements.assetType.addEventListener('change', updateRiskCalculator);
  $('#riskCalculatorForm').addEventListener('input', updateRiskCalculator);
  state.selectRiskTab = initRiskTabs();
  initLedgerTabs();
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
    void selectStatisticsRange(({ '1m': 'month', '3m': 'quarter', '6m': 'halfyear', '1y': 'year', all: 'all' })[button.dataset.range] || 'month');
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
  $('#aiInstrument').addEventListener('change', () => { renderSelectedCompany(); void ensureCompanyFacts(); });
  $('#aiFocus').addEventListener('change', renderSelectedCompany);
  $$('[data-company-tab]').forEach((button, index, buttons) => {
    const select = target => { state.companyTab = target.dataset.companyTab; renderSelectedCompany(); void ensureCompanyFacts(); };
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - index : event.key === 'Home' ? 0 : event.key === 'End' ? 1 : null;
      if (next === null) return;
      event.preventDefault(); select(buttons[next]); buttons[next].focus();
    });
  });
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
    const environment = 'live';
    if ($('#captureEnvironment').value !== 'live') {
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
  initAutomaticLedgerFilters();
  $('#statisticsPeriodForm').addEventListener('submit', (event) => { event.preventDefault(); });
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
    example: 'Учебный пример: 2 фьючерсных контракта, шаг цены 10 п., стоимость шага 15 ₽. Рост расчётной цены с 3200 до 3250 п. даёт VM = (3250 - 3200) / 10 × 15 × 2 = +150 ₽.',
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
    formula: 'Просадка = ((Дно просадки − Пик баланса) / Пик баланса) × 100%',
    variables: [
      { name: 'Пик баланса', desc: 'Максимальное значение капитала портфеля до начала падения' },
      { name: 'Дно просадки', desc: 'Минимальное значение портфеля до восстановления к новому пику' }
    ],
    example: 'Портфель вырос до 1 000 000 ₽, затем снизился до 850 000 ₽. Изменение от пика: (850 000 − 1 000 000) / 1 000 000 × 100% = −15%. Величина просадки — 15%.',
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
  const grid = $('#glossaryGrid'), detail = $('#glossaryDetail');
  if (!grid || !detail) return;
  const terms = glossaryEntries(FINANCIAL_TERMS, { category: state.glossaryCategory, query: state.glossaryFilter, direction: state.glossarySort || 'asc' });
  const rendered = glossaryMarkup(terms, state.glossarySelected, FINANCIAL_TERMS);
  state.glossarySelected = rendered.selected;
  $('#glossaryCount').textContent = `Найдено: ${terms.length}`;
  grid.innerHTML = rendered.list;
  detail.innerHTML = rendered.detail;
}

function initGlossary() {
  $('#glossarySort')?.addEventListener('click', event => {
    state.glossarySort = state.glossarySort === 'desc' ? 'asc' : 'desc';
    event.currentTarget.setAttribute('aria-label', state.glossarySort === 'desc' ? 'Сортировка от Я до А' : 'Сортировка от А до Я');
    event.currentTarget.querySelector('span').textContent = state.glossarySort === 'desc' ? 'Я–А' : 'А–Я';
    renderGlossary();
  });
  $('[data-view-panel="glossary"]')?.addEventListener('click', event => {
    const topic = event.target.closest('[data-glossary-topic]');
    const related = event.target.closest('[data-glossary-related]');
    if (topic || related) {
      state.glossaryFilter = '';
      $('#glossaryInlineSearch').value = '';
      state.glossaryCategory = topic ? topic.dataset.glossaryTopic : 'all';
      if (related) state.glossarySelected = related.dataset.glossaryRelated;
      $$('[data-glossary-cat]').forEach(button => {
        const active = button.dataset.glossaryCat === state.glossaryCategory;
        button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      });
      renderGlossary(); $('#glossaryDetail').focus({ preventScroll: true }); return;
    }
    const button = event.target.closest('[data-glossary-term]');
    if (!button) return;
    state.glossarySelected = button.dataset.glossaryTerm;
    renderGlossary();
    $('#glossaryDetail').focus({ preventScroll: true });
  });
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
    const riskPanel = row.target && document.getElementById(row.target)?.closest('[data-risk-panel]');
    if (riskPanel) state.selectRiskTab?.(riskPanel.dataset.riskPanel);
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
document.addEventListener('invest:catalog-updated', () => {
  if (!state.bootstrap) return;
  prepareDisplayLabels(state.bootstrap);
  renderPortfolio(analyticsDisplayData());
});
for (const button of $$('[data-analytics-unit]')) button.addEventListener('click', () => { state.analyticsChartMode = button.dataset.analyticsUnit; renderAnalyticsChartOnView(); });
const personalAvailable=(!runtimeAdapter || state.bootstrap?.preview?.interactiveTutorial===true) && state.bootstrap?.preview?.localReview!==true;
if(personalAvailable) { $('#personalSettings').hidden=false; state.personalUi = initWorkspacePreferences({ request, showToast, onPresentation:applyPresentation }); }
else $('#personalSettings').hidden = true;
if (!runtimeAdapter) initPriceAlerts({ request, getBootstrap: () => state.bootstrap, readOnly: state.bootstrap?.preview?.localReview === true && state.bootstrap?.environment !== 'fixture', showToast: (message, error) => showToast(message, error), activateView });
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
connectTableSort($('#positionsBody').closest('table'),['name','type','openedAt','quantityNanos','averagePriceNanos','positionValueNanos','share','totalPnlNanos'],sort=>{state.sorts.positions=sort;renderPortfolio(analyticsDisplayData());});
connectTableSort($('#operationsBody').closest('table'),['name','occurredAt','type','quantityNanos','paymentNanos','commissionNanos','state'],sort=>{state.sorts.operations=sort;renderOperations({operations:state.operationRows});});
connectTableSort($('#closedPositionsBody').closest('table'),['name','type','openedAt','closedAt','quantityNanos','entryPriceNanos','positionCostNanos','pnlNanos'],sort=>{state.sorts.closed=sort;state.listPages.delete('closedPositions');renderClosedPositions(state.bootstrap);});
connectTableSort($('#tradingPlanBody').closest('table'),['name','direction','allocationRate','entryPriceNanos','exitPriceNanos','expectedHold'],sort=>{state.sorts.plan=sort;state.listPages.delete('tradingPlan');renderRiskPlan(analyticsDisplayData());});
startTranslation();
