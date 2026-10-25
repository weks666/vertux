import { decimalNanos } from './number-format.js';
import { CONCENTRATION_FX_POLICY, validConcentrationConversion } from './direct-share-concentration-contract.js';
const PRESETS = [-1000, -2000, 1000];
const USD_SCENARIO = 'usd-rub-plus-10';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const integer = value => typeof value === 'string' && /^-?\d{1,250}$/u.test(value);
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const time = value => iso(value) ? new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' мск' : 'Нет данных';
const validMoney = value => value && integer(value.amountNanos) && ['exact-nano', 'subnano-remainder'].includes(value.precision)
  && [-1, 0, 1].includes(value.sign) && (BigInt(value.amountNanos) === 0n ? value.precision === 'exact-nano' ? value.sign === 0 : value.sign !== 0 : (BigInt(value.amountNanos) < 0n ? -1 : 1) === value.sign);
const amount = value => !validMoney(value) ? 'Нет данных' : BigInt(value.amountNanos) === 0n && value.sign !== 0
  ? (value.sign < 0 ? 'Снижение' : 'Рост') + ' <0,000000001 ₽' : decimalNanos(value.amountNanos, { digits: 9 }) + ' ₽';
const scalar = value => integer(value) ? decimalNanos(value, { digits: 9 }) : 'Нет данных';
const label = bps => (bps > 0 ? '+' : '−') + Math.abs(bps / 100) + ' %';

export function validateDirectShareShock(dto) {
  return ['direct-share-shock-v2', 'direct-share-shock-v3', 'direct-share-shock-v4', 'direct-share-shock-v5', 'direct-share-shock-v6'].includes(dto?.contractVersion) ? validateFxShock(dto) : validateLegacyShock(dto);
}
function validateLegacyShock(dto) {
  if (!dto || dto.contractVersion !== 'direct-share-shock-v1' || !['partial', 'unavailable'].includes(dto.state) || dto.currency !== 'RUB'
    || typeof dto.calculationSnapshotId !== 'string' || !/^[a-f0-9]{64}$/u.test(dto.calculationSnapshotId)
    || !dto.evidence || !['synthetic', 'local-saved'].includes(dto.evidence.dataMode)
    || !['unknown', 'client-observed'].includes(dto.evidence.timeBasis) || dto.evidence.priceTimeVerified !== false
    || !dto.coverage || dto.coverage.complete !== false || !Array.isArray(dto.rows) || dto.rows.length > 500
    || !Array.isArray(dto.scenarios) || dto.scenarios.length !== 3 || !Array.isArray(dto.coverage.blockers)) return false;
  const keys = new Set(), supported = [];
  for (const row of dto.rows) {
    if (!row || typeof row.key !== 'string' || !/^position-[1-9]\d{0,2}$/u.test(row.key) || keys.has(row.key) || !['supported', 'excluded'].includes(row.state)) return false;
    keys.add(row.key);
    if (row.state === 'supported') { if (row.assetType !== 'share' || !integer(row.quantityNanos) || !integer(row.priceNanos) || BigInt(row.priceNanos) <= 0n || row.reason !== null) return false; supported.push(row.key); }
    else if (row.quantityNanos !== null || row.priceNanos !== null || typeof row.reason?.message !== 'string') return false;
  }
  if (dto.coverage.calculatedRows !== supported.length || dto.state !== (supported.length ? 'partial' : 'unavailable')
    || dto.coverage.positionsObserved !== null && dto.coverage.positionsObserved !== dto.rows.length
    || dto.coverage.excludedRows !== null && dto.coverage.excludedRows !== dto.rows.length - supported.length) return false;
  for (const bps of PRESETS) {
    const found = dto.scenarios.filter(row => row?.shockBasisPoints === bps); if (found.length !== 1) return false;
    const s = found[0]; if (s.portfolioEffect !== null || !Array.isArray(s.contributions) || s.contributions.length !== supported.length
      || (supported.length ? !validMoney(s.subtotal) || !integer(s.roundingResidualNanos) : s.subtotal !== null || s.roundingResidualNanos !== null)) return false;
    if (supported.some(key => s.contributions.filter(row => row?.positionKey === key && validMoney(row.effect)).length !== 1)) return false;
  }
  return true;
}


const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === keys.split(' ').sort().join('|');
const canonical = (value, size = 120) => integer(value) && BigInt(value).toString() === value && value.replace('-', '').length <= size;
const publicText = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value);
const publicReason = value => closed(value, 'code message') && typeof value.code === 'string' && /^[a-z_]{1,60}$/u.test(value.code)
  && typeof value.message === 'string' && value.message.length > 0 && value.message.length <= 300 && !/[\u0000-\u001f\u007f]/u.test(value.message);
function validateFxShock(dto) {
  try {
    const bonds = dto.contractVersion === 'direct-share-shock-v6';
    const funds = bonds || dto.contractVersion === 'direct-share-shock-v5';
    const cash = funds || dto.contractVersion === 'direct-share-shock-v4';
    const currencyEnabled = cash || dto.contractVersion === 'direct-share-shock-v3';
    if (!closed(dto, 'contractVersion valuation state currency scope period evidence coverage rows scenarios assumptions calculationSnapshotId' + (currencyEnabled ? ' currencyScenario' : '') + (cash ? ' currencyValuation currencyPositions' : '') + (funds ? ' fundValuation fundPositions' : '') + (bonds ? ' bondValuation bondPositions' : ''))
      || !closed(dto.valuation, 'method timeBasis knowledgeTimeVerified maxLookbackDays')
      || Object.entries(CONCENTRATION_FX_POLICY).some(([key, value]) => dto.valuation[key] !== value)
      || !closed(dto.scope, 'kind portfolioIds') || dto.scope.kind !== 'single-account'
      || !Array.isArray(dto.scope.portfolioIds) || dto.scope.portfolioIds.length !== 1 || !/^portfolio-[1-9]\d{0,5}$/u.test(dto.scope.portfolioIds[0])
      || !closed(dto.period, 'requestedFrom requestedTo observedAt') || Object.values(dto.period).some(value => value !== null && !iso(value))
      || !dto.period.requestedFrom || !dto.period.requestedTo || dto.period.requestedFrom >= dto.period.requestedTo
      || dto.period.observedAt && dto.period.observedAt > dto.period.requestedTo
      || !closed(dto.evidence, 'dataMode timeBasis priceTimeVerified')
      || !closed(dto.coverage, 'complete positionsObserved calculatedRows excludedRows virtualPositions blockers')
      || !['unknown', 'present-excluded', 'explicit-zero'].includes(dto.coverage.virtualPositions)
      || !Array.isArray(dto.coverage.blockers) || dto.coverage.blockers.length > 20 || !dto.coverage.blockers.every(publicReason)
      || !Array.isArray(dto.assumptions) || dto.assumptions.join('|') !== 'fixed-quantity|parallel-native-share-price-shock|fixed-saved-official-fx|no-correlation-model|no-cost-tax-financing-effects|not-a-full-portfolio-effect'
      || !validateLegacyShock({ ...dto, contractVersion: 'direct-share-shock-v1' })) return false;
    const verified = dto.period.observedAt !== null;
    if (dto.evidence.timeBasis !== (verified ? 'client-observed' : 'unknown')
      || dto.coverage.positionsObserved !== (verified ? dto.rows.length : null)
      || dto.coverage.excludedRows !== (verified ? dto.rows.length - dto.coverage.calculatedRows : null)
      || !verified && (dto.rows.length || dto.coverage.virtualPositions !== 'unknown')) return false;
    const uids = new Set();
    for (const row of dto.rows) {
      if (!closed(row, 'key instrumentUid ticker assetType state reason quantityNanos priceNanos priceCurrency conversion')
        || !publicText(row.instrumentUid) || !publicText(row.ticker) || typeof row.assetType !== 'string' || !publicText(row.assetType)) return false;
      if (row.state === 'supported') {
        if (!row.instrumentUid || uids.has(row.instrumentUid) || !canonical(row.quantityNanos) || !canonical(row.priceNanos)
          || !validConcentrationConversion(row.conversion, row.priceCurrency, dto.period.observedAt)) return false;
        uids.add(row.instrumentUid);
      } else if (row.priceCurrency !== null || row.conversion !== null || !publicReason(row.reason)) return false;
    }
    const denominator = 10_000_000_000_000_000_000_000n;
    const checkMoney = (value, numerator) => closed(value, 'amountNanos precision sign') && canonical(value.amountNanos, 250)
      && value.amountNanos === (numerator / denominator).toString()
      && value.precision === (numerator % denominator === 0n ? 'exact-nano' : 'subnano-remainder')
      && value.sign === (numerator === 0n ? 0 : numerator < 0n ? -1 : 1);
    const rows = dto.rows.filter(row => row.state === 'supported');
    let currencyRows = rows;
    if (cash) {
      if (!closed(dto.currencyValuation, 'method quantityUnit unitSource knowledgeTimeVerified')
        || dto.currencyValuation.method !== 'saved-portfolio-native-currency' || dto.currencyValuation.quantityUnit !== 'currency-units'
        || dto.currencyValuation.unitSource !== 't-invest.currency-unit' || dto.currencyValuation.knowledgeTimeVerified !== false
        || !Array.isArray(dto.currencyPositions) || !funds && dto.currencyPositions.length === 0
        || dto.currencyPositions.length !== dto.rows.filter(row => row.assetType === 'currency').length) return false;
      const keys = new Set();
      for (const value of dto.currencyPositions) {
        if (!closed(value, 'positionKey state reason quantityNanos currency conversion unitObservation')
          || keys.has(value.positionKey) || !['supported', 'excluded'].includes(value.state)) return false;
        keys.add(value.positionKey);
        const matching = dto.rows.filter(row => row.key === value.positionKey && row.assetType === 'currency' && row.state === 'excluded');
        if (matching.length !== 1) return false;
        if (value.state === 'supported') {
          const main = matching[0];
          if (!main.instrumentUid || dto.rows.filter(row => row.instrumentUid === main.instrumentUid).length !== 1
            || !canonical(value.quantityNanos) || value.reason !== null || !validConcentrationConversion(value.conversion, value.currency, dto.period.observedAt)
            || !closed(value.unitObservation, 'firstObservedAt lastObservedAt')
            || !iso(value.unitObservation.firstObservedAt) || !iso(value.unitObservation.lastObservedAt)
            || value.unitObservation.firstObservedAt > value.unitObservation.lastObservedAt) return false;
        } else if (value.quantityNanos !== null || value.currency !== null || value.conversion !== null || value.unitObservation !== null || !publicReason(value.reason)) return false;
      }
      currencyRows = dto.rows.flatMap(row => {
        if (row.state === 'supported') return [row];
        const value = dto.currencyPositions.find(item => item.positionKey === row.key && item.state === 'supported');
        return value ? [{ ...value, key: value.positionKey, priceCurrency: value.currency, priceNanos: '1000000000' }] : [];
      });
    }
    if (funds) {
      if (!closed(dto.fundValuation, 'method quantityUnit priceUnit source lookThrough')
        || dto.fundValuation.method !== 'saved-portfolio-etf-unit-money' || dto.fundValuation.quantityUnit !== 'fund-units'
        || dto.fundValuation.priceUnit !== 'money-per-unit' || dto.fundValuation.source !== 't-invest.portfolio' || dto.fundValuation.lookThrough !== false
        || !Array.isArray(dto.fundPositions) || !bonds && dto.fundPositions.length === 0
        || dto.fundPositions.length !== dto.rows.filter(row => row.assetType === 'etf').length) return false;
      const keys = new Set();
      for (const value of dto.fundPositions) {
        if (!closed(value, 'positionKey state reason quantityNanos priceNanos priceCurrency conversion')
          || keys.has(value.positionKey) || !['supported', 'excluded'].includes(value.state)) return false;
        keys.add(value.positionKey);
        const matching = dto.rows.filter(row => row.key === value.positionKey && row.assetType === 'etf' && row.state === 'excluded');
        if (matching.length !== 1) return false;
        if (value.state === 'supported') {
          const main = matching[0];
          if (!main.instrumentUid || dto.rows.filter(row => row.instrumentUid === main.instrumentUid).length !== 1
            || !canonical(value.quantityNanos) || !canonical(value.priceNanos) || BigInt(value.priceNanos) <= 0n || value.reason !== null
            || !validConcentrationConversion(value.conversion, value.priceCurrency, dto.period.observedAt)) return false;
        } else if (value.quantityNanos !== null || value.priceNanos !== null || value.priceCurrency !== null || value.conversion !== null || !publicReason(value.reason)) return false;
      }
      currencyRows = dto.rows.flatMap(row => {
        const existing = currencyRows.find(value => value.key === row.key);
        if (existing) return [existing];
        const fund = dto.fundPositions.find(value => value.positionKey === row.key && value.state === 'supported');
        return fund ? [{ ...fund, key: fund.positionKey }] : [];
      });
    }
    if (bonds) {
      if (!closed(dto.bondValuation, 'method quantityUnit priceUnit accruedInterestUnit priceBasis source nominalReconstruction modelRepricing')
        || dto.bondValuation.method !== 'saved-portfolio-bond-money-plus-accrual' || dto.bondValuation.quantityUnit !== 'bond-units'
        || dto.bondValuation.priceUnit !== 'money-per-unit' || dto.bondValuation.accruedInterestUnit !== 'money-per-unit'
        || dto.bondValuation.priceBasis !== 'clean-plus-current-nkd' || dto.bondValuation.source !== 't-invest.portfolio'
        || dto.bondValuation.nominalReconstruction !== false || dto.bondValuation.modelRepricing !== false
        || !Array.isArray(dto.bondPositions) || dto.bondPositions.length === 0
        || dto.bondPositions.length !== dto.rows.filter(row => row.assetType === 'bond').length) return false;
      const keys = new Set();
      for (const value of dto.bondPositions) {
        if (!closed(value, 'positionKey state reason quantityNanos cleanPriceNanos accruedInterestNanos priceNanos priceCurrency conversion')
          || keys.has(value.positionKey) || !['supported', 'excluded'].includes(value.state)) return false;
        keys.add(value.positionKey);
        const matching = dto.rows.filter(row => row.key === value.positionKey && row.assetType === 'bond' && row.state === 'excluded');
        if (matching.length !== 1) return false;
        if (value.state === 'supported') {
          const main = matching[0];
          if (!main.instrumentUid || dto.rows.filter(row => row.instrumentUid === main.instrumentUid).length !== 1
            || !canonical(value.quantityNanos) || !canonical(value.cleanPriceNanos) || BigInt(value.cleanPriceNanos) <= 0n
            || !canonical(value.accruedInterestNanos) || BigInt(value.accruedInterestNanos) < 0n || !canonical(value.priceNanos)
            || BigInt(value.priceNanos) !== BigInt(value.cleanPriceNanos) + BigInt(value.accruedInterestNanos) || value.reason !== null
            || !validConcentrationConversion(value.conversion, value.priceCurrency, dto.period.observedAt)) return false;
        } else if (value.quantityNanos !== null || value.cleanPriceNanos !== null || value.accruedInterestNanos !== null
          || value.priceNanos !== null || value.priceCurrency !== null || value.conversion !== null || !publicReason(value.reason)) return false;
      }
      currencyRows = dto.rows.flatMap(row => {
        const existing = currencyRows.find(value => value.key === row.key);
        if (existing) return [existing];
        const bond = dto.bondPositions.find(value => value.positionKey === row.key && value.state === 'supported');
        return bond ? [{ ...bond, key: bond.positionKey }] : [];
      });
    }
    const scenarios = [...dto.scenarios];
    if (currencyEnabled) {
      const s = dto.currencyScenario;
      if (!closed(s, 'factor shockBasisPoints affectedRows assumptions contributions subtotal roundingResidualNanos portfolioEffect' + (cash ? ' calculatedRows' : ''))
        || cash && s.calculatedRows !== currencyRows.length
        || s.factor !== 'USD/RUB' || s.shockBasisPoints !== 1000 || s.affectedRows !== currencyRows.filter(row => row.priceCurrency === 'USD').length
        || !Array.isArray(s.assumptions) || s.assumptions.join('|') !== 'fixed-quantity|' + (bonds ? 'fixed-native-security-prices-and-accrual' : funds ? 'fixed-native-security-prices' : 'fixed-native-share-prices') + '|fixed-non-usd-rates|no-correlation-model|no-cost-tax-financing-effects|not-a-full-portfolio-effect'
        || s.portfolioEffect !== null || !Array.isArray(s.contributions) || s.contributions.length !== currencyRows.length
        || currencyRows.some(row => s.contributions.filter(c => c?.positionKey === row.key).length !== 1)
        || (currencyRows.length ? !validMoney(s.subtotal) || !integer(s.roundingResidualNanos) : s.subtotal !== null || s.roundingResidualNanos !== null)) return false;
      scenarios.push(s);
    }
    for (const scenario of scenarios) {
      const currencyShock = currencyEnabled && scenario === dto.currencyScenario;
      if (!currencyShock && !closed(scenario, 'shockBasisPoints contributions subtotal roundingResidualNanos portfolioEffect')) return false;
      const includedRows = currencyShock ? currencyRows : rows;
      let total = 0n, displayed = 0n;
      for (const contribution of scenario.contributions) {
        if (!closed(contribution, 'positionKey effect')) return false;
        const row = includedRows.find(value => value.key === contribution.positionKey);
        const numerator = currencyShock && row.priceCurrency !== 'USD' ? 0n
          : BigInt(row.quantityNanos) * BigInt(row.priceNanos) * BigInt(row.conversion.rateNanos) * BigInt(scenario.shockBasisPoints);
        if (!checkMoney(contribution.effect, numerator)) return false;
        total += numerator; displayed += BigInt(contribution.effect.amountNanos);
      }
      if (includedRows.length && (!checkMoney(scenario.subtotal, total) || scenario.roundingResidualNanos !== (total / denominator - displayed).toString())) return false;
    }
    return true;
  } catch { return false; }
}

export function createDirectShareShockUi({ host }) {
  let current = null, signature = '', scope = '', selected = -1000, shown = 8;
  const focus = key => {
    const target = key === 'main' ? host.querySelector('[data-shock-main]>summary')
      : /^row-\d+$/u.test(key) ? host.querySelector(`[data-shock-row="${key.slice(4)}"]`)
      : host.querySelector(`[data-shock-control="${key}"]`);
    if (!target) return;
    const bar = document.querySelector('.topbar'); if (bar) target.style.scrollMarginTop = Math.ceil(bar.getBoundingClientRect().height + 12) + 'px';
    target.style.scrollMarginBottom = '8px';
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  };
  function render({ reset = false, focused = null } = {}) {
    if (!host) return;
    const data = current, dto = data?.portfolio?.directShareShock, portfolios = data?.clientProduct?.portfolios || [], period = data?.selectedPeriod;
    const multi = portfolios.length > 1 || dto?.scope?.kind === 'multi-account';
    const matches = validateDirectShareShock(dto) && portfolios.length === 1 && dto.scope?.kind === 'single-account'
      && dto.scope.portfolioIds?.length === 1 && dto.scope.portfolioIds[0] === portfolios[0].id
      && iso(period?.from) && iso(period?.to) && dto.period?.requestedFrom === period.from && dto.period?.requestedTo === period.to;
    const open = !reset && host.querySelector('[data-shock-main]')?.open, method = !reset && host.querySelector('[data-shock-method]')?.open;
    const bonds = matches && dto.contractVersion === 'direct-share-shock-v6';
    const funds = bonds || matches && dto.contractVersion === 'direct-share-shock-v5';
    const cash = funds || matches && dto.contractVersion === 'direct-share-shock-v4';
    const currencyEnabled = matches && (cash || dto.contractVersion === 'direct-share-shock-v3');
    const currencyShock = currencyEnabled && selected === USD_SCENARIO;
    const scenario = matches ? currencyShock ? dto.currencyScenario : dto.scenarios.find(row => row.shockBasisPoints === selected) : null;
    const rows = matches ? dto.rows : [], calculated = matches ? cash && currencyShock ? dto.currencyScenario.calculatedRows : dto.coverage.calculatedRows : null;
    const fx = matches && ['direct-share-shock-v2', 'direct-share-shock-v3', 'direct-share-shock-v4', 'direct-share-shock-v5', 'direct-share-shock-v6'].includes(dto.contractVersion);
    const status = calculated > 0 ? 'Частичный расчёт' : 'Расчёт недоступен';
    const message = multi ? 'Выберите один счёт: составы разных счетов не объединяются.' : !matches ? 'Не удалось подтвердить данные выбранного счёта и периода.'
      : calculated === 0 ? 'Нет строк с подтверждёнными количеством, единицами и рублёвой оценкой. Это не означает отсутствие риска.' : 'Изменение оценки при неизменном количестве. Это условный расчёт, не прогноз и не результат сделки.';
    host.innerHTML = `<details data-shock-main ${open ? 'open' : ''}><summary><span><strong>${cash ? 'Сценарии стоимости' : currencyEnabled ? 'Сценарии акций' : 'Прямой ценовой сценарий'}</strong><small>${bonds ? 'Акции, облигации, фонды и валюта · сохранённый состав' : funds ? 'Акции, фонды и валютные позиции · сохранённый состав' : cash ? 'Акции и валютные позиции · сохранённый состав' : fx ? 'Акции · оценка в RUB по сохранённому курсу' : 'Акции в RUB · сохранённый состав'}</small></span><span role="status">${status}</span></summary><div class="direct-shock-body">
      <p>${esc(message)}</p>${fx ? '<p class="direct-shock-fx-basis">' + (currencyShock ? 'Курс USD/RUB повышается на 10 %. ' + (bonds ? 'Количество позиций, денежные цены бумаг, НКД облигаций и курс EUR/RUB остаются прежними.' : funds ? 'Количество позиций, цены акций и паёв и курс EUR/RUB остаются прежними.' : cash ? 'Количество акций и валюты, цены акций и курс EUR/RUB остаются прежними.' : 'Количество акций, цены в исходных валютах и курс EUR/RUB остаются прежними.') : 'Меняется цена акции в исходной валюте. Курс USD/EUR зафиксирован на указанную дату; валютный шок не моделируется.') + '</p>' : ''}${matches ? `<p class="direct-shock-caption">${esc(portfolios[0].label || 'Выбранный счёт')} · ${dto.evidence?.dataMode === 'synthetic' ? 'Синтетические данные' : 'Сохранённые данные'}. Снимок: ${esc(time(dto.period.observedAt))}. Конец выбранного периода: ${esc(time(period.to))}.</p>` : ''}
      ${matches ? `<div class="direct-shock-controls" role="group" aria-label="${cash ? 'Выбор сценария стоимости' : currencyEnabled ? 'Выбор сценария акций' : 'Ценовой шок акций'}">${PRESETS.map(bps => `<button type="button" class="button" data-shock-control="${bps}" aria-pressed="${selected === bps}">${currencyEnabled ? 'Цена ' : ''}${label(bps)}</button>`).join('')}${currencyEnabled ? `<button type="button" class="button" data-shock-control="${USD_SCENARIO}" aria-pressed="${currencyShock}">USD/RUB +10 %</button>` : ''}</div>` : ''}
      <dl class="direct-shock-result"><div><dt>Изменение по проверенным строкам${matches ? currencyShock ? ' · USD/RUB +10 %' : ' · цены ' + label(selected) : ''}</dt><dd data-shock-subtotal data-value="${esc(scenario?.subtotal?.amountNanos ?? 'unknown')}">${esc(amount(scenario?.subtotal))}</dd></div><div><dt>Общий эффект по портфелю</dt><dd>Неизвестен</dd></div></dl>
      <p class="direct-shock-caption">${matches && dto.coverage.positionsObserved !== null ? `Рассчитано ${calculated} из ${dto.coverage.positionsObserved} сохранённых строк. Остальные: ${cash && currencyShock ? rows.length - calculated : dto.coverage.excludedRows}.` : 'Полнота состава не подтверждена.'} Полнота состава и время цен у источника не подтверждены.</p>${currencyShock ? `<p class="direct-shock-caption" data-shock-currency-coverage>${cash ? 'Включено долларовых позиций' : 'Включено строк с ценой в USD'}: ${dto.currencyScenario.affectedRows}. Проверенные строки в RUB/EUR не меняются. Неоценённые позиции не включены в сумму.</p>` : ''}
      ${rows.length ? `<div class="direct-shock-table" tabindex="0" role="region" aria-label="Вклады сохранённых позиций"><table><caption>Вклад каждой сохранённой строки · RUB</caption><thead><tr><th scope="col">Позиция</th><th scope="col">${cash && currencyShock ? 'Количество и исходная оценка' : 'Количество × цена'}</th><th scope="col">Изменение оценки</th></tr></thead><tbody>${rows.slice(0, shown).map((row, index) => {
        const currencyPosition = cash && currencyShock ? dto.currencyPositions.find(value => value.positionKey === row.key) : null;
        const fundPosition = funds && currencyShock ? dto.fundPositions.find(value => value.positionKey === row.key) : null;
        const bondPosition = bonds && currencyShock ? dto.bondPositions.find(value => value.positionKey === row.key) : null;
        const shownRow = bondPosition ? { ...row, ...bondPosition } : currencyPosition ? { ...row, ...currencyPosition, priceCurrency: currencyPosition.currency } : fundPosition ? { ...row, ...fundPosition } : row;
        const effect = scenario.contributions.find(value => value.positionKey === row.key)?.effect;
        return `<tr data-shock-position="${esc(row.key)}"><th scope="row" tabindex="-1" data-shock-row="${index + 1}">${esc(row.ticker || 'Позиция ' + (index + 1))}</th><td>${shownRow.state === 'supported' ? esc(currencyPosition ? scalar(shownRow.quantityNanos) + ' ' + shownRow.currency : bondPosition ? 'Облигации: ' + scalar(shownRow.quantityNanos) + ' шт. × (' + scalar(shownRow.cleanPriceNanos) + ' + НКД ' + scalar(shownRow.accruedInterestNanos) + ') ' + (shownRow.priceCurrency === 'RUB' ? '₽' : shownRow.priceCurrency) : (fundPosition ? 'Паи: ' + scalar(shownRow.quantityNanos) + ' × ' : scalar(shownRow.quantityNanos) + ' шт. × ') + scalar(shownRow.priceNanos) + (fx && shownRow.priceCurrency !== 'RUB' ? ' ' + shownRow.priceCurrency : ' ₽')) + (fx && shownRow.conversion.source === 'cbr-saved' ? '<small data-shock-fx>' + (currencyShock && shownRow.priceCurrency === 'USD' ? 'Исходный курс ЦБ с ' : 'Курс ЦБ с ') + esc(shownRow.conversion.date.split('-').reverse().join('.')) + ': 1 ' + esc(shownRow.priceCurrency) + ' = ' + esc(scalar(shownRow.conversion.rateNanos)) + ' ₽</small>' : '') + (currencyPosition ? '<small data-shock-unit>Справочник валют: ' + esc(time(shownRow.unitObservation.lastObservedAt)) + '.</small>' : '') : 'Не рассчитано'}</td><td data-value="${esc(effect?.amountNanos ?? 'unknown')}">${esc(amount(effect))}</td></tr>${shownRow.reason ? `<tr class="direct-shock-reason"><td colspan="3">${esc(shownRow.reason.message)}</td></tr>` : ''}`;
      }).join('')}</tbody></table></div><p class="direct-shock-caption">Показано строк: ${Math.min(shown, rows.length)} из ${rows.length}.</p>${shown < rows.length ? '<button type="button" class="button" data-shock-control="more">Показать ещё позиции</button>' : ''}` : ''}
      ${matches && dto.coverage.blockers.length ? '<ul>' + dto.coverage.blockers.map(row => '<li>' + esc(row.message) + '</li>').join('') + '</ul>' : ''}
      <details data-shock-method ${method ? 'open' : ''}><summary>Метод и границы сценария</summary><p>${currencyShock ? (funds ? 'Для проверенной акции или пая с ценой в USD: ' : cash ? 'Для проверенной акции с ценой в USD: ' : 'Для каждой проверенной USD-строки: ') + 'количество в штуках × сохранённая цена в USD × исходный курс USD/RUB × 10 %. Для проверенных строк в RUB/EUR изменение равно нулю.' + (cash ? ' Для валютной позиции в USD: количество USD × исходный курс USD/RUB × 10 %.' : '') : `Для каждой проверенной строки: количество в штуках × сохранённая цена за штуку${fx ? ' × фиксированный курс в RUB' : ''} × выбранный процент изменения.`} Количество лотов не используется. Отрицательное количество сохраняет знак короткой позиции.${cash && currencyShock ? ' Валютное количество не умножается на лот или номинал; заблокированная часть повторно не добавляется. Отрицательная валютная позиция сохраняет знак обязательства.' : ''}</p>
      <p>${currencyShock ? (bonds ? 'Повышается только курс USD/RUB. Денежные цены, НКД облигаций и другие валютные курсы зафиксированы. Отклик бизнеса эмитента на курс и корреляции не моделируются.' : funds ? 'Повышается только курс USD/RUB. Цены акций и паёв и другие валютные курсы зафиксированы. Отклик бизнеса эмитента на курс и корреляции не моделируются.' : 'Повышается только курс USD/RUB. Цены акций и другие валютные курсы зафиксированы. Отклик бизнеса эмитента на курс и корреляции не моделируются.') : (fx ? 'Шок одинаково применяется к ценам показанных акций в их исходных валютах RUB, USD и EUR. Курс из сохранённой копии ЦБ не изменяется.' : 'Шок одинаково применяется к ценам показанных акций в RUB.') + ' Цены других активов, курсы валют и корреляции не моделируются.'} Нет расчёта ликвидации, исполнения по этим ценам, комиссий, налогов или финансирования.</p>
      <p>${fx ? 'Цены в неподдерживаемых валютах, строки без проверенного курса,' : 'Иностранные цены,'} ${cash && currencyShock ? 'неподтверждённые валютные позиции,' : 'денежные остатки,'} производные инструменты, ${funds && currencyShock ? 'неподтверждённые фонды' : 'фонды'}, ${bonds && currencyShock ? 'неподтверждённые облигации' : 'облигации'} и виртуальные позиции не добавляются как нулевой риск. Данные не дают полной оценки экспозиции. ГО и маржинальные показатели не заменяют стоимость позиции.</p>
      ${fx ? '<p>Используется последний проверенный курс, действующий на московскую дату наблюдения, с пределом поиска 40 календарных дней. Сохранённая копия может содержать позднюю коррекцию; она не подтверждает, что курс был известен в тот момент. Валюта котировки не определяет валютную экспозицию бизнеса эмитента.</p>' : ''}
      ${cash && currencyShock ? '<p>Валютные позиции и акции взяты из одного ответа портфеля. Денежные суммы из отдельного ответа об остатках не прибавляются. Справочник валют мог быть сохранён позднее снимка; он не подтверждает знание валюты в прошлом. Старые строки без подтверждённых единиц требуют обновления сохранённого состава.</p>' : ''}
      ${funds && currencyShock ? '<p data-shock-fund-method>Цена пая считается неизменной в своей валюте. Состав фонда, валютные хеджи и чувствительность его активов не рассчитаны. Нулевой вклад проверенного пая в RUB/EUR относится только к этому условию и не означает отсутствия валютного риска. Количество паёв и денежная цена за пай взяты из того же ответа портфеля; старые строки требуют обновления сохранённого состава.</p>' : ''}
      ${bonds && currencyShock ? '<p data-shock-bond-method>Для облигации с ценой в USD: количество в штуках × (денежная цена + НКД на одну облигацию) × исходный курс USD/RUB × 10 %. Цена и НКД показаны отдельно и взяты из того же сохранённого состава. Процент от номинала не восстанавливается. Цена и НКД зафиксированы; изменение ставок, будущие купоны и погашения не рассчитываются. Нулевой НКД учитывается только при явном значении от источника; отсутствие значения не заменяется нулём. Нулевой вклад проверенной облигации в RUB/EUR относится только к этому условию.</p>' : ''}
      <p>Исходный снимок сохранён на устройстве; точное время состояния и цен у брокера неизвестно. Это не обновление котировок. Недостающая цена не заменяется средней ценой покупки.</p>
      <p>Сумма рассчитана до округления, затем значения усечены до 0,000000001 ₽. Ненулевые меньшие изменения показываются с направлением.${scenario?.roundingResidualNanos && scenario.roundingResidualNanos !== '0' ? ' Разница с суммой отображённых вкладов: ' + esc(scalar(scenario.roundingResidualNanos)) + ' ₽.' : ''}</p></details>
      </div></details>`;
    if (focused) focus(reset ? 'main' : focused);
  }
  host?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-shock-control]'); if (!button || !host.contains(button)) return;
    const key = button.dataset.shockControl;
    if (key === 'more') { const nextRow = shown + 1; shown += 8; render({ focused: 'row-' + nextRow }); }
    else if (PRESETS.includes(Number(key))) { selected = Number(key); render({ focused: key }); }
    else if (key === USD_SCENARIO && ['direct-share-shock-v3', 'direct-share-shock-v4', 'direct-share-shock-v5', 'direct-share-shock-v6'].includes(current?.portfolio?.directShareShock?.contractVersion)) { selected = key; render({ focused: key }); }
  });
  return { update(data) {
    if (!host) return; current = data;
    const nextScope = JSON.stringify([data?.identity?.preferenceScope, data?.savedResearch?.ownerScope,
      data?.clientProduct?.portfolios?.map(row => [row.id, row.preferenceKey]), data?.selectedPeriod?.from, data?.selectedPeriod?.to]);
    const next = JSON.stringify([data?.portfolio?.directShareShock, nextScope]); if (next === signature) return;
    const changed = nextScope !== scope || signature && data?.portfolio?.directShareShock?.calculationSnapshotId !== host.dataset.snapshot;
    const active = host.contains(document.activeElement), key = document.activeElement?.dataset?.shockControl || 'main';
    if (changed) { selected = -1000; shown = 8; }
    scope = nextScope; signature = next; host.dataset.snapshot = data?.portfolio?.directShareShock?.calculationSnapshotId || '';
    render({ reset: Boolean(changed), focused: active ? key : null });
  } };
}
