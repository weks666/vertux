import {renderPortfolioResultBreakdown} from './portfolio-result-breakdown.js';
import { currentPositionResultPresentation } from './current-position-result.js';
import {createInstrumentPicker} from './instrument-picker.js';
import {initRailSelection} from './rail-selection.js';
var companyPicker;
import { renderSecurityPositionAverage, renderSecurityPositionValue, renderSecurityPositionResult, validSecurityPositionMetrics } from './security-position-metrics.js';
import {createDeepAnalytics} from './deep-analytics.js';
import {createSavedResearchWorkspace} from './saved-research-workspace.js';
import {createTodayOverviewUi} from './today-overview-ui.js';
import {createTodayOverviewBinder} from './today-overview-binder.js';
import {createPositionReconciliation} from './position-reconciliation.js';
import {createPerformanceMethodsUi} from './performance-methods-ui.js';
import {createObservedNavRiskUi} from './observed-nav-risk-ui.js';
import {createSavedAssetClassesUi} from './saved-asset-classes-ui.js';
import {createAllocationPlanUi} from './allocation-plan-ui.js';
import {createCashComparisonUi} from './cash-comparison-ui.js';
import {createInternalCashTransfersUi} from './internal-cash-transfers-ui.js';
import {createShareTransferValuationsUi} from './share-transfer-valuations-ui.js';
import {createBrokerReportsUi} from './broker-reports-ui.js';
import {createDirectShareShockUi} from './direct-share-shock-ui.js';
import {createDirectShareConcentrationUi} from './direct-share-concentration-ui.js';
import {createFutureExposureUi} from './future-exposure-ui.js';
import {createPortfolioReviewUi} from './portfolio-review-ui.js';
import {createBookedComponentsUi} from './booked-components-ui.js';
import {installAccountQuickPick} from './account-quick-pick.js';
import {createLocalResultWorkspace} from './local-result-workspace.js';
import {createLocalMethodWorkspace} from './local-method-workspace.js';
import {createLocalObservedRiskWorkspace} from './local-observed-risk-workspace.js';
import {createReferencePriceUi} from './reference-price-ui.js';
import {createBondCashflowUi} from './bond-cashflow-ui.js';
import {createInstrumentContext} from './instrument-context.js';
import {mountInstrumentContextHeader, instrumentContextReason} from './instrument-context-ui.js';
import { expandBootstrapPayload } from './bootstrap-payload.js';
import { initTerminal } from './terminal.js';
import { createHistoryLoader, historyProgressCopy } from './history-backfill.js';
import {tbankIcon} from './brand-icons.js';
import { sortRows, connectTableSort } from './table-sort.js';
import { instrumentContributions, cashFlowChartMarkup, operationExecutionPresentation, operationChildPaymentsMarkup, variationMarginPresentation } from './analytics-presentation.js';
import { filterLedgerRows, validDateRange, sumMoneyByCurrency, summarizeOperationFees, relativeBarWidth, createFilterScheduler } from './analytics-filters.js';
import { money, decimalNanos, positionQuantity, convertNanos, financialMetric } from './number-format.js';
import {fundamentalMetricBody} from './financial-metric.js';
import {companyClaimEvidence,renderClaimEvidence} from './claim-evidence.js';
import {renderContextEvidence} from './context-evidence.js';
import {buildCompanyContextEvidence} from './context-evidence-adapters.js';
import { instrumentMark, issuerName, watchInstrumentImages } from './instrument-mark.js';
import { ui, setLanguage, startTranslation } from './ui-language.js';
import { createWorkspaceNavigation } from './account-module/v1.3.0/workspace-navigation.js';
import {workspaceNavigationActions,initWorkspaceCustomization} from './workspace-customization.js';
import {createWorkspaceSettingsStore} from './workspace-settings-store.js';
import {createRefreshDisplayPreference} from './refresh-display-preference.js';
import {createDirectNavigation} from './task-navigation-ui.js';
import {initNexusWorkbench} from './nexus-workbench-ui.js';
import {mountSettingsLayout} from './settings-layout.js';
import {resolveTaskRoute} from './task-navigation-model.js';
import { initWorkspacePreferences } from './personal-workspace.js';
import {createPersonalPreferencesTransferUi} from './personal-preferences-transfer-ui.js';
import { FEATURE_TERMS } from './product-features.js';
import { createSearchActions } from './search-actions.js';
import {createResearchQuerySearch} from './research-query-search.js';
import { createSearchContinuation } from './search-continuation.js';
import { initMarketCalendar } from './market-calendar.js';
import {createOperationDetailsDialog} from './operation-details-dialog.js';
import { createSyncController, createDisplayedRefreshClock, syncProgressCopy, syncWarningCopy, syncRefreshPresentation } from './sync-controller.js';
import { createEquityChart, createMarketChart, createAnalyticsReturnChart, normalizeEquityPoints, normalizeMarketCandles, setChartPresentation } from './charts.js';
import { runtimeAdapter } from './demo-runtime.js';
import { initPriceAlerts } from './price-alerts.js';
import { initWorkspaceNotifications } from './workspace-notifications.js';
import { calculateRiskDraft } from './risk-calculator.js';
import { renderBondPositionValue, validBondPositionValue } from './bond-position-value.js';
import { renderBondPositionAverage, renderBondPositionResult, validBondPositionMetrics } from './bond-position-metrics.js';
import { renderFuturePositionAverage, renderFuturePositionValue, renderFuturePositionMetrics, validFuturePositionMetrics } from './future-position-metrics.js';
import { initTradingPlan } from './trading-plan-ui.js';
import { createNexusAiUi } from './nexus-ai-ui.js';
import { planCatalogInstrument } from './plan-catalog.js';
import { initLedgerTabs, metricNote, signedClass, resultTrend } from './reference-ui.js';
import { glossaryEntries, glossaryMarkup, initRiskTabs } from './knowledge-workspace.js';
import { financialFormula, financialFormulaVariables } from './financial-formulas.js';
import { orderAccounts, readAccountPins, writeAccountPins, dailyPositionSummary } from './account-layout.js';

const state = {
  bootstrap: null,
  sorts: {},
  displayCurrency: 'RUB',
  language: 'ru',
  currentView: 'overview',
  navigationRevision: 0,
  analyticsView: 'instrument',
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
  pendingPeriod: null,
  periodRequest: 0,
  periodLoading: false,
  listPages: new Map(),
  analyticsAccount: '',
  analyticsChartMode: 'rubles',
  analyticsChartModeTouched: false,
  marketOverview: null,
  marketOverviewPending: false,
  tradingPlanUi: null,
  referencePriceUi: null,
  companyAvailability: null,
  companyRequest: 0,
  companyViews: new Map(),
  companyPending: null,
  companyTab: 'facts',
  companyFacts: new Map(),
};

let chartOrigin=null,terminalContextHeader=null;
const instrumentContext = createInstrumentContext();
const displayedRefreshClock = createDisplayedRefreshClock();
const pendingPeriodViews = new Set();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

function formatMoney(value, currency = 'RUB', { native = false } = {}) {
  return money(value,currency,{locale:state.language,target:native?currency:state.displayCurrency,rates:state.bootstrap?.displayFx?.rates});
}
function signedMoney(value,currency='RUB',options={}) {
  const formatted=formatMoney(value,currency,options);
  return value!=null && BigInt(value)>0n && formatted!=='—' ? '+'+formatted : formatted;
}
function formatQuantity(value) { return decimalNanos(value,{digits:9,locale:state.language}); }
function assetLabel(type) { return ({share:'Акция',future:'Фьючерс',futures:'Фьючерс',bond:'Облигация',etf:'Фонд',currency:'Валюта',crypto:'Криптовалюта',option:'Опцион',sp:'Структурная нота',dfa:'ЦФА'})[type]||'Инструмент'; }
function quoteMoney(value,currency) { return formatMoney(value,currency,{native:true}); }
function positionShare(row,data=state.bootstrap) {
  // Futures use the same denominator, but are explicitly labelled as exposure.
  if(row.positionValueNanos==null||['share','etf'].includes(row.assetType)&&!validSecurityPositionMetrics(row.securityPositionMetrics,row)||row.assetType==='bond'&&!validBondPositionValue(row.bondPositionValue,row)||row.assetType==='future'&&!validFuturePositionMetrics(row.futurePositionMetrics,row))return null;
  const total=data?.portfolio?.currentTotalNanos??data?.portfolio?.totalNanos;
  const value=convertNanos(row.positionValueNanos,row.positionValueCurrency||row.priceCurrency,'RUB',data?.displayFx?.rates);
  return value!=null&&total!=null&&BigInt(total)>0n?Number(BigInt(value)*1000000n/BigInt(total))/1000000:null;
}
const positionReaders={name:r=>instrumentDisplay(r).ticker||instrumentDisplay(r).name,type:r=>r.assetType+':'+r.direction,openedAt:r=>r.openedAt?Date.parse(r.openedAt):null,quantityNanos:r=>r.quantityNanos==null?null:BigInt(r.quantityNanos)<0n?-BigInt(r.quantityNanos):BigInt(r.quantityNanos),averagePriceNanos:r=>r.entryPriceNanos??r.averagePriceNanos,share:r=>positionShare(r,analyticsDisplayData())};

// Compact KPI cards carry one short context line and, where it reads at a
// glance, a thin meter. The words stay in the DOM; the bar is decorative.
function kpiDetail(valueNode, { line = null, meter = null, split = null, marker = null } = {}) {
  // Decorative only: test stubs and detached values are skipped.
  const card = typeof Element !== 'undefined' && valueNode instanceof Element ? valueNode.closest('div') : null;
  if (!card) return;
  let sub = card.querySelector(':scope > .kpi-sub');
  if (!sub && line) { sub = document.createElement('span'); sub.className = 'kpi-sub'; valueNode.after(sub); }
  if (sub) { sub.textContent = line || ''; sub.hidden = !line; }
  let bar = card.querySelector(':scope > .kpi-meter');
  const fill = split ?? meter;
  if (fill == null || !Number.isFinite(fill)) { bar?.remove(); return; }
  if (!bar) { bar = document.createElement('span'); bar.className = 'kpi-meter'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i><b></b>'; card.append(bar); }
  bar.dataset.kind = split != null ? 'split' : 'fill';
  bar.style.setProperty('--fill', Math.max(0, Math.min(1, fill)) * 100 + '%');
  bar.querySelector('b').hidden = marker == null;
  if (marker != null) bar.style.setProperty('--marker', marker * 100 + '%');
}
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

function formatMoneyAndRate(amountNanos, rate, currency = 'RUB', options = {}) {
  const amount = signedMoney(amountNanos, currency, options);
  const percent = formatPercentage(rate, { signed: true });
  return `<strong>${escapeText(amount)}</strong><small class="return-rate">${escapeText(percent)}</small>`;
}

function formatDate(value, withSeconds = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const locale=state.language==='en'?'en-GB':'ru-RU',key=locale+':'+Boolean(withSeconds);
  const formatters=formatDate.formatters??=new Map();
  if(!formatters.has(key))formatters.set(key,new Intl.DateTimeFormat(locale,{timeZone:'Europe/Moscow',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:withSeconds?'2-digit':undefined}));
  return `${formatters.get(key).format(date)} ${state.language==='en'?'MSK':'мск'}`;
}

function formatShortDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const locale=state.language==='en'?'en-GB':'ru-RU',formatters=formatShortDate.formatters??=new Map();
  if(!formatters.has(locale))formatters.set(locale,new Intl.DateTimeFormat(locale,{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}));
  return formatters.get(locale).format(new Date(value));
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
  terminal: ['Терминал', 'График, позиции участников и уведомления'],
  ai: ['Фундаментальный анализ', 'Показатели компании и источники'],
  'nexus-ai': ['Nexus AI', 'Помощник по вашим идеям и исследованиям'],
  sync: ['Синхронизация', 'Качество данных и история проверок'],
  system: ['Системный раздел', 'Vertux Service Center'],
  glossary: ['Словарь терминов', 'Инвестиционный справочник и формулы'],
};

function invalidateLocalExplanations(){state.allocationPlanUi?.contextChanged();state.bondCashflowUi?.contextChanged();state.directShareConcentrationUi?.contextChanged();state.brokerReportsUi?.contextChanged();state.internalTransfersUi?.contextChanged();state.shareValuationsUi?.contextChanged();state.portfolioReviewUi?.contextChanged();state.localResultWorkspace?.contextChanged();state.localMethodWorkspace?.contextChanged();state.localObservedRiskWorkspace?.contextChanged();syncPortfolioReviewVisibility();}
function syncPortfolioReviewVisibility(){queueMicrotask(()=>{state.portfolioReviewUi?.setActive(state.currentView==='analytics'&&state.analyticsView==='reviews');state.allocationPlanUi?.setActive(state.currentView==='analytics'&&['portfolio','capital'].includes(state.analyticsView)&&state.deepAnalytics?.getPortfolioArea()==='risk'&&!$('#allocationPlan').hidden);});}

function activateView(view, trigger = null, { focusMain = true, activateResearch = true, ensureEventNews = true, taskRoute = null } = {}) {
  state.navigationRevision++;
  // Preserve existing workspace shortcuts and links to the former Instruments route.
  if (view === 'instruments') view = 'terminal';
  const viewChanged = state.currentView !== view;
  // Reset the old surface before changing layout. Doing this after toggling
  // every panel forces an extra synchronous reflow in the navigation handler.
  if (viewChanged) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    $('#mainContent').scrollTop = 0;
  }
  if(view==='analytics'&&document.body.dataset.navigationMode==='classic'&&['capital','trading'].includes(state.analyticsView))state.deepAnalytics?.showTaskView('portfolio');
  state.terminalUi?.activate(view);
  if(view==='terminal')terminalContextHeader?.update();
  state.currentView = view;
  document.body.dataset.currentView=view;
  renderSurfacePeriod();
  document.dispatchEvent(new CustomEvent('invest:view-changed',{detail:view}));
  $('.quality-strip').hidden=view!=='sync';
  $$('.view').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  if(view!=='terminal'&&state.deferredBootstrap&&state.bootstrap)renderBootstrap(state.bootstrap,{background:true});
  flushPeriodViews(view);
  state.deepAnalytics?.refreshQueryArchive();
  invalidateLocalExplanations();
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
  if (view === 'terminal') requestAnimationFrame(renderMarketChart);
  if (view === 'overview') requestAnimationFrame(renderEquityChart);
  if(view==='overview')requestAnimationFrame(renderAnalyticsChartOnView);
  if (view === 'analytics' && activateResearch) { void state.deepAnalytics?.activate(); requestAnimationFrame(renderAnalyticsChartOnView); void refreshMarketVision(); }
  if (view === 'glossary') requestAnimationFrame(renderGlossary);
  if (view === 'ai') syncCompanyContext();
  if (view === 'events' && ensureEventNews) void state.marketCalendarUi?.ensureNews();
  if (['settings','profile'].includes(view)) void mountAccountCenter(view);
  if (focusMain) $('#mainContent').focus({ preventScroll: true });
  state.taskNavigation?.sync(taskNavigationContext(),taskRoute);
}

function renderSurfacePeriod() {
  const applicable = ['overview', 'operations'].includes(state.currentView)
    || (state.currentView === 'analytics' && ['portfolio','capital','trading','reviews'].includes(state.analyticsView));
  $('#statisticsPeriodForm').dataset.periodApplicable = String(applicable);
  renderAnalyticsStartup();
}

let accountCenter = null;
const navigationActions=workspaceNavigationActions(),workspaceSettings=createWorkspaceSettingsStore({actions:navigationActions,menuIds:[...document.querySelectorAll('.rail .nav-item')].map(button=>button.dataset.view||button.dataset.systemSection)});
const workspaceNavigation=createWorkspaceNavigation({key:'vertux-invest',title:'Invest Workspace',actions:navigationActions,storage:workspaceSettings.shortcutStorage,
 navigate:view=>['subscription','support'].includes(view)?document.querySelector(`[data-system-section="${view}"]`)?.click():activateView(view)});
function syncAccountWorkspaceSettings(clearDraft=false) {
  if(!accountCenter?.controller)return;
  const root=accountCenter.shadowRoot,confirmed=workspaceSettings.status();
  accountCenter.state.appSettings={...accountCenter.state.appSettings,shortcuts:workspaceNavigation.read()};
  if(clearDraft)for(const input of root.querySelectorAll('#shortcutForm input')){delete input.dataset.dirty;delete input.dataset.error;input.removeAttribute('aria-invalid');}
  accountCenter.controller.viewChanged(accountCenter.getAttribute('section')||'settings');
  if(!confirmed.ready){for(const control of root.querySelectorAll('#shortcutForm input,#shortcutForm button,#resetShortcutsButton'))control.disabled=true;root.querySelector('#shortcutFeedback').textContent=confirmed.message;}
}
workspaceSettings.subscribe(reason=>syncAccountWorkspaceSettings(reason==='identity'||reason==='error'));
// The account center is a vendored Nexus module. Invest adds its v2 sheet to
// the shadow root and hides the module's shortcut card: Invest's own menu and
// shortcuts live in Настройки → «Работа с приложением».
function decorateAccountCenter(center) {
  const root = center?.shadowRoot;
  if (!root) return;
  if (document.documentElement.dataset.ui === 'v2' && !root.querySelector('link[data-invest-v2]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = new URL('./account-center-v2.css?v=0.6.48', document.baseURI).href; link.dataset.investV2 = '';
    root.append(link);
  }
  const card = root.querySelector('#shortcutForm')?.closest('article');
  if (card && !card.hidden) {
    card.hidden = true;
    const note = document.createElement('p');
    note.className = 'workspace-shortcuts-moved';
    note.append('Меню и сочетания клавиш Invest настраиваются в разделе ');
    const open = document.createElement('button');
    open.type = 'button'; open.textContent = '«Работа с приложением»';
    open.addEventListener('click', () => document.querySelector('[data-settings-tab="workspace"]')?.click());
    note.append(open, '.');
    card.after(note);
  }
}
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
      accountCenter.addEventListener('vertux-account-ready',()=>{decorateAccountCenter(accountCenter);syncAccountWorkspaceSettings(true);});
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
    syncAccountWorkspaceSettings();
  } catch { host.innerHTML = '<div class="empty-state"><h3>Не удалось открыть аккаунт</h3><p>Перезапустите Workspace и повторите.</p></div>'; }
}
function applyInvestTheme(value) {
  const theme = ['graphite','light'].includes(value) ? value : 'invest';
  document.documentElement.dataset.workspaceTheme = theme;
  const selector = $('#workspaceTheme');if (selector) selector.value=theme;
}
applyInvestTheme('invest');
state.customization=initWorkspaceCustomization({navigation:workspaceNavigation,store:workspaceSettings,onNavigationPreferences:snapshot=>state.taskNavigation?.setPresentation(snapshot)});
const refreshDisplayPreference=createRefreshDisplayPreference({store:workspaceSettings,request,onState:({active,pending,message})=>{
  const control=document.querySelector('input[data-refresh-status]');
  if(control)control.disabled=pending||!workspaceSettings.status().ready;
  if(active&&message){const status=document.querySelector('.workspace-customization-status');if(status)status.textContent=message;}
}});
window.addEventListener('pagehide',()=>refreshDisplayPreference.dispose(),{once:true});

function taskNavigationContext(){return {view:state.currentView,analyticsView:state.analyticsView,riskTab:$('[data-risk-tab][aria-selected="true"]')?.dataset.riskTab||'journal'};}
function navigateTask(id,route,{focus=true}={}){
  if(route.mode&&!state.deepAnalytics?.showTaskView(route.mode))return false;
  if(route.riskTab&&!state.selectRiskTab)return false;
  activateView(route.view,null,{focusMain:focus,activateResearch:route.mode==='instrument',taskRoute:id});
  if(route.riskTab)state.selectRiskTab(route.riskTab);
  if(focus){window.scrollTo({top:0,left:0,behavior:'instant'});$('#mainContent').scrollTop=0;}
  return true;
}

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

function openServiceSection(section, { focusMain = true } = {}) {
  const labels = { subscription: 'Подписка', support: 'Поддержка', access: 'Доступы' };
  if (!Object.hasOwn(labels, section)) return;
  const button = $(`[data-system-section="${section}"]`);
  if (!button) return;
  activateView('system', button, { focusMain });
  $('#viewTitle').textContent = labels[section];
  $('#viewContext').textContent = 'Ваш Workspace';
  $('#systemTitle').textContent = labels[section];
  $('#systemDescription').textContent = { subscription: 'Возможности вашего плана, срок доступа и продление.', support: 'Поможем разобраться с подключением, данными и работой приложения.', access: 'Участники и доступ к Workspace.' }[section];
  mountServiceCenter(section);
}

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
    component.addEventListener('vertux-service-section-change', event => {
      openServiceSection(event.detail?.section, { focusMain: false });
    });
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
  if(state.personalPreferenceScope!==identity.preferenceScope){state.personalPreferenceScope=identity.preferenceScope;state.personalPreferencesDenied=false;state.personalPreferencesEpoch=(state.personalPreferencesEpoch||0)+1;}
  state.personalUi?.updateAccess();state.personalTransferUi?.update();state.marketCalendarUi?.updateReminderAccess();
  state.customization?.bind(identity,{preview:fixture||data.preview?.localReview===true});
  void refreshDisplayPreference.bind({key:identity.preferenceScope,allowed:data.capabilities?.persistentRefreshStatus===true&&identity.role==='owner'&&!fixture&&data.preview?.localReview!==true});
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
  const displayName = identity.displayName || identity.name || 'Vertux';
  document.dispatchEvent(new CustomEvent('invest:identity',{detail:identity}));
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
  const hasSuccessfulSync = typeof data.quality?.hasSuccessfulSync === 'boolean'
    ? data.quality.hasSuccessfulSync : (data.syncRuns || []).some((run) => run.status === 'completed');
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
    ready: ['Подключение подтверждено. Если в истории не хватает данных, нажмите «Повторно загрузить историю» выше.', 'Готово'],
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
  $('#dataStateStatus').hidden=true;
  $('#dataStateStatus').textContent=quality.error?'Не удалось обновить данные':quality.stale?'Портфель требует обновления':'';
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
  $('#qualityReconcile').textContent = quality.reconciliation === 'matched' ? 'Записи сопоставлены' : quality.reconciliation === 'warning' ? 'Есть расхождения записей' : 'Не выполнена';
  $('#qualityReconcile').title = 'Проверка количества импортированных записей и состава инструментов. Сравнение количества по сохранённым снимкам доступно в Аналитике; оно не подтверждает денежную сверку.';
  $('#qualityCoverage').textContent = quality.coverage || 'Отчёт брокера не загружен';
  $('#qualityState').textContent = quality.stateLabel || 'Готово';
  $('#qualityState').className = quality.stale ? 'stale' : quality.error ? 'error' : 'ready';
  $('#qualityNote').textContent = quality.note || 'локальное хранилище';
}

function coverageSummary(coverage, fallback = 'Недостаточно данных за период.') {
  return ({ empty: 'Нет оценки стоимости за период.', partial_history: 'Нет оценки на начало периода.',
    insufficient_history: 'Нужны оценки в разные даты.', invalid_starting_value: 'Начальная стоимость не положительна.',
    unsupported_transfers: 'Переносы ещё не сверены.', missing_fx: 'Не сохранён курс денежных потоков.',
    incomplete_cash_flows: 'Данные денежных потоков неполные.',
    incomplete_operations: 'История операций неполная.', unaligned_accounts: 'Выберите отдельный счёт.' })[coverage?.state] || fallback;
}

function renderEvidenceNote(element, summary, detail = '') {
  element.textContent = summary;
  if (detail && detail !== summary) element.innerHTML = `${escapeText(summary)} <button class="term-help" type="button" data-evidence-note="${escapeText(detail)}" aria-label="Подробнее: ${escapeText(summary)}" aria-expanded="false">i</button>`;
}

function portfolioReturnExplanation(data) {
  return [data?.analytics?.returnReason,
    data?.analytics?.returnMethod || 'Изменение стоимости за период минус внешние пополнения и плюс выводы, делённое на начальную стоимость.',
    'Комиссии уже отражены в стоимости счёта и повторно не вычитаются. Процент рассчитывается только при положительной начальной стоимости и достаточной истории.',
    'Это результат к начальной стоимости, не TWR и не MWR/XIRR: даты пополнений не взвешиваются.'].filter(Boolean).join(' ');
}

function portfolioResultExplanation(data) {
  const details = data?.portfolio?.resultDetails;
  if (details?.contractVersion !== 'portfolio-result-v1') return [data?.portfolio?.pnlReason,
    'Денежный результат за выбранный период после комиссий.', portfolioReturnExplanation(data)].filter(Boolean).join(' ');
  const period = details.period;
  const date = value => value ? new Intl.DateTimeFormat(state.language === 'en' ? 'en-GB' : 'ru-RU', {
    timeZone: period.timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit',
  }).format(new Date(value)) + ' мск' : 'дата неизвестна';
  const amount = value => formatMoney(value, details.currency, { native: true });
  const accounts = data.clientProduct?.portfolios || [];
  const selectedName = details.scope.portfolioIds.length === 1
    ? accounts.find(row => row.id === details.scope.portfolioIds[0])?.label : null;
  const partialStart = period.observedFrom !== period.requestedFrom;
  const partialEnd = period.observedTo !== period.requestedTo;
  return [
    `Расчёт в ${details.currency}.`, selectedName ? `Счёт: ${selectedName}.` : `Выбранных счетов: ${details.scope.portfolioIds.length}.`,
    partialStart || partialEnd ? `Выбрано: ${date(period.requestedFrom)} — ${date(period.requestedTo)}. Ниже — только доступные оценки.` : '',
    `${partialStart ? 'Первая доступная оценка' : 'Начало'} (${date(details.opening.at)}): ${amount(details.opening.valueNanos)}.`,
    `Пополнения минус выводы между этими оценками: ${amount(details.externalFlows.valueNanos)}.`,
    `Инвестиционный результат: ${amount(details.investmentResult.valueNanos)}.`,
    `${partialEnd ? 'Последняя доступная оценка' : 'Конец'} (${date(details.closing.at)}): ${amount(details.closing.valueNanos)}.`,
    'Результат = конец − начало − пополнения + выводы. Комиссии повторно не вычитаются.',
    data.portfolio.realizedNanos!=null&&data.portfolio.feesNanos!=null&&details.investmentResult.valueNanos!=null
      ? 'Сопоставление: реализовано до комиссий '+amount(data.portfolio.realizedNanos)+' − комиссии '+amount(data.portfolio.feesNanos)+' + разница с результатом по стоимости '+amount((BigInt(details.investmentResult.valueNanos)-BigInt(data.portfolio.realizedNanos)+BigInt(data.portfolio.feesNanos)).toString())+' = '+amount(details.investmentResult.valueNanos)+'.' : '',
    'Эта разница не является дополнительной комиссией. Она ещё не разложена по изменениям оценки открытых позиций, валютным изменениям и прочим операциям.',
    'Процент — результат к начальной стоимости; не TWR/XIRR.',
    details.evidence.dataMode === 'synthetic' ? 'Учебные данные.' : 'Сохранённые локальные данные.',
    'Даты относятся к сохранённым наблюдениям.',
    details.evidence.valuationMethod === 'reconstructed' ? 'Оценки восстановлены по операциям и дневным ценам.' : '',
    details.investmentResult.reason || details.return.reason || '',
    period.pendingOperationTail ? period.currentValuationAt
      ? `Более свежая текущая оценка на ${date(period.currentValuationAt)} в этот результат не входит.`
      : 'Более свежие текущие оценки не входят в этот результат: операции до них ещё не покрыты.' : '',
    'Независимая денежная сверка не выполнена.',
  ].filter(Boolean).join(' ');
}

function renderAccountCards(data) {
  const scope = String(state.bootstrap?.identity?.preferenceScope || 'local');
  const pins = readAccountPins(localStorage, scope);
  const rows = orderAccounts((data.clientProduct?.portfolios || []).map(row => ({...row, id:row.preferenceKey || row.id})), pins);
  const host = $('#portfolioCards');
  const expanded = host.querySelector('details')?.open ?? host.accountsExpanded ?? false;
  host.accountsExpanded = expanded;
  host.closest('.portfolio-breakdown').hidden = rows.length === 1;
  const signature = JSON.stringify([rows, pins, state.language, state.displayCurrency, data.displayFx, data.portfolio?.currentTotalNanos, data.portfolio?.totalNanos]);
  if (host.accountSignature === signature) return;
  host.accountSignature = signature;
  const focusedPin = host.contains(document.activeElement) ? document.activeElement.dataset.pinAccount : null;
  if (rows.length === 1) {
    host.replaceChildren();
    if (focusedPin) $('#statisticsAccount')?.focus({ preventScroll: true });
    return;
  }
  const card = row => `<div class="portfolio-row">
    <span class="account-card-name" title="${escapeText(formatDate(row.asOf))}"><i class="account-dot" aria-hidden="true"></i><strong>${escapeText(row.label)}</strong><button type="button" class="account-pin" data-pin-account="${escapeText(row.id)}" aria-pressed="${pins.includes(row.id)}" aria-label="${pins.includes(row.id) ? 'Открепить' : 'Закрепить'} счёт: ${escapeText(row.label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 3 6 0-1 6 4 4v2h-5v6l-1-2-1 2v-6H6v-2l4-4-1-6Z"/></svg></button></span>
    <span class="numeric"><strong>${escapeText(formatMoney(row.valueNanos, row.currency || 'RUB'))}</strong><small>${escapeText(formatPercentage(row.shareOfTotalRate))}</small></span>
    <div class="allocation-track" aria-label="${escapeText(formatPercentage(row.shareOfTotalRate))} от общей суммы"><i style="--allocation:${Math.max(0, Math.min(100, Number(row.shareOfTotalRate || 0) * 100))}%"></i></div>
  </div>`;
  host.innerHTML = rows.length ? rows.slice(0, 2).map(card).join('') + (rows.length > 2 ? `<details class="accounts-more"${expanded ? ' open' : ''}><summary>Все счета · ${rows.length}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg></summary><div class="accounts-overflow">${rows.map(card).join('')}</div></details>` : '') + `<div class="accounts-total"><span>Общая стоимость</span><strong>${escapeText(formatMoney(data.portfolio?.currentTotalNanos ?? data.portfolio?.totalNanos, data.portfolio?.currency))}</strong></div>` : '<p class="empty-copy">Нет сохранённых портфелей. Запустите синхронизацию.</p>';
  host.querySelectorAll('[data-pin-account]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.pinAccount;
    writeAccountPins(localStorage, scope, pins.includes(id) ? pins.filter(pin => pin !== id) : [...pins, id]);
    renderAccountCards(data);
    host.querySelector(`[data-pin-account="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }));
  if (focusedPin) host.querySelector(`[data-pin-account="${CSS.escape(focusedPin)}"]`)?.focus({ preventScroll:true });
}

function renderPortfolio(data) {
  if (!data || ['pending','error'].includes(data.analyticsState)) return;
  const portfolio = data.portfolio || {};
  const selected = data.selectedPeriod;
  const coverage = data.dataCoverage || {};
  for(const [selector,value]of [['.headline-copy',portfolio.currentTotalNanos ?? portfolio.totalNanos],['.headline-pnl',portfolio.netPnlNanos],['#realizedPnl',portfolio.realizedNanos],['#feesValue',portfolio.feesNanos]]){const node=$(selector);if(node)(node.closest('[data-workspace-panel]')||node).dataset.panelResult=value==null?'unknown':signedClass(value)||'neutral';}
  $('#portfolioValue').textContent = formatMoney(portfolio.currentTotalNanos ?? portfolio.totalNanos, portfolio.currency);
  $('#portfolioValueLabel').textContent = 'Стоимость портфеля';
  const selectedAccount = $('#statisticsAccount');
  const soleAccount = data.clientProduct?.portfolios?.length === 1 ? data.clientProduct.portfolios[0] : null;
  const accountLabel = selectedAccount?.value ? selectedAccount.selectedOptions[0]?.textContent : soleAccount?.label || 'Все выбранные счета';
  $('#portfolioContext').textContent = [accountLabel, (portfolio.currentAsOf || portfolio.asOf) ? 'Оценка на ' + formatDate(portfolio.currentAsOf || portfolio.asOf) : 'Оценка пока недоступна'].filter(Boolean).join(' · ');
  $('#netPnlContext').textContent = [$('#workspacePeriod')?.selectedOptions[0]?.textContent || 'Выбранный период', portfolio.pnlReason ? 'Есть ограничения данных' : 'Результат после комиссий'].join(' · ');
  const today = dailyPositionSummary(data.clientProduct?.openPositions || []);
  const daily = $('#portfolioDayChange');
  daily.className = `portfolio-day-change ${signedClass(today?.pnlNanos)}`;
  daily.innerHTML = today ? `${escapeText(today.rate == null ? signedMoney(today.pnlNanos, today.currency) : formatPercentage(today.rate, {signed:true}))}<small>сегодня по позициям</small>` : '<span>—</span><small>сегодня по позициям</small>';
  daily.title = today ? 'Сумма дневных результатов текущих открытых позиций по данным брокера. Не включает уже закрытые позиции; не является полной доходностью портфеля за день.' : 'Дневные данные неполные, относятся к прошлой дате или не подтверждены в одной валюте.';
  const valuationDetails = [`Оценка стоимости: ${formatDate(portfolio.asOf)}.`,
    portfolio.startTotalNanos != null ? `Первая оценка в периоде: ${formatMoney(portfolio.startTotalNanos, portfolio.currency)} · ${formatDate(portfolio.startAsOf)}.` : 'Начальная оценка не сохранена.',
    portfolio.currentTotalNanos != null ? `Последняя стоимость: ${formatMoney(portfolio.currentTotalNanos, portfolio.currency)} · ${formatDate(portfolio.currentAsOf)}.` : '', coverage.reason || ''].filter(Boolean).join(' ');
  $('#portfolioValueHelp').setAttribute('data-evidence-note', valuationDetails);
  $('#netPnl').textContent = signedMoney(portfolio.netPnlNanos, portfolio.currency);
  renderPortfolioResultBreakdown($('#portfolioResultBreakdown'),portfolio,(value,currency)=>formatMoney(value,currency,{native:true}));
  renderEvidenceNote($('#netPnlMeta'), portfolio.pnlReason ? coverageSummary(coverage) : 'После комиссий', portfolio.pnlReason);
  $('#netPnl').className = signedClass(portfolio.netPnlNanos);
  $('.headline-pnl').dataset.tone = signedClass(portfolio.netPnlNanos) || 'neutral';
  $('#netPnlRate').textContent = data.analytics?.netReturn == null ? '— · процент не рассчитан'
    : formatPercentage(data.analytics.netReturn, { signed: true }) + ' к начальной стоимости';
  $('#netPnlRate').title = portfolioReturnExplanation(data);
  $('#netPnlRate').className = `metric-rate ${data.analytics?.netReturn == null ? '' : signedClass(portfolio.netPnlNanos)}`;
  const resultHelp = $('#netPnlHelp'), resultExplanation = portfolioResultExplanation(data);
  const resultHelpChanged = resultHelp.dataset.evidenceNote !== resultExplanation;
  resultHelp.dataset.evidenceNote = resultExplanation;
  if (resultHelpChanged && resultHelp.getAttribute('aria-expanded') === 'true') resultHelp.dispatchEvent(new Event('focusin', { bubbles: true }));
  for (const [id, value] of [['realizedPnl', portfolio.realizedNanos], ['unrealizedPnl', portfolio.unrealizedNanos]]) $('#'+id).className = signedClass(value);
  $('#realizedPnl').textContent = signedMoney(portfolio.realizedNanos, portfolio.currency);
  const realizedNote = [portfolio.realizedReason, portfolio.realizedMethod].filter(Boolean).join(' ');
  const realizedHelp = $('#realizedPnlHelp'), realizedChanged = realizedHelp.dataset.evidenceNote !== realizedNote;
  if (!realizedNote) delete realizedHelp.dataset.evidenceNote;
  metricNote($('#realizedPnl'), realizedNote);
  $('#realizedPnlMeta').textContent = portfolio.realizedNanos == null ? portfolio.realizedReason || '' : '';
  $('#realizedPnlMeta').hidden = !$('#realizedPnlMeta').textContent;
  if (realizedChanged && realizedHelp.getAttribute('aria-expanded') === 'true') realizedHelp.dispatchEvent(new Event('focusin', { bubbles: true }));
  $('#realizedPnl').closest('.metric-ledger > div').dataset.tone = signedClass(portfolio.realizedNanos) || 'neutral';
  const currentResult = currentPositionResultPresentation(portfolio.currentPositionResult,{locale:state.language});
  const currentHost = $('#currentPositionResult'), priorDetails = currentHost.querySelector('[data-current-result-details]');
  const currentScope = JSON.stringify([state.analyticsAccount, selected?.from, selected?.to]);
  const sameResultScope = currentHost.dataset.scope === currentScope;
  const resultFocus = sameResultScope && priorDetails?.querySelector('summary') === document.activeElement;
  const resultOpen = sameResultScope && priorDetails?.open;
  currentHost.dataset.scope = currentScope; currentHost.dataset.state = currentResult.state;
  currentHost.innerHTML = currentResult.html;
  currentHost.querySelector('[data-current-result-details]').open = Boolean(resultOpen);
  if (resultFocus) currentHost.querySelector('summary').focus({ preventScroll: true });
  $('#unrealizedPnl').textContent = currentResult.headline;
  $('#unrealizedPnl').className = currentResult.tone;
  renderEvidenceNote($('#markFreshness'), currentResult.note);
  $('#feesValue').textContent = formatMoney(portfolio.feesNanos, portfolio.currency);
  const feesNote = [portfolio.feesReason, portfolio.feesMethod].filter(Boolean).join(' ');
  const feesHelp = $('#feesValueHelp'), feesChanged = feesHelp.dataset.evidenceNote !== feesNote;
  if (!feesNote) delete feesHelp.dataset.evidenceNote;
  metricNote($('#feesValue'), feesNote);
  $('#feesValueMeta').textContent = portfolio.feesNanos == null ? portfolio.feesReason || '' : '';
  $('#feesValueMeta').hidden = !$('#feesValueMeta').textContent;
  if (feesChanged && feesHelp.getAttribute('aria-expanded') === 'true') feesHelp.dispatchEvent(new Event('focusin', { bubbles: true }));
  $('#feesValue').closest('.metric-ledger > div').dataset.tone = portfolio.feesNanos == null || BigInt(portfolio.feesNanos) === 0n ? 'neutral' : 'warning';
  const feeTotal = portfolio.currentTotalNanos ?? portfolio.totalNanos;
  const feeShare = portfolio.feesNanos != null && feeTotal != null && BigInt(feeTotal) > 0n ? Number(BigInt(portfolio.feesNanos) * 1000000n / BigInt(feeTotal)) / 1000000 : null;
  kpiDetail($('#feesValue'), { line: feeShare == null ? null : formatPercentage(feeShare) + ' от стоимости портфеля' });
  kpiDetail($('#realizedPnl'), { line: portfolio.realizedNanos == null ? null : 'по закрытым сделкам периода' });
  $('#drawdownValue').textContent = formatPercentage(portfolio.maxDrawdownRate == null ? null : -Math.abs(portfolio.maxDrawdownRate));
  $('#drawdownValue').closest('.metric-ledger > div').dataset.tone = portfolio.maxDrawdownRate == null ? 'neutral' : 'negative';
  renderEvidenceNote($('#drawdownPeriod'), portfolio.maxDrawdownRate === null || portfolio.maxDrawdownRate === undefined
    ? coverageSummary(coverage, 'Нужны оценки в разные даты.')
    : portfolio.riskCoverage?.state === 'partial' ? 'По активным интервалам.' : 'По оценкам стоимости за период.', portfolio.maxDrawdownRate == null ? coverage.reason : portfolio.riskCoverage?.reason || portfolio.drawdownPeriod);
  metricNote($('#unrealizedPnl'), $('#markFreshness').textContent);
  metricNote($('#drawdownValue'), $('#drawdownPeriod').textContent);
  kpiDetail($('#drawdownValue'), { line: portfolio.maxDrawdownRate == null ? null : 'от пика до минимума за период' });
  $('#equityVersion').textContent = data.calculationVersion || 'Версия расчёта не указана';

  renderAccountCards(data);

  renderOpenPositions(data);
}

function renderOpenPositions(data) {
  const rows = sortRows(data.clientProduct?.openPositions || [],state.sorts.positions,{
    ...positionReaders,
    totalPnlNanos:row=>row.assetType==='future'?row.contractPnlNanos??null:row.totalPnlNanos,
  });
  $('#openPositionsCount').textContent = String(rows.length);
  $('#positionsBody').innerHTML = rows.length ? rows.map((row) => {
    const display=instrumentDisplay(row),currency=row.pnlCurrency||row.currency||'RUB';
    const chart=instrumentContext.resolve(row.instrumentUid);
    const resultClass = signedClass;
    const share=positionShare(row,data);
    return `<tr>
      <td><span class="instrument-with-mark">${instrumentMark(row,display)}<span class="instrument-cell"><strong>${escapeText(display.ticker||display.name)}</strong><small title="${escapeText(display.name)}">${escapeText(display.name!==display.ticker?display.name:'')}</small><button type="button" class="position-chart-link" data-position-chart="${escapeText(row.instrumentUid)}" aria-label="Открыть график: ${escapeText(display.ticker||display.name)}" ${chart.meta?'':'disabled'} title="${escapeText(chart.meta?'График этой позиции в терминале':instrumentContextReason(chart))}">Открыть график <span aria-hidden="true">↗</span></button></span></span></td>
      <td><span class="asset-type">${ui(assetLabel(row.assetType))}</span><small class="position-direction">${row.direction==='short'?'Short':'Long'}</small></td>
      <td title="${escapeText(row.openedAtNote||'')}">${escapeText(row.openedAt?formatShortDate(row.openedAt):'—')}</td>
      <td class="numeric">${escapeText(positionQuantity(row,{locale:state.language}))}</td>
      <td class="numeric" title="${escapeText(row.entryPriceNote||'')}">${row.assetType==='future'?renderFuturePositionAverage(row,{locale:state.language}):row.assetType==='bond'?renderBondPositionAverage(row,{locale:state.language}):['share','etf'].includes(row.assetType)?renderSecurityPositionAverage(row,{locale:state.language}):escapeText(quoteMoney(row.entryPriceNanos ?? row.averagePriceNanos,row.entryPriceCurrency||row.priceCurrency))}</td>
      <td class="numeric" title="${escapeText(row.positionValue?.note||'')}">${row.assetType==='future'?renderFuturePositionValue(row,{amountText:formatMoney(row.positionValueNanos,row.positionValueCurrency)}):row.assetType==='bond'?renderBondPositionValue(row,{locale:state.language,amountText:formatMoney(row.positionValueNanos,row.positionValueCurrency)}):['share','etf'].includes(row.assetType)?renderSecurityPositionValue(row,{amountText:formatMoney(row.positionValueNanos,row.positionValueCurrency)}):escapeText(formatMoney(row.positionValueNanos,row.positionValueCurrency||row.currency||row.priceCurrency))}</td>
      <td class="numeric" title="${row.assetType === 'future' ? 'Экспозиция: номинальная стоимость контрактов / капитал. Это не доля вложенных денег и не гарантийное обеспечение.' : 'Стоимость позиции / текущая стоимость выбранных счетов'}">${share==null?'—':escapeText(formatPercentage(share))}${row.assetType === 'future' && share != null ? '<small class="position-exposure">эксп.</small>' : ''}</td>
      ${['share','etf'].includes(row.assetType)?'<td class="numeric">'+renderSecurityPositionResult(row,{locale:state.language,amountText:validSecurityPositionMetrics(row.securityPositionMetrics,row)?signedMoney(row.totalPnlNanos,row.pnlCurrency):'—'})+'</td>':row.assetType==='future'?renderFuturePositionResult(row):row.assetType==='bond'?'<td class="numeric">'+renderBondPositionResult(row,{locale:state.language,amountText:validBondPositionMetrics(row.bondPositionMetrics,row)?signedMoney(row.totalPnlNanos,row.pnlCurrency):'—'})+'</td>':`<td class="numeric ${resultClass(row.totalPnlNanos)}" title="${escapeText(row.method || '')}"><strong>${escapeText(signedMoney(row.totalPnlNanos,currency))}</strong>${row.totalReturnRate==null?'':`<small class="return-rate">${escapeText(formatPercentage(row.totalReturnRate,{signed:true}))}</small>`}</td>`}
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty-cell">Нет сохранённых открытых позиций. Запустите синхронизацию.</td></tr>';
  watchInstrumentImages($('#positionsBody'));

}

function renderFuturePositionResult(row) {
  return '<td class="numeric" data-position-result="future">' + renderFuturePositionMetrics(row,{locale:state.language}) + '</td>';
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
  if (!data || ['pending','error'].includes(data.analyticsState)) return;
  const rows = sortRows(Array.isArray(data.operations)?data.operations:[],state.sorts.operations,{name:r=>instrumentDisplay(r).ticker||instrumentDisplay(r).name,occurredAt:r=>r.occurredAt?Date.parse(r.occurredAt):null,type:r=>r.label||r.type,state:r=>r.stateLabel||r.state});
  state.operationRows = rows;
  state.operationPage = Math.max(0, Math.min(Math.trunc(page) || 0, Math.ceil(rows.length / OPERATIONS_PAGE_SIZE) - 1));
  const start = state.operationPage * OPERATIONS_PAGE_SIZE;
  const pageRows = rows.slice(start, start + OPERATIONS_PAGE_SIZE);
  $('#operationsBody').innerHTML = pageRows.length ? pageRows.map((row,index) => {
    const display = instrumentDisplay(row);
    const detail = [display.ticker && display.name !== display.ticker ? display.name : '', portfolioDisplay(row)].filter(Boolean).join(' · ');
    const execution = operationExecutionPresentation(row, { formatQuantity, formatDate: value => formatDate(value, true) });
    const childPayments = operationChildPaymentsMarkup(row.childPayments, { formatQuantity, formatDate: value => formatDate(value, true) });
    const nativeCommission = Object.hasOwn(row, 'commissionCurrency'), commissionCurrency = nativeCommission ? row.commissionCurrency : row.currency;
    const commission = commissionCurrency ? formatMoney(row.commissionNanos, commissionCurrency, { native: nativeCommission }) : '—';
    return `<tr><td><span class="instrument-with-mark">${row.instrumentUid?instrumentMark(display):'<span class="instrument-mark settlement-mark" aria-hidden="true"><svg><use href="#i-operations"/></svg></span>'}<span class="instrument-cell"><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText(detail)}</small>${row.instrumentUid?`<button type="button" class="position-chart-link" data-operation-chart="${escapeText(row.instrumentUid)}" aria-label="Открыть график: ${escapeText(display.ticker||display.name)}" ${instrumentContext.resolve(row.instrumentUid).meta?'':'disabled'}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 3v18h17M7 15l4-5 4 3 5-7"/></svg></button>`:''}</span></span></td><td>${escapeText(formatDate(row.occurredAt, true))}</td><td>${escapeText(row.label || row.type)}</td><td class="numeric">${execution.quantityMarkup}</td><td class="numeric">${escapeText(formatMoney(row.paymentNanos, row.currency))}</td><td class="numeric">${escapeText(commission)}</td><td><span class="status-chip ${execution.warning ? 'stale' : 'fresh'}">${escapeText(execution.statusLabel)}</span>${execution.note ? `<small class="cell-note">${escapeText(execution.note)}</small>` : ''}<button type="button" class="operation-details-button" data-operation-details="${start+index}" aria-label="Детали операции ${escapeText(display.ticker||display.name)}">Детали операции</button></td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty-cell">Нет нормализованных операций для выбранного периода.</td></tr>';
  watchInstrumentImages($('#operationsBody'));
  $('#operationsCount').textContent = rows.length
    ? `Операции ${(start + 1).toLocaleString('ru-RU')}–${Math.min(start + OPERATIONS_PAGE_SIZE, rows.length).toLocaleString('ru-RU')} из ${rows.length.toLocaleString('ru-RU')}`
    : 'Операций не найдено';
  $('#operationsPrevious').disabled = state.operationPage === 0;
  $('#operationsNext').disabled = start + OPERATIONS_PAGE_SIZE >= rows.length;
}

const operationDetails=createOperationDetailsDialog({formatQuantity,formatDate:value=>formatDate(value,true),formatMoney});
$('#operationsBody').addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;if(button.dataset.operationDetails!==undefined){const row=state.operationRows[Number(button.dataset.operationDetails)];if(row)operationDetails.open(row,instrumentDisplay(row));}if(button.dataset.operationChart){openContextChart(button.dataset.operationChart,{route:'operations',label:'К операциям',fallbackLabel:'К операциям',restoreFocus:()=>{if(button.isConnected){button.focus({preventScroll:true});return true;}return false;}});}});
function changeOperationPage(direction) {
  renderOperations({ operations: state.operationRows }, { page: state.operationPage + direction });
}

function renderClosedPositions(data) {
  if (!data || ['pending','error'].includes(data.analyticsState)) return;
  const coverage = analyticsDisplayData(data)?.clientProduct?.closedPositionsCoverage;
  const ambiguous = coverage?.state === 'ambiguous';
  const filtered = filterLedgerRows(data.clientProduct?.closedPositions || [], state.operationFilterValues || {}, { dateKey: 'closedAt', display: instrumentDisplay, accountLabel: portfolioDisplay });
  const rows = sortRows(filtered,state.sorts.closed,{...positionReaders,closedAt:r=>r.closedAt?Date.parse(r.closedAt):null});
  const result = sumMoneyByCurrency(rows, 'pnlNanos', 'pnlCurrency');
  const historical = rows.find(row => row.resultMethodVersion === 'closed-share-currency-v1');
  $('#closedSummaryCount').textContent = ambiguous ? '—' : rows.length.toLocaleString(state.language === 'en' ? 'en-US' : 'ru-RU');
  $('#closedSummaryResult').textContent = !ambiguous && result.amounts.length ? result.amounts.map(row => formatMoney(row.nanos, row.currency, { native: true })).join(' · ') : '—';
  const missingFutures = rows.some(row => row.assetType === 'future' && row.pnlNanos == null);
  let marginLink=$('#closedSummaryAnalytics');if(!marginLink){marginLink=document.createElement('button');marginLink.type='button';marginLink.id='closedSummaryAnalytics';marginLink.className='closed-summary-link';marginLink.textContent='Результат в деньгах за период';$('#closedSummaryNote').after(marginLink);marginLink.addEventListener('click',()=>{activateView('analytics');state.deepAnalytics?.showTaskView('capital');state.deepAnalytics?.revealPortfolioTarget($('#bookedComponents'));});}marginLink.hidden=ambiguous||!missingFutures;
  if(!ambiguous&&!result.amounts.length&&rows.length)$('#closedSummaryResult').textContent='Не рассчитан';
  $('#closedSummaryNote').textContent = ambiguous ? coverage.reason : result.missing ? `${result.known} из ${rows.length} с денежным результатом.${missingFutures ? ' Фьючерсы: изменение цены показано в пунктах. Вариационная маржа учитывается отдельно в аналитике за период и не распределена по закрытиям.' : ''}` : rows.length
    ? historical ? 'После распределённых комиссий операций · RUB по историческим курсам' : 'После комиссий · по выбранным фильтрам' : 'Нет закрытых позиций за период';
  $('#closedSummaryResult').className = result.amounts.length === 1 ? signedClass(result.amounts[0].nanos) : '';
  const wins = rows.filter(row => /^\d+$/u.test(String(row.pnlNanos ?? '')) && BigInt(row.pnlNanos) > 0n).length;
  const losses = rows.filter(row => /^-\d+$/u.test(String(row.pnlNanos ?? ''))).length;
  const withResult = wins + losses;
  kpiDetail($('#closedSummaryCount'), ambiguous || !withResult ? {} : { line: `${wins} в плюсе · ${losses} в минусе` + (withResult < rows.length ? ` · из ${withResult} с денежным результатом` : ''), split: wins / withResult });
  const average = !ambiguous && result.amounts.length === 1 && result.known ? (BigInt(result.amounts[0].nanos) / BigInt(result.known)).toString() : null;
  kpiDetail($('#closedSummaryResult'), { line: average == null ? null : 'в среднем ' + formatMoney(average, result.amounts[0].currency, { native: true }) + ' на позицию' });
  const closedHelp = $('#closedSummaryHelp'), closedNote = [$('#closedSummaryNote').textContent, historical?.method].filter(Boolean).join(' ');
  const closedNoteChanged = closedHelp.dataset.evidenceNote !== closedNote;
  closedHelp.dataset.evidenceNote = closedNote;
  if (closedNoteChanged && closedHelp.getAttribute('aria-expanded') === 'true') closedHelp.dispatchEvent(new Event('focusin', { bubbles: true }));
  $('#closedSummaryNote').hidden = !ambiguous && !result.missing;
  const pageRows = pagedRows('closedPositions', rows, 20, () => renderClosedPositions(data));
  $('#closedPositionsBody').innerHTML = pageRows.length ? pageRows.map((row,index) => {
    const pnl = row.pnlNanos == null ? null : BigInt(row.pnlNanos);
    const priceCurrency = row.assetType === 'future' ? 'PTS' : Object.hasOwn(row, 'entryPriceCurrency') ? row.entryPriceCurrency : row.priceCurrency || row.currency || 'RUB';
    const exitCurrency = row.assetType === 'future' ? 'PTS' : Object.hasOwn(row, 'exitPriceCurrency') ? row.exitPriceCurrency : priceCurrency;
    const entryPrice = priceCurrency ? quoteMoney(row.entryPriceNanos, priceCurrency) : '—';
    const exitPrice = exitCurrency ? quoteMoney(row.exitPriceNanos, exitCurrency) : '—';
    const display = instrumentDisplay(row);
    return `<tr>
      <td><span class="instrument-with-mark">${instrumentMark(display)}<span class="instrument-cell"><strong>${escapeText(display.ticker||display.name)}</strong><small>${escapeText(display.name!==display.ticker?display.name:'')}</small></span></span></td>
      <td><span class="asset-chip">${assetLabel(row.assetType)}</span><small class="cell-note">${row.direction === 'short' ? 'Шорт' : 'Лонг'}</small></td>
      <td title="${escapeText(formatDate(row.openedAt, true))}">${escapeText(formatShortDate(row.openedAt))}</td>
      <td title="${escapeText(formatDate(row.closedAt, true))}">${escapeText(formatShortDate(row.closedAt))}</td>
      <td class="numeric">${escapeText(positionQuantity(row,{locale:state.language}))}</td>
      <td class="numeric" title="${escapeText('Цена закрытия: ' + exitPrice)}">${escapeText(entryPrice)}</td>

      <td class="numeric ${pnl == null ? '' : pnl < 0n ? 'negative' : 'positive'}">${row.assetType === 'future' && pnl == null
        ? `<strong class="${row.returnRate == null ? '' : Number(row.returnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))} цены</strong><small class="cell-note inline-help"><button class="term-help" type="button" data-evidence-note="${escapeText(row.pnlReason || 'Вариационная маржа показана отдельно за период.')}" aria-label="Сведения о результате фьючерса" aria-expanded="false">i</button></small>`
        : formatMoneyAndRate(row.pnlNanos, row.returnRate, row.pnlCurrency || row.currency || 'RUB', { native: row.nativeCurrency === true })
          + (pnl == null && row.pnlReason ? `<small class="cell-note closed-result-note">${escapeText(row.pnlReason)}</small>` : '')}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" class="empty-cell">${escapeText(ambiguous ? coverage.reason : 'За выбранный период нет восстановленных закрытых позиций. Выберите другой период; для расчёта нужны обе стороны сделки.')}</td></tr>`;
  watchInstrumentImages($('#closedPositionsBody'));
}

function applyOperationFilters({ announce = true } = {}) {
  if (!state.bootstrap) return;
  const form = $('#operationFilters');
  const values = { ...Object.fromEntries(new FormData(form)), account: state.analyticsAccount };
  if ((values.from || values.to) && !validDateRange(values.from, values.to)) return;
  state.operationFilterValues = values;
  const rows = filterLedgerRows(state.bootstrap.operations || [], values, { display: instrumentDisplay, accountLabel: portfolioDisplay });
  renderOperations({ operations: rows });
  const fees = summarizeOperationFees(rows);
  const feeCoverage = analyticsDisplayData(state.bootstrap)?.clientProduct?.operationIntegrity?.period;
  const ambiguousFees = feeCoverage?.state === 'ambiguous';
  $('#operationSummaryFees').textContent = !ambiguousFees && fees.amounts.length ? fees.amounts.map(row => formatMoney(row.nanos, row.currency, { native: true })).join(' · ')
    : !ambiguousFees && fees.known && !fees.missing ? '0' : '—';
  $('#operationSummaryFeesNote').textContent = ambiguousFees ? feeCoverage.reason : fees.missing ? `${fees.known} из ${fees.known + fees.missing} операций с известной комиссией` : 'По исполненным операциям периода';
  $('#operationFeesHelp').dataset.evidenceNote = $('#operationSummaryFeesNote').textContent;
  $('#operationSummaryFeesNote').hidden = !ambiguousFees && !fees.missing;
  state.listPages?.delete('closedPositions');
  renderClosedPositions(state.bootstrap);
  if (announce) showToast(`Фильтры применены: ${rows.length} операций.`);
}

function initAutomaticLedgerFilters() {
  const form = $('#operationFilters');
  const status = $('#operationFilterStatus');
  const invalidatePeriod = () => {
    state.periodRequest++; state.periodController?.abort(); state.periodController = null;
    state.pendingPeriod = null; state.periodLoading = false;
    $('.analytics-chart-surface')?.setAttribute('aria-busy', 'false');
    $('#statisticsPeriodForm').setAttribute('aria-busy', 'false'); invalidateLocalExplanations();
  };
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
      invalidateLocalExplanations();
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
  const openDateDraft = () => {
    scheduler.cancel(); periodScheduler.cancel();
    state.operationPeriodDraft = false; state.statisticsPeriodDraft = true;
    invalidatePeriod(); renderSelectedPeriod(analyticsDisplayData());
    $('#statisticsPeriodStatus').hidden = true;
    $('#workspacePeriod').value = 'custom';
    for (const control of $$('.context-date')) control.hidden = false;
    $('#statisticsFrom').focus();
  };
  $('#workspacePeriod')?.addEventListener('change', event => {
    const period = event.target.value;
    if (period === 'custom') { openDateDraft(); return; }
    scheduler.cancel(); periodScheduler.cancel();
    state.operationPeriodDraft = false; state.statisticsPeriodDraft = false;
    void selectPeriod({ period }, { announce: false });
  });
  $('#workspaceDateRange')?.addEventListener('click', openDateDraft);
  for (const id of ['statisticsFrom', 'statisticsTo']) $('#' + id).addEventListener('input', () => {
    scheduler.cancel(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = true; invalidatePeriod();
    const from = $('#statisticsFrom').value, to = $('#statisticsTo').value;
    if (!validDateRange(from, to)) { periodScheduler.cancel(); $('#statisticsPeriodStatus').hidden = false; $('#statisticsPeriodStatus').textContent = 'Укажите обе даты: начало не позже окончания.'; return; }
    periodScheduler.schedule({ period: 'custom', from, to });
  });
  $('#resetStatisticsPeriod').addEventListener('click', async () => {
    if(state.terminalUi?.switchAccount&&!await state.terminalUi.switchAccount(''))return;
    periodScheduler.cancel(); scheduler.cancel(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = false;
    state.analyticsAccount = ''; state.listPages = new Map();
    state.todaySelectionRevision=(state.todaySelectionRevision||0)+1; updateToday();
    void selectPeriod({ period: 'month' }, { announce: false });
  });
  for (const button of $$('[data-stat-range], [data-range]')) button.addEventListener('click', () => { scheduler.cancel(); periodScheduler.cancel(); state.operationPeriodDraft = false; state.statisticsPeriodDraft = false; });
}

function profitFactorContext(data) {
  const analytics=data.analytics||{},period=data.selectedPeriod;
  const range=period?.fromDate&&period?.toDate?`${period.fromDate} — ${period.toDate} (мск)`:period?.label||'Вся доступная история';
  const stateNote=analytics.profitFactorReason || (analytics.profitFactorState==='mixed-currencies'
    ? 'Расчёт недоступен: результаты сделок в разных валютах не складываются.'
    : analytics.profitFactorState==='no-losses'
      ? 'В выборке нет убыточных закрытых сделок: знаменатель равен нулю, числовое отношение не определено.'
      : analytics.profitFactor==null?'Недостаточно закрытых сделок с подтверждённым денежным результатом.':'Отношение рассчитано по подтверждённым денежным результатам закрытых сделок.');
  return `Профит-фактор (PF) сравнивает суммарную прибыль и суммарный убыток закрытых сделок. Формула: сумма положительных netPnl / |сумма отрицательных netPnl|. netPnl — денежный результат сделки после учтённых комиссий. Источник: сохранённые закрытые позиции с рассчитанным денежным результатом. Неизвестный результат закрытой акции делает сводный показатель недоступным; вариационная маржа фьючерсов учитывается отдельно. Период закрытия: ${range}. ${stateNote} Это отношение сумм, не средних результатов; оно само по себе не подтверждает устойчивость стратегии.`;
}

function cashFlowRowPresentation(row) {
  const currency = typeof row.currency === 'string' && /^[A-Z]{3}$/.test(row.currency.trim().toUpperCase()) ? row.currency.trim().toUpperCase() : null;
  const amountKnown = typeof row.amountNanos === 'string' && /^-?\d+$/.test(row.amountNanos);
  const dated = typeof row.occurredAt === 'string' && Number.isFinite(Date.parse(row.occurredAt));
  const unknown = row.status === 'unknown' || !currency || !amountKnown || !dated;
  return { unknown, amount: amountKnown && currency ? formatMoney(row.amountNanos, currency, { native: true }) : '—',
    date: dated ? formatDate(row.occurredAt, true) : 'Дата не определена',
    reason: unknown ? row.reason || 'Неполные данные операции; сумма не включена в график.' : null };
}

function renderAnalytics(data) {
  state.bondCashflowUi?.update(data);
  state.positionReconciliationUi?.update(data);
  state.performanceMethodsUi?.update(data);
  state.localMethodWorkspace?.update(data);
  state.observedNavRiskUi?.update(data);
  state.localObservedRiskWorkspace?.update(data);
  state.savedAssetClassesUi?.update(data);
  state.allocationPlanUi?.update(data);
  state.cashComparisonUi?.update(data);
  state.internalTransfersUi?.update(data);
  state.shareValuationsUi?.update(data);
  state.brokerReportsUi?.update(data);
  state.directShareShockUi?.update(data);
  state.directShareConcentrationUi?.update(data);
  state.futureExposureUi?.update(data);
  state.portfolioReviewUi?.update(data);
  state.bookedComponentsUi?.update(data);
  state.localResultWorkspace?.update(data);
  state.referencePriceUi?.update(data);
  state.deepAnalytics?.update(data);
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
  renderEvidenceNote($('#netReturn').nextElementSibling, analytics.returnReason ? coverageSummary(data.dataCoverage) : 'После комиссий · не TWR/XIRR', analytics.returnReason);
  $('#volatilityValue').textContent = percentage(analytics.volatility);
  kpiDetail($('#volatilityValue'), { line: analytics.volatility == null ? null : 'колебания стоимости' + (Number.isSafeInteger(analytics.volatilityObservations) ? ' · ' + analytics.volatilityObservations + ' наблюдений' : '') });
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
    ? analytics.profitFactorReason || (analytics.profitFactorState === 'no-losses' ? 'В выбранном периоде нет убыточных закрытых сделок.' : 'Для отношения прибыли к убытку нужны закрытые сделки за период.')
    : 'отношение прибыли к убытку по закрытым сделкам';
  $('#profitFactorValue').nextElementSibling.hidden = analytics.profitFactor !== null && analytics.profitFactor !== undefined;
  kpiDetail($('#winRateValue'), { split: Number.isFinite(analytics.winRate) ? analytics.winRate : null });
  const factor = Number.isFinite(analytics.profitFactor) ? analytics.profitFactor : null;
  kpiDetail($('#profitFactorValue'), { meter: factor == null ? null : factor / 2, marker: factor == null ? null : 0.5, line: factor == null ? null : factor >= 1 ? 'прибыль больше убытков' : 'убытки больше прибыли' });
  for (const id of ['netReturn','grossReturn','volatilityValue','profitFactorValue']) metricNote($('#'+id), $('#'+id).nextElementSibling.textContent);
  metricNote($('#profitFactorValue'), profitFactorContext(data));
  metricNote($('#netReturn'), portfolioReturnExplanation(data));
  resultTrend($('#netReturn'), analytics.netReturn);
  $('#analyticsChartValue').textContent = formatPercentage(analytics.netReturn, { signed:true });
  $('#analyticsChartValue').className = analytics.netReturn == null ? '' : analytics.netReturn < 0 ? 'negative' : 'positive';
  const marginPresentation = variationMarginPresentation(analytics.variationMargin, { formatQuantity });
  $('#variationMargin').textContent = marginPresentation.value;
  $('#variationMarginMeta').textContent = marginPresentation.note;
  const ranking = sortRows(instrumentContributions(analytics.instrumentRanking || []), state.sorts.contributions, { name:r=>instrumentDisplay(r).ticker||instrumentDisplay(r).name });
  if (state.sorts.contributions?.key === 'pnlNanos') ranking.sort((a,b)=>(a.currency||'RUB').localeCompare(b.currency||'RUB'));
  const rankingPage = pagedRows('instrumentRanking', ranking, 8, () => renderAnalytics(data));
  $('#instrumentRanking').innerHTML = rankingPage.length ? rankingPage.map((item, index) => {
    const display = instrumentDisplay(item);
    const currency = item.currency || 'RUB';
    const width = relativeBarWidth(item.pnlNanos, ranking.filter(row => (row.currency || 'RUB') === currency).map(row => row.pnlNanos));
    return '<tr class="contribution-row '+(item.pnlNanos != null && BigInt(item.pnlNanos)<0n?'worst':'best')+'"><td><button type="button" class="result-instrument" data-result-index="'+index+'" aria-pressed="false" aria-controls="instrumentResultInspector"><span class="instrument-with-mark">'+instrumentMark(display)+'<span class="instrument-cell"><strong>'+escapeText(display.ticker||display.name)+'</strong><small>'+escapeText(display.name!==display.ticker?display.name:'')+'</small></span></span></button></td><td><div class="relative-bar" aria-hidden="true"><i style="--bar:'+width+'%"></i></div></td><td class="numeric '+signedClass(item.pnlNanos)+'" title="'+escapeText(data.analytics?.instrumentRankingMethod||'Результат инструментов за выбранный период')+'"><strong>'+escapeText(signedMoney(item.pnlNanos,currency,{native:item.nativeCurrency===true}))+'</strong>'+(item.nativeCurrency?'<small>'+(item.nativeAmountKind==='share'?'Результат':'Маржа')+' · '+escapeText(currency)+'</small>':'')+'</td><td class="numeric">'+escapeText(formatPercentage(item.contributionRate,{signed:true}))+'</td></tr>';
  }).join('') : `<tr><td colspan="4" class="empty-cell">${escapeText(analytics.instrumentRankingReason || 'Нет результата по инструментам за выбранный период.')}</td></tr>`;
  watchInstrumentImages($('#instrumentRanking'));
  // A short scoreboard over the table: total, gains, losses, best and worst in
  // the main currency. It reads the same rows; nothing is recalculated.
  {
    const host = $('#instrumentRanking').closest('.ranking-surface');
    let board = host.querySelector('#instrumentRankingSummary');
    if (!board) { board = document.createElement('dl'); board.id = 'instrumentRankingSummary'; board.className = 'ranking-summary'; host.querySelector('.contribution-scroll')?.before(board); }
    const known = ranking.filter(row => /^-?\d+$/u.test(String(row.pnlNanos ?? '')));
    const counts = new Map(); for (const row of known) counts.set(row.currency || 'RUB', (counts.get(row.currency || 'RUB') || 0) + 1);
    const currency = counts.has('RUB') ? 'RUB' : [...counts].sort((x, y) => y[1] - x[1])[0]?.[0];
    const rows = known.filter(row => (row.currency || 'RUB') === currency), sum = list => list.reduce((total, row) => total + BigInt(row.pnlNanos), 0n);
    const gains = rows.filter(row => BigInt(row.pnlNanos) > 0n), losses = rows.filter(row => BigInt(row.pnlNanos) < 0n);
    const sorted = [...rows].sort((x, y) => (BigInt(y.pnlNanos) > BigInt(x.pnlNanos) ? 1 : BigInt(y.pnlNanos) < BigInt(x.pnlNanos) ? -1 : 0));
    const name = row => row ? instrumentDisplay(row).ticker || instrumentDisplay(row).name : '—';
    const cell = (label, value, note = '', tone = '') => '<div><dt>' + escapeText(label) + '</dt><dd class="' + tone + '">' + escapeText(value) + '</dd>' + (note ? '<small>' + escapeText(note) + '</small>' : '') + '</div>';
    board.hidden = !rows.length;
    board.innerHTML = rows.length ? cell('Итог по инструментам', signedMoney(sum(rows).toString(), currency), rows.length + ' инстр. · ' + currency, signedClass(sum(rows).toString()))
      + cell('В плюсе', gains.length ? signedMoney(sum(gains).toString(), currency) : '—', gains.length + ' инстр.', gains.length ? 'positive' : '')
      + cell('В минусе', losses.length ? signedMoney(sum(losses).toString(), currency) : '—', losses.length + ' инстр.', losses.length ? 'negative' : '')
      + cell('Лучший · худший', name(sorted[0]) + ' · ' + name(sorted.at(-1)), sorted.length > 1 ? signedMoney(sorted[0].pnlNanos, currency) + ' / ' + signedMoney(sorted.at(-1).pnlNanos, currency) : '') : '';
  }
  const rankingHost = $('#instrumentRanking').closest('.ranking-surface');
  let inspector = rankingHost.querySelector('#instrumentResultInspector');
  if (!inspector) { inspector = document.createElement('aside'); inspector.id = 'instrumentResultInspector'; inspector.className = 'result-inspector'; inspector.setAttribute('aria-label','Выбранный инструмент'); inspector.setAttribute('aria-live','polite'); rankingHost.append(inspector); }
  const resultKey = row => JSON.stringify([row.instrumentUid,row.ticker,row.currency||'RUB']);
  const inspectResult = index => {
    const item = rankingPage[index]; if (!item) return;
    const display = instrumentDisplay(item), currency = item.currency || 'RUB'; inspector.dataset.selected = resultKey(item);
    rankingHost.querySelectorAll('[data-result-index]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.resultIndex)===index)));
    inspector.innerHTML = '<small>Денежный результат · '+escapeText(currency)+'</small><h4>'+escapeText(display.ticker||display.name)+'</h4><small>'+escapeText(display.name)+'</small><strong class="result-inspector-value '+signedClass(item.pnlNanos)+'">'+escapeText(signedMoney(item.pnlNanos,currency,{native:item.nativeCurrency===true}))+'</strong><dl><div><dt>Доля результата</dt><dd>'+escapeText(formatPercentage(item.contributionRate,{signed:true}))+'</dd></div>'+(Number.isInteger(item.tradeCount)?'<div><dt>Закрытых сделок</dt><dd>'+item.tradeCount+'</dd></div>':'')+'</dl><p>'+escapeText(analytics.instrumentRankingMethod||'Результат инструментов за выбранный период. Метод зависит от типа инструмента и выбранного периода.')+'</p><p>Длина столбца сравнивает денежные суммы в одной валюте. Ноль — в центре. Доля результата может превышать 100%; это не доходность позиции.</p>';
  };
  inspector.hidden = !rankingPage.length;
  if (rankingPage.length) inspectResult(Math.max(0,rankingPage.findIndex(row=>resultKey(row)===inspector.dataset.selected)));
  else { inspector.replaceChildren(); delete inspector.dataset.selected; }
  rankingHost.querySelectorAll('[data-result-index]').forEach(button=>button.addEventListener('click',()=>inspectResult(Number(button.dataset.resultIndex))));

  const statistics = data.clientProduct?.statistics || {};
  const overall = statistics.overall || {};
  $('#tradeOutcomeMeta').textContent = overall.tradeReason || `${overall.winCount ?? 0} из ${overall.tradeCount ?? 0} закрытых`;
  const portfolioRows = statistics.perPortfolio || [];
  const accountTotals=new Map();
  for(const row of portfolioRows){
    const portfolio=(data.equityCurvesByPortfolio||[]).find(item=>item.portfolioId===row.id)?.portfolio || (portfolioRows.length===1?data.portfolio:null) || {};
    const currency=portfolio.currency||'RUB', total=accountTotals.get(currency)||{startTotalNanos:0n,totalNanos:0n,netPnlNanos:0n};
    for(const key of ['startTotalNanos','totalNanos','netPnlNanos'])total[key]=total[key]===null||portfolio[key]==null?null:total[key]+BigInt(portfolio[key]);
    accountTotals.set(currency,total);
  }
  const totalsMarkup=portfolioRows.length>1?'<tfoot>'+[...accountTotals].map(([currency,total])=>'<tr><td>Итого'+(accountTotals.size>1?' · '+escapeText(currency):'')+'</td><td class="numeric">'+escapeText(formatMoney(total.startTotalNanos,currency))+'</td><td class="numeric">'+escapeText(formatMoney(total.totalNanos,currency))+'</td><td class="numeric '+signedClass(total.netPnlNanos)+'"><strong>'+escapeText(accountTotals.size===1?formatPercentage(analytics.netReturn,{signed:true}):'')+'</strong><small class="return-rate">'+escapeText(signedMoney(total.netPnlNanos,currency))+'</small></td></tr>').join('')+'</tfoot>':'';
  $('#portfolioStatistics').innerHTML = portfolioRows.length ? `<div class="table-scroll"><table class="account-statistics-table"><thead><tr><th>Счёт</th><th class="numeric">На начало</th><th class="numeric">На конец</th><th class="numeric">Результат</th></tr></thead><tbody>${portfolioRows.map(row=>{
    const portfolio=(data.equityCurvesByPortfolio||[]).find(item=>item.portfolioId===row.id)?.portfolio || (portfolioRows.length===1?data.portfolio:null) || {};
    return `<tr><td><span class="account-card-name"><i class="account-dot" aria-hidden="true"></i>${escapeText(row.label)}</span></td><td class="numeric">${escapeText(formatMoney(portfolio.startTotalNanos,portfolio.currency))}</td><td class="numeric">${escapeText(formatMoney(portfolio.totalNanos,portfolio.currency))}</td><td class="numeric ${row.netReturnRate==null?'':row.netReturnRate<0?'negative':'positive'}" title="${escapeText(row.returnReason||row.returnMethod||'')}"><strong>${escapeText(formatPercentage(row.netReturnRate,{signed:true}))}</strong><small class="return-rate">${portfolio.netPnlNanos==null?'':escapeText(signedMoney(portfolio.netPnlNanos,portfolio.currency))}</small>${row.returnReason?`<button class="term-help" type="button" data-evidence-note="${escapeText(row.returnReason)}" aria-label="Сведения о результате счёта">i</button>`:''}</td></tr>`;
  }).join('')}</tbody>${totalsMarkup}</table></div>` : '<p class="empty-copy">Нет данных по счетам за выбранный период.</p>';

  const cashFlows = statistics.cashFlows || [];
  const incompleteFlows = cashFlows.filter(row => cashFlowRowPresentation(row).unknown).length;
  const cashChart = cashFlowChartMarkup(cashFlows, { formatMoney, language: state.language });
  const cashFlowEmpty = `<p class="empty-copy">${escapeText(statistics.cashFlowsCoverage?.state === 'ambiguous' ? statistics.cashFlowsCoverage.reason : 'В выбранном периоде нет пополнений и выводов.')}</p>`;
  const incompleteNote = incompleteFlows ? `<p class="empty-copy" role="note">Операций с неполными данными: ${incompleteFlows.toLocaleString('ru-RU')}. Они не включены в график; причины указаны в списке ниже.</p>` : '';
  $('#cashFlowChart').innerHTML = cashChart + incompleteNote || cashFlowEmpty;
  $('#cashFlowDetails').hidden = !cashFlows.length;
  const cashPage = pagedRows('cashFlowStatistics', cashFlows, 8, () => renderAnalytics(data));
  $('#cashFlowSummary').textContent = cashFlows.length ? `${cashFlows.length.toLocaleString('ru-RU')} операций в выборке${incompleteFlows ? ` · с неполными данными: ${incompleteFlows.toLocaleString('ru-RU')}` : ''}` : '';
  $('#cashFlowStatistics').innerHTML = cashPage.length ? cashPage.map(row => {
    const display = cashFlowRowPresentation(row);
    const detail = display.reason || (row.portfolioShareRate == null ? '' : `${formatPercentage(row.portfolioShareRate)} от портфеля на начало`);
    return `<div class="cash-flow-row ${row.kind === 'deposit' ? 'deposit' : 'withdrawal'}" data-cash-flow-state="${display.unknown ? 'unknown' : 'known'}"><span><strong>${row.kind === 'deposit' ? 'Пополнение' : 'Вывод средств'}</strong><small>${escapeText([display.date, row.portfolioLabel].filter(Boolean).join(' · '))}</small></span><span class="numeric"><strong>${escapeText(display.amount)}</strong><small>${escapeText(detail)}</small></span></div>`;
  }).join('') : cashFlowEmpty;

  const rankingState = $('#rankingPositionState')?.value || 'open';
  const currentHoldings = statistics.holdings || data.clientProduct?.openPositions || [];
  const monthlyAssets = statistics.rankings?.[rankingState] || (rankingState === 'closed' ? statistics.monthlyAssets || []
    : currentHoldings.map((row) => ({ ...row, returnRate: row.returnRate ?? row.totalReturnRate })).filter((row) => row.returnRate != null)
      .sort((left, right) => right.returnRate - left.returnRate));
  $('#rankingSummary').textContent = rankingState === 'open'
    ? monthlyAssets.some(row=>row.assetType==='bond') ? 'Открытые сейчас позиции: оценка брокера относительно средней стоимости; для фьючерсов — изменение цены. Сначала лучшие, затем худшие.' : 'Открытые сейчас позиции: изменение цены с момента входа. Сначала лучшие, затем худшие.'
    : overall.tradeReason || 'Сделки, закрытые за выбранный период: доходность за весь срок. Сначала лучшие, затем худшие.';
  const maxMonthly = monthlyAssets.reduce((maximum, row) => Math.max(maximum, Math.abs(Number(row.returnRate || 0))), 0.01);
  const assetPage = pagedRows('monthlyAssetChart', monthlyAssets, 8, () => renderAnalytics(data));
  $('#monthlyAssetChart').innerHTML = assetPage.length ? assetPage.map((row) => {
    const width = Math.abs(Number(row.returnRate || 0)) / maxMonthly * 100;
    const display = instrumentDisplay(row);
    return `<div class="relative-bar-row ${Number(row.returnRate || 0) < 0 ? 'worst' : 'best'}"><span><strong>${escapeText(display.ticker || display.name)}</strong><small>${escapeText([display.name !== display.ticker ? display.name : '', row.portfolioLabel, row.assetType === 'future' ? 'Фьючерс · изменение цены контракта' : row.assetType === 'bond' ? 'Облигация · оценка брокера' : '', row.month].filter(Boolean).join(' · '))}</small></span><div class="relative-bar"><i style="--bar:${width}%"></i></div><strong class="${Number(row.returnRate || 0) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))}</strong></div>`;
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
  const maxHoldingHours=Math.max(0,...holdingRows.map(row=>Number(row.holdingHours)||0));
  $('#efficiencyChart').innerHTML = holdingPage.length ? holdingPage.map((row, index) => {
    const display = instrumentDisplay(row);
    return `<div class="efficiency-row"><span>${offset + index + 1}</span><strong>${escapeText(display.ticker || display.name)}</strong><div class="relative-bar" aria-hidden="true"><i style="--bar:${maxHoldingHours?Math.max(0,Number(row.holdingHours)||0)/maxHoldingHours*100:0}%"></i></div><small>${escapeText(formatHoldingTime(row.holdingHours))}</small><b class="${row.returnRate == null ? '' : Number(row.returnRate) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.returnRate, { signed: true }))}</b><em>${escapeText([row.portfolioLabel, display.name !== display.ticker ? display.name : '', row.assetType === 'future' ? 'Фьючерс · изменение цены контракта' : row.assetType === 'bond' ? 'Облигация · оценка брокера' : '', row.holdingHours == null ? row.holdingReason : ''].filter(Boolean).join(' · '))}</em></div>`;
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
  const data = analyticsDisplayData();
  const batchPoints = !state.analyticsAccount && !points.length ? data?.snapshotBatchCurve || [] : [];
  const valuePoints = points.length ? points : batchPoints.map(point => ({ time: point.time, equityNanos: point.totalNanos }));
  if (!state.analyticsChartModeTouched && state.analyticsChartMode === 'percent' && netReturnSeries.length < 2 && valuePoints.length >= 2) {
    state.analyticsChartMode = data?.analytics?.netPnlSeries?.length>=2?'result':'rubles';
    $$('[data-analytics-unit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.analyticsUnit === state.analyticsChartMode)));
  }
  const reconstructed = coverage?.evidence === 'reconstructed';
  $$('[data-analytics-unit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.analyticsUnit === state.analyticsChartMode)));
  const percentMode = state.analyticsChartMode === 'percent',resultMode=state.analyticsChartMode==='result';
  const displaySymbol = state.displayCurrency === 'USD' ? '$' : '₽';
  $('#analyticsChartUnit').textContent = percentMode ? ui('Результат к начальной стоимости, %') : ui(batchPoints.length ? 'Сумма оценок счетов, ₽' : 'Стоимость портфеля, ₽').replace('₽', displaySymbol);
  const resultButton = $('[data-analytics-unit="result"]');if(resultButton)resultButton.textContent='Результат, '+displaySymbol;
  const valueButton = $('[data-analytics-unit="rubles"]');
  if (valueButton) valueButton.textContent = ui(batchPoints.length ? 'Сумма счетов, ₽' : 'Стоимость, ₽').replace('₽', displaySymbol);
  $('#analyticsChartTitle').textContent = percentMode ? 'Результат к начальной стоимости' : batchPoints.length ? 'Сумма оценок счетов' : 'Изменение стоимости за период';
  renderEvidenceNote($('#analyticsChartSubtitle'), percentMode
    ? 'Пополнения и выводы исключены. Результат делится на начальную стоимость · не TWR/XIRR.'
    : batchPoints.length ? 'Последовательный опрос счетов. Точки не используются для доходности.'
      : reconstructed ? 'Восстановленная история. Пополнения и выводы влияют на линию.' : 'По оценкам стоимости портфеля. Пополнения и выводы влияют на линию.', batchPoints.length
      ? data.snapshotBatchCurveNote : reconstructed
      ? reconstructedHistoryExplanation(coverage) : percentMode ? 'Накопленный результат после комиссий делится на начальную стоимость портфеля. Метод совпадает с показателем выше; это не TWR и не IRR.' : 'Каждая точка — сохранённая оценка стоимости портфеля.');
  $('#analyticsChartHelp').dataset.evidenceNote = [percentMode ? portfolioReturnExplanation(data) : $('#analyticsChartSubtitle').textContent,
    batchPoints.length ? data.snapshotBatchCurveNote : reconstructed ? reconstructedHistoryExplanation(coverage) : ''].filter(Boolean).join(' ');
  $('#analyticsChartHelp').setAttribute('aria-label', percentMode ? 'Метод: результат к начальной стоимости'
    : batchPoints.length ? 'Сведения о сумме оценок счетов' : 'Сведения о стоимости портфеля');
  $('#analyticsChartValue').textContent = percentMode ? formatPercentage(data?.analytics?.netReturn, {signed:true}) : formatMoney(batchPoints.length ? batchPoints.at(-1)?.totalNanos : data?.portfolio?.totalNanos, 'RUB');
  const returnRate=data?.analytics?.netReturn;
  $('#analyticsChartValue').className=percentMode?(returnRate>0?'positive':returnRate<0?'negative':''):resultMode?signedClass(data?.portfolio?.netPnlNanos):'';
  if(resultMode){$('#analyticsChartTitle').textContent='Результат портфеля после комиссий';$('#analyticsChartHelp').setAttribute('aria-label','Сведения о денежном результате');$('#analyticsChartUnit').textContent='Результат, '+displaySymbol;$('#analyticsChartValue').textContent=signedMoney(data?.portfolio?.netPnlNanos,'RUB');$('#analyticsChartSubtitle').textContent='Пополнения и выводы исключены. Изменение оценки портфеля за вычетом пополнений и выводов; доступно и при нулевой начальной стоимости.';$('#analyticsChartHelp').dataset.evidenceNote=$('#analyticsChartSubtitle').textContent;}
  const sourcePoints = percentMode ? netReturnSeries : resultMode?(data?.analytics?.netPnlSeries||netReturnSeries.filter(p=>p.netPnlNanos!=null)):valuePoints;
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
    : resultMode?sourcePoints.map(point=>({time:point.time,equityValue:Number(BigInt(point.netPnlNanos))/1e9})):valuePoints.map(point => ({ time: point.time, equityValue: Number(BigInt(point.equityNanos)) / 1e9 }));

  if (state.analyticsReturnChart) {
    state.analyticsReturnChart.setData(chartPoints, selectedPeriod, { mode: resultMode?'rubles':state.analyticsChartMode, metric: state.analyticsChartMode, scope: state.analyticsAccount });
  } else {
    state.analyticsReturnChart = createAnalyticsReturnChart(host, chartPoints, selectedPeriod, { mode: resultMode?'rubles':state.analyticsChartMode, metric: state.analyticsChartMode, scope: state.analyticsAccount });
  }
}

function renderAnalyticsChartOnView() {
  $$('[data-analytics-unit]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.analyticsUnit === state.analyticsChartMode)));
  const data = analyticsDisplayData();
  renderAnalyticsReturnChart(data?.clientProduct?.statistics?.overall?.equitySeries || [], data?.dataCoverage, data?.selectedPeriod, data?.analytics?.netReturnSeries || []);
}

function analyticsDisplayData(data = state.bootstrap) {
  if (['pending','error'].includes(data?.analyticsState)) return null;
  if (!data || !state.analyticsAccount) return data;
  const account = (data.equityCurvesByPortfolio || []).find((row) => row.portfolioId === state.analyticsAccount);
  if (!account) return data;
  return { ...data, portfolio: account.portfolio, analytics: account.analytics, equityCurve: account.equityCurve,
    dataCoverage: account.dataCoverage, clientProduct: { ...data.clientProduct,
      statistics: account.statistics, closedPositions: account.closedPositions || [],
      closedPositionsCoverage: account.closedPositionsCoverage, operationIntegrity: account.operationIntegrity,
      portfolios: (data.clientProduct?.portfolios || []).filter((row) => row.id === account.portfolioId),
      futureExposureAccounts: (data.clientProduct?.futureExposureAccounts || []).filter((row) => row.portfolioId === account.portfolioId),
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
  if (!data) return;
  const selected = data.selectedPeriod;
  const displayedPeriod = state.pendingPeriod || state.selectedPeriod;
  const globalPeriod = $('#workspacePeriod');
  if (globalPeriod && globalPeriod.value !== (state.statisticsPeriodDraft ? 'custom' : displayedPeriod.period)) globalPeriod.value = state.statisticsPeriodDraft ? 'custom' : displayedPeriod.period;
  if (!state.statisticsPeriodDraft) for (const input of $$('.context-date')) input.hidden = true;
  const label = selected?.label || 'Вся сохранённая история';
  if (!state.statisticsPeriodDraft) $('#statisticsPeriodStatus').textContent = `Портфель и сделки: ${label}.`;
  const fromDate = selected?.fromDate || String(selected?.from || '').slice(0, 10);
  const toDate = selected?.toDate || String(selected?.to || '').slice(0, 10);
  const dateLabel = fromDate && toDate ? `${formatShortDate(fromDate)} — ${formatShortDate(toDate)}` : label;
  $('#analyticsChartPeriod').textContent = `Период портфеля: ${dateLabel} · мск`;
  $('#workspaceDateRangeLabel').textContent = dateLabel;
  $('#workspaceDateRange').setAttribute('aria-label', `Выбрать свои даты. Сейчас: ${dateLabel}`);
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
    // Replacing unchanged options interrupts an open native select menu.
    if (control.innerHTML !== options) control.innerHTML = options;
    if (control.value !== state.analyticsAccount) control.value = state.analyticsAccount;
    control.disabled = accounts.length === 0;
  }
  const pending = state.pendingPeriod;
  $('.analytics-chart-surface')?.setAttribute('aria-busy', String(Boolean(pending)));
  if (pending) {
    const requested = pending.period === 'custom' ? `${formatShortDate(pending.from)} — ${formatShortDate(pending.to)}`
      : globalPeriod?.selectedOptions?.[0]?.textContent || 'Выбранный период';
    $('#workspaceDateRangeLabel').textContent = `${requested} · пересчёт…`;
    $('#workspaceDateRange').setAttribute('aria-label', `Пересчитываем: ${requested}. Пока показаны данные: ${dateLabel}`);
    $('#analyticsChartPeriod').textContent = `Пока показано: ${dateLabel} · Пересчитываем: ${requested}`;
    $('#statisticsPeriodStatus').hidden = false;
    $('#statisticsPeriodStatus').textContent = `Пересчитываем: ${requested}. Пока показаны прежние данные.`;
    $('#overviewPeriodStatus').textContent = `Пересчитываем: ${requested}. Пока показаны прежние данные.`;
  }
}

function paintPeriodViews({visibleOnly=false,pendingOnly=false}={}) {
  const data = analyticsDisplayData();
  if (!data) return;
  const paint=(key,views,render)=>{
    if(pendingOnly&&!pendingPeriodViews.has(key))return;
    if(visibleOnly&&!views.includes(state.currentView)){pendingPeriodViews.add(key);return;}
    pendingPeriodViews.delete(key);render();
  };
  paint('portfolio',['overview'],()=>{renderPortfolio(data);renderEquityChart();updateToday();});
  paint('operations',['operations'],()=>applyOperationFilters({announce:false}));
  // The overview also contains analytics KPIs and the return chart.
  paint('analytics',['overview','analytics'],()=>renderAnalytics(data));
  paint('risk-plan',['risk-plan'],()=>{renderRiskPlan(state.bootstrap);state.tradingPlanUi?.refreshSelection?.();});
}
function renderPeriodViews({visibleOnly=false}={}) {
  const data=analyticsDisplayData();if(!data)return;
  renderSelectedPeriod(data);paintPeriodViews({visibleOnly});
}
function flushPeriodViews(view) {
  if(view===state.currentView&&pendingPeriodViews.size)paintPeriodViews({visibleOnly:true,pendingOnly:true});
}

async function selectPeriod(selection, { announce = true } = {}) {
  const requestNumber = ++state.periodRequest;
  state.periodController?.abort();
  const controller = new AbortController();
  state.periodController = controller;
  state.periodLoading = true;
  state.pendingPeriod = { ...selection };
  invalidateLocalExplanations();
  renderSelectedPeriod(analyticsDisplayData());
  $('#statisticsPeriodForm').setAttribute('aria-busy', 'true');
  let deadline;
  try {
    const data = await Promise.race([
      request(`/api/bootstrap?${periodQuery(selection)}`, { signal: controller.signal }),
      new Promise((_, reject) => {
        deadline = setTimeout(() => {
          reject(new Error('Пересчёт не завершился. Прежние данные сохранены; повторите выбор периода.'));
          controller.abort();
        }, 90_000);
      }),
    ]);
    if (requestNumber !== state.periodRequest) return;
    // Older static fixtures have no period contract. Keep their current range explicit.
    if (!data.selectedPeriod) throw new Error('Эта версия просмотра ещё не поддерживает пересчёт периода. Откройте обновлённую локальную проверку.');
    state.selectedPeriod = { ...selection };
    state.pendingPeriod = null;
    state.operationPeriodDraft = false;
    state.statisticsPeriodDraft = false;
    state.statisticsRange = selection.period;
    state.listPages = new Map();
    renderBootstrap(data);
    $('#statisticsPeriodStatus').hidden = true;
    if (announce) showToast('Период применён к графику, метрикам и спискам.');
  } catch (error) {
    if (requestNumber !== state.periodRequest) return;
    state.pendingPeriod = null;
    state.operationPeriodDraft = false;
    state.statisticsPeriodDraft = false;
    renderSelectedPeriod(analyticsDisplayData());
    $('#statisticsPeriodStatus').textContent = error.message || 'Период не обновлён. Повторите попытку.';
    $('#overviewPeriodStatus').textContent = error.message || 'Период не обновлён. Повторите попытку.';
    showToast(error.message || 'Период не обновлён. Повторите попытку.', true);
  } finally {
    clearTimeout(deadline);
    if (requestNumber === state.periodRequest) {
      state.periodLoading = false;
      state.periodController = null;
      $('#statisticsPeriodForm').setAttribute('aria-busy', 'false');
      invalidateLocalExplanations();
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
    <div class="market-vision-row ${row.side}"><span><strong>${escapeText(row.ticker || row.name)}</strong><small>${assetLabel(row.assetType)} · ${row.side === 'loser' ? 'снижение' : row.side === 'unchanged' ? 'без изменения' : 'рост'}${row.to ? ' · ' + escapeText(new Date(row.to).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short' })) : ''}</small></span><dl><div><dt>За день</dt><dd class="${Number(row.dayReturnRate || 0) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.dayReturnRate, { signed: true }))}</dd></div><div><dt>Объём</dt><dd class="${Number(row.volumeChangeRate || 0) < 0 ? 'negative' : 'positive'}">${escapeText(formatPercentage(row.volumeChangeRate, { signed: true }))}</dd></div></dl></div>`).join('') : '<p class="empty-copy">Для выбранных инструментов пока нет двух завершённых торговых дней. Обновите обзор, чтобы получить данные брокера.</p>';
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
  const isLesson = data.environment === 'fixture' || data.preview?.static === true;
  const sourceLabel = account => isLesson ? 'Учебный пример' : account.source === 'T-Invest GetMarginAttributes' ? 'Т‑Инвест · обеспечение счёта' : 'Источник не указан';
  const evaluationTime = account => {
    const time = Date.parse(account.capturedAt);
    if (!Number.isFinite(time)) return 'Время получения неизвестно';
    const age = Date.now() - time;
    return `${formatDate(account.capturedAt)} · ${age < 0 ? 'время позже текущего' : formatAge(age)}${account.stale ? ' · требуется обновление' : ''}`;
  };
  const moneyFields = [
    ['Гарантийное обеспечение', 'guaranteeNanos', '', 'guaranteeMargin', 'Средства для обеспечения фьючерсных позиций.'],
    ['Ликвидный портфель', 'liquidPortfolio', '', 'liquidPortfolio', 'Стоимость активов, которые брокер учитывает для обеспечения.'],
    ['Начальная маржа', 'startingMargin', '', '', 'Обеспечение, требуемое брокером для открытия позиций.'],
    ['Минимальная маржа', 'minimumMargin', '', '', 'Нижний порог обеспечения по оценке брокера.'],
    ['Вариационная маржа за день', 'variationMarginDayNanos', '', 'vm', 'Начисление или списание по фьючерсам за день.'],
    ['Запас относительно начальной маржи', 'maxAvailableBeforeMarginCallNanos', 'margin-buffer', 'marginBuffer', 'Ликвидный портфель минус начальная маржа, минимум 0 ₽. Только по свежей оценке в рублях.'],
  ];
  const selectedPortfolio = $('#statisticsAccount').value;
  // Margin belongs to one account. A legacy flat record can be assigned only when that account is unambiguous.
  const allRiskAccounts = (risk.accounts || []).length ? risk.accounts
    : slice.portfolios?.length === 1 ? [{ ...risk, portfolioId: slice.portfolios[0].id, label: slice.portfolios[0].label || 'Текущий счёт' }] : [];
  const riskAccounts = selectedPortfolio ? allRiskAccounts.filter(account => account.portfolioId === selectedPortfolio) : allRiskAccounts;
  const supportedAccounts = riskAccounts.filter(account => moneyFields.some(([, key]) => account[key]?.value !== null && account[key]?.value !== undefined)).length;
  const summaryAccount = riskAccounts[0]
    || { portfolioId: selectedPortfolio || '', label: slice.portfolios?.find(row => row.id === selectedPortfolio)?.label || (selectedPortfolio ? 'Выбранный счёт' : 'Счета недоступны') };
  // The header owns account selection. The all-account view keeps the separate
  // broker ledgers in the health tab instead of implying one aggregate margin.
  $('.risk-account-overview').hidden = !selectedPortfolio;
  $('#riskSummaryAccountLabel').textContent = summaryAccount.label || 'Выбранный счёт';
  $('#riskSummaryMetrics').innerHTML = [['Ликвидный портфель','liquidPortfolio'],['Начальная маржа','startingMargin'],['Запас маржи','maxAvailableBeforeMarginCallNanos']].map(([label,key]) => `<div><dt>${label}</dt><dd>${escapeText(formatMoney(summaryAccount[key]?.value,summaryAccount.currency || 'RUB'))}</dd>${key === 'maxAvailableBeforeMarginCallNanos' && isLesson && BigInt(summaryAccount.stressReserveNanos || '0') > 0n ? `<small>С учебным резервом ${escapeText(formatMoney(summaryAccount.stressReserveNanos, summaryAccount.currency || 'RUB'))}</small>` : ''}</div>`).join('') + `<div><dt>${escapeText(sourceLabel(summaryAccount))}</dt><dd class="risk-evaluation-time">${escapeText(evaluationTime(summaryAccount))}</dd></div>`;
  $('#marginCoverage').textContent = supportedAccounts
    ? `${supportedAccounts} ${supportedAccounts === 1 ? 'счёт' : 'счёта'} · отдельно`
    : selectedPortfolio ? 'Нет оценки выбранного счёта' : 'Нет доступной оценки';
  $('#marginSourceNote').textContent = supportedAccounts
    ? `${isLesson ? 'Учебная оценка' : 'Сохранённая оценка'} ${selectedPortfolio ? 'выбранного счёта' : 'отдельно по каждому счёту'}. Обеспечение не равно свободным деньгам; сверяйте источник и время получения.`
    : 'Доступной оценки обеспечения пока нет. Проверьте причину ниже; калькулятор позиции остаётся доступен.';
  $('#marginAccountLedgers').innerHTML = riskAccounts.map((account) => {
    const availableFields = moneyFields.filter(([, key]) => account[key]?.value !== null && account[key]?.value !== undefined);
    if (!availableFields.length) return `<section class="margin-account margin-account-empty"><header><strong>${escapeText(account.label)}</strong><span class="status-chip">Нет оценки</span></header><p>${escapeText(account.reason || account.liquidPortfolio?.note || 'Брокер ещё не вернул маржинальные показатели. Обновите данные в основной версии; для немаржинального счёта часть показателей не применяется.')}</p></section>`;
    // A broker report with several known fields, all zero, means no margin use; one line says it.
    if (availableFields.length >= 3 && availableFields.every(([, key]) => /^-?0+$/u.test(String(account[key]?.value)))) return `<section class="margin-account margin-account-empty margin-account-idle"><header><strong>${escapeText(account.label)}</strong><small>${escapeText(sourceLabel(account) + ' · ' + evaluationTime(account))}</small><span class="status-chip">Без обеспечения</span></header><p>Известные показатели обеспечения (${availableFields.length} из ${moneyFields.length}) равны 0 ₽ — маржинальных позиций нет.</p></section>`;
    return `
    <section class="margin-account" aria-label="Маржинальные показатели: ${escapeText(account.label)}">
      <header><strong>${escapeText(account.label)}</strong><small>${escapeText(sourceLabel(account) + ' · ' + evaluationTime(account))}</small></header>
      <dl class="margin-ledger">${availableFields.map(([label, key, className, termKey, explanation]) => {
        const field = account[key] || {};
        const fixtureReserve = key === 'maxAvailableBeforeMarginCallNanos' && (data.environment === 'fixture' || data.preview?.static)
          && BigInt(account.stressReserveNanos || '0') > 0n;
        const displayLabel = fixtureReserve ? 'Учебный запас маржи · с резервом' : label;
        const displayExplanation = fixtureReserve ? `Ликвидный портфель ${formatMoney(account.liquidPortfolio?.value, account.currency || 'RUB')} минус начальная маржа ${formatMoney(account.startingMargin?.value, account.currency || 'RUB')} и учебный резерв ${formatMoney(account.stressReserveNanos, account.currency || 'RUB')}; минимум 0. Это оценка запаса, не лимит покупки.` : explanation;
        const helpBtn = fixtureReserve
          ? `<button class="term-help" type="button" data-evidence-note="${escapeText(displayExplanation)}" aria-label="Справка: ${escapeText(displayLabel)}">i</button>`
          : termKey ? `<button class="term-help" type="button" data-term="${termKey}" aria-label="Справка: ${escapeText(label)}">i</button>` : '';
        // The buffer is coloured only when it is actually thin against the liquid portfolio.
        let bufferLevel = '';
        if (key === 'maxAvailableBeforeMarginCallNanos') {
          try { const buffer = BigInt(field.value ?? 0), liquid = BigInt(account.liquidPortfolio?.value ?? 0);
            bufferLevel = liquid > 0n ? (buffer * 4n < liquid ? 'low' : buffer * 2n < liquid ? 'tight' : 'ok') : ''; } catch { bufferLevel = ''; }
        }
        return `<div class="${className}"${bufferLevel ? ` data-buffer-level="${bufferLevel}"` : ''} title="${escapeText(displayExplanation + ' ' + evidenceNote(field, data))}"><dt>${displayLabel} ${helpBtn}${fixtureReserve ? `<small>Резерв: ${escapeText(formatMoney(account.stressReserveNanos, account.currency || 'RUB'))}</small>` : ''}</dt><dd>${escapeText(formatMoney(field.value, account.currency || 'RUB'))}</dd></div>`;
      }).join('')}</dl>
    </section>`;
  }).join('') || (selectedPortfolio ? '<p class="empty-copy">Для выбранного счёта нет сохранённой оценки обеспечения. Свой сценарий можно проверить во вкладке «Калькулятор позиции».</p>' : '<p class="empty-copy">Сначала синхронизируйте счета. Свой сценарий можно проверить во вкладке «Калькулятор позиции».</p>');
  const futuresRows = riskAccounts.flatMap((account) => (account.instruments || []).map((row) => ({ ...row, portfolioLabel: account.label })));
  const futuresPage = pagedRows('futuresRiskRows', futuresRows, 8, () => renderRiskPlan(data));
  $('#futuresRiskRows').innerHTML = futuresPage.length ? futuresPage.map((row) => `
    <div class="futures-risk-row"><span><strong>${escapeText(instrumentDisplay(row).ticker || instrumentDisplay(row).name)}</strong><small>${escapeText(row.portfolioLabel)}</small></span><dl><div><dt>ГО <button class="term-help" type="button" data-term="guaranteeMargin" aria-label="Справка: Гарантийное обеспечение">i</button></dt><dd>${escapeText(formatMoney(row.guaranteeNanos, row.currency || 'RUB'))}</dd></div></dl></div>`).join('') : '';

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
    <div class="advisor-row"><span><strong>${escapeText(instrumentDisplay(row).ticker || instrumentDisplay(row).name)}</strong><small>${escapeText([assetLabel(row.assetType), row.portfolioLabel, evidenceLabel(row.evidence, data)].filter(Boolean).join(' · '))}</small></span><div><strong>${escapeText(formatPercentage(row.recommendedMaxRate))}</strong><small>${escapeText(formatMoney(row.recommendedMaxNanos, 'RUB'))} максимум по политике</small></div><ul>${(row.reasons || []).slice(0, 5).map((reason) => `<li>${escapeText(reason)}</li>`).join('')}</ul></div>`).join('') : '<p class="empty-copy">Автоматическая оценка появится после получения позиций и маржинальных показателей. Пока рассчитайте размер вручную по сумме риска и стоп-цене.</p>';
  $('#riskAdvisorWarning').textContent = advisor.warning || 'Оценка не гарантирует, что брокер не потребует дополнительное обеспечение.';
}

function inputMoneyNanos(value) {
  const text = String(value || '').trim().replace(',', '.');
  if (!/^\d{1,15}(?:\.\d{1,9})?$/u.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return (BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, '0'))).toString();
}

function riskCalculatorInput() {
  const values = Object.fromEntries(new FormData($('#riskCalculatorForm')));
  const future = values.assetType === 'future';
  $('#riskFutureFields').hidden = !future;
  return Object.fromEntries(Object.entries({
    capitalNanos: inputMoneyNanos(values.capital), riskBudgetNanos: inputMoneyNanos(values.riskAmount),
    entryPriceNanos: inputMoneyNanos(values.entryPrice), stopPriceNanos: inputMoneyNanos(values.stopPrice),
    lotSize: values.lotSize, direction: values.direction, assetType: values.assetType,
    minPriceIncrementNanos: future ? inputMoneyNanos(values.priceStep) : undefined,
    minPriceIncrementAmountNanos: future ? inputMoneyNanos(values.stepValue) : undefined,
    guaranteePerLotNanos: future ? inputMoneyNanos(values.guaranteePerLot) : undefined,
    targetPriceNanos: values.targetPrice?.trim() ? inputMoneyNanos(values.targetPrice) : undefined,
  }).filter(([, value]) => value !== undefined && value !== ''));
}

function updateRiskCalculator() {
  const values = Object.fromEntries(new FormData($('#riskCalculatorForm'))), future = values.assetType === 'future';
  const result = calculateRiskDraft(riskCalculatorInput());
  const prepare = $('#riskPreparePlan');
  prepare.hidden = state.bootstrap?.capabilities?.tradingPlan !== true; prepare.disabled = result.state !== 'calculated';
  $('#riskPreparePlanStatus').textContent = '';
  const output = $('#riskCalculatorResult');
  if (result.state !== 'calculated') {
    output.innerHTML = `<p class="empty-copy">${escapeText(result.reason || 'Введите капитал, допустимый риск, цену входа и стоп-цену.')}</p>`;
    return;
  }
  const rubles = value => formatMoney(value, 'RUB', { native: true });
  const levels = [['Вход',values.entryPrice,'entry'],['Стоп',values.stopPrice,'stop'],...(values.targetPrice?.trim() ? [['Цель',values.targetPrice,'target']] : [])].map(([label,value,kind]) => ({label,kind,value:BigInt(inputMoneyNanos(value)),text:quoteMoney(inputMoneyNanos(value),future?'PTS':'RUB')}));
  const sorted=[...levels].sort((a,b)=>a.value<b.value?-1:1), low=sorted[0].value, high=sorted.at(-1).value;
  const levelY = level => 34 + Number((high-level.value)*15000n/(high-low||1n))/100;
  const entry=levels.find(level=>level.kind==='entry'),stop=levels.find(level=>level.kind==='stop'),target=levels.find(level=>level.kind==='target');
  const area=(level,kind)=>level?`<rect class="scenario-area ${kind}" x="56" y="${Math.min(levelY(entry),levelY(level))}" width="248" height="${Math.abs(levelY(level)-levelY(entry))}"/>`:'';
  const arrow=(level,kind,x)=>level?`<path class="scenario-arrow risk-level-${kind}" d="M${x} ${levelY(entry)}V${levelY(level)}m-4 ${levelY(level)<levelY(entry)?5:-5} 4 ${levelY(level)<levelY(entry)?-5:5} 4 ${levelY(level)<levelY(entry)?5:-5}"/>`:'';
  const diagram=`<figure class="risk-level-diagram"><figcaption>Цена входа, стоп и цель</figcaption><svg viewBox="0 0 460 244" role="img" aria-label="Пропорциональная схема цен: вход ${escapeText(entry.text)}, стоп ${escapeText(stop.text)}${target?', цель '+escapeText(target.text):''}">${area(stop,'stop')}${area(target,'target')}<path class="scenario-axis" d="M56 20V200H304"/>${levels.map(level=>`<g class="risk-level-${level.kind}"><path d="M56 ${levelY(level)}H304"/><circle cx="${level.kind==='entry'?170:304}" cy="${levelY(level)}" r="4"/><text x="318" y="${levelY(level)+5}">${level.label} ${escapeText(level.text)}</text></g>`).join('')}${arrow(stop,'stop',290)}${arrow(target,'target',278)}<text class="scenario-axis-label" x="56" y="236">Уровни из вашего сценария</text></svg></figure>`;
  output.innerHTML=`<dl class="calculator-metrics"><div><dt>${future?'Количество контрактов':'Количество акций'}</dt><dd>${escapeText(result.units)}<small> ${future?'контр.':'шт.'}</small></dd></div><div><dt>Количество лотов</dt><dd>${escapeText(result.lots)}<small> лот.</small></dd><small>В одном лоте: ${escapeText(result.lotSize)} ${future?'контр.':'шт.'}</small></div><div><dt>Планируемый риск</dt><dd class="negative">${escapeText(rubles(result.actualRiskNanos))}</dd><small>Лимит: ${escapeText(rubles(result.riskBudgetNanos))}</small></div></dl><div class="calculator-scenario"><dl class="calculator-unit-metrics">${result.rewardRiskRatio?`<div><dt>Риск / прибыль</dt><dd class="positive">1 : ${escapeText(result.rewardRiskRatio.replace('.',','))}</dd></div>`:''}<div><dt>Риск на ${future?'контракт':'акцию'}</dt><dd>${escapeText(rubles(result.riskPerUnitNanos))}</dd></div>${result.rewardPerUnitNanos?`<div><dt>Потенциал на ${future?'контракт':'акцию'}</dt><dd>${escapeText(rubles(result.rewardPerUnitNanos))}</dd></div>`:''}<div><dt>Размер позиции</dt><dd>${escapeText(rubles(result.positionAmountNanos))}</dd></div></dl>${diagram}</div><p class="surface-note">${escapeText(result.reason||'')} ${escapeText(result.warning||'')}</p>`;
}

function renderSync(data) {
  const runs = data.syncRuns || [];
  const snapshotAt = data.quality?.lastEventAt;
  $('#syncLatestTime').textContent = snapshotAt ? formatDate(snapshotAt, true) : 'Ещё не обновляли';
  $('#syncLatestState').textContent = snapshotAt ? 'Сохранённая оценка портфеля' : 'Запустите первую синхронизацию';
  const refreshMs=data.planAccess?.refreshIntervalMs||10_000;
  $('#syncAutoState').textContent = data.environment === 'fixture' ? 'Учебный режим' : data.connection?.connected && data.capabilities?.portfolioRefresh ? `Целевой интервал: ${refreshMs/1000} секунд` : 'Нужно подключение';
  $('#syncAutoState').title = 'После запуска обновления Local Node продолжает получать данные при свёрнутом или закрытом окне Workspace, пока Nexus работает и вход действителен. Медленный ответ брокера может увеличить интервал; причина задержки указана в состоянии обновления.';
  $('#syncNowButton').disabled = $('#syncButton').disabled;
  const accounts=data.clientProduct?.portfolios||[];
  $('#brokerConnectionList').innerHTML=accounts.map(account=>'<div class="broker-connection-row">'+tbankIcon+'<span><strong>Т-Банк · '+escapeText(account.label)+'</strong><small>'+(data.environment==='fixture'?'Учебный счёт':'Брокерский счёт')+'</small></span><span class="'+(data.connection?.connected?'positive':'')+'">'+(data.environment==='fixture'?'Учебные данные':data.connection?.connected?'Подключено':'Не подключено')+'</span></div>').join('');
  const filter=state.syncRunFilter||'all', filtered=filter==='all'?runs:runs.filter(run=>run.status===filter);
  for(const button of $$('[data-sync-filter]'))button.setAttribute('aria-pressed',String(button.dataset.syncFilter===filter));
  const runPage = pagedRows('syncRuns', filtered, 5, () => renderSync(data));
  $('#syncSummary').textContent = runs.length ? `${runs.length} запуск(а)` : 'нет данных';
  $('#syncRuns').innerHTML = runPage.length ? runPage.map(run => `<details class="run-row" data-state="${run.status==='completed'?'completed':run.status==='failed'?'failed':'pending'}"><summary><time>${escapeText(formatDate(run.startedAt,true))}</time><span><strong class="${run.status==='failed'?'negative':run.status==='completed'?'positive':''}">${escapeText(run.statusLabel||run.status)}</strong><small>${escapeText(run.portfolioLabel||'Текущий портфель')}</small></span><span>${run.normalizedCount} обработано <svg><use href="#i-chevron"/></svg></span></summary><p>${run.rawCount} исходных записей · ${run.durationMs} мс</p></details>`).join('') : '<p class="empty-copy">Нет запусков с выбранным статусом.</p>';
  const coverage=data.dataCoverage||{}, opsComplete=coverage.operationCoverage===true, quotesComplete=coverage.state==='ready';
  const coverageRow=(title,complete,detail)=>'<div class="sync-coverage-row"><span><strong>'+title+'</strong><small>'+escapeText(detail)+'</small></span><span class="'+(complete?'positive':'coverage-pending')+'">'+(complete?'Полная':'Неполная')+'</span><div class="coverage-track '+(complete?'complete':'')+'" aria-hidden="true"><i></i></div></div>';
  $('#syncCoverageRows').innerHTML=coverageRow('История операций',opsComplete,opsComplete?(data.selectedPeriod?.label||'За выбранный период'):'За выбранный период не вся история подтверждена')+coverageRow('Оценки портфеля',quotesComplete,coverage.pointCount!=null?coverage.pointCount+' оценок за период':coverage.reason||'Ожидаем сохранённые оценки');
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

function renderRefreshStatus(value = state.syncUi?.getState()) {
  const node = $('#refreshStatus'), data = state.bootstrap;
  if (!node) return;
  const selectedAccount = $('#statisticsAccount').value;
  const presentation = syncRefreshPresentation(value, data, selectedAccount, Date.now(), displayedRefreshClock.at(data, selectedAccount));
  node.hidden = !data?.capabilities?.portfolioRefresh || data.environment === 'fixture';
  node.dataset.state = presentation.state;
  node.querySelector('span').textContent = presentation.text;
  node.title = [presentation.detail || presentation.text, 'Открыть сведения об обновлении'].join(' ');
}
const freshnessTimer = setInterval(() => { if (!document.hidden) renderRefreshStatus(); }, 1000);
window.addEventListener('pagehide', () => clearInterval(freshnessTimer), { once: true });

function renderSyncProgress(value) {
  const job = value?.active || value?.queued;
  const latest = value?.latest;
  const busy = Boolean(job || value?.applying);
  const node = $('#dataStateStatus');
  const text = job ? syncProgressCopy(job) : value?.applying ? 'Данные сохранены · обновляем показатели'
    : value?.viewError ? 'Данные сохранены · повторяем загрузку показателей'
    : value?.transportError ? 'Связь с обновлением потеряна · проверяем повторно' : latest?.status === 'failed' ? syncProgressCopy(latest) : '';
  const warning = syncWarningCopy(value);
  node.hidden = true;
  renderRefreshStatus(value);
  const manualBusy = state.manualSyncStarting || [value?.active, value?.queued].some(job =>
    job?.kind === 'sync' && ['queued', 'running'].includes(job.status));
  // Full history requests already join the runtime queue. Automatic snapshots
  // and saved-data calculations must not make the manual action unreachable.
  $('#syncButton').disabled = Boolean(manualBusy) || (localEnvironment() && !state.connection?.connected);
  $('#syncNowButton').disabled = $('#syncButton').disabled;
  $('#syncButton span').textContent = busy ? 'Синхронизация…' : 'Синхронизировать';
  const host = $('#syncProgressPanel');
  host.hidden = !value || (!job && !latest && !value.transportError);
  host.setAttribute('aria-busy', String(busy));
  host.querySelector('strong').textContent = text || syncProgressCopy(latest);
  const progress = job?.progress;
  const countsValid = Number.isInteger(progress?.totalAccounts) && progress.totalAccounts > 0
    && Number.isInteger(progress?.completedAccounts) && progress.completedAccounts >= 0 && progress.completedAccounts <= progress.totalAccounts;
  host.querySelector('small').textContent = job ? `${countsValid ? `Сохранено счетов: ${progress.completedAccounts} из ${progress.totalAccounts}. ` : ''}Можно переходить между разделами.`
    : value?.applying || value?.viewError ? 'Расчёт продолжается. Можно переходить между разделами.'
    : latest?.status === 'failed' ? 'Сохранённые данные доступны. Следующая попытка начнётся автоматически; обновить вручную можно сейчас.' : 'Данные сохранены на этом устройстве.';
  if (value?.portfolio?.oldestAt) {
    $('#syncLatestTime').textContent = formatDate(value.portfolio.oldestAt, true);
    $('#syncLatestState').textContent = value.portfolio.updatedAccounts === value.portfolio.totalAccounts ? 'Сохранены оценки всех подключённых счетов' : `Оценки есть для ${value.portfolio.updatedAccounts} из ${value.portfolio.totalAccounts} счетов`;
  }
  $('#autoRefreshStatus').hidden = true;
  $('#autoRefreshStatus').textContent = text || 'Текущие позиции обновляются автоматически';
}

function instrumentScope(data = state.bootstrap) {
  const connection=data?.connection||{},identity=data?.identity||data?.session?.identity||{};
  return JSON.stringify([data?.environment,data?.preview?.static===true,data?.preview?.localReview===true,identity.preferenceScope||identity.userId||identity.subject||null,connection.connected,connection.environment,connection.validatedAt,(data?.clientProduct?.portfolios||[]).map(row=>row.preferenceKey||row.id).sort(),data?.capabilities?.companyFacts===true,data?.capabilities?.companySavedFacts===true,(data?.companyAnalysisInstruments||[]).map(row=>row.instrumentUid).sort()]);
}
function todayAccess() {
  const bootstrap=state.bootstrap, workspace=state.savedResearchWorkspace;
  const descriptor=bootstrap?.savedResearch;
  const snapshot=workspace?.getConfirmedSnapshot?.();
  const nativeAllowed=bootstrap?.preview?.static!==true&&bootstrap?.capabilities?.savedResearch===true&&descriptor?.persistence==='local-node'&&/^[a-f0-9]{32}$/u.test(descriptor.ownerScope||'');
  const ownerScope=workspace?snapshot?.ownerScope:nativeAllowed?descriptor.ownerScope:null;
  const allowed=workspace?workspace.canResearch()===true:nativeAllowed;
  const sourceKey=state.deepAnalytics?.currentResearch.capture().scopeKey||instrumentScope();
  const signature=JSON.stringify([ownerScope,allowed,workspace?.getAccessToken()??0,sourceKey,bootstrap?.capabilities?.marketCalendar===true]);
  if(signature!==state.todayAccessSignature){state.todayAccessSignature=signature;state.todayAccessRevision=(state.todayAccessRevision||0)+1;}
  return {ownerScope,allowed,sourceKey,accessRevision:state.todayAccessRevision||0};
}
function todayContext() {
  const access=todayAccess(),bootstrap=state.bootstrap||{},quality=bootstrap.quality||{};
  const synthetic=bootstrap.environment==='fixture',temporary=synthetic&&bootstrap.preview?.static===true;
  const disconnected=!synthetic&&bootstrap.connection?.connected===false;
  const healthState=!access.allowed?'forbidden':disconnected?'not-connected':quality.error?'error':quality.stale?'stale':quality.lastEventAt?'ready':'unavailable';
  return {...access,sourceRevision:(state.searchAccessRevision||0)+(state.deepAnalytics?.currentResearch.capture().sourceRevision||0),
    selectionRevision:state.todaySelectionRevision||0,analyticsAccount:state.analyticsAccount||'',bootstrap,
    bootstrapObservedAt:state.todayBootstrapObservedAt||null,dataMode:synthetic?'synthetic':'local-saved',
    persistence:temporary?'memory-session':'local-node',persistenceDetail:temporary?'transient':bootstrap.savedResearch?.persistenceDetail||'unknown',
    sourceHealth:{state:healthState,confirmed:Boolean(quality.lastEventAt),code:healthState==='ready'?'ready':healthState==='forbidden'?'permission-required':healthState==='not-connected'?'not-connected':healthState==='stale'?'source-stale':'source-partial',observedAt:state.todayBootstrapObservedAt||null,sourceAt:null}};
}
function updateToday() { state.marketCalendarUi?.updateTodayAccess?.(); state.todayBinder?.update(); scheduleTodayCalendar(); }
// The overview «Сегодня» reads its dates again after they were cleared, without
// waiting for the calendar page to be opened.
function scheduleTodayCalendar() {
  clearTimeout(state.todayCalendarTimer);
  state.todayCalendarTimer = setTimeout(() => { if (state.currentView === 'overview' && !document.hidden) state.marketCalendarUi?.ensureTodayCalendar?.(); }, 1500);
}
function todayNavigateSection(intent,{isCurrent}={}) {
  if(typeof isCurrent!=='function'||isCurrent()!==true)return {ok:false};
  let target;
  if(intent.target==='calendar'){
    activateView('events',null,{focusMain:false,ensureEventNews:false});target=$('.events-heading h2');
  }else if(intent.target==='saved-research.list'){
    if(state.deepAnalytics?.showInstrumentWorkspace({isCurrent})!==true||isCurrent()!==true)return {ok:false};
    activateView('analytics',null,{focusMain:false,activateResearch:false});
    const host=$('#savedResearch'),list=host?.querySelector('[data-sr-list]');
    if(isCurrent()!==true||!list)return {ok:false};
    document.dispatchEvent(new CustomEvent('invest:reveal-workspace-target',{detail:{target:host}}));
    if(isCurrent()!==true)return {ok:false};
    if(list.tagName==='DETAILS')list.open=true;
    target=host.querySelector('[data-sr-focus="list"]')||list.querySelector('summary')||list;
  }else if(intent.target==='sync'){
    activateView('sync',null,{focusMain:false});target=$('[data-view-panel="sync"] .section-head h2');
  }else return {ok:false};
  if(isCurrent()!==true||!target||!target.getClientRects().length)return {ok:false};
  if(target.tagName!=='SUMMARY')target.tabIndex=-1;target.focus({preventScroll:true});
  if(isCurrent()!==true)return {ok:false};
  target.scrollIntoView({block:'center',behavior:'instant'});return {ok:isCurrent()===true};
}
function syncInstrumentSources(catalog) {
  const scopeKey=instrumentScope();
  if(state.instrumentScope!==scopeKey){state.instrumentScope=scopeKey;state.instrumentScopeRevision=(state.instrumentScopeRevision||0)+1;state.instrumentCatalog=[];const priorStream=state.stream;state.stream=null;priorStream?.close?.();state.terminalUi?.resetMarket();}
  if(Array.isArray(catalog))state.instrumentCatalog=catalog;
  const holdings=state.bootstrap?.instruments||[],companies=state.bootstrap?.companyAnalysisInstruments||[];
  // Portfolio prices do not change catalog identity. Catalog publication replaces
  // its snapshot; only the unrelated inPortfolio flag is mutated in place.
  const sourcesKey=JSON.stringify([scopeKey,holdings,companies]);
  if(state.instrumentSourceCatalog!==state.instrumentCatalog||state.instrumentSourcesKey!==sourcesKey){
    instrumentContext.replaceSources({catalog:state.instrumentCatalog||[],holdings,companies,scopeKey});
    state.instrumentSourceCatalog=state.instrumentCatalog;state.instrumentSourcesKey=sourcesKey;
    state.tradingPlanUi?.refreshCatalog?.();terminalContextHeader?.update();
  }
  updateToday();
}
function companyInstrumentEligible(meta) {
  if(!meta||meta.assetType!=='share'||state.bootstrap?.capabilities?.companyFacts!==true)return false;
  const resolved=instrumentContext.resolve(meta);
  return Boolean(resolved.meta&&(state.bootstrap?.companyAnalysisInstruments||[]).some(row=>row.instrumentUid===meta.instrumentUid&&row.assetType==='share'));
}
function companyContextReason() {
  const snap=instrumentContext.get('company');
  if(!snap.meta)return instrumentContextReason(snap);
  return snap.meta.assetType!=='share'?'Факты компании не применимы к этому инструменту. Откройте его исследование.':'Факты этой акции недоступны в текущем контексте. Откройте исследование или выберите другую акцию.';
}
function syncCompanyContext() {
  const snap=instrumentContext.get('company'),uid=companyInstrumentEligible(snap.meta)?snap.meta.instrumentUid:'';
  if(state.companyScope!==snap.scopeKey){state.companyScope=snap.scopeKey;for(const key of ['companyViews','companyFacts','companyFactsChecked','companyFactsAttempted','companyQuotes','companyQuoteAttempts','companyQuoteErrors'])state[key]=new Map();state.companyQuotePending=new Set();}
  if(state.companyPending&&!instrumentContext.isCurrent(state.companyPending.contextToken,'company')){
    const previous=state.companyPending,view=state.companyViews.get(previous.key);
    if(view){if(previous.kind==='analysis'){view.phase='error';view.message='Контекст инструмента изменился. Предыдущий ответ не применяется; запросите разбор заново.';}else{view.factsPhase='idle';view.factsMessage='Контекст инструмента изменился. Обновляем доступные факты.';state.companyFactsAttempted?.delete(previous.instrumentUid);}}
    state.companyRequest++;state.companyPending=null;
  }
  if(state.companyContextRevision!==snap.revision){state.companyContextRevision=snap.revision;state.companyQuotePending=new Set();}
  $('#aiInstrument').value=uid;
  companyPicker?.refresh();
  renderSelectedCompany();
  if(state.currentView==='ai')void ensureCompanyFacts();
}
async function instrumentContextRequest(path,...args) {
  const scope=instrumentScope(),uid=path.startsWith('/api/market/candles?')?new URL(path,location.origin).searchParams.get('instrumentUid'):null,ref=uid?instrumentContext.resolve(uid):null;
  const scopeRevision=state.instrumentScopeRevision||0,accessToken=state.savedResearchWorkspace?.getAccessToken()??null;
  if(ref&&!ref.meta)throw new Error(instrumentContextReason(ref));
  const result=await request(path,...args);
  if(ref){const current=instrumentContext.resolve(uid);if(scope!==instrumentScope()||!current.meta||JSON.stringify(current.ref)!==JSON.stringify(ref.ref))throw new Error('Контекст инструмента изменился.');}
  if(path==='/api/market/catalog'){if(scope!==instrumentScope()||scopeRevision!==(state.instrumentScopeRevision||0)||accessToken!==(state.savedResearchWorkspace?.getAccessToken()??null))throw new Error('Подключение изменилось. Обновите каталог.');if(Array.isArray(result.items))syncInstrumentSources(result.items);}
  return result;
}
const chartFilterKey=()=>JSON.stringify(['statisticsAccount','workspacePeriod','statisticsFrom','statisticsTo'].map(id=>$('#'+id).value));
function chartAvailability(meta){
 const resolved=instrumentContext.resolve(meta),busy=$('#statisticsPeriodForm').getAttribute('aria-busy')==='true';
 return {available:Boolean(resolved.meta)&&Boolean(state.terminalUi)&&!busy,reason:!resolved.meta?instrumentContextReason(resolved):busy?'Дождитесь загрузки выбранного периода.':'Терминал ещё загружается.'};
}
function currentChartOrigin(){if(chartOrigin?.scope!==instrumentScope())chartOrigin=null;return chartOrigin;}
function chartOriginCanFocus(origin){return Boolean(origin)&&origin.filters===chartFilterKey()&&origin.isCurrent?.()!==false;}
function chartReturnState(){
 const origin=currentChartOrigin();return {route:origin?.route||'portfolio',label:origin?(chartOriginCanFocus(origin)?origin.label:origin.fallbackLabel):'К портфелю'};
}
function openContextChart(meta,origin=null) {
  const resolved=instrumentContext.resolve(meta);if(!resolved.meta){showToast(instrumentContextReason(resolved),true);return false;}
  const availability=chartAvailability(meta);if(!availability.available){showToast(availability.reason,true);return false;}
  const sourceScope=instrumentScope(),sourceRef=JSON.stringify(resolved.ref),filters=chartFilterKey();
  if(!origin&&['ai','analytics'].includes(state.currentView)){
   const route=state.currentView==='ai'?'company':state.analyticsView==='instrument'?'research':null;
   if(route){const button=document.activeElement;origin={route,label:route==='company'?'К компании':'К исследованию',fallbackLabel:route==='company'?'К компании':'К исследованию',
    isCurrent:()=>button?.isConnected===true,restoreFocus:()=>{if(button?.getClientRects().length){button.scrollIntoView({block:'center',behavior:'instant'});button.focus({preventScroll:true});return true;}return false;}};}
  }
  const isCurrent=()=>sourceScope===instrumentScope()&&filters===chartFilterKey()&&origin?.isCurrent?.()!==false&&JSON.stringify(instrumentContext.resolve(meta).ref)===sourceRef;
  if(state.terminalUi.openCurrentInstrument(resolved.meta,{isCurrent})!==true)return false;
  chartOrigin=origin?{...origin,scope:sourceScope,filters}:null;
  activateView('terminal');terminalContextHeader?.update();
  return true;
}
$('#positionsBody').addEventListener('click',event=>{
 const button=event.target.closest('[data-position-chart]');if(!button||button.disabled)return;
 const uid=button.dataset.positionChart;
 openContextChart(uid,{route:'portfolio',label:'К портфелю',fallbackLabel:'К портфелю',restoreFocus:()=>{
  const target=button.isConnected?button:[...$('#positionsBody').querySelectorAll('[data-position-chart]')].find(item=>item.dataset.positionChart===uid);
  if(!target||target.disabled||!target.getClientRects().length)return false;
  target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});target.focus({preventScroll:true});return true;
 }});
});
function returnFromChart(){
 const origin=currentChartOrigin(),canFocus=chartOriginCanFocus(origin),route=origin?.route||'portfolio';chartOrigin=null;
 navigateTask(route,resolveTaskRoute(route));
 if(canFocus)origin.restoreFocus?.();terminalContextHeader?.update();
}
function openContextResearch(meta) {activateView('analytics');void state.deepAnalytics?.select(meta);}
function openContextCoupons(meta) {
  const snap=instrumentContext.get('research'),contextTicket=instrumentContext.capture('research');
  const isCurrent=()=>instrumentContext.isCurrent(contextTicket,'research')&&state.bootstrap?.capabilities?.marketCalendar===true;
  if(snap.resolution!=='exact'||snap.meta?.assetType!=='bond'||snap.meta.instrumentUid!==meta?.instrumentUid||!isCurrent())return false;
  const opened=state.marketCalendarUi?.openBondCoupons(meta.instrumentUid,{isCurrent})===true;
  if(!opened)showToast('Не удалось открыть купонный график. Обновите каталог и выберите облигацию заново.',true);
  return opened;
}
function openContextCompany(meta) {state.companyTab='facts';instrumentContext.select(meta,{surface:'company'});activateView('ai');}

function prepareTerminalJournalPlan(input,{isCurrent:terminalCurrent}={}) {
 const contextTicket=instrumentContext.capture('terminal'),snap=instrumentContext.get('terminal');
 const isCurrent=()=>terminalCurrent?.()===true&&instrumentContext.isCurrent(contextTicket,'terminal')&&$('#statisticsPeriodForm').getAttribute('aria-busy')!=='true';
 if(!isCurrent()||snap.resolution!=='exact'||snap.ref?.namespace!=='tinvest:broker'||snap.meta?.instrumentUid!==input.instrumentUid)
  return {prepared:false,message:'Не удалось подтвердить инструмент для журнала. Выберите его заново из доступного каталога.'};
 return state.tradingPlanUi?.prepareTerminalPlan(input,{instrumentUid:snap.meta.instrumentUid,portfolioId:$('#statisticsAccount').value,isCurrent})
  ||{prepared:false,message:'Журнал ещё загружается. Повторите перенос после загрузки.'};
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
  const companyContext=instrumentContext.get('company');
  $('#aiInstrument').value = companyInstrumentEligible(companyContext.meta) ? companyContext.meta.instrumentUid : '';
  companyPicker?.refresh();
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
  state.terminalUi?.update(selected,candles);
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
  const capitalText = capital?.value != null ? financialMetric(capital) : '—';
  const items=[['Открытие',last?price(last.open):'—'],['Объём свечи',last&&Number.isFinite(last.volume)?last.volume.toLocaleString('ru-RU'):'—'],['Максимум',last?price(last.high):'—'],...(capitalText!=='—'?[['Капитализация',capitalText]]:[]),['Минимум',last?price(last.low):'—'],['Закрытие',last?price(last.close):'—']];
  host.insertAdjacentHTML('beforeend','<dl class="market-ohlc">'+items.map(([title,value])=>'<div'+(title==='Капитализация'?' title="Из сохранённых фактов компании; прочерк означает отсутствие данных"':'')+'><dt>'+title+'</dt><dd>'+escapeText(value)+'</dd></div>').join('')+'</dl>');
  watchInstrumentImages(host);
}

async function renderMarketChart() {
  if(state.terminalUi)return state.terminalUi.refresh();
  const sequence = (state.chartRequest || 0) + 1;
  state.chartRequest = sequence;
  const instrumentKey = $('#instrumentSelect').value;
  const base = (state.bootstrap?.instruments || []).find(row => (row.viewKey || row.instrumentUid) === instrumentKey);
  const selected = state.marketInstrument && [state.marketInstrument.instrumentUid, state.marketInstrument.viewKey].includes(instrumentKey)
    ? { ...base, ...state.marketInstrument } : base;
  state.activeMarketInstrument = selected;
  $('#instrumentPriceAlert').disabled = !selected?.ticker;
  for (const control of $$('#instrumentQuickList [data-chart-uid]')) control.setAttribute('aria-current',String(control.dataset.chartUid === selected?.instrumentUid));
  const instrumentUid = selected?.instrumentUid || instrumentKey;
  const interval=$('#marketInterval').value;
  const chartKey = `${instrumentKey}:${interval}`;
  state.marketRequestController?.abort();
  const controller=new AbortController();state.marketRequestController=controller;
  if(state.marketChartKey!==chartKey){state.marketChart?.destroy();state.marketChart=null;$('#marketChart').innerHTML='<p class="empty-copy">Загружаем график выбранного инструмента…</p>';$('#marketEventTime').textContent='—';$('#marketAge').textContent='';}
  if (state.marketSummaryKey !== chartKey) {
    renderMarketInstrumentSummary(selected);
    state.marketSummaryKey = chartKey;
  }
  let candles = (state.bootstrap?.candles || []).filter(row => (row.instrumentUid === instrumentUid || row.viewKey === instrumentKey) && (!row.interval || row.interval === interval));
  let unavailable = null;
  if (state.bootstrap?.capabilities?.marketCalendar === true && state.bootstrap?.environment !== 'fixture' && !state.bootstrap?.preview?.localReview && instrumentUid) {
    if (state.marketChartKey !== chartKey) $('#marketStatus').textContent = 'Обновляем котировки…';
    try {
      const result = await request('/api/market/candles?' + new URLSearchParams({ instrumentUid, interval }), {signal:controller.signal});
      if (sequence !== state.chartRequest) return;
      candles = result.data;
      unavailable = result.warning || (result.stale ? 'Сохранённые котировки · обновление задерживается' : null);
    } catch (error) {
      if(sequence!==state.chartRequest)return;
      unavailable='Обновление котировок задерживается. Повторим автоматически.';
      if(state.marketChart&&state.marketChartKey===chartKey){$('#marketStatus').textContent=unavailable;return;}
    }
  }
  if (sequence !== state.chartRequest) return;
  candles=normalizeMarketCandles(candles,interval);
  if(!candles.length){
    state.marketChart?.destroy();state.marketChart=null;state.marketChartKey=chartKey;state.marketChartSignature=null;
    $('#marketChart').innerHTML='<div class="empty-state"><h3>За этот интервал нет свечей</h3><p>Попробуйте дневной интервал или другой инструмент. История нового контракта может быть ещё недоступна.</p></div>';
    $('#marketStatus').textContent=unavailable||'Нет сохранённых или полученных свечей выбранного интервала';$('#marketEventTime').textContent='—';$('#marketAge').textContent='';return;
  }
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
      const legend=document.createElement('div');legend.id='marketCrosshair';legend.className='market-crosshair';$('#marketChart').append(legend);
      state.marketChart = createMarketChart($('#marketChart'), candles, {onCrosshair:row=>{
        const legend=$('#marketCrosshair');if(!legend)return;
        legend.textContent=row?formatDate(new Date(row.time*1000).toISOString(),true)+' · О '+row.open+'  М '+row.high+'  м '+row.low+'  З '+row.close+' · Объём '+row.volume:'';
      }});
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
        const factsContext=instrumentContext.capture('research');
        void request(companyFactsReadPath(instrumentUid)).then(report=>{
          if(!instrumentContext.isCurrent(factsContext,'research'))return;
          assertCompanyFactsPacket(report,instrumentUid);
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
    $('#marketStatus').textContent = 'Не удалось построить график. Повторим автоматически; можно выбрать другой интервал.';
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

function renderHistoryProgress(value) {
  for (const panel of document.querySelectorAll('[data-history-progress]')) {
    const message = historyProgressCopy(value);
    panel.hidden = !message;
    panel.textContent = message;
  }
}

// Settings › About names the running version and where the data lives.
function renderAppAbout(data) {
  const host = $('#appAboutFacts'); if (!host) return;
  const runtime = data.runtime || {}, live = data.environment === 'live';
  const rows = [['Версия Invest', runtime.version || data.version || (live ? 'не указана' : 'учебный стенд')],
    ['Где работает', runtime.mode === 'local_node' ? 'На этом компьютере, запуск через Vertux Nexus' : live ? 'На этом компьютере' : 'Учебный стенд с демонстрационными данными'],
    ['Брокер', live ? 'Т‑Инвест API · только чтение, без сделок' : 'Не подключён'],
    ['Данные портфеля', live ? 'Хранятся на этом устройстве' : 'Демонстрационные'],
    ['Счетов', String(data.clientProduct?.portfolios?.length || 0)]];
  host.innerHTML = rows.map(([label, value]) => `<div><dt>${escapeText(label)}</dt><dd>${escapeText(value)}</dd></div>`).join('');
}

function renderBootstrap(data, {background=false} = {}) {
  // A rolling period advances on every snapshot. Only a different requested
  // period/custom range is a context change; new data still updates visible UI.
  const periodScope=value=>value?.period==='custom'?[value.period,value.from,value.to]:[value?.period];
  const deferHiddenViews=background&&state.bootstrap
    &&instrumentScope(data)===instrumentScope()
    &&JSON.stringify([data.planAccess,data.capabilities,data.identity,data.savedResearch,periodScope(data.selectedPeriod)])
      ===JSON.stringify([state.bootstrap.planAccess,state.bootstrap.capabilities,state.bootstrap.identity,state.bootstrap.savedResearch,periodScope(state.bootstrap.selectedPeriod)]);
  const deferStatistics=deferHiddenViews&&state.currentView==='terminal';
  renderHistoryProgress(data.historyBackfill);
  renderAppAbout(data);
  data = { ...data, connection: maskedConnectionStatus(data.connection) };
  if (!data.displayFx?.rates?.USD && state.bootstrap?.displayFx?.rates?.USD) data.displayFx=state.bootstrap.displayFx;
  state.bootstrap = data;
  document.body.dataset.analyticsState = 'ready';
  renderAnalyticsStartup();
  state.nexusAiUi?.updateContext();
  state.terminalUi?.updateAccess();
  state.syncUi?.updateAccess();
  state.todayBootstrapObservedAt=new Date().toISOString();
  state.searchAccessRevision=(state.searchAccessRevision||0)+1;
  if(deferStatistics){
    state.deferredBootstrap=true;
    displayedRefreshClock.observe(data,JSON.stringify([data.identity?.preferenceScope,data.environment,data.connection?.connected,data.connection?.validatedAt]));
    renderRefreshStatus();
    return;
  }
  state.deferredBootstrap=false;
  state.priceAlertUi?.updateBootstrap();
  state.workspaceNotifications?.updateBootstrap();
  state.savedResearchWorkspace?.updateBootstrap({deferRead:true});
  state.querySearch?.updateAccess();
  syncInstrumentSources();
  state.savedResearchWorkspace?.updateBootstrap();
  state.searchUi?.update();
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
  renderInstruments(data);
  renderCompanyAvailability(data.aiAvailability || state.companyAvailability);
  void ensureCompanyFacts();
  renderMarketVision(data);
  renderSync(data);
  if(state.syncUi)renderSyncProgress(state.syncUi.getState());
  renderPeriodViews({visibleOnly:deferHiddenViews});
  $('#statisticsPeriodStatus').hidden = true;
  renderLocalReview(data);
  if (state.tradingPlanUi) void state.tradingPlanUi.refresh();
  void state.marketCalendarUi?.refreshHoldings();
  if(state.terminalUi&&!state.streamAuthorizationFailed)queueMicrotask(openStream);
  displayedRefreshClock.observe(data, JSON.stringify([data.identity?.preferenceScope, data.environment,
    data.connection?.connected, data.connection?.validatedAt]));
  renderRefreshStatus();
  requestAnimationFrame(()=>{document.documentElement.dataset.demoBootstrapReady='true';document.dispatchEvent(new Event('nexus:demo-bootstrap-ready'));});
}

function renderAnalyticsStartup() {
  const phase = state.bootstrap?.analyticsState;
  let status = $('#workspaceStartupStatus');
  if (!status && !['pending','error'].includes(phase)) return;
  if (!status) {
    status = document.createElement('section'); status.id = 'workspaceStartupStatus'; status.className = 'workspace-startup-status';
    status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    const message = document.createElement('p'); message.dataset.startupMessage = '';
    const detail = document.createElement('p'); detail.className = 'workspace-startup-detail';
    detail.textContent = 'Чат, профиль и другие разделы уже доступны.';
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'button secondary';
    retry.textContent = 'Повторить загрузку аналитики'; retry.addEventListener('click', () => { void loadBootstrap(); });
    status.append(message, detail, retry); $('#mainContent').prepend(status);
  }
  const visible = ['pending','error'].includes(phase) && (['overview','operations'].includes(state.currentView)
    || state.currentView === 'analytics' && ['portfolio','capital','trading','reviews'].includes(state.analyticsView));
  status.hidden = !visible;
  status.querySelector('[data-startup-message]').textContent = phase === 'error'
    ? 'Не удалось подготовить аналитику портфеля. Сохранённые данные не изменены.' : 'Готовим аналитику портфеля…';
  const retry = status.querySelector('button'); retry.hidden = phase !== 'error'; retry.disabled = Boolean(state.startupAnalyticsRequest);
  $('#statisticsPeriodForm').querySelectorAll('input,select,button').forEach(control => {
    if (['pending','error'].includes(phase)) { if(!control.disabled)control.dataset.startupDisabled='true'; control.disabled=true; }
    else if(control.dataset.startupDisabled==='true'){control.disabled=false;delete control.dataset.startupDisabled;}
  });
}

async function loadWorkspaceAccess() {
  try {
    const data = await request('/api/workspace', { signal: AbortSignal.timeout(15_000) });
    if (data.analyticsState !== 'pending' || !data.identity?.preferenceScope) throw new Error('Workspace access is unavailable');
    state.bootstrap = { ...data, connection: maskedConnectionStatus(data.connection) };
    state.session = { csrfToken: data.csrfToken };
    document.body.dataset.analyticsState = 'pending';
    renderRuntimeTruth(state.bootstrap); renderConnection(state.bootstrap); renderAnalyticsStartup();
    return true;
  } catch (error) {
    // Older isolated preview hosts do not expose the short access endpoint.
    // Their existing full bootstrap remains the only source of permissions.
    if (error.status !== 404) state.startupAccessError = error.code || error.name;
    return false;
  }
}

async function loadBootstrap() {
  if (state.startupAnalyticsRequest) return state.startupAnalyticsRequest;
  const starting = ['pending','error'].includes(state.bootstrap?.analyticsState);
  const periodRevision = state.periodRequest;
  if (starting) { state.bootstrap.analyticsState = 'pending'; document.body.dataset.analyticsState = 'pending'; renderAnalyticsStartup(); }
  const read = loadBootstrapData();
  if (starting) state.startupAnalyticsRequest = read;
  try { return await read; }
  finally { if (state.startupAnalyticsRequest === read) { state.startupAnalyticsRequest = null; renderAnalyticsStartup(); } }
  async function loadBootstrapData() {
  try {
    let data = await request(`/api/bootstrap?${periodQuery()}`);
    if (periodRevision !== state.periodRequest) return;
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
    if (starting && state.bootstrap && ['BOOTSTRAP_TIMEOUT','BOOTSTRAP_BUSY','BOOTSTRAP_CALCULATION_UNAVAILABLE'].includes(error.code)) {
      state.bootstrap.analyticsState = 'error'; document.body.dataset.analyticsState = 'error'; renderAnalyticsStartup(); return;
    }
    state.bootstrap = null;
    delete document.body.dataset.analyticsState;
    renderAnalyticsStartup();
    state.nexusAiUi?.updateContext(); state.terminalUi?.updateAccess();
    state.internalTransfersUi?.update(null);
    state.shareValuationsUi?.update(null);
    state.brokerReportsUi?.update(null);
    state.savedResearchWorkspace?.updateBootstrap();
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
    $('#closedPositionsBody').innerHTML = '<tr><td colspan="7" class="empty-cell">Закрытые позиции недоступны: рабочая среда не ответила.</td></tr>';
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
}

async function startSync() {
  if (localEnvironment() && !state.connection?.connected) {
    showToast('Сначала подтвердите доступ только для чтения всех открытых счетов.', true);
    activateView('sync');
    $('#connectionPrimaryButton').focus();
    return false;
  }
  if (state.syncUi && state.bootstrap?.capabilities?.syncProgress === true) {
    if (state.manualSyncStarting) return false;
    state.manualSyncStarting = true;
    renderSyncProgress(state.syncUi.getState());
    try { await state.syncUi.sync(); return true; }
    catch (error) { showToast(error.message, true); return false; }
    finally { state.manualSyncStarting = false; renderSyncProgress(state.syncUi.getState()); }
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

let subscriptionTimer=null;
function streamUnavailable(message) {
  $('#marketStatus').textContent=message;
  $('#marketAge').textContent='поток котировок не подключён';
  state.terminalUi?.marketState({state:'unavailable'});
}
function knownMarketSelection(selection) {
  return {charts:(selection?.charts||[]).filter(row=>instrumentContext.resolve(row.instrumentUid).meta),focus:instrumentContext.resolve(selection?.focus).meta?selection.focus:''};
}
function sendMarketSubscription() {
  clearTimeout(subscriptionTimer);
  subscriptionTimer=setTimeout(()=>{
    const socket=state.stream;if(!socket||socket.readyState!==1||!socket.send)return;
    const selection=knownMarketSelection(document.hidden?{charts:[],focus:''}:state.terminalUi?.marketSubscription()||{charts:[],focus:''});
    const body=JSON.stringify({type:'subscribe',csrfToken:state.session?.csrfToken,...selection});
    if(socket.lastSelection===body)return;
    socket.lastSelection=body;socket.send(body);
  },250);
}
function scheduleStreamRetry() {
  state.terminalUi?.marketState({state:document.hidden?'paused':'reconnecting'});
  if(document.hidden){$('#marketStatus').textContent='Поток приостановлен до возвращения в окно';return;}
  const delay=Math.min(30000,1000*(2**Math.min(state.streamRetryAttempts,5)));
  state.streamRetryAttempts=Math.min(state.streamRetryAttempts+1,6);
  clearTimeout(state.streamRetryTimer);state.streamRetryTimer=setTimeout(openStream,delay);
  $('#marketStatus').textContent='Восстанавливаем поток котировок · повтор через '+Math.round(delay/1000)+' сек.';
}
function openStream() {
  clearTimeout(state.streamRetryTimer);state.streamRetryTimer=null;
  if(state.bootstrap?.preview?.localReview===true||state.bootstrap?.capabilities?.marketStream!==true){
    const old=state.stream;state.stream=null;old?.close?.();
    streamUnavailable(state.bootstrap?.capabilities?.marketStreamReason||'Поток котировок не подключён в этой версии приложения.');return;
  }
  if(state.stream&&(runtimeAdapter||state.stream.readyState===0||state.stream.readyState===1)){sendMarketSubscription();return;}
  const handleMessage=(message,{reportPaint=true}={})=>{
    if(!message||typeof message!=='object')return;
    if(message.instrumentUid&&!instrumentContext.resolve(message.instrumentUid).meta)return;
    if(message.type==='market.state'||message.type==='stream.state'){
      state.terminalUi?.marketState(message);return;
    }
    if(message.type==='market.reset'){state.terminalUi?.resetMarket();return;}
    if(message.type==='market.snapshot'){state.terminalUi?.applySnapshot(message);return;}
    if(['market.book','market.trade','market.status','market.tape-reset'].includes(message.type)){
      state.terminalUi?.marketEvent(message);return;
    }
    if(message.type!=='market.candle'||!message.candle)return;
    const candle=message.candle;
    if(!instrumentContext.resolve(candle.instrumentUid).meta)return;
    if(!candle.interval&&message.simulated)candle.interval='CANDLE_INTERVAL_DAY';
    candle.capturedAt??=message.connectorReceivedAt;
    if(state.terminalUi){state.terminalUi.updateCandle(candle);state.terminalUi.marketEvent({type:'market.candle',instrumentUid:candle.instrumentUid,connectorReceivedAt:message.connectorReceivedAt,simulated:message.simulated});}
    else if(candle.instrumentUid===(state.activeMarketInstrument?.instrumentUid||$('#instrumentSelect').value))state.marketChart?.updateCandle(candle);
    if(message.simulated)$('#marketStatus').textContent='Учебные котировки';
    state.streamRetryAttempts=0;
    $('#marketEventTime').textContent=message.sourceEventTime?formatDate(message.sourceEventTime,true):'Время события не передано';
    const at=Date.parse(message.connectorReceivedAt);
    $('#marketAge').textContent=(Number.isFinite(at)?'Получено '+formatAge(Math.max(0,Date.now()-at)):'Время получения не передано')+(message.simulated?' · тестовый поток':'');
    if(reportPaint&&message.eventId)requestAnimationFrame(()=>void request('/api/latency/paint',{method:'POST',body:JSON.stringify({eventId:message.eventId,uiPaintedAt:new Date().toISOString()})}).catch(()=>{}));
  };
  if(runtimeAdapter){const scopeRevision=state.instrumentScopeRevision;state.stream=runtimeAdapter.startMarketStream(message=>{if(scopeRevision===state.instrumentScopeRevision)handleMessage(message,{reportPaint:false});});return;}
  streamUnavailable('Учебный поток недоступен.');
}
document.addEventListener('invest:market-subscription',sendMarketSubscription);

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
    if (state.companyPending?.requestNumber !== requestNumber || !instrumentContext.isCurrent(selection.contextToken,'company')) return;
    if (result.llmUsed !== true) throw new Error('AI-разбор не получен. Сохранённые факты доступны отдельно.');
    view.report = result;
    view.analysisReport = result;
    view.phase = 'success';
    view.message = 'AI-разбор получен. Сверяйте выводы с датами и источниками отчётности.';
    view.factsMessage = 'Показан AI-разбор. Сохранённые факты можно открыть отдельно.';
  } catch (error) {
    if (state.companyPending?.requestNumber === requestNumber && instrumentContext.isCurrent(selection.contextToken,'company')) {
      if (['COMPANY_CONTEXT_CHANGED','SAVED_INSTRUMENT_CHANGED','SAVED_FACTS_INVALID'].includes(error.code)) {
        invalidateCompanySnapshot(selection);
        state.companyFactsAttempted?.delete(instrumentUid);
      }
      view.phase = 'error';
      view.message = `AI-разбор не получен. ${error.message || 'Не удалось завершить запрос.'}`;
      if (companySelection().key === selection.key) showToast(view.message, true);
    }
  } finally {
    if (state.companyPending?.requestNumber === requestNumber && instrumentContext.isCurrent(selection.contextToken,'company')) {
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
  const context=instrumentContext.get('company');
  const instrumentUid=companyInstrumentEligible(context.meta)?context.meta.instrumentUid:'';
  const focus = $('#aiFocus').value;
  return { instrumentUid, focus, key: JSON.stringify([context.scopeKey,instrumentUid,focus]), contextToken:instrumentContext.capture('company') };
}

function companyFactsReadPath(instrumentUid) {
  return '/api/ai/'+(state.bootstrap?.capabilities?.companySavedFacts===true?'company-saved-facts':'company-facts')+'?instrumentUid='+encodeURIComponent(instrumentUid);
}

function assertCompanyFactsPacket(report,instrumentUid,refresh=false) {
  if(state.bootstrap?.capabilities?.companySavedFacts!==true)return;
  if(report?.contractVersion!=='saved-instrument-facts-v1'||report.intent!=='instrument.saved-facts'
    ||report.instrument?.instrumentUid!==instrumentUid||report.llmUsed!==false
    ||report.readMode!==(refresh?'explicit-refresh':'saved-only')||!['fresh','stale','missing','synthetic'].includes(report.cacheState)){
    throw Object.assign(new Error('Сохранённые показатели не соответствуют выбранному контексту.'),{status:409});
  }
}

function companyView(selection = companySelection()) {
  state.companyViews ||= new Map();
  if (!state.companyViews.has(selection.key)) state.companyViews.set(selection.key, { phase: 'idle', message: '', factsMessage: '', report: null });
  return state.companyViews.get(selection.key);
}

function companySnapshotViews(selection) {
  const [scopeKey, instrumentUid] = JSON.parse(selection.key);
  return [...(state.companyViews || [])].filter(([key]) => {
    const [viewScope, viewInstrument] = JSON.parse(key);
    return viewScope === scopeKey && viewInstrument === instrumentUid;
  }).map(([, view]) => view);
}

function invalidateCompanySnapshot(selection) {
  state.companyFacts?.delete(selection.instrumentUid);
  state.companyFactsChecked?.delete(selection.instrumentUid);
  for (const view of companySnapshotViews(selection)) {
    view.report = null;
    view.analysisReport = null;
    view.phase = 'idle';
    view.message = '';
    view.factsPhase = 'error';
    view.factsMessage = 'Сохранённые показатели изменились или не подтверждены. Повторите чтение фактов компании.';
  }
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
  const analysisUnavailable = state.companyAvailability?.available !== true;
  availability.hidden = analysisUnavailable;
  const analysisControls = $('[data-company-controls="analysis"] .company-controls-row');
  if (analysisControls) analysisControls.hidden = analysisUnavailable;
  availability.setAttribute('role', 'status');
  availability.setAttribute('aria-live', 'polite');
  availability.setAttribute('aria-atomic', 'true');
  $('#aiAnalyzeButton').disabled = pending || !factsAvailable || state.companyAvailability?.available !== true;
  $('#companyFactsButton').disabled = pending || !factsAvailable;
  $('#companyFactsButton').hidden = view.factsPhase !== 'error';
  const sourceRefresh=$('#companyFactsRefresh');
  if(sourceRefresh){sourceRefresh.hidden=state.bootstrap?.capabilities?.companySavedFacts!==true||state.bootstrap?.capabilities?.companyFactsRefresh!==true;sourceRefresh.disabled=pending||!factsAvailable;}
  $('#aiInstrument').disabled = pending;
  $('#aiFocus').disabled = pending;
  $('#companyFactsStatus').textContent = state.companyPending?.key === selection.key && state.companyPending.kind === 'facts'
    ? (state.companyPending.refresh?'Обновляем показатели из источника…':'Загружаем сохранённые факты…') : !selection.instrumentUid ? companyContextReason() : view.factsMessage || 'Откройте факты выбранной компании.';
  $('#aiReport').setAttribute('aria-busy', String(pending && state.companyPending.key === selection.key));
}

function renderSelectedCompany() {
  const selection = companySelection();
  const identity = $('#companyIdentityMark');
  if(!selection.instrumentUid){
    if(identity)identity.innerHTML='';$('#companyIdentityText').textContent='';$('#companyIdentityQuote').textContent='';
    $('#aiReport').innerHTML='<div class="company-context-unavailable"><h3>Факты компании недоступны</h3><p>'+escapeText(companyContextReason())+'</p><button type="button" class="button secondary" id="companyContextResearch">Открыть исследование</button></div>';
    const action=$('#companyContextResearch'),meta=instrumentContext.get('company').meta;action.disabled=!meta;action.onclick=()=>openContextResearch(meta);
    renderCompanyStatus();return;
  }
  if (identity) {
    const find = rows => (rows || []).find(row => row.instrumentUid === selection.instrumentUid) || {};
    const company = instrumentContext.get('company').meta || {};
    identity.innerHTML = instrumentMark(company);
    watchInstrumentImages(identity);
    const position = find(state.bootstrap?.positions);
    const quote = state.companyQuotes?.get(selection.instrumentUid);
    const price = quote?.priceNanos ?? position.currentPriceNanos;
    const quoteStatus=state.companyQuotePending?.has(selection.instrumentUid)?'Загружаем котировку…':state.companyTab==='facts'&&state.bootstrap?.capabilities?.companySavedFacts===true?'Котировка не запрашивается при чтении среза.':state.companyQuoteErrors?.get(selection.instrumentUid)||'Загружаем котировку…';
    $('#companyIdentityText').innerHTML = `<h3>${escapeText(company.name || 'Выберите компанию')}</h3><p>${escapeText(company.ticker || '')}</p><div class="company-identity-tags">${[({share:'Акции',etf:'Фонды',bond:'Облигации',future:'Фьючерсы'})[company.assetType],company.exchange,({financial:'Финансовый сектор',it:'Технологии',energy:'Энергетика',materials:'Материалы',industrials:'Промышленность',telecom:'Телекоммуникации',consumer:'Потребительский сектор',health_care:'Здравоохранение',utilities:'Электроэнергетика',real_estate:'Недвижимость',ecomaterials:'Экоматериалы',green_buildings:'Зелёное строительство',green_energy:'Зелёная энергетика',electrocars:'Электромобили',other:'Другое'})[company.sector] || company.sector].filter(Boolean).map(label=>`<span>${escapeText(label)}</span>`).join('')}</div>`;
    $('#companyIdentityQuote').innerHTML = price != null ? `<strong>${escapeText(quoteMoney(price, quote?.currency || position.priceCurrency || company.currency))}</strong><small>${escapeText(quote?.delayed?'Обновление котировки задерживается · ':quote?'Последняя сделка · ':'Цена позиции · ')}${escapeText(formatDate(quote?.asOf || position.asOf,true))}</small>` : '';
  }
  const view = companyView(selection);
  let notice = '';
  const factsTab = state.companyTab === 'facts';
  const factsPending = state.companyPending?.key === selection.key && state.companyPending?.kind === 'facts';
  const report = factsTab ? state.companyFacts?.get(selection.instrumentUid) || (view.report?.llmUsed !== true ? view.report : null) : view.analysisReport || (view.report?.llmUsed === true ? view.report : null);
  if (!factsTab && state.companyAvailability?.available !== true && view.phase !== 'loading') {
    const reason = state.companyAvailability?.message || 'Не удалось определить доступность AI-разбора.';
    const canOpenFacts = Boolean(selection.instrumentUid) && (state.companyFacts?.has(selection.instrumentUid) || state.bootstrap?.capabilities?.companyFacts === true);
    notice = `<section class="company-analysis-notice" role="status" aria-live="polite"><h4>AI-разбор недоступен</h4><p>${escapeText(reason)}</p>${report ? '<p>Ниже показан сохранённый AI-разбор.</p>' : ''}${canOpenFacts ? '<button class="button secondary" id="companyOpenFacts" type="button">Открыть факты компании</button>' : !selection.instrumentUid ? '<p>Выберите компанию, чтобы проверить доступные факты.</p>' : ''}</section>`;
  } else if (!factsTab && (view.phase === 'loading' || view.phase === 'error')) {
    const title = view.phase === 'loading' ? 'Готовим AI-разбор' : 'AI-разбор не получен';
    const retained = report ? 'Ниже показан предыдущий AI-разбор.' : state.companyFacts?.has(selection.instrumentUid) ? 'Сохранённые показатели доступны на вкладке «Факты компании».' : '';
    notice = `<section class="company-analysis-notice" role="status" aria-live="polite"><h4>${title}</h4><p>${escapeText(view.message)} ${retained}</p></section>`;
  }
  if (report) renderCompanyReport(report, notice);
  else $('#aiReport').innerHTML = `<div class="ai-report-content">${notice || `<div class="empty-state"><h3>${selection.instrumentUid ? factsTab ? factsPending ? 'Загружаем показатели' : view.factsPhase === 'error' ? 'Факты не загружены' : 'Показатели пока недоступны' : 'Новый AI-разбор' : 'Выберите компанию для разбора'}</h3><p>${escapeText(factsTab ? factsPending ? 'Получаем сохранённые показатели и источники.' : view.factsMessage || 'Обновление выполняется автоматически. Доступные показатели появятся здесь после получения источника.' : 'Выберите тему и нажмите «Подготовить AI-разбор». Модель использует публичные сведения о компании.')}</p></div>`}</div>`;
  $('#companyOpenFacts')?.addEventListener('click', () => {
    state.companyTab = 'facts';
    renderSelectedCompany();
    $('#companyFactsTab').focus();
    if (!state.companyFacts?.has(selection.instrumentUid)) void loadCompanyFacts();
  });
  renderCompanyStatus();
}

function renderCompanyAvailability(status) {
  state.companyAvailability = status || { state: 'unknown', available: false, message: 'Не удалось определить доступность AI-разбора.' };
  renderSelectedCompany();
}

function safeCompanySourceUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}

function renderCompanyReport(report, notice = '') {
  const savedPacket=report.contractVersion==='saved-instrument-facts-v1';
  const savedDate=(value,withTime=false)=>{
    const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return 'не подтверждено';
    return new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',...(withTime?{hour:'2-digit',minute:'2-digit',second:'2-digit'}:{})}).format(date)+(withTime?' мск':'');
  };
  const sources = (Array.isArray(report.sources) ? report.sources : []).slice(0, 24);
  const metrics = (Array.isArray(report.metrics) ? report.metrics : Array.isArray(report.facts) ? report.facts : []).slice(0, 40);
  const known = metrics.filter(metric => metric.value !== null && metric.value !== undefined);
  const order = ['revenueTtm','netIncomeTtm','marketCapitalization','totalDebtMrq','computedNetMarginTtm','peRatioTtm','freeCashFlowTtm','totalDebtToEquityMrq','roe','roa'];
  const priority = metric => { const index=order.indexOf(metric.key); return index<0?order.length:index; };
  const featured = [...known].sort((a,b)=>priority(a)-priority(b)).slice(0,6);
  const extra = metrics.filter(metric=>!featured.includes(metric));
  const amount = (metric,compact=false) => financialMetric(metric,{mode:compact?'compact':'exact'});
  const period = metric => ({TTM:'За 12 месяцев',MRQ:'Последний квартал',provider_current:'Текущая сводка',provider_unspecified:'Период не указан'})[metric.period] || metric.period || 'Период не указан';
  const sourceLink = source => { const url=safeCompanySourceUrl(source.url);const title=escapeText(source.title||'Источник');return url?`<a href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">${title} <span aria-hidden="true">↗</span></a>`:title; };
  const emptyTitle=report.cacheState==='synthetic'?'В учебном срезе нет подтверждённой отчётности':'Источник пока не предоставил показатели';
  const emptyDescription='Для этой компании источник ещё не передал финансовые показатели. Можно повторить запрос кнопкой «Обновить из источника». Отсутствующие значения не заменяются нулями.';
  const compactMetricMarkup=metric=>{
    const formatted=amount(metric,true),unitStart=formatted.lastIndexOf('\u00a0');
    if(unitStart<0)return escapeText(formatted);
    return escapeText(formatted.slice(0,unitStart).replace(/\u00a0/gu,' '))+' <span class="company-metric-unit">'+escapeText(formatted.slice(unitStart+1))+'</span>';
  };
  const metricCard=metric=>`<div data-company-metric="${escapeText(metric.key)}"><dt>${escapeText(metric.label||metric.key)}</dt><dd title="${escapeText(amount(metric))}" aria-label="${escapeText(amount(metric))}">${compactMetricMarkup(metric)}</dd><small>${escapeText(period(metric))}</small>${metric.unit==='provider_value'?'<small class="company-unit-note">Масштаб единицы не указан</small>':''}</div>`;
  const cards = featured.length ? `<dl class="company-key-metrics">${featured.map(metricCard).join('')}</dl>` : `<div class="company-metrics-empty"><svg aria-hidden="true"><use href="#i-analytics"/></svg><h4>${escapeText(emptyTitle)}</h4><p>${escapeText(emptyDescription)}</p></div>`;
  const table = rows => `<dl class="company-key-metrics company-complete-metrics">${rows.map(metricCard).join('')}</dl>`;
  const metricSources=metrics.length?`<details class="company-metric-sources"><summary>Значения и источники</summary><label>Показатель<select data-company-source-metric>${metrics.map((metric,index)=>`<option value="${index}">${escapeText(metric.label||metric.key)}</option>`).join('')}</select></label><div data-company-source-body>${fundamentalMetricBody(metrics[0],report)}</div></details>`:'';
  const metricMarkup=cards+(extra.length?`<details class="company-extra-metrics"><summary>Остальные показатели: ${extra.length}</summary>${table(extra)}</details>`:'');
  const sections=(report.sections||[]).slice(0,16);
  const limitations=[...new Set([...(report.limitations||[]),...sections.filter(section=>/ограничени/iu.test(section.title)).flatMap(section=>section.items||[section.text]).filter(Boolean)])].slice(0,20);
  const provenance=`<footer class="company-provenance"><div class="company-source-links"><span>Источники</span>${sources.slice(0,3).map(sourceLink).join('')}</div>${sources.length||limitations.length?`<details><summary>Даты и полнота данных</summary>${sources.length?`<ul class="company-sources">${sources.map(source=>`<li>${sourceLink(source)}<small>${escapeText([source.asOf?'Данные на '+formatDate(source.asOf):'Отчётная дата не указана',source.retrievedAt?'Получено: '+formatDate(source.retrievedAt):''].filter(Boolean).join(' · '))}</small></li>`).join('')}</ul>`:''}${limitations.length?`<ul>${limitations.map(text=>{const statement=sections.flatMap(section=>section.statements||[]).find(item=>item.text===text);return `<li>${escapeText(text)}${statement?renderClaimEvidence(companyClaimEvidence(report,statement)):""}</li>`;}).join('')}</ul>`:''}</details>`:''}</footer>`;
  const dateLabel=savedPacket?(report.dataAsOf?(report.cacheState==='synthetic'?'Учебная отчётная дата: ':'Отчётная дата источника: ')+savedDate(report.dataAsOf):'Отчётная дата не указана'):(report.dataAsOf?'Данные на '+formatDate(report.dataAsOf):'Периоды указаны у показателей');
  const savedDates=savedPacket?`<details class="company-saved-provenance"><summary>О сохранённом срезе</summary><p>${escapeText(report.cacheState==='synthetic'?'Учебный срез; брокер и модель не вызываются.':report.readMode==='explicit-refresh'?'Источник обновлён по вашему запросу.':'Для чтения этого среза источник и модель не вызывались.')}</p><p>Получены показатели: ${escapeText(savedDate(report.receivedAt,true))}.</p><p>Получены сведения об инструменте: ${escapeText(savedDate(report.metadataReceivedAt,true))}.</p><p>Срез прочитан: ${escapeText(savedDate(report.generatedAt,true))}.</p><p>Время получения не является датой отчётности. Периоды и единицы указаны у каждого показателя; сопоставимость разных периодов не подтверждена.</p></details>`:'';
  let content;
  if(report.llmUsed===true){
    const narrative=sections.filter(section=>!/ограничени/iu.test(section.title)).map((section,index)=>{
      const icon=/риск|вниман|сценари/iu.test(section.title)?'i-shield':index===0?'i-ai':'i-analytics';
      return `<section class="company-analysis-section"><svg aria-hidden="true"><use href="#${icon}"/></svg><div><h4>${escapeText(section.title)}</h4>${section.items?.length?`<ul>${section.items.slice(0,30).map((text,index)=>`<li>${escapeText(text)}${renderClaimEvidence(companyClaimEvidence(report,section.statements?.[index]?.text===text?section.statements[index]:null))}</li>`).join('')}</ul>`:`<p>${escapeText(section.text||'Данных недостаточно.')}</p>`}</div></section>`;
    }).join('');
    content=`<header class="company-report-heading"><div><span class="analysis-label">AI-разбор публичных сведений</span><h3>${escapeText(report.title||'Разбор компании')}</h3></div><small>${escapeText(dateLabel)}</small></header><div class="company-analysis-sections">${narrative}</div><details class="company-report-metrics"><summary>Показатели, использованные в разборе</summary>${metricMarkup}</details>${provenance}`;
  }else{
    const compactExtras=extra.length?`<aside class="company-other-panel"><header class="company-report-heading"><h3>Другие показатели</h3></header><dl class="company-key-metrics company-secondary-metrics">${extra.slice(0,6).map(metricCard).join('')}</dl></aside>`:'';
    content=`<div class="company-facts-grid${compactExtras?'':' company-facts-wide'}"><section class="company-metrics-panel" aria-label="${escapeText(report.title||'Факты компании')}"><header class="company-report-heading"><h3>Ключевые показатели</h3><small>${escapeText(dateLabel)}</small></header>${cards}</section>${compactExtras}</div>${extra.length>6?`<section class="company-all-metrics"><h3>Все показатели</h3>${table(metrics)}</section>`:''}${provenance}`;
  }
  $('#aiReport').innerHTML=`<div class="ai-report-content">${notice}${savedDates}${content}${metricSources}${renderContextEvidence(buildCompanyContextEvidence(report,instrumentContext.get('company').meta))}</div>`;
  $('#aiReport [data-company-source-metric]')?.addEventListener('change',event=>{
    const metric=metrics[Number(event.target.value)];
    if(metric)$('#aiReport [data-company-source-body]').innerHTML=fundamentalMetricBody(metric,report);
  });
}

async function loadCompanyFacts({refresh=false}={}) {
  if (state.companyPending) return;
  const selection = companySelection();
  const { instrumentUid } = selection;
  if (!instrumentUid) { showToast('Выберите компанию, чтобы открыть факты.', true); return; }
  if (state.bootstrap?.capabilities?.companyFacts !== true) return;
  refresh=refresh===true;
  if(refresh&&(state.bootstrap?.capabilities?.companySavedFacts!==true||state.bootstrap?.capabilities?.companyFactsRefresh!==true))return;
  state.companyTab = 'facts';
  state.companyFactsAttempted ||= new Map();
  state.companyFactsAttempted.set(instrumentUid, Date.now());
  const view = companyView(selection);
  const requestNumber = ++state.companyRequest;
  state.companyPending = { ...selection, requestNumber, kind: 'facts',refresh };
  view.factsPhase = 'loading';
  renderSelectedCompany();
  try {
    let result = await request(refresh?'/api/ai/company-facts-refresh':companyFactsReadPath(instrumentUid),refresh?{method:'POST',body:JSON.stringify({instrumentUid})}:undefined);
    if (state.companyPending?.requestNumber !== requestNumber || !instrumentContext.isCurrent(selection.contextToken,'company')) return;
    assertCompanyFactsPacket(result,instrumentUid,refresh);
    // Keep the validated saved slice available if the subsequent source refresh
    // fails. It is still stale; receiving it does not confirm a new observation.
    if(!refresh && result.cacheState==='stale') {
      view.report={...result,llmUsed:false};
      state.companyFacts ||= new Map();
      state.companyFacts.set(instrumentUid,view.report);
    }
    // Selecting a company may refresh missing/expired public facts. GET remains
    // strictly saved-only; the separate POST keeps authorization and audit intact.
    if(!refresh && state.currentView==='ai' && state.bootstrap?.capabilities?.companyFactsAutoRefresh===true && state.bootstrap?.capabilities?.companyFactsRefresh===true
      && result.contractVersion==='saved-instrument-facts-v1' && ['missing','stale'].includes(result.cacheState)) {
      refresh=true;state.companyPending.refresh=true;renderCompanyStatus();
      result=await request('/api/ai/company-facts-refresh',{method:'POST',body:JSON.stringify({instrumentUid})});
      if(state.companyPending?.requestNumber!==requestNumber||!instrumentContext.isCurrent(selection.contextToken,'company'))return;
      assertCompanyFactsPacket(result,instrumentUid,true);
    }
    view.report = { ...result, llmUsed: false };
    state.companyFacts ||= new Map();
    state.companyFacts.set(instrumentUid, view.report);
    state.companyFactsChecked ||= new Map();
    state.companyFactsChecked.set(instrumentUid, Date.now());
    view.factsPhase = 'success';
    view.factsMessage = result.contractVersion==='saved-instrument-facts-v1'
      ? result.cacheState==='synthetic'?'Показан учебный срез. Обновление реального источника доступно в приложении.'
        :result.cacheState==='missing'?'Показатели пока недоступны. Повторите запрос к источнику.'
          :result.cacheState==='stale'?'Показаны прежние показатели; источник пока не обновился.'
            :refresh?'Показатели получены из источника. Дата отчётности указана у показателей.':'Показаны актуальные сохранённые показатели.'
      : 'Пример готового отчёта. Показатели вымышлены.';
    for (const cachedView of companySnapshotViews(selection)) {
      cachedView.factsPhase = view.factsPhase;
      cachedView.factsMessage = view.factsMessage;
    }
    if (view.phase === 'success') { view.phase = 'idle'; view.message = ''; }
  } catch (error) {
    if (state.companyPending?.requestNumber === requestNumber && instrumentContext.isCurrent(selection.contextToken,'company')) {
      if (['COMPANY_CONTEXT_CHANGED','SAVED_INSTRUMENT_CHANGED','SAVED_FACTS_INVALID'].includes(error.code)) invalidateCompanySnapshot(selection);
      view.factsPhase = 'error';
      if([401,403,404,409].includes(error.status)){state.companyFacts?.delete(instrumentUid);view.report=null;}
      view.factsMessage = state.companyFacts?.has(instrumentUid)
        ? (state.bootstrap?.capabilities?.companySavedFacts===true?(refresh?'Не удалось обновить показатели. Ниже прежний сохранённый срез. Повторите действие, когда источник доступен.':'Не удалось перечитать сохранённые показатели. Ниже прежний срез. Повторите чтение.'):'Не удалось обновить факты. Ниже сохранённые данные. Повторим автоматически; можно обновить сейчас.')
        : state.bootstrap?.capabilities?.companySavedFacts===true?(refresh?'Не удалось обновить показатели из источника. Повторите действие.':'Не удалось прочитать сохранённые показатели. Повторите чтение.'):'Не удалось загрузить факты компании. Повторите обновление.';
    }
  } finally {
    if (state.companyPending?.requestNumber === requestNumber && instrumentContext.isCurrent(selection.contextToken,'company')) {
      state.companyPending = null;
      renderSelectedCompany();
      if (state.currentView === 'ai' && companySelection().instrumentUid !== instrumentUid) void ensureCompanyFacts();
    }
  }
}

async function ensureCompanyQuote() {
  if(state.currentView!=='ai'||document.hidden||runtimeAdapter||state.bootstrap?.capabilities?.companyFacts!==true)return;
  const selection=companySelection(),{instrumentUid}=selection;if(!instrumentUid)return;
  state.companyQuotes ||= new Map();state.companyQuotePending ||= new Set();state.companyQuoteAttempts ||= new Map();state.companyQuoteErrors ||= new Map();
  if(state.companyQuotePending.has(instrumentUid)||Date.now()-(state.companyQuoteAttempts.get(instrumentUid)||0)<30_000)return;
  state.companyQuotePending.add(instrumentUid);state.companyQuoteAttempts.set(instrumentUid,Date.now());
  try{const quote=await request(`/api/ai/company-quote?instrumentUid=${encodeURIComponent(instrumentUid)}`);if(!instrumentContext.isCurrent(selection.contextToken,'company'))return;if(quote.instrumentUid!==instrumentUid)throw new Error('Котировка не соответствует выбранной компании.');state.companyQuotes.set(instrumentUid,quote);state.companyQuoteErrors.delete(instrumentUid);}
  catch(error){if(!instrumentContext.isCurrent(selection.contextToken,'company'))return;const saved=state.companyQuotes.get(instrumentUid);if(saved)saved.delayed=true;state.companyQuoteErrors.set(instrumentUid,'Котировка временно недоступна. Повторим автоматически.');}
  finally{if(instrumentContext.isCurrent(selection.contextToken,'company')){state.companyQuotePending.delete(instrumentUid);if(companySelection().instrumentUid===instrumentUid)renderSelectedCompany();}}
}

function ensureCompanyFacts() {
  if(state.bootstrap?.capabilities?.companySavedFacts!==true||state.companyTab!=='facts')void ensureCompanyQuote();
  const { instrumentUid } = companySelection();
  if (document.hidden || state.currentView !== 'ai' || !instrumentUid || state.companyTab !== 'facts' || state.companyPending) return;
  const now=Date.now();
  if(now-(state.companyFactsChecked?.get(instrumentUid)||0)<5*60_000 || now-(state.companyFactsAttempted?.get(instrumentUid)||0)<60_000)return;
  return loadCompanyFacts();
}

function bindUi() {
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.view, button)));
  $$('[data-go-view]').forEach((button) => button.addEventListener('click', () => activateView(button.dataset.goView)));
  $$('[data-system-section]').forEach((button) => button.addEventListener('click', () => {
    openServiceSection(button.dataset.systemSection);
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
  for(const button of $$('[data-sync-filter]'))button.addEventListener('click',()=>{state.syncRunFilter=button.dataset.syncFilter;state.listPages.delete('syncRuns');if(state.bootstrap)renderSync(state.bootstrap);});
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
  $('#marketFit')?.addEventListener('click',()=>state.marketChart?.fitContent());
  $('#marketClearDrawings')?.addEventListener('click',()=>state.marketChart?.clearDrawings());
  $('#marketChartType').addEventListener('change', event => state.marketChart?.setType(event.target.value));
  $('#operationsPrevious').addEventListener('click', () => changeOperationPage(-1));
  $('#operationsNext').addEventListener('click', () => changeOperationPage(1));
  $('#riskPreparePlan').addEventListener('click', () => {
    const result = state.tradingPlanUi?.prepareRiskScenario(riskCalculatorInput());
    $('#riskPreparePlanStatus').textContent = result?.message ?? 'Откройте журнал после загрузки приложения.';
  });
  $('#riskCalculatorForm').addEventListener('submit', (event) => { event.preventDefault(); updateRiskCalculator(); });
  $('#riskCalculatorForm').elements.assetType.addEventListener('change', updateRiskCalculator);
  $('#riskCalculatorForm').addEventListener('input', updateRiskCalculator);
  state.selectRiskTab = initRiskTabs(document,()=>{if(state.currentView==='risk-plan')state.taskNavigation?.sync(taskNavigationContext());});
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
  for (const id of ['overviewAccount', 'statisticsAccount']) $('#' + id).addEventListener('change', async (event) => {
    const nextAccount=event.target.value,previousAccount=state.analyticsAccount;
    if(state.terminalUi?.switchAccount&&!await state.terminalUi.switchAccount(nextAccount)){event.target.value=previousAccount;return;}
    state.analyticsAccount = nextAccount;
    state.todaySelectionRevision=(state.todaySelectionRevision||0)+1;
    $('#operationFilters').elements.account.value = state.analyticsAccount;
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
  $('#companyFactsRefresh')?.addEventListener('click',()=>loadCompanyFacts({refresh:true}));
  $('#aiInstrument').addEventListener('change', () => { instrumentContext.select($('#aiInstrument').value,{surface:'company'}); syncCompanyContext(); });
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
    summary: 'Денежный результат известных закрытых сделок и вариационной маржи, а также его доля в суммарном известном результате той же валюты.',
    details: 'Для акций учитывается полный результат закрытых в периоде сделок, включая более ранние покупки и комиссии. Для фьючерсов — вариационная маржа за период. Знаменатель доли — модуль суммы этих результатов, с учётом знаков прибыли и убытка, в одной валюте. Доля может превышать 100%; при нулевой сумме она не определена. Это не доходность позиции и не вклад в доходность в процентных пунктах. Таблица не включает всю переоценку открытых активов и не сверяет полный результат портфеля.',
    formula: 'Доля денежного результата = P&L инструмента / |сумма известных P&L той же валюты| × 100%',
    variables: [{ name: 'Период', desc: 'Общий диапазон дат над статистикой' }, { name: 'Атрибуция', desc: 'Результат включается только когда его можно связать с конкретным инструментом' }],
    example: 'Результаты двух инструментов: +300 ₽ и −100 ₽. Итог +200 ₽; доли +150% и −50%. При результате +100 ₽ и −100 ₽ итог нулевой, поэтому доли не рассчитываются.',
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
    formula: 'Profit Factor = Сумма положительных netPnl / |Сумма отрицательных netPnl|',
    variables: [
      { name: 'Положительные netPnl', desc: 'Денежные результаты прибыльных закрытых сделок после учтённых комиссий, в одной валюте' },
      { name: 'Отрицательные netPnl', desc: 'Денежные результаты убыточных закрытых сделок после учтённых комиссий, в той же валюте' }
    ],
    example: 'Если за месяц сумма прибыльных результатов составила 180 000 ₽, а модуль суммы убыточных — 60 000 ₽, то Profit Factor = 180 000 / 60 000 = 3,0. Само отношение не доказывает устойчивость стратегии.',
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
    name: 'Результат к начальной стоимости',
    nameEn: 'Net Return',
    category: 'Доходность и риск',
    summary: 'Изменение сохранённой стоимости портфеля за выбранный период после исключения внешних денежных потоков.',
    details: 'Удержанные комиссии уже отражены в стоимости счёта и повторно не вычитаются. Показатель доступен при полной истории денежных потоков, оценках на границах периода и положительной начальной стоимости. Даты пополнений не взвешиваются. Это результат к начальному капиталу, не TWR и не MWR/XIRR.',
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
    summary: 'Суммы комиссий из сохранённых операций с учётом исходной валюты каждого поля.',
    details: 'Отдельная брокерская комиссия заменяет комиссию связанной сделки в той же валюте. Остальные комиссии сделок учитываются по их исходному полю. Рублёвый итог использует сохранённые курсы ЦБ на даты операций. Полнота денежных списаний и даты расчётов не подтверждены; налоги не включаются.',
    formula: 'Комиссии в RUB = сумма модулей комиссий × исторический курс каждой операции',
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
    summary: 'Результат закрытых позиций по акциям до комиссий плюс зачисленная вариационная маржа фьючерсов. Комиссии периода показаны отдельно.',
    details: 'При частичной продаже пакета акций первыми списываются те лоты, которые были куплены раньше всего по соответствующей цене приобретения.',
    formula: 'Реализованный результат = FIFO акций до комиссий + зачисленная вариационная маржа',
    variables: [
      { name: 'Цена_ранней_покупки', desc: 'Цена лотов из самых первых по времени открытых покупок' },
      { name: 'Цена_продажи', desc: 'Фактическая цена исполнения закрывающей сделки' }
    ],
    example: 'Купили 10 акций по 100 ₽, затем 10 акций по 120 ₽. При продаже 10 акций по 140 ₽ списывается первая партия (по 100 ₽): прибыль (140 - 100) × 10 = +400 ₽.',
  },
  unrealizedPnl: {
    abbr: 'Оценка позиций',
    name: 'Оценка открытых позиций',
    nameEn: 'Current broker position estimates',
    category: 'Базовые метрики портфеля',
    summary: 'Текущие оценки брокера по сохранённым открытым позициям, отдельно в каждой подтверждённой валюте.',
    details: 'Состав и источники оценки показывают покрытие, счета и даты снимков. Неизвестные результаты не заменяются нулём. Исторический период не меняет текущий состав.',
    formula: 'Сумма по валюте = сумма подтверждённых оценок позиций в этой валюте',
    variables: [{ name: 'Оценка позиции', desc: 'Сохранённая оценка брокера с проверенной валютой и связью с текущим снимком' }],
    example: 'Оценки +7 USD и +11 EUR остаются двумя суммами. Это не прибыль выбранного периода или подтверждение денежных выплат.',
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
${term.formula?.trim() ? financialFormula(termKey, term.formula) : ''}
${financialFormulaVariables(termKey, term.variables)}
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
    top = Math.max(10, Math.min(top, window.innerHeight - popoverRect.height - 10));
    left = Math.max(10, Math.min(left, window.innerWidth - popoverRect.width - 10));

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
    else if (activeHelpBtn && document.activeElement === activeHelpBtn && !popover.hidden && popover.scrollHeight > popover.clientHeight) {
      const step = ({ ArrowDown: 40, ArrowUp: -40, PageDown: popover.clientHeight * .8, PageUp: -popover.clientHeight * .8, Home: -popover.scrollHeight, End: popover.scrollHeight })[e.key];
      if (step !== undefined) { e.preventDefault(); popover.scrollTop += step; }
    }
  });
  window.addEventListener('resize', () => closeTooltip({ immediate: true }));
  window.addEventListener('scroll', (event) => {
    if (event.target === popover || (event.target?.nodeType && popover.contains(event.target))) return;
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
  const input=$('#globalSearch'),list=$('#globalSearchResults');if(!input||!list||!state.deepAnalytics)return;
  const sameRef=(a,b)=>a?.namespace===b?.namespace&&a?.instrumentUid===b?.instrumentUid;
  const accessToken=()=>JSON.stringify([state.searchAccessRevision||0,state.savedResearchWorkspace?.getAccessToken()??null]);
  const canResearch=()=>state.savedResearchWorkspace?.canResearch()===true;
  const canTerminal=()=>Boolean(state.terminalUi&&((runtimeAdapter&&state.bootstrap?.environment==='fixture'&&state.bootstrap?.preview?.static===true)||state.bootstrap?.capabilities?.marketCalendar===true));
  const focusTarget=target=>{if(!target)return;if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.scrollIntoView({block:'nearest',behavior:'instant'});target.focus({preventScroll:true});};
  const navigate=row=>{
    const target=row.target&&document.getElementById(row.target),riskPanel=target?.closest('[data-risk-panel]');
    const mode=row.view==='analytics'?(target?.closest('.deep-instrument')?'instrument':target?.closest('.deep-portfolio')?(target.closest('.deep-trade-statistics,.ranking-surface')?'trading':'capital'):null):null;
    if(mode)state.deepAnalytics.showTaskView(document.body.dataset.navigationMode!=='classic'||mode==='instrument'?mode:'portfolio');
    activateView(row.view,null,{activateResearch:!mode||mode==='instrument',taskRoute:row.view==='overview'&&target?.closest('#todayOverview')?'today':null});
    if(mode==='capital'&&target)state.deepAnalytics.revealPortfolioTarget(target);
    if(target)document.dispatchEvent(new CustomEvent('invest:reveal-workspace-target',{detail:{target}}));
    if(row.term){state.glossaryFilter=FINANCIAL_TERMS[row.term]?.name||row.title;state.glossaryCategory='all';$('#glossaryInlineSearch').value=state.glossaryFilter;
      $$('[data-glossary-cat]').forEach(button=>{const selected=button.dataset.glossaryCat==='all';button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));});renderGlossary();}
    if(row.target==='catalogSurface')$('#instrumentCatalogBrowser').open=true;
    if(riskPanel)state.selectRiskTab?.(riskPanel.dataset.riskPanel);
    for(let ancestor=target?.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.matches('details'))ancestor.open=true;
    focusTarget(target||$('#mainContent'));return true;
  };
  const research={...state.deepAnalytics.currentResearch,commit:(intent,guard)=>{const accepted=state.deepAnalytics.currentResearch.commit(intent,guard);if(accepted)focusTarget($('.deep-instrument-identity'));return accepted;}};
  const queryAccess=()=>({key:JSON.stringify([accessToken(),state.bootstrap?.identity?.preferenceScope,state.bootstrap?.savedResearch?.ownerScope,instrumentContext.resolve(null).scopeKey]),
    allowed:state.bootstrap?.capabilities?.researchQueries===true&&state.bootstrap?.preview?.static!==true&&canResearch()});
  state.querySearch=createResearchQuerySearch({request,getAccess:queryAccess,onChange:()=>state.searchUi?.update(),onOpen:(record,guard)=>{
    if(!guard.isCurrent()||!state.querySearch.canOpen(record))return false;
    const owner=queryAccess().key,selected=JSON.stringify(['research','company','terminal'].map(surface=>{const value=instrumentContext.get(surface);return [value.scopeKey,value.ref,value.pinned];})),tab=state.deepAnalytics.getAnalysisTab();
    const current=()=>queryAccess().allowed&&queryAccess().key===owner&&state.deepAnalytics.getAnalysisTab()===tab&&selected===JSON.stringify(['research','company','terminal'].map(surface=>{const value=instrumentContext.get(surface);return [value.scopeKey,value.ref,value.pinned];}));
    if(state.deepAnalytics.showTaskView('instrument')!==true||!current())return false;
    activateView('analytics',null,{focusMain:false,activateResearch:false});
    return current()&&state.deepAnalytics.openQueryRecord(record,{isCurrent:current})===true;
  }});
  window.addEventListener('pagehide',()=>state.querySearch?.dispose(),{once:true});
  const actions=createSearchActions({context:instrumentContext,currentResearch:research,getAccessToken:accessToken,canResearch,canTerminal,queryArchive:state.querySearch,
    openTerminal:(intent,guard)=>{
      if(!guard.isCurrent()||!canTerminal())return false;
      const resolved=instrumentContext.resolve(intent.instrumentRef);if(resolved.resolution!=='exact'||!sameRef(resolved.ref,intent.instrumentRef))return false;
      const before=instrumentContext.resolve(null).revision,prior=instrumentContext.get('terminal'),access=accessToken();
      if(state.terminalUi.openInstrumentChecked(resolved.meta,guard)!==true)return false;
      const current=instrumentContext.get('terminal'),revision=instrumentContext.resolve(null).revision;
      if(access!==accessToken()||!canTerminal()||current.scopeKey!==intent.scopeKey||current.resolution!=='exact'||!sameRef(current.ref,intent.instrumentRef)||revision!==before+(sameRef(prior.ref,intent.instrumentRef)?0:1))return false;
      activateView('terminal');focusTarget($('#terminalInstrumentContext'));return true;
    },
    openCatalog:(row,guard)=>{if(!guard.isCurrent())return false;activateView('terminal');state.marketCalendarUi?.openCatalogInstrument(row.instrumentRef?.instrumentUid);$('#instrumentCatalogBrowser').open=true;focusTarget($('#catalogSearch'));return true;},
    navigate:(row,guard)=>guard.isCurrent()&&navigate(row),
    restoreSaved:(id,guard)=>state.savedResearchWorkspace.restore(id,guard)});
  state.searchUi=createSearchContinuation({input,list,toggle:$('#globalSearchToggle'),actions,onOpen:()=>{void state.querySearch.refresh();},getData:()=>{
    const pages=[...document.querySelectorAll('.view h2,.view h3,.view label')].filter(el=>!el.closest('[data-view-panel="glossary"]')).map((el,i)=>{
      const view=el.closest('[data-view-panel]')?.dataset.viewPanel,title=(el.querySelector('span')?.textContent||el.childNodes[0]?.textContent||el.textContent).trim();
      if(!el.id)el.id='search-surface-'+i;return{id:el.id,title,view,target:el.id,search:''};
    }).filter(row=>row.view&&row.title&&row.title.length<100);
    return {terms:FINANCIAL_TERMS,catalog:state.marketCalendarUi?.getCatalog()||[],pages,
      catalogState:!canTerminal()?'unavailable':state.marketCalendarUi?.getCatalog()?.length?'partial':'loading',savedResearch:state.savedResearchWorkspace?.getConfirmedEntries(),researchQueries:state.querySearch.snapshot()};
  }});
}

bindUi();
$('#instrumentsExpand')?.addEventListener('click',event=>{
  const expanded=document.body.classList.toggle('instruments-expanded');
  event.currentTarget.setAttribute('aria-pressed',String(expanded));
  event.currentTarget.textContent=expanded?'Вернуть окно':'На весь экран';
  window.dispatchEvent(new Event('resize'));
});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('instruments-expanded'))$('#instrumentsExpand').click();});
$('#openInstrumentCatalog')?.addEventListener('click',()=>{
  const catalog=$('#instrumentCatalogBrowser');catalog.open=true;catalog.scrollIntoView({block:'start',behavior:'instant'});$('#catalogSearch').focus({preventScroll:true});
});
$('#instrumentPriceAlert')?.addEventListener('click',()=>{
  const selected=state.activeMarketInstrument||{};
  activateView('alerts');
  const input=document.querySelector('#priceAlertForm [name="symbol"]');
  if(input&&selected.ticker){input.value=selected.ticker;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}
});
globalThis.nexusProduct?.onNavigate?.(view => { if (['settings','profile'].includes(view)) activateView(view); });
// Native navigation and section controllers must mount while saved analytics
// are being prepared. A failed or slow read must not leave half the UI unbound.
const initialNavigationRevision = state.navigationRevision;
const initialBootstrap = globalThis.nexusProduct
  ? loadWorkspaceAccess().then(() => { void loadBootstrap(); })
  : loadBootstrap();
await initialBootstrap;
$('#marketVisionRefresh').addEventListener('click', () => void refreshMarketVision(true));
state.nexusAiUi=createNexusAiUi({host:$('#nexusAiWorkspace'),request,getBootstrap:()=>state.bootstrap,getSelectedPortfolio:()=>$('#statisticsAccount').value,getCatalog:()=>state.instrumentCatalog,navigate:activateView,onPlanApplied:()=>state.tradingPlanUi?.refresh()});
$('#discussCompanyAi').addEventListener('click',()=>{const select=$('#aiInstrument');if(select.value)state.nexusAiUi.attachInstrument({id:select.value,label:select.selectedOptions[0]?.textContent||select.value});});
$('#aiInstrument').addEventListener('change',()=>state.nexusAiUi.updateContext());
window.addEventListener('pagehide',()=>state.nexusAiUi.dispose(),{once:true});
state.tradingPlanUi = initTradingPlan({ request, showToast,onDiscussPlan:plan=>state.nexusAiUi.attachPlan(plan), getBootstrap: () => state.bootstrap, getSelectedPortfolio: () => $('#statisticsAccount').value, getCatalogInstrument: uid => planCatalogInstrument(state.instrumentCatalog, uid), getCatalog: () => state.instrumentCatalog, openJournal: () => navigateTask('journal',resolveTaskRoute('journal'),{focus:false}), onOpenChart:openContextChart, chartAvailability });
void state.tradingPlanUi.refresh();
const stopPlanChartAvailability=instrumentContext.subscribe(()=>state.tradingPlanUi?.refreshChartActions?.());
window.addEventListener('pagehide',stopPlanChartAvailability,{once:true});
state.marketCalendarUi=initMarketCalendar({
  request,getBootstrap:()=>state.bootstrap,showToast,getReminderAccess:personalPreferencesAccess,
  getTodayAccess:()=>{const access=todayAccess();return {...access,allowed:access.allowed===true&&state.bootstrap?.capabilities?.marketCalendar===true};},
  resolveTodayInstrument:ref=>state.deepAnalytics?.currentResearch.resolve(ref),
  onTodayChange:()=>state.todayBinder?.update(),
  onTodayNavigate:({isCurrent})=>{if(isCurrent()!==true)return false;activateView('events',null,{focusMain:false,ensureEventNews:false});return isCurrent()===true;},
  onChartSelect:instrument=>{
    if(!instrument)return;
    if(state.currentView!=='terminal')activateView('terminal');
    if(state.terminalUi){void state.terminalUi.openInstrument(instrument);return;}
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
    if(state.currentView==='terminal')void renderMarketChart();
  }
});
document.addEventListener('invest:catalog-updated', () => {
  if (!state.bootstrap) return;
  syncInstrumentSources(state.marketCalendarUi?.getCatalog()||[]);
  state.searchUi?.update();
  prepareDisplayLabels(state.bootstrap);
  renderPortfolio(analyticsDisplayData());
});
for (const button of $$('[data-analytics-unit]')) button.addEventListener('click', () => { state.analyticsChartMode = button.dataset.analyticsUnit; state.analyticsChartModeTouched = true; renderAnalyticsChartOnView(); });
const personalAvailable=(!runtimeAdapter || state.bootstrap?.preview?.interactiveTutorial===true) && state.bootstrap?.preview?.localReview!==true;
if(personalAvailable) { $('#personalSettings').hidden=false; state.personalUi = initWorkspacePreferences({ request, showToast, onPresentation:applyPresentation,onStateChange:()=>state.personalTransferUi?.update(),getAccess:()=>{const access=personalPreferencesAccess();return{key:access.key,allowed:access.canNative||state.bootstrap?.preview?.interactiveTutorial===true};} }); }
else $('#personalSettings').hidden = true;
state.personalTransferUi=createPersonalPreferencesTransferUi({host:$('#personalPreferencesTransfer'),request,getAccess:personalPreferencesAccess,getEditor:()=>state.personalUi?.status()||{},onApplied:(settings,options)=>state.personalUi?.accept(settings,options)});
state.priceAlertUi = initPriceAlerts({ getBootstrap: () => state.bootstrap,
  getCsrf: () => state.session?.csrfToken, getBootstrapRevision: () => state.searchAccessRevision || 0,
  refreshAccess: async () => { const data = await request('/api/bootstrap'); state.session = { csrfToken: data.csrfToken }; renderBootstrap(data); },
  readOnly: Boolean(runtimeAdapter) || state.bootstrap?.preview?.localReview === true && state.bootstrap?.environment !== 'fixture', showToast, activateView });
state.workspaceNotifications = initWorkspaceNotifications({ activateView, getAlertAuthority: () => state.priceAlertUi?.notificationAuthority() || null,
  getServiceKey: () => JSON.stringify([state.bootstrap?.identity?.preferenceScope,state.bootstrap?.identity?.userId,state.bootstrap?.environment]) });
state.positionReconciliationUi=createPositionReconciliation({host:$('#positionReconciliation'),getInstrumentLabel:instrumentUid=>instrumentDisplay({instrumentUid})});
state.positionReconciliationUi.update(analyticsDisplayData());
const localMethodHost=document.createElement('section');localMethodHost.id='localMethodExplanation';
state.performanceMethodsUi=createPerformanceMethodsUi({host:$('#performanceMethods'),explanationHost:localMethodHost,onSurfaceChange:()=>state.localMethodWorkspace?.contextChanged()});
state.performanceMethodsUi.update(analyticsDisplayData());
const localObservedRiskHost=document.createElement('section');localObservedRiskHost.id='localObservedRiskExplanation';
state.observedNavRiskUi=createObservedNavRiskUi({host:$('#observedNavRisk'),explanationHost:localObservedRiskHost,onSurfaceChange:()=>state.localObservedRiskWorkspace?.contextChanged()});
state.observedNavRiskUi.update(analyticsDisplayData());
state.savedAssetClassesUi=createSavedAssetClassesUi({host:$('#savedAssetClasses')});
state.savedAssetClassesUi.update(analyticsDisplayData());
state.allocationPlanUi=createAllocationPlanUi({host:$('#allocationPlan'),request,canUseContext:()=>!runtimeAdapter&&!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft});
state.allocationPlanUi.update(analyticsDisplayData());
window.addEventListener('pagehide',()=>state.allocationPlanUi.dispose(),{once:true});
state.cashComparisonUi=createCashComparisonUi({host:$('#cashComparison')});
state.cashComparisonUi.update(analyticsDisplayData());
state.internalTransfersUi=createInternalCashTransfersUi({host:$('#internalTransfers'),request,onChanged:loadBootstrap});
state.shareValuationsUi=createShareTransferValuationsUi({host:$('#shareTransferValuations'),request,onChanged:loadBootstrap,canUseContext:()=>!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft});
state.brokerReportsUi=createBrokerReportsUi({host:$('#brokerReports'),request});
state.brokerReportsUi.update(analyticsDisplayData());
window.addEventListener('pagehide',()=>state.brokerReportsUi.dispose(),{once:true});
state.internalTransfersUi.update(analyticsDisplayData());
state.shareValuationsUi.update(analyticsDisplayData());
window.addEventListener('pagehide',()=>state.internalTransfersUi.dispose(),{once:true});
window.addEventListener('pagehide',()=>state.shareValuationsUi.dispose(),{once:true});
state.directShareShockUi=createDirectShareShockUi({host:$('#directShareShock')});
state.directShareShockUi.update(analyticsDisplayData());
state.directShareConcentrationUi=createDirectShareConcentrationUi({host:$('#directShareConcentration'),request,canUseContext:()=>!runtimeAdapter&&!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft});
state.directShareConcentrationUi.update(analyticsDisplayData());
state.futureExposureUi=createFutureExposureUi({host:$('#futureExposure')});
state.futureExposureUi.update(analyticsDisplayData());
window.addEventListener('pagehide',()=>state.directShareConcentrationUi.dispose(),{once:true});
state.portfolioReviewUi=createPortfolioReviewUi({host:$('#portfolioReviews'),request,canUseContext:()=>!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft});
state.portfolioReviewUi.update(analyticsDisplayData());
const localResultHost=document.createElement('section');localResultHost.id='localResultExplanation';
state.bookedComponentsUi=createBookedComponentsUi({host:$('#bookedComponents'),explanationHost:localResultHost,onSurfaceChange:()=>state.localResultWorkspace?.contextChanged()});
installAccountQuickPick();
state.bookedComponentsUi.update(analyticsDisplayData());
state.referencePriceUi=createReferencePriceUi({host:$('#referencePrice'),request,getScopeKey:()=>instrumentScope(state.bootstrap),getPortfolioId:()=>state.analyticsAccount});
state.referencePriceUi.update(analyticsDisplayData());
state.bondCashflowUi=createBondCashflowUi({host:$('#bondCashflows'),request,getBootstrap:()=>state.bootstrap,getPortfolioId:()=>state.analyticsAccount,
  canUseContext:()=>!runtimeAdapter&&!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft,
  onOpenEvents:(instrumentUid,date)=>{
    const key=state.bootstrap?.bondCashflowContext?.key;
    const isCurrent=()=>Boolean(key)&&key===state.bootstrap?.bondCashflowContext?.key&&state.bootstrap?.capabilities?.marketCalendar===true;
    return isCurrent()&&state.marketCalendarUi?.openBondCoupons(instrumentUid,{date,type:'all',refresh:false,isCurrent})===true;
  }});
state.bondCashflowUi.update(analyticsDisplayData());
window.addEventListener('pagehide',()=>state.bondCashflowUi.dispose(),{once:true});
state.deepAnalytics=createDeepAnalytics({panel:$('[data-view-panel=analytics]'),request:instrumentContextRequest,getBootstrap:()=>state.bootstrap,getSelected:()=>state.activeMarketInstrument,context:instrumentContext,onCatalog:syncInstrumentSources,onOpenCompany:openContextCompany,companyEligible:companyInstrumentEligible,onViewChange:view=>{state.analyticsView=view;renderSurfacePeriod();invalidateLocalExplanations();if(state.currentView==='analytics')state.taskNavigation?.sync(taskNavigationContext());},onPortfolioAreaChange:invalidateLocalExplanations,onOpenChart:openContextChart,onOpenCoupons:openContextCoupons,
  readResearchCatalog:()=>request('/api/market/catalog'),canResearch:()=>state.savedResearchWorkspace?.canResearch()===true,
  onResearchNavigate:()=>activateView('analytics',null,{focusMain:false,activateResearch:false}),
  onResearchContextChange:()=>state.savedResearchWorkspace?.contextChanged(),onQueryArchiveChanged:()=>state.querySearch?.invalidate()});
const savedResearchHost=document.createElement('section');savedResearchHost.id='savedResearch';
$('.deep-instrument-toolbar').after(savedResearchHost);
state.savedResearchWorkspace=createSavedResearchWorkspace({host:savedResearchHost,currentResearch:state.deepAnalytics.currentResearch,getBootstrap:()=>state.bootstrap,getCsrf:()=>state.session?.csrfToken,staticPreview:Boolean(runtimeAdapter&&state.bootstrap?.environment==='fixture'&&state.bootstrap?.preview?.static===true),refreshAccess:loadBootstrap,onChange:()=>{state.searchUi?.update();updateToday();invalidateLocalExplanations();}});
state.savedResearchWorkspace.contextChanged();
// Start catalogue reads after the owner/access controller is established.
state.terminalUi=initTerminal({request:instrumentContextRequest,getSelection:()=>state.activeMarketInstrument,getBootstrap:()=>state.bootstrap,readyPromise:initialBootstrap,
  onSelection:(instrument,{focusContext=true}={})=>{state.activeMarketInstrument=instrument;state.marketInstrument=instrument;instrumentContext.select(instrument,{surface:'terminal',focusContext});},onChart:chart=>{state.marketChart=chart;},onPreparePlan:prepareTerminalJournalPlan,showToast});
state.terminalUi.updateAccess();
// Navigation can finish while bootstrap is still constructing the terminal.
state.terminalUi.activate(state.currentView);
$('.terminal-workspace-bar').after($('#terminalInstrumentContext'));
terminalContextHeader=mountInstrumentContextHeader({host:$('#terminalInstrumentContext'),context:instrumentContext,surface:'terminal',onResearch:openContextResearch,onCompany:openContextCompany,onReturn:returnFromChart,returnState:chartReturnState,companyEligible:companyInstrumentEligible});
mountInstrumentContextHeader({host:$('#companyInstrumentContext'),context:instrumentContext,surface:'company',onResearch:openContextResearch,onChart:openContextChart,companyEligible:companyInstrumentEligible});
instrumentContext.subscribe(syncCompanyContext);
state.localResultWorkspace=createLocalResultWorkspace({host:localResultHost,bookedUi:state.bookedComponentsUi,getBootstrap:()=>state.bootstrap,
  getBootstrapRevision:()=>state.searchAccessRevision||0,getAccessToken:()=>state.savedResearchWorkspace.getAccessToken(),canResearch:()=>state.savedResearchWorkspace.canResearch(),
  getIsActive:()=>state.currentView==='analytics'&&['portfolio','capital'].includes(state.analyticsView)&&state.deepAnalytics.getPortfolioArea()==='performance'&&!$('#bookedComponents').hidden&&!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft,getCsrf:()=>state.session?.csrfToken,
  onAccessRejected:detail=>state.savedResearchWorkspace.rejectAccess(detail),staticPreview:Boolean(runtimeAdapter&&state.bootstrap?.preview?.static===true)});
state.localResultWorkspace.update(analyticsDisplayData());
state.localMethodWorkspace=createLocalMethodWorkspace({host:localMethodHost,methodUi:state.performanceMethodsUi,getBootstrap:()=>state.bootstrap,
  getBootstrapRevision:()=>state.searchAccessRevision||0,getAccessToken:()=>state.savedResearchWorkspace.getAccessToken(),canResearch:()=>state.savedResearchWorkspace.canResearch(),
  getIsActive:()=>state.currentView==='analytics'&&['portfolio','capital'].includes(state.analyticsView)&&state.deepAnalytics.getPortfolioArea()==='performance'&&!$('#performanceMethods').hidden&&!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft,getCsrf:()=>state.session?.csrfToken,
  onAccessRejected:detail=>state.savedResearchWorkspace.rejectAccess(detail),staticPreview:Boolean(runtimeAdapter&&state.bootstrap?.preview?.static===true)});
state.localMethodWorkspace.update(analyticsDisplayData());
state.localObservedRiskWorkspace=createLocalObservedRiskWorkspace({host:localObservedRiskHost,riskUi:state.observedNavRiskUi,getBootstrap:()=>state.bootstrap,
  getBootstrapRevision:()=>state.searchAccessRevision||0,getAccessToken:()=>state.savedResearchWorkspace.getAccessToken(),canResearch:()=>state.savedResearchWorkspace.canResearch(),
  getIsActive:()=>state.currentView==='analytics'&&['portfolio','capital'].includes(state.analyticsView)&&state.deepAnalytics.getPortfolioArea()==='risk'&&!$('#observedNavRisk').hidden&&!state.periodLoading&&!state.statisticsPeriodDraft&&!state.operationPeriodDraft,getCsrf:()=>state.session?.csrfToken,
  onAccessRejected:detail=>state.savedResearchWorkspace.rejectAccess(detail),staticPreview:Boolean(runtimeAdapter&&state.bootstrap?.preview?.static===true)});
state.localObservedRiskWorkspace.update(analyticsDisplayData());
state.todayUi=createTodayOverviewUi({host:$('#todayOverview'),isCurrent:ticket=>state.todayBinder?.isCurrent(ticket)===true,onNavigate:(intent,ticket)=>state.todayBinder.onNavigate(intent,ticket)});
state.todayBinder=createTodayOverviewBinder({getContext:todayContext,
  getEnvironment:()=>({currentScope:state.deepAnalytics.currentResearch.capture().scopeKey,resolve:state.deepAnalytics.currentResearch.resolve,canResearch:state.deepAnalytics.currentResearch.canResearch}),
  calendar:{getSnapshot:state.marketCalendarUi.getTodaySnapshot,openEvent:state.marketCalendarUi.openEvent,openReminder:state.marketCalendarUi.openReminder},
  savedResearch:state.savedResearchWorkspace,now:()=>'2026-08-12T12:00:00.000Z',onUpdate:dto=>state.todayUi.update(dto),onNavigateSection:todayNavigateSection});
updateToday();state.todayUi.update(state.todayBinder.getSnapshot());
void state.marketCalendarUi.refreshHoldings();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateToday();});
window.addEventListener('pagehide',()=>{state.todayBinder.dispose();state.todayUi.dispose();state.localResultWorkspace.dispose();state.bookedComponentsUi.dispose();state.localMethodWorkspace.dispose();state.performanceMethodsUi.dispose();state.localObservedRiskWorkspace.dispose();state.observedNavRiskUi.dispose();},{once:true});
initGlobalSearch();
state.deepAnalytics.update(analyticsDisplayData());
state.taskNavigation=createDirectNavigation({presentation:state.customization,navigate:navigateTask,current:taskNavigationContext,title:route=>{
  if(route){const names={today:'Сегодня',portfolio:'Портфель',research:'Исследование',trading:'Моя торговля',terminal:'Терминал'};$('#viewTitle').textContent=names[route.section];$('#viewContext').textContent=route.label+' · '+route.context;}
  else {const [title,context]=viewMeta[state.currentView]||viewMeta.overview;$('#viewTitle').textContent=title;$('#viewContext').textContent=context;}
}});
const workbenchPresentation=initNexusWorkbench(document,{request,store:workspaceSettings,getMarketAccess:()=>{const b=state.bootstrap||{},identity=b.identity||b.session?.identity||{};const fixtureOwner=!identity.role&&b.environment==='fixture'&&b.capabilities?.savedResearch===true;return {allowed:(identity.role==='owner'||fixtureOwner)&&b.preview?.static!==true,key:JSON.stringify([identity.preferenceScope||identity.userId||b.savedResearch?.ownerScope||null,identity.role,b.capabilities?.savedResearch,b.environment,b.preview?.static])};}});
window.addEventListener('pagehide',()=>workbenchPresentation.dispose(),{once:true});
const settingsLayout=mountSettingsLayout(document);
window.addEventListener('pagehide',()=>settingsLayout.dispose(),{once:true});
await initialBootstrap;
if (state.navigationRevision === initialNavigationRevision) {
  const section=location.hash.match(/^#workspace\/(view|task|system)\/([a-z][a-z0-9-]{0,63})$/);
  const selector=section&&({view:'.nav-item[data-view="'+section[2]+'"]',task:'.task-nav-item[data-task-section="'+section[2]+'"]',system:'.nav-item[data-system-section="'+section[2]+'"]'})[section[1]],target=selector&&document.querySelector(selector);
  if(target&&!target.disabled)target.click();else state.taskNavigation.restore();
}
document.addEventListener('invest:task-route-request',event=>{if(state.taskNavigation.go(event.detail,{save:false}))event.preventDefault();});
window.addEventListener('pagehide',()=>state.taskNavigation.dispose(),{once:true});
document.addEventListener('invest:open-analysis',e=>openContextResearch(e.detail));
if(state.currentView==='analytics')void state.deepAnalytics.activate();
openStream();
setInterval(() => { void ensureCompanyFacts(); }, 60_000);
document.addEventListener('visibilitychange', () => {sendMarketSubscription();if(!document.hidden){void ensureCompanyFacts();if(!state.stream&&!state.streamAuthorizationFailed){state.streamRetryAttempts=0;openStream();}}});
// GitHub Pages fixture intentionally has no service worker.

function personalPreferencesAccess(){
  const b=state.bootstrap||{},scope=b.identity?.preferenceScope||b.session?.identity?.preferenceScope;
  const canNative=!runtimeAdapter&&b.preview?.localReview!==true&&/^[a-f0-9]{32}$/.test(scope||'')&&b.capabilities?.marketCalendar===true&&!state.personalPreferencesDenied;
  const staticFile=b.preview?.static===true&&b.preview?.brokerNetwork===false&&b.preview?.persistence==='none';
  return{key:JSON.stringify([scope,state.personalPreferencesEpoch||0,canNative,staticFile]),canNative,canOpen:canNative||staticFile};
}
function applyPresentation(preferences,{refreshFx=true}={}) {
  state.language=preferences.language||'ru';state.displayCurrency=preferences.displayCurrency||'RUB';
  setLanguage(state.language);
  setChartPresentation({language:state.language,displayCurrency:state.displayCurrency,rates:state.bootstrap?.displayFx?.rates||{}});
  if(state.bootstrap) { renderPeriodViews(); renderOperations({operations:state.operationRows},{page:state.operationPage}); }
  const fx=state.bootstrap?.displayFx?.rates?.USD;
  $('#displayCurrencyNote').textContent=state.displayCurrency==='USD'
    ? fx?`${fx.source==='fixture'?ui('Учебный курс на'):ui('Показ сумм по курсу ЦБ на')} ${fx.date}. ${ui('Котировки — в валюте инструмента. Проценты — в рублях.')}`:ui('Нет сохранённого курса USD. Обновите данные: непересчитанные суммы отмечены прочерком.')
    :ui('Суммы портфеля и результатов — в рублях. Котировки — в валюте инструмента.');
  if(refreshFx&&state.displayCurrency==='USD' && !state.fxRequested && !state.bootstrap?.preview?.static) {
    state.fxRequested=true;
    void request('/api/display-fx/refresh',{method:'POST',body:'{}'}).then(value=>{
      state.bootstrap.displayFx=value;
      applyPresentation({language:state.language,displayCurrency:state.displayCurrency});
    }).catch(()=>{ $('#displayCurrencyNote').textContent=ui('Курс ЦБ сейчас недоступен. Показан последний сохранённый курс; без курса суммы отмечены прочерком.'); });
  }
}
connectTableSort($('#instrumentRankingTable'),['name',null,'pnlNanos','contributionRate'],sort=>{state.sorts.contributions=sort;state.listPages.delete('instrumentRanking');renderAnalytics(analyticsDisplayData());});
connectTableSort($('#positionsBody').closest('table'),['name','type','openedAt','quantityNanos','averagePriceNanos','positionValueNanos','share','totalPnlNanos'],sort=>{state.sorts.positions=sort;renderPortfolio(analyticsDisplayData());});
connectTableSort($('#operationsBody').closest('table'),['name','occurredAt','type','quantityNanos','paymentNanos','commissionNanos','state'],sort=>{state.sorts.operations=sort;renderOperations({operations:state.operationRows});});
connectTableSort($('#closedPositionsBody').closest('table'),['name','type','openedAt','closedAt','quantityNanos','entryPriceNanos','pnlNanos'],sort=>{state.sorts.closed=sort;state.listPages.delete('closedPositions');renderClosedPositions(state.bootstrap);});
connectTableSort($('#tradingPlanBody').closest('table'),['name','direction','allocationRate','entryPriceNanos','exitPriceNanos','expectedHold'],sort=>{state.sorts.plan=sort;state.listPages.delete('tradingPlan');renderRiskPlan(analyticsDisplayData());});
startTranslation();

let backgroundBootstrap = null;
let backgroundBootstrapAt=0,backgroundBootstrapTimer=null;
async function refreshBackgroundBootstrap() {
  if (state.periodLoading) return false;
  // Quote streaming is independent. A trader does not need the complete
  // account calculation and hidden statistical surfaces every five seconds.
  clearTimeout(backgroundBootstrapTimer);backgroundBootstrapTimer=null;
  const wait=30_000-(Date.now()-backgroundBootstrapAt);
  if(state.currentView==='terminal'&&wait>0){
    backgroundBootstrapTimer=setTimeout(()=>void refreshBackgroundBootstrap().catch(()=>{}),wait);
    return false;
  }
  const version = state.periodRequest, scope = instrumentScope(), key = JSON.stringify([version, scope]);
  if (backgroundBootstrap?.key === key) return backgroundBootstrap.promise;
  const task = { key };
  backgroundBootstrapAt=Date.now();
  task.promise = (async () => {
    const data = await request('/api/bootstrap?' + periodQuery(), { signal: AbortSignal.timeout(90_000) });
    if (version !== state.periodRequest || state.periodLoading || scope !== instrumentScope()) return false;
    state.session = { csrfToken: data.csrfToken }; renderBootstrap(data,{background:true}); return true;
  })().finally(() => { if (backgroundBootstrap === task) backgroundBootstrap = null; });
  backgroundBootstrap = task; return task.promise;
}
const historyLoader = createHistoryLoader({ request, getScope: instrumentScope,
  eligible: () => !document.hidden && !runtimeAdapter && state.bootstrap?.environment === 'live'
    && state.bootstrap?.connection?.connected === true && state.bootstrap?.capabilities?.portfolioRefresh === true
    // A reserved next snapshot leaves no idle UI tick. The runtime serializes
    // each bounded history step with snapshots; catch-up must not starve.
    && ['completed','warning'].includes(state.syncUi?.getState()?.latest?.status),
  onProgress: value => { if (state.bootstrap) state.bootstrap.historyBackfill = value; renderHistoryProgress(value); },
  onChanged: refreshBackgroundBootstrap,
});
historyLoader.start();
window.addEventListener('pagehide', () => historyLoader.stop());
window.addEventListener('pageshow', () => historyLoader.start());

state.syncUi = createSyncController({ request,
  getAccess: () => ({ key: JSON.stringify([state.bootstrap?.identity?.preferenceScope, state.connection?.environment,
    state.connection?.validatedAt, state.connection?.connected, state.bootstrap?.capabilities?.syncProgress]),
    allowed: !runtimeAdapter && state.bootstrap?.preview?.localReview !== true && state.bootstrap?.capabilities?.syncProgress === true
      && state.connection?.connected === true, visible: !document.hidden }),
  onState: renderSyncProgress,
  onChanged: refreshBackgroundBootstrap,
  onComplete: job => showToast(job.status === 'failed' ? syncProgressCopy(job) : job.status === 'warning'
    ? 'Синхронизация завершена с ограничениями. Подробности — в журнале.' : 'Синхронизация завершена. Показатели обновлены.', job.status === 'failed'),
});
state.syncUi.start();
window.addEventListener('pagehide', () => state.syncUi.stop());
window.addEventListener('pageshow', () => state.syncUi.start());
document.addEventListener('visibilitychange', () => { if(!document.hidden)void state.syncUi.tick(); });
companyPicker=createInstrumentPicker({select:$('#aiInstrument'),getRows:()=>state.bootstrap?.companyAnalysisInstruments?.filter(item=>item.assetType==='share')||[],label:'Выбрать компанию',showClose:false});
initRailSelection();
