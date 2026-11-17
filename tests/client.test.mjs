
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile}from'node:fs/promises';
const bundle=await readFile(new URL('../lib/client.js',import.meta.url),'utf8');
function fixture(missing=false){
 const entries=[],types=[],effects=[],listeners=new Set();let plugin;
 const React={createElement:(type,props,...children)=>({type,props,children}),Component:class{}};
 const element=()=>({dataset:{},style:{},appendChild(){},remove(){},addEventListener(){},set textContent(v){},hidden:false});
 const document={createElement:element,head:element(),body:element(),addEventListener:(name)=>listeners.add(name),removeEventListener:(name)=>listeners.delete(name)};
 const context=vm.createContext({console,document,window:{__ModuleLoader__:{load:mod=>{plugin=mod.factory(()=>React);}}},setTimeout,clearTimeout});
 vm.runInContext(bundle,context);
 const ctx={slots:{register:(entry,component)=>{entries.push({entry,component});return ()=>{};},inject:(_,fn)=>fn()},sidebarRight:{openTab(){}},sidebarRightTabs:{register:type=>{types.push(type);return ()=>{};}},sessions:{retain(){}},effect:fn=>{const dispose=fn();effects.push(dispose);return dispose;},connection:{}};
 if(missing)delete ctx.sidebarRightTabs;
 return {plugin,ctx,entries,types,effects,listeners};
}
test('registers a visible native guide card and a retained tab body',()=>{
 const f=fixture();f.plugin.apply(f.ctx);
 assert.equal(f.types.length,1);assert.equal(f.types[0].guide[0].title(),'侧边聊天');assert.equal(f.types[0].guide[0].order,5);assert.equal(f.types[0].keepMounted,true);
 const tab=f.entries.find(x=>x.entry.name==='sidebar.right.pane.tab');assert.ok(tab);assert.equal(tab.entry.key,f.types[0].id);
 assert.equal(tab.entry.children['codex.sidechat.native'].scope,'session');
 assert.ok(f.entries.some(x=>x.entry.name==='conversation.session.header.actions'));
 for(const fn of f.effects.reverse())fn?.();assert.equal(f.listeners.size,0);
});
test('missing new-version capability disables only the plugin without throwing',()=>{const f=fixture(true);assert.doesNotThrow(()=>f.plugin.apply(f.ctx));assert.equal(f.types.length,0);});
test('does not replace the main conversation component or register a custom composer',()=>{
 const f=fixture();f.plugin.apply(f.ctx);assert.ok(f.entries.every(x=>!['main.conversation','conversation','conversation.composer'].includes(x.entry.name)));
 assert.match(bundle,/renderFactorySlot\('conversation.content'/);assert.doesNotMatch(bundle,/internal\/config/);
});
