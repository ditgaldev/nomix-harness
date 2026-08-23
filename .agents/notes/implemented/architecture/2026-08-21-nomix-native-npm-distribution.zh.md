# Agent Note：Nomix 原生 npm 分发

状态：已实现

[English](2026-08-21-nomix-native-npm-distribution.md) | 中文

## 问题

旧 npm 制品会部署 workspace 依赖树，把嵌套 `node_modules` 压缩成私有 runtime 归档，并通过 `postinstall` 恢复。该制品无法在禁用生命周期脚本时安装，没有稳定的插件 API，而且让所有消费方依赖仓库专用的部署布局。仓库的 TypeScript、Python、配置、协议字段、文档、维护 Skill 和发布自动化中还保留了 Nomix 之前的产品名称。

## 决策

`@nomix-ai/nomix-harness` 0.2 是唯一公开的产品包。构建会把每个生产 workspace 投影成分类明确的 ESM 分发，写入 `dist/` 下的 CLI、kernel 模块、插件 API、惰性插件注册表、Bundle、runtime、SDK、测试辅助能力和资产。Node 制品中的内部产品包导入会改写成包内相对 ESM 路径。浏览器 Client factory 会保留冻结 Client 模块表提供的规范 specifier，因为其中注入的 `require` 不执行文件系统解析。外部库保持普通 dependency，原生平台 wrapper 保持 optional dependency。打包制品不包含嵌套 `node_modules`、runtime 归档、安装脚本、源码、测试、内部文档或 source map。

内置工厂只返回 Loader 描述，不导入也不初始化实现。`resolveProfile` 会把业务应用选中的描述转换为 Loader 条目，并拒绝未知 profile。描述、打包后的 Bundle 行和 Preset 行都保留规范的 `@nomix-ai/nomix-*` 包名。聚合包携带生成的 kernel manifest，Profile 启动时会维护从 `$NOMIX_HOME/profiles/node_modules` 到对应 `dist/kernel/*` 目录的包名链接。Loader 仍按需导入，而 Client 与 Typert 的元数据发现继续使用 workspace 中的同一包身份。激活、依赖注入、effect、审计和卸载仍由 Cordis 负责。默认 Bundle 不注册模型 Provider；DeepSeek 会作为可选 Provider 编译，只有显式选择后才加载。

所有活动产品名称都使用 Nomix，包括 `NOMIX_*`、`~/.nomix`、`nomix.profile`、`nomix.bundle`、TypeScript SDK，以及 Python 分发名和模块名。旧变量和 manifest 字段会失败并显示替代名称。系统不提供别名，也不会自动迁移 home。仓库门禁会拒绝旧名称；冻结归档、vendor 源码、许可证、Provider 专属标识和迁移拒绝测试除外。

匹配 `nomix-v*` 的标签会让 GitHub Actions 发布已经验证的 tarball，并生成 provenance。Pull Request 和发布分支会在 Linux、Windows 和 macOS 上构建并验证同一个包。发布 job 只通过 `NODE_AUTH_TOKEN` 读取 `NPM_TOKEN`，且不包含权限修复流程。

## 考虑过的替代方案

**把所有内部包名改写为 Loader builtin。** 未采用，因为 Client 和 Typert 的发现机制以包 manifest 和规范包名作为图身份；把配置数据替换为 `cordis:nomix/*` 会切断这层元数据关系。包名链接可以同时保留 Loader 的按需导入和原有身份。

**分别发布或安装每个生产 workspace。** 未采用，因为这会恢复聚合制品已经消除的多包发布顺序和 registry 依赖。Kernel 目录已经包含必需的包导出，因此运行时创建链接即可提供 Node 解析，无需嵌套 `node_modules` 或额外公共包。

## 结果

- 业务系统只安装一个包，并只注册所需的内置插件和外部业务 Bundle。
- `npm ci --ignore-scripts` 是受支持的安装方式。
- workspace 缺少分发分类、包中遗漏必需插件或 Web 资产，或者 tarball 暴露禁止路径时，构建会失败。
- packed-install 验证会在每种受支持的平台和包管理器下启动已安装的 Web Profile，等待其就绪 URL，然后将其关闭。
- 0.2 有意不兼容旧环境变量、Profile 字段、home 路径、SDK 类型名和 Python 导入。
- 创建发布标签前，仓库管理员必须配置 `npm-publish` Environment，并添加能够向 `@nomix-ai` scope 发布公共包的 `NPM_TOKEN` Repository Secret。发布 job 只通过 `NODE_AUTH_TOKEN` 暴露该密钥；GitHub OIDC 仅用于生成 npm provenance。
