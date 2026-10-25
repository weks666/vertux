import { LEGACY_COMPONENT_SCOPE, bookedComponentScopeText, bookedComponentTitle } from './booked-components-contract.js';

const titles = Object.freeze({ 'nav-result': 'Результат между оценками', 'known-components': 'Известная сумма компонентов',
  'unallocated-result': 'Остальной результат — ещё не разложен' });
function money(value) {
  if (value === null) return 'Нет данных';
  const negative = value.startsWith('-'), digits = negative ? value.slice(1) : value;
  const padded = digits.padStart(10, '0');
  const fraction = padded.slice(-9).replace(/0+$/, '');
  return (negative ? '−' : '') + padded.slice(0, -9).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (fraction ? ',' + fraction : '') + ' ₽';
}
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

/** Pure, code-owned prose; neither strings nor arithmetic are supplied by a model. */
export function renderLocalResultTemplate(packet) {
  const summary = packet.claimsAllowed.map(claim => {
    const fact = packet.facts.find(row => row.factId === claim.factIds[0]);
    return { claimId: claim.claimId, title: titles[claim.claimId], text: money(fact.value),
      valueNanos: fact.value, unit: fact.unit, state: fact.state, factRefs: [fact.factId], evidenceRefs: [...fact.evidenceRefs] };
  });
  const counts = packet.coverage;
  return freeze({ contractVersion: 'local-result-explanation-v1', packetId: packet.packetId, intent: packet.intent,
    title: 'Что известно о результате между оценками', state: packet.state,
    llmUsed: false, provider: null, model: null, usage: null,
    modeLabel: 'Объяснение по готовому расчёту · без AI-модели',
    sourceLabel: packet.source.dataMode === 'synthetic' ? 'Учебные данные' : 'Оценка по сохранённым данным',
    scope: { portfolioId: packet.context.portfolioId },
    period: { requestedFrom: packet.period.requestedFrom, requestedTo: packet.period.requestedTo,
      observedFrom: packet.period.observedFrom, observedTo: packet.period.observedTo,
      partialPeriod: packet.period.partialPeriod, boundaryPolicy: '(opening, closing]' },
    freshness: { state: 'unknown', asOf: packet.asOf, validUntil: null,
      reason: 'Свежесть относительно текущего источника не подтверждена; показан сохранённый расчёт.' },
    summary,
    basis: ['opening-nav', 'closing-nav', 'owner-flow-total'].map(id => {
      const row = packet.facts.find(fact => fact.factId === id);
      return { factRef: id, valueNanos: row.value, text: money(row.value), evidenceRefs: [...row.evidenceRefs] };
    }),
    method: 'Результат между оценками = конечная оценка − начальная оценка − (пополнения − выводы). Остальной результат = результат между оценками − известная сумма компонентов.',
    limitation: 'Компоненты частичные. Нераспределённая сумма не является подтверждённым ценовым или валютным результатом, ошибкой брокера либо остатком финансовой сверки.',
    observation: 'Время наблюдений не подтверждено как точное время состояния брокера. Запрошенный и наблюдаемый периоды показаны отдельно.',
    componentScope: bookedComponentScopeText(counts.componentScope),
    coverage: { knownComponentCount: counts.knownComponentCount, unknownComponentCount: counts.unknownComponentCount,
      candidateCount: counts.candidateCount, candidateScanComplete: counts.candidateScanComplete,
      externalFlowCount: counts.externalFlowCount, confirmedNoCandidates: counts.confirmedNoCandidates,
      absenceText: counts.confirmedNoCandidates ? (counts.componentScope !== LEGACY_COMPONENT_SCOPE ? 'В подтверждённом просмотре нет кандидатов поддерживаемых денежных компонентов; это не отсутствие всех доходов и расходов.' : 'В подтверждённом просмотре нет кандидатов отдельных брокерских комиссий; это не отсутствие всех расходов.') : null },
    gaps: packet.gaps.map(row => ({ code: row.code, reason: row.reason })),
    receipts: packet.receipts.map(row => ({ evidenceRef: row.ref, factRef: row.factId, title: bookedComponentTitle(row),
      operationType: row.operationType, at: row.at, currency: row.currency, signedNanos: row.signedNanos,
      text: row.signedNanos === null ? 'Нет данных' : money(row.signedNanos), coverage: row.coverage,
      reasonCode: row.reasonCode, reason: row.reason,
      destination: { kind: 'local-packet-evidence', packetId: packet.packetId, evidenceRef: row.ref } })),
  });
}


/** Recreate the expected prose and evidence topology from the displayed public
 * DTO. No financial calculation or authorization; the native packet factory
 * remains responsible for its validated inputs and trusted context. */
export function expectedLocalResultExplanation(dto,{packetId,receiptRefs}){
 if(!Array.isArray(receiptRefs)||receiptRefs.length!==dto.components.length)throw new TypeError('Receipt binding required');
 const fact=(factId,value,evidenceRefs)=>({factId,value,unit:'RUB-nanos',state:value===null?'unknown':'known',evidenceRefs});
 const receipts=dto.components.map((row,index)=>({...row,ref:receiptRefs[index],factId:'component-'+(index+1)}));
 const knownRefs=receipts.filter(row=>row.coverage==='source-confirmed').map(row=>row.ref);
 const subtotalRefs=knownRefs.length?knownRefs:dto.coverage.confirmedNoCandidates?['candidate-scan']:[];
 const basisRefs=['opening-nav','closing-nav','owner-flow-total'];
 const facts=[fact(basisRefs[0],dto.openingNanos,[basisRefs[0]]),fact(basisRefs[1],dto.closingNanos,[basisRefs[1]]),
  fact(basisRefs[2],dto.netExternalFlowNanos,[basisRefs[2]]),fact('nav-result',dto.navResultNanos,basisRefs),
  fact('known-components',dto.knownSubtotalNanos,subtotalRefs),fact('unallocated-result',dto.unallocatedRemainderNanos,[...basisRefs,...subtotalRefs])];
 return renderLocalResultTemplate({packetId,intent:'portfolio.result-components',state:dto.state,
  context:{portfolioId:dto.scope.portfolioIds[0]},period:dto.period,asOf:dto.period.observedTo,source:dto.evidence,
  facts,receipts,claimsAllowed:['nav-result','known-components','unallocated-result'].map(claimId=>({claimId,factIds:[claimId]})),
  coverage:{...dto.coverage,unknownComponentCount:dto.unknownComponentCount},gaps:dto.coverage.blockers});
}
