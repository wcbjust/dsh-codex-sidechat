import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {repository} from '../scripts/configure-repository.mjs';
import {createIndex} from '../scripts/create-index.mjs';
import {checkPackage} from '../scripts/check-package.mjs';
const root=new URL('../',import.meta.url);
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
test('repository accepts GitHub coordinates and rejects malformed locations',()=>{
 assert.equal(repository('https://github.com/example/sidechat.git'),'example/sidechat');
 for(const value of ['','example','../sidechat','example/..','https://other.example/a/b','example/side/chat'])assert.throws(()=>repository(value));
});
test('discover index pins the install to a commit and retains compatibility metadata',()=>{
 const sha='1234567890abcdef1234567890abcdef12345678';
 const index=createIndex(pkg,'example/sidechat',sha,1794672000);
 assert.equal(index.format,1);
 assert.deepEqual(index.plugins[0].versions[0],{version:pkg.version,publishTimestamp:1794672000,source:{type:'git',url:'https://github.com/example/sidechat',commit:sha},engines:{dsh:pkg.engines.dsh}});
 assert.equal(index.plugins[0].name,pkg.name);
 for(const value of [undefined,'main','REAL_40_HEX_COMMIT','a'.repeat(39),'A'.repeat(40)])assert.throws(()=>createIndex(pkg,'example/sidechat',value));
});
test('package validation catches install-time builds and a missing prebuilt client',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dsh-package-check-'));const url=pathToFileURL(dir+'/');
 try{
  for(const name of ['src','lib','LICENSE','README.md','cordis.patch.yml','package.json'])await cp(new URL(name,root),join(dir,name),{recursive:true});
  assert.equal((await checkPackage(url)).prebuilt,true);
  const copy=structuredClone(pkg);copy.scripts.postinstall='node build.mjs';
  await writeFile(join(dir,'package.json'),JSON.stringify(copy));
  await assert.rejects(checkPackage(url),/postinstall/);
  await writeFile(join(dir,'package.json'),JSON.stringify(pkg));
  await writeFile(join(dir,'lib/client.js'),'// missing build');
  await assert.rejects(checkPackage(url),/客户端未构建/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
