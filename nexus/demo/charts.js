import { money } from './number-format.js';
let presentation = { language: 'ru', displayCurrency: 'RUB', rates: {} };
export function setChartPresentation(value) {
  presentation = { ...presentation, ...value };
  chartTheme.localization.locale = presentation.language === 'en' ? 'en-US' : 'ru-RU';
}
const chartTheme = {
  layout: {
    background: { type: 'solid', color: '#111319' },
    textColor: '#8f9199',
    fontFamily: 'Rubik, system-ui, sans-serif',
    fontSize: 13,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,.035)' },
    horzLines: { color: 'rgba(255,255,255,.035)' },
  },
  rightPriceScale: { borderColor: 'rgba(255,255,255,.09)' },
  timeScale: { borderColor: 'rgba(255,255,255,.09)', timeVisible: true, secondsVisible: false },
  localization: { locale: 'ru-RU', timeFormatter: formatChartTime, priceFormatter: formatChartNumber },
  crosshair: {
    vertLine: { color: 'rgba(185,169,255,.45)', labelBackgroundColor: '#5d48cf' },
    horzLine: { color: 'rgba(185,169,255,.45)', labelBackgroundColor: '#5d48cf' },
  },
};

function chartApi() {
  return globalThis.LightweightCharts || null;
}

function observeResize(host, chart) {
  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const dimensions = { width: Math.max(1, Math.floor(entry.contentRect.width)) };
    if (entry.contentRect.height > 0) dimensions.height = Math.floor(entry.contentRect.height);
    chart.applyOptions(dimensions);
  });
  observer.observe(host);
  return observer;
}

function normalizeTime(value) {
  return typeof value === 'number' ? Math.floor(value) : Math.floor(new Date(value).getTime() / 1000);
}

function chartDate(time) {
  if (typeof time === 'number') return new Date(time * 1000);
  if (time && typeof time === 'object') return new Date(Date.UTC(time.year, time.month - 1, time.day, 12));
  return new Date(time);
}

function formatChartTime(time) {
  return `${new Intl.DateTimeFormat(presentation.language, { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(chartDate(time))} ${presentation.language==='en'?'MSK':'мск'}`;
}

function formatChartNumber(value) {
  return new Intl.NumberFormat(presentation.language, { maximumFractionDigits: 2 }).format(value);
}

function formatChartRubles(value) {
  if (!Number.isFinite(value)) return '—';
  return money(BigInt(Math.round(value * 1e9)).toString(), 'RUB', { locale: presentation.language, target: presentation.displayCurrency, rates: presentation.rates });
}

function formatChartPercentage(value) {
  return `${value >= 0 ? '+' : ''}${new Intl.NumberFormat(presentation.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function historyTimeScale() {
  return { ...chartTheme.timeScale, timeVisible: false, minBarSpacing: 0.01,
    tickMarkFormatter: (time, tickMarkType) => new Intl.DateTimeFormat(presentation.language, { timeZone: 'Europe/Moscow',
      ...(tickMarkType === 0 ? { year: 'numeric' } : tickMarkType === 1 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' }) }).format(chartDate(time)) };
}

export function normalizeEquityPoints(points) {
  const byTime = new Map();
  for (const point of Array.isArray(points) ? points : []) {
    const time = normalizeTime(point?.time);
    if (point?.time && Number.isFinite(time) && typeof point.value === 'number' && Number.isFinite(point.value)) byTime.set(time, { ...point, time });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function chartDataForPeriod(points, period) {
  const from = normalizeTime(period?.from);
  const to = normalizeTime(period?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return points;
  const byTime = new Map(points.filter((point) => point.time >= from && point.time <= to).map((point) => [point.time, point]));
  // Calendar whitespace fixes the requested range without inventing historical prices.
  const step = 86400 * Math.max(1, Math.ceil((to - from) / 86400 / 10000));
  for (let time = from; time < to; time += step) if (!byTime.has(time)) byTime.set(time, { time });
  if (!byTime.has(to)) byTime.set(to, { time: to });
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function showSelectedPeriod(chart, period) {
  const from = normalizeTime(period?.from);
  const to = normalizeTime(period?.to);
  if (Number.isFinite(from) && Number.isFinite(to) && from < to) chart.timeScale().setVisibleRange({ from, to });
  else chart.timeScale().fitContent();
}

// Use only the horizontal cursor position to choose an actual observation.
// Calendar gaps never manufacture valuations from the cursor's vertical position.
export function nearestObservation(values, at) {
  if (!values.length || !Number.isFinite(at)) return null;
  let left = 0, right = values.length;
  while (left < right) {
    const middle = (left + right) >>> 1;
    if (values[middle].time < at) left = middle + 1;
    else right = middle;
  }
  const before = values[Math.max(0, left - 1)], after = values[Math.min(values.length - 1, left)];
  return at - before.time <= after.time - at ? before : after;
}

function selectionKey(period, scope) {
  return `${scope || ''}|${period?.period || 'custom'}|${!period?.period || period.period === 'custom' ? `${period?.from}|${period?.to}` : ''}`;
}

function createRecordedChart(host, initialValues, period, { mode = 'rubles', scope = '', green = false } = {}) {
  const api = chartApi();
  if (!api || !host || !initialValues.length) return null;
  let values = initialValues, timeline = [], selected = selectionKey(period, scope), movingCrosshair = false;
  const formatter = () => mode === 'percent' ? formatChartPercentage : formatChartRubles;
  const chart = api.createChart(host, { ...chartTheme, height: host.clientHeight || 280,
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    timeScale: historyTimeScale(), crosshair: { ...chartTheme.crosshair, horzLine: { visible: false, labelVisible: false } },
    localization: { ...chartTheme.localization, priceFormatter: formatter() } });
  const series = chart.addSeries(api.AreaSeries, {
    lineColor: green ? '#5ed0a0' : '#8c73ff',
    topColor: green ? 'rgba(94,208,160,.28)' : 'rgba(124,92,255,.24)',
    bottomColor: green ? 'rgba(94,208,160,0)' : 'rgba(124,92,255,0)',
    lineWidth: 2, pointMarkersVisible: values.length <= 90, pointMarkersRadius: 4,
    priceLineVisible: false,
    priceFormat: { type: 'custom', minMove: 0.01, formatter: formatter() },
    autoscaleInfoProvider: (original) => {
      const base = original();
      if (!values.length || !values.every((point) => point.value === values[0].value)) return base;
      const padding = Math.max(Math.abs(values[0].value) * 0.01, mode === 'percent' ? 0.1 : 100);
      return { ...base, priceRange: { minValue: values[0].value - padding, maxValue: values[0].value + padding } };
    },
  });
  const axisValue = series.createPriceLine({ price: values[0].value, color: green ? '#2b8565' : '#5d48cf',
    lineVisible: false, axisLabelVisible: false, title: '' });
  const clearHover = () => { axisValue.applyOptions({ axisLabelVisible: false }); series.applyOptions({ lastValueVisible: true }); };
  const onCrosshair = param => {
    if (movingCrosshair) return;
    // Applying a series/axis option also emits a crosshair update in LWC.
    // Guard the complete update, including clearing a hover on pointer exit.
    movingCrosshair = true;
    try {
      if (!param.point || param.point.x < 0 || param.point.y < 0) { clearHover(); return; }
      const logical = chart.timeScale().coordinateToLogical(param.point.x);
      const time = logical == null ? normalizeTime(param.time) : timeline[Math.max(0, Math.min(timeline.length - 1, Math.round(logical)))]?.time;
      const nearest = nearestObservation(values, time);
      if (!nearest) { clearHover(); return; }
      axisValue.applyOptions({ price: nearest.value, axisLabelVisible: true });
      series.applyOptions({ lastValueVisible: false });
      chart.setCrosshairPosition(nearest.value, nearest.time, series);
    } finally { movingCrosshair = false; }
  };
  chart.subscribeCrosshairMove(onCrosshair);
  const setData = (nextValues, nextPeriod = period, options = {}) => {
    const key = selectionKey(nextPeriod, options.scope ?? scope);
    const visible = chart.timeScale().getVisibleRange();
    mode = options.mode || mode; scope = options.scope ?? scope; period = nextPeriod;
    timeline = chartDataForPeriod(nextValues.map(({ time, value }) => ({ time, value })), period);
    values = timeline.filter(point => typeof point.value === 'number');
    clearHover();
    series.applyOptions({ pointMarkersVisible: values.length <= 90, priceFormat: { type: 'custom', minMove: 0.01, formatter: formatter() } });
    chart.applyOptions({ localization: { ...chartTheme.localization, priceFormatter: formatter() } });
    series.setData(values.length ? timeline : []);
    if (values.length) {
      if (visible && selected === key) chart.timeScale().setVisibleRange(visible);
      else showSelectedPeriod(chart, period);
    }
    selected = key;
  };
  setData(values, period);
  const observer = observeResize(host, chart);
  return { chart, series, setData, destroy() { observer.disconnect(); chart.unsubscribeCrosshairMove(onCrosshair); chart.remove(); } };
}

export function createEquityChart(host, points, period, scope = '') {
  const values = normalizeEquityPoints(points);
  if (values.length < 2) return null;
  const view = createRecordedChart(host, values, period, { scope });
  if (!view) return null;
  const update = view.setData;
  view.setData = (nextPoints, nextPeriod = period, nextScope = scope) => update(normalizeEquityPoints(nextPoints), nextPeriod, { scope: nextScope });
  return view;
}

function movingAverage(data, length, exponential = false) {
  const output = [];
  let ema = null;
  const multiplier = 2 / (length + 1);
  for (let index = 0; index < data.length; index += 1) {
    if (exponential) {
      ema = ema === null ? data[index].close : data[index].close * multiplier + ema * (1 - multiplier);
      if (index >= length - 1) output.push({ time: data[index].time, value: ema });
    } else if (index >= length - 1) {
      const window = data.slice(index - length + 1, index + 1);
      output.push({ time: data[index].time, value: window.reduce((sum, row) => sum + row.close, 0) / length });
    }
  }
  return output;
}

// SQLite keeps source revisions. Charts require one ordered bar per timestamp
// and a single interval; prefer the newest captured revision, including corrections.
export function normalizeMarketCandles(candles, interval) {
  const rows = Array.isArray(candles) ? candles : [];
  const chosen = interval || (rows.some(row => /DAY/i.test(row.interval || '')) ? rows.find(row => /DAY/i.test(row.interval || '')).interval : rows.at(-1)?.interval);
  const byTime = new Map();
  for (const row of rows) {
    if (chosen && row.interval && row.interval !== chosen) continue;
    const time = normalizeTime(row.time);
    if (!Number.isFinite(time) || !['open','high','low','close'].every(key => typeof row[key] === 'number' && Number.isFinite(row[key]))
      || row.high < Math.max(row.open, row.close, row.low) || row.low > Math.min(row.open, row.close, row.high)) continue;
    const prior = byTime.get(time);
    if (prior && Date.parse(prior.capturedAt || '') > Date.parse(row.capturedAt || '')) continue;
    byTime.set(time, { ...row, time, volume: typeof row.volume === 'number' && Number.isFinite(row.volume) && row.volume >= 0 ? row.volume : 0 });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export function createMarketChart(host, candles) {
  const api = chartApi();
  const normalized = normalizeMarketCandles(candles);
  if (!api || !host || !normalized.length) return null;
  const chart = api.createChart(host, { ...chartTheme, height: host.clientHeight || 480 });
  const candleSeries = chart.addSeries(api.CandlestickSeries, {
    upColor: '#5ed0a0', downColor: '#ef7b76', borderVisible: false,
    wickUpColor: '#5ed0a0', wickDownColor: '#ef7b76',
  });
  const volumeSeries = chart.addSeries(api.HistogramSeries, {
    priceFormat: { type: 'volume' }, priceScaleId: '',
  });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: .78, bottom: 0 } });
  candleSeries.setData(normalized.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  volumeSeries.setData(normalized.map((row) => ({ time: row.time, value: row.volume, color: row.close >= row.open ? 'rgba(94,208,160,.32)' : 'rgba(239,123,118,.32)' })));

  const smaSeries = chart.addSeries(api.LineSeries, { color: '#b9a9ff', lineWidth: 1, priceLineVisible: false, visible: false });
  const emaSeries = chart.addSeries(api.LineSeries, { color: '#e1b264', lineWidth: 1, priceLineVisible: false, visible: false });
  smaSeries.setData(movingAverage(normalized, Math.min(20, Math.max(2, Math.floor(normalized.length / 3)))));
  emaSeries.setData(movingAverage(normalized, Math.min(20, Math.max(2, Math.floor(normalized.length / 3))), true));
  chart.timeScale().fitContent();

  const drawings = [];
  let trendStart = null;
  let drawingMode = null;
  const clickHandler = (param) => {
    if (!drawingMode || !param.time || !param.point) return;
    const price = candleSeries.coordinateToPrice(param.point.y);
    if (price === null) return;
    if (drawingMode === 'horizontal') {
      drawings.push(candleSeries.createPriceLine({ price, color: '#b9a9ff', lineWidth: 1, axisLabelVisible: true, title: 'Уровень' }));
      drawingMode = null;
    } else if (drawingMode === 'trend' && !trendStart) {
      trendStart = { time: param.time, value: price };
    } else if (drawingMode === 'trend') {
      const series = chart.addSeries(api.LineSeries, { color: '#e1b264', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
      if (param.time === trendStart.time) { chart.removeSeries(series); return; }
      series.setData([trendStart, { time: param.time, value: price }].sort((a, b) => Number(a.time) - Number(b.time)));
      drawings.push(series);
      trendStart = null;
      drawingMode = null;
    }
  };
  chart.subscribeClick(clickHandler);
  const observer = observeResize(host, chart);

  return {
    chart,
    updateCandle(row) {
      const normalizedRow = { time: normalizeTime(row.time), open: row.open, high: row.high, low: row.low, close: row.close };
      if (!normalizeMarketCandles([row]).length || normalizedRow.time < (normalized.at(-1)?.time ?? -Infinity)) return;
      if (normalizedRow.time === normalized.at(-1)?.time) normalized[normalized.length - 1] = { ...row, ...normalizedRow };
      else normalized.push({ ...row, ...normalizedRow });
      candleSeries.update(normalizedRow);
      volumeSeries.update({ time: normalizedRow.time, value: row.volume, color: row.close >= row.open ? 'rgba(94,208,160,.32)' : 'rgba(239,123,118,.32)' });
    },
    toggle(name, visible) {
      if (name === 'candles') candleSeries.applyOptions({ visible });
      if (name === 'volume') volumeSeries.applyOptions({ visible });
      if (name === 'sma') smaSeries.applyOptions({ visible });
      if (name === 'ema') emaSeries.applyOptions({ visible });
    },
    beginDrawing(mode) { drawingMode = mode; trendStart = null; },
    destroy() { observer.disconnect(); chart.unsubscribeClick(clickHandler); chart.remove(); },
  };
}

export function createAnalyticsReturnChart(host, points, period, options = {}) {
  let mode = options.mode || 'percent';
  const convert = rows => normalizeEquityPoints((Array.isArray(rows) ? rows : []).map(point => ({ time: point?.time,
    value: mode === 'rubles' ? point?.equityValue : typeof point?.capitalChangeRate === 'number' ? point.capitalChangeRate * 100 : null })));
  const view = createRecordedChart(host, convert(points), period, { ...options, mode, green: true });
  if (!view) return null;
  const update = view.setData;
  return { ...view, returnSeries: view.series, volumeSeries: null,
    setData(newPoints, newPeriod = period, nextOptions = {}) {
      mode = nextOptions.mode || mode;
      update(convert(newPoints), newPeriod, { ...nextOptions, mode });
    },
  };
}
