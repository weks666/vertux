import { createProfileSecurity } from './profile-security.js';
// Personal controls reused from the existing Nexus account/settings UI. No platform APIs.
export function createPersonalAccount({ state, request, refreshProducts, renderAccount, escapeHtml, accountRoute, root = document, desktopBridge = window.nexusDesktop, embedded = false, workspaceNavigation = null, onAuthRequired = () => location.replace('/'), openExternal = url => location.assign(url) }) {
const $ = (selector, scope = root) => scope.querySelector(selector);
const $$ = (selector, scope = root) => [...scope.querySelectorAll(selector)];
const securityControls=createProfileSecurity({root,request,onEmailChanged:async result=>{state.me={...state.me,email:result.email};await loadProfile();},onSessionRevoked:onAuthRequired});
const defaultAppShortcuts = Object.freeze(workspaceNavigation?.defaults || { overview:'Ctrl+1', products:'Ctrl+2', support:'Ctrl+3', launchCenter:'Ctrl+K', settings:'Ctrl+,' });
const appShortcutActions=Object.freeze(Object.keys(defaultAppShortcuts));
const updaterStatuses=new Set(['unsupported','idle','checking','available','downloading','downloaded','current','error']);
function sanitizeText(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function compareVersions(left, right) {
  const parts = (value) => String(value || '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const a = parts(left); const b = parts(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0) ? 1 : -1;
  }
  return 0;
}

function desktopUpdateRequired() {
  const electronClient = navigator.userAgent.includes('Electron/');
  const minimum = state.status?.minimumDesktopVersion || '';
  const current = state.desktopClient?.version || '';
  return electronClient && Boolean(minimum) && (!current || compareVersions(current, minimum) < 0);
}

function desktopUpgradeSuggested() {
  if (desktopUpdateRequired()) return true;
  const electronClient = navigator.userAgent.includes('Electron/');
  const recommended = state.status?.recommendedDesktopVersion || state.status?.minimumDesktopVersion || '';
  const current = state.desktopClient?.version || '';
  return electronClient && Boolean(recommended) && (!current || compareVersions(current, recommended) < 0);
}

function desktopCapability(name) {
  return state.desktopClient?.capabilities?.[name] === true;
}

function hasAppSettingsCapability() {
  return desktopCapability('appSettings');
}

function hasAppSettingsBridge() {
  return hasAppSettingsCapability()
    && typeof desktopBridge?.getAppSettings === 'function'
    && typeof desktopBridge?.updateAppSettings === 'function';
}

function hasAppUpdaterBridge() {
  return desktopCapability('appUpdater')
    && typeof desktopBridge?.checkForUpdates === 'function'
    && typeof desktopBridge?.downloadUpdate === 'function'
    && typeof desktopBridge?.installUpdate === 'function'
    && typeof desktopBridge?.onUpdateState === 'function';
}

function settingsPayload(value) {
  if (value?.settings && typeof value.settings === 'object') return value.settings;
  if (value?.data?.settings && typeof value.data.settings === 'object') return value.data.settings;
  if (value?.data && typeof value.data === 'object') return value.data;
  return value;
}

function looksLikeAppSettings(value) {
  const source = settingsPayload(value);
  return Boolean(source && typeof source === 'object' && (
    Object.hasOwn(source, 'autoDownload')
    || Object.hasOwn(source, 'installOnExit')
    || Object.hasOwn(source, 'launchAtLogin')
    || Object.hasOwn(source, 'shortcuts')
  ));
}

function normalizeAppSettings(value) {
  const source = settingsPayload(value);
  if (!source || typeof source !== 'object') return null;
  const shortcuts = { ...defaultAppShortcuts };
  for (const action of appShortcutActions) {
    const binding = String((workspaceNavigation ? workspaceNavigation.read() : source.shortcuts)?.[action] || '').trim();
    if (binding) shortcuts[action] = binding.slice(0, 40);
  }
  return {
    autoDownload: source.autoDownload === true,
    installOnExit: source.installOnExit === true,
    launchAtLogin: source.launchAtLogin === true,
    shortcuts,
  };
}

function bridgeResultError(result) {
  const failure = result?.error && typeof result.error === 'object' ? result.error : null;
  if (result?.ok !== false && !failure) return;
  const error = new Error('Desktop bridge rejected the action');
  error.code = failure?.code || result?.code || 'DESKTOP_ACTION_REJECTED';
  error.field = failure?.field || result?.field || '';
  throw error;
}

function desktopActionMessage(error, fallback = 'Windows-приложение не подтвердило действие. Повторите попытку.') {
  return ({
    SHORTCUT_DUPLICATE: 'Это сочетание уже назначено другому действию.',
    DUPLICATE_SHORTCUT: 'Это сочетание уже назначено другому действию.',
    SHORTCUT_RESERVED: 'Это сочетание занято Windows или самим приложением. Выберите другое.',
    RESERVED_SHORTCUT: 'Это сочетание занято Windows или самим приложением. Выберите другое.',
    SHORTCUT_INVALID: 'Введите одно сочетание с клавишей и модификатором, например Ctrl+4.',
    INVALID_SHORTCUT: 'Введите одно сочетание с клавишей и модификатором, например Ctrl+4.',
    INVALID_SHORTCUTS: 'Настройки сочетаний имеют неверный формат.',
    APP_SETTINGS_UNAVAILABLE: 'Настройки приложения недоступны в этой сборке Nexus.',
    APP_SETTINGS_INVALID: 'Windows-приложение отклонило значение настройки.',
    INVALID_APP_SETTINGS: 'Windows-приложение отклонило значение настройки.',
    INVALID_APP_SETTINGS_PATCH: 'Windows-приложение отклонило изменение настройки.',
    APP_SETTINGS_WRITE_FAILED: 'Не удалось безопасно сохранить настройки приложения.',
    LOGIN_ITEM_UPDATE_FAILED: 'Windows не подтвердила настройку запуска вместе с системой.',
    LOGIN_ITEM_UNSUPPORTED: 'Автозапуск можно включить только в установленной Setup-версии Nexus.',
    UPDATE_UNSUPPORTED: 'Эта сборка не поддерживает автоматические обновления.',
    UPDATE_STATE_INVALID: 'Windows-приложение вернуло неподдерживаемое состояние обновления.',
    UPDATE_BUSY: 'Другая операция обновления уже выполняется.',
    UPDATE_NOT_AVAILABLE: 'Скачивать пока нечего. Сначала проверьте обновления.',
    UPDATE_NOT_DOWNLOADED: 'Обновление ещё не скачано.',
  })[String(error?.code || '')] || fallback;
}

async function loadAppSettings() {
  if (!hasAppSettingsCapability()) return null;
  if (!hasAppSettingsBridge()) {
    state.appSettingsError = 'Для этих настроек нужна актуальная версия Vertux Nexus Desktop.';
    renderApplicationSettings();
    return null;
  }
  if (state.appSettingsLoading) return state.appSettings;
  state.appSettingsLoading = true;
  state.appSettingsError = '';
  renderApplicationSettings();
  try {
    const result = await desktopBridge.getAppSettings();
    bridgeResultError(result);
    const confirmed = normalizeAppSettings(result);
    if (!confirmed || !looksLikeAppSettings(result)) throw Object.assign(new Error('Invalid app settings response'), { code: 'APP_SETTINGS_INVALID' });
    state.appSettings = confirmed;
    return confirmed;
  } catch (error) {
    state.appSettingsError = desktopActionMessage(error, 'Не удалось прочитать настройки приложения. Перезапустите Nexus и повторите.');
    return null;
  } finally {
    state.appSettingsLoading = false;
    renderApplicationSettings();
  }
}

async function saveAppSettingsPatch(patch) {
  if (workspaceNavigation && patch.shortcuts) {
    const shortcuts=workspaceNavigation.update(patch.shortcuts);
    state.appSettings={...state.appSettings,shortcuts}; renderShortcutSettings(); return state.appSettings;
  }
  if (!hasAppSettingsBridge()) throw Object.assign(new Error('App settings bridge unavailable'), { code: 'APP_SETTINGS_UNAVAILABLE' });
  const result = await desktopBridge.updateAppSettings(patch);
  bridgeResultError(result);
  const payload = looksLikeAppSettings(result) ? result : await desktopBridge.getAppSettings();
  bridgeResultError(payload);
  const confirmed = normalizeAppSettings(payload);
  if (!confirmed || !looksLikeAppSettings(payload)) throw Object.assign(new Error('Invalid app settings response'), { code: 'APP_SETTINGS_INVALID' });
  state.appSettings = confirmed;
  state.appSettingsError = '';
  renderApplicationSettings();
  return confirmed;
}

function normalizeUpdateState(value) {
  const source = value?.updateState || value?.state || value;
  if (!source || typeof source !== 'object') return null;
  const rawStatus = String(source.status || '').toLowerCase();
  const validStatus = updaterStatuses.has(rawStatus);
  const status = validStatus ? rawStatus : 'unsupported';
  const rawPercent = typeof source.progress === 'number' ? source.progress : source.progress?.percent;
  const percent = Number.isFinite(Number(rawPercent)) ? Math.max(0, Math.min(100, Number(rawPercent))) : null;
  return {
    status,
    currentVersion: sanitizeText(source.currentVersion || state.desktopClient?.version, ''),
    availableVersion: sanitizeText(source.availableVersion || source.version, ''),
    progress: percent,
    reason: validStatus ? String(source.reason || '').slice(0, 80) : 'invalid_state',
    required: source.required === true,
    canAutoUpdate: validStatus && status !== 'unsupported' && source.canAutoUpdate === true,
  };
}

function effectiveUpdateState() {
  if (!desktopCapability('appUpdater')) {
    return { status: 'unsupported', currentVersion: sanitizeText(state.desktopClient?.version, ''), availableVersion: '', progress: null, reason: String(state.desktopClient?.updateReason || ''), required: false, canAutoUpdate: false };
  }
  if (!hasAppUpdaterBridge()) {
    return { status: 'unsupported', currentVersion: sanitizeText(state.desktopClient?.version, ''), availableVersion: '', progress: null, reason: 'bridge_unavailable', required: false, canAutoUpdate: false };
  }
  return state.updateState || { status: 'unsupported', currentVersion: sanitizeText(state.desktopClient?.version, ''), availableVersion: '', progress: null, reason: 'invalid_state', required: false, canAutoUpdate: false };
}

function updaterUnavailableMessage(reason = '') {
  const installationKind = String(state.desktopClient?.installationKind || '').toLowerCase();
  const normalizedReason = String(reason || '').toLowerCase();
  if (['portable', 'portable_build'].includes(normalizedReason) || installationKind === 'portable') return 'Portable-сборка не меняет себя автоматически. Установите проверенную Setup-сборку вручную.';
  if (['dev', 'development_build'].includes(normalizedReason) || installationKind === 'dev' || installationKind === 'development') return 'В режиме разработки автоматические обновления отключены.';
  if (normalizedReason === 'non_windows') return 'Автоматические обновления этой оболочки доступны только в Windows.';
  if (normalizedReason === 'bridge_unavailable') return 'Для управления обновлениями нужна актуальная версия Vertux Nexus Desktop.';
  if (normalizedReason === 'invalid_state') return 'Не удалось получить состояние обновлений. Перезапустите Nexus и повторите проверку.';
  if (normalizedReason === 'not_installed_nsis') return 'Автообновление доступно только для установленной Setup-версии Nexus.';
  if (['publisher_identity_missing', 'current_signature_invalid'].includes(normalizedReason)) return 'Установку этой сборки не удалось подтвердить. Используйте официальный Setup Nexus.';
  if (normalizedReason === 'release_key_missing') return 'Автоматическое обновление в этой сборке пока недоступно. Новую версию можно установить через Setup.';
  if (normalizedReason === 'current_provenance_invalid') return 'Происхождение установленной версии не совпало с защищённым closed-pilot выпуском. Автообновление заблокировано.';
  if (normalizedReason === 'replay_state_unavailable') return 'Защищённое состояние обновлений Windows недоступно. Чтобы не допустить повтор или откат версии, автообновление заблокировано.';
  if (normalizedReason === 'updater_unavailable') return 'Безопасный модуль обновления недоступен в этой сборке.';
  if (normalizedReason === 'unsigned_or_feed_unavailable' || normalizedReason === 'unsigned') return 'Эта сборка не подключена к защищённому каналу обновлений. Используйте проверенный установщик Vertux.';
  if (!navigator.userAgent.includes('Electron/')) return 'Автоматические обновления доступны только в приложении Vertux Nexus Desktop.';
  return 'Эта сборка не подтвердила защищённый канал с релизным ключом. Используйте проверенный установщик Vertux.';
}

function updaterErrorMessage(reason = '') {
  return ({
    auth_required: 'Войдите в Vertux Nexus и повторите проверку обновлений.',
    feed_unavailable: 'Сервис обновлений временно недоступен. Проверьте подключение и повторите позже.',
    manifest_invalid: 'Манифест обновления не прошёл проверку. Установка заблокирована.',
    integrity_failed: 'Целостность или подпись обновления не подтверждена. Установка заблокирована.',
    update_not_available: 'Скачивать пока нечего. Сначала проверьте обновления.',
    update_not_downloaded: 'Обновление ещё не скачано.',
    operation_in_progress: 'Другая операция обновления уже выполняется.',
  })[String(reason || '').toLowerCase()] || 'Не удалось безопасно завершить операцию обновления. Повторите попытку.';
}

function installationKindLabel(value) {
  const kind = String(value || '').toLowerCase();
  return ({ nsis: 'Setup для Windows', setup: 'Setup для Windows', installed: 'Установленная', portable: 'Portable', dev: 'Разработка', development: 'Разработка' })[kind]
    || sanitizeText(value);
}

function updateChannelLabel(value) {
  const channel = String(value || '').toLowerCase();
  return ({ stable: 'Стабильный', beta: 'Beta', 'closed-pilot': 'Закрытый пилот', closed_pilot: 'Закрытый пилот', dev: 'Разработка' })[channel]
    || sanitizeText(value);
}

function setSettingsFeedback(selector, text = '', kind = '') {
  const element = $(selector);
  if (!element) return;
  element.textContent = text;
  if (kind) element.dataset.kind = kind;
  else delete element.dataset.kind;
}

function renderShortcutSettings() {
  const ready = Boolean(workspaceNavigation) || (hasAppSettingsBridge() && Boolean(state.appSettings) && !state.appSettingsLoading);
  for (const action of appShortcutActions) {
    const input = $(`#shortcutForm [name="${action}"]`);
    const button = $(`[data-save-shortcut="${action}"]`);
    if (!input || !button) continue;
    if (input.dataset.dirty !== 'true') input.value = state.appSettings?.shortcuts?.[action] || defaultAppShortcuts[action];
    input.disabled = !ready || Boolean(state.settingsBusy);
    button.disabled = !ready || Boolean(state.settingsBusy);
    if (input.dataset.error !== 'true') input.removeAttribute('aria-invalid');
  }
  const reset = $('#resetShortcutsButton');
  if (reset) reset.disabled = !ready || Boolean(state.settingsBusy);
  if (state.shortcutFeedback) setSettingsFeedback('#shortcutFeedback', state.shortcutFeedback, state.shortcutFeedbackKind);
  else if (workspaceNavigation) setSettingsFeedback('#shortcutFeedback', 'Работают только в этом Workspace. В полях ввода и диалогах сочетания не срабатывают.');
  else if (state.appSettingsError) setSettingsFeedback('#shortcutFeedback', state.appSettingsError, 'error');
  else if (!hasAppSettingsBridge()) setSettingsFeedback('#shortcutFeedback', 'Для сочетаний нужна актуальная версия Vertux Nexus Desktop.', 'warning');
  else if (state.appSettingsLoading || !state.appSettings) setSettingsFeedback('#shortcutFeedback', 'Загружаем сочетания из Windows-приложения…');
  else setSettingsFeedback('#shortcutFeedback', 'Сочетания не действуют в полях и диалогах. Команда «Настройки» также возвращает из окна Workspace.');
}

function renderUpdateSettings() {
  const update = effectiveUpdateState();
  const required = update.required || desktopUpdateRequired();
  const upgradeNeeded = required || desktopUpgradeSuggested();
  const inconsistentCurrent = upgradeNeeded && update.status === 'current';
  const displayStatus = inconsistentCurrent ? 'error' : update.status;
  const settingsReady = hasAppSettingsBridge() && Boolean(state.appSettings) && !state.appSettingsLoading;
  const updaterReady = hasAppUpdaterBridge() && update.canAutoUpdate === true && update.status !== 'unsupported';
  const currentVersion = sanitizeText(update.currentVersion || state.desktopClient?.version);
  const availableVersion = sanitizeText(update.availableVersion, 'новая версия');
  const percent = update.progress == null ? null : Math.round(update.progress);
  const statusCopy = {
    unsupported: ['Автообновление недоступно', updaterUnavailableMessage(update.reason)],
    idle: ['Готово к проверке', `Установлена версия ${currentVersion}. Здесь можно проверить наличие обновлений.`],
    checking: ['Проверяем обновления', 'Nexus проверяет, доступна ли новая версия приложения.'],
    available: [required ? 'Требуется обновление Nexus' : 'Доступно обновление Nexus', `Версия ${availableVersion} готова к скачиванию.`],
    downloading: ['Скачиваем обновление', percent == null ? `Загружается версия ${availableVersion}.` : `Загружается версия ${availableVersion}: ${percent}%.`],
    downloaded: ['Обновление готово', `Версия ${availableVersion} скачана. Установка начнётся только после явной команды «Перезапустить и установить».`],
    current: inconsistentCurrent
      ? ['Не удалось подтвердить актуальную версию', `Сервер ${required ? 'требует' : 'рекомендует'} более новую оболочку, но канал считает Nexus ${currentVersion} актуальным. Используйте проверенный Setup или обратитесь в поддержку.`]
      : ['Установлена актуальная версия', `Nexus ${currentVersion} обновлён до актуальной версии.`],
    error: ['Проверка не завершена', 'Не удалось подтвердить состояние обновления. Проверьте подключение и повторите проверку.'],
  }[update.status] || ['Состояние неизвестно', 'Windows-приложение не вернуло подтверждённое состояние обновлений.'];
  const status = $('#appUpdateStatus');
  if (status) status.dataset.state = displayStatus;
  $('#appUpdateStatusTitle').textContent = statusCopy[0];
  $('#appUpdateStatusMessage').textContent = statusCopy[1];
  const badge = $('#appUpdateStateBadge');
  if (badge) {
    badge.textContent = inconsistentCurrent ? 'Конфликт' : ({ unsupported: 'Недоступно', idle: 'Готово', checking: 'Проверка', available: 'Доступно', downloading: percent == null ? 'Загрузка' : `${percent}%`, downloaded: 'Скачано', current: 'Актуально', error: 'Ошибка' })[update.status] || 'Неизвестно';
    badge.dataset.state = displayStatus;
  }
  const progress = $('#appUpdateProgress');
  if (progress) {
    progress.hidden = update.status !== 'downloading' || percent == null;
    progress.value = percent ?? 0;
  }
  const autoDownload = $('#autoDownloadToggle');
  const installOnExit = $('#installOnExitToggle');
  if (autoDownload) {
    autoDownload.checked = state.appSettings?.autoDownload === true;
    autoDownload.disabled = !settingsReady || (!updaterReady && !autoDownload.checked) || Boolean(state.settingsBusy);
  }
  if (installOnExit) {
    installOnExit.checked = false;
    installOnExit.disabled = true;
  }
  const actionBusy = Boolean(state.updateBusy);
  const check = $('#checkForUpdatesButton');
  const download = $('#downloadUpdateButton');
  const install = $('#installUpdateButton');
  const manual = $('#manualUpdateButton');
  if (check) {
    check.disabled = !updaterReady || actionBusy || ['checking', 'downloading'].includes(update.status);
    check.textContent = state.updateBusy === 'check' || update.status === 'checking' ? 'Проверяем…' : 'Проверить обновления';
  }
  if (download) {
    download.hidden = update.status !== 'available';
    download.disabled = !updaterReady || actionBusy;
    download.textContent = state.updateBusy === 'download' ? 'Начинаем загрузку…' : 'Скачать';
  }
  if (install) {
    install.hidden = update.status !== 'downloaded';
    install.disabled = !updaterReady || actionBusy;
    install.textContent = state.updateBusy === 'install' ? 'Перезапускаем…' : 'Перезапустить и установить';
  }
  if (manual) {
    const manualRequired = upgradeNeeded && (!updaterReady || ['current', 'error'].includes(update.status));
    manual.hidden = !manualRequired;
    if (manualRequired) manual.dataset.externalUrl = state.status?.desktopDownloadUrl || 'https://vertux.online/download.html';
    else delete manual.dataset.externalUrl;
  }
  if (state.updateFeedback) setSettingsFeedback('#appUpdateFeedback', state.updateFeedback, state.updateFeedbackKind);
  else if (!updaterReady) setSettingsFeedback('#appUpdateFeedback', updaterUnavailableMessage(update.reason), 'warning');
  else setSettingsFeedback('#appUpdateFeedback');
}

function renderStartupSettings() {
  const toggle = $('#launchAtLoginToggle');
  const status = $('#startupState');
  if (!toggle || !status) return;
  const kind = String(state.desktopClient?.installationKind || '').toLowerCase();
  const unstableInstall = ['portable', 'dev', 'development'].includes(kind);
  const settingsReady = hasAppSettingsBridge() && Boolean(state.appSettings) && !state.appSettingsLoading;
  toggle.checked = state.appSettings?.launchAtLogin === true;
  const canChange = settingsReady && (!unstableInstall || toggle.checked);
  toggle.disabled = !canChange || Boolean(state.settingsBusy);
  status.textContent = !settingsReady || (unstableInstall && !toggle.checked) ? 'Недоступно' : toggle.checked ? 'Включён' : 'Выключен';
  status.dataset.state = !settingsReady || (unstableInstall && !toggle.checked) ? 'unsupported' : toggle.checked ? 'current' : 'idle';
  if (state.startupFeedback) setSettingsFeedback('#windowsStartupFeedback', state.startupFeedback, state.startupFeedbackKind);
  else if (kind === 'portable') setSettingsFeedback('#windowsStartupFeedback', toggle.checked ? 'Portable-путь нестабилен: автозапуск можно отключить, но повторное включение доступно только в Setup-версии.' : 'Portable-сборка может сменить путь. Используйте установленную Setup-версию для запуска вместе с Windows.', 'warning');
  else if (['dev', 'development'].includes(kind)) setSettingsFeedback('#windowsStartupFeedback', toggle.checked ? 'Автозапуск режима разработки можно отключить; повторное включение здесь заблокировано.' : 'Автозапуск отключён в режиме разработки.', 'warning');
  else if (state.appSettingsError) setSettingsFeedback('#windowsStartupFeedback', state.appSettingsError, 'error');
  else if (!hasAppSettingsBridge()) setSettingsFeedback('#windowsStartupFeedback', 'Для автозапуска нужна актуальная версия Vertux Nexus Desktop.', 'warning');
  else if (state.appSettingsLoading || !state.appSettings) setSettingsFeedback('#windowsStartupFeedback', 'Читаем фактическое состояние Windows…');
  else setSettingsFeedback('#windowsStartupFeedback', 'Состояние читается из настроек входа текущего пользователя Windows.');
}

function renderApplicationSettings() {
  if (!$('#settingsApplicationPane')) return;
  const capability = $('#appSettingsCapability');
  const settingsAvailable = hasAppSettingsCapability();
  if (capability) {
    capability.textContent = !settingsAvailable ? 'Недоступно' : state.appSettingsLoading ? 'Загрузка'
      : state.appSettingsError || !state.appSettings ? 'Ошибка чтения' : hasAppSettingsBridge() ? 'Подключено' : 'Нужна новая версия';
    capability.dataset.state = !settingsAvailable || !hasAppSettingsBridge() ? 'unsupported'
      : state.appSettingsLoading ? 'checking' : state.appSettingsError || !state.appSettings ? 'error' : 'current';
  }
  $('#desktopAppVersion').textContent = sanitizeText(state.desktopClient?.version);
  $('#desktopUpdateChannel').textContent = updateChannelLabel(state.desktopClient?.updateChannel);
  $('#desktopInstallationKind').textContent = installationKindLabel(state.desktopClient?.installationKind);
  renderUpdateSettings();
  renderStartupSettings();
  renderShortcutSettings();
  renderSettingsProducts();
}

async function saveBooleanAppSetting(field, requested) {
  if (state.settingsBusy) { renderApplicationSettings(); return; }
  const feedbackTarget = field === 'launchAtLogin' ? 'startup' : 'update';
  state.settingsBusy = field;
  if (feedbackTarget === 'startup') {
    state.startupFeedback = 'Сохраняем настройку Windows…'; state.startupFeedbackKind = '';
  } else {
    state.updateFeedback = 'Сохраняем настройку обновлений…'; state.updateFeedbackKind = '';
  }
  renderApplicationSettings();
  try {
    await saveAppSettingsPatch({ [field]: requested === true });
    if (feedbackTarget === 'startup') {
      state.startupFeedback = requested ? 'Nexus будет запускаться при входе текущего пользователя Windows.' : 'Автозапуск Nexus отключён.';
      state.startupFeedbackKind = 'success';
    } else {
      state.updateFeedback = 'Настройка обновлений сохранена.'; state.updateFeedbackKind = 'success';
    }
  } catch (error) {
    if (String(error?.code || '') === 'CANCELLED') {
      if (feedbackTarget === 'startup') { state.startupFeedback = 'Изменение автозапуска отменено.'; state.startupFeedbackKind = ''; }
      else { state.updateFeedback = 'Изменение настройки отменено.'; state.updateFeedbackKind = ''; }
      return;
    }
    const message = desktopActionMessage(error);
    if (feedbackTarget === 'startup') { state.startupFeedback = message; state.startupFeedbackKind = 'error'; }
    else { state.updateFeedback = message; state.updateFeedbackKind = 'error'; }
  } finally {
    state.settingsBusy = '';
    renderApplicationSettings();
  }
}

async function runUpdateAction(action) {
  if (state.updateBusy) return;
  const methods = { check: 'checkForUpdates', download: 'downloadUpdate', install: 'installUpdate' };
  const method = methods[action];
  if (!method || typeof desktopBridge?.[method] !== 'function' || !hasAppUpdaterBridge()) {
    state.updateFeedback = 'Эта сборка не поддерживает выбранное действие обновления.';
    state.updateFeedbackKind = 'error';
    renderUpdateSettings();
    return;
  }
  state.updateBusy = action;
  state.updateFeedback = action === 'check' ? 'Проверяем наличие обновлений…'
    : action === 'download' ? 'Начинаем загрузку…'
      : 'Nexus завершает работу перед установкой…';
  state.updateFeedbackKind = '';
  if (action === 'check') state.updateState = { ...effectiveUpdateState(), status: 'checking' };
  renderUpdateSettings();
  try {
    const result = await desktopBridge[method]();
    bridgeResultError(result);
    const confirmed = normalizeUpdateState(result);
    if (!confirmed) throw Object.assign(new Error('Invalid updater state response'), { code: 'UPDATE_STATE_INVALID' });
    state.updateState = confirmed;
    if (confirmed?.status === 'error') {
      state.updateFeedback = updaterErrorMessage(confirmed.reason);
      state.updateFeedbackKind = 'error';
    } else if (confirmed?.status === 'unsupported') {
      state.updateFeedback = updaterUnavailableMessage(confirmed.reason);
      state.updateFeedbackKind = 'warning';
    } else {
      state.updateFeedback = action === 'check' ? 'Проверка обновлений завершена.'
        : action === 'download' ? 'Запрос на загрузку подтверждён. Прогресс появится здесь.'
          : 'Команда установки передана Windows-приложению.';
      state.updateFeedbackKind = 'success';
    }
  } catch (error) {
    if (String(error?.code || '') === 'CANCELLED') {
      state.updateFeedback = 'Установка отменена. Скачанное обновление осталось готово к установке.';
      state.updateFeedbackKind = '';
      return;
    }
    if (action === 'check' && state.updateState?.status === 'checking') state.updateState = { ...effectiveUpdateState(), status: 'error' };
    state.updateFeedback = desktopActionMessage(error, action === 'check'
      ? 'Не удалось проверить обновления. Проверьте подключение и повторите.'
      : action === 'download' ? 'Не удалось начать загрузку обновления.' : 'Не удалось перезапустить Nexus для установки.');
    state.updateFeedbackKind = 'error';
  } finally {
    state.updateBusy = '';
    renderUpdateSettings();
  }
}

function normalizedAccelerator(value) {
  const tokens = String(value || '').split('+').map((part) => part.trim()).filter(Boolean);
  const modifiers = new Set();
  const keys = [];
  for (const rawToken of tokens) {
    const part = rawToken.toLowerCase();
    if (['ctrl', 'control', 'cmdorctrl', 'commandorcontrol'].includes(part)) modifiers.add('ctrl');
    else if (['alt', 'option'].includes(part)) modifiers.add('alt');
    else if (part === 'shift') modifiers.add('shift');
    else if (['meta', 'cmd', 'command', 'win', 'windows'].includes(part)) modifiers.add('meta');
    else keys.push(part === 'comma' ? ',' : part === 'space' ? ' ' : part);
  }
  if (keys.length !== 1) return '';
  return [...['ctrl', 'alt', 'shift', 'meta'].filter((modifier) => modifiers.has(modifier)), keys[0]].join('+');
}

function acceleratorFromEvent(event) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return '';
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('Ctrl');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Meta');
  const codeLabels = { Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', Space: 'Space' };
  const keyLabels = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' };
  const key = /^Key[A-Z]$/u.test(event.code) ? event.code.slice(3)
    : /^Digit[0-9]$/u.test(event.code) ? event.code.slice(5)
      : codeLabels[event.code] || keyLabels[event.key]
        || (event.key.length === 1 && /[a-z]/iu.test(event.key) ? event.key.toUpperCase() : event.key);
  return [...modifiers, key].join('+');
}

function handleShortcutInputKeydown(event) {
  const input = event.currentTarget;
  const action = input.name;
  if (!appShortcutActions.includes(action)) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    input.value = state.appSettings?.shortcuts?.[action] || defaultAppShortcuts[action];
    delete input.dataset.dirty; delete input.dataset.error; input.removeAttribute('aria-invalid');
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    void saveShortcutBinding(action);
    return;
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey) return;
  const accelerator = acceleratorFromEvent(event);
  if (!accelerator) return;
  event.preventDefault();
  input.value = accelerator;
  input.dataset.dirty = 'true';
  delete input.dataset.error;
  input.removeAttribute('aria-invalid');
}

async function saveShortcutBinding(action) {
  if (!appShortcutActions.includes(action) || state.settingsBusy) return;
  const input = $(`#shortcutForm [name="${action}"]`);
  if (!input) return;
  state.settingsBusy = `shortcut:${action}`;
  state.shortcutFeedback = 'Проверяем и сохраняем сочетание…';
  state.shortcutFeedbackKind = '';
  delete input.dataset.error;
  input.removeAttribute('aria-invalid');
  renderShortcutSettings();
  try {
    await saveAppSettingsPatch({ shortcuts: { [action]: input.value.trim() } });
    delete input.dataset.dirty;
    state.shortcutFeedback = 'Сочетание сохранено.';
    state.shortcutFeedbackKind = 'success';
  } catch (error) {
    input.dataset.error = 'true';
    input.setAttribute('aria-invalid', 'true');
    state.shortcutFeedback = desktopActionMessage(error, 'Windows-приложение не приняло это сочетание.');
    state.shortcutFeedbackKind = 'error';
    requestAnimationFrame(() => input.focus());
  } finally {
    state.settingsBusy = '';
    renderShortcutSettings();
  }
}

async function resetShortcutBindings() {
  if (state.settingsBusy) return;
  state.settingsBusy = 'shortcuts:reset';
  state.shortcutFeedback = 'Возвращаем стандартные сочетания…';
  state.shortcutFeedbackKind = '';
  renderShortcutSettings();
  try {
    await saveAppSettingsPatch({ shortcuts: { ...defaultAppShortcuts } });
    $$('.shortcut-input').forEach((input) => { delete input.dataset.dirty; delete input.dataset.error; input.removeAttribute('aria-invalid'); });
    state.shortcutFeedback = 'Стандартные сочетания восстановлены.';
    state.shortcutFeedbackKind = 'success';
  } catch (error) {
    state.shortcutFeedback = desktopActionMessage(error, 'Не удалось восстановить стандартные сочетания.');
    state.shortcutFeedbackKind = 'error';
  } finally {
    state.settingsBusy = '';
    renderShortcutSettings();
  }
}


function renderSettingsProducts() {
  const products=state.products.filter(product=>product.status==='active' && product.product_type==='workspace');
  $('#settingsProductVersions').innerHTML=products.length?products.map(product=>{
    const releases=state.releaseAssignments.filter(item=>item.productId===product.id && item.verification==='verified');
    const release=releases.find(item=>/workspace|local.node/i.test(item.component||'')) || releases.find(item=>!/(service|account|desktop|connector)/i.test(item.component||''));
    const version=release?.version;
    return '<div class="settings-version-row"><strong>'+escapeHtml(product.name)+'</strong><span>'+ (version?'<kbd>'+escapeHtml(version)+'</kbd>':'Версия пока не получена')+'</span></div>';
  }).join(''):'<p class="settings-copy">Доступных продуктов пока нет.</p>';
}
function renderProfile() {
  const profile=state.profile;
  const name=profile?.name || state.me?.name || 'Пользователь';
  $('#accountDisplayName').textContent=name;
  $('#accountDisplayEmail').textContent=profile?.email || state.me?.email || '—';
  const verification=$('#profileEmailVerification');
  if(verification)verification.textContent=profile?.emailVerified===true?'Электронная почта подтверждена.':'Состояние подтверждения проверяется в личном кабинете.';
  $('#profileAvatar').textContent=name.trim().slice(0,1).toUpperCase();
  $('#profileRole').textContent=$('#userRole')?.textContent || 'Аккаунт Nexus';
  const twoFactor=profile?.twoFactor;
  $('#profileSecurityBadge').classList.toggle('secure',twoFactor?.enabled===true);
  $('#profileSecurityBadge span').textContent=!profile?'Состояние не получено':twoFactor?.enabled?'Вход защищён 2FA':'Только пароль';
  $('#twoFactorTitle').textContent=!profile?'Не удалось проверить защиту':!twoFactor?.available?'Подтверждение пока недоступно':twoFactor.enabled?'Подтверждение включено':'Подтверждение выключено';
  $('#twoFactorDescription').textContent=!profile?'Повторите загрузку профиля.':!twoFactor?.available?'Почтовый канал ещё не настроен. Обратитесь в поддержку Vertux.':twoFactor.deliveryHint || 'Nexus отправит одноразовый код на вашу почту.';
  $('#twoFactorButton').textContent=twoFactor?.enabled?'Отключить подтверждение':'Включить по почте';
  $('#twoFactorButton').disabled=!twoFactor?.available;
  const theme=profile?.theme || state.me?.theme || 'nexus';
  if (!embedded) document.documentElement.dataset.theme=['nexus','graphite','aurora'].includes(theme)?theme:'nexus';
  $$('#themePicker [data-theme-option]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.themeOption===document.documentElement.dataset.theme));button.disabled=!profile || themeBusy;});
  $('#profileProductList').innerHTML=state.products.length?state.products.map(product=>'<a class="profile-product-item" href="'+accountRoute()+'"><span class="profile-product-glyph" aria-hidden="true">'+escapeHtml(product.product_type==='workspace'?'WS':'VX')+'</span><span><strong>'+escapeHtml(product.name)+'</strong><small>Открыть в продуктах Nexus</small></span></a>').join(''):'<p class="settings-copy">Доступные продукты появятся здесь.</p>';
}

let supportGeneration=0;
async function showSupport() {
  const selector=$('#supportProductSelection');
  const available=state.products.filter(product=>product.status==='active');
  const selected=selector.value || (available.length===1?available[0].id:'');
  selector.innerHTML='<option value="">Выберите продукт</option>'+available.map(product=>'<option value="'+escapeHtml(product.id)+'">'+escapeHtml(product.name)+'</option>').join('');
  selector.value=selected;
  if (!available.length) { setSettingsFeedback('#supportFeedback','Доступных продуктов пока нет.'); return; }
  if ($('#personalSupportHost nexus-personal-support')?.dataset.productId===selected) return;
  await loadSupport(selected);
}
async function loadSupport(productId) {
  const generation=++supportGeneration;
  const host=$('#personalSupportHost');host.replaceChildren();
  const product=state.products.find(item=>item.id===productId);
  if(!product){setSettingsFeedback('#supportFeedback','Выберите продукт для просмотра и отправки обращений.');return;}
  setSettingsFeedback('#supportFeedback','Загружаем поддержку…');
  try {
    await Promise.race([customElements.whenDefined('vertux-service-center'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Не удалось загрузить поддержку. Перезагрузите страницу.')),8000))]);
    if(generation!==supportGeneration)return;
    if(!customElements.get('nexus-personal-support')){
      customElements.define('nexus-personal-support',class extends customElements.get('vertux-service-center'){
        get bridge(){return this.serviceAdapter;}
        // The existing module also binds the body section. Re-selecting it must preserve form input.
        openSection(section, emit=true){if(this.normalizedSection(section)===this.state.section)return;super.openSection(section,emit);}
      });
    }
    const service=document.createElement('nexus-personal-support');service.dataset.productId=product.id;service.setAttribute('section','support');
    service.setAttribute('hide-header','');
    const wrap=fn=>async(...args)=>{try{return {ok:true,data:await fn(...args)};}catch(error){return {ok:false,error:{code:error.code,message:accountError(error)}};}};
    service.serviceAdapter=Object.freeze({
      overview:wrap(async()=>{const data=await request('/api/service-center?productId='+encodeURIComponent(product.id));if(data?.currentProduct?.id!==product.id)throw new Error('Nexus вернул поддержку другого продукта.');return {...data,module:{...data.module,sections:['support']}};}),
      createTicket:wrap(value=>request('/api/support',{method:'POST',body:{organizationId:product.organization_id,productId:product.id,subject:value.subject,priority:value.priority,message:value.message,requestId:value.requestId}})),
      ticketMessages:wrap(ticketId=>request('/api/support/'+encodeURIComponent(ticketId)+'/messages')),
      replyTicket:wrap(value=>request('/api/support/'+encodeURIComponent(value.ticketId)+'/messages',{method:'POST',body:{message:value.message,requestId:value.requestId}})),
    });
    service.addEventListener('vertux-service-center-ready',()=>{if(generation===supportGeneration)setSettingsFeedback('#supportFeedback');});
    service.addEventListener('vertux-service-center-error',event=>{if(generation===supportGeneration)setSettingsFeedback('#supportFeedback',event.detail?.message || 'Не удалось загрузить поддержку.','error');});
    host.append(service);
  }catch(error){if(generation===supportGeneration)setSettingsFeedback('#supportFeedback',accountError(error),'error');}
}
$('#supportProductSelection')?.addEventListener('change',event=>void loadSupport(event.currentTarget.value));

function renderProductWindowPreference() {
  const setting = $('#windowModeSetting');
  const toggle = $('#separateWindowsToggle');
  const hint = $('#windowModeHint');
  const available = state.desktopClient?.capabilities?.productWindowPreferences === true
    && typeof desktopBridge?.setProductWindowMode === 'function';
  setting.hidden = !available;
  if (!available) return;
  const separate = state.desktopClient?.productWindowMode === 'separate';
  toggle.checked = separate;
  toggle.disabled = state.windowModeBusy || state.launching;
  hint.textContent = separate
    ? 'Nexus оставляет лаунчер и продукты открытыми.'
    : 'Nexus показывает один рабочий экран.';
}

async function updateProductWindowPreference(openInSeparateWindows) {
  if (state.windowModeBusy || state.launching
    || typeof desktopBridge?.setProductWindowMode !== 'function') return false;
  state.windowModeBusy = true;
  $('#separateWindowsToggle').disabled = true;
  $('#windowModeHint').textContent = 'Сохраняем настройку…';
  try {
    const result = await desktopBridge.setProductWindowMode(openInSeparateWindows === true);
    if (!result?.ok || !['single', 'separate'].includes(result.productWindowMode)) {
      throw new Error(result?.error?.message || 'Nexus не подтвердил настройку окон.');
    }
    state.desktopClient = { ...state.desktopClient, productWindowMode: result.productWindowMode };
    return true;
  } catch (error) {
    $('#windowModeHint').textContent = error.message || 'Настройка не сохранена. Повторите попытку.';
    return false;
  } finally {
    state.windowModeBusy = false;
    renderProductWindowPreference();
  }
}


let loading=null;
let themeBusy=false;
let challenge=null;
let challengeBusy=false;
function accountError(error) {
  if (['AUTH_REQUIRED','SESSION_EXPIRED','SESSION_INVALID'].includes(error?.code)) onAuthRequired();
  return error?.message || 'Не удалось выполнить действие. Повторите попытку.';
}
async function loadProfile() {
  const profile=await request('/api/profile');
  if (!profile || profile.id!==state.me.id) throw new Error('Nexus не подтвердил профиль текущего аккаунта.');
  state.profile=profile;
  state.me={...state.me,name:profile.name,theme:profile.theme,startup:profile.startup};
  if ((root.activeElement || document.activeElement)!==$('#profileName')) $('#profileName').value=profile.name;
  if ($('#userName')) $('#userName').textContent=profile.name;
  renderAccount();
  renderProfile();
  await securityControls.load(profile);
  const googleStatus=$('[data-google-status]');
  if(googleStatus){try{const google=await request('/api/auth/google/status');googleStatus.textContent=google.linked?'Google подключён к вашему аккаунту.':google.enabled?'Google ещё не подключён. Настройте вход в личном кабинете.':'Вход через Google пока не настроен.';}catch{googleStatus.textContent='Не удалось проверить Google. Откройте личный кабинет или повторите позже.';}}
}
async function load() {
  if (loading) return loading;
  loading=(async()=>{
    setSettingsFeedback('#accountLoadFeedback','Загружаем профиль…');
    $('#retryAccountButton').hidden=true;
    const results=await Promise.allSettled([loadProfile(),loadAppSettings(),request('/api/status').then(status=>{state.status=status;})]);
    if (results[0].status==='rejected') {
      setSettingsFeedback('#accountLoadFeedback',accountError(results[0].reason),'error');$('#retryAccountButton').hidden=false;renderProfile();
    } else setSettingsFeedback('#accountLoadFeedback');
    state.updateState=normalizeUpdateState(state.desktopClient?.updateState);
    renderApplicationSettings();
  })().finally(()=>{loading=null;});
  return loading;
}
function renderDesktopDevices() {
  const list = $('#desktopDeviceList');
  if (!list) return;
  const devices = Array.isArray(state.desktopDevices) ? state.desktopDevices : [];
  list.setAttribute('aria-busy', state.desktopDevicesLoading ? 'true' : 'false');
  if (!devices.length) {
    list.innerHTML = '<p class="settings-copy">' + (state.desktopDevicesLoading ? 'Загружаем устройства…' : state.desktopDevicesError ? 'Список устройств временно недоступен.' : 'Компьютер появится здесь после первого открытия Workspace.') + '</p>';
    return;
  }
  const date = value => { const d = new Date(value); return value && Number.isFinite(d.getTime()) ? d.toLocaleString('ru-RU',{dateStyle:'short',timeStyle:'short'}) : 'ещё не открывался'; };
  list.innerHTML = devices.map(device => {
    const active = device.status === 'active';
    const action = active ? 'revoke' : 'restore';
    const actionLabel = active ? 'Отозвать доступ' : 'Вернуть доступ';
    const confirming = state.desktopDeviceConfirmation === device.id;
    const disabled = state.desktopDeviceBusy ? ' disabled' : '';
    return '<div class="desktop-device-row" data-device-row="' + escapeHtml(device.id) + '"><div class="desktop-device-identity"><strong>' + escapeHtml(device.name || 'Windows-компьютер') + '</strong><small>' + escapeHtml(device.productName || 'Workspace') + ' · ' + (active ? 'Доступ разрешён' : 'Доступ отозван') + '</small><small>Последнее открытие: ' + escapeHtml(date(device.lastUsedAt || device.registeredAt)) + '</small></div>'
      + (confirming ? '<div class="desktop-device-confirm"><p>' + (active ? 'Прекратить доступ этого компьютера к продукту?' : 'Снова разрешить этому компьютеру открывать продукт?') + '</p><button class="button primary" type="button" data-device-confirm="' + escapeHtml(device.id) + '" data-device-access="' + action + '"' + disabled + '>Подтвердить</button><button class="button ghost" type="button" data-device-cancel="' + escapeHtml(device.id) + '"' + disabled + '>Отмена</button></div>'
        : '<div class="desktop-device-actions"><button class="button ghost" type="button" data-device-prompt="' + escapeHtml(device.id) + '"' + disabled + '>' + actionLabel + '</button></div>') + '</div>';
  }).join('');
}
async function loadDesktopDevices() {
  if (!$('#desktopDeviceList') || state.desktopDevicesLoading || state.desktopDeviceBusy) return;
  state.desktopDevicesLoading = true; state.desktopDevicesError = false; renderDesktopDevices();
  setSettingsFeedback('#desktopDevicesFeedback');
  try {
    const result = await request('/api/account/desktop-devices');
    if (!Array.isArray(result?.devices)) throw new Error('Nexus не подтвердил список устройств.');
    state.desktopDevices = result.devices;
  } catch (error) {
    state.desktopDevices = []; state.desktopDevicesError = true;
    setSettingsFeedback('#desktopDevicesFeedback', accountError(error), 'error');
  } finally { state.desktopDevicesLoading = false; renderDesktopDevices(); }
}
async function desktopDeviceAction(event) {
  if (state.desktopDeviceBusy) return;
  const prompt = event.target.closest('[data-device-prompt]');
  const cancel = event.target.closest('[data-device-cancel]');
  if (prompt || cancel) {
    const id = prompt?.dataset.devicePrompt || cancel.dataset.deviceCancel;
    state.desktopDeviceConfirmation = prompt ? id : null;
    renderDesktopDevices();
    const row = [...$('#desktopDeviceList').querySelectorAll('[data-device-row]')].find(item => item.dataset.deviceRow === id);
    row?.querySelector(prompt ? '[data-device-confirm]' : '[data-device-prompt]')?.focus();
    return;
  }
  const button = event.target.closest('[data-device-confirm]');
  if (!button || button.dataset.deviceConfirm !== state.desktopDeviceConfirmation) return;
  const id = button.dataset.deviceConfirm; const action = button.dataset.deviceAccess;
  if (!state.desktopDevices?.some(device => device.id === id) || !['revoke','restore'].includes(action)) return;
  state.desktopDeviceBusy = id; renderDesktopDevices();
  setSettingsFeedback('#desktopDevicesFeedback', 'Сохраняем доступ…');
  try {
    const result = await request('/api/account/desktop-devices/access', { method: 'POST', body: { deviceId: id, action } });
    if (result?.changed !== true || result.deviceId !== id) throw new Error('Nexus не подтвердил изменение доступа.');
    state.desktopDevices = state.desktopDevices.map(device => device.id === id ? { ...device, status: result.status } : device);
    state.desktopDeviceConfirmation = null;
    setSettingsFeedback('#desktopDevicesFeedback', action === 'revoke' ? 'Доступ компьютера отозван.' : 'Доступ возвращён. На этом компьютере снова откройте Workspace.');
  } catch (error) { setSettingsFeedback('#desktopDevicesFeedback', accountError(error), 'error'); }
  finally {
    state.desktopDeviceBusy = null; renderDesktopDevices();
    const row = [...$('#desktopDeviceList').querySelectorAll('[data-device-row]')].find(item => item.dataset.deviceRow === id);
    row?.querySelector('button')?.focus();
  }
}
$('#refreshDesktopDevices')?.addEventListener('click', () => void loadDesktopDevices());
$('#desktopDeviceList')?.addEventListener('click', event => void desktopDeviceAction(event));

function viewChanged(view) {
  if (view==='profile') renderProfile();
  if (view==='settings') { void loadDesktopDevices(); renderApplicationSettings(); if (state.appSettingsError) void loadAppSettings(); }
  if ($('#accountMenu')) $('#accountMenu').open=false;
  if ($('#launcherTitle')) $('#launcherTitle').textContent=view==='support'?'Поддержка ваших продуктов':'Куда вы хотите войти?';
  if (view==='support') void showSupport();
}
async function formAction(form,feedback,action) {
  if (form.dataset.busy==='true') return;
  if (!form.reportValidity()) return;
  const button=form.querySelector('button[type="submit"]');form.dataset.busy='true';button.disabled=true;
  setSettingsFeedback(feedback,'Выполняем…');
  try { await action(); }
  catch(error){setSettingsFeedback(feedback,accountError(error),'error');}
  finally{delete form.dataset.busy;button.disabled=false;}
}
function closeTwoFactor() {
  if(challengeBusy)return;
  $('#twoFactorModal').hidden=true;$('#launcherShell').inert=false;challenge=null;
  $('#twoFactorModal section').setAttribute('aria-labelledby','twoFactorModalTitle');
  $('#twoFactorStartForm').reset();$('#twoFactorVerifyForm').reset();
  $('#twoFactorStartStep').hidden=false;$('#twoFactorVerifyStep').hidden=true;
  setSettingsFeedback('#twoFactorFeedback');$('#twoFactorButton').focus();
}
$('#twoFactorButton').addEventListener('click',()=>{
  if(!state.profile?.twoFactor?.available)return;
  challenge={action:state.profile.twoFactor.enabled?'disable':'enable'};
  $('#twoFactorModalTitle').textContent=challenge.action==='enable'?'Включить подтверждение':'Отключить подтверждение';
  $('#twoFactorModalCopy').textContent='Введите текущий пароль. Затем Nexus отправит одноразовый код на вашу почту.';
  $('#twoFactorModal').hidden=false;$('#launcherShell').inert=true;
  $('#twoFactorStartForm [name="currentPassword"]').focus();
});
$('#twoFactorClose').addEventListener('click',closeTwoFactor);
$('#twoFactorModal').addEventListener('click',event=>{if(event.target===event.currentTarget)closeTwoFactor();});
$('#twoFactorStartForm').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;
  void formAction(form,'#twoFactorFeedback',async()=>{
    challengeBusy=true;$('#twoFactorClose').disabled=true;
    try {
      const result=await request('/api/profile/2fa/email/start',{method:'POST',body:{action:challenge?.action,currentPassword:form.elements.currentPassword.value}});
      if(!result?.challengeId)throw new Error('Не удалось получить запрос подтверждения. Повторите действие.');
      challenge={...challenge,challengeId:result.challengeId};form.reset();
      $('#twoFactorDeliveryHint').textContent=result.deliveryHint || 'Проверьте почту.';
      $('#twoFactorStartStep').hidden=true;$('#twoFactorVerifyStep').hidden=false;
      $('#twoFactorModal section').setAttribute('aria-labelledby','twoFactorVerifyTitle');
      setSettingsFeedback('#twoFactorFeedback','Код отправлен.');$('#twoFactorVerifyForm [name="code"]').focus();
    } finally {challengeBusy=false;$('#twoFactorClose').disabled=false;}
  });
});
$('#twoFactorVerifyForm').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;
  void formAction(form,'#twoFactorFeedback',async()=>{
    if(!challenge?.challengeId)throw new Error('Запрос подтверждения истёк. Начните заново.');
    challengeBusy=true;$('#twoFactorClose').disabled=true;
    try {
      const result=await request('/api/profile/2fa/email/verify',{method:'POST',body:{challengeId:challenge.challengeId,code:form.elements.code.value.trim()}});
      if(typeof result?.enabled!=='boolean')throw new Error('Nexus не подтвердил изменение защиты.');
      state.profile={...state.profile,twoFactor:{enabled:result.enabled,available:result.available!==false,deliveryHint:result.deliveryHint || state.profile?.twoFactor?.deliveryHint}};
      renderProfile();
    } finally {challengeBusy=false;$('#twoFactorClose').disabled=false;}
    closeTwoFactor();setSettingsFeedback('#profileFeedback','Защита входа обновлена. Остальные сессии завершены.','success');
  });
});
const passwordDialog = $('#passwordDialog');
$('#openPasswordDialog')?.addEventListener('click', () => {
  setSettingsFeedback('#passwordFeedback');
  passwordDialog.showModal();
  $('#passwordForm').elements.currentPassword.focus();
});
$('#closePasswordDialog')?.addEventListener('click', () => passwordDialog.close());
passwordDialog?.addEventListener('close', () => {
  $('#passwordForm').reset();
  $('#openPasswordDialog')?.focus();
});
$('#passwordForm').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;
  void formAction(form,'#passwordFeedback',async()=>{
    if(form.elements.newPassword.value!==form.elements.newPasswordConfirm.value)throw new Error('Новые пароли не совпадают.');
    await request('/api/profile/password',{method:'POST',body:{currentPassword:form.elements.currentPassword.value,newPassword:form.elements.newPassword.value}});
    form.reset();setSettingsFeedback('#passwordFeedback','Пароль обновлён. Остальные сессии завершены.','success');
  });
});
$('#themePicker')?.addEventListener('click',async event=>{
  const option=event.target.closest('[data-theme-option]');if(!option||themeBusy||!state.profile)return;
  themeBusy=true;renderProfile();setSettingsFeedback('#themeFeedback','Сохраняем тему…');
  try {
    const result=await request('/api/profile',{method:'PATCH',body:{theme:option.dataset.themeOption}});
    state.me={...state.me,...result};state.profile={...state.profile,theme:result.theme};
    setSettingsFeedback('#themeFeedback','Тема сохранена в вашем аккаунте.','success');
  } catch(error){setSettingsFeedback('#themeFeedback',accountError(error),'error');}
  finally{themeBusy=false;renderProfile();}
});
$('#joinWorkspaceForm').addEventListener('submit',event=>{
  event.preventDefault();const form=event.currentTarget;
  void formAction(form,'#joinWorkspaceFeedback',async()=>{
    const me=await request('/api/invitations/accept',{method:'POST',body:{code:form.elements.code.value.trim(),email:state.me.email}});
    state.me=me;await refreshProducts();renderAccount();await loadProfile();renderSettingsProducts();form.reset();
    setSettingsFeedback('#joinWorkspaceFeedback','Компания и доступные продукты добавлены в ваш аккаунт.','success');
  });
});
async function saveAccount(form, feedback, patch) {
  await formAction(form, feedback, async () => {
    const me = await request('/api/profile', { method: 'PATCH', body: patch });
    state.me = { ...state.me, ...me };
    if (state.profile) state.profile = { ...state.profile, ...me, twoFactor: state.profile.twoFactor };
    renderAccount(); renderProfile();
    setSettingsFeedback(feedback, form.id === 'startupForm'
      ? 'Сохранено. Настройка сработает при следующем запуске Nexus.' : 'Профиль сохранён.', 'success');
  });
}
$('#profileForm').addEventListener('submit', event => {
  event.preventDefault();
  void saveAccount(event.currentTarget, '#profileFeedback', { name: $('#profileName').value.trim() });
});
$('#startupForm').addEventListener('submit', event => {
  event.preventDefault();
  const productId = $('#startupSelection').value || null;
  void saveAccount(event.currentTarget, '#startupFeedback', { startup: { mode: productId ? 'workspace' : 'chooser', productId } });
});
$('#separateWindowsToggle').addEventListener('change', event => void updateProductWindowPreference(event.currentTarget.checked));
$('#retryAccountButton').addEventListener('click',()=>void load());
$('#launchAtLoginToggle').addEventListener('change',event=>void saveBooleanAppSetting('launchAtLogin',event.currentTarget.checked));
$('#autoDownloadToggle').addEventListener('change',event=>void saveBooleanAppSetting('autoDownload',event.currentTarget.checked));
for(const [id,action] of [['checkForUpdatesButton','check'],['downloadUpdateButton','download'],['installUpdateButton','install']])$('#'+id).addEventListener('click',()=>void runUpdateAction(action));
$('#manualUpdateButton').addEventListener('click',()=>openExternal('https://vertux.online/nexus/download.html'));
$('#shortcutForm').addEventListener('submit',event=>event.preventDefault());
$$('[data-save-shortcut]').forEach(button=>button.addEventListener('click',()=>void saveShortcutBinding(button.dataset.saveShortcut)));
$$('.shortcut-input').forEach(input=>{input.addEventListener('keydown',handleShortcutInputKeydown);input.addEventListener('input',()=>{input.dataset.dirty='true';delete input.dataset.error;input.removeAttribute('aria-invalid');});});
$('#resetShortcutsButton').addEventListener('click',()=>void resetShortcutBindings());
root.addEventListener('keydown',event=>{
  if(!$('#twoFactorModal').hidden){
    if(event.key==='Escape'){event.preventDefault();closeTwoFactor();return;}
    if(event.key==='Tab'){
      const focusable=$$('button:not(:disabled), input:not(:disabled)', $('#twoFactorModal')).filter(element=>!element.closest('[hidden]'));
      const index=focusable.indexOf((root.activeElement || document.activeElement));const next=event.shiftKey?(index<=0?focusable.length-1:index-1):(index+1)%focusable.length;
      if(focusable.length){event.preventDefault();focusable[next].focus();}
    }
    return;
  }
  if(embedded||event.defaultPrevented||event.repeat||event.isComposing||!state.appSettings||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  const pressed=normalizedAccelerator(acceleratorFromEvent(event));
  const action=appShortcutActions.find(name=>normalizedAccelerator(state.appSettings.shortcuts[name])===pressed);if(!action)return;
  event.preventDefault();location.hash=action==='settings'?'settings':action==='support'?'support':'';
  if(!location.hash)viewChanged('products');
});
const unsubscribeUpdate = desktopBridge?.onUpdateState?.(value=>{
  const update=normalizeUpdateState(value);
  state.updateState=update || {...effectiveUpdateState(),status:'unsupported',reason:'invalid_state',canAutoUpdate:false};
  if(update?.status==='error'){state.updateFeedback=updaterErrorMessage(update.reason);state.updateFeedbackKind='error';}
  else{state.updateFeedback='';state.updateFeedbackKind='';}
  renderUpdateSettings();
});
renderProfile();renderApplicationSettings();renderProductWindowPreference();
return Object.freeze({load,renderProfile,viewChanged,renderWindowPreference:renderProductWindowPreference,dispose:()=>{unsubscribeUpdate?.();securityControls.dispose();}});

}
