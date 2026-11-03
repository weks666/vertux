import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {copyFile, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Public confectionery demo: the real storefront and cabinet from the Nexus app,
// served statically with demo-api.js answering their API from fictional data.
const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, '../nexus/demo-confectionery');
if (!process.argv[2]) throw new Error('Pass the Nexus app directory: node scripts/build-nexus-confectionery-demo.mjs <vertux-nexus/app>');
const app = resolve(process.argv[2]);
const git = (...args) => { try { return execFileSync('git', ['-C', app, ...args], {encoding:'utf8'}).trim(); } catch { return null; } };
const replaceRequired = (text, from, to, label) => { if (!text.includes(from)) throw new Error(`Demo export contract changed: ${label}`); return text.split(from).join(to); };
const sources = new Map();
async function source(path) {
  const bytes = await readFile(join(app, path));
  sources.set(path, createHash('sha256').update(bytes).digest('hex'));
  return bytes;
}

await rm(output, {recursive:true, force:true});
await mkdir(join(output, 'fonts'), {recursive:true});
await mkdir(join(output, 'media'), {recursive:true});

// One stamp for every demo asset, so a rebuilt demo never mixes cached files.
const V = `v=${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${Date.now().toString(36).slice(-4)}`;
const demoScript = `<script type="module" src="./demo-api.js?${V}"></script>\n  `;
let storefrontHtml = (await source('public/confectionery/storefront.html')).toString('utf8');
storefrontHtml = replaceRequired(storefrontHtml, '<html lang="ru">', '<html lang="ru" data-shop="vanilnoe-oblako">', 'storefront slug');
storefrontHtml = replaceRequired(storefrontHtml, 'href="/icon.svg"', 'href="./icon.svg"', 'storefront icon');
storefrontHtml = replaceRequired(storefrontHtml, 'href="/fonts/fonts.css"', 'href="./fonts/fonts.css"', 'storefront fonts');
storefrontHtml = replaceRequired(storefrontHtml, 'href="/fonts/rubik.css"', 'href="./fonts/rubik.css"', 'storefront display font');
storefrontHtml = storefrontHtml.replace(/href="\/confectionery\/storefront\.css[^"]*"/u, `href="./storefront.css?${V}"`).replace(/<script type="module" src="\/confectionery\/storefront\.js[^"]*"><\/script>/u,
  `${demoScript}<script type="module" src="./storefront.js?${V}"></script>\n  <link rel="stylesheet" href="./demo.css?${V}">`);
if (!storefrontHtml.includes('./storefront.js')) throw new Error('Demo export contract changed: storefront script');
await writeFile(join(output, 'storefront.html'), storefrontHtml);

let storefrontJs = (await source('public/confectionery/storefront.js')).toString('utf8');
// Demo media are SVG illustrations, so the static file needs its extension.
storefrontJs = replaceRequired(storefrontJs, 'const media = id => `${state.shop.mediaBase}${id}`;', 'const media = id => `${state.shop.mediaBase}${id}.svg`;', 'storefront media');
await writeFile(join(output, 'storefront.js'), storefrontJs);
await copyFile(join(app, 'public/confectionery/storefront.css'), join(output, 'storefront.css')); await source('public/confectionery/storefront.css');

let cabinetHtml = (await source('public/confectionery/cabinet.html')).toString('utf8');
cabinetHtml = replaceRequired(cabinetHtml, 'href="/icon.svg"', 'href="./icon.svg"', 'cabinet icon');
cabinetHtml = replaceRequired(cabinetHtml, 'href="/fonts/fonts.css"', 'href="./fonts/fonts.css"', 'cabinet fonts');
cabinetHtml = replaceRequired(cabinetHtml, 'href="/styles.css"', `href="./styles.css?${V}"`, 'cabinet base styles');
cabinetHtml = cabinetHtml.replace(/href="\/confectionery\/cabinet\.css[^"]*"/u, `href="./cabinet.css?${V}"`)
  .replace(/\s*<script src="\/service-module\/[^"]+" defer><\/script>/u, '')
  .replace(/<script type="module" src="\/confectionery\/cabinet\.js[^"]*"><\/script>/u, `${demoScript}<script type="module" src="./cabinet.js?${V}"></script>\n  <link rel="stylesheet" href="./demo.css?${V}">`);
if (!cabinetHtml.includes('./cabinet.js') || cabinetHtml.includes('/service-module/')) throw new Error('Demo export contract changed: cabinet scripts');
await writeFile(join(output, 'cabinet.html'), cabinetHtml);

let cabinetJs = (await source('public/confectionery/cabinet.js')).toString('utf8');
cabinetJs = replaceRequired(cabinetJs, "import { createAccountServiceAdapter } from '/account-service-adapter.js';", "const createAccountServiceAdapter = () => ({}); // Service Center is not part of the website demo.", 'service adapter import');
cabinetJs = replaceRequired(cabinetJs, "const productId = location.pathname.split('/')[2] || '';", "const productId = '00000000-0000-4000-8000-00000000c0de';", 'cabinet product');
cabinetJs = replaceRequired(cabinetJs, 'const mediaUrl = id => `${state.context.publicPath}/media/${id}`;', 'const mediaUrl = id => `./media/${id}.svg`;', 'cabinet media');
await writeFile(join(output, 'cabinet.js'), cabinetJs);
await copyFile(join(app, 'public/confectionery/cabinet.css'), join(output, 'cabinet.css')); await source('public/confectionery/cabinet.css');
await copyFile(join(app, 'public/styles.css'), join(output, 'styles.css')); await source('public/styles.css');
await copyFile(join(app, 'public/icon.svg'), join(output, 'icon.svg')); await source('public/icon.svg');
const fonts = (await source('public/fonts/fonts.css')).toString('utf8');
await writeFile(join(output, 'fonts/fonts.css'), fonts);
for (const font of new Set([...fonts.matchAll(/url\(([a-z0-9]+\.woff2)\)/gu)].map(match => match[1]))) {
  await copyFile(join(app, 'public/fonts', font), join(output, 'fonts', font)); await source(`public/fonts/${font}`);
}
// Storefront headings use Rubik; its licence travels with the files.
const rubik = (await source('public/fonts/rubik.css')).toString('utf8');
await writeFile(join(output, 'fonts/rubik.css'), rubik);
for (const font of new Set([...rubik.matchAll(/url\(([a-z0-9-]+\.woff2)\)/gu)].map(match => match[1]))) {
  await copyFile(join(app, 'public/fonts', font), join(output, 'fonts', font)); await source(`public/fonts/${font}`);
}
await copyFile(join(app, 'public/fonts/Rubik-OFL.txt'), join(output, 'fonts/Rubik-OFL.txt')); await source('public/fonts/Rubik-OFL.txt');
await copyFile(join(app, 'lib/confectionery/model.mjs'), join(output, 'model.mjs')); await source('lib/confectionery/model.mjs');
const demoApi = replaceRequired(await readFile(join(here, 'confectionery-demo/demo-api.js'), 'utf8'), "from './model.mjs';", `from './model.mjs?${V}';`, 'demo model import');
await writeFile(join(output, 'demo-api.js'), demoApi);
await copyFile(join(here, 'confectionery-demo/demo.css'), join(output, 'demo.css'));

// Original illustrations: flat vector desserts, no photographs of anyone's work.
const svg = (body, background) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">${background.map((color, index) => `<stop offset="${index / (background.length - 1)}" stop-color="${color}"/>`).join('')}</linearGradient></defs><rect width="800" height="600" fill="url(#bg)"/>${body}</svg>\n`;
const plate = (cx = 400, cy = 500, rx = 290) => `<ellipse cx="${cx}" cy="${cy + 12}" rx="${rx}" ry="34" fill="#000" opacity=".08"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="40" fill="#fffdf9"/><ellipse cx="${cx}" cy="${cy - 6}" rx="${rx - 40}" ry="26" fill="#f4ece2"/>`;
const layers = (x, y, w, colors, h) => colors.map((color, index) => `<rect x="${x}" y="${y + index * h}" width="${w}" height="${h + 1}" fill="${color}"/>`).join('');
const illustrations = {
  a0000000000000000000000000000001: svg(`${plate()}${layers(190, 230, 420, ['#e7a85b','#fff3dc','#df9a4c','#fff3dc','#e7a85b','#fff3dc','#d98d40'], 34)}<path d="M190 230h420v-18c0-14-11-22-24-22H214c-13 0-24 8-24 22z" fill="#f6dcae"/>${Array.from({length:26}, (_, i) => `<circle cx="${206 + (i * 61) % 390}" cy="${196 + (i * 13) % 26}" r="${4 + i % 4}" fill="#c98a45"/>`).join('')}`, ['#fff4e2','#ffe2bf']),
  a0000000000000000000000000000002: svg(`${plate()}${layers(200, 250, 400, ['#4a2618','#f3dcc4','#5b301e','#f3dcc4','#3f2015'], 44)}<path d="M200 252c0-40 30-62 60-62h280c30 0 60 22 60 62v14c-16 0-16 30-32 30s-16-24-32-24-16 40-32 40-16-30-32-30-16 22-32 22-16-34-32-34-16 26-32 26-16-20-32-20-16 30-32 30-16-26-32-26-16 22-32 22z" fill="#2c140c"/>${[260,330,400,470,540].map((x, i) => `<path d="M${x} 176c4-28 18-40 34-48" stroke="#4d7a2a" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${184 + (i % 2) * 6}" r="22" fill="#c1121f"/><circle cx="${x - 7}" cy="${177 + (i % 2) * 6}" r="6" fill="#fff" opacity=".45"/>`).join('')}`, ['#ffe9ef','#ffd3df']),
  a0000000000000000000000000000003: svg([[220,'#f7b2c4','#fde4ea'],[400,'#8a5a3c','#f3d9c3'],[580,'#f6e2a8','#fff6dd']].map(([x, frost, light]) => `<path d="M${x - 78} 330h156l-22 170h-112z" fill="#e8a36a"/>${[0,1,2,3,4].map(i => `<path d="M${x - 70 + i * 34} 332l8 166" stroke="#d68a4f" stroke-width="6"/>`).join('')}<circle cx="${x - 52}" cy="300" r="46" fill="${frost}"/><circle cx="${x + 52}" cy="300" r="46" fill="${frost}"/><circle cx="${x}" cy="262" r="58" fill="${frost}"/><circle cx="${x}" cy="208" r="38" fill="${frost}"/><circle cx="${x - 14}" cy="196" r="12" fill="${light}"/><circle cx="${x}" cy="160" r="15" fill="#c1121f"/>`).join(''), ['#e9f7f2','#fde7d6']),
  a0000000000000000000000000000004: svg(`${plate(400, 470, 320)}${[0,1,2].map(i => `<g transform="rotate(${-8 + i * 6} 400 ${300 + i * 62})"><rect x="170" y="${250 + i * 62}" width="460" height="74" rx="37" fill="#e7b675"/><path d="M182 ${270 + i * 62}c0-12 12-20 26-20h384c14 0 26 8 26 20v8H182z" fill="#3a1c10"/><path d="M220 ${262 + i * 62}h80" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/></g>`).join('')}`, ['#efe7ff','#ffe9da']),
  a0000000000000000000000000000005: svg([[250,250,'#a7d58b'],[420,230,'#f3a5b7'],[560,300,'#c8b6f2'],[300,390,'#7a4a33'],[480,400,'#f7d070']].map(([x, y, color]) => `<g><ellipse cx="${x}" cy="${y + 30}" rx="92" ry="34" fill="${color}"/><rect x="${x - 84}" y="${y + 6}" width="168" height="20" rx="10" fill="#fff6ec"/><ellipse cx="${x}" cy="${y}" rx="92" ry="34" fill="${color}"/><ellipse cx="${x - 26}" cy="${y - 12}" rx="30" ry="8" fill="#fff" opacity=".35"/></g>`).join(''), ['#fff8f1','#fde6ee']),
  a0000000000000000000000000000006: svg(`${plate(400, 480, 300)}<path d="M180 420l380-150 60 150z" fill="#f8ead2"/><path d="M180 420h440v34H180z" fill="#c98a45"/><path d="M180 420l380-150 60 150" fill="none" stroke="#efd9b6" stroke-width="6"/><path d="M560 270l60 150v-24l-60-150z" fill="#e9d3ad"/>${[[360,300],[420,285],[480,265],[530,250],[300,330]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="20" fill="#7b2d8e"/><circle cx="${x - 6}" cy="${y - 7}" r="5" fill="#fff" opacity=".5"/>`).join('')}`, ['#f2f7ff','#ffe9d6']),
  '0a11ce0000000000000000000000000a': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="48" fill="#E8792B"/><path d="M52 128c-18 0-30-12-30-28s12-28 28-28c4-22 22-36 44-36 18 0 34 10 40 26 22 0 40 16 40 38s-16 28-36 28z" fill="#fff6ec"/><circle cx="84" cy="104" r="7" fill="#2a1a0e"/><circle cx="118" cy="104" r="7" fill="#2a1a0e"/><path d="M90 120c6 8 18 8 24 0" stroke="#2a1a0e" stroke-width="5" fill="none" stroke-linecap="round"/></svg>\n`,
  c0ffee0000000000000000000000000b: svg(`${plate(400, 500, 330)}${layers(210, 210, 380, ['#f6c9d3','#fff6ec','#f2b6c3','#fff6ec','#f6c9d3'], 48)}<path d="M210 212c0-34 24-52 52-52h276c28 0 52 18 52 52z" fill="#fff6ec"/>${[260,320,380,440,500,550].map((x, i) => `<circle cx="${x}" cy="${150 - (i % 2) * 8}" r="${16 + (i % 3) * 3}" fill="${['#c1121f','#5b2a86','#e85d75'][i % 3]}"/>`).join('')}<path d="M300 130c10-40 50-60 90-50" stroke="#4d7a2a" stroke-width="6" fill="none"/>`, ['#ffe4d1','#ffd1dc']),
  c0ffee0000000000000000000000000c: svg(`${[[200,300,'#f7d070'],[400,280,'#f3a5b7'],[600,310,'#a7d58b']].map(([x, y, color]) => `<circle cx="${x}" cy="${y + 120}" r="110" fill="#fff6ec"/><path d="M${x - 70} ${y}h140l-18 120h-104z" fill="#e8a36a"/><circle cx="${x}" cy="${y - 20}" r="66" fill="${color}"/><circle cx="${x}" cy="${y - 80}" r="18" fill="#c1121f"/>`).join('')}`, ['#fff1e2','#ffe0c4']),
  c0ffee0000000000000000000000000d: svg(`${Array.from({length:36}, (_, i) => `<circle cx="${60 + (i % 6) * 136}" cy="${70 + Math.floor(i / 6) * 96}" r="${18 + (i % 3) * 6}" fill="${['#f3a5b7','#f7d070','#a7d58b','#c8b6f2'][i % 4]}" opacity=".85"/>`).join('')}<rect x="190" y="200" width="420" height="200" rx="40" fill="#fffaf5" opacity=".92"/><text x="400" y="318" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#2a1a0e">Сладко</text>`, ['#fff7ef','#ffeede']),
};
for (const [name, body] of Object.entries(illustrations)) await writeFile(join(output, 'media', `${name}.svg`), body);

const nexusRepo = resolve(app, '..');
const commit = git('rev-parse', 'HEAD');
const dirty = Boolean(git('status', '--porcelain', '--', 'public/confectionery', 'lib/confectionery', 'public/styles.css'));
await writeFile(join(output, 'source.json'), JSON.stringify({schemaVersion:1, kind:'confectionery-website-demo', builtAt:new Date().toISOString().slice(0, 10),
  source:{repository:'vertux-nexus', path:'app', commit, workingTreeChanges:dirty}, data:'fictional, generated in the browser by demo-api.js',
  files:Object.fromEntries([...sources].sort())}, null, 2) + '\n');
console.log(`Built confectionery demo from ${nexusRepo}${dirty ? ' (working tree with uncommitted changes)' : ''}: ${sources.size} source files, ${Object.keys(illustrations).length} illustrations.`);
