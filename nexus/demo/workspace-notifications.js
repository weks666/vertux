const $ = selector => document.querySelector(selector);

function formatDay(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU') : '';
}

function addItem(host, { title, detail, time, unread, onClick }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'notification-item';
  button.dataset.unread = String(unread);
  const heading = document.createElement('strong');
  heading.textContent = title;
  button.append(heading);
  if (detail) {
    const description = document.createElement('span');
    description.textContent = detail;
    button.append(description);
  }
  if (time) {
    const stamp = document.createElement('time');
    stamp.textContent = formatDay(time);
    button.append(stamp);
  }
  button.addEventListener('click', onClick);
  host.append(button);
}

export function initWorkspaceNotifications({ activateView }) {
  const panel = $('#notificationPanel');
  const toggle = $('#notificationToggle');
  const items = $('#notificationItems');
  const count = $('#notificationCount');
  const planCard = $('#railPlanCard');
  const enableDesktop = $('#notificationEnableDesktop');
  const openAlerts = $('#notificationOpenAlerts');
  let alertEvents = [];
  let knownAlertIds = null;
  let knownTickets = null;
  let supportUpdates = [];

  function closePanel() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
  function openSection(section) {
    closePanel();
    const control = document.querySelector(`[data-system-section="${section}"]`);
    control?.click();
  }
  function openAlertView() { closePanel(); activateView('alerts'); }
  function desktopNotice(title, body, section) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notice = new Notification(title, { body, tag: `invest-${section}-${title}` });
      notice.onclick = () => { window.focus(); section === 'alerts' ? openAlertView() : openSection(section); notice.close(); };
    } catch { /* The host may disable native notifications; the in-app event remains available. */ }
  }
  function render() {
    const unread = alertEvents.filter(event => !event.readAt).length + supportUpdates.length;
    count.hidden = unread === 0;
    count.textContent = unread > 99 ? '99+' : String(unread);
    items.replaceChildren();
    const recentAlerts = [...alertEvents].sort((a, b) => String(b.sourceTime || '').localeCompare(String(a.sourceTime || ''))).slice(0, 5);
    for (const event of recentAlerts) addItem(items, {
      title: `Цена ${event.symbol || 'инструмента'} достигла уровня`,
      detail: `Уровень ${event.targetPrice ?? '—'} · сигнал ${event.actualPrice ?? '—'}`,
      time: event.sourceTime,
      unread: !event.readAt,
      onClick: openAlertView,
    });
    for (const ticket of supportUpdates) addItem(items, {
      title: 'Обращение в поддержку обновлено', detail: ticket.subject || 'Открыть обращение',
      time: ticket.updated_at, unread: true,
      onClick: () => { supportUpdates = supportUpdates.filter(item => item.id !== ticket.id); render(); openSection('support'); },
    });
    if (!items.childElementCount) items.textContent = 'Новых событий пока нет.';
  }
  function renderPlan(data) {
    const subscription = data.standardSubscription?.subscription || data.subscription;
    const catalog = data.standardSubscription?.catalog;
    const pro = (catalog?.plans || []).find(plan => /\bpro\b/i.test(`${plan.code || ''} ${plan.name || ''}`));
    const active = ['active', 'trial', 'grace'].includes(subscription?.status);
    planCard.hidden = false;
    planCard.querySelector('.rail-plan-progress')?.remove();
    if (active) {
      const name = subscription.planName || subscription.planCode || 'Invest Workspace';
      $('#railPlanTitle').textContent = `Ваш план: ${name}`;
      const days = Number.isFinite(Date.parse(subscription.periodEnd))
        ? Math.max(0, Math.ceil((Date.parse(subscription.periodEnd) - Date.now()) / 86400000)) : null;
      $('#railPlanDescription').textContent = days == null ? 'Срок доступа указан в подписке' : `До конца периода: ${days} дн. · ${formatDay(subscription.periodEnd)}`;
      $('#railPlanAction').textContent = 'Подробнее о подписке →';
      const start = Date.parse(subscription.periodStart);
      const end = Date.parse(subscription.periodEnd);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        const progress = Math.max(0, Math.min(100, (end - Date.now()) / (end - start) * 100));
        const track = document.createElement('span');
        track.className = 'rail-plan-progress';
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-label', 'Оставшаяся часть периода');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        track.setAttribute('aria-valuenow', String(Math.round(progress)));
        const bar = document.createElement('i');
        bar.style.width = `${progress}%`;
        track.append(bar);
        $('#railPlanDescription').after(track);
      }
    } else {
      $('#railPlanTitle').textContent = pro ? 'Больше возможностей с Pro' : 'Подписка Invest Workspace';
      $('#railPlanDescription').textContent = pro ? (pro.description || 'Посмотрите доступные возможности плана Pro') : 'Посмотрите подтверждённые условия доступа в Nexus';
      $('#railPlanAction').textContent = 'Открыть подписку →';
    }
  }
  async function refreshService() {
    if (typeof window.nexusProduct?.service?.overview !== 'function') return;
    try {
      const result = await window.nexusProduct.service.overview();
      if (result?.ok !== true || !result.data) return;
      renderPlan(result.data);
      const tickets = result.data.support?.tickets || [];
      const latest = new Map(tickets.map(ticket => [ticket.id, ticket.updated_at]));
      if (knownTickets) {
        for (const ticket of tickets) {
          if (!ticket.id || !ticket.updated_at || knownTickets.get(ticket.id) === ticket.updated_at) continue;
          supportUpdates = [ticket, ...supportUpdates.filter(item => item.id !== ticket.id)].slice(0, 3);
          desktopNotice('Ответ поддержки Vertux', ticket.subject || 'Обращение обновлено', 'support');
        }
      }
      knownTickets = latest;
      render();
    } catch { /* Keep the last confirmed state while Nexus is unavailable. */ }
  }
  document.addEventListener('invest:alerts-updated', event => {
    alertEvents = Array.isArray(event.detail?.events) ? event.detail.events : [];
    const latest = new Set(alertEvents.map(item => item.id));
    if (knownAlertIds) {
      for (const item of alertEvents) {
        if (item.readAt || !item.id || knownAlertIds.has(item.id)) continue;
        desktopNotice(`Ценовой сигнал: ${item.symbol || 'инструмент'}`, `Уровень ${item.targetPrice ?? '—'} · цена ${item.actualPrice ?? '—'}`, 'alerts');
      }
    }
    knownAlertIds = latest;
    render();
  });
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { render(); void refreshService(); }
  });
  $('#notificationClose').addEventListener('click', closePanel);
  document.addEventListener('pointerdown', event => { if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) closePanel(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { closePanel(); toggle.focus(); } });
  planCard.addEventListener('click', () => openSection('subscription'));
  openAlerts.hidden = !document.querySelector('[data-view="alerts"]');
  openAlerts.addEventListener('click', openAlertView);
  if ('Notification' in window && Notification.permission === 'default') enableDesktop.hidden = false;
  enableDesktop.addEventListener('click', async () => {
    try {
      const permission = await Notification.requestPermission();
      enableDesktop.hidden = permission !== 'default';
    } catch { enableDesktop.hidden = true; }
  });
  render();
  void refreshService();
  setInterval(() => { void refreshService(); }, 60_000);
}
