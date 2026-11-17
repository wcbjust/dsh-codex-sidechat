import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
test('Windows CRLF and Linux LF sources build byte-identical prebuilt clients',async()=>{
  const base=resolve(tmpdir());
  const temp=await mkdtemp(join(base,'dsh-build-parity-'));
  try{
    await mkdir(join(temp,'src'));
    await copyFile(new URL('build.mjs',root),join(temp,'build.mjs'));
    const names=['compat.mjs','core.mjs','client-body.js','style.css'];
    const sources=await Promise.all(names.map(name=>readFile(new URL('src/'+name,root),'utf8')));
    const builds=[];
    for(const eol of ['\n','\r\n']){
      for(let i=0;i<names.length;i++)await writeFile(join(temp,'src',names[i]),sources[i].replace(/\r\n?/g,'\n').replace(/\n/g,eol));
      execFileSync(process.execPath,[join(temp,'build.mjs')],{cwd:temp,stdio:'pipe'});
      builds.push(await readFile(join(temp,'lib/client.js')));
    }
    assert.deepEqual(builds[0],builds[1]);
    assert(!builds[0].includes(Buffer.from('\r')),'generated JavaScript should use LF');
  }finally{
    const within=relative(base,resolve(temp));
    assert(within&&!isAbsolute(within)&&within!=='..'&&!within.startsWith('..'+sep));
    await rm(temp,{recursive:true,force:true});
  }
});
