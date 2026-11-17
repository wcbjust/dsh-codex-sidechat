
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,access,rm}from'node:fs/promises';import {tmpdir}from'node:os';import {join}from'node:path';
import {apply}from'../src/host.mjs';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'codex-sidechat-host-'));const entries=new Map(),routes=new Map(),effects=[],calls=[];
 const mainEvents=[{type:'user',text:'主会话测试背景：检查文件兼容性'}];let created=0;
 const parent={id:'parent-test',ctx:{parent:true},options:{provider:'fixture',model:'fixture'},session:{header:{id:'parent-test',cwd:root,agentPreset:'standard'}}};
 const ctx={
  connection:{fetch:{register:entry=>{routes.set(entry.path,entry);return ()=>routes.delete(entry.path);}}},
  agents:{get:id=>id===parent.id?parent:undefined,async create(options){created++;const header={id:options.sessionId,cwd:root,parentSession:options.meta.parentSession};
   const dir=join(root,options.sessionId);await mkdir(dir);const path=join(dir,'session.v4.jsonl');await writeFile(path,'fixture session');entries.set(header.id,{header,location:{kind:'jsonl',path}});
   const child={systemPrompt:{section:p=>calls.push(['prompt',p])},tools:{register:p=>calls.push(['tool',p])}};await options.setup(child);
   const agent={id:header.id,session:{header},model:{select:selection=>calls.push(['model',selection])}};return {agent,dispose:async()=>calls.push(['dispose',header.id])};
  }},
  agentPresets:{composeFrom:()=>calls.push(['compose']),mount:()=>calls.push(['mount'])},
  permissionPresets:{current:()=> 'workspace-write',set:()=>calls.push(['permissions'])},
  sessionQuery:{readSession:async()=>({events:mainEvents})},sessionPersistence:{stat:async id=>entries.get(id),locate:header=>entries.get(header.id)?.location},
  sessions:{flush:async()=>{}},workspaceRegistry:{resolveByPath:async()=>({attachSession:async()=>{},detachSession:async()=>{}})},
  effect:fn=>{const off=fn();effects.push(off);return off;},
 };
 apply(ctx,{journalDir:join(root,'journal')});
 async function rpc(method,payload={}){const name='codexSidechat.'+method;const request=new Request('http://localhost/api/'+name,{method:'POST',body:JSON.stringify({type:'client-request',method:name,rpcId:'test',payload})});return (await (await routes.get('/api/'+name).fetch(request)).json()).result;}
 return {root,ctx,rpc,entries,calls,mainEvents,get created(){return created;},async dispose(){for(const fn of effects.reverse())await fn?.();await rm(root,{recursive:true,force:true});}};
}
test('real lifecycle composes native tools and keeps parent transcript untouched',async()=>{
 const f=await fixture();try{
  const result=await f.rpc('open',{parentId:'parent-test'});assert.equal(result.ok,true,result.error?.message);const id=result.value.record.id;
  assert.ok(id.startsWith('codex-side-'));assert.ok(f.calls.some(c=>c[0]==='compose'));assert.ok(f.calls.some(c=>c[0]==='permissions'));assert.ok(f.calls.some(c=>c[0]==='tool'&&c[1].name==='side_chat_context'));
  assert.equal(f.mainEvents.length,1);assert.equal((await f.rpc('open',{parentId:'parent-test'})).value.record.id,id);assert.equal(f.created,1);
  const extra=await f.rpc('open',{parentId:'parent-test',fresh:true});assert.notEqual(extra.value.record.id,id);assert.equal(extra.value.records.length,2);
  const resultEnd=await f.rpc('end',{id});assert.equal(resultEnd.ok,true,resultEnd.error?.message);assert.equal(resultEnd.value.deleted,true);await assert.rejects(()=>access(f.entries.get(id).location.path));
  const refused=await f.rpc('end',{id:'parent-test'});assert.equal(refused.ok,false);
 }finally{await f.dispose();}
});
test('concurrent clicks create one side session, not duplicate agents',async()=>{
 const f=await fixture();try{const [a,b]=await Promise.all([f.rpc('open',{parentId:'parent-test'}),f.rpc('open',{parentId:'parent-test'})]);assert.equal(a.value.record.id,b.value.record.id);assert.equal(f.created,1);}finally{await f.dispose();}
});
test('unavailable APIs report an error without failing host startup',async()=>{
 const f=await fixture();try{delete f.ctx.agents.create;const status=await f.rpc('status');assert.equal(status.value.available,false);const result=await f.rpc('open',{parentId:'parent-test'});assert.equal(result.ok,false);assert.equal(f.created,0);}finally{await f.dispose();}
});

test('historical parents resume through the native session controller',async()=>{
 const f=await fixture();try{
  const live=f.ctx.agents.get('parent-test');f.entries.set(live.id,{header:live.session.header});
  f.ctx.agents.get=()=>undefined;
  f.ctx.sessionController={resolveAgent:async id=>{f.calls.push(['resume',id]);return {agent:live};}};
  const result=await f.rpc('open',{parentId:'parent-test'});assert.equal(result.ok,true,result.error?.message);
  assert.ok(f.calls.some(c=>c[0]==='resume'));assert.ok(!f.calls.some(c=>c[0]==='mount'));
 }finally{await f.dispose();}
});
