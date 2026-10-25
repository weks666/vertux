import { decimalNanos } from './number-format.js';

export const CURRENT_POSITION_RESULT_VERSION = 'current-position-result-v1';
export const currentPositionSourceReasons = Object.freeze({
 missing_snapshot: 'Сохранённый состав счёта отсутствует.',
 source_unavailable: 'Сохранённый источник не удалось проверить. Обновите состав портфеля.',
 projection_mismatch: 'Состав позиций расходится с сохранённым источником.',
 ambiguous_position: 'В сохранённом составе повторяется идентификатор позиции.',
 source_scan_limit: 'Состав превышает предел локальной проверки.',
 invalid_scope: 'Не удалось подтвердить выбранный счёт.'
});
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, list) => object(v) && Object.keys(v).sort().join('|') === [...list].sort().join('|');
const integer = v => typeof v === 'string' && /^-?(?:0|[1-9]\d{0,69})$/u.test(v) && v !== '-0';
const currency = v => typeof v === 'string' && /^[A-Z]{3}$/u.test(v) && v !== 'PTS';
const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/u.test(v);
const scope = v => typeof v === 'string' && /^portfolio-[1-9]\d{0,7}$/u.test(v);
const assetTypes = ['share','etf','bond','future','other'];
const rowKeys = ['instrumentUid','ticker','assetType','quantityNanos','amountNanos','currency','reasonCode'];
const accountKeys = ['portfolioId','label','snapshotAt','timeBasis','sourceState','positions'];
function validAccount(v) {
 if (!keys(v, accountKeys) || !scope(v.portfolioId) || !text(v.label, 180) || !Array.isArray(v.positions) || v.positions.length > 500) return false;
 if (v.sourceState !== 'verified') return Object.hasOwn(currentPositionSourceReasons, v.sourceState) && v.snapshotAt === null && v.timeBasis === null && v.positions.length === 0;
 if (!iso(v.snapshotAt) || !['client-observed','saved-snapshot'].includes(v.timeBasis)) return false;
 const seen = new Set();
 return v.positions.every(row => {
  if (!keys(row, rowKeys) || !text(row.instrumentUid,160) || !/^[A-Za-z0-9._:@/-]+$/u.test(row.instrumentUid) || seen.has(row.instrumentUid)
   || !text(row.ticker,80) || !assetTypes.includes(row.assetType) || !integer(row.quantityNanos) || BigInt(row.quantityNanos) === 0n) return false;
  seen.add(row.instrumentUid);
  return row.reasonCode === null ? row.assetType !== 'other' && integer(row.amountNanos) && currency(row.currency)
   : ['unverified_result','unsupported_asset'].includes(row.reasonCode) && row.amountNanos === null && row.currency === null
    && (row.reasonCode !== 'unsupported_asset' || row.assetType === 'other');
 });
}
export function currentPositionCurrencyGroups(rows) {
 const groups = new Map();
 for (const row of rows) {
  if (row.reasonCode !== null) continue;
  const group = groups.get(row.currency) || {currency:row.currency,amountNanos:0n,positions:0};
  group.amountNanos += BigInt(row.amountNanos);group.positions++;groups.set(row.currency,group);
 }
 return [...groups.values()].sort((a,b)=>a.currency.localeCompare(b.currency)).map(row=>({...row,amountNanos:row.amountNanos.toString()}));
}
export function createCurrentPositionResult(accounts = []) {
 if (!Array.isArray(accounts) || accounts.length > 100 || !accounts.every(validAccount)
  || new Set(accounts.map(row=>row.portfolioId)).size !== accounts.length) accounts = [];
 const rows = accounts.flatMap(row=>row.positions), knownPositions = rows.filter(row=>row.reasonCode === null).length;
 const unknownPositions = rows.length - knownPositions, unavailableAccounts = accounts.filter(row=>row.sourceState !== 'verified').length;
 const state = !accounts.length ? 'unavailable' : !rows.length && !unavailableAccounts ? 'empty'
  : !unknownPositions && !unavailableAccounts ? 'complete' : knownPositions ? 'partial' : 'unavailable';
 return {contractVersion:CURRENT_POSITION_RESULT_VERSION,state,positionCount:rows.length,knownPositions,unknownPositions,unavailableAccounts,
  amounts:currentPositionCurrencyGroups(rows),accounts};
}
export function validCurrentPositionResult(v) {
 try {
  if (!keys(v,['contractVersion','state','positionCount','knownPositions','unknownPositions','unavailableAccounts','amounts','accounts'])
   || v.contractVersion !== CURRENT_POSITION_RESULT_VERSION || !Array.isArray(v.accounts) || v.accounts.length > 100
   || !v.accounts.every(validAccount) || new Set(v.accounts.map(row=>row.portfolioId)).size !== v.accounts.length || !Array.isArray(v.amounts)) return false;
  const expected = createCurrentPositionResult(v.accounts);
  if (['state','positionCount','knownPositions','unknownPositions','unavailableAccounts'].some(k=>v[k] !== expected[k]) || v.amounts.length !== expected.amounts.length) return false;
  return v.amounts.every((row,i)=>keys(row,['currency','amountNanos','positions']) && Object.keys(row).every(k=>row[k] === expected.amounts[i][k]));
 } catch { return false; }
}
export function unavailableCurrentPositionAccount({portfolioId,label}, sourceState = 'source_unavailable') {
 return {portfolioId,label,snapshotAt:null,timeBasis:null,sourceState:Object.hasOwn(currentPositionSourceReasons,sourceState)?sourceState:'source_unavailable',positions:[]};
}
export function rescopeCurrentPositionResult(value, {portfolioId,label}) {
 return createCurrentPositionResult([validCurrentPositionResult(value) && value.accounts.length === 1
  ? {...value.accounts[0],portfolioId,label} : unavailableCurrentPositionAccount({portfolioId,label})]);
}
export function combineCurrentPositionResults(items = []) {
 if (!Array.isArray(items) || items.length > 100) return createCurrentPositionResult();
 return createCurrentPositionResult(items.map(item=> {
  const value = item.result;
  return validCurrentPositionResult(value) && value.accounts.length === 1 && value.accounts[0].portfolioId === item.portfolioId
   ? value.accounts[0] : unavailableCurrentPositionAccount(item);
 }));
}
export function currentPositionRubTotal(v) {
 if (!validCurrentPositionResult(v)) return null;
 if (v.state === 'empty') return '0';
 return v.state === 'complete' && v.amounts.length === 1 && v.amounts[0].currency === 'RUB' ? v.amounts[0].amountNanos : null;
}
const escape = v => String(v ?? '').replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const exactMoney = (row, locale) => (BigInt(row.amountNanos) > 0n ? '+' : '') + decimalNanos(row.amountNanos,{digits:9,locale}) + ' ' + row.currency;
const moneyList = (rows,locale) => '<dl class="current-result-amounts">' + rows.map(row=>'<div><dt>'+escape(row.currency)+'</dt><dd>'+escape(exactMoney(row,locale))+'</dd></div>').join('') + '</dl>';
export function currentPositionResultPresentation(input, {locale = 'ru', now = new Date()} = {}) {
 const v = validCurrentPositionResult(input) ? input : createCurrentPositionResult(), complete = v.state === 'complete';
 const headline = complete ? v.amounts.length <= 3 ? v.amounts.map(row=>exactMoney(row,locale)).join(' · ') : 'Оценки в '+v.amounts.length+' валютах'
  : v.state === 'partial' ? 'Частичная оценка' : v.state === 'empty' ? 'Нет позиций' : '—';
 const coverage = v.state === 'empty' ? 'В проверенном составе нет открытых позиций бумаг или контрактов.'
  : 'Подтверждено позиций: '+v.knownPositions+' из '+v.positionCount+'.'+(v.unavailableAccounts?' Состав не подтверждён у счетов: '+v.unavailableAccounts+'.':'');
 const note = !v.accounts.length ? 'Сохранённую оценку открытых позиций не удалось проверить.' : coverage+' Суммы сохраняют валюты источника.';
 const formatDate = value => new Intl.DateTimeFormat(locale === 'en'?'en-GB':'ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(new Date(value))+' МСК';
 const dateText = account => {
  if (!account.snapshotAt) return '';
  const age = now.getTime() - Date.parse(account.snapshotAt), freshness = age < 0 ? ' · время позже текущего' : age > 300000 ? ' · снимок требует обновления' : '';
  return (account.timeBasis === 'client-observed'?'Получено ':'Дата сохранённого снимка ')+formatDate(account.snapshotAt)+freshness;
 };
 const accounts = v.accounts.map(account=> {
  const known = account.positions.filter(row=>row.reasonCode === null).length, unknown = account.positions.filter(row=>row.reasonCode !== null);
  return '<section data-current-result-account="'+escape(account.portfolioId)+'"><h3>'+escape(account.label)+'</h3>'
   +(account.sourceState === 'verified'?'<p data-current-result-date>'+escape(dateText(account))+'</p>'+(v.accounts.length===1&&unknown.length&&known?'<p>Известная часть по валютам</p>':'')+moneyList(currentPositionCurrencyGroups(account.positions),locale)
    +(v.accounts.length>1?'<p>Подтверждено позиций: '+known+' из '+account.positions.length+'.</p>':'')
    +(unknown.length?'<ul>'+unknown.map(row=>'<li>'+escape(row.ticker)+' — '+(row.reasonCode === 'unsupported_asset'?'тип инструмента пока не поддерживается.':'результат или его валюта не подтверждены; подробности в строке позиции.')+'</li>').join('')+'</ul>':'')
    :'<p>'+escape(currentPositionSourceReasons[account.sourceState])+'</p>')+'</section>';
 }).join('');
 const differentDates = new Set(v.accounts.filter(row=>row.sourceState === 'verified').map(row=>row.snapshotAt)).size > 1;
 const html = '<details data-current-result-details><summary>Состав и источники оценки</summary><div class="current-result-body">'
  +'<p>'+escape(note)+'</p>'+(v.amounts.length&&v.accounts.length>1?'<p>'+(complete?'Суммы по валютам':'Известная часть по валютам')+'</p>'+moneyList(v.amounts,locale):'')
  +(differentDates?'<p>Снимки счетов получены в разное время. Их суммы не являются одновременной оценкой портфеля.</p>':'')+accounts
  +'<p>Оценки брокера сложены отдельно по каждой валюте, без конвертации. Пропуски не заменяются нулём.</p>'
  +'<p>Показан текущий сохранённый состав, независимо от выбранного периода. Это не выплаты или денежная сверка. Денежные остатки, виртуальные и закрытые позиции не включены.</p></div></details>';
 const tone = complete && v.amounts.length === 1 ? BigInt(v.amounts[0].amountNanos)>0n?'positive':BigInt(v.amounts[0].amountNanos)<0n?'negative':'' : '';
 return {state:v.state,headline,note,html,tone};
}
