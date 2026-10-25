// Presentation of fixed, authored expressions. Never parse or execute a formula
// supplied by a source, a saved file, or an AI response.
const escape = value => String(value ?? '').replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const row = (...items) => '<mrow>' + items.join('') + '</mrow>';
const id = value => '<mi>' + escape(value) + '</mi>';
const word = value => '<mtext>' + escape(value) + '</mtext>';
const num = value => '<mn>' + value + '</mn>';
const op = value => '<mo>' + escape(value) + '</mo>';
const sub = (base, label) => '<msub>' + id(base) + word(label) + '</msub>';
const fraction = (top, bottom) => '<mfrac>' + top + bottom + '</mfrac>';
const power = (base, exponent) => '<msup>' + base + exponent + '</msup>';
const parens = value => row(op('('), value, op(')'));
const percent = row(op('×'), num(100), op('%'));
const equation = (left, right) => row(left, op('='), right);
const minus = (a, b) => row(a, op('−'), b);
const days = fraction(sub('d', 'i'), num(365));
const growth = parens(row(num(1), op('+'), id('r')));
const navChange = row(sub('V', 'кон'), op('−'), sub('V', 'нач'), op('−'), id('F'));
const definitions = {
  twr: { expression: equation(id('TWR'), minus(fraction(sub('V', 'кон'), sub('V', 'нач')), num(1))),
    spoken: 'TWR без денежных потоков равен конечной оценке, делённой на начальную, минус один.',
    variables: [['V_нач, V_кон', 'Начальная и конечная оценки портфеля. Для этой формулы между ними не должно быть внешних потоков.']] },
  xirr: { expression: equation(row(op('∑'), fraction(sub('CF', 'i'), power(growth, days))), num(0)),
    spoken: 'XIRR: сумма денежных потоков CF с индексом i, делённых на один плюс r в степени d с индексом i, делённое на 365, равна нулю.',
    variables: [['CF_i', 'Поток со стороны владельца: начальная оценка и пополнения — минус; выводы и конечная оценка — плюс.'], ['d_i', 'Число календарных дней от начальной даты до потока.'], ['r', 'Искомая годовая ставка.']] },
  periodEquivalent: { expression: equation(sub('r', 'период'), minus(power(growth, fraction(id('d'), num(365))), num(1))),
    spoken: 'Эквивалент за период равен одному плюс годовая ставка r в степени число дней, делённое на 365, минус один.',
    variables: [['d', 'Число дней фактического интервала.'], ['r', 'Годовая ставка XIRR.']] },
  bookedResult: { expression: equation(id('R'), navChange),
    spoken: 'Результат равен конечной оценке минус начальная оценка минус пополнения за вычетом выводов.',
    variables: [['V_нач, V_кон', 'Сохранённые оценки в начале и в конце.'], ['F', 'Пополнения минус выводы за интервал.']] },
  bookedRemainder: { expression: equation(id('U'), minus(id('R'), id('C'))),
    spoken: 'Необъяснённый остаток равен результату между оценками минус сумма подтверждённых денежных операций.',
    variables: [['R', 'Результат между сохранёнными оценками после внешних потоков.'], ['C', 'Сумма подтверждённых операций со знаком.'], ['U', 'Остаток, причины которого ещё не установлены.']] },
  referencePrice: { expression: equation(id('r'), minus(fraction(sub('P', 'кон'), sub('P', 'нач')), num(1))),
    spoken: 'Изменение котировки равно конечной цене закрытия, делённой на начальную, минус один.',
    variables: [['P_нач, P_кон', 'Начальная и конечная сохранённые цены закрытия; выплаты не входят.']] },
  vm: { expression: equation(id('VM'), row(parens(minus(sub('P', 'тек'), sub('P', 'расч'))), op('×'), fraction(id('C'), id('S')), op('×'), id('N'))),
    spoken: 'Вариационная маржа равна разности текущей и предыдущей расчётной цены, умноженной на стоимость шага, делённую на шаг цены, и на число контрактов со знаком.',
    variables: [['P_тек', 'Текущая расчётная цена.'], ['P_расч', 'Цена предыдущего клиринга или открытия.'], ['C', 'Денежная стоимость шага цены.'], ['S', 'Минимальный шаг цены.'], ['N', 'Число контрактов: плюс для длинной позиции, минус для короткой.']] },
  periodInstruments: { expression: equation(id('w'), row(fraction(sub('P&L', 'i'), row(op('|'), op('∑'), id('P&L'), op('|'))), percent)),
    spoken: 'Доля результата инструмента равна его денежному результату, делённому на модуль суммы известных результатов той же валюты, умноженному на сто процентов.',
    variables: [['P&L_i', 'Денежный результат инструмента.'], ['Σ P&L', 'Сумма известных результатов в одной валюте; при нуле доля не определена.']] },
  profitFactor: { expression: equation(id('PF'), fraction(sub('P', '+'), row(op('|'), sub('P', '−'), op('|')))),
    spoken: 'Профит-фактор равен сумме прибыльных результатов, делённой на модуль суммы убыточных результатов.',
    variables: [['P_+', 'Сумма положительных net P&L закрытых сделок.'], ['P_−', 'Сумма отрицательных net P&L в той же валюте.']] },
  winRate: { expression: equation(id('WR'), row(fraction(sub('N', '+'), id('N')), percent)),
    spoken: 'Винрейт равен числу прибыльных закрытых сделок, делённому на число всех закрытых сделок, умноженному на сто процентов.',
    variables: [['N_+', 'Количество прибыльных закрытых сделок.'], ['N', 'Все закрытые сделки выбранной выборки.']] },
  drawdown: { expression: equation(id('DD'), row(fraction(minus(sub('V', 'дно'), sub('V', 'пик')), sub('V', 'пик')), percent)),
    spoken: 'Изменение от пика равно дну минус пик, делённому на пик, умноженному на сто процентов.',
    variables: [['V_пик', 'Значение на локальном максимуме.'], ['V_дно', 'Последующий минимум. Величина просадки берётся по модулю.']] },
  netReturn: { expression: equation(sub('r', 'net'), row(fraction(navChange, sub('V', 'нач')), percent)),
    spoken: 'Результат к начальному капиталу равен конечному капиталу минус начальный капитал минус пополнения за вычетом выводов, делённому на начальный капитал, умноженному на сто процентов.',
    variables: [['V_нач, V_кон', 'Начальная и конечная стоимость портфеля.'], ['F', 'Пополнения минус выводы. Комиссии уже отражены в стоимости.']] },
  grossReturn: { expression: equation(sub('r', 'gross'), row(fraction(row(sub('R', 'net'), op('+'), id('C')), sub('V', 'нач')), percent)),
    spoken: 'Результат до явных комиссий равен чистому результату плюс явные комиссии, делённому на начальный капитал, умноженному на сто процентов.',
    variables: [['R_net', 'Чистый денежный результат.'], ['C', 'Учтённые явные комиссии.'], ['V_нач', 'Начальная стоимость портфеля.']] },
  volatility: { expression: equation(id('σ'), '<msqrt>' + fraction(row(op('∑'), power(parens(minus(sub('R', 'i'), '<mover>' + id('R') + op('¯') + '</mover>')), num(2))), minus(id('N'), num(1))) + '</msqrt>'),
    spoken: 'Выборочное стандартное отклонение равно квадратному корню из суммы квадратов отклонений изменений от среднего, делённой на число наблюдений минус один.',
    variables: [['R_i', 'Изменение за один равный интервал.'], ['R̄', 'Среднее изменение.'], ['N', 'Количество наблюдений; пересчёт на год здесь не выполняется.']] },
  fifoRealized: { expression: equation(sub('P&L', 'FIFO'), minus(row(op('∑'), parens(minus(sub('P', 'прод'), sub('P', 'покуп'))), op('×'), id('Q')), id('C'))),
    spoken: 'Результат FIFO равен сумме разностей цен продажи и соответствующей ранней покупки, умноженных на количество, минус комиссии.',
    variables: [['P_прод, P_покуп', 'Цена продажи и цена соответствующей ранней покупки.'], ['Q', 'Количество в единицах, соответствующих цене.'], ['C', 'Учтённые комиссии.']] },
  unrealizedPnl: { expression: equation(id('P&L'), row(parens(minus(sub('P', 'тек'), sub('P', 'сред'))), op('×'), id('Q'))),
    spoken: 'Нереализованный результат равен текущей цене минус средняя цена покупки, умноженному на количество.',
    variables: [['P_тек', 'Текущая цена оценки.'], ['P_сред', 'Средняя цена покупки.'], ['Q', 'Количество в единицах, соответствующих цене.']] },
  fees: { expression: equation(id('C'), row(op('∑'), op('|'), sub('C', 'i'), op('|'), op('×'), sub('FX', 'i'))),
    spoken: 'Комиссии в рублях равны сумме модулей комиссий, каждая умножена на её исторический валютный курс.',
    variables: [['C_i', 'Комиссия операции в исходной валюте.'], ['FX_i', 'Рублёвый курс на дату этой операции.']] },
  guaranteeMargin: { expression: equation(word('ГО'), row(sub('M', 'биржа'), op('×'), id('k'), op('×'), id('N'))),
    spoken: 'Гарантийное обеспечение равно базовому обеспечению биржи, умноженному на коэффициент риска брокера и число контрактов.',
    variables: [['M_биржа', 'Базовое обеспечение одного контракта.'], ['k', 'Коэффициент риска брокера.'], ['N', 'Число контрактов.']] },
  liquidPortfolio: { expression: equation(id('L'), row(id('C'), op('+'), op('∑'), sub('V', 'i'), op('×'), parens(minus(num(1), sub('h', 'i'))))),
    spoken: 'Ликвидный портфель равен свободным рублям плюс сумма стоимостей активов после дисконтов риска.',
    variables: [['C', 'Свободные рубли.'], ['V_i', 'Стоимость актива.'], ['h_i', 'Дисконт риска актива.']] },
  marginBuffer: { expression: equation(id('B'), row(id('max'), parens(row(num(0), op(','), minus(id('L'), id('M')))))),
    spoken: 'Запас равен максимуму из нуля и ликвидного портфеля минус начальная маржа.',
    variables: [['L', 'Ликвидный портфель.'], ['M', 'Начальная маржа.']] },
};

export function financialFormula(key, fallback = '') {
  const value = Object.hasOwn(definitions, key) ? definitions[key] : null;
  if (!value) return fallback ? '<p class="financial-formula-fallback">' + escape(fallback) + '</p>' : '';
  return '<div class="financial-formula" data-formula="' + escape(key) + '" tabindex="0" role="region" aria-label="Формула: ' + escape(value.spoken) + '"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="' + escape(value.spoken) + '">' + value.expression + '</math></div>';
}
export function financialVariable(value) {
  return String(value ?? '').split(', ').map(part => {
    const index = part.indexOf('_');
    return index > 0 ? '<var>' + escape(part.slice(0, index)) + '</var><sub>' + escape(part.slice(index + 1).replaceAll('_', ' ')) + '</sub>' : escape(part);
  }).join(', ');
}
export function financialFormulaVariables(key, fallback = []) {
  const rows = Object.hasOwn(definitions, key) ? definitions[key].variables : fallback.map(({ name, desc }) => [name, desc]);
  return rows.length ? '<dl class="financial-formula-variables">' + rows.map(([name, desc]) => '<div><dt>' + financialVariable(name) + '</dt><dd>' + escape(desc) + '</dd></div>').join('') + '</dl>' : '';
}
