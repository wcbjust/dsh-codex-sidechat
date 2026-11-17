
import { mkdir, readFile, writeFile, rename, readdir, lstat, unlink, rmdir } from 'node:fs/promises';
import { resolve, dirname, basename, join, isAbsolute, parse } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ownId, requireId } from './core.mjs';
const JOURNAL=/^(?:owner|recover)-(\d+)-[0-9a-f-]{36}\.json$/i;
const ARTIFACT=/^session(?:\.v[1-9]\d*)?\.jsonl(?:\.zstd)?$/;
function record(value) {
 if(!ownId(value?.id)) throw new Error('拒绝操作非本插件会话');
 requireId(value.parentSession); if(ownId(value.parentSession))throw new Error('无效的主会话归属');
 return {id:value.id,parentSession:value.parentSession};
}
async function noSymlinks(target) {
 let current=resolve(target);const root=parse(current).root;
 while(current!==root){const info=await lstat(current);if(info.isSymbolicLink())throw new Error('拒绝通过符号链接清理会话');current=dirname(current);}
}
function alive(pid) {
 if(!Number.isSafeInteger(pid)||pid<=0)return true;
 try{process.kill(pid,0);return true;}catch(error){return error.code!=='ESRCH';}
}
export async function createCleaner({persistence,journalDir,logger=console,pid=process.pid}) {
 if(!isAbsolute(journalDir))throw new Error('清理日志目录必须为绝对路径');
 await mkdir(journalDir,{recursive:true});await noSymlinks(journalDir);
 const path=join(journalDir,`owner-${pid}-${randomUUID()}.json`),tracked=new Map();let chain=Promise.resolve();
 const exclusive=fn=>{const task=chain.then(fn);chain=task.catch(()=>{});return task;};
 async function persist(){
  if(!tracked.size){try{await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}return;}
  const temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify({format:1,plugin:'dsh-codex-sidechat',owner:{pid},records:[...tracked.values()]}),{flag:'wx',mode:0o600});
  await rename(temporary,path);
 }
 async function cleanupRecord(item){
  try{
   const stored=await persistence.stat(item.id);
   if(!stored)return {deleted:true,absent:true};
   if(stored.header?.id!==item.id||stored.header?.parentSession!==item.parentSession)throw new Error('会话归属校验失败，已保留记录');
   const location=stored.location??await persistence.locate?.(stored.header);
   if(location?.kind!=='jsonl'||typeof location.path!=='string'||!isAbsolute(location.path))throw new Error('当前存储后端没有可验证的逐会话清理接口');
   if(location.path.split(/[\\/]/).includes('..'))throw new Error('拒绝包含上级目录跳转的清理路径');
   const target=resolve(location.path);
   if(!ARTIFACT.test(basename(target))||![item.id,encodeURIComponent(item.id)].includes(basename(dirname(target))))throw new Error('会话文件路径不属于本插件会话');
   try{await noSymlinks(target);}catch(error){if(error.code==='ENOENT')return {deleted:true,absent:true};throw error;}
   if(!(await lstat(target)).isFile())throw new Error('会话记录不是普通文件');
   await unlink(target);
   try{await rmdir(dirname(target));}catch(error){if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(error.code))throw error;}
   return {deleted:true};
  }catch(error){return {deleted:false,warning:error?.message??String(error)};}
 }
 async function clean(id){
  if(!ownId(id))throw new Error('拒绝清理非本插件会话');
  const item=tracked.get(id);if(!item)throw new Error('没有本次插件创建的会话归属记录');
  const result=await cleanupRecord(item);
  if(result.deleted){tracked.delete(id);await persist();}
  return result;
 }
 return {
  track:value=>exclusive(async()=>{const item=record(value);if(tracked.has(item.id)&&tracked.get(item.id).parentSession!==item.parentSession)throw new Error('会话归属冲突');tracked.set(item.id,item);await persist();}),
  forget:id=>exclusive(async()=>{if(!ownId(id))throw new Error('无效侧聊');tracked.delete(id);await persist();}),
  cleanup:id=>exclusive(()=>clean(id)),
  recover:()=>exclusive(async()=>{
   let deleted=0,pending=0;
   for(const filename of await readdir(journalDir)){
    const match=JOURNAL.exec(filename);if(!match||alive(Number(match[1])))continue;
    const oldPath=join(journalDir,filename);let data;
    try{if(!(await lstat(oldPath)).isFile())continue;await noSymlinks(oldPath);data=JSON.parse(await readFile(oldPath,'utf8'));}catch{continue;}
    if(data?.format!==1||data.plugin!=='dsh-codex-sidechat'||!Array.isArray(data.records))continue;
    let items;try{items=data.records.map(record);}catch{continue;}
    // Atomic rename claims this abandoned owner's journal against other starting hosts.
    const claimed=join(journalDir,`recover-${pid}-${randomUUID()}.json`);
    try{await rename(oldPath,claimed);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    const remaining=[];
    for(const item of items){const result=await cleanupRecord(item);if(result.deleted)deleted++;else{remaining.push(item);pending++;logger.warn?.('[codex-sidechat] 待重试清理：'+result.warning);}}
    for(const item of remaining)tracked.set(item.id,item);
    if(remaining.length)await persist();
    await unlink(claimed);
   }
   return {deleted,pending};
  }),
  close:()=>exclusive(async()=>{
   const results=[];for(const id of [...tracked.keys()])results.push({id,...await clean(id)});
   return results;
  }),
 };
}
