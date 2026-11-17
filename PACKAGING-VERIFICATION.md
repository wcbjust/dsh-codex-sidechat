# 标准安装与发布工具验证

日期：2026-11-15（Asia/Shanghai）。包：dsh-codex-sidechat 0.1.0。

## 已实际完成

- `npm run check`：27 项通过，0 失败；包含原有 24 项及 3 项发布工具测试。
- `npm run release:pack`：调用标准 npm pack 生成 tgz；另生成 GitHub 源码 ZIP 和 SHA-256 校验文件。
- 以实际安装的 Windows DSH 0.2.1-rc.5 的 Electron Node 执行 `dsh plugin --profile publish-smoke add <本地绝对路径.tgz> --offline --ignore-scripts`，退出码 0。
- 测试使用独立 DSH_HOME 和新建 profile。profile 自动加入依赖并启用 dsh-codex-sidechat bundle。
- 已安装版本为 0.1.0；host 模块可以导入，导出 apply 函数；4 个服务端模块、客户端及 bundle patch 均与源码逐字节相同。
- DSH 自带 parseInstallSpec 接受本地 tgz、GitHub 仓库地址和 npm 名称三类输入。
- create-index.mjs 的输出通过 DSH 自带 parseMarketIndex 校验，marketInstallTarget 生成固定提交的 git+https 安装目标。测试仓库和提交仅在内存中用作格式夹具，未发布虚构索引。

## 文件与发布范围

源码 ZIP 使用白名单，包含源码、预构建客户端、测试、文档、许可证、发布脚本和 .github 工作流；不含个人安装记录、用户配置、node_modules、模型调用日志或凭据。安装包由 package.json files 清单控制。

以上是本地运行的检查。GitHub Actions 的跨平台矩阵、远程 GitHub 安装、npm 发布及公共市场收录尚未运行；生成发布工作流不代表已经公开发布。插件页界面运行证据见 VERIFICATION.md 的既有原生实测记录，本次安装通路通过宿主 CLI 验证。

宿主未来版本仍需烟测；本次未修改侧聊运行代码。

## 2026-11-17 构建一致性修复

首次 GitHub CI 的 Ubuntu / Node 22 作业中，npm run check 已通过，但 lib/client.js 的预构建一致性检查失败。原因是 CSS 源码在 Windows 上的 CRLF 经 JSON.stringify 转成了字面量转义字符，使 Linux 的 LF 构建产物不同。

build.mjs 现统一规范四个源文件的换行符后再拼接与序列化，并重新生成 lib/client.js。新增测试使用真实源码分别生成 CRLF 和 LF 两套文件，执行构建并逐字节比较输出。

本地检查结果：28 项通过，0 失败。修复后的 GitHub 四项平台/Node 矩阵仍需推送后验收；此记录不表示远程检查已通过。
