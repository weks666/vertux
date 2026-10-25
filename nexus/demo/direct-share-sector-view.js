import { SHARE_SECTOR_REASONS, validateShareSectors } from './direct-share-sector-contract.js';
const sectorTitles = Object.freeze({ financial: 'Финансовый сектор', it: 'Технологии', energy: 'Энергетика', materials: 'Материалы', industrials: 'Промышленность', telecom: 'Телекоммуникации', consumer: 'Потребительский сектор', health_care: 'Здравоохранение', utilities: 'Электроэнергетика', real_estate: 'Недвижимость', ecomaterials: 'Экоматериалы', green_buildings: 'Зелёное строительство', green_energy: 'Зелёная энергетика', electrocars: 'Электромобили', other: 'Другое' });
const sectorTitle = value => Object.hasOwn(sectorTitles, value) ? sectorTitles[value] : value;

/** Rendering for the existing concentration tool; no transport or persistence. */
export function shareSectorView(dto, concentration, { esc, money, time, ratio, shown }) {
  if (!validateShareSectors(dto, concentration)) return { body: '<p role="status">Не удалось подтвердить разбивку выбранного состава по секторам. Перечитайте данные портфеля.</p>', method: '' };
  const { calculation: result, catalog } = dto;
  const position = key => concentration.rows.find(row => row.key === key);
  const unknown = result.unclassified;
  const metrics = result.state === 'unavailable' ? '<p>Нет подтверждённых позиций для разбивки по секторам.</p>'
    : `<p class="concentration-sector-coverage" data-sector-coverage>Сектор известен для <strong>${result.classifiedRows} из ${result.classifiedRows + result.unclassifiedRows}</strong> включённых акций · <strong data-sector-known-weight>${esc(ratio(result.classifiedWeight))}</strong> абсолютной стоимости.</p>`;
  const entry = (row, index, unclassified = false) => `<tr ${unclassified ? 'data-sector-unknown' : 'data-sector-row'}><th scope="row" ${unclassified ? '' : `tabindex="-1" data-concentration-row="${index + 1}"`}>${esc(unclassified ? 'Сектор не подтверждён' : sectorTitle(row.sector))}<small>Позиций: ${row.positionKeys.length}</small></th><td data-sector-gross><span class="sector-mobile-label">Абсолютная стоимость</span>${esc(money(row.gross))}<small>Длинные ${esc(money(row.long))}<br>Короткие ${esc(money(row.short))}</small></td><td><span class="sector-mobile-label">Доля</span><span data-sector-weight>${esc(ratio(row.weight))}</span></td></tr>`;
  const table = result.state === 'unavailable' ? '' : `<table data-sector-table><caption>Секторы по классификации брокера · доля всех включённых акций</caption><thead><tr><th scope="col">Сектор</th><th scope="col">Абсолютная стоимость</th><th scope="col">Доля</th></tr></thead><tbody>${result.sectors.slice(0, shown).map((row, index) => entry(row, index)).join('')}${unknown?.positionKeys.length ? entry(unknown, 0, true) : ''}</tbody></table>
    ${result.sectors.length > shown ? `<p class="concentration-caption">Показано ${shown} из ${result.sectors.length} известных секторов.</p><button type="button" class="button" data-concentration-more>Показать ещё секторы</button>` : ''}`;
  const unknownRows = dto.assignments.filter(row => row.sector === null);
  const reason = catalog.state === 'saved' ? '' : `<p class="concentration-caption" data-sector-catalog-state="${catalog.state}">${esc(SHARE_SECTOR_REASONS[catalog.state])}</p>`;
  return {
    body: metrics + (result.sectors.length ? `<p>Крупнейший известный сектор: <strong>${esc(sectorTitle(result.sectors[0].sector))}</strong> · <strong data-sector-largest>${esc(ratio(result.largestKnownWeight))}</strong>.</p>` : '') + table + reason,
    method: `<p>Сектор берётся из сохранённого каталога акций Т‑Инвест по точному идентификатору инструмента, типу и валюте. Это классификация брокера; она не объединяет эмитентов и не раскрывает фонды. Время получения каталога: <strong data-sector-catalog-time>${esc(time(catalog.capturedAt))}</strong>. Период действия классификации у источника не подтверждён.</p>
      <p>Из сохранённых копий выбирается последняя, полученная не позже наблюдения состава и ещё свежая на тот момент. Новые копии сохраняются при получении; история прежних каталогов не восстанавливается. Более поздние сведения не переносятся на старую дату. Срок свежести — технический срок кеша, а не подтверждение неизменности сектора.</p>
      <p>Абсолютная стоимость сектора = сумма модулей стоимостей его акций; длинные и короткие позиции не погашают друг друга. Знаковая стоимость = длинные − короткие. Знаменатель доли сохраняет все включённые акции, включая строки без подтверждённого сектора. Неизвестная часть не считается отдельным экономическим сектором; общий HHI по секторам не рассчитывается.</p>
      ${unknownRows.length ? `<p>Причины отсутствия классификации:</p><ul data-sector-reasons>${unknownRows.map(row => `<li><strong>${esc(position(row.key)?.ticker || 'Позиция ' + row.key.slice(9))}</strong>: ${esc(SHARE_SECTOR_REASONS[row.reason])}</li>`).join('')}</ul>` : ''}`,
  };
}
