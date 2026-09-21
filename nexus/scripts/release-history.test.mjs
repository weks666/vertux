import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Every case owns a disposable fixture directory; no live requests or project writes.
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'nexus-changelog-'));
  await mkdir(join(dir, 'scripts'));
  await copyFile(new URL('./release-history.mjs', import.meta.url), join(dir, 'scripts', 'release-history.mjs'));
  const source = JSON.parse(await readFile(new URL('../releases.json', import.meta.url), 'utf8'));
  const page = '<!doctype html><main><!-- release-history:start -->\n<!-- release-history:end --></main>';
  await writeFile(join(dir, 'releases.json'), JSON.stringify(source));
  await writeFile(join(dir, 'updates.html'), page);
  return {
    dir, source,
    save: () => writeFile(join(dir, 'releases.json'), JSON.stringify(source)),
    run: (...args) => spawnSync(process.execPath, [join(dir, 'scripts', 'release-history.mjs'), ...args], { encoding: 'utf8', timeout: 10000 }),
  };
}
const history = JSON.parse(await readFile(new URL('../releases.json', import.meta.url), 'utf8'));
const current = Object.fromEntries(['Nexus', 'Invest'].map(product => [product, history.releases.find(release => release.versions[product]).versions[product]]));
const next = version => { const parts = version.split('.').map(Number); parts[2]++; return parts.join('.'); };
const versions = ['--nexus', current.Nexus, '--invest', current.Invest];
test('reproducible static page; stale page fails without modifying it', async () => {
  const f = await fixture();
  assert.equal(f.run('--write', ...versions).status, 0);
  const first = await readFile(join(f.dir, 'updates.html'), 'utf8');
  assert.equal(f.run('--write', ...versions).status, 0);
  assert.equal(await readFile(join(f.dir, 'updates.html'), 'utf8'), first);
  assert.equal(f.run('--check', ...versions).status, 0);
  await writeFile(join(f.dir, 'updates.html'), first.replace(current.Nexus, '0.0.0'));
  assert.notEqual(f.run('--check', ...versions).status, 0);
  assert((await readFile(join(f.dir, 'updates.html'), 'utf8')).includes('0.0.0'));
});
test('a new release cannot pass using an old changelog', async () => {
  const f = await fixture();
  assert.notEqual(f.run('--write', '--nexus', next(current.Nexus), '--invest', current.Invest).status, 0);
  assert.notEqual(f.run('--write', '--nexus', current.Nexus, '--invest', next(current.Invest)).status, 0);
  assert.notEqual(f.run('--write').status, 0);
});
test('missing translations, duplicate versions and wrong date order fail', async () => {
  for (const corrupt of [
    (data) => { data.releases[0].changes[0].en = ''; },
    (data) => { data.releases[1].versions.Invest = current.Invest; },
    (data) => { data.releases[1].date = '9999-12-31'; },
    (data) => { data.releases[0].date = '2026-02-30'; },
  ]) {
    const f = await fixture(); corrupt(f.source); await f.save();
    assert.notEqual(f.run('--write', ...versions).status, 0);
  }
});
test('release text is escaped in visible text and translation attributes', async () => {
  const f = await fixture();
  f.source.releases[0].changes[0].ru = '<script>unsafe</script>';
  f.source.releases[0].changes[0].en = '" onclick="unsafe & more';
  await f.save();
  assert.equal(f.run('--write', ...versions).status, 0);
  const page = await readFile(join(f.dir, 'updates.html'), 'utf8');
  assert(!page.includes('<script>'));
  assert(page.includes('&lt;script&gt;'));
  assert(page.includes('&quot; onclick=&quot;unsafe &amp; more'));
});
