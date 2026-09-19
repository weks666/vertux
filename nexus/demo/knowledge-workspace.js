import { TERM_EXAMPLES } from './term-examples.js';
const escape = value => String(value ?? '').replace(/[&<>"']/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function glossaryEntries(terms, { category = 'all', query = '', direction = 'asc' } = {}) {
  const search = query.trim().toLocaleLowerCase('ru');
  return Object.entries(terms).filter(([, term]) => (category === 'all' || term.category === category)
    && (!search || [term.abbr, term.name, term.nameEn, term.summary, term.details, term.formula, term.example]
      .some(value => String(value || '').toLocaleLowerCase('ru').includes(search))))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ru') * (direction === 'desc' ? -1 : 1));
}

const arrow = '<svg class="term-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
const categoryTone = category => /Фьючерс/.test(category) ? 'amber' : /Доходность/.test(category) ? 'green' : /Сделк/.test(category) ? 'blue' : 'violet';

function drawdownChart() {
  // Illustrative series, scaled to the amounts in the existing worked example.
  const anchors = [[0, 900], [24, 1000], [43, 850], [65, 920], [77, 890], [100, 985]];
  const points = Array.from({length:101}, (_, i) => {
    const right = anchors.findIndex(([x]) => x >= i);
    if (!right) return [72, 138];
    const [x0, y0] = anchors[right - 1], [x1, y1] = anchors[right];
    const t = (i - x0) / (x1 - x0);
    const value = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * (Math.sin(i * 2.3) * 8 + Math.sin(i * .72) * 6);
    return [72 + i * 7, 198 - (value - 800) * .6];
  });
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return `<figure class="term-drawdown-example"><figcaption>Пример максимальной просадки <small>Учебные данные</small></figcaption><svg viewBox="0 0 820 240" role="img" aria-label="Учебный пример: пик 1 000 000 рублей, минимум 850 000 рублей. Снижение 15 процентов."><defs><linearGradient id="drawdownArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#865dff" stop-opacity=".3"/><stop offset="1" stop-color="#865dff" stop-opacity="0"/></linearGradient></defs>${[800,850,900,950,1000].map(v=>`<path class="example-guide" d="M72 ${198-(v-800)*.6}H772"/><text class="example-axis" x="59" y="${202-(v-800)*.6}" text-anchor="end">${v===1000?'1,0 млн':v+' тыс.'}</text>`).join('')}<path style="fill:url(#drawdownArea);stroke:none" d="${path}V198H72Z"/><path class="example-fall" d="${path}"/><path class="example-drop" d="M240 78H399M373 82V164m-5-77 5-5 5 5m-10 72 5 5 5-5"/><circle cx="240" cy="78" r="5"/><circle class="example-trough" cx="373" cy="168" r="5"/><text class="example-peak-label" x="240" y="34" text-anchor="middle">Пик</text><text x="240" y="56" text-anchor="middle">1 000 000 ₽</text><text class="example-loss" x="393" y="129">−15%</text><text x="426" y="190">Дно · 850 000 ₽</text>${['Янв','Фев','Мар','Апр','Май','Июн'].map((m,i)=>`<text class="example-axis" x="${72+i*140}" y="229" text-anchor="${i===0?'start':i===5?'end':'middle'}">${m}</text>`).join('')}</svg></figure>`;
}

export function glossaryMarkup(entries, selected, allTerms = Object.fromEntries(entries)) {
  if (!entries.length) return { selected: null, list: '<p class="empty-copy">Ничего не найдено. Попробуйте другое слово или категорию.</p>', detail: '' };
  const key = entries.some(([id]) => id === selected) ? selected : entries[0][0];
  const term = entries.find(([id]) => id === key)[1];
  const relatedKeys = key === 'drawdown' ? ['volatility', 'netReturn', 'grossReturn', 'unrealizedPnl'] : [];
  const related = relatedKeys.length ? relatedKeys.filter(id => allTerms[id]).map(id => [id, allTerms[id]]) : Object.entries(allTerms).filter(([id, item]) => id !== key && item.category === term.category).slice(0, 4);
  // The diagram uses the same two amounts as the existing educational example, never portfolio data.
  const formula = key === 'drawdown' ? '<div class="term-math" aria-label="Просадка равна дну минус пик, делённому на пик, умноженному на 100 процентов"><var>DD</var><span>=</span><span class="math-fraction"><span><var>V</var><sub>дно</sub> − <var>V</var><sub>пик</sub></span><span><var>V</var><sub>пик</sub></span></span><span>× 100%</span></div><p class="math-legend"><var>V</var><sub>пик</sub> — значение на локальном максимуме.<br><var>V</var><sub>дно</sub> — последующий минимум.</p>' : `<p class="term-formula-text">${escape(term.formula)}</p>${term.variables?.length ? `<dl class="term-variables">${term.variables.map(value => `<div><dt>${escape(value.name)}</dt><dd>${escape(value.desc)}</dd></div>`).join('')}</dl>` : ''}`;
  const worked = TERM_EXAMPLES[key];
  const example = worked ? `<dl class="term-example-values">${worked.rows.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}${worked.calculation ? `<div class="term-calculation"><dt>Расчёт</dt><dd>${escape(worked.calculation)}</dd></div>` : ''}<div class="term-example-result ${worked.tone || ''}"><dt>${escape(worked.result[0])}</dt><dd>${escape(worked.result[1])}</dd></div></dl>${worked.note ? `<p class="term-example-note">${escape(worked.note)}</p>` : ''}` : `<p>${escape(term.example)}</p>`;
  const definition = key === 'drawdown' ? 'Максимальная просадка — наибольшее снижение стоимости актива или портфеля от локального максимума до последующего минимума, выраженное в процентах.' : term.summary;
  const tone = categoryTone(term.category || '');
  return {
    selected: key,
    list: entries.map(([id, item]) => `<button type="button" class="glossary-term${id === key ? ' active' : ''}" data-glossary-term="${escape(id)}" aria-pressed="${id === key}" aria-controls="glossaryDetail"><strong>${escape(item.name)}</strong><small class="tone-${categoryTone(item.category || '')}">${escape(item.category || '')}</small><span title="${escape(item.summary)}">${escape(item.summary)}</span>${arrow}</button>`).join(''),
    detail: `<header class="glossary-detail-head"><h3 id="glossaryDetailTitle">${escape(term.name)}</h3><span class="term-category tone-${tone}">${escape(term.category || '')}</span></header><p class="glossary-definition">${escape(definition)}</p>${key === 'drawdown' ? drawdownChart() : ''}<div class="term-explanation">${term.formula?.trim() ? `<section><h4>Формула</h4>${formula}</section>` : ''}${worked || term.example ? `<section class="term-worked-example"><h4>${worked?.calculation ? 'Числовой пример' : 'Пример'}</h4>${example}</section>` : ''}</div>${term.details && key !== 'drawdown' ? `<details class="term-more"><summary>Как понимать показатель</summary><p>${escape(term.details)}</p></details>` : ''}${related.length ? `<footer class="term-resources"><section class="term-related"><h4><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6"/></svg>Похожие термины</h4><div>${related.map(([id, item]) => `<button type="button" class="button secondary" data-glossary-related="${escape(id)}">${escape(item.name)}${arrow}</button>`).join('')}</div></section></footer>` : ''}`,
  };
}

export function initRiskTabs(root = document) {
  const journal = root.querySelector?.('#myTradingPlan');
  if (journal) { journal.dataset.riskPanel = 'journal'; journal.setAttribute('role', 'tabpanel'); journal.setAttribute('aria-labelledby', 'riskJournalTab'); }
  const generated = root.querySelector?.('.risk-plan-layout');
  if (generated) generated.dataset.riskPanel = 'journal';
  root.querySelector?.('#riskJournalTab')?.setAttribute('aria-controls', 'myTradingPlan');
  const tabs = [...root.querySelectorAll('[data-risk-tab]')];
  if (!tabs.length) return;
  const select = value => {
    for (const tab of tabs) {
      const active = tab.dataset.riskTab === value;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle('active', active);
    }
    for (const panel of root.querySelectorAll('[data-risk-panel]')) panel.hidden = panel.dataset.riskPanel !== value;
  };
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => select(tab.dataset.riskTab));
    tab.addEventListener('keydown', event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); select(tabs[next].dataset.riskTab); tabs[next].focus();
    });
  }
  select('journal');
  root.addEventListener?.('click', event => {
    const jump = event.target.closest('[data-go-target]');
    const target = jump && root.querySelector('#' + CSS.escape(jump.dataset.goTarget));
    const panel = target?.closest('[data-risk-panel]');
    if (panel) select(panel.dataset.riskPanel);
  });
  return select;
}
