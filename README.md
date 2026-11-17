# DSH Codex Side Chat

为 DeepSeek Harness 增加接近 Codex 使用方式的独立临时侧边聊天。当前验收目标为 **Windows / DSH 0.2.1-rc.5**；插件版本 0.1.0，MIT 许可。

## 已实现

- 右侧「工具 / 新标签页」直接显示「侧边聊天」卡片；主会话标题栏也有按钮，快捷键 `Ctrl+Alt+S`。
- 聊天内嵌 DSH 原生 `conversation.content`：复用原生输入框、模型菜单、权限菜单、附件和工具审批界面。
- 使用独立原生智能体，复用主会话的工作目录、智能体预设和权限预设；模型初始选择继承主会话的有效选择。
- 提供有大小上限的主会话背景快照，以及只读 `side_chat_context` 工具。不会把侧聊消息追加到主会话。
- 同一个主会话可以创建多个侧聊并切换。收起侧栏、切换主会话和刷新界面均保留；只有主动结束、插件卸载或宿主退出才清理。
- 选中主会话消息后可「引用到侧边聊天」，只放入侧聊草稿，由用户决定发送。

## 在 DSH 插件页正常安装（推荐）

本插件是标准 DSH bundle，已经带构建好的客户端，无需在安装时运行构建脚本。

1. 下载 Release 附带的 `dsh-codex-sidechat-0.1.0.tgz`。
2. 打开 DSH 的「插件 → 安装第三方插件 / 添加插件」。
3. 在「包名或地址」输入框粘贴 `.tgz` 的**完整绝对路径**，例如 `D:/Downloads/dsh-codex-sidechat-0.1.0.tgz`，不要输入 ZIP 文件，也不要加外层引号。
4. 按 DSH 的安装提示完成安装；需要时按宿主提示重启。

发布到 GitHub Release 后，也可在同一个输入框粘贴该 `.tgz` 资产的 HTTPS 下载地址。上传 GitHub 只有源码时，可以填写真实的 GitHub 仓库地址；仓库必须保留预构建 `lib/client.js`。正式发布仍推荐固定版本的 `.tgz` 资产。

**当前尚未发布到 npm 或公共市场。** 输入 `dsh-codex-sidechat` 按名安装，要等作者发布 npm；在公共发现/插件市场中按关键词搜索，还需要对应目录收录或添加本插件的专用索引。GitHub Release 工作流会生成 `index.json`，发布后把这个索引资产的 HTTPS 地址加入 DSH「发现 → 索引源」，即可在该索引中搜索侧边聊天。发布流程见 [PUBLISHING.md](PUBLISHING.md)。

本插件以 Windows / DSH 0.2.1-rc.5 验证，其他版本和系统尚未完成宿主界面实测。安装前请在插件页停用其他侧聊插件，避免入口和快捷键重叠。

## 离线安装脚本（备用）

如果不使用 DSH 自带安装器，可以解压源码 ZIP，双击 `install.cmd`；默认安装 desktop profile。脚本不联网、不修改 `app.asar`，会备份配置并关闭旧侧聊插件的 bundle 激活。它与 DSH 原生安装器是两条安装路径，请选择一条。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
# 自定义数据目录：
.\install.ps1 -DshHome 'D:\DSH-data' -Profile desktop
```

## 卸载与回滚

通过 DSH 原生安装器安装的，请在插件页卸载本插件；先结束侧聊或正常退出，让本插件清理临时记录。

如果使用备用安装脚本，保存安装输出的 Backup 路径，执行：

```powershell
.\install.ps1 -Rollback -BackupPath '完整备份目录'
```

自定义安装时带同样的 `-DshHome` / `-Profile`。只有当前配置与安装后相同时，脚本才自动还原，避免覆盖后来安装的其他插件。如果配置已变化，手动从 `dsh.profile.bundles` 移除 `dsh-codex-sidechat`，再按备份恢复原侧聊插件的 bundle 项即可。源代码文件可保留，不再激活就不会加载。

回滚前先结束侧聊并退出 DSH；强制结束后要先让本插件启动一次完成遗留清理，否则清理日志仍会保留。

## 临时的准确含义

DSH 原生智能体会先把运行日志写到会话存储。此插件在正常退出或主动结束时清理自己的会话 JSONL；异常退出时，下次加载插件会检查遗留归属日志并重试清理。**这不是纯内存聊天，也不承诺安全擦除。**

清理只允许操作 `codex-side-UUID` 会话，必须同时核对清理日志、会话 header 的 id / parentSession、JSONL 文件路径和文件类型。遇到不认识的存储后端、权限问题或归属不符时保留数据并记录提示。不会递归删除工作区或任意会话目录。

文件修改、命令执行的结果、上传附件的共享存储、远端模型服务的数据和系统备份不会因结束聊天而撤销或清除。需要恢复工作区时使用版本管理。关闭最后一个窗口若 DSH 仍在托盘运行，不算宿主退出。

## 兼容与升级策略

- 不修改 DSH 安装文件，不监听 `internal/config`，不替换主聊天组件，不打包第二份 React。
- 服务端接口适配集中在 `src/compat.mjs`：能力检测、模型选择、权限继承、预设组合、历史主会话恢复。
- 模型选择优先使用 `agent.model.select()`，旧版回退原生 `sessionController.selectModel()`；不按版本号分支。
- 前端通过公开侧栏 tab / guide / slot、`SessionProvider` 和会话 retain 接口工作。
- 实际接口消失时局部报错或停用，不试图调用未知内部实现。客户端模块装载器、slot 名称和原生组件参数仍是兼容依赖；若 DSH 对这些做破坏性调整，仍需修改适配或接入部分。
- **0.2.1-rc.5 已实测；未来版本未安装实测，不能保证零维护。** 设计目标是日常升级继续复用宿主能力，必要修改尽量局限在适配层。
- 自定义权限没有跨版本可靠的复制接口，因此当前要求主会话使用 DSH 原生权限预设；不会悄悄改成更宽的权限。

## 开发和验证

Node.js >= 20，无额外 npm 依赖。

```powershell
node build.mjs
node --test tests/*.test.mjs
```

`lib/client.js` 是预生成的可安装文件，修改客户端源码后必须重新构建。参见同目录 `VERIFICATION.md`，区分单元测试、真实 DSH 隔离测试与尚未验收的功能。

本插件独立实现。接口研究参考了 DeepSeek Harness 开源实现与 MIT 的 dsh-side-chat；未复制原应用代码进入交付包。


## GitHub 与 npm 发布

源码包包含 MIT 许可证、自动检查工作流、标签触发的 GitHub Draft Release 工作流、标准 npm 打包脚本和专用发现索引生成器。工作流不会向 npm 自动发布。首次发布请先设置真实仓库信息，完整步骤见 [PUBLISHING.md](PUBLISHING.md)。

本项目是社区插件，与 OpenAI / Codex 或 DeepSeek 官方没有隶属关系。
