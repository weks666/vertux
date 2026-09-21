import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  write: { type: 'boolean', default: false },
  check: { type: 'boolean', default: false },
  live: { type: 'boolean', default: false },
  nexus: { type: 'string' }, invest: { type: 'string' },
} });
assert(values.write !== values.check, 'Choose --write or --check');
assert(!values.live || values.check, '--live requires --check');
for (const name of ['nexus', 'invest']) {
  assert(/^\d+\.\d+\.\d+$/.test(values[name] || ''), `Supply the verified --${name} version`);
}
const dataUrl = new URL('../releases.json', import.meta.url);
const pageUrl = new URL('../updates.html', import.meta.url);
const dataText = await readFile(dataUrl, 'utf8');
const data = JSON.parse(dataText);
assert.equal(data.schemaVersion, 1);
assert(Array.isArray(data.releases) && data.releases.length > 0, 'Release history is empty');
const ids = new Set(), versions = new Set(), latest = {};
let previousDate = '9999-12-31';
const tags = { added: ['ДОБАВЛЕНО', 'ADDED'], changed: ['ИЗМЕНЕНО', 'CHANGED'], fixed: ['ИСПРАВЛЕНО', 'FIXED'] };
const nonempty = (text) => typeof text === 'string' && text.trim().length > 0;
for (const release of data.releases) {
  assert(/^[a-z0-9-]+$/.test(release.id) && !ids.has(release.id), 'Invalid or duplicate release ID');
  ids.add(release.id);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(release.date) && new Date(`${release.date}T12:00:00Z`).toISOString().slice(0, 10) === release.date, 'Invalid release date');
  assert(release.date <= previousDate, 'Releases must be newest first');
  previousDate = release.date;
  assert(release.versions && typeof release.versions === 'object' && !Array.isArray(release.versions));
  const entries = Object.entries(release.versions);
  assert(entries.length || nonempty(release.label), 'A release needs a product version or service-update label');
  for (const [product, version] of entries) {
    assert(['Nexus', 'Invest'].includes(product) && /^\d+\.\d+\.\d+$/.test(version), 'Invalid product version');
    assert(!versions.has(`${product}:${version}`), 'Duplicate product version');
    versions.add(`${product}:${version}`);
    if (!latest[product]) latest[product] = version;
  }
  assert(nonempty(release.title?.ru) && nonempty(release.title?.en), 'Both title translations are required');
  assert(Array.isArray(release.changes) && release.changes.length > 0, 'Release notes are required');
  for (const change of release.changes) assert(Object.hasOwn(tags, change.type) && nonempty(change.ru) && nonempty(change.en), 'Each change needs a known type and RU/EN text');
}
assert.equal(latest.Nexus, values.nexus, 'Nexus release notes do not match the release being delivered');
assert.equal(latest.Invest, values.invest, 'Invest release notes do not match the release being delivered');

const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const bilingual = (tag, ru, en, attrs = '') => `<${tag}${attrs} data-nx-en="${esc(en)}">${esc(ru)}</${tag}>`;
const dateLabel = (date, locale) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const cards = data.releases.map((release, index) => {
  const label = release.label || Object.entries(release.versions).map(([product, version]) => `${product.toUpperCase()} ${version}`).join(' / ');
  const changes = release.changes.map((change) => `<li>${bilingual('span', ...tags[change.type], ` class="change-tag ${change.type}"`)}${bilingual('p', change.ru, change.en)}</li>`).join('\n');
  return `<article class="release${index === 0 ? ' release-current' : ''} reveal" id="${release.id}"><header><div><b>${esc(label)}</b><span>${bilingual('time', dateLabel(release.date, 'ru-RU'), dateLabel(release.date, 'en-GB'), ` datetime="${release.date}"`)}</span></div>${bilingual('em', 'ВЫПУЩЕНО', 'RELEASED', ' class="release-status released"')}</header>${bilingual('h2', release.title.ru, release.title.en)}<ul>\n${changes}\n</ul></article>`;
}).join('\n');
const start = '<!-- release-history:start -->', end = '<!-- release-history:end -->';
const generated = `${start}\n<div class="changelog-layout">
<aside class="changelog-index reveal">${bilingual('span', 'ДОСТУПНО ДЛЯ WINDOWS', 'AVAILABLE FOR WINDOWS')}<dl class="release-versions"><div><dt>Nexus</dt><dd>${latest.Nexus}</dd></div><div><dt>Invest</dt><dd>${latest.Invest}</dd></div></dl>${bilingual('p', 'Nexus и Invest обновляются отдельно. Ниже — выпущенные изменения.', 'Nexus and Invest update separately. Released changes are listed below.')}</aside>
<section class="changelog-list" aria-label="История версий" data-nx-aria-en="Version history">
${cards}
</section></div>\n${end}`;
const page = await readFile(pageUrl, 'utf8');
assert.equal(page.split(start).length, 2, 'Expected exactly one release-history start marker');
assert.equal(page.split(end).length, 2, 'Expected exactly one release-history end marker');
const from = page.indexOf(start), to = page.indexOf(end) + end.length;
assert(from < to - end.length, 'Release-history markers are reversed');
const expected = page.slice(0, from) + generated + page.slice(to);
if (values.write) await writeFile(pageUrl, expected, 'utf8');
else assert.equal(page.slice(from, to).replace(/\r\n/g, '\n'), generated, 'updates.html is stale; run --write with the verified release versions');

if (values.live) {
  const get = async (url) => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    assert(response.ok, `HTTP ${response.status}: ${url}`);
    return response;
  };
  const stamp = Date.now();
  const [livePage, liveData, installer] = await Promise.all([
    get(`https://vertux.online/nexus/updates.html?release-check=${stamp}`).then((r) => r.text()),
    get(`https://vertux.online/nexus/releases.json?release-check=${stamp}`).then((r) => r.text()),
    get('https://nexus.vertux.online/api/desktop/download/status').then((r) => r.json()),
  ]);
  assert.equal(livePage.replace(/\r\n/g, '\n'), page.replace(/\r\n/g, '\n'), 'Published page differs from the verified page');
  assert.equal(liveData.replace(/\r\n/g, '\n'), dataText.replace(/\r\n/g, '\n'), 'Published release data differs from the verified data');
  assert.equal(installer?.ok, true, 'Installer status is unavailable');
  assert.equal(installer?.data?.available, true, 'Public installer is unavailable');
  assert.equal(installer?.data?.version, latest.Nexus, 'Website installer and changelog disagree');
  console.log(JSON.stringify({ status: 'LIVE_CHANGELOG_VERIFIED', nexus: latest.Nexus, invest: latest.Invest, releases: ids.size, pageSha256: createHash('sha256').update(livePage).digest('hex'), dataSha256: createHash('sha256').update(liveData).digest('hex') }));
} else console.log(`Release history ${values.write ? 'generated' : 'verified'}: Nexus ${latest.Nexus}, Invest ${latest.Invest}, ${ids.size} entries`);
