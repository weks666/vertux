import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const source=process.argv[2];if(!source)throw Error('Pass the reviewed Invest checkout for the browser dependency.');
const base='https://vertux.online/';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// .nojekyll is a build marker; Pages intentionally does not serve dotfiles.
const files=(await readdir('nexus/demo',{recursive:true,withFileTypes:true})).filter(f=>f.isFile()&&!f.name.startsWith('.')).map(f=>resolve(f.parentPath,f.name).slice(process.cwd().length+1).replaceAll('\\','/'));
files.push(...['index','invest','pricing','workspace','download','security','updates','offer','privacy','consent'].map(f=>'nexus/'+f+'.html'));
files.push(...['demo-frame.css','demo-runtime.js','demo-service.js'].map(f=>'nexus/assets/'+f));
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),base,files:[],browserErrors:[],demoNetworkAttempts:[]};
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{while(cursor<files.length){const path=files[cursor++];try{const expected=hash(await readFile(path)),response=await fetch(base+path,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)}),actual=hash(Buffer.from(await response.arrayBuffer()));report.files.push({path,status:response.status,match:response.ok&&expected===actual,sha256:actual});}catch(e){report.files.push({path,match:false,error:e.message});}}}));
const mismatches=report.files.filter(f=>!f.match);
const {chromium}=createRequire(resolve(source,'package.json'))('@playwright/test');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 assert.equal(mismatches.length,0,'Published hashes differ: '+mismatches.map(f=>f.path).join(', '));
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>report.browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.browserErrors.push(m.text());});
 page.on('request',r=>{if(!r.url().startsWith(base)||!['GET','HEAD'].includes(r.method()))report.demoNetworkAttempts.push({url:r.url(),method:r.method()});});
 await page.goto(base+'nexus/demo/index.html');await page.waitForFunction(()=>document.documentElement.dataset.demoReady==='true');
 for(const view of ['terminal','settings','nexus-ai']){await page.locator('.nav-item[data-view="'+view+'"]').click();await page.locator('[data-view-panel="'+view+'"].active').waitFor();}
 await page.getByText('Предпросмотр Nexus AI.',{exact:false}).first().waitFor();
 assert.equal(await page.locator('.nexus-ai-workspace textarea').isDisabled(),true);
 const pin=await (await page.request.get(base+'nexus/demo/source.json')).json();assert.equal(pin.version,'0.6.52');report.source=pin;
 assert.deepEqual(report.browserErrors,[]);assert.deepEqual(report.demoNetworkAttempts,[]);
 report.status='LIVE_VERIFIED';
}catch(e){report.status='FAILED';report.failure=e.message;process.exitCode=1;}
finally{await browser.close();await mkdir('nexus/qa/2026-10-25',{recursive:true});await writeFile('nexus/qa/2026-10-25/live-verification.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify({status:report.status,commit:report.commit,checkedFiles:report.files.length,mismatches,browserErrors:report.browserErrors,networkAttempts:report.demoNetworkAttempts,failure:report.failure}));
