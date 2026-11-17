import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const out=resolve(root,'dist');await mkdir(out,{recursive:true});
if(!process.env.npm_execpath)throw new Error('请通过 npm run release:pack 运行');
execFileSync(process.execPath,[process.env.npm_execpath,'run','prepack'],{cwd:root,stdio:'inherit'});
const result=JSON.parse(execFileSync(process.execPath,[process.env.npm_execpath,'pack','--ignore-scripts','--json','--pack-destination',out],{cwd:root,encoding:'utf8'}));
const tar=join(out,result[0].filename);await writeFile(join(out,'npm-pack.json'),JSON.stringify(result,null,2)+'\n');
const zip=join(out,pkg.name+'-'+pkg.version+'-github-source.zip');let python;
for(const name of ['python3','python']){try{execFileSync(name,['--version'],{stdio:'pipe'});python=name;break;}catch{}}
if(!python)throw new Error('源码 ZIP 生成需要 Python 3，npm 包已生成：'+tar);
execFileSync(python,[join(root,'scripts/export-source.py'),zip],{cwd:root,stdio:'inherit'});
const sums=[];for(const file of [tar,zip])sums.push(createHash('sha256').update(await readFile(file)).digest('hex')+'  '+file.slice(out.length+1));
await writeFile(join(out,'SHA256SUMS.txt'),sums.join('\n')+'\n');console.log('本地发布文件已生成；未向 npm 或 GitHub 发布。');
