
import test from 'node:test';import assert from 'node:assert/strict';
import {requireId,ownId,contextExcerpt,createStore} from '../src/core.mjs';
import {hostCapabilities,parentModel,composeParent,inheritPermissions,clientCapabilities,recordModel} from '../src/compat.mjs';
test('validates identities and never treats arbitrary sessions as owned',()=>{
 assert.equal(requireId('normal-parent'),'normal-parent');
 for(const id of ['../parent','a\\b','a b','',null])assert.throws(()=>requireId(id));
 assert.equal(ownId('codex-side-00000000-0000-0000-0000-000000000001'),true);
 assert.equal(ownId('codex-side-../../foo'),false);assert.equal(ownId('normal-parent'),false);
});
test('context retrieval is bounded and matches terms',()=>{
 const snapshot={events:[{type:'user',text:'apple'},{type:'assistant',text:'pear'},...Array.from({length:80},()=>({type:'assistant',text:'z'.repeat(8000)}))]};
 const text=contextExcerpt(snapshot,'apple');assert.match(text,/apple/);assert.doesNotMatch(text,/pear/);
 assert.ok(contextExcerpt(snapshot).length<=26000);assert.match(contextExcerpt({events:[]}),/暂无/);
});
test('capability detection works without checking a version number',()=>{
 const ctx={agents:{create(){},get(){}},agentPresets:{mount(){}},sessionPersistence:{stat(){}},sessionQuery:{readSession(){}}};
 assert.equal(hostCapabilities(ctx).available,true);delete ctx.agents.create;assert.ok(hostCapabilities(ctx).missing.includes('agents.create'));
 assert.equal(clientCapabilities({}).available,false);
});
test('model inheritance includes effective selection rather than only initial options',()=>{
 const parent={options:{model:'old',provider:'p'},session:{requestHeader:()=>({config:{reasoningEffort:'high'}})},model:{current:()=>({provider:'p',model:'new',reasoningEffort:'high'})}};
 assert.deepEqual(parentModel(parent),{provider:'p',model:'new',reasoningEffort:'high'});
});
test('prefers public preset composition; historical parents use public mount fallback',async()=>{
 const calls=[];const ctx={agentPresets:{composeFrom:(...args)=>calls.push(['compose',...args]),mount:(...args)=>calls.push(['mount',...args])}};
 await composeParent(ctx,'child',{ctx:'parent'});await composeParent(ctx,'child',{session:{header:{agentPreset:'standard'}}});
 assert.deepEqual(calls,[['compose','child','parent'],['mount','child','standard']]);
});
test('custom or unavailable permissions cannot silently widen access',()=>{
 assert.throws(()=>inheritPermissions({}, {}, {}),/权限/);
 assert.throws(()=>inheritPermissions({permissionPresets:{current:()=> 'custom',set(){throw Error('must not call');}}},{session:{}},{session:{}}),/自定义/);
 let set;inheritPermissions({permissionPresets:{current:()=> 'workspace-write',set:(_,v)=>set=v}},{session:{}},{session:{}});assert.equal(set,'workspace-write');
});
test('external-store snapshots remain stable between actual updates',()=>{
 const store=createStore({value:1});assert.equal(store.get(),store.get());let updates=0;const stop=store.subscribe(()=>updates++);store.patch({value:2});stop();store.patch({value:3});assert.equal(updates,1);
});

test('model adapter prefers agent selection and falls back to native controller',async()=>{
 const calls=[];const selection={provider:'p',model:'m',reasoningEffort:'high'};
 await recordModel({sessionController:{selectModel:()=>assert.fail('wrong branch')}},{id:'child',model:{select:v=>calls.push(v)}},selection);
 await recordModel({sessionController:{selectModel:v=>calls.push(v)}},{id:'child'},selection);
 assert.deepEqual(calls,[selection,{sessionId:'child',...selection}]);
 await assert.rejects(()=>recordModel({},{id:'child'},selection),/模型选择接口/);
 assert.equal(parentModel({options:{model:'old'},session:{}},undefined,{stateOf:()=>({pending:{provider:'p',model:'pending'}})}).model,'pending');
});

test('a pending model without explicit effort does not inherit the previous model effort',()=>{
 const parent={options:{provider:'old',model:'old'},session:{requestHeader:()=>({config:{provider:'old',model:'old',reasoningEffort:'high'}})}};
 const result=parentModel(parent,undefined,{stateOf:()=>({pending:{provider:'new',model:'new'}})});
 assert.deepEqual(result,{provider:'new',model:'new'});
});
