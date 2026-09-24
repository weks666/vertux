import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function verifyNexusDemoModule(source, demo) {
 const product=JSON.parse(await readFile(resolve(source,'manifest/standard-product.json'),'utf8'));
 const version=product.serviceModule.version,folder='service-module/v'+version;
 const index=await readFile(resolve(demo,'index.html'),'utf8');
 const pins=[...index.matchAll(/src=["']\.\/service-module\/v([^/]+)\/vertux-service-center\.js/g)].map(m=>m[1]);
 assert.deepEqual(pins,[version],'public demo must use the product manifest module');
 const manifest=JSON.parse(await readFile(resolve(source,'public',folder,'manifest.json'),'utf8'));
 assert.equal(manifest.version,version);
 for(const asset of manifest.assets){
  const bytes=await readFile(resolve(demo,folder,asset.file));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,'public demo asset '+asset.file);
 }
 return {version,assets:manifest.assets.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const site=resolve(dirname(fileURLToPath(import.meta.url)),'../nexus');
 console.log(await verifyNexusDemoModule(resolve(process.argv[2]||resolve(site,'../../vertux-invest-workspace')),resolve(site,'demo')));
}
