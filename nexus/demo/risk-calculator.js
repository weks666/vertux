const PPM = 1_000_000n;

const unavailable = (state, reason) => ({ state, reason, riskBudgetNanos: null,
  lossPerLotNanos: null, lots: null, units: null, positionAmountNanos: null,
  actualRiskNanos: null, execution: 'none' });
const positive = value => typeof value === 'string' && /^\d{1,30}$/.test(value) && BigInt(value) > 0n;
const roundUp = (value, divisor) => (value + divisor - 1n) / divisor;

/** Pure manual scenario calculation. No broker access, order or persistence. */
export function calculateRiskDraft(input = {}) {
  const { capitalNanos, riskPpm, riskBudgetNanos, entryPriceNanos, stopPriceNanos, lotSize,
    direction = 'long', assetType = 'share', minPriceIncrementNanos,
    minPriceIncrementAmountNanos, guaranteePerLotNanos } = input;
  const explicitBudget = riskBudgetNanos !== undefined;
  const riskInput = explicitBudget ? riskBudgetNanos : riskPpm;
  if ([capitalNanos, riskInput, entryPriceNanos, stopPriceNanos, lotSize].some(value => value === '' || value == null)) {
    return unavailable('input_required', 'Укажите капитал для расчёта, допустимый убыток, цену входа, стоп-цену и размер лота.');
  }
  if (![capitalNanos, String(riskInput), entryPriceNanos, stopPriceNanos, String(lotSize)].every(positive)
    || (explicitBudget ? BigInt(riskInput) > BigInt(capitalNanos) : BigInt(riskInput) > PPM) || !['long', 'short'].includes(direction) || !['share', 'future'].includes(assetType)) {
    return unavailable('invalid', explicitBudget
      ? 'Введите положительные значения. Допустимый убыток не должен превышать капитал для расчёта.'
      : 'Нужны положительные значения; риск — больше 0 и не более 100% капитала.');
  }
  const capital = BigInt(capitalNanos);
  const entry = BigInt(entryPriceNanos);
  const stop = BigInt(stopPriceNanos);
  const lot = BigInt(lotSize);
  if ((direction === 'long' && stop >= entry) || (direction === 'short' && stop <= entry)) {
    return unavailable('invalid', direction === 'long'
      ? 'Для покупки стоп-цена должна быть ниже цены входа.'
      : 'Для короткой позиции стоп-цена должна быть выше цены входа.');
  }
  if (assetType === 'future' && (!positive(minPriceIncrementNanos) || !positive(minPriceIncrementAmountNanos))) {
    return unavailable('input_required', 'Для фьючерса укажите шаг цены и стоимость шага из параметров инструмента.');
  }
  if (guaranteePerLotNanos != null && guaranteePerLotNanos !== '' && !positive(guaranteePerLotNanos)) {
    return unavailable('invalid', 'Гарантийное обеспечение на лот должно быть положительным.');
  }
  const distance = entry > stop ? entry - stop : stop - entry;
  const budget = explicitBudget ? BigInt(riskBudgetNanos) : capital * BigInt(riskPpm) / PPM;
  const perLot = assetType === 'future'
    ? roundUp(distance * BigInt(minPriceIncrementAmountNanos) * lot, BigInt(minPriceIncrementNanos))
    : distance * lot;
  const notionalPerLot = assetType === 'future'
    ? roundUp(entry * BigInt(minPriceIncrementAmountNanos) * lot, BigInt(minPriceIncrementNanos))
    : entry * lot;
  let lots = budget / perLot;
  let capitalLimited = false;
  const capitalPerLot = assetType === 'share' ? notionalPerLot
    : positive(guaranteePerLotNanos) ? BigInt(guaranteePerLotNanos) : null;
  if (capitalPerLot && lots > capital / capitalPerLot) {
    lots = capital / capitalPerLot;
    capitalLimited = true;
  }
  return {
    state: 'calculated', reason: lots === 0n ? 'При выбранном риске и капитале не помещается даже один лот.' : '',
    riskBudgetNanos: budget.toString(), lossPerLotNanos: perLot.toString(),
    lots: lots.toString(), units: (lots * lot).toString(),
    positionAmountNanos: (lots * notionalPerLot).toString(), actualRiskNanos: (lots * perLot).toString(),
    stopDistanceNanos: distance.toString(), direction, assetType, capitalLimited,
    marginVerified: false, execution: 'none',
    warning: assetType === 'future'
      ? 'Сценарий по вашим ценам и риску. Доступный запас маржи брокера не проверяется; комиссии и проскальзывание не включены.'
      : direction === 'long'
        ? 'Номинал позиции ограничен заданным капиталом. Свободные деньги, доступность сделки, комиссии и проскальзывание не проверяются.'
        : 'Сценарий короткой позиции по вашим ценам и риску. Доступность заимствования, маржа, комиссии и проскальзывание не проверяются.',
  };
}
