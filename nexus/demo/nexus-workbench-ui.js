import { TASK_ROUTES } from './task-navigation-model.js';
import { initVisualWorkspace } from './visual-workspace.js';
import {mountWorkspaceRefinements} from './workspace-refinements.js';

/** Presentation only. Move the existing nodes so their controllers and data stay intact. */
export function initNexusWorkbench(doc = document, options = {}) {
  let railOpener = null;
  const rememberRailOpener = event => {
    const button = event.target.closest?.('[data-open-rail],[data-workspace-menu]');
    if (button && doc.body.classList.contains('rail-open')) railOpener = button;
  };
  const closeRailFirst = event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !doc.body.classList.contains('rail-open') || doc.querySelector('dialog[open]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    doc.body.classList.remove('rail-open');
    doc.querySelectorAll('[data-open-rail],[data-workspace-menu][aria-expanded]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    const visible = node => node?.isConnected && node.getClientRects().length > 0;
    const target = visible(railOpener) ? railOpener : [...doc.querySelectorAll('[data-open-rail],[data-workspace-menu]')].find(visible);
    target?.focus({ preventScroll: true });
  };
  doc.addEventListener('click', rememberRailOpener);
  doc.addEventListener('keydown', closeRailFirst, true);
  const overview = doc.querySelector('[data-view-panel="overview"]');
  const positions = overview.querySelector('.positions-surface');
  const supporting = doc.createElement('div');
  supporting.className = 'ux-portfolio-support';
  for (const selector of ['.portfolio-history-status', '.overview-performance']) {
    const node = overview.querySelector(selector);
    if (node) supporting.append(node);
  }
  positions.after(supporting);

  const research = doc.querySelector('.deep-instrument');
  const saved = doc.querySelector('#savedResearch');
  const queries = research.querySelector('[data-research-query-fallback]');
  if (saved && queries) {
    research.append(saved, queries);
    const jump = doc.createElement('button');
    jump.type = 'button'; jump.className = 'ux-research-saved button secondary';
    jump.textContent = 'Сохранения и запросы';
    jump.addEventListener('click', () => {
      saved.scrollIntoView({ block: 'start', behavior: 'instant' });
      saved.querySelector('[data-sr-action="show-save"]')?.focus({ preventScroll: true });
    });
    research.querySelector('.deep-instrument-toolbar').append(jump);
  }

  const settings = doc.querySelector('[data-view-panel="settings"]');
  const customization = settings.querySelector('.workspace-customization');
  const header = doc.createElement('header'); header.className = 'section-head';
  const title = doc.createElement('h2'); title.textContent = 'Настройки'; header.append(title);
  settings.prepend(header);
  customization.querySelector('h3').textContent = 'Оформление';
  customization.querySelector('h3 + p').textContent = 'Выберите тему, цвета и удобный вид рабочего пространства.';
  const menu = doc.createElement('details'); menu.className = 'ux-settings-group';
  const summary = doc.createElement('summary'); summary.textContent = 'Меню и сочетания клавиш'; menu.append(summary);
  const first = customization.querySelector('.task-navigation-settings') || customization.querySelector('.workspace-menu-heading');
  const last = customization.querySelector('.workspace-profile-shortcut');
  if (first && last) {
    const nodes = [...customization.children];
    for (const node of nodes.slice(nodes.indexOf(first), nodes.indexOf(last) + 1)) menu.append(node);
    customization.querySelector('.workspace-option').after(menu);
  }
  for (const selector of ['.workspace-settings-transfer', '.workspace-settings-recovery']) {
    const node = customization.querySelector(selector);
    if (node) customization.append(node);
  }

  // Legacy headings belong to their controllers (including classic analytics).
  // A separate stable task heading avoids overwriting their current context.
  const headings = new Map();
  for (const viewId of ['analytics', 'risk-plan']) {
    const view = doc.querySelector(`.view[data-view-panel="${viewId}"]`);
    const original = view?.querySelector(':scope > .section-head');
    if (!original?.querySelector('h2')) continue;
    const taskHeader = doc.createElement('header'); taskHeader.className = 'section-head ux-task-heading'; taskHeader.hidden = true;
    const copy = doc.createElement('div'), heading = doc.createElement('h2'), description = doc.createElement('p');
    copy.append(heading, description); taskHeader.append(copy); original.after(taskHeader);
    headings.set(viewId, { original, taskHeader, heading, description });
  }
  const descriptions = {
    research: 'Выберите инструмент и область анализа. Даты и источники относятся к выбранным данным.',
    trading: 'Результаты исполнений, расходы и сравнение торговых эпизодов.',
    reviews: 'Сохранённые срезы портфеля и изменения между ними.',
    capital: 'Результат периода, доходность, риск и подтверждающие записи.',
    calculator: 'Капитал, допустимый убыток и цены — для расчёта размера позиции.',
    journal: 'Идеи, условия входа и даты пересмотра. Сохранение плана не отправляет заявку.',
    margin: 'Обеспечение выбранного счёта и доступные параметры открытых позиций.',
  };
  function sync() {
    const route = TASK_ROUTES[doc.body.dataset.taskRoute];
    for (const [viewId, entry] of headings) {
      const active = doc.body.dataset.navigationMode === 'tasks' && route?.legacy === viewId;
      entry.original.classList.toggle('ux-task-legacy', active);
      entry.taskHeader.hidden = !active;
      if (!active) continue;
      entry.heading.textContent = route.label;
      entry.description.textContent = descriptions[doc.body.dataset.taskRoute] || entry.original.querySelector('p')?.textContent || '';
      entry.description.hidden = !entry.description.textContent;
    }
  }
  doc.addEventListener('invest:task-route-changed', sync);
  sync();
  const visualWorkspace = initVisualWorkspace(doc,options);
  const refinements=options.store?mountWorkspaceRefinements({doc,store:options.store}):null;
  return { dispose() {
    refinements?.dispose();
    visualWorkspace.dispose();
    doc.removeEventListener('invest:task-route-changed', sync);
    doc.removeEventListener('click', rememberRailOpener);
    doc.removeEventListener('keydown', closeRailFirst, true);
  } };
}
