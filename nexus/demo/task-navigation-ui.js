import { TASK_SECTIONS, TASK_ROUTES, readTaskNavigation, migrateTaskNavigation, validateTaskNavigation, orderedTaskSections, resolveTaskRoute, inferTaskRoute } from './task-navigation-model.js';

/** One direct menu, with existing task links retained as guarded route aliases.
 * The presentation controller remains the owner of menu order and preferences.
 */
export function createDirectNavigation({ presentation, navigate, title, documentRef = document }) {
  const doc = documentRef, legacy = doc.querySelector('.navigation');
  let disposed = false, scope, revision = 0, hidden = new Set();
  function sync() {
    if (disposed) return;
    doc.body.dataset.navigationMode = 'direct';
    delete doc.body.dataset.taskRoute;
    legacy.hidden = false;
    const today = doc.querySelector('#todayOverview');
    if (today) today.dataset.taskOpen = 'true';
    title(null);
    doc.dispatchEvent(new CustomEvent('invest:task-route-changed', { detail: null }));
  }
  function setPresentation(snapshot) {
    if (disposed) return;
    if (scope !== snapshot.scope) { scope = snapshot.scope; revision++; }
    hidden = new Set(Array.isArray(snapshot.settings?.hidden) ? snapshot.settings.hidden : []);
    sync();
  }
  function go(id, { focus = true } = {}) {
    if (disposed) return false;
    const target = id === 'today' ? 'portfolio' : id, route = resolveTaskRoute(target);
    if (!route || hidden.has(route.legacy)) return false;
    const button = legacy.querySelector(`[data-view="${route.legacy}"]`);
    if (!button || button.disabled || button.hidden) return false;
    const before = revision;
    if (navigate(target, route, { focus }) !== true || revision !== before || disposed) return false;
    sync();
    return true;
  }
  setPresentation(presentation.getNavigationPreferences());
  return { setPresentation, sync, go, restore: sync, dispose() { disposed = true; } };
}

/** Navigation only: no source requests, instrument selection or account changes. */
export function createTaskNavigation({ presentation, navigate, current, title, documentRef = document }) {
  const doc = documentRef, legacy = doc.querySelector('.navigation'), main = doc.querySelector('#mainContent');
  const primary = doc.createElement('nav'); primary.className = 'task-navigation'; primary.setAttribute('aria-label', 'Основные разделы');
  const secondary = doc.createElement('nav'); secondary.className = 'task-destinations'; secondary.setAttribute('aria-label', 'Задачи раздела');
  legacy.before(primary); main.querySelector('.view').before(secondary);
  const routeLabel=doc.createElement('label'); routeLabel.className='ux-route-picker';
  const routeSelect=doc.createElement('select'); routeSelect.dataset.uxRoute=''; routeSelect.setAttribute('aria-label','Задача раздела');
  routeLabel.append(routeSelect); secondary.after(routeLabel);
  routeSelect.addEventListener('change',()=>go(routeSelect.value));
  const controls = doc.createElement('section'); controls.className = 'task-navigation-settings';
  controls.innerHTML = '<h4>Навигация</h4><label class="task-navigation-choice">Вид меню<select data-task-mode aria-label="Вид меню"><option value="tasks">По задачам · пять разделов</option><option value="classic">Прежний список разделов</option></select></label><p>Порядок, закрепления и скрытые разделы сохраняются для вашего профиля. Сочетания клавиш продолжают работать.</p><div data-task-order></div><button type="button" data-task-reset>Восстановить навигацию</button><p data-task-status role="status" aria-live="polite"></p>';
  doc.querySelector('.workspace-menu-heading').before(controls);
  let state = migrateTaskNavigation(), status = 'migrated', scope = null, routeId = null, disposed = false, legacyHidden = new Set(),preferenceReady=true,persistence='profile-browser';
  const visited = new Map(), buttons = new Map();
  const message = text => { controls.querySelector('[data-task-status]').textContent = text; };
  const legacyButton = id => legacy.querySelector(`[data-view="${id}"]`);
  const available = id => { const route = resolveTaskRoute(id); return Boolean(route && !legacyHidden.has(route.legacy) && !legacyButton(route.legacy)?.disabled); };
  function button(text, action, className) {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = text; node.className = className; node.addEventListener('click', action); return node;
  }
  for (const section of TASK_SECTIONS) {
    const node = button('', () => {
      const previous = visited.get(section.id), next = previous && available(previous) ? previous : section.routes.find(available);
      if (next) go(next);
    }, 'task-nav-item');
    node.dataset.taskSection = section.id; node.setAttribute('aria-label', section.title); node.title = section.title;
    node.innerHTML = `<svg aria-hidden="true"><use href="#${section.icon}"/></svg><span>${section.title}</span>`;
    buttons.set(section.id, node);
  }
  const services = doc.createElement('div'); services.className = 'task-service-links';
  for (const [view, label, icon] of [['sync', 'Источники и синхронизация', 'i-sync'], ['glossary', 'Справка и термины', 'i-book']]) {
    const node = button('', () => legacyButton(view)?.click(), 'task-nav-item task-service-link'); node.dataset.taskService = view;
    node.setAttribute('aria-label', label); node.title = label; node.innerHTML = `<svg aria-hidden="true"><use href="#${icon}"/></svg><span>${label}</span>`; services.append(node);
  }
  function setMode() {
    doc.body.dataset.navigationMode = state.mode; primary.hidden = secondary.hidden = state.mode !== 'tasks';
    routeLabel.hidden=state.mode!=='tasks'||!resolveTaskRoute(routeId);
    legacy.hidden = state.mode === 'tasks';
    const today = doc.querySelector('#todayOverview'); if (today) today.dataset.taskOpen = String(state.mode === 'tasks' && routeId === 'today');
    if (today?.dataset.taskOpen === 'true') { const details = today.querySelector('[data-today-details="main"]'); if (details?.tagName === 'DETAILS') details.open = true; }
    if (state.mode !== 'tasks') delete doc.body.dataset.taskRoute;
    title(state.mode === 'tasks' ? resolveTaskRoute(routeId) : null);
  }
  function renderSettings() {
    const active = doc.activeElement, focus = controls.contains(active) ? active.dataset.taskFocus : null;
    const select = controls.querySelector('[data-task-mode]'); select.value = state.mode; select.disabled = status === 'invalid'||!preferenceReady; select.dataset.taskFocus = 'mode';
    const list = controls.querySelector('[data-task-order]'); list.hidden = state.mode !== 'tasks'; list.replaceChildren();
    const ordered = orderedTaskSections(state);
    ordered.forEach((section, index) => {
      const row = doc.createElement('div'); row.className = 'task-order-row'; row.dataset.taskOrder = section.id;
      const label = doc.createElement('strong'); label.textContent = section.title; row.append(label);
      for (const direction of [-1, 1]) {
        const target = ordered[index + direction];
        const move = button(direction < 0 ? 'Выше' : 'Ниже', () => {
          if (!target) return;
          const order = [...state.order], a = order.indexOf(section.id), b = order.indexOf(target.id); [order[a], order[b]] = [order[b], order[a]]; persist({ order });
        }, 'task-order-move');
        move.disabled = !target || state.pinned.includes(target.id) !== state.pinned.includes(section.id);
        move.setAttribute('aria-label', `${direction < 0 ? 'Выше' : 'Ниже'}: ${section.title}`); move.dataset.taskFocus = `${section.id}:${direction}`; row.append(move);
      }
      const pin = button('Закрепить', () => persist({ pinned: state.pinned.includes(section.id) ? state.pinned.filter(id => id !== section.id) : [...state.pinned, section.id] }), 'task-order-pin');
      pin.setAttribute('aria-pressed', String(state.pinned.includes(section.id))); pin.setAttribute('aria-label', `Закрепить: ${section.title}`); pin.dataset.taskFocus = `${section.id}:pin`; row.append(pin);
      const visibility = doc.createElement('label'), input = doc.createElement('input'); input.type = 'checkbox'; input.checked = !state.hidden.includes(section.id); input.dataset.taskFocus = `${section.id}:visible`;
      input.setAttribute('aria-label', `Показывать раздел: ${section.title}`); input.addEventListener('change', () => persist({ hidden: input.checked ? state.hidden.filter(id => id !== section.id) : [...state.hidden, section.id] }));
      visibility.append(input, doc.createTextNode('Показывать')); row.append(visibility); list.append(row);
    });
    controls.querySelector('[data-task-reset]').disabled=!preferenceReady;
    if(!preferenceReady)for(const field of controls.querySelectorAll('button,input,select'))field.disabled=true;
    if (focus) {
      const candidates = [...controls.querySelectorAll('[data-task-focus]')], same = candidates.find(node => node.dataset.taskFocus === focus);
      const target = same && !same.disabled ? same : candidates.find(node => !node.disabled && node.dataset.taskFocus.startsWith(focus.split(':')[0] + ':'));
      target?.focus({ preventScroll: true });
    }
  }
  function renderNavigation() {
    const active = doc.activeElement, focusRoute = secondary.contains(active) ? active.dataset.taskDestination : null;
    const route = resolveTaskRoute(routeId);
    for (const section of orderedTaskSections(state)) {
      const node = buttons.get(section.id); node.hidden = state.hidden.includes(section.id); node.disabled = !section.routes.some(available);
      const selected = section.id === route?.section; node.classList.toggle('active', selected);
      if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
      const desired = [...primary.children].filter(child => child !== services), index = orderedTaskSections(state).indexOf(section);
      if (desired[index] !== node) primary.insertBefore(node, desired[index] || services.parentNode && services || null);
    }
    if (services.parentNode !== primary) primary.append(services);
    for (const node of services.children) node.hidden = legacyHidden.has(node.dataset.taskService);
    secondary.replaceChildren(); secondary.hidden = state.mode !== 'tasks' || !route;
    routeSelect.replaceChildren();
    if (route) {
      const section = TASK_SECTIONS.find(row => row.id === route.section); secondary.setAttribute('aria-label', `Задачи: ${section.title}`);
      for (const id of section.routes) {
        const target = TASK_ROUTES[id]; if (legacyHidden.has(target.legacy) && id !== routeId) continue;
        const node = button(target.label, () => go(id), 'task-destination'); node.dataset.taskDestination = id; node.disabled = !available(id);
        if (id === routeId) node.setAttribute('aria-current', 'page'); secondary.append(node);
        const option=doc.createElement('option');option.value=id;option.textContent=target.label;option.disabled=!available(id);routeSelect.append(option);
      }
      doc.body.dataset.taskRoute = routeId;
      routeSelect.value=routeId;
    } else delete doc.body.dataset.taskRoute;
    setMode(); secondary.hidden = state.mode !== 'tasks' || !route;
    doc.dispatchEvent(new CustomEvent('invest:task-route-changed', { detail: state.mode === 'tasks' ? routeId : null }));
    if (focusRoute) secondary.querySelector(`[data-task-destination="${focusRoute}"]`)?.focus({ preventScroll: true });
  }
  function persist(patch, recovery = false) {
    if (disposed || !preferenceReady || status === 'invalid' && !recovery) return false;
    const next = validateTaskNavigation({ ...state, ...patch });
    try { presentation.saveTaskNavigation(next); message(persistence==='memory-session'?'Навигация изменена до перезагрузки предпросмотра.':'Навигация сохранена.'); return true; }
    catch (error) { message(error.message === 'TASK_NAVIGATION_SAVE_UNCONFIRMED'
      ? 'Не удалось подтвердить сохранение навигации. Повторите действие после восстановления доступа к настройкам.'
      : 'Не удалось сохранить навигацию. Прежние настройки сохранены; повторите действие.'); renderSettings(); return false; }
  }
  function go(id, { save = true, focus = true } = {}) {
    if (disposed || state.mode !== 'tasks' || !available(id)) return false;
    const route = resolveTaskRoute(id); if (!route) return false;
    const previousScope = scope;
    if (navigate(id, route, { focus }) !== true || scope !== previousScope) return false;
    routeId = id; visited.set(route.section, id); renderNavigation();
    if (save && preferenceReady && state.lastRoute !== id) persist({ lastRoute: id });
    return true;
  }
  function sync(context = current(), explicit = null) {
    if (disposed) return;
    routeId = resolveTaskRoute(explicit) ? explicit : inferTaskRoute(context); renderNavigation();
  }
  function setPresentation(snapshot) {
    if (disposed) return;
    preferenceReady=snapshot.ready!==false;persistence=snapshot.persistence||'profile-browser';
    if (scope !== snapshot.scope) { scope = snapshot.scope; visited.clear(); routeId = inferTaskRoute(current()); }
    legacyHidden = new Set(Array.isArray(snapshot.settings.hidden) ? snapshot.settings.hidden : []);
    const next = readTaskNavigation(snapshot.settings); state = next.state; status = next.status;
    renderNavigation(); renderSettings();
    controls.querySelector('.task-navigation-choice+p').textContent=persistence==='memory-session'?'Изменения меню действуют до перезагрузки предпросмотра.':'Порядок, закрепления и скрытые разделы сохраняются для вашего профиля. Сочетания клавиш продолжают работать.';
    if(!preferenceReady)message(snapshot.message||'Сначала подтвердите настройки профиля.');
    if (status === 'invalid') message('Сохранённая навигация не поддерживается или повреждена. Открыто прежнее меню. Восстановление изменит только навигацию.');
  }
  controls.querySelector('[data-task-mode]').addEventListener('change', event => persist({ mode: event.target.value }));
  controls.querySelector('[data-task-reset]').addEventListener('click', () => {
    if (persist(migrateTaskNavigation(), true)) message(persistence==='memory-session'?'Навигация восстановлена до перезагрузки предпросмотра.':'Навигация восстановлена. Прежний порядок меню и сочетания клавиш сохранены.');
  });
  const observer = new MutationObserver(() => renderNavigation());
  observer.observe(legacy, { attributes: true, attributeFilter: ['disabled'], subtree: true });
  setPresentation(presentation.getNavigationPreferences());
  return { setPresentation, sync, go,
    restore() { if (state.mode === 'tasks') { const id = state.lastRoute || (current().view === 'overview' ? 'today' : inferTaskRoute(current())); if (id) go(id, { save: false, focus: false }); } },
    dispose() { disposed = true; observer.disconnect(); },
  };
}
