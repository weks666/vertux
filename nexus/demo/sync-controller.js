const done = status => ['completed', 'warning', 'failed'].includes(status);
export const PORTFOLIO_REFRESH_INTERVAL_MS = 10_000;
const refreshInterval = value => Number.isInteger(value) && value >= 5000 && value <= 60_000 ? value : PORTFOLIO_REFRESH_INTERVAL_MS;
const sourceRows = bootstrap => Array.isArray(bootstrap?.equityCurvesByPortfolio) && bootstrap.equityCurvesByPortfolio.length
  ? bootstrap.equityCurvesByPortfolio.map(row => [row.portfolioId, Date.parse(row.portfolio?.currentAsOf)])
  : [['', Date.parse(bootstrap?.portfolio?.currentAsOf)]];
// Arrival time belongs to data actually rendered, not a successful poll or the
// next broker job. A cached response, period switch or older response cannot reset it.
export function createDisplayedRefreshClock() {
  let scope = null, arrivals = new Map();
  return Object.freeze({
    observe(bootstrap, key, time = Date.now()) {
      if (scope !== key) { scope = key; arrivals = new Map(); }
      const rows = sourceRows(bootstrap), ids = new Set(rows.map(([id]) => id));
      for (const id of arrivals.keys()) if (!ids.has(id)) arrivals.delete(id);
      for (const [id, sourceAt] of rows) {
        if (!Number.isFinite(sourceAt)) { arrivals.delete(id); continue; }
        const prior = arrivals.get(id);
        if (!prior) arrivals.set(id, { sourceAt, displayedAt: null });
        else if (sourceAt > prior.sourceAt) arrivals.set(id, { sourceAt, displayedAt: time });
      }
    },
    at(bootstrap, portfolioId = '') {
      const rows = sourceRows(bootstrap).filter(([id]) => !portfolioId || !id || id === portfolioId);
      const times = rows.map(([id, sourceAt]) => {
        const entry = arrivals.get(id);
        return entry?.sourceAt === sourceAt ? entry.displayedAt : null;
      });
      return times.length && times.every(Number.isFinite) ? Math.min(...times) : null;
    },
  });
}
export function syncFreshnessCopy(bootstrap, portfolioId = '', time = Date.now()) {
  const accounts = bootstrap?.equityCurvesByPortfolio;
  const selected = Array.isArray(accounts) && accounts.length
    ? accounts.filter(a => !portfolioId || a.portfolioId === portfolioId).map(a => a.portfolio?.currentAsOf)
    : [bootstrap?.portfolio?.currentAsOf];
  const times = selected.map(Date.parse);
  if (!times.length || times.some(at => !Number.isFinite(at))) return 'Ожидаем данные';
  const seconds = Math.max(0, Math.floor((time - Math.min(...times)) / 1000));
  if (seconds < 1) return 'Обновлено только что';
  if (seconds < 60) return `Обновлено ${seconds} ${{one:'секунду',few:'секунды',many:'секунд',other:'секунды'}[new Intl.PluralRules('ru').select(seconds)]} назад`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Обновлено ${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `Обновлено ${hours} ч. назад` : `Обновлено ${Math.floor(hours / 24)} дн. назад`;
}
export function syncProgressCopy(job) {
  if (!job) return '';
  if (job.status === 'queued') return 'Синхронизация в очереди · дождёмся текущего обновления';
  if (job.status === 'failed' && job.errorCode === 'UPSTREAM_DNS_FAILED') return 'Не удалось найти адрес брокера · повторим подключение автоматически';
  if (job.status === 'failed' && job.errorCode === 'SNAPSHOT_POSITION_MISMATCH') return 'Брокер прислал разные составы позиций · повторно сверяем данные';
  if (job.status === 'failed') return ['UPSTREAM_TIMEOUT', 'UPSTREAM_UNAVAILABLE', 'READ_SESSION_EXPIRED'].includes(job.errorCode)
    ? 'Брокер не ответил вовремя · повторим обновление автоматически'
    : 'Не удалось завершить обновление · повторим автоматически';
  if (done(job.status)) return job.status === 'warning' ? 'Данные обновлены с ограничениями · подробности в журнале' : 'Обновление завершено';
  const stages = { waiting: 'Ждём завершения текущего этапа загрузки', connection: 'Проверяем соединение', snapshot: 'Обновляем позиции', download: 'Загружаем операции',
    operations: 'Загружаем операции', normalization: 'Проверяем операции', reconciliation: 'Сверяем данные', risk: 'Обновляем показатели риска',
    public_fx: 'Обновляем курсы валют', saved: 'Данные счёта сохранены', completed: 'Данные счёта сохранены' };
  const p = job.progress || {};
  const counted = Number.isInteger(p.totalAccounts) && p.totalAccounts > 0 && Number.isInteger(p.currentAccount)
    && p.currentAccount >= 1 && p.currentAccount <= p.totalAccounts;
  return `${stages[p.stage] || 'Обновляем данные'}${counted ? ` · счёт ${p.currentAccount} из ${p.totalAccounts}` : ''}`;
}

// Routine progress belongs in the refresh status and Sync screen. The global
// warning is reserved for a failed request or a genuinely overdue update.
export function syncWarningCopy(value, time = Date.now()) {
  if (value?.backgroundRefresh?.paused) return 'Фоновое обновление приостановлено: требуется восстановить вход или подключение';
  if (value?.transportError) return 'Не удалось проверить обновление · повторим автоматически';
  if (value?.viewError) return 'Данные сохранены · не удалось обновить показатели, повторим автоматически';
  const job = value?.active || value?.queued;
  if (job) {
    const started = Date.parse(job.startedAt || job.createdAt);
    return Number.isFinite(started) && time - started >= 60_000
      ? 'Обновление занимает больше минуты · показаны сохранённые данные' : '';
  }
  return value?.latest?.status === 'failed' ? syncProgressCopy(value.latest) : '';
}

// A long-running request is still running. Keep its delay visible without
// reporting a failed refresh or replacing the timestamp of displayed data.
export function syncRefreshPresentation(value, bootstrap, portfolioId = '', time = Date.now(), displayedAt = null) {
  const sourceFreshness = syncFreshnessCopy(bootstrap, portfolioId, time);
  const hasArrival = Number.isFinite(displayedAt);
  const freshness = hasArrival ? syncFreshnessCopy({portfolio:{currentAsOf:new Date(displayedAt).toISOString()}}, '', time) : sourceFreshness;
  const detail = syncWarningCopy(value, time);
  const busy = value?.active || value?.queued;
  const failed = value?.transportError || value?.viewError || !busy && value?.latest?.status === 'failed';
  return {
    state: failed ? 'error' : detail ? 'delayed' : busy || value?.applying ? 'updating' : 'ready',
    text: failed ? value?.viewError ? 'Не обновились показатели' : 'Ошибка обновления' : freshness,
    detail: [detail, detail ? freshness : '', hasArrival
      ? `Время обновления показателей на экране. Данные брокера: ${sourceFreshness.replace(/^Обновлено/u, 'получены').replace(/^Ожидаем/u, 'ожидаем')}.`
      : 'Возраст данных брокера. Новое обновление экрана ещё не получено.', value?.applying
      ? 'Готовим новые показатели. На экране пока предыдущие данные.'
      : busy ? syncProgressCopy(busy) : ''].filter(Boolean).join(' '),
  };
}

// Polling is independent of calendar/catalog hydration and survives view changes.
export function createSyncController({ request, getAccess, onState = () => {}, onChanged = async () => {},
  onComplete = () => {}, schedule = setTimeout, cancel = clearTimeout, now = Date.now }) {
  let timer = null, stopped = true, reading = false, epoch = 0, key = null, nextRefresh = 0, state = null, applied = null, scheduled = null, publishing = null, retryViewAt = 0;
  const manual = new Set();
  function planTick() {
    if (stopped) return;
    cancel(timer);
    const busy = state?.active || state?.queued || publishing;
    const due = retryViewAt || nextRefresh;
    timer = schedule(tick, busy ? 1000 : Math.max(250, Math.min(5000, due ? due - now() : 5000)));
  }
  function updateAccess() {
    const access = getAccess();
    if (access.key !== key) { key = access.key; epoch++; state = null; applied = null; scheduled = null; nextRefresh = 0; retryViewAt = 0; publishing = null; manual.clear(); onState(null); }
    return access;
  }
  async function begin(kind) {
    const access = updateAccess(), ticket = epoch;
    if (!access.allowed) return null;
    const result = await request(kind === 'sync' ? '/api/sync' : '/api/portfolio/refresh', {
      method: 'POST', body: JSON.stringify({ background: true }), signal: AbortSignal.timeout(25_000) });
    if (ticket !== epoch || stopped) return null;
    nextRefresh = Math.max(nextRefresh, now() + refreshInterval(state?.refreshIntervalMs));
    if (kind === 'sync') manual.add(result.job.id);
    state = { ...(state || {}), [result.job.status === 'queued' ? 'queued' : 'active']: result.job };
    onState(state); return result.job;
  }
  async function tick() {
    if (stopped || reading) return;
    const access = updateAccess();
    if (!access.allowed || !access.visible) { timer = schedule(tick, 3000); return; }
    const ticket = epoch; reading = true;
    try {
      // The runtime can check progress and admit the next due snapshot in one
      // authenticated round trip. A slow status read no longer needs a second
      // network/credential round trip before the next broker batch can start.
      const combined = state?.refreshPolling === true && (!state?.transportError || now() >= nextRefresh);
      const response = await request(combined ? '/api/portfolio/refresh' : '/api/sync/status', {
        ...(combined ? { method: 'POST', body: JSON.stringify({ background: true, includeStatus: true }) } : {}),
        signal: AbortSignal.timeout(25_000) });
      const result = combined ? response.syncStatus : response;
      if (!result || typeof result !== 'object') throw new Error('Invalid sync status');
      if (stopped || ticket !== epoch) return;
      state = {...result,applying:Boolean(publishing),viewError:Boolean(retryViewAt && state?.viewError)}; onState(state);
      const latest = result.latest;
      if (latest && done(latest.status) && latest.id !== scheduled) {
        scheduled = latest.id;
        const started = Date.parse(latest.startedAt || latest.completedAt);
        nextRefresh = latest.status === 'failed' ? now() + 30_000
          : (Number.isFinite(started) ? Math.min(now(), started) : now())
            + refreshInterval(result.refreshIntervalMs ?? latest.result?.nextRefreshAfterMs);
      }
      if (latest && latest.id !== applied && done(latest.status)) {
        if (latest.status === 'failed') { applied=latest.id;if(manual.delete(latest.id))onComplete(latest); }
        else if (!publishing && now() >= retryViewAt) {
          const token={};publishing=token;state.applying=true;onState(state);
          // Only one saved-data calculation can publish at a time. Broker
          // polling continues independently; intermediate completed jobs coalesce.
          Promise.resolve().then(onChanged).then(changed=>{
            if(stopped||ticket!==epoch||publishing!==token)return;
            if(changed===false){retryViewAt=now()+2000;return;}
            applied=latest.id;retryViewAt=0;state={...state,viewError:false};
            if(manual.delete(latest.id))onComplete(latest);
          }).catch(()=>{if(!stopped&&ticket===epoch){retryViewAt=now()+10_000;state={...state,viewError:true};}}).finally(()=>{
            if(publishing===token){publishing=null;if(!stopped&&ticket===epoch){state={...state,applying:false};onState(state);planTick();}}
          });
        }
      }
      if (!combined && !result.backgroundRefresh?.enabled && !result.active && !result.queued && now() >= nextRefresh) await begin('snapshot_refresh');
    } catch (error) { if (!stopped && ticket === epoch) { nextRefresh = now() + 30_000; state={ ...(state || {}), transportError: true, errorCode: error.code || 'SYNC_STATUS_UNAVAILABLE' }; onState(state); } }
    finally { reading = false; planTick(); }
  }
  return Object.freeze({ updateAccess, getState: () => state,
    async sync() { const job = await begin('sync'); cancel(timer); timer = schedule(tick, 200); return job; },
    start() { if (!stopped) return; stopped = false; void tick(); },
    stop() { stopped = true; epoch++; cancel(timer); timer = null; }, tick,
  });
}
