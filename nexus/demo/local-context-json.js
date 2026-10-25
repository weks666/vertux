// Identity serialization only. This does not validate a financial DTO, authorize
// its scope, or prove its source. Callers own those checks and resource limits.
// Object keys use JavaScript UTF-16 sort; arrays preserve their original order.
export function canonicalLocalResultJson(value) {
  const ancestors = new WeakSet();
  const invalid = () => { throw new TypeError('Canonical JSON requires plain JSON data.'); };
  function visit(row) {
    if (row === null || typeof row === 'boolean' || typeof row === 'string') return JSON.stringify(row);
    if (typeof row === 'number') {
      if (!Number.isFinite(row)) invalid();
      return JSON.stringify(row);
    }
    if (typeof row !== 'object') invalid();
    const array = Array.isArray(row), prototype = Object.getPrototypeOf(row);
    if (!array && prototype !== Object.prototype && prototype !== null) invalid();
    if (ancestors.has(row) || Object.getOwnPropertySymbols(row).length) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(row);
    const keys = Object.keys(descriptors).filter(key => !(array && key === 'length'));
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) invalid();
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= descriptors.length.value)) invalid();
    }
    if (array && keys.length !== descriptors.length.value) invalid();
    ancestors.add(row);
    let result;
    if (array) result = '[' + keys.map(key => visit(descriptors[key].value)).join(',') + ']';
    else result = '{' + keys.sort().map(key => JSON.stringify(key) + ':' + visit(descriptors[key].value)).join(',') + '}';
    ancestors.delete(row);
    return result;
  }
  return visit(value);
}
