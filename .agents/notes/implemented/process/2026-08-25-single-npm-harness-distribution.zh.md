# Agent Note: 单一 npm Harness 分发包

Status: implemented

[English](2026-08-25-single-npm-harness-distribution.md) | 中文

## Problem

把 Cordis、Cordis 插件和 Landlock 发布为独立 npm 包，会让一次产品发布依赖十二次前置包发布。部分发布会让 registry 处于用户无法安装的状态，而产品并未把这些 workspace 作为可独立支持的分发包公开。

## Decision

`@nomix-ai/nomix-harness` 是本仓库产出的唯一可发布 `@nomix-ai` 包。vendor 和 native manifest 是私有实现单元。Nomix release workflow 是唯一 npm 写入路径，向 `npm-nomix-harness` push 时发布一个经过验证的 Harness tarball。

聚合构建器把包括 vendored Cordis 和 Landlock JavaScript 入口在内的所有运行时 workspace 复制到 `dist/kernel`，并把其中的 `@nomix-ai/*` import 改写为包内相对 import。生成的 kernel manifest 保留规范包标识，因此 Cordis 配置和仓库外插件的 peer 解析无需独立安装包也能继续工作。

Landlock 的 x64 和 ARM64 二进制在匹配的 GitHub runner 上构建，按签入仓库的平台矩阵验证，并复制到 `dist/native/landlock-run/<platform>`。`launcherPath()` 优先选择这个包内二进制，再使用源码 workspace fallback。聚合 tarball 携带 BSD-3-Clause 许可声明；缺少任一受支持二进制或文件不可执行时，验证会失败。

tarball manifest 不包含本仓库拥有的 `@nomix-ai` 包依赖。第三方依赖仍是普通 npm 依赖，包括它们自己的平台专用包。

## Alternatives considered

**保留三条 release family。** 这能保留 npm 的普通逐包解析，并让安装程序只下载一个 Landlock 架构，但会重新引入聚合 Harness 分发本来要消除的发布顺序和 registry 部分发布问题。

**安装时编译 Landlock。** 这能减小 tarball，却要求消费机器安装 musl 工具链，并让 confinement 可用性取决于安装期编译。启动器继续采用预构建和 fail-closed 策略。

**只嵌入 Linux x64。** 这能减小包体积，却会移除 ARM64 支持。聚合包携带两个受支持的启动器，并接受其他平台或架构下载少量未使用文件的代价。

## Consequences

消费方只安装并执行一个包，一个 Harness 版本同时命名完整的 JavaScript、vendor、Web 和 native runtime。发布过程无法产生指向缺失仓库自有包的 Harness 版本。

所有消费方都会下载两个 Linux 启动器，包括 Windows、macOS 和不会使用其中一个启动器的 Linux 架构。npm 上已经存在的独立版本继续作为历史 registry 条目保留，但 Harness manifest 不引用它们，本仓库也不再发布新版本。

本决策取代[三条独立 npm 发布序列](../../archived/process/2026-08-10-npm-release-sequences.md)中的 npm 拓扑，以及[仓库内 Landlock 发布](../../archived/process/2026-08-06-in-repository-landlock-release.md)中的发布机制。聚合 workflow 继续采用其中关于原生构建验证和不可变字节发布的决策。
