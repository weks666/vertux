export const EXECUTION_QUANTITY_VERSION = 'source-execution-quantity-v1';
const keys = 'basis,executedNanos,remainingNanos,reportedNanos,state,version';
const integer = value => typeof value === 'string' && /^(?:0|[1-9]\d{0,28})$/.test(value);
export function validExecutionQuantity(value) {
  if (!value || Object.keys(value).sort().join() !== keys || value.version !== EXECUTION_QUANTITY_VERSION
    || !['complete', 'partial'].includes(value.state) || !['complete-source-fills', 'native-done-rest'].includes(value.basis)
    || !['reportedNanos', 'executedNanos', 'remainingNanos'].every(key => integer(value[key]))) return false;
  const [reported, executed, remaining] = ['reportedNanos', 'executedNanos', 'remainingNanos'].map(key => BigInt(value[key]));
  return reported > 0n && reported <= 9223372036854775807000000000n && executed > 0n && reported === executed + remaining
    && [reported, executed, remaining].every(number => number % 1000000000n === 0n)
    && (value.state === 'complete' ? remaining === 0n : remaining > 0n && value.basis === 'native-done-rest');
}
