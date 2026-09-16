const intents = { buy: 'Покупка', sell: 'Продажа', watch: 'Наблюдение' };
const delivery = { pending: 'Telegram: в очереди', sent: 'Отправлено в Telegram', failed: 'Telegram: ошибка доставки', unknown: 'Telegram: доставка не подтверждена', not_configured: 'Telegram не подключён' };
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const stamp = (value) => new Date(value).toLocaleString('ru-RU');

export function initPriceAlerts({ request, showToast, activateView, readOnly = false }) {
  const existingNav = document.querySelector('[data-view="instruments"]');
  const nav = document.createElement('button');
  nav.type = 'button'; nav.className = 'nav-item'; nav.dataset.view = 'alerts';
  nav.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span>Ценовые алерты</span><span id="priceAlertCount" hidden></span>';
  existingNav.after(nav);
  nav.addEventListener('click', () => activateView('alerts', nav));
  const panel = document.createElement('section');
  panel.className = 'view'; panel.dataset.viewPanel = 'alerts';
  panel.innerHTML = `
    <header class="section-intro"><div><h2>Ценовые алерты</h2><p>Ваши уровни покупки и продажи. Сигналы приходят из TradingView и сохраняются здесь.</p></div></header>
    <p id="priceAlertStatus" class="empty-copy" role="status">Проверяем подключение…</p>
    <button type="button" id="priceAlertSetup" class="button">Подключить доставку</button>
    <form id="priceAlertForm" class="data-surface price-alert-form">
      <label>Тикер<input name="symbol" placeholder="SBER" maxlength="64" required autocomplete="off"></label>
      <label>Биржа<input name="exchange" placeholder="MOEX" maxlength="32" required autocomplete="off"></label>
      <label>Цена срабатывания<input name="targetPrice" placeholder="250,50" inputmode="decimal" required autocomplete="off"></label>
      <label>Мой план<select name="intent"><option value="watch">Наблюдение</option><option value="buy">Покупка</option><option value="sell">Продажа</option></select></label>
      <button type="submit" class="primary-button" disabled>Добавить алерт</button>
      <p class="price-alert-help">После добавления перенесите настройки в TradingView. Сигнал напоминает о вашем плане; заявка брокеру не отправляется.</p>
    </form>
    <article class="data-surface"><header class="surface-head"><h3>Мои уровни</h3></header><div id="priceAlertRules"><p class="empty-copy">Алертов пока нет.</p></div></article>
    <article class="data-surface"><header class="surface-head"><h3>История сигналов</h3><button type="button" id="priceAlertRefresh">Обновить</button></header><div id="priceAlertEvents"><p class="empty-copy">Здесь появятся сработавшие алерты.</p></div></article>`;
  document.querySelector('[data-view-panel="instruments"]').after(panel);
  const popup = document.createElement('dialog');
  popup.id = 'priceAlertDialog'; popup.setAttribute('aria-labelledby', 'priceAlertPopupTitle');
  popup.innerHTML = '<div class="dialog-card"><h2 id="priceAlertPopupTitle"></h2><p id="priceAlertPopupBody"></p><p id="priceAlertPopupTime" class="empty-copy"></p><p>Сработал ваш ценовой алерт. Сделка не совершалась.</p><button type="button" class="primary-button" id="priceAlertAcknowledge">Прочитано</button><button type="button" id="priceAlertLater">Закрыть</button></div>';
  document.body.append(popup);
  for (const button of [...panel.querySelectorAll('button'), ...popup.querySelectorAll('button')]) {
    button.classList.add('button');
    if (button.classList.contains('primary-button')) button.classList.add('primary');
  }
  const form = panel.querySelector('form');
  const status = panel.querySelector('#priceAlertStatus');
  if (readOnly) {
    status.textContent = 'Ценовые алерты доступны в основной версии приложения. В локальной проверке настройки и уведомления не изменяются.';
    for (const control of panel.querySelectorAll('button, input, select')) control.disabled = true;
    panel.querySelector('#priceAlertRules').textContent = 'Настройки алертов остаются в основной версии.';
    panel.querySelector('#priceAlertEvents').textContent = 'История сигналов доступна в основной версии.';
    form.addEventListener('submit', (event) => event.preventDefault());
    return;
  }
  let snapshot = null; let fetching = false; let stopped = false; let current = null; let timer;
  let rulesRevision = null; let eventsRevision = null;
  const shown = new Set(); const queue = [];

  function openNext() {
    if (popup.open || document.querySelector('dialog[open]') || !queue.length || document.hidden) return;
    current = queue.shift(); shown.add(current.id);
    popup.querySelector('h2').textContent = `${intents[current.intent] || 'Сигнал'} · ${current.symbol}`;
    popup.querySelector('#priceAlertPopupBody').textContent = `Ваш уровень: ${current.targetPrice}. Цена сигнала: ${current.actualPrice}. Биржа: ${current.exchange}.`;
    popup.querySelector('#priceAlertPopupTime').textContent = `${snapshot?.fixture ? 'Тестовый сигнал' : 'TradingView'} · ${stamp(current.sourceTime)}`;
    popup.showModal();
  }
  function render(data) {
    snapshot = data;
    panel.querySelector('#priceAlertSetup').hidden = Boolean(data.fixture || data.configured);
    status.textContent = !data.configured ? 'Доставка алертов ещё не подключена. Поддержка поможет связать TradingView и Telegram с вашим Workspace.'
      : data.fixture ? 'Демонстрационный режим: тестовые сигналы остаются в приложении; в Telegram ничего не отправляется.'
      : `Сервис алертов доступен. ${data.telegramConfigured ? 'Telegram настроен; результат доставки виден у каждого сигнала.' : 'Telegram ещё не подключён.'}`;
    form.querySelector('button').disabled = !data.configured;
    const rows = data.rules || [];
    const nextRulesRevision = JSON.stringify([rows, data.fixture, data.webhookUrl]);
    if (nextRulesRevision !== rulesRevision) {
    rulesRevision = nextRulesRevision;
    panel.querySelector('#priceAlertRules').innerHTML = rows.length ? rows.map((r) => `<div class="price-alert-row"><div><strong>${escape(r.exchange)}:${escape(r.symbol)}</strong><p>${escape(intents[r.intent])} при ${escape(r.targetPrice)}</p></div><div class="price-alert-actions"><button type="button" data-alert-setup="${escape(r.id)}">Настроить в TradingView</button>${data.fixture ? `<button type="button" data-alert-test="${escape(r.id)}">Тестовый сигнал</button>` : ''}<button type="button" data-alert-delete="${escape(r.id)}">Отключить</button></div><div class="price-alert-setup" id="alert-setup-${escape(r.id)}" hidden></div></div>`).join('') : '<p class="empty-copy">Добавьте тикер и цену, чтобы настроить первый алерт.</p>';
    }
    const events = data.events || [];
    const nextEventsRevision = JSON.stringify(events);
    if (nextEventsRevision !== eventsRevision) {
    eventsRevision = nextEventsRevision;
    panel.querySelector('#priceAlertEvents').innerHTML = events.length ? events.map((e) => `<div class="price-alert-row"><div><strong>${escape(intents[e.intent])} · ${escape(e.symbol)}</strong><p>Уровень ${escape(e.targetPrice)} · сигнал ${escape(e.actualPrice)}</p><small>${escape(stamp(e.sourceTime))} · ${escape(delivery[e.telegramStatus] || 'Статус доставки неизвестен')}</small></div><button type="button" data-alert-event="${escape(e.id)}">${e.readAt ? 'Посмотреть' : 'Новый сигнал'}</button></div>`).join('') : '<p class="empty-copy">Сработавших алертов пока нет.</p>';
    }
    for (const button of panel.querySelectorAll('.price-alert-row button')) button.classList.add('button');
    const unread = events.filter((e) => !e.readAt);
    const badge = nav.querySelector('#priceAlertCount'); badge.hidden = !unread.length; badge.textContent = String(unread.length);
    for (const e of [...unread].reverse()) if (!shown.has(e.id) && !queue.some((q) => q.id === e.id) && current?.id !== e.id) queue.push(e);
    openNext();
  }
  async function refresh() {
    if (fetching || stopped) return;
    fetching = true;
    try { render(await request('/api/alerts')); }
    catch { status.textContent = 'Сервис алертов не ответил. Сохранённый список остаётся на экране; попробуйте обновить.'; form.querySelector('button').disabled = true; }
    finally { fetching = false; }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      values.targetPrice = values.targetPrice.trim().replace(',', '.');
      await request('/api/alerts/rules', { method: 'POST', body: JSON.stringify(values) });
      form.reset(); await refresh(); showToast('Алерт сохранён. Теперь настройте его в TradingView.');
    } catch (error) { showToast(error.message, true); }
    finally { button.disabled = !snapshot?.configured; }
  });
  panel.addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button) return;
    const id = button.dataset.alertSetup || button.dataset.alertDelete || button.dataset.alertTest;
    try {
      if (button.dataset.alertSetup) {
        const rule = snapshot.rules.find((r) => r.id === id); if (!rule) return;
        const target = panel.querySelector(`#alert-setup-${id}`); target.hidden = !target.hidden;
        if (target.hidden) return;
        target.replaceChildren();
        const info = document.createElement('p');
        info.textContent = `В TradingView откройте ${rule.exchange}:${rule.symbol}, создайте алерт на ${rule.targetPrice}. В уведомлениях включите Webhook URL и вставьте адрес ниже, а в сообщение — JSON. Для webhook нужна двухфакторная аутентификация TradingView.`;
        target.append(info);
        const urlField = document.createElement('input'); urlField.readOnly = true; urlField.setAttribute('aria-label', 'Адрес webhook');
        urlField.value = snapshot.webhookUrl || 'Тестовый режим: внешний адрес не подключён'; target.append(urlField);
        const message = document.createElement('textarea'); message.readOnly = true; message.rows = 7; message.setAttribute('aria-label', 'Сообщение для TradingView');
        message.value = JSON.stringify({ ruleId: rule.id, symbol: '{{ticker}}', exchange: '{{exchange}}', price: '{{close}}', sourceTime: '{{timenow}}' }, null, 2); target.append(message);
        const note = document.createElement('p'); note.textContent = 'Отключение здесь прекращает приём сигнала. Сам алерт в TradingView удаляется отдельно.'; target.append(note);
      } else if (button.dataset.alertDelete) {
        button.disabled = true; await request(`/api/alerts/rules/${id}`, { method: 'DELETE' }); await refresh();
      } else if (button.dataset.alertTest) {
        button.disabled = true; await request(`/api/alerts/rules/${id}/test`, { method: 'POST', body: '{}' }); await refresh();
      } else if (button.dataset.alertEvent) {
        const item = snapshot.events.find((e) => e.id === button.dataset.alertEvent);
        if (item && !popup.open) { queue.unshift(item); openNext(); }
      }
    } catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; }
  });
  popup.querySelector('#priceAlertAcknowledge').addEventListener('click', async (event) => {
    if (!current) return; event.target.disabled = true;
    try { await request(`/api/alerts/events/${current.id}/read`, { method: 'POST', body: '{}' }); popup.close(); await refresh(); }
    catch (error) { showToast(error.message, true); }
    finally { event.target.disabled = false; }
  });
  popup.querySelector('#priceAlertLater').addEventListener('click', () => popup.close());
  popup.addEventListener('close', () => { current = null; setTimeout(openNext, 100); });
  panel.querySelector('#priceAlertRefresh').addEventListener('click', refresh);
  panel.querySelector('#priceAlertSetup').addEventListener('click', async (event) => {
    event.target.disabled = true;
    try { await request('/api/alerts/setup', { method: 'POST', body: '{}' }); await refresh(); }
    catch (error) { showToast(error.message, true); }
    finally { event.target.disabled = false; }
  });
  const visibility = () => { if (!document.hidden) { refresh(); openNext(); } };
  document.addEventListener('visibilitychange', visibility);
  timer = setInterval(() => { if (!document.hidden) { refresh(); openNext(); } }, 10000);
  refresh();
  window.addEventListener('pagehide', () => { stopped = true; clearInterval(timer); });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    stopped = false; refresh();
    timer = setInterval(() => { if (!document.hidden) { refresh(); openNext(); } }, 10000);
  });
}
