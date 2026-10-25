import { decimalNanos } from './number-format.js';
import { CASH_COMPARISON_VERSION, CASH_COMPARISON_PREVIOUS_VERSION, CASH_COMPARISON_LEGACY_VERSION, CASH_COMPARISON_VERSIONS, validCashCommissionLinks, CASH_COMPARISON_REASONS, CASH_COMPARISON_LIMITATIONS } from './cash-comparison-contract.js';

const esc = value => String(value ?? '').replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const known = value => typeof value === 'string' && /^-?\d{1,4110}$/.test(value);
const amount = (value, currency) => known(value) ? decimalNanos(value, { digits: 9 }) + ' ' + currency : 'Нет данных';
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ru-RU', {
  timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' мск' : 'Нет данных';
const reason = code => CASH_COMPARISON_REASONS[code] || 'Исходные данные не подтверждены.';
const fact = (label, text, key = '') => `<div${key ? ' data-cash-fact="' + key + '"' : ''}><dt>${esc(label)}</dt><dd>${esc(text)}</dd></div>`;

/** Scope-bound rendering only: all arithmetic belongs to the native reader. */
export function createCashComparisonUi({ host }) {
  let signature = '', scope = '';
  function update(data) {
    if (!host) return;
    const dto = data?.portfolio?.cashComparison, period = data?.selectedPeriod;
    const accounts = Array.isArray(data?.clientProduct?.portfolios) ? data.clientProduct.portfolios : [];
    const ids = dto?.scope?.portfolioIds;
    const selected = accounts.length === 1 && Array.isArray(ids) && ids.length === 1 && accounts[0].id === ids[0];
    const valid = CASH_COMPARISON_VERSIONS.includes(dto?.contractVersion) && ['observed', 'partial', 'unavailable'].includes(dto.state);
    const samePeriod = typeof period?.from === 'string' && typeof period?.to === 'string'
      && dto?.period?.requestedFrom === period.from && dto?.period?.requestedTo === period.to;
    const eligible = valid && selected && samePeriod && dto.scope.kind === 'single-account';
    const next = JSON.stringify([dto, accounts.map(row => [row.id, row.label]), period?.from, period?.to]);
    if (signature === next) return;
    const current = JSON.stringify([accounts.map(row => row.id), period?.from, period?.to]), changed = scope !== current;
    const focused = host.contains(document.activeElement);
    const open = !changed && host.querySelector('details')?.open;
    signature = next; scope = current;
    const multi = accounts.length > 1 || dto?.scope?.kind === 'multi-account';
    const blocked = multi ? reason('select_single_account') : !valid ? 'Сохранённое сравнение пока недоступно.'
      : !selected ? 'Данные относятся к другому счёту. Дождитесь обновления.'
        : !samePeriod ? 'Данные относятся к другому периоду. Дождитесь обновления.' : null;
    const rows = eligible && Array.isArray(dto.rows) ? dto.rows.filter(row => /^[A-Z]{3}$/.test(row?.currency)).slice(0, 256) : [];
    const observed = eligible && dto.state === 'observed';
    const hasFx = eligible && dto.contractVersion !== CASH_COMPARISON_LEGACY_VERSION && dto.currencyExchanges?.tradeCount > 0;
    const partialFx = hasFx && [CASH_COMPARISON_VERSION, CASH_COMPARISON_PREVIOUS_VERSION].includes(dto.contractVersion) && dto.currencyExchanges.state === 'observed'
      && Number.isInteger(dto.currencyExchanges.partialTradeCount) && dto.currencyExchanges.partialTradeCount > 0
      && dto.currencyExchanges.partialTradeCount <= dto.currencyExchanges.tradeCount ? dto.currencyExchanges.partialTradeCount : 0;
    const hasFees = eligible && dto.contractVersion === CASH_COMPARISON_VERSION;
    const links = hasFees && observed && validCashCommissionLinks(dto.commissionLinks) && dto.commissionLinks.state === 'observed' ? dto.commissionLinks : null;
    const fxSourceTime = hasFx && dto.currencyExchanges.firstUnitObservedAt
      ? date(dto.currencyExchanges.firstUnitObservedAt) + (dto.currencyExchanges.firstUnitObservedAt === dto.currencyExchanges.lastUnitObservedAt
        ? '' : ' — ' + date(dto.currencyExchanges.lastUnitObservedAt)) : null;
    host.dataset.state = eligible ? dto.state : 'unavailable';
    const body = blocked ? '<p>' + esc(blocked) + '</p>' : `
      <p class="cash-comparison-note">${dto.evidence?.dataMode === 'synthetic' ? 'Учебный пример на синтетических данных.' : 'По сохранённым ответам брокера и операциям.'} Время состояния у брокера неизвестно.</p>
      <dl class="cash-comparison-period">${fact('Выбранный период', date(dto.period.requestedFrom) + ' — ' + date(dto.period.requestedTo))}${fact('Наблюдаемый интервал', date(dto.period.observedFrom) + ' — ' + date(dto.period.observedTo))}</dl>
      ${hasFx ? '<p class="cash-comparison-note" data-cash-fx-source>' + (dto.currencyExchanges.state === 'observed'
        ? 'Платежи обмена учтены в валюте расчётов. Полученная или отданная валюта рассчитана по количеству исполненных сделок и показана отдельно.'
        : 'Расчёт обеих сторон обмена недоступен. Причины указаны у денежных остатков.')
        + (fxSourceTime ? ' Справочник валют наблюдался: ' + esc(fxSourceTime) + '. Точное время денежных расчётов неизвестно.' : '') + '</p>' : ''}
      ${partialFx ? '<p class="cash-comparison-note" data-cash-partial-executions>Частично исполненных операций: ' + partialFx + '. В сравнении учтены только подтверждённые исполнения. Неисполненный остаток не прибавляется к деньгам.</p>' : ''}
      ${links ? '<p class="cash-comparison-note" data-cash-commission-links>Операций с ненулевой комиссией и проверенной связью: ' + links.tradeCount + '. Связанных списаний: ' + links.postingCount + '; внутри наблюдаемого интервала: ' + links.inIntervalCount + '; за его пределами: ' + links.outsideIntervalCount + '. Списания за пределами интервала в его денежное движение не включены.</p>' : ''}
      ${dto.period.observedFrom && !dto.period.coversRequestedPeriod ? '<p class="cash-comparison-note">Сохранённые наблюдения покрывают часть выбранного периода. Расчёт относится только к указанному интервалу.</p>' : ''}
      <div class="cash-comparison-rows">${rows.map(row => {
        const calculated = row.calculationState === 'observed';
        return `<section class="cash-comparison-currency" data-cash-currency="${row.currency}"><h4>${row.currency}</h4>
        <dl class="cash-comparison-values">${fact('Начальный остаток', amount(row.openingNanos, row.currency), 'opening')}
        ${fact('Платежи по датам операций', amount(calculated ? row.paymentChangeNanos : null, row.currency), 'payments')}
        ${hasFees ? fact('Из платежей: брокерские комиссии', amount(calculated ? row.brokerFeePaymentNanos : null, row.currency), 'broker-fees') : ''}
        ${hasFx ? fact('Количество валюты при обмене', amount(calculated ? row.fxQuantityChangeNanos : null, row.currency), 'fx-quantity') : ''}
        ${fact('Расчётный конечный остаток', amount(calculated ? row.calculatedClosingNanos : null, row.currency), 'calculated')}
        ${fact('Наблюдаемый конечный остаток', amount(row.closingNanos, row.currency), 'closing')}
        ${fact('Наблюдаемая разница', amount(calculated ? row.observedDifferenceNanos : null, row.currency), 'difference')}</dl>
        <p class="cash-comparison-note">Заблокировано по ответу брокера: ${esc(amount(row.openingBlockedNanos, row.currency))} → ${esc(amount(row.closingBlockedNanos, row.currency))}.</p>
        ${Array.isArray(row.blockers) && row.blockers.length ? '<ul class="cash-comparison-blockers">' + row.blockers.map(item => '<li>' + esc(reason(item.code)) + '</li>').join('') + '</ul>' : ''}</section>`;
      }).join('')}</div>
      ${!rows.length && Array.isArray(dto.blockers) ? '<ul class="cash-comparison-blockers">' + dto.blockers.map(item => '<li>' + esc(reason(item.code)) + '</li>').join('') + '</ul>' : ''}
      <p class="cash-comparison-equation">Начальный остаток + платежи${hasFx ? ' + количество валюты при обмене' : ''} = расчётный конечный остаток. Наблюдаемая разница = конечный остаток из ответа брокера − расчётный остаток.</p>
      ${hasFees ? '<p class="cash-comparison-note" data-cash-commission-note>Брокерские комиссии уже включены в платежи по датам их отдельных операций. Повторно прибавлять их не нужно. Значение комиссии в описании сделки само по себе не создаёт денежного движения.</p>' : ''}
      <ul class="cash-comparison-limits">${CASH_COMPARISON_LIMITATIONS.map(text => '<li>' + esc(text) + '</li>').join('')}</ul>`;
    host.innerHTML = `<details class="cash-comparison-disclosure" ${open ? 'open' : ''}><summary><span><strong>Сравнение денежных остатков</strong><small>В исходных валютах${eligible && accounts[0]?.label ? ' · ' + esc(accounts[0].label) : ''}</small></span><span role="status">${observed ? 'Сравнение наблюдений' : rows.length ? 'Часть данных недоступна' : 'Данные недоступны'}</span></summary><div class="cash-comparison-body">${body}</div></details>`;
    if (focused) { const summary = host.querySelector('summary'); summary?.focus({ preventScroll: true }); if (changed) summary?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }
  }
  return { update };
}
