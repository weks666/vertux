import {websiteFixture} from './nexus-demo-fixture.mjs';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, writeFile, copyFile, mkdtemp, cp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
// Only the public synthetic Pages export is an input, never a customer database.
const site = resolve(dirname(fileURLToPath(import.meta.url)), '../nexus');
const source = resolve(process.argv[2] || join(site, '../../vertux-invest-workspace'));
const { buildPagesPreview, PAGES_PUBLIC_FILES } = await import(pathToFileURL(join(source, 'scripts/build-pages-preview.mjs')));
const { standardRuntimeBytes } = await import(pathToFileURL(join(source, 'scripts/standard-product-profile.mjs')));
const staging = await mkdtemp(join(tmpdir(), 'nexus-public-demo-'));
const tutorial = await websiteFixture(source);
const fixtureFile=join(staging,'tutorial.json');
await writeFile(fixtureFile,JSON.stringify(tutorial));
const outputDirectory=join(staging,'public');
let result;
try { result=await buildPagesPreview({outputDirectory,fixtureFile,historyFrom:'2025-08-01T00:00:00.000Z',clean:false}); }
catch(error) {
 // The reviewed working UI adds four local assets. Preserve an exact allowlist;
 // do not weaken the producer's network guards or copy arbitrary extra files.
 if(!error.message.startsWith('Pages artifact allowlist mismatch:'))throw error;
 const files=(await readdir(outputDirectory,{recursive:true,withFileTypes:true})).filter(f=>f.isFile()).map(f=>join(f.parentPath,f.name).slice(outputDirectory.length+1).replaceAll('\\','/')).sort();
 const allowed=[...PAGES_PUBLIC_FILES,'chart-tool-catalog.js','terminal-editors.js','workspace-customization.css','workspace-customization.js'];
 if(files.some(f=>!allowed.includes(f))||PAGES_PUBLIC_FILES.some(f=>!files.includes(f)))throw error;
 result={outputDirectory,files};
}

for (const name of result.files) {
  if (!/\.(?:js|html|svg)$/u.test(name)) continue;
  const path = join(result.outputDirectory, name);
  let text = standardRuntimeBytes('public/' + name, await readFile(path)).toString('utf8');
  if (name === 'runtime.js') {
    const match=text.match(/^const PERIOD_BOOTSTRAPS = (.*);$/m);
    if(!match)throw new Error('Demo period export contract changed');
    const month=JSON.parse(match[1]).month;
    text=text.replace(/^const BASE_BOOTSTRAP = .*;$/m,'const BASE_BOOTSTRAP = '+JSON.stringify(month)+';')
      .replace(/^const PERIOD_BOOTSTRAPS = .*;$/m,'const PERIOD_BOOTSTRAPS = {all:BASE_BOOTSTRAP,month:BASE_BOOTSTRAP};');
  }
  if (name === 'index.html') {
    text = text.replace('<h1 id="viewTitle">Обзор портфеля</h1>', '<h1 id="viewTitle">Обзор портфеля</h1><span class="demo-stamp">Демо</span>');
    text = text.replace('</head>', '  <link rel="stylesheet" href="./demo-frame.css?v=20260922-readonly">\n</head>');
    // The website shows one fixed period. Keep date fields explicitly
    // read-only; all editing is locked by demo-service.js.
    text = text.replace(/<form[^>]+id="(?:statisticsPeriodForm|operationFilters)"[\s\S]*?<\/form>/gu, form => {
      const id = /id="([^"]+)"/u.exec(form)[1] + '-demo-note';
      const note = 'В демо показан фиксированный период. Свои даты можно выбрать в приложении.';
      return form.replace(/<input[^>]+type="date"[^>]*>/gu, tag => tag
        .replace(/\saria-describedby="[^"]*"/u, '')
        .replace('type="date"', `type="date" readonly aria-describedby="${id}" title="${note}"`))
        .replace('<option value="custom">Свои даты</option>', '<option value="custom" disabled>Свои даты — в приложении</option>')
        + `<p class="demo-period-note" id="${id}">${note}</p>`;
    });
    text = text.replace(/\s*<button[^>]+data-system-section="access"[\s\S]*?<\/button>/u, '');
    text = text.replace('</body>', '  <script src="./demo-service.js" defer></script>\n</body>');
  }
  if (name === 'terminal-workbench.js') text=text.replace('indicators:{volume:true},drawings:[]',"indicators:{volume:true},studies:[{id:'demo-sma20',type:'sma',period:20,color:'#e1b264',visible:true},{id:'demo-ema50',type:'ema',period:50,color:'#b9a9ff',visible:true}],drawings:[]").replace('function dirty(key){','function dirty(key){if(getBootstrap()?.preview?.readOnly)return;').replace("freshness.fixture?'Тестовые данные':'Т‑Инвест'", "freshness.fixture?'Демо':'Демо'");
  if (name === 'market-participants.js') text = text.replace('Задержка 15 дней', 'Вымышленный пример').replace('Московская биржа · срез', 'Демонстрация FUTOI · срез');
  if (name === 'app.js') text = text.replace("from './runtime.js'", "from './demo-runtime.js'").replaceAll('Показатели обновляются автоматически.', 'Пример готового отчёта. Показатели вымышлены.');
  if (name === 'market-calendar.js') text = text
    .replace('!getBootstrap()?.preview?.static', '(!getBootstrap()?.preview?.static || getBootstrap()?.preview?.interactiveTutorial === true)')
    .replace('async function loadCalendar(refresh=false){','async function loadCalendar(refresh=false){if(getBootstrap()?.preview?.readOnly)refresh=false;')
    .replace('clearTimeout(calendarTimer);if(disposed)return;','clearTimeout(calendarTimer);if(disposed||getBootstrap()?.preview?.readOnly)return;')
    .replace("month:moscowDate().slice(0,7),day:moscowDate()","month:'2026-09',day:'2026-09-22'");
  await writeFile(path, text);
}
await cp(result.outputDirectory,join(site,'demo'),{recursive:true});
for (const name of ['demo-frame.css', 'demo-runtime.js', 'demo-service.js']) await copyFile(join(site, 'assets', name), join(site, 'demo', name));
console.log(JSON.stringify({ status: 'synthetic-demo-built', files: result.files.length + 3, brokerNetwork: false, output: result.outputDirectory }));
