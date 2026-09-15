(function () {
  'use strict';
  var tour = document.getElementById('invest-tour');
  if (!tour) return;

  // Illustrative inputs only. This module never connects to an account or provider.
  var terms = {1: 1490, 3: 3990, 12: 14900};
  var selectedTerm = 1;
  var selectedFilter = 'all';
  var contribution = document.getElementById('demo-contribution');
  var copy = {
    ru: {
      duration: {1: 'Всего за 1 месяц', 3: 'Всего за 3 месяца', 12: 'Всего за 1 год'},
      monthly: 'Месячный вариант без скидки за срок. Во всех вариантах одинаковые возможности.',
      prepaid: function (total, baseline) { return 'За весь выбранный срок — ' + total + '. При оплате по месяцам получилось бы ' + baseline + '. Возможности плана одинаковые.'; },
      positive: function (amount, result) { return amount + ' внесены вами. Оставшиеся ' + result + ' — изменение стоимости без этого пополнения.'; },
      negative: 'Пополнения больше разницы между начальной и конечной стоимостью. Даже при росте суммы на счёте результат без взносов может быть отрицательным.',
      zero: 'Вся разница объясняется пополнениями. Изменение стоимости без внесённых денег равно нулю.',
      all: 'Показаны все 5 операций. Сумма движений денег не равна прибыли портфеля.',
      deposit: '2 пополнения, всего 200 000 ₽. Это внесённые деньги, а не заработанная прибыль.',
      fee: '2 комиссии, всего 120 ₽ расходов. Покупки и пополнения скрыты фильтром.'
    },
    en: {
      duration: {1: 'Total for 1 month', 3: 'Total for 3 months', 12: 'Total for 1 year'},
      monthly: 'The monthly option has no term discount. Every duration includes the same features.',
      prepaid: function (total, baseline) { return 'The full selected term costs ' + total + '. Paying monthly would cost ' + baseline + '. Plan features are the same.'; },
      positive: function (amount, result) { return amount + ' was added by you. The remaining ' + result + ' is the change in value excluding that deposit.'; },
      negative: 'Deposits exceed the difference between the starting and ending values. The result excluding deposits can be negative even when the account total grows.',
      zero: 'Deposits account for the entire difference. The change in value excluding your added money is zero.',
      all: 'All 5 transactions are shown. Adding cash movements together does not give portfolio profit.',
      deposit: '2 deposits, RUB 200,000 in total. This is money added, not profit earned.',
      fee: '2 fees, RUB 120 in total expenses. Purchases and deposits are hidden by the filter.'
    }
  };

  function language() { return document.documentElement.lang === 'en' ? 'en' : 'ru'; }
  function number(value, fractionDigits) {
    return new Intl.NumberFormat(language() === 'ru' ? 'ru-RU' : 'en-GB', {maximumFractionDigits: fractionDigits || 0}).format(value);
  }
  function money(value) { return language() === 'ru' ? number(value) + ' ₽' : 'RUB ' + number(value); }
  function write(id, value) { document.getElementById(id).textContent = value; }

  function renderPortfolio() {
    var amount = Math.max(0, Math.min(300000, Number(contribution.value) || 0));
    var result = 1240000 - 1000000 - amount;
    var strings = copy[language()];
    write('contribution-value', money(amount));
    contribution.setAttribute('aria-valuetext', money(amount));
    write('portfolio-result', (result > 0 ? '+' : result < 0 ? '−' : '') + money(Math.abs(result)));
    write('portfolio-equation', number(1240000) + ' − ' + number(1000000) + ' − ' + number(amount) + ' = ' + money(result));
    write('portfolio-explanation', result > 0 ? strings.positive(money(amount), money(result)) : result < 0 ? strings.negative : strings.zero);
    document.querySelector('.example-result').dataset.result = result < 0 ? 'negative' : result > 0 ? 'positive' : 'zero';
  }

  function renderOperations() {
    tour.querySelectorAll('[data-operation-filter]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.operationFilter === selectedFilter));
    });
    tour.querySelectorAll('[data-operation-kind]').forEach(function (row) {
      row.hidden = selectedFilter !== 'all' && row.dataset.operationKind !== selectedFilter;
    });
    write('operation-summary', copy[language()][selectedFilter]);
  }

  function renderTerm() {
    var total = terms[selectedTerm];
    var baseline = terms[1] * selectedTerm;
    var saving = baseline - total;
    write('term-duration', copy[language()].duration[selectedTerm]);
    write('term-total', money(total));
    write('term-monthly', (total % selectedTerm ? '≈ ' : '') + money(Math.round(total / selectedTerm)));
    write('term-saving', money(saving) + (saving ? ' (' + number(saving / baseline * 100, 1) + '%)' : ''));
    write('term-explanation', selectedTerm === 1 ? copy[language()].monthly : copy[language()].prepaid(money(total), money(baseline)));
  }

  var tabs = Array.from(tour.querySelectorAll('[data-tour-tab]'));
  function activateTab(name, focus) {
    tabs.forEach(function (button) {
      var selected = button.dataset.tourTab === name;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    tour.querySelectorAll('[data-tour-panel]').forEach(function (panel) {
      panel.hidden = panel.dataset.tourPanel !== name;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'tour-tab-' + panel.dataset.tourPanel);
      panel.tabIndex = 0;
    });
  }
  tabs.forEach(function (button, index) {
    button.addEventListener('click', function () { activateTab(button.dataset.tourTab, false); });
    button.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateTab(tabs[next].dataset.tourTab, true);
    });
  });
  contribution.addEventListener('input', renderPortfolio);
  tour.querySelectorAll('[data-operation-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      selectedFilter = button.dataset.operationFilter;
      renderOperations();
    });
  });
  document.querySelectorAll('input[name="invest-term"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (!input.checked || !Object.hasOwn(terms, input.value)) return;
      selectedTerm = Number(input.value);
      renderTerm();
    });
  });
  function renderDynamicCopy() { renderPortfolio(); renderOperations(); renderTerm(); }
  function restoreControls() {
    var checked = document.querySelector('input[name="invest-term"]:checked');
    selectedTerm = checked && Object.hasOwn(terms, checked.value) ? Number(checked.value) : 1;
    renderDynamicCopy();
  }
  document.addEventListener('nexus:language-change', renderDynamicCopy);
  window.addEventListener('pageshow', restoreControls);
  restoreControls();
  activateTab('portfolio', false);
  tour.querySelector('[data-tour-tabs]').hidden = false;
  tour.querySelector('[data-operation-filters]').hidden = false;
  tour.querySelector('[data-interactive-control]').hidden = false;
  document.querySelector('.invest-prices').hidden = true;
  document.getElementById('subscription-calculator').hidden = false;
})();
