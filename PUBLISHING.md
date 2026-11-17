# 发布到 GitHub、npm 与 DSH 市场

这些步骤供项目作者执行。当前源码和本地安装包已准备；未创建远程仓库，未发布 npm，未提交公共市场申请。检查日期：2026-11-15。

## 三种分发方式的区别

| 目标 | 需要做什么 | 用户怎么安装 |
| --- | --- | --- |
| 立即给别人一个标准安装包 | 分享本地 `.tgz` | DSH「添加插件」输入完整文件路径 |
| 只发布 GitHub | 上传源码，发布带 `.tgz` 的 Release | DSH 输入仓库地址或 Release `.tgz` 下载地址 |
| 按名字安装 | 以本人 npm 账号发布包 | DSH 输入 `dsh-codex-sidechat` |
| 在发现/市场中搜索到 | 添加专用索引，或被公共目录收录 | DSH 发现页/插件市场搜索名字或关键词 |

仅将代码上传到 GitHub，不会自动把包发布到 npm，也不等于所有市场都已收录。

## 1. 整理真实仓库信息

解压 github-source.zip，进入 `dsh-codex-sidechat` 目录。在 GitHub 创建空仓库后执行，命令中的 YOUR_GITHUB_NAME 是需要替换的占位符：

```sh
npm run repository:set -- YOUR_GITHUB_NAME/dsh-codex-sidechat
npm run check
npm run release:pack
```

`repository:set` 会设置真实的 repository / homepage / bugs；不会创建仓库或发送代码。可用 `npm pkg set author="你的署名"` 设置 npm 作者字段。

`release:pack` 使用标准 `npm pack` 生成 `.tgz`，再用 Python 3 生成干净源码 ZIP 和 SHA256SUMS，输出到 `dist/`。项目运行不依赖 Python；Python 只用于源码 ZIP 导出。

源码导出使用明确文件白名单，不包含本机安装记录、用户 profile、临时会话、API 密钥、node_modules 或模型调用记录。`lib/client.js` 应提交进 Git，保证源码安装时已有客户端文件。

```sh
git init
git add .
git commit -m "Release native side chat plugin"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_NAME/dsh-codex-sidechat.git
git push -u origin main
```

给仓库添加 `dsh-plugin`、`deepseek-harness`、`side-chat` topic。官方项目建议 `dsh-plugin` topic 用于发现。

## 2. 发布 GitHub Release

确认 package.json 版本为 0.1.0 后：

```sh
git tag v0.1.0
git push origin v0.1.0
```

仓库开启 Actions 时，附带工作流会运行测试、打包，并创建一个 **Draft Release**，包含：

- `dsh-codex-sidechat-0.1.0.tgz`：DSH 标准安装包；
- `dsh-codex-sidechat-0.1.0-github-source.zip`：源码和备用离线安装脚本；
- `SHA256SUMS.txt`：上述两个文件的校验和；
- `index.json`：固定到本次真实 Git commit 的 DSH format-1 发现索引。

到 GitHub Releases 检查草稿后，手动发布。也可以不开启 Actions，手动创建 Release 并上传 `dist/` 中的安装包。手动方式需要另外运行索引生成命令，才能获得 `index.json`。

用户安装输入框可以填写固定版本的资产地址：

```text
https://github.com/YOUR_GITHUB_NAME/dsh-codex-sidechat/releases/download/v0.1.0/dsh-codex-sidechat-0.1.0.tgz
```

这里的 YOUR_GITHUB_NAME 同样需要替换；只有 Release 已公开且资产存在后，这个地址才有效。

## 3. 不经公共市场，先通过专用索引搜索

GitHub 工作流会使用真实仓库名和 commit SHA 生成索引，不需要 npm 账号。手动生成时：

```sh
node scripts/create-index.mjs YOUR_GITHUB_NAME/dsh-codex-sidechat REAL_40_HEX_COMMIT dist/index.json
```

将 index.json 上传到公开 Release 后，把它的 HTTPS 资产下载地址添加到 DSH「插件 → 发现 → 索引源」。然后可在这个索引中搜索 `dsh-codex-sidechat` 或「侧边聊天」。安装来源为固定 commit 的 GitHub 仓库；需要用户网络能够访问 GitHub。生成器拒绝无效 commit 字符串，不会生成看似可用的占位安装地址。

这只影响主动添加该索引的用户，不等于公共市场已收录。

## 4. 发布 npm，实现按包名安装

1. 用你拥有的 npm 账号登录：`npm login`。
2. 确认包名归你使用。准备时官方 registry 对该包名返回 404，**不代表保留或注册成功**；发布时可能已被占用。若改名，要同步 package.name、cordis.patch.yml、构建模块 id 和客户端 tab 标识后重新验收；更省事的是保留当前名字，先用 GitHub Release 分发。
3. 设置真实仓库和作者字段，再运行 `npm run check`、`npm run release:pack`。
4. 明确确认公开内容后执行：

   ```sh
   npm publish ./dist/dsh-codex-sidechat-0.1.0.tgz --access public --registry https://registry.npmjs.org/
   ```

5. 用 `npm view dsh-codex-sidechat version --registry https://registry.npmjs.org/` 核对已发布版本。然后用户才可以在 DSH 安装输入框直接输入 `dsh-codex-sidechat`。

工作流没有内置 npm token，也不会因推送标签自动发布 npm。账号验证、两步验证和后续 npm 政策以当时官方提示为准。

## 5. 进入社区公共插件市场

dsh-market 的维护说明指出：插件目录来自 **awesome-dsh-plugin/awesome-dsh-plugin**，应向该目录提交收录 PR，而不是向 dsh-market 应用仓库添加条目。是否合并、何时更新取决于目录维护者和索引刷新。

发布公开仓库与 Release 后，按目录当前贡献规范提交，提供项目名、简述、仓库链接、可安装来源和截图。建议条目文案：

> DSH Codex Side Chat：Codex 风格的原生临时侧边聊天，复用工具与权限，独立上下文，退出后清理。已验收 Windows / DSH 0.2.1-rc.5。

提交时替换真实仓库链接，不要提交占位 URL。若已发布 npm，同时提供准确包名与版本，便于市场关联。

## 参考来源

- 本机 DSH 0.2.1-rc.5 的 dsh-plugin-manager install-spec：支持绝对路径 `.tgz`、HTTP(S) tarball、Git 来源和 npm 包名。
- DeepSeek Harness 官方 README：https://github.com/deepseek-ai/deepseek-harness
- dsh-market 中文维护说明：https://github.com/dsh-market/dsh-market/blob/main/README.zh.md
- 社区插件目录：https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
- npm CLI publish 文档：https://docs.npmjs.com/cli/commands/npm-publish

这里只声明本地测试结果。GitHub Actions 执行、公开 Release 下载、npm 安装和公共市场收录都需要发布后再验证。
