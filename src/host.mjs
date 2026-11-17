import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { service, hostCapabilities, parentModel, composeParent, inheritPermissions, recordModel, resolveParent } from './compat.mjs';
import { PREFIX, requireId, ownId, contextExcerpt, relationshipPrompt } from './core.mjs';
import { createCleaner } from './cleanup.mjs';
export const name = 'codex-sidechat';
export const inject = ['connection','agents','agentPresets','sessionQuery','sessionPersistence','sessions','permissionPresets','sessionController','sessionProjections','agentDefaultModel'];
export function apply(ctx, config={}) {
  const records=new Map(), pending=new Map(); let ending=false;
  const logger={warn:(...args)=>console.warn('[codex-sidechat]',...args)};
  const persistence={
    stat:(...args)=>service(ctx,'sessionPersistence')?.stat?.(...args),
    locate:(...args)=>service(ctx,'sessionPersistence')?.locate?.(...args),
  };
  const journalDir=isAbsolute(config.journalDir ?? '') ? config.journalDir : join(process.env.DSH_HOME || join(homedir(),'.dsh'),'codex-sidechat','journals');
  let cleanerPromise;
  const cleaner=()=>cleanerPromise ??= createCleaner({persistence,journalDir,logger}).then(async c=>{ await c.recover(); return c; });
  if(typeof ctx.inject==='function') ctx.inject(['sessionPersistence'],()=>{ cleaner().catch(error=>logger.warn('上次退出清理待重试：',error.message)); });
  function publicRecord(r) { return {id:r.id,parentId:r.parentId,title:r.title,createdAt:r.createdAt}; }
  async function doOpen(input) {
    const caps=hostCapabilities(ctx);
    if(!caps.available) throw new Error('当前 DSH 接口不满足：'+caps.missing.join('、'));
    const parentId=requireId(input.parentId);
    if(ownId(parentId)) throw new Error('请从主会话打开侧聊，暂不支持侧聊里再开侧聊');
    if(ending) throw new Error('应用正在退出');
    const existing=[...records.values()].filter(r=>r.parentId===parentId).at(-1);
    if(existing && !input.fresh) return {record:publicRecord(existing),records:[...records.values()].filter(r=>r.parentId===parentId).map(publicRecord)};
    const parent=await resolveParent(ctx,parentId);
    const permissions=service(ctx,'permissionPresets');
    if(!permissions?.current || !permissions?.set) throw new Error('DSH 未提供权限继承接口');
    if(permissions.current(parent.session)==='custom') throw new Error('主会话正在使用自定义权限，请先选择原生权限预设后再开启侧聊');
    const selection=parentModel(parent,service(ctx,'agentDefaultModel'),service(ctx,'sessionProjections'));
    const excerpt=contextExcerpt(await service(ctx,'sessionQuery').readSession(parentId));
    const id=PREFIX+randomUUID();
    const c=await cleaner();
    // Ownership is durably recorded before creating any session artifact.
    await c.track({id,parentSession:parentId});
    let handle;
    try {
      handle=await service(ctx,'agents').create({
        sessionId:id,
        meta:{parentSession:parentId, ...(parent.session.header.cwd ? {cwd:parent.session.header.cwd}:{}), ...(typeof parent.session.header.agentPreset==='string'?{agentPreset:parent.session.header.agentPreset}:{})},
        agentOptions:selection,
        setup:async childCtx=>{
          await composeParent(ctx,childCtx,parent);
          if(!childCtx.systemPrompt?.section || !childCtx.tools?.register) throw new Error('DSH 原生智能体组合不完整');
          childCtx.systemPrompt.section({name:'codex-sidechat:context',order:90,text:relationshipPrompt(parentId,excerpt)});
          childCtx.tools.register({
            name:'side_chat_context',description:'按需读取主会话的相关背景，仅读取，不向主会话添加消息。',
            parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},
            output:{schema:{type:'object',properties:{context:{type:'string'}},required:['context'],additionalProperties:false},render:(_args,value)=>[{type:'text',text:value.context}]},
            execute:async args=>({context:contextExcerpt(await service(ctx,'sessionQuery').readSession(parentId),args.query)}),
          });
        },
      });
      inheritPermissions(ctx,parent,handle.agent);
      await recordModel(ctx,handle.agent,selection);
      if(ending) throw new Error('应用正在退出');
      const record={id,parentId,title:'侧边聊天 '+([...records.values()].filter(r=>r.parentId===parentId).length+1),createdAt:Date.now(),handle};
      records.set(id,record);
      return {record:publicRecord(record),records:[...records.values()].filter(r=>r.parentId===parentId).map(publicRecord)};
    } catch(error) {
      await handle?.dispose?.();
      const result=await c.cleanup(id); if(result?.warning) logger.warn(result.warning);
      throw error;
    }
  }
  async function open(input={}) {
    const key=requireId(input.parentId);
    if(pending.has(key)) return pending.get(key);
    const task=doOpen(input); pending.set(key,task);
    try { return await task; } finally {pending.delete(key);}
  }
  async function end(id) {
    if(!ownId(id) || !records.has(id)) throw new Error('只能清理本次运行创建的侧边聊天');
    const r=records.get(id);
    const sessions=service(ctx,'sessions');
    // DSH may dispose the Session store before plugin effects during application exit.
    if(!sessions?.get || sessions.get(id)===r.handle.agent.session) await sessions?.flush?.(r.handle.agent.session);
    await r.handle.dispose();
    records.delete(id);
    return (await cleaner()).cleanup(id);
  }
  const handlers={
    'codexSidechat.status':async()=>({...hostCapabilities(ctx),version:'0.1.0',temporary:true}),
    'codexSidechat.open':open,
    'codexSidechat.list':async input=>[...records.values()].filter(r=>r.parentId===input.parentId).map(publicRecord),
    'codexSidechat.end':async input=>end(requireId(input.id)),
  };
  const connection=service(ctx,'connection'); const disposers=[];
  const invoke=async(method,payload)=>{
    try { if(!handlers[method]) throw new Error('未知侧聊接口'); return {ok:true,value:await handlers[method](payload)}; }
    catch(error){ return {ok:false,error:{code:'sidechat-error',message:error?.message ?? String(error),details:{}}}; }
  };
  try {
    if(typeof connection?.fetch?.register==='function') {
      for(const method of Object.keys(handlers)) disposers.push(connection.fetch.register({path:'/api/'+method,methods:['POST'],requestBody:'buffered',async fetch(request){
        let body; try {body=await request.json();} catch {return new Response('body is not JSON',{status:400});}
        if(body?.type!=='client-request'||typeof body.rpcId!=='string'||body.method!==method) return new Response('invalid request',{status:400});
        return Response.json({type:'server-response',rpcId:body.rpcId,result:await invoke(method,body.payload)});
      }}));
    } else if(typeof connection?.rpc?.handle==='function') disposers.push(connection.rpc.handle('/codex-sidechat',invoke));
    else logger.warn('Connection RPC 不可用，插件已安全停用');
  } catch(error) { logger.warn('注册侧聊接口失败：',error.message); for(const dispose of disposers) dispose?.(); }
  ctx.effect(()=>async()=>{
    ending=true;
    await Promise.allSettled([...pending.values()]);
    for(const id of [...records.keys()]) {try{await end(id);}catch(error){logger.warn('退出清理待下次重试：',error.message);}}
    if(cleanerPromise) {try{await (await cleanerPromise).close();}catch(error){logger.warn('清理日志已保留：',error.message);}}
    await Promise.allSettled(disposers.map(dispose=>Promise.resolve().then(()=>dispose?.())));
  },'codex-sidechat: ordered session cleanup');
}
