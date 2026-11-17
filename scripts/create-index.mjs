import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {repository} from './configure-repository.mjs';
export function createIndex(pkg,repo,commit,timestamp=Math.floor(Date.now()/1000)){
 repo=repository(repo);if(!/^[0-9a-f]{40}$/.test(commit??''))throw new Error('索引需要真实的 40 位提交 SHA');
 return {format:1,title:{en:'DSH Codex Side Chat',zh:'DSH 侧边聊天'},description:{en:'Independent native side chat for DeepSeek Harness',zh:'独立的原生临时侧边聊天'},plugins:[{
 name:pkg.name,title:{en:'Codex Side Chat',zh:'Codex 风格侧边聊天'},description:{en:'Native tools, separate context, cleanup on exit.',zh:pkg.description},homepage:'https://github.com/'+repo,repository:{type:'git',url:'https://github.com/'+repo},metadata:{keywords:pkg.keywords},versions:[{version:pkg.version,publishTimestamp:timestamp,source:{type:'git',url:'https://github.com/'+repo,commit},engines:{dsh:pkg.engines.dsh}}]
 }]};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 const [repo,commit,output='dist/index.json']=process.argv.slice(2);const index=createIndex(pkg,repo,commit);const target=resolve(output);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(index,null,2)+'\n');console.log('已生成：'+target);
}
