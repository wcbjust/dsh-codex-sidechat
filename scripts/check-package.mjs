import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export async function checkPackage(root=new URL('../',import.meta.url)){
 const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
 if(pkg.name!=='dsh-codex-sidechat'||pkg.private===true)throw new Error('包名或 public 状态不正确');
 if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version))throw new Error('缺少准确版本');
 if(pkg.dsh?.bundle?.patch!=='./cordis.patch.yml'||pkg.exports?.['./client']!=='./lib/client.js')throw new Error('DSH bundle / client 入口不正确');
 for(const item of [pkg.main,pkg.exports['./client'],pkg.dsh.bundle.patch,'./LICENSE','./README.md'])if(!(await stat(new URL(item,root))).isFile())throw new Error('缺少包文件：'+item);
 for(const hook of ['preinstall','install','postinstall','prepare'])if(pkg.scripts?.[hook])throw new Error('安装包不应依赖安装时构建：'+hook);
 const client=await readFile(new URL('lib/client.js',root),'utf8');if(!client.includes('window.__ModuleLoader__.load'))throw new Error('客户端未构建');
 return {name:pkg.name,version:pkg.version,root:fileURLToPath(root),prebuilt:true};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))console.log(JSON.stringify(await checkPackage()));
