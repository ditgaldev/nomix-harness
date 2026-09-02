# Agent Note: 单依赖插件 API

Status: implemented

[English](2026-09-02-single-dependency-plugin-api.md) | 中文

## Problem

聚合 npm 包包含完整 Harness 运行时，却只公开命令入口。树外插件因此必须 import 并声明仓库内部包，才能使用 Cordis 基础类型或 Nomix 能力。这些依赖是不独立发布的实现单元，因此文档中的插件模型无法从单包分发中安装。

## Decision

`@nomix-ai/nomix-harness/plugin` 是稳定的插件开发入口。它导出 Cordis 插件基础类型和配置 `Schema`。每个内嵌的 `@nomix-ai/nomix-*` 包都会在聚合 tarball 中生成一个显式 `@nomix-ai/nomix-harness/plugin/<id>` export，其中 `<id>` 是 `tools` 或 `session` 之类的规范包后缀。

树外插件只把 `@nomix-ai/nomix-harness` 声明为 Nomix 依赖。它的源码通过 Harness 子路径 import 基础开发 API 和能力 API；它的 manifest 不声明 Cordis 或仓库内部 Nomix 包。生成的运行时和声明代理解析到同一 Harness 安装中内嵌的规范包，保留它们的模块增广和运行时 export，且不复制实现。

发布验证只在一个临时消费方中安装打包后的 Harness，用基础入口和 tools 入口对一个业务插件进行类型检查，并执行这两个入口。这会验证已安装 tarball 中的声明解析和 Node ESM 解析。

## Alternatives considered

**发布每个 workspace 包。** 直接 import 可以工作，但会重新引入发布顺序、registry 限流和部分发布。它还会把实现包名变成受支持的外部依赖图。

**把所有内部模块扁平化或重写进一个 JavaScript bundle。** 如果不维护第二套模块系统，静态重写无法保留每个动态 `import`、`require.resolve` 和 Loader 包查找。npm bundled dependency 已经保留 Node 原生解析。

**只公开 Cordis 类型。** 简单插件可以编译，但能力插件仍需要内部包名才能使用 `defineTool` 之类的 helper。能力子路径在保留聚焦 import 的同时只需一个已声明依赖。

## Consequences

业务插件只依赖一个已发布包，并使用 Harness 拥有的稳定 import 路径。添加或移除官方运行时包会在同一 Harness 发布中改变生成的能力入口清单。

公共子路径会公开内嵌包的现有具名 export，因此这些 export 可以通过受支持的 Harness 名称访问。该入口不承诺内部包名可独立安装，也不会把无关能力 export 合并到一个容易命名冲突的模块中。
