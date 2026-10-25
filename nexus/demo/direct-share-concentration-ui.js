import { CONCENTRATION_REASONS, CONCENTRATION_FX_REASONS, CONCENTRATION_FX_VERSION, concentrationPriceCurrency, concentrationDecimal, validateDirectShareConcentration } from './direct-share-concentration-contract.js';
import { createDirectShareComparisonUi } from './direct-share-comparison-ui.js';
import { shareSectorView } from './direct-share-sector-view.js';
const esc = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const decimal = value => {
  if (value === null || value === undefined) return 'Нет данных';
  const [whole, fraction] = String(value).split('.');
  return whole.replace(/\B(?=(\d{3})+$)/gu, ' ').replace(/^-/, '−') + (fraction ? ',' + fraction : '');
};
const money = (value, currency = 'RUB') => value === null || value === undefined ? 'Нет данных' : decimal(value) + (currency === 'RUB' ? ' ₽' : ' ' + currency);
const fx = row => row?.conversion?.source === 'cbr-saved' ? 'Курс ЦБ с ' + row.conversion.date.split('-').reverse().join('.') + ': 1 ' + row.priceCurrency + ' = ' + money(concentrationDecimal(row.conversion.rateNanos, 9)) : 'Цена в RUB, пересчёт не нужен';
const time = value => value ? new Date(value).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' мск' : 'Нет данных';
export function concentrationRatioText(value, { percent = true } = {}) {
  if (!value) return 'Не определена';
  const numerator = BigInt(value.numerator), denominator = BigInt(value.denominator), scale = percent ? 10000n : 1000000n;
  const scaled = numerator * scale, whole = scaled / denominator, places = percent ? 2 : 6;
  if (numerator > 0n && whole === 0n) return percent ? '<0,01 %' : '<0,000001';
  const digits = whole.toString().padStart(places + 1, '0');
  return (scaled % denominator ? '≈ ' : '') + digits.slice(0, -places) + ',' + digits.slice(-places) + (percent ? ' %' : '');
}

export function createDirectShareConcentrationUi({ host, request, canUseContext }) {
  let current = null, signature = '', scope = '', shown = 5, grouping = 'positions';
  const comparisonHost = host ? document.createElement('section') : null;
  if (comparisonHost) comparisonHost.className = 'concentration-comparison';
  const comparison = comparisonHost ? createDirectShareComparisonUi({ host: comparisonHost, request, canUseContext,
    format: { money, decimal, time, fx, ratio: concentrationRatioText } }) : null;
  function focus(key) {
    const target = key?.startsWith('row-') ? host.querySelector(`[data-concentration-row="${Number(key.slice(4))}"]`)
      : host.querySelector(key?.startsWith('group-') ? `[data-concentration-group="${key.slice(6)}"]` : key === 'more' ? '[data-concentration-more]' : '[data-concentration-main]>summary');
    if (!target) return;
    const topbar = document.querySelector('.topbar');
    if (topbar) target.style.scrollMarginTop = Math.ceil(topbar.getBoundingClientRect().height + 12) + 'px';
    target.style.scrollMarginBottom = '12px';
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function render({ reset = false, focused = null } = {}) {
    const dto = current?.portfolio?.directShareConcentration, accounts = current?.clientProduct?.portfolios || [], period = current?.selectedPeriod;
    const multi = accounts.length > 1 || dto?.scope?.kind === 'multi-account';
    const matches = validateDirectShareConcentration(dto) && accounts.length === 1 && dto.scope.kind === 'single-account'
      && dto.scope.portfolioIds[0] === accounts[0].id && Boolean(period?.from && period?.to)
      && dto.period.requestedFrom === period.from && dto.period.requestedTo === period.to;
    const calculation = matches ? dto.calculation : null, coverage = matches ? dto.coverage : null;
    const converted = matches && dto.contractVersion === CONCENTRATION_FX_VERSION, reasons = converted ? CONCENTRATION_FX_REASONS : CONCENTRATION_REASONS;
    const open = !reset && host.querySelector('[data-concentration-main]')?.open;
    const method = !reset && host.querySelector('[data-concentration-method]')?.open;
    const exclusions = !reset && host.querySelector('[data-concentration-exclusions]')?.open;
    const rows = matches ? dto.rows : [], excluded = rows.filter(row => row.state === 'excluded');
    const ranked = calculation?.rankedKeys.map(key => ({ ...rows.find(row => row.key === key), ...calculation.positions.find(row => row.key === key) })) || [];
    const sectors = matches && current?.portfolio?.directShareSectors;
    if (!sectors) grouping = 'positions';
    const bySector = grouping === 'sectors';
    const sectorView = bySector ? shareSectorView(sectors, dto, { esc, money, time, ratio: concentrationRatioText, shown }) : null;
    const status = calculation?.state === 'partial' ? 'Частичный состав' : calculation?.state === 'zero-gross' ? 'Нулевая сумма включённых позиций' : 'Расчёт недоступен';
    const message = multi ? 'Выберите один счёт: сохранённые составы разных счетов не объединяются.'
      : !matches ? 'Не удалось подтвердить данные выбранного счёта и периода.'
        : calculation.state === 'unavailable' ? 'Нет подтверждённых строк для расчёта. Это не означает отсутствие позиций или риска.'
          : calculation.state === 'zero-gross' ? 'Подтверждённые количества равны нулю. Доли и концентрация при нулевой сумме не определены.'
            : 'Доли от суммы абсолютных стоимостей включённых акций в RUB. Короткие позиции учитываются отдельно и не погашают длинные при расчёте долей.';
    host.innerHTML = `<details data-concentration-main ${open ? 'open' : ''}><summary><span><strong>Концентрация прямых позиций</strong><small>Акции · оценка в RUB · сохранённый состав</small></span><span role="status">${status}</span></summary><div class="concentration-body">
      <p>${esc(message)}</p>${matches ? `<p class="concentration-caption">${esc(accounts[0].label || 'Выбранный счёт')} · ${dto.evidence.dataMode === 'synthetic' ? 'Синтетические данные' : 'Сохранённые данные'}. Наблюдение на устройстве: ${esc(time(dto.period.observedAt))}. Конец выбранного периода: ${esc(time(period.to))}.</p>` : ''}
      <dl class="concentration-values">${[['long', 'Длинные позиции'], ['short', 'Короткие · абсолютная стоимость'], ['gross', 'Сумма абсолютных стоимостей'], ['net', 'Стоимость с учётом знака']].map(([key, title]) => `<div><dt>${title}</dt><dd data-concentration-total="${key}">${esc(money(calculation?.totals?.[key]))}</dd></div>`).join('')}</dl>
      <p class="concentration-caption">${coverage?.positionsObserved !== null && coverage ? `Включено ${coverage.includedRows} из ${coverage.positionsObserved} сохранённых строк; исключено ${coverage.excludedRows}.` : 'Полнота состава не подтверждена.'} Доли относятся только к включённой части, не к стоимости всего портфеля. Полнота состава и время цен у источника неизвестны.</p>
      ${sectors ? `<div class="concentration-grouping" role="group" aria-label="Группировка концентрации"><button class="button" type="button" data-concentration-group="positions" aria-pressed="${!bySector}">По акциям</button><button class="button" type="button" data-concentration-group="sectors" aria-pressed="${bySector}">По секторам</button></div>` : ''}
      ${!bySector && calculation?.state !== 'unavailable' && calculation ? `<dl class="concentration-weights"><div><dt>Крупнейшая позиция</dt><dd data-concentration-largest>${esc(concentrationRatioText(calculation.largestWeight))}</dd></div><div><dt>Три крупнейшие${ranked.length < 3 ? ' · доступно ' + ranked.length : ''}</dt><dd data-concentration-top3>${esc(concentrationRatioText(calculation.top3Weight))}</dd></div></dl>` : ''}
      ${bySector ? sectorView.body : ranked.length ? `<table><caption>По убыванию абсолютной стоимости · доля включённой части</caption><thead><tr><th scope="col">Позиция</th><th scope="col">Стоимость</th><th scope="col">Доля</th></tr></thead><tbody>${ranked.slice(0, shown).map((row, index) => `<tr><th scope="row" tabindex="-1" data-concentration-row="${index + 1}">${esc(row.ticker || 'Позиция ' + row.key.slice(9))}<small>${row.direction === 'short' ? 'Короткая' : row.direction === 'long' ? 'Длинная' : 'Нулевое количество'}</small></th><td>${esc(money(row.value))}<small>${esc(decimal(concentrationDecimal(row.quantityNanos, 9)))} шт. × ${esc(money(concentrationDecimal(row.priceNanos, 9), concentrationPriceCurrency(row)))}</small>${row.conversion?.source === 'cbr-saved' ? `<small data-concentration-fx>${esc(fx(row))}</small>` : ''}</td><td>${esc(concentrationRatioText(row.weight))}</td></tr>`).join('')}</tbody></table><p class="concentration-caption">Показано ${Math.min(shown, ranked.length)} из ${ranked.length} включённых позиций.</p>${shown < ranked.length ? '<button type="button" class="button" data-concentration-more>Показать ещё позиции</button>' : ''}` : ''}
      ${excluded.length ? `<details data-concentration-exclusions ${exclusions ? 'open' : ''}><summary>Исключённые строки · ${excluded.length}</summary><ul>${excluded.map(row => `<li><strong>${esc(row.ticker || 'Позиция ' + row.key.slice(9))}</strong>: ${esc(reasons[row.reason])}</li>`).join('')}</ul></details>` : ''}
      ${coverage?.blockers.length ? '<ul>' + coverage.blockers.map(code => '<li>' + esc(reasons[code]) + '</li>').join('') + '</ul>' : ''}
      <details data-concentration-method ${method ? 'open' : ''}><summary>Метод, исходные данные и границы</summary>
      <p>Стоимость строки = количество акций в штуках × сохранённая цена одной акции${converted ? ' × курс к RUB. Для RUB множитель равен 1' : ''}. Длинная сторона — сумма положительных стоимостей; короткая — сумма модулей отрицательных. Знаковая стоимость = длинная − короткая, абсолютная сумма = длинная + короткая. Доля строки = модуль её стоимости / абсолютная сумма.</p>
      <p>Индекс концентрации HHI: <strong data-concentration-hhi>${esc(concentrationRatioText(calculation?.hhi, { percent: false }))}</strong>. Это сумма квадратов долей включённых инструментов; она не оценивает вероятность потерь и не определяет допустимый риск.</p>
      <p>Основные веса рассчитаны по отдельным инструментам. Связанные выпуски одного эмитента не объединяются. Нет раскрытия фондов, производных инструментов или виртуальных позиций. ${converted ? 'USD и EUR пересчитываются по проверенному сохранённому курсу ЦБ, действующему с указанной московской даты. Поиск ограничен 40 календарными днями; при отсутствии курса строка исключается. Это рублёвая оценка, не измерение валютного риска бизнеса эмитента. Сохранённая копия курса не подтверждает, что он был известен на момент наблюдения.' : 'В этом составе включены только цены в RUB.'} ${coverage?.virtualPositions === 'present-excluded' ? 'В снимке есть виртуальные позиции: они исключены.' : coverage?.virtualPositions === 'explicit-zero' ? 'Исходный список виртуальных позиций пуст.' : 'Наличие виртуальных позиций не подтверждено.'}</p>
      ${bySector ? sectorView.method : sectors ? '<p>Режим «По секторам» группирует эти же позиции по сохранённой классификации брокера; подробности доступны в методе этого режима.</p>' : ''}
      <p>Это наблюдение состава на устройстве, а не доходность за выбранный период или текущая котировка. Количество лотов, средняя цена покупки, обеспечение и стоимость всего портфеля в формулах не используются. Пропуски не заменяются нулями.</p>
      <p>Стоимость сохраняет точность исходных количества и цены, до ${converted ? '27' : '18'} знаков после запятой${converted ? ' с учётом курса' : ''}. Доли показаны до двух знаков; знак ≈ означает усечение. Положительная доля меньше 0,01 % показана явно. Для HHI используются точные доли до отображения.</p></details>
      </div></details>`;
    comparison?.update(current, matches ? dto : null);
    host.querySelector('.concentration-body').append(comparisonHost);
    if (focused) focus(reset ? 'main' : focused);
  }
  host?.addEventListener('toggle', event => {
    if (event.target === host.querySelector('[data-concentration-main]') && !event.target.open) comparison?.reset();
  }, true);
  host?.addEventListener('click', event => {
    const group = event.target.closest?.('[data-concentration-group]')?.dataset.concentrationGroup;
    if (['positions', 'sectors'].includes(group)) { grouping = group; shown = 5; render({ focused: 'group-' + group }); return; }
    if (!event.target.closest?.('[data-concentration-more]')) return;
    const nextRow = shown + 1; shown += 8; render({ focused: 'row-' + nextRow });
  });
  host?.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const details = event.target.closest?.('details[open]');
    if (!details || !host.contains(details)) return;
    details.open = false; details.querySelector(':scope>summary')?.focus(); event.preventDefault(); event.stopPropagation();
  });
  return { contextChanged: () => comparison?.reset(), getAccessToken: () => comparison?.getAccessToken(),
    rejectAccess: token => comparison?.rejectAccess(token), dispose: () => comparison?.dispose(), update(data) {
    if (!host) return;
    current = data;
    const nextScope = JSON.stringify([data?.identity?.preferenceScope, data?.savedResearch?.ownerScope,
      data?.clientProduct?.portfolios?.map(row => [row.id, row.preferenceKey]), data?.selectedPeriod?.from, data?.selectedPeriod?.to]);
    const next = JSON.stringify([nextScope, data?.portfolio?.directShareConcentration, data?.portfolio?.directShareSectors, data?.capabilities?.directShareComparison, data?.directShareComparisonContext, data?.preview, data?.priceAlerts?.accessRevision]); if (next === signature) return;
    const reset = scope !== nextScope || signature && data?.portfolio?.directShareConcentration?.calculationSnapshotId !== host.dataset.snapshot;
    const active = host.contains(document.activeElement);
    if (reset) { shown = 5; grouping = 'positions'; }
    scope = nextScope; signature = next; host.dataset.snapshot = data?.portfolio?.directShareConcentration?.calculationSnapshotId || '';
    render({ reset: Boolean(reset), focused: active ? 'main' : null });
  } };
}
