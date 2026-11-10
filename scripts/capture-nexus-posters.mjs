// Still posters of the Invest demo for invest.html. A live demo app in every
// poster kept several iframes running while the page scrolled; the posters are
// now pictures of the same demo, refreshed with this script after a demo change.
// Usage: node scripts/capture-nexus-posters.mjs http://127.0.0.1:8766/nexus/
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const base = process.argv[2];
if (!base) throw new Error('Pass the address of the locally served nexus/ folder');
const chromePath = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const assets = resolve(dirname(fileURLToPath(import.meta.url)), '../nexus/assets');
// view, width and height of the poster in the page; 1.5 keeps it sharp on dense screens.
export const POSTERS = [['overview', 1440, 1000], ['analytics', 1280, 940], ['terminal', 1280, 940], ['events', 1280, 940]];

const profile = mkdtempSync(join(tmpdir(), 'nexus-posters-'));
const port = 9500 + Math.floor(Math.random() * 300);
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], {stdio:'ignore'});
const sleep = ms => new Promise(done => setTimeout(done, ms));
try {
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(entry => entry.type === 'page'); } catch { /* Chrome is starting */ }
  }
  if (!target) throw new Error('Chrome did not start');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(done => socket.addEventListener('open', done, {once:true}));
  let sequence = 0;
  const waiting = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); waiting.get(message.id)?.(message); waiting.delete(message.id); });
  const send = (method, params = {}) => new Promise(done => { const id = ++sequence; waiting.set(id, done); socket.send(JSON.stringify({id, method, params})); });
  await send('Page.enable');
  for (const [view, width, height] of POSTERS) {
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor:1.5, mobile:false});
    await send('Page.navigate', {url:new URL(`demo/index.html?poster=${view}`, base).href});
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt++) {
      await sleep(250);
      ready = (await send('Runtime.evaluate', {expression:"document.documentElement.dataset.demoReady === 'true'", returnByValue:true})).result?.result?.value === true;
    }
    if (!ready) throw new Error(`The demo did not open: ${view}`);
    await sleep(3000); // charts and the events list finish loading after the ready signal
    const shot = await send('Page.captureScreenshot', {format:'webp', quality:82, captureBeyondViewport:false});
    writeFileSync(join(assets, `poster-${view}.webp`), Buffer.from(shot.result.data, 'base64'));
    console.log(`poster-${view}.webp`);
  }
  socket.close();
} finally {
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, {recursive:true, force:true}); } catch { /* Chrome may still hold the profile */ }
}
