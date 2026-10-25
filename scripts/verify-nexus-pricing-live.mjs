import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

// Fresh browser, GET/HEAD only; never follows checkout or submits an account form.
const base='https://vertux.online/';
const out='nexus/qa/2026-10-25-pricing-restore';
await mkdir(out,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),files:[],browserErrors:[],cases:[]};
for(const path of ['nexus/pricing.html','nexus/assets/commerce.css','nexus/assets/pricing.js','nexus/plans.json','nexus/offer.html']){
  const expected=hash(await readFile(path));
  const response=await fetch(base+path,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});
  const actual=hash(Buffer.from(await response.arrayBuffer()));
  report.files.push({path,status:response.status,sha256:actual,match:response.ok&&actual===expected});
}
const {chromium}=createRequire(resolve(process.argv[2]||'E:/VertuxBuilds/invest-focus040-ai-20261020','package.json'))('playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  assert.ok(report.files.every(f=>f.match),'Published hashes differ');
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const r=route.request(),url=new URL(r.url());
      if(['GET','HEAD'].includes(r.method())&&(url.origin==='https://vertux.online'||(url.origin==='https://nexus.vertux.online'&&url.pathname==='/api/auth/site-session')))return route.continue();
      report.browserErrors.push('Unexpected request: '+r.method()+' '+url.origin+url.pathname);
      return route.abort();
    });
    const page=await context.newPage();
    page.on('pageerror',e=>report.browserErrors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.browserErrors.push(m.text());});
    await page.goto(base+'nexus/pricing.html',{waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-tier-card]').count(),4);
    assert.equal(await page.locator('.nx-tier-title svg').count(),4);
    for(const lang of ['ru','en']){
      if(await page.locator('html').getAttribute('lang')!==lang)await page.locator('[data-lang-toggle]').click();
      for(const [term,months,factor] of [['month',1,1],['quarter',3,2.7],['year',12,10]]){
        await page.locator('[data-subscription-term="'+term+'"]').click();
        for(const [id,monthly] of [['standard',1500],['plus',2500],['pro',3500]]){
          const card=page.locator('[data-tier-card="'+id+'"]');
          assert.equal(await card.locator('[data-price-rub]').getAttribute('data-price-rub'),String(Math.round(monthly*factor)));
          const target=new URL(await card.locator(':scope > a').getAttribute('href'));
          assert.equal(target.searchParams.get('months'),String(months));
          assert.equal(target.searchParams.get('plan'),'invest-'+id);
        }
        assert.equal(await page.locator('[data-tier-card="free"] [data-price-rub]').getAttribute('data-price-rub'),'0');
        assert.equal(await page.locator('[data-tier-card="free"] > a').getAttribute('href'),'invest.html#demo');
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      report.cases.push({width,lang,plans:4,terms:[1,3,12],status:'PASS'});
    }
    await context.close();
  }
  assert.deepEqual(report.browserErrors,[]);
  report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;}
finally{
  await browser.close();
  await writeFile(out+'/live-pricing-verification.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
