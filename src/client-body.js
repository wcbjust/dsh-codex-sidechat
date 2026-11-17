
const TAB_ID='dsh-codex-sidechat/conversation', KIND='codex-sidechat';
function ChatIcon({size=22,className}={}) {
  return h('svg',{width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,className,'aria-hidden':true},
    h('path',{d:'M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-7l-5 3v-3H5A1.5 1.5 0 0 1 3.5 16V6A1.5 1.5 0 0 1 5 4.5Z'}),h('path',{d:'M8 9h8M8 13h5'}));
}
function apply(ctx) {
  const cap=clientCapabilities(ctx);
  if(!cap.available) {console.warn('[codex-sidechat] Missing client capabilities:',cap.missing.join(', '));return;}
  const {slots,sidebar,tabs,sessions}=cap;
  const connection=service(ctx,'connection');
  const store=createStore({byParent:{},error:null});
  const pending=new Map(); const retained=new Map(); let disposed=false;
  async function rpc(method,input={}) {
    const route=connection?.rpc;
    if(typeof route?.call!=='function') throw new Error('当前 DSH 的连接接口不可用');
    let result;
    try { result=await route.call('/api','codexSidechat.'+method,input); }
    catch(error) {
      if(!/HTTP (404|405)\b/.test(String(error?.message))) throw error;
      result=await route.call('/codex-sidechat','codexSidechat.'+method,input);
    }
    if(result?.ok===false) throw new Error(result.error?.message || '侧边聊天请求失败');
    return result?.ok===true && Object.hasOwn(result,'value') ? result.value : result;
  }
  const emptyStates=new Map();
  function stateFor(parent) { const found=store.get().byParent[parent]; if(found)return found; if(!emptyStates.has(parent))emptyStates.set(parent,{records:[],active:null,loading:false,error:null}); return emptyStates.get(parent); }
  function patchParent(parent,patch) {store.patch({byParent:{...store.get().byParent,[parent]:{...stateFor(parent),...patch}}});}
  function reference(id) {
    let ref=retained.get(id);
    if(!ref) {ref=retainNative(sessions,id);retained.set(id,ref);}
    return ref;
  }
  function currentParent() {return service(ctx,'uiSession')?.adapter?.current?.getSnapshot?.()?.key;}
  function openTab(parent) {
    if(ownId(parent)) return;
    if(typeof sidebar.openTabIn==='function' && parent) sidebar.openTabIn(parent,KIND,{revealIfOpened:true});
    else sidebar.openTab(KIND,{revealIfOpened:true});
  }
  async function ensure(parent,fresh=false) {
    if(pending.has(parent)) return pending.get(parent);
    if(stateFor(parent).active && !fresh) return stateFor(parent).active;
    patchParent(parent,{loading:true,error:null});
    const job=(async()=>{
      const result=await rpc('open',{parentId:parent,fresh});
      if(disposed) return;
      const ref=reference(result.record.id); await ref.ready;
      patchParent(parent,{records:result.records,active:result.record.id,loading:false,error:null});
      return result.record.id;
    })(); pending.set(parent,job);
    try {return await job;} catch(error){patchParent(parent,{loading:false,error:error.message});throw error;}
    finally {pending.delete(parent);}
  }
  function useParent(parent) {return React.useSyncExternalStore(store.subscribe,()=>stateFor(parent),()=>stateFor(parent));}
  class Boundary extends React.Component {
    constructor(props){super(props);this.state={error:null};}
    static getDerivedStateFromError(error){return {error:error?.message || String(error)};}
    render(){return this.state.error ? h('div',{className:'csc-state',role:'alert'},h('strong',null,'原生会话界面暂不可用'),h('p',null,this.state.error),h('p',null,'主会话可以继续使用。')) : this.props.children;}
  }
  function NativeChat({reference:ref,SessionProvider,renderFactorySlot}) {
    return h(SessionProvider,{session:ref},renderFactorySlot('conversation.content',{variant:'embedded',phase:'active',hero:false}, {fallback:h('div',{className:'csc-state'},'当前 DSH 缺少原生会话组件，侧聊已停用。')}));
  }
  function SidePanel(props) {
    const parent=props.sessionId;
    const state=useParent(parent);
    const [confirm,setConfirm]=React.useState(false);
    const [busy,setBusy]=React.useState(false);
    React.useEffect(()=>{if(parent&&!ownId(parent))ensure(parent).catch(()=>{});},[parent]);
    if(ownId(parent)) return h('div',{className:'csc-state'},'请回到主会话打开侧边聊天。');
    async function remove() {
      setBusy(true);
      try {
        const id=state.active;
        retained.get(id)?.release?.();retained.delete(id);
        const result=await rpc('end',{id});
        const records=stateFor(parent).records.filter(r=>r.id!==id);
        patchParent(parent,{records,active:records.at(-1)?.id??null,error:result?.warning??null});
        setConfirm(false);
        if(!records.length) await ensure(parent);
      } catch(error){patchParent(parent,{error:error.message});}
      finally {setBusy(false);}
    }
    const active=state.records.find(r=>r.id===state.active);
    return h('section',{className:'csc-panel','data-codex-sidechat':'', 'aria-label':'临时侧边聊天'},
      h('header',{className:'csc-top'},h('div',{className:'csc-title'},h(ChatIcon,{size:18}),h('strong',null,'侧边聊天'),h('span',{className:'csc-badge',title:'退出 DSH 后清理；收起、切换和刷新不会结束聊天'},'临时')),
        h('div',{className:'csc-actions'},
          h('button',{className:'csc-icon',title:'新建侧边聊天',disabled:state.loading||busy,onClick:()=>ensure(parent,true).catch(()=>{})},'+'),
          h('button',{className:'csc-icon',title:'结束并清理当前侧聊',disabled:!state.active||busy,onClick:()=>setConfirm(v=>!v)},'⋯'))),
      state.records.length>1 && h('div',{className:'csc-tabs'},h('select',{'aria-label':'切换侧边聊天',value:state.active??'',onChange:e=>patchParent(parent,{active:e.target.value,error:null})},state.records.map(r=>h('option',{key:r.id,value:r.id},r.title)))),
      h('div',{className:'csc-caption'},'独立对话 · 共享工作区和工具 · 退出应用后清理'),
      confirm && h('div',{className:'csc-confirm'},h('span',null,'结束并清理这段聊天？文件修改会保留。'),h('button',{className:'csc-button',onClick:()=>setConfirm(false)},'取消'),h('button',{className:'csc-button',disabled:busy,onClick:remove},busy?'正在清理…':'结束聊天')),
      state.error && h('div',{className:'csc-error',role:'alert'},state.error,h('button',{className:'csc-button',onClick:()=>{patchParent(parent,{active:null,error:null});ensure(parent).catch(()=>{});}},'重试')),
      state.loading && !state.active ? h('div',{className:'csc-state'},h(ChatIcon,{size:32}),h('p',null,'正在准备侧边聊天…')) : null,
      active && h('div',{className:'csc-native'},h(Boundary,{key:active.id},h(NativeChat,{reference:reference(active.id),SessionProvider:props.SessionProvider,renderFactorySlot:props.renderFactorySlot}))),
      !state.active&&!state.loading&&!state.error && h('div',{className:'csc-state'},h('p',null,'随时问一个旁支问题'),h('button',{className:'csc-button',onClick:()=>ensure(parent).catch(()=>{})},'开始聊天')),
    );
  }
  function HeaderButton({sessionId}) {
    if(ownId(sessionId)) return null;
    return h('button',{type:'button',className:'csc-open',title:'侧边聊天 · Ctrl+Alt+S','aria-label':'打开侧边聊天',onClick:()=>openTab(sessionId)},h(ChatIcon,{size:17}));
  }
  function RowMarker({sessionId}) {return ownId(sessionId)?h('span',{'data-csc-row':'',hidden:true}):null;}
  const releases=[];
  const safeRegister=(label,fn)=>{try{releases.push(fn());}catch(error){console.warn('[codex-sidechat]',label,error.message);}};
  ctx.effect(()=>{
    const style=document.createElement('style');style.dataset.plugin='dsh-codex-sidechat';style.textContent=CSS;document.head.appendChild(style);
    return ()=>style.remove();
  },'codex-sidechat: styles');
  safeRegister('tab type',()=>tabs.register({id:TAB_ID,kind:KIND,priority:'extension',keepMounted:true,title:()=> '侧边聊天',guide:[{id:'new',order:5,title:()=> '侧边聊天',description:()=> '完整工具和权限的临时对话',icon:ChatIcon}]}));
  safeRegister('tab body',()=>slots.inject('sidebar.right.pane.tab',()=>slots.register({name:'sidebar.right.pane.tab',key:TAB_ID,children:{'codex.sidechat.native':{kind:'single',scope:'session'}}},SidePanel)));
  safeRegister('header entry',()=>slots.inject('conversation.session.header.actions',()=>slots.register({name:'conversation.session.header.actions',id:'codex-sidechat:open',order:85},HeaderButton)));
  safeRegister('hide temporary rows',()=>slots.inject('sidebar.session.row.trailing',()=>slots.register({name:'sidebar.session.row.trailing',id:'codex-sidechat:row'},RowMarker)));
  // Quoting only stages text in the native draft; it never sends a model request.
  const selectionButton=document.createElement('button');selectionButton.type='button';selectionButton.className='csc-selection';selectionButton.textContent='引用到侧边聊天';selectionButton.hidden=true;document.body.appendChild(selectionButton);
  let selectedText='',selectedParent;
  const onSelection=()=>{
    const selection=window.getSelection();
    const anchor=selection?.anchorNode?.parentElement;
    const parent=currentParent();
    if(!parent||ownId(parent)||!selection||selection.isCollapsed||!anchor||anchor.closest('[data-codex-sidechat],input,textarea,[contenteditable]')) {selectionButton.hidden=true;return;}
    if(!anchor.closest('[data-conversation-content],[data-conversation-scroll],[data-slot="conversation.session"]')) {selectionButton.hidden=true;return;}
    const text=selection.toString().trim();if(!text){selectionButton.hidden=true;return;}
    selectedText=text.slice(0,8000);selectedParent=parent;
    const rect=selection.getRangeAt(0).getBoundingClientRect();selectionButton.hidden=false;
    selectionButton.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-180))+'px';selectionButton.style.top=Math.max(8,rect.top-42)+'px';
  };
  selectionButton.addEventListener('mousedown',e=>e.preventDefault());
  selectionButton.addEventListener('click',async()=>{
    const text=selectedText,parent=selectedParent;selectionButton.hidden=true;
    try {openTab(parent);const id=await ensure(parent);const input=service(ctx,'conversation')?.input?.shell?.(id);
      if(!input?.setDraft) throw new Error('当前 DSH 没有草稿引用接口');
      const draft=input.draftSnapshot ?? {text:''};
      const previous=draft.text ?? '';
      input.setDraft({...draft,text:previous+(previous?'\n\n':'')+'[引用主会话]\n'+text+'\n\n'});
    }catch(error){patchParent(parent,{error:error.message});}
  });
  document.addEventListener('selectionchange',onSelection);
  const hotkey=e=>{if(e.ctrlKey&&e.altKey&&!e.shiftKey&&e.code==='KeyS'){const parent=currentParent();if(parent&&!ownId(parent)){e.preventDefault();openTab(parent);}}};
  document.addEventListener('keydown',hotkey);
  ctx.effect(()=>()=>{
    disposed=true; document.removeEventListener('keydown',hotkey);document.removeEventListener('selectionchange',onSelection);selectionButton.remove();
    for(const ref of retained.values())ref.release?.();retained.clear();
    for(const release of releases.reverse()) {try{release?.();}catch{}}
  },'codex-sidechat: client disposal (does not end temporary conversations)');
}
