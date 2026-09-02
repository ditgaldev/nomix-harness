# Agent Note: 单一 npm Harness 分发包

Status: implemented

[English](2026-08-25-single-npm-harness-distribution.md) | 中文

## Problem

把 Cordis、Cordis 插件和 Landlock 发布为独立 npm 包，会让一次产品发布依赖十二次前置包发布。部分发布会让 registry 处于用户无法安装的状态，而产品并未把这些 workspace 作为可独立支持的分发包公开。

## Decision

`@nomix-ai/nomix-harness` 是本仓库产出的唯一可发布 `@nomix-ai` 包。vendor 和 native manifest 是私有实现单元。Nomix release workflow 是唯一 npm 写入路径，向 `npm-nomix-harness` push 时发布一个经过验证的 Harness tarball。

聚合构建器把包括 vendored Cordis 和 Landlock 包在内的所有运行时 workspace 作为 npm `bundledDependencies` 复制进 Harness tarball。每份内嵌 manifest 都把 workspace selector 替换为具体的共享版本。Node、Cordis 配置和仓库外插件 peer 继续解析规范包名，而 npm 只发布外层 Harness 包。

Landlock 的 x64 和 ARM64 包在匹配的 GitHub runner 上构建，按签入仓库的平台矩阵验证，并作为 optional dependency 内嵌。未经修改的 launcher 通过普通包查找解析匹配的平台包。聚合 tarball 缺少任一受支持的预构建包时，验证会失败。

tarball manifest 只把仓库自有包列为 bundled dependency，因此安装程序从 Harness tarball 而不是 registry 消费这些字节。第三方依赖仍是普通 npm 依赖。打包过程不增加公共 API，也不修改应用、插件、profile 或 native launcher 源码。

## Alternatives considered

发布验证使用 npm 和 pnpm 安装聚合 tarball；这两种安装程序会保留 npm bundled dependency，而不会去 registry 解析其包名。即使 tarball 已包含对应字节，Yarn 4 仍会去 registry 解析这些包名，因此本分发不支持用 Yarn 4 安装。若要支持它，需要改变扁平化运行时布局，而不是验证这里产出的 npm 包格式。

发布后验证检查外层包的 registry 签名、provenance predicate、完整性、latest 标签和已安装 CLI 版本。它不运行 `npm audit signatures`：该命令会通过 registry 重新解析内嵌 workspace 的包名，因此即使安装正确，也会拒绝这里刻意采用的单包拓扑。

发布重跑会先询问 registry 该精确版本是否已经存在。版本不存在时走严格的打包字节发布路径；已有不可变版本时跳过所有 npm 写入，并针对 registry 中的副本执行外层包验证。这样，在上传成功后可以修复仅验证相关的 workflow，同时不会削弱发布器对同版本不同 tarball 的拒绝。

**保留三条 release family。** 这能让安装程序只下载一个 Landlock 架构，但会重新引入聚合 Harness 分发本来要消除的发布顺序和 registry 部分发布问题。

**安装时编译 Landlock。** 这能减小 tarball，却要求消费机器安装 musl 工具链，并让 confinement 可用性取决于安装期编译。启动器继续采用预构建和 fail-closed 策略。

**只嵌入 Linux x64。** 这能减小包体积，却会移除 ARM64 支持。聚合包携带两个受支持的启动器，并接受其他平台或架构下载少量未使用文件的代价。

## Consequences

消费方只从 registry 安装并执行一个包，一个 Harness 版本同时命名完整的 JavaScript、vendor、Web 和 native runtime。发布过程无法产生指向缺失仓库自有包的 Harness 版本。

所有消费方都会下载两个 Linux 启动器，包括 Windows、macOS 和不会使用其中一个启动器的 Linux 架构。npm 上已经存在的独立版本继续作为历史 registry 条目保留，但 Harness manifest 不引用它们，本仓库也不再发布新版本。

本决策取代[三条独立 npm 发布序列](../../archived/process/2026-08-10-npm-release-sequences.md)中的 npm 拓扑，以及[仓库内 Landlock 发布](../../archived/process/2026-08-06-in-repository-landlock-release.md)中的发布机制。聚合 workflow 继续采用其中关于原生构建验证和不可变字节发布的决策。
