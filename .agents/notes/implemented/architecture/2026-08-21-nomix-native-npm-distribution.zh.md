# Agent Note：Nomix 原生 npm 分发

状态：已实现

[English](2026-08-21-nomix-native-npm-distribution.md) | 中文

## 问题

旧 npm 制品会部署 workspace 依赖树，把嵌套 `node_modules` 压缩成私有 runtime 归档，并通过 `postinstall` 恢复。该制品无法在禁用生命周期脚本时安装，没有稳定的插件 API，而且让所有消费方依赖仓库专用的部署布局。仓库的 TypeScript、Python、配置、协议字段、文档、维护 Skill 和发布自动化中还保留了 Nomix 之前的产品名称。

## 决策

`@nomix-ai/nomix-harness` 0.2 是唯一公开的产品包。构建会把每个生产 workspace 投影成分类明确的 ESM 分发，写入 `dist/` 下的 CLI、kernel 模块、插件 API、惰性插件注册表、Bundle、runtime、SDK、测试辅助能力和资产。内部产品包导入会改写成包内相对 ESM 路径；外部库保持普通 dependency，原生平台 wrapper 保持 optional dependency。打包制品不包含嵌套 `node_modules`、runtime 归档、安装脚本、源码、测试、内部文档或 source map。

内置工厂只返回 Loader 描述，不导入也不初始化实现。`resolveProfile` 会把业务应用选中的描述转换为 Loader 条目，并拒绝未知 profile。打包后的 Bundle 行使用 `cordis:nomix/<plugin-id>`，生成的 Loader 注册表会在第一次访问选中模块时导入它。激活、依赖注入、effect、审计和卸载仍由 Cordis 负责。默认 Bundle 不注册模型 Provider；DeepSeek 会作为可选 Provider 编译，只有显式选择后才加载。

所有活动产品名称都使用 Nomix，包括 `NOMIX_*`、`~/.nomix`、`nomix.profile`、`nomix.bundle`、TypeScript SDK，以及 Python 分发名和模块名。旧变量和 manifest 字段会失败并显示替代名称。系统不提供别名，也不会自动迁移 home。仓库门禁会拒绝旧名称；冻结归档、vendor 源码、许可证、Provider 专属标识和迁移拒绝测试除外。

匹配 `nomix-v*` 的标签会让 GitHub Actions 通过 npm Trusted Publishing 发布已经验证的 tarball，并生成 provenance。Pull Request 和 `master` 会在 Linux、Windows 和 macOS 上构建并验证同一个包。工作流不再包含 registry token 或权限修复流程。

## 结果

- 业务系统只安装一个包，并只注册所需的内置插件和外部业务 Bundle。
- `npm ci --ignore-scripts` 是受支持的安装方式。
- workspace 缺少分发分类、插件清单遗漏或 tarball 暴露禁止路径时，构建会失败。
- 0.2 有意不兼容旧环境变量、Profile 字段、home 路径、SDK 类型名和 Python 导入。
- 创建发布标签前，仓库管理员必须配置 `npm-publish` Environment，并添加能够向 `@nomix-ai` scope 发布公共包的 `NPM_TOKEN` Repository Secret。发布 job 只通过 `NODE_AUTH_TOKEN` 暴露该密钥；GitHub OIDC 仅用于生成 npm provenance。
