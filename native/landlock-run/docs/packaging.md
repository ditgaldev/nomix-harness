# Packaging

Landlock ships inside the aggregate `@nomix-ai/nomix-harness` package. The workspaces under `packages/` remain private build and test units; none is an npm distribution.

## Embedded layout

```text
dist/kernel/node-addon-landlock-run/       JavaScript API
dist/native/landlock-run/linux-x64/        x64 static launcher
dist/native/landlock-run/linux-arm64/      ARM64 static launcher
dist/licenses/landlock-run.LICENSE         BSD-3-Clause notice
```

The release matrix is derived from each platform workspace's `prebuilds.json`. Each architecture builds on its matching native runner, `assemble-prebuilds.mjs` verifies ELF metadata and executable mode, and the Harness pack copies every declared binary into the layout above. A missing, non-executable, or undeclared binary fails the aggregate build.

## Runtime selection

`launcherPath()` first selects `dist/native/landlock-run/<process.platform>-<process.arch>/landlock-run` relative to the embedded JavaScript module. Source-workspace execution falls back to the private platform workspace. Unsupported platforms resolve a deterministic nonexistent path, and `probe()` reports `unusable`; there is no unconfined fallback.

## No install build

The Harness package never compiles Landlock on the consumer host. A compile fallback would require a musl toolchain and would make confinement availability depend on the installation environment.
