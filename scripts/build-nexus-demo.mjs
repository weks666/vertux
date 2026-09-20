import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, writeFile, copyFile, mkdtemp, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
// Only the public synthetic Pages export is an input, never a customer database.
const site = resolve(dirname(fileURLToPath(import.meta.url)), '../nexus');
const source = resolve(process.argv[2] || join(site, '../../vertux-invest-workspace'));
const { buildPagesPreview } = await import(pathToFileURL(join(source, 'scripts/build-pages-preview.mjs')));
const { standardRuntimeBytes } = await import(pathToFileURL(join(source, 'scripts/standard-product-profile.mjs')));
const staging = await mkdtemp(join(tmpdir(), 'nexus-public-demo-'));
const tutorial = JSON.parse(await readFile(join(source, 'fixtures/tinvest/kovrocity-account.json'), 'utf8'));
// A separate synthetic tutorial history. All calculations still run through the
// application's normal view model; no customer files or network are inputs.
tutorial.label = 'Synthetic Nexus website tutorial; no customer data';
const values = [1000000,1004000,1003000,1014000,1018000,1013000,1024000,1032000,1295000,1318000,1307000,1239000];
tutorial.accounts[0].portfolioHistory = values.map((value,index) => ({
  asOf: new Date(Date.UTC(2026,6,31+index,21)).toISOString(),
  totalAmountPortfolio: { units:String(value), nano:0, currency:'rub' },
  cash:{units:'85000',nano:0,currency:'rub'}, blocked:{units:'0',nano:0,currency:'rub'},
  expectedYield:{units:'0',nano:0,currency:'rub'}, positions:[],
}));
const earlier=[];
// Midnight Moscow valuations let every demo preset and custom day use a real
// start observation. Sparse weekly samples made valid filters look broken.
for(let time=Date.UTC(2025,6,31,21);time<Date.UTC(2026,6,31,21);time+=86400000){
  const progress=(time-Date.UTC(2025,6,31,21))/(365*86400000);
  const value=Math.round(850000+150000*progress+Math.sin(progress*38)*5500);
  earlier.push({...tutorial.accounts[0].portfolioHistory[0],asOf:new Date(time).toISOString(),totalAmountPortfolio:{units:String(value),nano:0,currency:'rub'}});
}
tutorial.accounts[0].portfolioHistory.unshift(...earlier);
for(const [asOf,value] of [['2025-08-11T21:00:00.000Z',855000],['2026-05-11T21:00:00.000Z',970000],['2026-07-11T21:00:00.000Z',990000],['2026-08-04T21:00:00.000Z',1018000],['2026-08-11T21:00:00.000Z',1239000]]){
  tutorial.accounts[0].portfolioHistory.push({...tutorial.accounts[0].portfolioHistory[0],asOf,totalAmountPortfolio:{units:String(value),nano:0,currency:'rub'}});
}
tutorial.accounts[0].portfolioHistory=[...new Map(tutorial.accounts[0].portfolioHistory.map(row=>[row.asOf,row])).values()]
  .sort((a,b)=>a.asOf.localeCompare(b.asOf));
const fixtureFile=join(staging,'tutorial.json');
await writeFile(fixtureFile,JSON.stringify(tutorial));
const result = await buildPagesPreview({ outputDirectory: join(staging, 'public'), fixtureFile, historyFrom:'2025-08-01T00:00:00.000Z', clean: false });
for (const name of result.files) {
  if (!/\.(?:js|html|svg)$/u.test(name)) continue;
  const path = join(result.outputDirectory, name);
  let text = standardRuntimeBytes('public/' + name, await readFile(path)).toString('utf8');
  if (name === 'index.html') {
    text = text.replace('<h1 id="viewTitle">Обзор портфеля</h1>', '<h1 id="viewTitle">Обзор портфеля</h1><span class="demo-stamp">Демо</span>');
    text = text.replace('</head>', '  <link rel="stylesheet" href="./demo-frame.css?v=20260919-core">\n</head>');
    // The offline export calculates the six preset ranges at build time.
    // Keep custom-date fields explicitly read-only instead of letting a visitor
    // edit them and silently fall back to the previous preset.
    text = text.replace(/<form[^>]+id="(?:statisticsPeriodForm|operationFilters)"[\s\S]*?<\/form>/gu, form => {
      const id = /id="([^"]+)"/u.exec(form)[1] + '-demo-note';
      const note = 'В демо доступны готовые периоды. Свои даты можно выбрать в приложении.';
      return form.replace(/<input[^>]+type="date"[^>]*>/gu, tag => tag
        .replace(/\saria-describedby="[^"]*"/u, '')
        .replace('type="date"', `type="date" readonly aria-describedby="${id}" title="${note}"`))
        .replace('<option value="custom">Свои даты</option>', '<option value="custom" disabled>Свои даты — в приложении</option>')
        + `<p class="demo-period-note" id="${id}">${note}</p>`;
    });
    text = text.replace(/\s*<button[^>]+data-system-section="access"[\s\S]*?<\/button>/u, '');
    text = text.replace('</body>', '  <script src="./demo-service.js" defer></script>\n</body>');
  }
  if (name === 'app.js') text = text.replace("from './runtime.js'", "from './demo-runtime.js'");
  if (name === 'market-calendar.js') text = text.replace('!getBootstrap()?.preview?.static', '(!getBootstrap()?.preview?.static || getBootstrap()?.preview?.interactiveTutorial === true)');
  await writeFile(path, text);
}
await cp(result.outputDirectory,join(site,'demo'),{recursive:true});
for (const name of ['demo-frame.css', 'demo-runtime.js', 'demo-service.js']) await copyFile(join(site, 'assets', name), join(site, 'demo', name));
console.log(JSON.stringify({ status: 'synthetic-demo-built', files: result.files.length + 3, brokerNetwork: false, output: result.outputDirectory }));
