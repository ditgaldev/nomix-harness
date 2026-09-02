# Agent Note: Single-dependency plugin API

Status: implemented

English | [中文](2026-09-02-single-dependency-plugin-api.zh.md)

## Problem

The aggregate npm package contains the complete Harness runtime but exposes only its command. An out-of-tree plugin therefore has to import and declare repository-internal packages to use Cordis primitives or a Nomix capability. Those dependencies are implementation units that are not published independently, so the documented plugin model cannot be installed from the single-package distribution.

## Decision

`@nomix-ai/nomix-harness/plugin` is the stable plugin-authoring entry. It exports Cordis plugin primitives and the configuration `Schema`. Each bundled `@nomix-ai/nomix-*` package receives an explicit `@nomix-ai/nomix-harness/plugin/<id>` export generated into the aggregate tarball, where `<id>` is the canonical package suffix such as `tools` or `session`.

An out-of-tree plugin declares `@nomix-ai/nomix-harness` as its only Nomix dependency. Its source imports the base authoring API and capability APIs through Harness subpaths; its manifest does not declare Cordis or repository-internal Nomix packages. Generated runtime and declaration proxies resolve to the canonical packages bundled inside the same Harness installation, retaining their module augmentation and runtime exports without copying their implementations.

Release verification installs only the packed Harness into a throwaway consumer, type-checks a business plugin against the base and tools entries, and executes those entries. This verifies both declaration and Node ESM resolution from the installed tarball.

## Alternatives considered

**Publish every workspace package.** Direct imports work, but publication ordering, registry rate limits, and partial releases return. It also turns implementation package names into a supported external dependency graph.

**Flatten or rewrite all internal modules into one JavaScript bundle.** Static rewriting cannot preserve every dynamic `import`, `require.resolve`, and Loader package lookup without maintaining a second module system. npm bundled dependencies already preserve Node's native resolution.

**Expose only Cordis types.** Simple plugins compile, but capability plugins still need internal package names for helpers such as `defineTool`. Capability subpaths keep one declared dependency while preserving focused imports.

## Consequences

Business plugins depend on one published package and use stable Harness-owned import paths. Adding or removing an official runtime package changes the generated capability entry inventory in the same Harness release.

The public subpaths expose the bundled packages' existing named exports, so those exports become reachable through a supported Harness name. The facade does not promise that internal package names are independently installable, and it does not merge unrelated capability exports into one collision-prone module.
