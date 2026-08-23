# Agent Note: 单包内的 Windows ACL runner 定位

Status: implemented

[English](2026-08-23-single-package-windows-acl-runner-resolution.md) | 中文

## Problem

原生 npm 包把 `sandbox-local` 与 `sandbox-windows-acl` 作为相邻目录放在 `dist/kernel` 下，但本地沙箱仍通过未发布的 workspace 包名定位 ACL runner。打包时静态 import 会被改写，`import.meta.resolve()` 字符串里的包名却保持不变。因此，Windows 消费项目可以加载 Web 应用，却会在 shell 工具首次选择 ACL 沙箱时失败。

## Decision

本地沙箱通过相对于自身模块的 URL 定位构建后的 ACL runner。workspace 构建输出与扁平化 npm kernel 具有相同的相对目录结构。源码执行继续通过相对路径回退到相邻包的 TypeScript runner。

packed-install 验证会导入安装后的 `sandbox-local` kernel 模块并执行默认 runner 定位。如果聚合包仍需要内部 workspace 包名，或路径没有指向随包提供的 `sandbox-windows-acl/lib/runner.js`，检查就会失败。

## Alternatives considered

**单独发布 `@nomix-ai/nomix-sandbox-windows-acl`。** 这能让遗留的包名解析成功，但会推翻单包分发决策，只为掩盖产物路径错误而暴露一个内部实现单元。

**让打包器改写 `import.meta.resolve()` 的字符串参数。** 通用字符串改写必须区分包解析与普通数据，而这个路径在打包后的相对位置本来就是稳定的，因此不值得增加转换规则。

## Consequences

Windows shell 工具无需安装另一个 Nomix 包即可选择随包提供的 ACL runner。发布矩阵会在安装 tarball 后检查这条延迟运行时解析路径，Web 就绪检查不再能够掩盖该缺陷。两个 kernel 目录之间的相对布局成为产物不变量。
