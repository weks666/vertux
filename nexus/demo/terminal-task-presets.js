export const TERMINAL_PRESET_VERSION = 1;
export const TERMINAL_TASK_PRESETS = Object.freeze([
  Object.freeze({ id: 'chart', label: 'График', description: 'График на всю рабочую область' }),
  Object.freeze({ id: 'research', label: 'Исследование', description: 'График и статистика инструмента' }),
  Object.freeze({ id: 'plan', label: 'План', description: 'График, расчёт позиции и заметка' }),
]);
const names = TERMINAL_TASK_PRESETS.map(row => row.id);
const fields = ['count', 'auxiliary', 'dock', 'dockCollapsed', 'side'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const data = (value, depth = 0) => {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 2000;
  if (!record(value) && !Array.isArray(value)) return false;
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value));
  return entries.length <= 600 && entries.every(([key, item]) => Object.hasOwn(item, 'value') && !['__proto__', 'prototype', 'constructor'].includes(key) && data(item.value, depth + 1));
};
const presentation = layout => Object.fromEntries(fields.map(key => [key, layout[key]]));
const validPresentation = value => exact(value, fields) && [1, 2, 4].includes(value.count)
  && ['', 'watch', 'book', 'tape', 'plan', 'alerts', 'trade'].includes(value.auxiliary)
  && ['stats', 'book', 'tape', 'participants', 'events', 'radar'].includes(value.dock)
  && typeof value.dockCollapsed === 'boolean' && ['market', 'plan', 'alerts'].includes(value.side);
const choices = Object.freeze({ chart: { count: 1, auxiliary: '', dock: 'stats', dockCollapsed: true, side: 'plan' },
  research: { count: 1, auxiliary: '', dock: 'stats', dockCollapsed: false, side: 'plan' },
  plan: { count: 1, auxiliary: 'plan', dock: 'stats', dockCollapsed: true, side: 'plan' } });
const same = (a, b) => fields.every(key => a[key] === b[key]);

export function terminalPresetState(layout) {
  if (!data(layout) || !record(layout)) return { state: 'invalid' };
  if (!Object.hasOwn(layout, 'taskPreset')) return { state: 'none' };
  const value = layout.taskPreset;
  if (!exact(value, ['version', 'selected', 'previous']) || value.version !== TERMINAL_PRESET_VERSION
    || ![...names, 'custom'].includes(value.selected) || !validPresentation(value.previous)) return { state: 'invalid' };
  return { state: 'active', selected: value.selected, matches: value.selected === 'custom' || same(layout, choices[value.selected]) };
}
export function validTerminalPresetLayout(layout) {
  const state = terminalPresetState(layout);
  return state.state === 'none' || state.state === 'active' && state.matches;
}
const copy = layout => {
  if (!data(layout) || !record(layout) || !validPresentation(presentation(layout)) || terminalPresetState(layout).state === 'invalid') throw new TypeError('Unknown terminal presentation settings');
  return structuredClone(layout);
};

/** A preset never changes tabs/active/documents, links, radar or chart settings. */
export function applyTerminalTaskPreset(layout, id) {
  if (!names.includes(id)) throw new TypeError('Unknown terminal preset');
  const next = copy(layout), previous = next.taskPreset?.previous || presentation(next);
  Object.assign(next, choices[id]);
  next.taskPreset = { version: TERMINAL_PRESET_VERSION, selected: id, previous };
  return next;
}
/** Restore only presentation; intervening explicit tab edits remain authoritative. */
export function restoreTerminalTaskPresentation(layout) {
  const next = copy(layout);
  if (!next.taskPreset) return next;
  Object.assign(next, next.taskPreset.previous); delete next.taskPreset;
  return next;
}
export function reconcileTerminalTaskPreset(layout) {
  const next = copy(layout), state = terminalPresetState(next);
  if (state.state === 'active' && !state.matches) next.taskPreset.selected = 'custom';
  return next;
}
