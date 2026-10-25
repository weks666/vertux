import {CONTEXT_EVIDENCE_VERSION, createContextEvidence} from './context-evidence.js';
import {readTradeGroupReview} from './trade-group-review.js';

// Adapters run only inside the existing accepted-report render path. They copy
// facts, not user credentials, native handles, account data from other modes,
// model prompts, or action permissions. No new cache outlives the parent view.
const at = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/u.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
const words = rows => [...new Set(rows.filter(value => typeof value === 'string' && value.length))];
const project = build => { try { return createContextEvidence(build()); } catch { return null; } };
const source = (id, label, asOf = null, receivedAt = null) => ({id, label, asOf: at(asOf), receivedAt: at(receivedAt)});
const fact = (id, label, value, unit, sourceRefs, period = null) => ({id, label, value: value ?? null, unit: unit || 'Не указана',
  state: value == null ? 'unknown' : 'known', sourceRefs, period: period || null});
const clock = (label, value) => ({label, at: at(value)});
const period = (label, from, to, convention) => ({label, from: at(from), to: at(to), convention});
const identity = instrument => ({key: instrument.instrumentUid, label: [instrument.ticker, instrument.name].filter(Boolean).join(' · ') || 'Выбранный инструмент'});
const base = (mode, intent, object, revision, dataMode, method) => ({version: CONTEXT_EVIDENCE_VERSION, mode, intent, object,
  revision: revision || null, dataMode, method, state: 'limited', timezone: 'Europe/Moscow', periods: [], clocks: [], sources: [], facts: [], limitations: [],
  freshness: 'Актуальность относительно текущего источника не подтверждена.', evidenceLocation: ''});
const metricFacts = rows => rows.map(metric => fact('metric:' + metric.key, metric.label || metric.key,
  metric.status && metric.status !== 'available' ? null : metric.value, metric.unit, [...(metric.sourceIds || [])], metric.period));
const metricSources = rows => rows.map(row => source(row.id, row.title || 'Источник показателя', row.asOf, row.retrievedAt));
const issuerLimits = ['Периоды и единицы относятся к каждому показателю отдельно. Сопоставимость разных отчётных периодов не подтверждена.',
  'Время получения не заменяет отчётную дату. История отчётности, сравнение с аналогами и причины изменений требуют отдельных данных.'];

export function buildCompanyContextEvidence(report, instrument = report?.instrument) {
  return project(() => {
    const saved = report.contractVersion === 'saved-instrument-facts-v1';
    if (!saved && report.claimContract !== 'company-claims-v1') throw new TypeError('Company contract unavailable');
    if (report.instrument && report.instrument.instrumentUid !== instrument?.instrumentUid) throw new TypeError('Company context mismatch');
    const data = base('instrument', saved ? 'instrument.saved-facts' : 'instrument.company-claims', identity(instrument), report.sourceDigest,
      report.cacheState === 'synthetic' ? 'synthetic' : 'public', {kind: saved ? 'saved-source' : 'validated-public-claims',
        label: saved ? 'Чтение сохранённых фактов; AI-модель не используется.' : 'Выбор утверждений из проверяемого набора публичных фактов; основания каждого вывода доступны рядом с ним.'});
    data.periods = [period('Период', null, null, 'Указан у каждого показателя; общей подтверждённой отчётной границы нет.')];
    data.clocks = [clock('Отчётная дата источника', report.dataAsOf), clock('Получены показатели', report.receivedAt),
      clock('Получены сведения об инструменте', report.metadataReceivedAt), clock(saved ? 'Срез прочитан' : 'Разбор сформирован', report.generatedAt)];
    data.sources = metricSources(report.sources || []);
    data.facts = metricFacts(report.metrics || report.facts || []);
    data.freshness = report.cacheState === 'synthetic' ? 'Учебный срез; текущий рынок не подтверждается.'
      : report.cacheState === 'stale' ? 'Сохранённые сведения могут быть устаревшими.' : data.freshness;
    data.limitations = words([...issuerLimits, ...(report.limitations || [])]);
    data.evidenceLocation = saved ? 'Точное значение, единица и источник открываются у показателя.' : '«На чём основано» рядом с выводом связывают его с точными фактами. Показатели и источники доступны ниже.';
    return data;
  });
}

export function buildNewsContextEvidence(report, row, {fixture = false, receivedAt = null} = {}) {
  return project(() => {
    if (report.analysis?.claimContract !== 'news-claims-v1' || report.newsId !== row.id
      || row.analysisVersion !== undefined && report.analysisVersion !== row.analysisVersion) throw new TypeError('News context mismatch');
    const data = base('news', 'news.source-analysis', {key: row.id, label: row.title}, report.analysisVersion,
      fixture ? 'synthetic' : 'public', {kind: 'validated-public-claims', label: 'Проверяемые утверждения по тексту источника, связям компаний и справочнику событий. Признак «В портфеле» добавляется локально.'});
    data.periods = [period('Период', null, null, 'Выбрана отдельная публикация. Дата сообщения не подтверждает время события или первичной публикации.')];
    data.clocks = [clock('Время сообщения поставщика', row.at), clock('Получен список публикаций', receivedAt), clock('Разбор сформирован', report.generatedAt)];
    data.sources = [source('publication', row.source || 'Источник публикации', null, receivedAt),
      ...(report.historicalCases || []).map(item => source('event:' + item.id, item.source || item.title))];
    data.facts = [fact('title', 'Заголовок', row.title, 'Текст', ['publication']),
      ...(row.summary ? [fact('summary', 'Использованный фрагмент', row.summary.slice(0, 4000), 'Текст', ['publication'])] : []),
      ...(report.companies || []).map(item => fact('relation:' + item.ticker, 'Основание связи · ' + item.ticker, item.reason, 'Текст', ['publication'])),
      ...(report.historicalCases || []).map(item => fact('event:' + item.id, item.title, item.fact, 'Текст', ['event:' + item.id]))];
    data.limitations = words(['Сообщение источника не является подтверждением истинности события. Условный сценарий не является прогнозом.',
      'Тематическая связь с компанией и наличие бумаги в портфеле не доказывают финансовый эффект. Сравнение событий не устанавливает причинность движения цены.',
      ...(row.summary?.length > 4000 ? ['В разборе использованы первые 4000 символов загруженного фрагмента.'] : []), ...(report.limitations || [])]);
    data.evidenceLocation = '«На чём основано» рядом с текстом открывают использованный фрагмент, связь или событие. Ссылка на публикацию остаётся в её заголовке.';
    return data;
  });
}

export function buildPortfolioContextEvidence(report, accountLabel) {
  return project(() => {
    if (report.contractVersion !== 'local-result-explanation-v1' || report.intent !== 'portfolio.result-components') throw new TypeError('Result contract unavailable');
    const data = base('portfolio', report.intent, {key: report.scope.portfolioId, label: accountLabel || 'Выбранный счёт'}, report.packetId,
      report.sourceLabel === 'Учебные данные' ? 'synthetic' : 'local', {kind: 'local-calculation', label: 'Объяснение готового локального расчёта по фиксированной формуле; AI-модель не используется.'});
    data.periods = [period('Выбранный период', report.period.requestedFrom, report.period.requestedTo, 'Границы запроса пользователя.'),
      period('Наблюдаемый интервал', report.period.observedFrom, report.period.observedTo, 'Денежные потоки после начального и до конечного наблюдения включительно: (начало, конец].')];
    data.clocks = [clock('Последнее наблюдение', report.freshness.asOf)];
    data.sources = [source('saved-calculation', report.sourceLabel)];
    data.facts = [...report.basis.map(row => fact('basis:' + row.factRef, ({'opening-nav': 'Начальная оценка', 'closing-nav': 'Конечная оценка', 'owner-flow-total': 'Внешний поток'})[row.factRef] || 'Основание расчёта', row.valueNanos, 'RUB-nanos', ['saved-calculation'])),
      ...report.summary.map(row => fact('result:' + row.claimId, row.title, row.valueNanos, row.unit, ['saved-calculation']))];
    data.freshness = report.freshness.reason;
    data.limitations = words([report.limitation, report.observation, report.componentScope,
      ...(report.period.partialPeriod ? ['Наблюдения покрывают только часть выбранного периода.'] : []), ...report.gaps.map(row => row.reason)]);
    data.evidenceLocation = '«Открыть подтверждение» у суммы и «Открыть эту запись» у операции перепроверяют тот же расчёт. Частные данные остаются в локальном приложении.';
    return data;
  });
}

export function buildTradingContextEvidence(dto, account, review = null) {
  return project(() => {
    if (dto.version !== 'trade-episodes-v1' || account?.id !== dto.scope?.portfolioId || dto.scope.currency !== 'RUB') throw new TypeError('Episode context mismatch');
    const data = base('trading', 'trading.position-episodes', {key: account.id, label: account.label || 'Выбранный счёт'}, dto.calculationSnapshotId,
      dto.evidence?.dataMode === 'synthetic' ? 'synthetic' : 'local', {kind: 'local-calculation', label: 'Локальное восстановление эпизодов и описательная статистика по сохранённым записям; AI-модель не используется.'});
    data.periods = [period('Выбранный период', dto.requestedPeriod.from, dto.requestedPeriod.to, 'Закрытые эпизоды отбираются по окончательному закрытию. Открытые позиции показаны на конец периода.'),
      period('Исходная история', dto.sourceHistory?.from, dto.sourceHistory?.to, 'Более ранние записи служат контекстом исходной позиции; полнота истории отдельно не подтверждена.')];
    data.clocks = [clock('Конец выбранного периода', dto.cutoff)];
    data.sources = [source('saved-executions', 'Сохранённые исполнения, комиссии и наблюдения количества')];
    const valid = dto.statistics?.state === 'ready' && dto.statistics.calculationSnapshotId === dto.calculationSnapshotId;
    data.facts = [fact('eligible', 'Включено закрытых эпизодов', dto.coverage?.closedEligible, 'Эпизоды', ['saved-executions']),
      fact('incomplete', 'Неполные участки', dto.coverage?.incomplete, 'Участки', ['saved-executions']),
      fact('net', 'Результат после учтённых комиссий', valid ? dto.statistics.sumNetNanos : null, 'RUB-nanos', ['saved-executions'])];
    if (dto.state === 'unavailable') data.state = 'unsupported';
    data.limitations = words(['Исполнения не равны независимым эпизодам. Фиксированные группы описывают сохранённую выборку; устойчивость результата и будущая прибыль не установлены.',
      'Учитываются подтверждённые комиссии исполнений; налоги и нераспределённые расходы не становятся известными нулевыми затратами.',
      ...[...(dto.reasons || []), ...(dto.costReasons || []), ...(dto.cohortReasons || [])].map(row => row.message)]);
    data.evidenceLocation = 'Откройте группу, эпизод и его исполнения: там сохранены точные количества, FIFO и причины исключения. Частная история остаётся локальной.';
    if (review) {
      const cohort = dto.cohorts?.find(row => row.dimension === review.dimension && row.bucket === review.bucket);
      if (readTradeGroupReview(dto, cohort, account.id) !== review) throw new TypeError('Group review context mismatch');
      data.intent = 'trading.group-review';
      data.object = {key: `${account.id}:${review.dimension}:${review.bucket}`, label: `${account.label || 'Выбранный счёт'} · выбранная группа эпизодов`};
      data.method.label = 'Локальный описательный разбор группы, сравнение с остальными эпизодами и исключение одного наибольшего результата по модулю. AI-модель не используется.';
      data.facts = [fact('group-count', 'Эпизодов в группе', review.group.n, 'Эпизоды', ['saved-executions']),
        fact('group-net', 'Результат группы', review.group.netNanos, 'RUB-nanos', ['saved-executions']),
        fact('group-gross', 'Изменение цен в группе', review.group.grossNanos, 'RUB-nanos', ['saved-executions']),
        fact('group-costs', 'Комиссии группы со знаком', review.group.costsNanos, 'RUB-nanos', ['saved-executions']),
        fact('baseline-count', 'Остальных эпизодов', review.baseline.n, 'Эпизоды', ['saved-executions']),
        fact('baseline-net', 'Результат остальных', review.baseline.netNanos, 'RUB-nanos', ['saved-executions']),
        fact('retained-net', 'Результат группы без одного эпизода', review.sensitivity.retained.netNanos, 'RUB-nanos', ['saved-executions'])];
      data.limitations.push('Сравнение не выравнивает размеры позиций и рыночные условия; независимость выборки, контрольная выборка и устойчивость не подтверждены.');
      data.evidenceLocation = 'В «Разборе группы» откройте выбранную группу, остальные эпизоды или проверку без одной записи; затем эпизод → исполнения. Все переходы используют этот расчёт.';
    }
    return data;
  });
}

export function buildResearchContextEvidence(snapshot, {createdAt = null, revision = null, draft = false} = {}) {
  return project(() => {
    const data = base('research', 'research.note-facts', identity(snapshot.instrument), revision,
      snapshot.cacheState === 'synthetic' ? 'synthetic' : 'local', {kind: 'user-note',
        label: draft ? 'Черновик вашей заметки по сохранённым фактам. В заметку войдут только выбранные показатели.' : 'Ваша заметка с сохранёнными фактами. Наблюдение автора не проверяется и не выдаётся за вывод модели.'});
    data.periods = [period('Период', null, null, 'Указан у каждого выбранного показателя. Заметка сохраняет срез и не обновляет его вслед за источником.')];
    data.clocks = [clock('Отчётная дата источника', snapshot.dataAsOf), clock('Получены показатели', snapshot.receivedAt),
      clock('Получены сведения об инструменте', snapshot.metadataReceivedAt), ...(draft ? [] : [clock('Заметка сохранена', createdAt)])];
    data.sources = metricSources(snapshot.sources);
    data.facts = metricFacts(snapshot.metrics);
    data.freshness = snapshot.cacheState === 'synthetic' ? 'Учебный срез.' : 'Текущее состояние источника по сохранённой заметке не подтверждено.';
    data.limitations = words([...issuerLimits, 'Вопрос и собственное наблюдение не являются подтверждёнными фактами или рекомендацией.', ...snapshot.limitations]);
    data.evidenceLocation = 'Выбранные факты и «Источники и ограничения среза» доступны в этой заметке. Её текст и история хранятся локально.';
    return data;
  });
}

export function buildTerminalContextEvidence(report, capturedAt) {
  return project(() => {
    if (report.contractVersion !== 'terminal-study-explanation-v1') throw new TypeError('Study contract unavailable');
    const series = report.series, rows = report.study?.type === 'sma' ? report.window : report.trace;
    const data = base('terminal', 'terminal.indicator-method', {key: series.context.instrumentUid,
      label: [series.instrument.ticker, series.instrument.name, report.study ? report.study.type.toUpperCase() + ' ' + report.study.period : null].filter(Boolean).join(' · ') || 'Выбранная серия'}, capturedAt,
      series.source.dataMode === 'synthetic' ? 'synthetic' : series.source.dataMode === 'public-crypto' ? 'public' : 'local', {kind: 'local-calculation', label: 'Локальный расчёт индикатора из зафиксированных цен; AI-модель не используется.'});
    data.timezone = series.method.timezone;
    data.periods = [period('Ряд для расчёта', rows?.[0]?.at, report.pointAt,
      (report.study?.type === 'sma' ? 'Окно выбранной средней.' : 'От начала загруженной истории до выбранной точки, включая прогрев.') + ' Интервал: ' + series.method.displayLabel + '.' )];
    data.clocks = [clock('Начало выбранной свечи', report.pointAt), clock('Получен ответ с ценами', series.source.receivedAt), clock('Расчёт зафиксирован', capturedAt),
      ...(series.replay.active ? [clock('Курсор воспроизведения', series.replay.cursorTime)] : [])];
    data.sources = [source('captured-series', series.source.label || 'Загруженная серия', null, series.source.receivedAt)];
    data.facts = [fact('indicator-value', 'Значение выбранной точки', report.state === 'ready' ? report.value : null, report.unit, ['captured-series']),
      fact('loaded-bars', 'Цен в истории расчёта', report.history?.loadedBars, 'Свечи', ['captured-series'])];
    if (report.state !== 'ready') data.state = 'unsupported';
    data.limitations = words([report.reason, ...(report.limits || []), ...series.limits]);
    data.evidenceLocation = '«Цены в расчёте» или «Цены и шаги» открывают точные входные цены и последовательность. Выбор точки использует этот снимок и не перемещает график.';
    return data;
  });
}
