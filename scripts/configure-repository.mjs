import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export function repository(value) {
 const input=String(value??'').trim().replace(/^https:\/\/github\.com\//i,'').replace(/\/$/,'').replace(/\.git$/,'');
 if(!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(input)||input.split('/').some(x=>x==='.'||x==='..')) throw new Error('请输入真实的 GitHub OWNER/REPO 或 https://github.com/OWNER/REPO');
 return input;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const repo=repository(process.argv[2]);const path=new URL('../package.json',import.meta.url);const pkg=JSON.parse(await readFile(path,'utf8'));
 pkg.repository={type:'git',url:'git+https://github.com/'+repo+'.git'};
 pkg.homepage='https://github.com/'+repo+'#readme';pkg.bugs={url:'https://github.com/'+repo+'/issues'};
 await writeFile(path,JSON.stringify(pkg,null,2)+'\n');console.log('已设置仓库：'+repo);
}
