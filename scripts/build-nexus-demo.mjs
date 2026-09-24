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
const {verifyNexusDemoModule}=await import('./verify-nexus-demo-module.mjs');
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
    // Market archive is synthetic and independent of the portfolio accounting period.
    const quotation=q=>typeof q==='number'?q:Number(q.units)+q.nano/1e9;
    month.candles=tutorial.accounts[0].candles.map(row=>({...row,...Object.fromEntries(['open','high','low','close','volume'].map(key=>[key,quotation(row[key])]))}));
    month.preview={...month.preview,chartReview:true};
    text=text.replace(/^const BASE_BOOTSTRAP = .*;$/m,'const BASE_BOOTSTRAP = '+JSON.stringify(month)+';')
      .replace(/^const PERIOD_BOOTSTRAPS = .*;$/m,'const PERIOD_BOOTSTRAPS = {all:BASE_BOOTSTRAP,month:BASE_BOOTSTRAP};');
  }
  if (name === 'index.html') {
    text = text.replace('<h1 id="viewTitle">Обзор портфеля</h1>', '<h1 id="viewTitle">Обзор портфеля</h1><span class="demo-stamp">Демо · графики можно изменять</span>');
    text = text.replace('</head>', '  <link rel="stylesheet" href="./demo-frame.css?v=20260924-chart-review">\n</head>');
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
    text = text.replace('</body>', '  <footer class="demo-studio">Сделано в студии <a data-demo-studio href="https://vertux.online" target="_blank" rel="noopener noreferrer">Vertux</a> · Вымышленные котировки</footer><script src="./demo-service.js" defer></script>\n</body>');
  }
  if (name === 'terminal-workbench.js') text=text.replace('indicators:{volume:true},drawings:[]',"indicators:{volume:true},studies:[{id:'demo-sma20',type:'sma',period:20,color:'#e1b264',visible:true},{id:'demo-ema50',type:'ema',period:50,color:'#b9a9ff',visible:true}],drawings:[]").replace('function dirty(key){','function dirty(key){if(getBootstrap()?.preview?.readOnly)return;').replace("freshness.fixture?'Тестовые данные':'Т‑Инвест'", "freshness.fixture?'Демо':'Демо'");
  if (name === 'terminal-market-activity.js') text=text.replace('clock=Date.now', "clock=()=>Date.parse('2026-08-12T12:00:00Z')").replace("fixture:'Тестовый поток'", "fixture:'Демонстрационный снимок'").replace('Последние 200 сделок с момента подключения.','Вымышленные сделки для просмотра ленты.');
  if (name === 'terminal-workbench.js') {
    text=text.replace('activity.select(meta);','activity.select(meta);demoMarketSnapshot(meta);');
    text=text.replace(' function selection(id)', `
 function demoMarketSnapshot(meta){
  const row=(getBootstrap()?.candles||[]).filter(r=>r.instrumentUid===meta.instrumentUid).at(-1);if(!row)return;
  const price=row.close,step=Math.max(.01,Math.round(price*.00005*100)/100),at='2026-08-12T12:00:00Z';
  activity.reset();activity.state({state:'fixture',simulated:true});
  activity.receive({type:'market.book',instrumentUid:meta.instrumentUid,consistent:true,sourceEventTime:at,connectorReceivedAt:at,simulated:true,
   bids:Array.from({length:20},(_,i)=>({price:price-step*(i+1),quantity:10+i*7})),
   asks:Array.from({length:20},(_,i)=>({price:price+step*(i+1),quantity:18+i*5}))});
  for(let i=0;i<20;i++)activity.receive({type:'market.trade',instrumentUid:meta.instrumentUid,price:price+(i%2?1:-1)*step,quantity:1+i%8,side:i%2?'buy':'sell',sourceEventTime:new Date(Date.parse(at)-(19-i)*1000).toISOString(),connectorReceivedAt:at,simulated:true});
 }
 function selection(id)`);
  }
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
await verifyNexusDemoModule(source,join(site,'demo'));
console.log(JSON.stringify({ status: 'synthetic-demo-built', files: result.files.length + 3, brokerNetwork: false, output: result.outputDirectory }));
