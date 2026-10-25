import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=process.env.INVEST_SOURCE||process.argv[2];
if(!source)throw new Error('Pass the reviewed Invest source path (Playwright dependency only).');
const {chromium}=createRequire(resolve(source,'package.json'))('@playwright/test');
const base=process.env.NEXUS_PREVIEW_URL||'http://127.0.0.1:8766';
assert.equal(new URL(base).hostname,'127.0.0.1','This check is only for an isolated preview.');
const output=resolve('nexus/qa/2026-10-25');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const report={source,base,checks:[],errors:[],networkAttempts:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=>{const r=route.request();if(!r.url().startsWith(base+'/')||!['GET','HEAD'].includes(r.method())){report.networkAttempts.push({url:r.url(),method:r.method()});return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.errors.push(r.status()+' '+r.url());});
 const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const screenshot=name=>page.screenshot({path:resolve(output,name+'.png')});
 await page.goto(base+'/nexus/demo/index.html');
 await page.waitForFunction(()=>document.documentElement.dataset.demoReady==='true');
 assert.match(await page.locator('.demo-studio').innerText(),/вымышленные данные/);
 await screenshot('demo-overview-desktop');
 const sections=['operations','analytics','glossary','risk-plan','terminal','alerts','events','ai','nexus-ai','settings','overview'];
 for(const view of sections){
  await page.locator('.nav-item[data-view="'+view+'"]').click();
  await page.locator('[data-view-panel="'+view+'"].active').waitFor();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Page overflow in '+view);
  report.checks.push({section:view,visible:true});
  if(view==='terminal'){
   await page.locator('#marketChart canvas').first().waitFor();
   await screenshot('demo-terminal-desktop');
   const panels=['stats','events','participants'];
   for(const key of panels){const control=page.locator('.terminal-panel-rail [data-terminal-tab="'+key+'"]');assert.equal(await control.count(),1);await control.click();await settle();assert.equal(await control.getAttribute('aria-pressed'),'true');}
   for(const key of ['book','tape','plan']){const control=page.locator('.terminal-panel-rail [data-panel="'+key+'"]');await control.click();await settle();assert.equal(await control.getAttribute('aria-pressed'),'true');}
  }
  if(view==='settings'){
   for(const key of ['appearance','workspace','charts','account','data','about']){
    await page.locator('[data-settings-tab="'+key+'"]').click();await settle();
    assert.equal(await page.locator('[data-settings-tab="'+key+'"]').getAttribute('aria-current'),'page');
   }
   await page.locator('[data-settings-tab="appearance"]').click();await page.locator('#mainContent').evaluate(el=>el.scrollTop=0);await screenshot('demo-settings-desktop');
  }
  if(view==='nexus-ai'){
   await page.getByText('Предпросмотр Nexus AI.',{exact:false}).first().waitFor();
   assert.equal(await page.locator('.nexus-ai-workspace textarea').isDisabled(),true,'AI composer must remain offline');
   await screenshot('demo-ai-desktop');
  }
 }
 await page.locator('[data-term]').first().click();await page.locator('#termPopover.visible').waitFor();await page.keyboard.press('Escape');
 const boundary=await page.evaluate(async()=>{const {runtimeAdapter:r}=await import('./demo-runtime.js');const b=await r.request('/api/bootstrap');const plans=await r.request('/api/trading-plan');let rejected=0;for(const method of ['POST','PUT','PATCH','DELETE'])for(const path of ['/api/trading-plan','/api/nexus-ai/conversations','/api/market/preferences','/api/calendar/settings','/api/connection']){try{await r.request(path,{method,body:'{}'});}catch(e){if(e.code==='DEMO_READ_ONLY')rejected++;}}return {static:b.preview.static,readOnly:b.preview.readOnly,plans:plans.items.length,rejected};});
 assert.equal(boundary.static,true);assert.equal(boundary.readOnly,true);assert.equal(boundary.plans,2);assert.equal(boundary.rejected,20);report.boundary=boundary;
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});await page.goto(base+'/nexus/demo/index.html');await page.waitForFunction(()=>document.documentElement.dataset.demoReady==='true');await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile overview overflow');
  await screenshot('demo-overview-'+width);
  await page.locator('[data-open-rail]').click();await page.locator('.nav-item[data-view="terminal"]').click();await settle();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile terminal overflow');await screenshot('demo-terminal-'+width);
  report.checks.push({viewport:width,mobileNavigation:true});
 }
 assert.deepEqual(report.errors,[],'Browser errors');assert.deepEqual(report.networkAttempts,[],'The demo attempted external or mutating requests');report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack;process.exitCode=1;}
finally{await writeFile(resolve(output,'demo-browser.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
