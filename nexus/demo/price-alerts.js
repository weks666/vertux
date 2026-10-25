import { telegramIcon } from './brand-icons.js';
import { canonicalRule } from './price-alert-rule-model.js';
import { createPriceAlertsController, isNotificationAlert } from './price-alerts-controller.js';
import {createTelegramConnection} from './telegram-connection.js';
const createPriceAlertNativeTransport=()=>{throw new Error('Static preview has no native alert transport');};
import { createPriceRulesTransferUi } from './price-rules-transfer-ui.js';
import { createPriceAlertArchiveUi } from './price-alert-archive-ui.js';

const intents = { buy: 'План: покупка', sell: 'План: продажа', watch: 'Наблюдение' };
const conditions = { crossing: 'Пересечение в TradingView', above: 'Цена ≥ уровня', below: 'Цена ≤ уровня' };
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ru-RU') : 'неизвестно';
const price = value => String(value).replace('.', ',');
const rowId = rule => rule.id ?? rule.rule?.id;
const configOf = rule => rule.config ?? (rule.rule && { schemaVersion: 1, source: 'tradingview', subject: { symbol: rule.rule.symbol, exchange: rule.rule.exchange },
  targetPrice: rule.rule.targetPrice, condition: rule.rule.condition, intent: rule.rule.intent, note: rule.rule.note, deliverTelegram: rule.rule.deliverTelegram,
  cooldownSeconds: 60, expiresAt: null, evaluationClock: 'source-event-arrival' });
const clockText = value => value ? new Date(Date.parse(value) + 3 * 3600000).toISOString().slice(0, 16) : '';
const icon = name => name === 'telegram' ? telegramIcon : '<svg class="alert-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + ({
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v5l3 2"/>', device: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M7 21h10"/>' })[name] + '</svg>';
const message = code => ({ ALERT_REVISION_CONFLICT: 'Правило уже изменилось. Обновите список и проверьте новую версию; ваш черновик сохранён.',
  ALERT_SETUP_FAILED: 'Подключение не завершено. Повторите настройку в окне Windows. Ключ подключения выдаёт поддержка Vertux.',
  ALERT_SETUP_CANCELLED: 'Подключение отменено. Можно вернуться к настройке позже.',
  ALERT_SETUP_UNAVAILABLE: 'Дождитесь окончания текущей проверки и повторите подключение.',
  ALERT_TRANSPORT_UNAVAILABLE: 'Сервис уведомлений не ответил. Проверьте соединение и повторите.',
  ALERT_NATIVE_UNAVAILABLE: 'Не удалось открыть настройки доставки. Повторите подключение в установленном приложении.',
  ALERT_PERMISSION_DENIED: 'Доступ к уведомлениям изменился. Откройте Invest из Nexus заново.',
  ALERT_ACCESS_STALE: 'Доступ изменился во время настройки. Обновите список и повторите подключение.',
  ALERT_READ_REQUIRED: 'Сначала обновите список, чтобы подтвердить текущую версию.', ALERT_PRICE_INVALID: 'Введите положительную цену: до 9 знаков после запятой.',
  ALERT_TIME_INVALID: 'Проверьте срок действия. Время указано в UTC+03:00.', ALERT_RULE_INVALID: 'Проверьте условие, заметку и интервал между сигналами.',
  ALERT_BODY_LIMIT: 'Настройки слишком длинные. Сократите заметку.', ALERT_VERSION_LIMIT: 'Достигнут предел версий правила.',
  ALERT_RECOVERY_UNAVAILABLE: 'Подтверждённая предыдущая версия недоступна для восстановления.' })[code] || 'Не удалось подтвердить действие. Обновите список перед повторной попыткой.';
// The relay may be absent on the server (delivery not started yet) or briefly
// unreachable. Say so plainly instead of an endless checking state.
const serviceDown = code => ['ALERT_NOTIFICATION_UNAVAILABLE','ALERT_NATIVE_UNAVAILABLE','ALERT_RELAY_TIMEOUT'].includes(code)
  ? 'Сервис уведомлений на сервере сейчас не отвечает. Список проверится снова автоматически; можно нажать «Обновить».'
  : 'Нет связи с сервисом уведомлений. Список проверится снова автоматически; можно нажать «Обновить».';
function deliveryText(event) {
  if (event.telegramErrorCode === 'TELEGRAM_DISABLED_BY_USER') return 'Только в приложении';
  return ({ sent: 'Telegram: отправлено', pending: 'Telegram: в очереди', failed: 'Telegram: ошибка отправки',
    unknown: 'Telegram: результат неизвестен, повторной отправки нет', not_configured: 'Внешняя отправка не выполняется' })[event.telegramStatus] || 'Доставка не подтверждена';
}

export function initPriceAlerts({ showToast, activateView, readOnly = false, getBootstrap = () => null,
  getCsrf = () => null, getBootstrapRevision = () => 0, refreshAccess = async () => {} }) {
  const existing = document.querySelector('[data-view="alerts"]');
  const nav = existing || document.createElement('button');
  nav.disabled = false; nav.type = 'button'; nav.className = 'nav-item'; nav.dataset.view = 'alerts';
  nav.innerHTML = icon('bell') + '<span>Ценовые уведомления</span><span id="priceAlertCount" hidden></span>';
  if (!existing) { document.querySelector('[data-view="terminal"]').after(nav); nav.addEventListener('click', () => activateView('alerts', nav)); }
  const panel = document.createElement('section'); panel.className = 'view alert-versioned'; panel.dataset.viewPanel = 'alerts';
  panel.innerHTML = `
    <header class="section-intro"><div><h2>Ценовые уведомления</h2><p>Ваши уровни, версии правил и подтверждённые события TradingView.</p></div></header>
    <div class="alert-summary" aria-label="Сводка уведомлений">
      <div>${icon('bell')}<span>Правил</span><strong id="alertActiveTotal">—</strong><small id="alertEnabledTotal">приём не проверен</small></div>
      <div>${icon('history')}<span>Событий</span><strong id="alertUnreadTotal">—</strong><small>в показанной истории</small></div>
      <div>${icon('telegram')}<span>Telegram</span><strong id="alertTelegramState">Не проверен</strong></div>
      <div>${icon('device')}<span>Приём событий</span><strong id="alertDeviceState">Не проверен</strong></div>
    </div>
    <div class="alert-status-line"><p id="priceAlertStatus" class="empty-copy" role="status">Проверяем доступ…</p><button type="button" id="priceAlertRefresh" class="button">Обновить</button></div>
    <button type="button" id="priceAlertSetup" class="button" hidden>Подключить доставку</button>
    <section class="telegram-connection" id="telegramConnection" hidden aria-label="Подключение Telegram"></section>
    <div class="alert-workspace"><form id="priceAlertForm" class="data-surface price-alert-form">
      <h3 id="priceAlertFormTitle">Создать правило</h3>
      <label>Тикер в TradingView<input name="symbol" placeholder="SBER" maxlength="64" required autocomplete="off"></label>
      <label>Биржа в TradingView<input name="exchange" list="alertExchangeOptions" placeholder="MOEX" maxlength="32" required autocomplete="off"></label>
      <datalist id="alertExchangeOptions"><option value="MOEX"></option><option value="NASDAQ"></option><option value="NYSE"></option></datalist>
      <fieldset class="alert-condition-picker"><legend>Условие</legend><div role="group" aria-label="Условие цены"><button type="button" data-alert-condition="above" aria-pressed="true">≥ Выше или равно</button><button type="button" data-alert-condition="below" aria-pressed="false">≤ Ниже или равно</button><button type="button" data-alert-condition="crossing" aria-pressed="false">Пересечение</button></div></fieldset>
      <input type="hidden" name="condition" value="above">
      <label>Целевая цена<input name="targetPrice" placeholder="250,50" inputmode="decimal" required autocomplete="off"></label>
      <details class="alert-plan-options"><summary>План действий</summary><label>Мой план<select name="intent"><option value="watch">Наблюдение</option><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label><p class="empty-copy">Это ваша заметка. Заявка брокеру не отправляется.</p></details>
      <label>Заметка<textarea name="note" rows="2" maxlength="1000" placeholder="Что проверить при срабатывании"></textarea></label>
      <details class="alert-time-options"><summary>Повторы и срок</summary><label>Пауза между сигналами, секунд<input name="cooldownSeconds" type="number" min="0" max="86400" step="1" value="60" required></label><small>От 0 до 86 400. Подавленный сигнал не продлевает паузу.</small><label>Принимать до · UTC+03:00<input name="expiresAt" type="datetime-local" step="60"></label><small>Пустое поле — без ограничения срока.</small></details>
      <label class="check-label alert-telegram-choice"><input type="checkbox" name="deliverTelegram"><span>Присылать в Telegram</span></label>
      <small id="alertTelegramHint">Доступность доставки ещё не проверена.</small>
      <button type="submit" class="button primary" disabled>Сохранить на паузе</button><button type="button" id="priceAlertCancelEdit" class="button" hidden>Отменить редактирование</button>
      <p class="empty-copy" id="priceAlertDraftStatus"></p>
      <details class="price-alert-help"><summary>Как работают уведомления</summary><p>Сохраните правило, настройте соответствующий сигнал TradingView и явно включите приём. Пересечение подтверждает источник; приложение не вычисляет его по локальному графику.</p><p>Каждое изменение создаёт новую версию на паузе. Для неё нужно обновить сообщение TradingView.</p></details>
      <div class="alert-chart-preview"><p>Котировка и график брокера не связаны с выбранной парой «биржа:тикер» TradingView. Текущая цена здесь не подтверждена.</p></div>
    </form><article class="data-surface alert-rules-surface"><header class="surface-head"><h3 id="alertRulesTitle" tabindex="-1">Мои правила</h3></header><div id="priceAlertRules"><p class="empty-copy">Список ещё не проверен.</p></div></article></div>
    <article class="data-surface"><header class="surface-head"><h3>История сигналов</h3><p class="empty-copy">Последние 100 подтверждённых событий, включая старые правила. Это не полная история версий.</p></header><div id="priceAlertEvents"><p class="empty-copy">История ещё не проверена.</p></div></article>`;
  document.querySelector('[data-view-panel="terminal"]').after(panel);
  const popup = document.createElement('dialog'); popup.id = 'priceAlertDialog'; popup.setAttribute('aria-labelledby', 'priceAlertPopupTitle');
  popup.innerHTML = '<div class="dialog-card"><h2 id="priceAlertPopupTitle"></h2><p id="priceAlertPopupBody"></p><p id="priceAlertPopupTime" class="empty-copy"></p><p>Сделка не совершалась.</p><button type="button" class="button primary" id="priceAlertAcknowledge">Прочитано</button><button type="button" class="button" id="priceAlertLater">Закрыть</button></div>';
  document.body.append(popup);
  const $ = selector => panel.querySelector(selector); const form = $('#priceAlertForm');
  for (const button of panel.querySelectorAll('[data-alert-condition]')) button.classList.add('button');
  let disposed = false; let suspended = false; let controller; let view; let lastEpoch = -1; let draftRevision = 0; let editing = null; let draftDirty = false; let transfer; let archive; let telegram;
  let currentPopup = null; let popupSequence = 0; let knownEvents = null; let eventRevision = null; let timer;
  const queued = []; const rowNodes = new Map(); const abortListeners = new AbortController();
  const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: abortListeners.signal });
  const native = readOnly ? null : createPriceAlertNativeTransport({ getCsrf });
  const canWrite = () => view?.status === 'ready' && view.fresh && !view.pending && controller.notificationAuthority().isCurrent();
  function syncForm() {
    for (const button of panel.querySelectorAll('[data-alert-condition]')) button.setAttribute('aria-pressed', String(button.dataset.alertCondition === form.elements.condition.value));
    $('#priceAlertFormTitle').textContent = editing ? editing.kind === 'enroll' ? 'Перенести старое правило' : `Изменить версию ${editing.ruleVersion}` : 'Создать правило';
    $('#priceAlertCancelEdit').hidden = !editing && !draftDirty;
    form.querySelector('[type="submit"]').textContent = editing ? 'Сохранить новую версию на паузе' : 'Сохранить на паузе';
    $('#priceAlertDraftStatus').textContent = editing ? 'Черновик. При сохранении приём будет приостановлен.' : '';
  }
  function clearDraft() { form.reset(); editing = null; draftDirty = false; draftRevision++; syncForm(); transfer?.update(); }
  function focusControl(control) {
    control.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    control.focus({ preventScroll: true });
  }
  function closePopup(clear = false) {
    currentPopup = null; popupSequence++; if (popup.open) popup.close();
    if (clear) for (const id of ['priceAlertPopupTitle', 'priceAlertPopupBody', 'priceAlertPopupTime']) popup.querySelector('#' + id).textContent = '';
  }
  function openEvent(event) {
    const authority = controller.notificationAuthority();
    if (!authority.isCurrent() || !isNotificationAlert(event) || popup.open || document.querySelector('dialog[open]')) return false;
    currentPopup = { id: event.id, authority, sequence: ++popupSequence };
    popup.querySelector('h2').textContent = `${intents[event.intent] || 'Сигнал'} · ${event.exchange}:${event.symbol}`;
    popup.querySelector('#priceAlertPopupBody').textContent = `Уровень ${price(event.targetPrice)} · сигнал ${price(event.actualPrice)}. ${deliveryText(event)}.`;
    popup.querySelector('#priceAlertPopupTime').textContent = `Источник: ${stamp(event.sourceTime)} · получено: ${stamp(event.receivedAt)} · ${event.ruleVersion ? 'версия ' + event.ruleVersion : 'старое правило'}`;
    popup.querySelector('#priceAlertAcknowledge').disabled = !canWrite() || Boolean(event.readAt);
    popup.showModal(); popup.querySelector('#priceAlertLater').focus(); return true;
  }
  function openNext() {
    if (document.hidden || !canWrite() || popup.open || document.querySelector('dialog[open]')) return;
    while (queued.length) {
      const id = queued.shift(); const event = view.snapshot?.events.find(item => item.id === id && !item.readAt);
      if (event && openEvent(event)) break;
    }
  }
  function rulesMarkup(rule) {
    const config = configOf(rule); const id = rowId(rule); const managed = ['active', 'paused'].includes(rule.state);
    if (!config) return `<div class="alert-rule-identity"><div><strong>Правило недоступно</strong><small>${rule.state === 'unsupported' ? 'Формат версии не поддерживается' : 'Целостность версии не подтверждена'}</small></div></div><div class="price-alert-actions">${rule.recoveryAvailable && rule.headRevision ? `<button type="button" class="button" data-alert-write data-alert-action="recover" data-alert-id="${id}">Восстановить на паузе</button>` : '<span class="empty-copy">Подтверждённой версии для восстановления нет.</span>'}</div>`;
    const action = (name, label, write = true) => `<button type="button" class="button" ${write ? 'data-alert-write' : ''} data-alert-action="${name}" data-alert-id="${id}">${label}</button>`;
    return `<div class="alert-rule-identity"><span class="alert-source-mark" aria-hidden="true">${escape(config.subject.symbol.slice(0, 2))}</span><div><strong>${escape(config.subject.symbol)}</strong><small>${escape(config.subject.exchange)} · TradingView</small>${config.note ? `<small class="alert-rule-note">${escape(config.note)}</small>` : ''}</div></div>
      <span class="alert-rule-condition">${escape(conditions[config.condition])}</span><div class="alert-rule-price"><strong>${escape(price(config.targetPrice))}</strong><small>в единицах источника</small></div>
      <span>${managed ? 'v' + rule.ruleVersion : 'Старое правило'}</span><span class="alert-rule-state ${rule.state === 'active' ? 'positive' : ''}">${managed ? rule.enabled ? 'Приём включён' : 'На паузе' : configOf(rule) && rule.rule.enabled ? 'Старый приём включён' : 'Отключено'}</span>
      <span class="alert-delivery">${config.deliverTelegram ? 'Telegram выбран' : 'В приложении'}</span>
      <details class="price-alert-actions"><summary aria-label="Действия с ${escape(config.subject.exchange + ':' + config.subject.symbol)}">Действия</summary><div>${managed ? action('toggle', rule.enabled ? 'Приостановить' : 'Включить приём') + action('edit', 'Изменить') + action('setup', 'Настройка TradingView', false) : action('enroll', 'Перенести в версии')}</div></details>
      ${managed ? `<small class="alert-rule-limits">Пауза ${config.cooldownSeconds} с · ${config.expiresAt ? 'до ' + escape(stamp(config.expiresAt)) : 'без срока'}</small><div class="price-alert-setup" hidden></div>` : ''}`;
  }
  function renderRules(rows) {
    const host = $('#priceAlertRules');
    if (!rows.length) { rowNodes.clear(); host.innerHTML = '<p class="empty-copy">Подтверждённых правил пока нет. Сохраните первое на паузе.</p>'; return; }
    let list = host.querySelector('.alert-rules-list');
    if (!list) { host.innerHTML = '<div class="alert-rule-head" aria-hidden="true"><span>Источник</span><span>Условие</span><span>Уровень</span><span>Версия</span><span>Приём</span><span>Доставка</span><span></span></div><div class="alert-rules-list"></div>'; list = host.lastElementChild; }
    const ids = new Set(rows.map(rowId));
    for (const [id, node] of rowNodes) if (!ids.has(id)) { if (node.contains(document.activeElement)) $('#alertRulesTitle').focus(); node.remove(); rowNodes.delete(id); }
    rows.forEach((rule, index) => {
      const id = rowId(rule); let node = rowNodes.get(id);
      if (!node) { node = document.createElement('div'); node.className = 'price-alert-row alert-rule-row'; node.dataset.alertRule = id; rowNodes.set(id, node); }
      const html = rulesMarkup(rule);
      if (node._markup !== html) {
        const active = node.contains(document.activeElement) ? document.activeElement : null;
        const focused = active?.dataset.alertAction;
        const focusedMenu = active?.matches('.price-alert-actions>summary');
        node.innerHTML = html; node._markup = html;
        if (focused || focusedMenu) node.querySelector('.price-alert-actions>summary')?.focus({ preventScroll: true });
      }
      if (list.children[index] !== node) list.insertBefore(node, list.children[index] || null);
    });
  }
  function render(next) {
    view = next; if (!controller) return;
    telegram?.update();
    if (lastEpoch !== next.epoch) {
      lastEpoch = next.epoch; closePopup(true); queued.length = 0; knownEvents = null; eventRevision = null; rowNodes.clear();
      $('#priceAlertRules').replaceChildren(); $('#priceAlertEvents').replaceChildren(); clearDraft();
    }
    const snapshot = next.snapshot; const rows = snapshot?.rules; const events = (snapshot?.events || []).filter(isNotificationAlert);
    $('#alertActiveTotal').textContent = rows ? String(rows.length) : '—';
    $('#alertEnabledTotal').textContent = rows ? 'приём включён: ' + rows.filter(row => row.state === 'active' || row.state === 'legacy' && row.rule.enabled).length : 'приём не проверен';
    $('#alertUnreadTotal').textContent = snapshot ? String(events.length) : '—';
    $('#alertTelegramState').textContent = snapshot ? snapshot.telegramConfigured ? 'Подключён' : 'Не подключён' : 'Не проверен';
    $('#alertDeviceState').textContent = next.status === 'ready' && next.fresh ? 'Доступен' : next.status === 'legacy-read-only' ? 'Только просмотр' : 'Не проверен';
    const status = next.pending==='setup' ? 'Завершите подключение в окне Windows…' : next.status==='loading' ? 'Проверяем уведомления…' : next.status==='unavailable' && !readOnly && next.errorCode ? serviceDown(next.errorCode) : ({ ready: 'Сохранение создаёт версию на паузе. Включение приёма и настройка TradingView — отдельные действия.',
      stale: 'Список не обновлён. Показаны последние подтверждённые записи; изменения недоступны до проверки.',
      'legacy-read-only': 'Сервис пока не поддерживает версии. Старые правила доступны только для просмотра.',
      unconfigured: 'Сервис доставки ещё не подключён к этому владельцу Workspace.', forbidden: 'Доступ изменился. Прежние правила и история скрыты.',
      unloaded: 'Уведомления ещё не проверены.', loading: 'Проверяем уведомления…', unavailable: readOnly ? 'Настройки уведомлений доступны в основной версии приложения.' : 'Уведомления сейчас недоступны. Обновите доступ и список.' })[next.status];
    $('#priceAlertStatus').textContent = status + (next.confirmedAt && !next.fresh ? ' Проверено: ' + stamp(next.confirmedAt) + '.' : '');
    $('#priceAlertSetup').hidden = getBootstrap()?.capabilities?.telegramSelfService===true || next.status !== 'unconfigured' || !next.allowed; $('#priceAlertSetup').disabled = Boolean(next.pending);
    $('#priceAlertRefresh').disabled = readOnly || Boolean(next.pending);
    if (rows) renderRules(rows);
    else {const message=next.status==='loading'?'Загружаем уведомления…':next.status==='unavailable'&&next.errorCode&&!readOnly?'Правила появятся здесь, когда сервис уведомлений ответит. Повторная проверка — автоматически.':next.status==='unconfigured'?'Подключите доставку, чтобы создавать ценовые уведомления.':next.status==='unloaded'?'Нажмите «Обновить», чтобы загрузить уведомления.':next.status==='forbidden'?'Нет доступа к уведомлениям этого профиля.':'Не удалось загрузить уведомления. Нажмите «Обновить», чтобы повторить.';$('#priceAlertRules').innerHTML='<p class="empty-copy" role="status">'+escape(message)+'</p>';}
    const revision = JSON.stringify({ confirmed: Boolean(snapshot), events });
    if (eventRevision !== revision) {
      eventRevision = revision;
      $('#priceAlertEvents').innerHTML = events.length ? events.map(event => `<div class="price-alert-row"><div><strong>${escape(event.exchange + ':' + event.symbol)} · ${escape(intents[event.intent])}</strong><p>Уровень ${escape(price(event.targetPrice))} · сигнал ${escape(price(event.actualPrice))}</p><small>Источник: ${escape(stamp(event.sourceTime))} · получено: ${escape(stamp(event.receivedAt))}</small><small>${escape(deliveryText(event))} · попыток: ${event.attempts}${event.nextAttemptAt ? ' · следующая: ' + escape(stamp(event.nextAttemptAt)) : ''}</small><small>${event.ruleVersion ? 'Версия ' + event.ruleVersion : 'Старое правило'} · ${event.readAt ? 'прочитано: ' + escape(stamp(event.readAt)) : 'не прочитано'}</small></div><button type="button" class="button" data-alert-event="${event.id}">Посмотреть сигнал</button></div>`).join('') : `<p class="empty-copy">${snapshot ? 'Подтверждённых срабатываний в показанной истории нет.' : next.pending?'Загружаем историю срабатываний…':'История срабатываний пока не загружена.'}</p>`;
    }
    const mutable = canWrite();
    for (const button of panel.querySelectorAll('[data-alert-write]')) button.disabled = !mutable;
    for (const input of form.querySelectorAll('input,select,textarea,[data-alert-condition]')) input.disabled = !next.allowed || next.status === 'legacy-read-only' || readOnly;
    form.querySelector('[type="submit"]').disabled = !mutable;
    form.elements.deliverTelegram.disabled ||= !snapshot?.telegramConfigured && !form.elements.deliverTelegram.checked;
    $('#alertTelegramHint').textContent = snapshot?.telegramConfigured ? 'Выбор доставки сохраняется в новой версии правила.' : 'Telegram не подтверждён; выбор доставки пока недоступен.';
    const unread = events.filter(event => !event.readAt); const badge = nav.querySelector('#priceAlertCount'); badge.hidden = !unread.length; badge.textContent = String(unread.length);
    if (currentPopup) popup.querySelector('#priceAlertAcknowledge').disabled = !mutable || Boolean(events.find(event => event.id === currentPopup.id)?.readAt);
    const authority = controller.notificationAuthority();
    document.dispatchEvent(new CustomEvent('invest:alerts-updated', { detail: { authority, events, fresh: next.fresh } }));
    if (next.fresh) {
      if (knownEvents) for (const event of [...unread].reverse()) if (!knownEvents.has(event.id) && knownEvents.size < 8192 && !queued.includes(event.id) && currentPopup?.id !== event.id) queued.push(event.id);
      knownEvents ||= new Set(); for (const event of events) if (knownEvents.size < 8192) knownEvents.add(event.id);
      openNext();
    }
    transfer?.update(); archive?.update();
  }
  controller = createPriceAlertsController({ request: native?.request || (async () => ({ status: 503 })), onChange: render });
  telegram=createTelegramConnection({host:$('#telegramConnection'),request:native?.request||(async()=>({status:503})),
    getAccess:()=>({enabled:!readOnly&&controller.getState().allowed&&getBootstrap()?.capabilities?.telegramSelfService===true,
      authority:controller.notificationAuthority()}),onConnected:()=>{void controller.refresh();},onAccessRejected:()=>controller.rejectAccess()});
  const transferHost = document.createElement('div');
  panel.querySelector('.alert-workspace').after(transferHost);
  transfer = createPriceRulesTransferUi({ host: transferHost,
    getContext: () => { const state = controller.getState(); return {
      key: String(state.epoch), editor: draftRevision, dirty: draftDirty || Boolean(editing), pending: state.pending,
      canNative: !readOnly && state.allowed && state.transferAvailable,
      canOpen: readOnly || state.status !== 'forbidden', rules: JSON.stringify(state.snapshot?.rules ?? null),
    }; },
    read: async () => {
      if (!controller.getState().fresh) { const result = await controller.refresh(); if (!result.ok) return result; }
      return controller.transferSnapshot();
    }, compare: (...args) => controller.transferPreview(...args), apply: (...args) => controller.transferApply(...args),
  });
  const archiveHost = document.createElement('div'); transferHost.after(archiveHost);
  archive = createPriceAlertArchiveUi({ host: archiveHost,
    getContext: () => { const state = controller.getState(); return { key: String(state.epoch), pending: state.pending,
      canNative: !readOnly && state.allowed && state.archiveAvailable && state.fresh && state.status === 'ready',
      canOpen: readOnly || state.status !== 'forbidden' }; },
    download: options => controller.archiveDownload(options),
  });
  function updateBootstrap() {
    if (disposed || suspended) return;
    const bootstrap = getBootstrap(); const descriptor = bootstrap?.priceAlerts;
    const changed = controller.updateAccess({ ownerScope: descriptor?.ownerScope, accessRevision: descriptor?.accessRevision,
      allowed: !readOnly && bootstrap?.preview?.static !== true && bootstrap?.capabilities?.priceAlerts === true && bootstrap?.identity?.role === 'owner',
      bootstrapRevision: getBootstrapRevision() });
    if (changed && controller.getState().allowed) void controller.refresh();
    else render(controller.getState());
    telegram.update();
  }
  function accept(result, success) {
    if (result.stale || result.cancelled || disposed || suspended) return;
    if (result.ok && result.authority?.isCurrent()) showToast(success + (result.fresh === false ? ' Список пока не обновлён.' : ''));
    else if (!result.ok && controller.notificationAuthority().isCurrent()) showToast(message(result.code), true);
  }
  async function refresh() {
    if (disposed || suspended || readOnly) return;
    if (!controller.getState().allowed) { try { await refreshAccess(); updateBootstrap(); } catch { return; } }
    await controller.refresh();
  }
  listen(form, 'input', () => { draftDirty = true; draftRevision++; syncForm(); transfer.update(); });
  listen(panel, 'click', event => {
    const button = event.target.closest('[data-alert-condition]'); if (!button || button.disabled) return;
    form.elements.condition.value = button.dataset.alertCondition; draftDirty = true; draftRevision++; syncForm(); transfer.update();
  });
  listen(form, 'submit', async event => {
    event.preventDefault(); if (!canWrite()) return;
    const draft = draftRevision; const edit = editing; let config;
    try {
      const values = Object.fromEntries(new FormData(form)); let expiresAt = null;
      if (values.expiresAt) {
        const milliseconds = Date.parse(values.expiresAt + ':00+03:00');
        if (!Number.isFinite(milliseconds) || clockText(new Date(milliseconds).toISOString()) !== values.expiresAt) throw { code: 'ALERT_TIME_INVALID' };
        expiresAt = new Date(milliseconds).toISOString();
      }
      config = canonicalRule({ schemaVersion: 1, source: 'tradingview', subject: { symbol: values.symbol, exchange: values.exchange },
        condition: values.condition, targetPrice: values.targetPrice.trim().replace(',', '.'), intent: values.intent, note: values.note,
        cooldownSeconds: Number(values.cooldownSeconds), expiresAt, deliverTelegram: form.elements.deliverTelegram.checked, evaluationClock: 'source-event-arrival' });
    } catch (error) { showToast(message(error.code), true); return; }
    const result = edit ? await controller.command(edit.id, { expectedRevision: edit.expectedRevision, command: { kind: edit.kind, config } }) : await controller.create(config);
    if (result.ok && result.authority?.isCurrent() && draft === draftRevision && edit === editing) clearDraft();
    accept(result, 'Правило сохранено на паузе. Обновите настройку TradingView для этой версии.');
  });
  listen($('#priceAlertCancelEdit'), 'click', clearDraft);
  listen(panel, 'click', async event => {
    const button = event.target.closest('[data-alert-action],[data-alert-event]'); if (!button || button.disabled) return;
    if (button.dataset.alertEvent) { const item = view.snapshot?.events.find(value => value.id === button.dataset.alertEvent); if (item) openEvent(item); return; }
    const rule = view.snapshot?.rules.find(value => rowId(value) === button.dataset.alertId); if (!rule) return;
    const action = button.dataset.alertAction; const config = configOf(rule); const id = rowId(rule);
    const menu = button.closest('details'); if (menu) { menu.open = false; menu.querySelector('summary').focus({ preventScroll: true }); }
    if (action === 'setup' && config && controller.notificationAuthority().isCurrent()) {
      const host = rowNodes.get(id)?.querySelector('.price-alert-setup'); if (!host) return; host.hidden = !host.hidden; if (host.hidden) return;
      host.replaceChildren();
      const intro = document.createElement('p'); intro.textContent = `Версия ${rule.ruleVersion}: ${config.subject.exchange}:${config.subject.symbol}, ${conditions[config.condition]}, уровень ${price(config.targetPrice)}. Включение приёма здесь не подтверждает настройку внешнего сигнала.`; host.append(intro);
      const url = document.createElement('input'); url.readOnly = true; url.setAttribute('aria-label', 'Адрес webhook'); url.value = view.snapshot.webhookUrl || 'Адрес сервиса не подтверждён'; host.append(url);
      const payload = document.createElement('textarea'); payload.readOnly = true; payload.rows = 8; payload.setAttribute('aria-label', 'Сообщение для TradingView');
      payload.value = JSON.stringify({ ruleId: id, ruleVersion: rule.ruleVersion, symbol: '{{ticker}}', exchange: '{{exchange}}', price: '{{close}}', sourceTime: '{{timenow}}' }, null, 2); host.append(payload);
      const note = document.createElement('p'); note.textContent = 'После изменения версии обновите сообщение в TradingView. Пауза здесь прекращает приём новых событий; уже выполненная отправка не отменяется.'; host.append(note); focusControl(payload); return;
    }
    if (!canWrite()) return;
    if (action === 'edit' || action === 'enroll') {
      if (!config) return;
      editing = { id, kind: action === 'enroll' ? 'enroll' : 'edit', expectedRevision: rule.headRevision, ruleVersion: rule.ruleVersion };
      for (const name of ['targetPrice', 'condition', 'intent', 'note', 'cooldownSeconds']) form.elements[name].value = config[name];
      form.elements.symbol.value = config.subject.symbol; form.elements.exchange.value = config.subject.exchange;
      form.elements.expiresAt.value = clockText(config.expiresAt); form.elements.deliverTelegram.checked = config.deliverTelegram;
      draftRevision++; syncForm(); transfer.update(); focusControl(form.elements.symbol); return;
    }
    const command = action === 'toggle' ? { kind: 'set-enabled', enabled: !rule.enabled } : action === 'recover' ? { kind: 'recover' } : null;
    if (!command) return;
    const result = await controller.command(id, { expectedRevision: rule.headRevision, command });
    accept(result, action === 'recover' ? 'Подтверждённая версия восстановлена на паузе.' : rule.enabled ? 'Приём новых событий приостановлен.' : 'Приём включён. Настройку сигнала TradingView проверьте отдельно.');
  });
  listen(popup.querySelector('#priceAlertLater'), 'click', () => { closePopup(); openNext(); });
  listen(popup, 'cancel', () => { currentPopup = null; popupSequence++; });
  listen(popup, 'close', () => { if (!popup.open) { currentPopup = null; popupSequence++; } });
  listen(popup.querySelector('#priceAlertAcknowledge'), 'click', async () => {
    const captured = currentPopup; if (!captured || !canWrite()) return;
    const result = await controller.markRead(captured.id);
    if (result.ok && currentPopup === captured && captured.authority.isCurrent()) { closePopup(); openNext(); }
    else if (!result.ok) accept(result, '');
  });
  listen($('#priceAlertRefresh'), 'click', () => { void refresh(); });
  listen($('#priceAlertSetup'), 'click', async () => { accept(await controller.setup(), 'Подключение проверено.'); });
  listen(document, 'visibilitychange', () => { if (!document.hidden && !suspended) { void controller.refresh({background:true}); openNext(); } });
  const startTimer = () => { clearInterval(timer); if (readOnly) return; timer = setInterval(() => { if (!document.hidden && !suspended) { void controller.refresh({background:true}); openNext(); } }, 10000); };
  listen(window, 'pagehide', () => { suspended = true; clearInterval(timer); controller.updateAccess({ allowed: false }); });
  listen(window, 'pageshow', async event => {
    if (!event.persisted || disposed) return;
    try { await refreshAccess(); if (disposed) return; suspended = false; updateBootstrap(); startTimer(); } catch { /* Keep the private view cleared. */ }
  });
  updateBootstrap(); startTimer();
  return Object.freeze({ updateBootstrap, refresh, notificationAuthority: () => controller.notificationAuthority(),
    rejectAccess(authority) { if (authority === controller.notificationAuthority()) controller.rejectAccess(); },
    dispose() { if (!disposed) { disposed = true; clearInterval(timer); controller.dispose(); telegram.dispose(); transfer.dispose(); archive.dispose(); abortListeners.abort(); closePopup(true); } } });
}
