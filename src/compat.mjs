// All host API adaptation lives here. No application version comparisons.
export function service(ctx, name) {
  try { return ctx[name] ?? ctx.get?.(name, false); } catch { return undefined; }
}
export function hostCapabilities(ctx) {
  const agents = service(ctx, 'agents'), presets = service(ctx, 'agentPresets');
  const persistence = service(ctx, 'sessionPersistence');
  const missing = [];
  if (typeof agents?.create !== 'function') missing.push('agents.create');
  if (typeof agents?.get !== 'function') missing.push('agents.get');
  if (typeof presets?.composeFrom !== 'function' && typeof presets?.mount !== 'function') missing.push('agentPresets');
  if (typeof persistence?.stat !== 'function') missing.push('sessionPersistence.stat');
  if (typeof service(ctx, 'sessionQuery')?.readSession !== 'function') missing.push('sessionQuery.readSession');
  return { available: !missing.length, missing, cleanup: typeof persistence?.locate === 'function' ? 'jsonl-guarded' : 'capability-dependent' };
}
export async function resolveParent(ctx, id) {
  const live=service(ctx,'agents')?.get(id);
  if(live) return live;
  const controller=service(ctx,'sessionController');
  if(typeof controller?.resolveAgent !== 'function') throw new Error('请先打开主会话；当前 DSH 缺少历史会话恢复接口');
  const result=await controller.resolveAgent(id);
  if(result?.error) throw result.error;
  if(!result?.agent) throw new Error('DSH 未返回有效的主会话智能体');
  return result.agent;
}
export function parentModel(parent, defaults, projections) {
  const config = parent.session?.requestHeader?.()?.config ?? {};
  const pending = projections?.stateOf?.(parent.session, 'modelSelection')?.pending;
  const selection=parent.model?.current?.() ?? pending ?? (config.provider && config.model ? config : parent.options?.provider && parent.options?.model ? parent.options : defaults?.currentSelection?.()) ?? {};
  const all = { ...parent.options, ...config, ...selection };
  // A model switch without an effort restores that model's default; do not
  // carry the previous model's effort across the new provider/model pair.
  if(!Object.hasOwn(selection,'reasoningEffort')) delete all.reasoningEffort;
  return Object.fromEntries(['provider','model','reasoningEffort','maxTokens','temperature'].filter(k => all[k] !== undefined).map(k => [k,all[k]]));
}
export async function composeParent(ctx, childCtx, parent) {
  const presets = service(ctx, 'agentPresets');
  if (parent.ctx && typeof presets?.composeFrom === 'function') return presets.composeFrom(childCtx, parent.ctx);
  if (typeof presets?.mount !== 'function') throw new Error('当前 DSH 不提供原生智能体组合接口');
  const preset = parent.session?.agentPreset ?? parent.session?.header?.agentPreset ?? 'standard';
  return presets.mount(childCtx, typeof preset === 'string' ? preset : 'standard');
}
export function inheritPermissions(ctx, parent, child) {
  const presets = service(ctx, 'permissionPresets');
  if (!presets?.current || !presets?.set) throw new Error('当前 DSH 缺少权限继承接口，侧聊未启用');
  const preset = presets.current(parent.session);
  if (!preset || preset === 'custom') throw new Error('主会话使用自定义权限，无法确认完整继承；请先为主会话选择一个原生权限预设');
  presets.set(child.session, preset);
  return preset;
}
export async function recordModel(ctx, agent, selection) {
  if (!selection.provider || !selection.model) return;
  const value = { provider: selection.provider, model: selection.model, ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}) };
  if (typeof agent.model?.select === 'function') return agent.model.select(value);
  const controller = service(ctx, 'sessionController');
  if (typeof controller?.selectModel === 'function') return controller.selectModel({sessionId: agent.id, ...value});
  throw new Error('当前 DSH 缺少原生模型选择接口，请更新兼容适配层');
}
export function clientCapabilities(ctx) {
  const slots = service(ctx,'slots'), sidebar = service(ctx,'sidebarRight');
  const tabs = service(ctx,'sidebarRightTabs') ?? sidebar?.tabs;
  const sessions = service(ctx,'sessions');
  const missing=[];
  if (typeof tabs?.register !== 'function') missing.push('sidebarRightTabs.register');
  if (typeof sidebar?.openTab !== 'function') missing.push('sidebarRight.openTab');
  if (typeof slots?.register !== 'function' || typeof slots?.inject !== 'function') missing.push('slots');
  if (typeof sessions?.retain !== 'function') missing.push('sessions.retain');
  return { available: !missing.length, missing, slots, sidebar, tabs, sessions };
}
export function retainNative(sessions, id) {
  if (typeof sessions?.retain !== 'function') throw new Error('当前 DSH 缺少 sessions.retain；侧聊已安全停用');
  return sessions.retain(id, { source: 'codex-sidechat' });
}
