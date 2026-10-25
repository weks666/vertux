import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Local-only visual regression check. Fresh browser contexts; no account forms,
// checkout calls, user profiles, production mutations, or remote page navigation.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.INVEST_SOURCE || process.argv[2] || 'E:/VertuxBuilds/invest-focus040-ai-20261020';
const require = createRequire(resolve(source, 'package.json'));
const {chromium} = require('playwright');
const base = new URL(process.env.NEXUS_PREVIEW_URL || 'http://127.0.0.1:8766');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Only a loopback preview may be tested');
const out = resolve(root, process.env.NEXUS_QA_DIR || 'nexus/qa/2026-10-25');
const commerceOnly = process.env.NEXUS_SITE_TEST_SCOPE === 'commerce';
await mkdir(out, {recursive: true});
const report = {
  startedAt: new Date().toISOString(), baseURL: base.href, channel: 'msedge',
  scope: commerceOnly ? 'commerce' : 'commerce-and-embeds',
  networkPolicy: 'Only GET/HEAD to the preview origin. Known header session GET may receive an anonymous fixture; all other external requests are blocked. No user session is loaded.',
  cases: [], failures: [], blockedRequests: [], stubbedRequests: [],
};
const browser = await chromium.launch({channel: 'msedge', headless: true});

function localPage(file) {
  return new URL(`${base.pathname.replace(/\/$/, '')}/nexus/${file}`, base.origin).href;
}
async function noOverflow(page) {
  const size = await page.evaluate(() => ({viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth}));
  assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1, `Page overflow: ${JSON.stringify(size)}`);
  return size;
}
async function seller(page) {
  const block = page.locator('.nx-seller');
  await block.scrollIntoViewIfNeeded();
  assert.match(await block.innerText(), /Самозанятый Носырев Степан Константинович/);
  assert.match(await block.innerText(), /ИНН 781436013120/);
  assert.ok(await page.locator('footer a[href="mailto:support@vertux.online"]').count());
  const bounds = await block.boundingBox();
  assert.ok(bounds && bounds.width > 0 && bounds.x >= -1 && bounds.x + bounds.width <= page.viewportSize().width + 1, 'Seller details must fit the viewport');
}
async function language(page, wanted) {
  if (await page.locator('html').getAttribute('lang') !== wanted) await page.locator('[data-lang-toggle]').click();
  await page.waitForFunction(lang => document.documentElement.lang === lang, wanted);
}
async function readyPoster(page, selector) {
  const poster = page.locator(selector);
  await poster.scrollIntoViewIfNeeded();
  await page.waitForFunction(sel => {
    const host = document.querySelector(sel);
    return host?.classList.contains('is-ready') && host.querySelector('iframe')?.contentDocument?.documentElement.dataset.demoReady === 'true';
  }, selector, {timeout: 25000});
  const details = await poster.evaluate(node => {
    const frame = node.querySelector('iframe');
    return {src: frame.getAttribute('src'), ready: node.classList.contains('is-ready'), width: node.clientWidth, height: node.clientHeight};
  });
  assert.ok(details.width > 0 && details.height > 0);
  return details;
}
async function runCase(name, width, callback) {
  const result = {name, width, status: 'RUNNING', consoleErrors: [], pageErrors: [], localHttpErrors: [], localRequestFailures: []};
  report.cases.push(result);
  const context = await browser.newContext({viewport: {width, height: 960}, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block'});
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base.origin && ['GET', 'HEAD'].includes(request.method())) return route.continue();
    if (url.origin === 'https://nexus.vertux.online' && url.pathname === '/api/auth/site-session' && request.method() === 'GET') {
      report.stubbedRequests.push({case: name, width, path: url.origin + url.pathname});
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true, data: {authenticated: false}})});
    }
    report.blockedRequests.push({case: name, width, method: request.method(), path: url.origin + url.pathname});
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(base.origin) && response.status() >= 400) result.localHttpErrors.push({url: response.url(), status: response.status()});
  });
  page.on('requestfailed', request => {
    if (request.url().startsWith(base.origin) && !request.failure()?.errorText.includes('ERR_ABORTED')) result.localRequestFailures.push({url: request.url(), error: request.failure()?.errorText});
  });
  try {
    await callback(page, result);
    assert.deepEqual(result.pageErrors, [], 'Uncaught browser errors');
    assert.deepEqual(result.consoleErrors, [], 'Browser console errors');
    assert.deepEqual(result.localHttpErrors, [], 'Missing local assets');
    assert.deepEqual(result.localRequestFailures, [], 'Failed local assets');
    assert.equal(report.blockedRequests.filter(x => x.case === name && x.width === width).length, 0, 'Unexpected external or non-read request');
    result.status = 'PASS';
  } catch (error) {
    result.status = 'FAIL'; result.error = error.message;
    report.failures.push({name, width, error: error.message});
    await page.screenshot({path: resolve(out, `${name}-${width}-failure.png`), fullPage: true, animations: 'disabled'}).catch(() => {});
  } finally { await context.close(); }
  console.log(JSON.stringify({case: name, width, status: result.status, error: result.error}));
}

try {
  for (const width of [1440, 390, 320]) {
    await runCase('pricing', width, async (page, result) => {
      await page.goto(localPage('pricing.html'), {waitUntil: 'networkidle'});
      assert.equal(await page.locator('[data-tier-card]').count(), 3);
      const data = await page.locator('#nexus-pricing-data').textContent().then(JSON.parse);
      assert.deepEqual(data.plans.map(p => p.id), ['standard', 'plus', 'pro']);
      result.languages = [];
      for (const lang of ['ru', 'en']) {
        await language(page, lang);
        for (const term of data.terms) {
          const button = page.locator(`[data-subscription-term="${term.id}"]`);
          await button.click();
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
          for (const plan of data.plans) {
            const card = page.locator(`[data-tier-card="${plan.id}"]`);
            assert.equal(await card.locator('[data-tier-total] [data-price-rub]').getAttribute('data-price-rub'), String(Math.round(plan.monthlyRub * term.factor)));
            const link = new URL(await card.locator('a[href*="account.html"]').getAttribute('href'));
            assert.equal(link.searchParams.get('plan'), `invest-${plan.id}`);
            assert.equal(link.searchParams.get('months'), String(term.months));
            assert.equal(link.origin, 'https://nexus.vertux.online');
          }
        }
        // Keyboard interaction changes only the local term selection.
        const first = page.locator('[data-subscription-term="month"]');
        await first.focus(); await first.press('End');
        assert.equal(await page.locator('[data-subscription-term="year"]').getAttribute('aria-pressed'), 'true');
        await page.locator('[data-subscription-term="year"]').press('Home');
        assert.equal(await first.getAttribute('aria-pressed'), 'true');
        assert.ok(await page.locator('footer a[href="offer.html"]').count());
        assert.ok(await page.locator('footer a[href="privacy.html"]').count());
        assert.ok(await page.locator('a[href="offer.html#section-6"]').count());
        await seller(page);
        const size = await noOverflow(page);
        await page.locator('footer').screenshot({path: resolve(out, `pricing-${width}-${lang}-footer.png`), animations: 'disabled'});
        await page.evaluate(() => { scrollTo(0, 0); return new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))); });
        await page.screenshot({path: resolve(out, `pricing-${width}-${lang}.png`), fullPage: true, animations: 'disabled'});
        result.languages.push({lang, ...size, terms: data.terms.map(t => t.months), sellerFits: true});
        await page.evaluate(() => scrollTo(0, 0));
      }
      for (const file of ['offer.html', 'privacy.html', 'consent.html']) {
        const response = await page.request.get(localPage(file));
        assert.equal(response.status(), 200, `Document ${file} is reachable`);
      }
    });
    if (commerceOnly) continue;
    for (const file of ['index.html', 'invest.html']) {
      await runCase(file.replace('.html', ''), width, async (page, result) => {
        await page.goto(localPage(file), {waitUntil: 'networkidle'});
        result.posters = [await readyPoster(page, file === 'index.html' ? '#home-invest-scene [data-app-poster]' : '.nx-experience-invest [data-app-poster]')];
        await page.screenshot({path: resolve(out, `${file.replace('.html', '')}-${width}-hero.png`), animations: 'disabled'});
        if (file === 'invest.html') {
          for (let i = 0; i < 3; i++) {
            const tab = page.locator(`[data-tour-tab="${i}"]`);
            await tab.click();
            result.posters.push(await readyPoster(page, `#tour-panel-${i} [data-app-poster]`));
            await page.locator(`#tour-panel-${i}`).screenshot({path: resolve(out, `invest-${width}-poster-${i}.png`), animations: 'disabled'});
          }
          await page.locator('.nx-demo-frame').scrollIntoViewIfNeeded();
          await page.waitForFunction(() => document.querySelector('.nx-demo-frame')?.contentDocument?.documentElement.dataset.demoReady === 'true', null, {timeout: 25000});
          result.interactiveEmbedReady = true;
        }
        await seller(page);
        result.size = await noOverflow(page);
        await page.locator('footer').screenshot({path: resolve(out, `${file.replace('.html', '')}-${width}-footer.png`), animations: 'disabled'});
      });
    }
  }
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'PASS';
  await writeFile(resolve(out, commerceOnly ? 'site-commerce-results.json' : 'site-refresh-results.json'), JSON.stringify(report, null, 2) + '\n');
}
if (report.failures.length) process.exitCode = 1;
