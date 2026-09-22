export function historyProgressCopy(value) {
  if (!value || ['idle','complete'].includes(value.state)) return '';
  const date = value.from ? new Date(value.from).toLocaleDateString('ru-RU', {month:'long',year:'numeric',timeZone:'Europe/Moscow'}) : '';
  if (value.state === 'unavailable') return 'Брокер пока не передал дату открытия счёта. Показана сохранённая история.';
  if (value.state === 'retrying') return 'Загрузка старой истории приостановлена. Продолжим автоматически.';
  return `${value.phase === 'prices' ? 'Загружаем исторические цены' : 'Загружаем операции с открытия счёта'}${date ? ' · с ' + date : ''}. Уже сохранённые данные доступны.`;
}

export function createHistoryLoader({ request, eligible, onProgress, onChanged,
  schedule = setTimeout, cancel = clearTimeout, intervalMs = 8000 }) {
  let timer = null, stopped = false, running = false, revision = -1, complete = false;
  async function tick() {
    if (stopped || running) return;
    running = true;
    try {
      if (eligible()) {
        const value = await request('/api/history/backfill', {method:'POST',body:'{}'});
        onProgress(value);
        if (revision >= 0 && revision !== value.revision) await onChanged();
        revision = value.revision;
        complete = value.state === 'complete';
      }
    } catch { /* Current portfolio refresh remains independent of historical backfill. */ }
    finally {
      running = false;
      if (!stopped) timer = schedule(tick, complete ? 300_000 : intervalMs);
    }
  }
  return { start() { stopped=false; if (!timer && !running) void tick(); },
    stop() { stopped = true; if (timer) cancel(timer); timer=null; } };
}
