import { money } from './number-format.js';
let presentation = { language: 'ru', displayCurrency: 'RUB', rates: {} };
export function setChartPresentation(value) {
  presentation = { ...presentation, ...value };
  chartTheme.localization.locale = presentation.language === 'en' ? 'en-US' : 'ru-RU';
}
const chartTheme = {
  layout: {
    background: { type: 'solid', color: '#0d141e' },
    textColor: '#9daeca',
    fontFamily: 'Rubik, system-ui, sans-serif',
    fontSize: 12,
    attributionLogo: false,
  },
  grid: {
    vertLines: { color: 'rgba(149,172,204,.055)' },
    horzLines: { color: 'rgba(149,172,204,.14)', style: 2 },
  },
  rightPriceScale: { borderColor: 'rgba(149,172,204,.12)' },
  timeScale: { borderColor: 'rgba(149,172,204,.12)', timeVisible: true, secondsVisible: false, tickMarkFormatter: formatMarketTick },
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
    if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
    const visible = chart.timeScale().getVisibleRange();
    const dimensions = { width: Math.max(1, Math.floor(entry.contentRect.width)) };
    if (entry.contentRect.height > 0) dimensions.height = Math.floor(entry.contentRect.height);
    chart.applyOptions(dimensions);
    if (visible) chart.timeScale().setVisibleRange(visible);
  });
  observer.observe(host);
  return observer;
}

function normalizeTime(value) {
  if(value==null || value==='' || typeof value==='boolean')return NaN;
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

export function formatMarketTick(time, tickMarkType) {
  const options=tickMarkType===0?{year:'numeric'}:tickMarkType===1?{month:'short'}:tickMarkType===2?{day:'numeric',month:'short'}:{hour:'2-digit',minute:'2-digit',...(tickMarkType===4?{second:'2-digit'}:{})};
  return new Intl.DateTimeFormat(presentation.language,{timeZone:'Europe/Moscow',...options}).format(chartDate(time));
}

function formatChartNumber(value) {
  return new Intl.NumberFormat(presentation.language, { maximumFractionDigits: 2 }).format(value);
}

function formatChartRubles(value) {
  if (!Number.isFinite(value)) return '—';
  return money(BigInt(Math.round(value * 1e9)).toString(), 'RUB', { locale: presentation.language, target: presentation.displayCurrency, rates: presentation.rates });
}

function formatChartPercentage(value) {
  if (Math.abs(value) < 0.005) return '0%';
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat(presentation.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function historyTimeScale() {
  return { ...chartTheme.timeScale, timeVisible: false, minBarSpacing: 0.01, fixLeftEdge: true, fixRightEdge: true, rightOffset: 0,
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
  const baseline = green && Boolean(api.BaselineSeries);
  const series = chart.addSeries(baseline ? api.BaselineSeries : api.AreaSeries, {
    lineColor: green ? '#5ed0a0' : '#8c73ff',
    topColor: green ? 'rgba(94,208,160,.28)' : 'rgba(124,92,255,.24)',
    bottomColor: green ? 'rgba(94,208,160,0)' : 'rgba(124,92,255,0)',
    ...(baseline ? { baseValue: { type: 'price', price: mode === 'percent' ? 0 : values[0].value },
      topLineColor: '#8c73ff', topFillColor1: 'rgba(140,115,255,.20)', topFillColor2: 'rgba(140,115,255,.025)',
      bottomLineColor: '#ef7b76', bottomFillColor1: 'rgba(239,123,118,.025)', bottomFillColor2: 'rgba(239,123,118,.22)' } : {}),
    lineWidth: 2, pointMarkersVisible: values.length <= 7, pointMarkersRadius: 3,
    priceLineVisible: false,
    priceFormat: { type: 'custom', minMove: 0.01, formatter: formatter() },
    autoscaleInfoProvider: (original) => {
      const base = original();
      if (green && mode === 'percent' && base?.priceRange) {
        const low = Math.min(0, base.priceRange.minValue), high = Math.max(0, base.priceRange.maxValue);
        const padding = Math.max((high - low) * .08, .1);
        return { ...base, priceRange: { minValue: low - padding, maxValue: high + padding } };
      }
      if (!values.length || !values.every((point) => point.value === values[0].value)) return base;
      const padding = Math.max(Math.abs(values[0].value) * 0.01, mode === 'percent' ? 0.1 : 100);
      return { ...base, priceRange: { minValue: values[0].value - padding, maxValue: values[0].value + padding } };
    },
  });
  const zeroLine = green ? series.createPriceLine({ price: 0, color: 'rgba(185,169,255,.6)', lineWidth: 1,
    lineStyle: 2, lineVisible: mode === 'percent', axisLabelVisible: false, title: '' }) : null;
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
      const relative = mode === 'percent' ? nearest.value : nearest.value - (values[0]?.value ?? nearest.value);
      axisValue.applyOptions({ price: nearest.value, axisLabelVisible: true, color: green ? relative < 0 ? '#b63e55' : relative > 0 ? '#237d64' : '#526078' : '#5d48cf' });
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
    series.applyOptions({ pointMarkersVisible: values.length <= 7, priceFormat: { type: 'custom', minMove: 0.01, formatter: formatter() } });
    if (baseline) series.applyOptions({ baseValue: { type: 'price', price: mode === 'percent' ? 0 : values[0]?.value || 0 } });
    zeroLine?.applyOptions({ lineVisible: mode === 'percent', axisLabelVisible: false });
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
  const theme = () => {
    const css = typeof getComputedStyle === 'function' ? getComputedStyle(host) : null;
    const color = (name, fallback) => css?.getPropertyValue(name).trim() || fallback;
    const background = color('--surface', '#0d141e'), text = color('--muted', '#9daeca'), line = color('--line', '#233044');
    const accent = color('--vertux-soft', '#8c73ff'), negative = color('--negative', '#ef7b76');
    chart.applyOptions({ layout: { background: { type:'solid', color:background }, textColor:text },
      grid: { vertLines:{color:line}, horzLines:{color:line} }, rightPriceScale:{borderColor:line}, timeScale:{borderColor:line},
      crosshair:{vertLine:{color:accent,labelBackgroundColor:color('--action-fill','#5d48cf')}} });
    series.applyOptions(baseline ? {topLineColor:accent,bottomLineColor:negative} : {lineColor:accent});
  };
  const themeObserver = typeof MutationObserver === 'function' ? new MutationObserver(theme) : null;
  themeObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-workspace-theme']});theme();
  return { chart, series, setData, destroy() { observer.disconnect(); themeObserver?.disconnect(); chart.unsubscribeCrosshairMove(onCrosshair); chart.remove(); } };
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

export { createMarketChart } from './market-chart.js';

export function createAnalyticsReturnChart(host, points, period, options = {}) {
  let mode = options.mode || 'percent';
  const convert = rows => normalizeEquityPoints((Array.isArray(rows) ? rows : []).map(point => ({ time: point?.time,
    value: mode === 'rubles' ? point?.equityValue : typeof point?.netReturnRate === 'number' ? point.netReturnRate * 100 : null })));
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
