# Architecture

This repository owns confinement *mechanism*, not policy: consumers decide which paths a run may read or write; the private Landlock workspaces provide the launcher that enforces those grants and the JavaScript API that resolves and speaks to it. Both layers ship inside `@nomix-ai/nomix-harness`.

## Two-layer embedded runtime

The runtime has one JavaScript entry workspace plus per-platform binary build targets:

- **Entry workspace** (`@nomix-ai/node-addon-landlock-run`): ESM JavaScript that owns path selection, the functional probe, grant-argv construction, and the CLI constants. The aggregate builder copies it into `dist/kernel/node-addon-landlock-run`.
- **Platform workspaces** (`linux-{x64,arm64}`): each declares one static binary in `prebuilds.json`. Native CI builds and verifies them before the aggregate builder copies them into `dist/native/landlock-run/<platform>`.

Because the CLI parser and both binaries enter one immutable Harness tarball, the parser cannot fall behind the binary it launches.

There is no shared loader package: the platform workspaces contain no JavaScript.

## Resolution and availability

`launcherPath()` selects the embedded `dist/native/landlock-run/<platform>-<arch>/landlock-run`. Source-workspace execution may resolve the matching private platform workspace instead. An unsupported platform returns a deterministic nonexistent path; `probe()` is the single availability signal, and a missing binary probes `unusable` exactly like an unenforcing kernel.

The probe is functional — the launcher builds and enforces a real maximal ruleset in a short-lived child — because version checks would miss a kernel that has the syscalls but refuses enforcement.

## Fail-closed everywhere

The launcher exits `125` without exec'ing the command on any launcher-level failure: usage error, unenforcing kernel, unopenable grant root, failed exec. Partial enforcement (an older Landlock ABI governing only a subset of accesses) is accepted, reported on stderr, and surfaced by the probe as `partial` — the consumer decides what its mode vocabulary promises at each level. Neither the binary nor the entry package reads environment variables: which binary confines a process is never decidable by the ambient environment.

## Build and release model

Builds are native-only. `scripts/build.ts` compiles the running architecture's binary with `musl-gcc`; CI's per-architecture runners are the builders of record, and no cross toolchain exists in the repo. Binary metadata verification rejects missing, non-executable, or wrong-architecture ELF files, and the Harness payload validation requires every supported target.

The platform matrix is checked-in metadata (`prebuilds.json` plus `os`/`cpu` fields); `scripts/github-matrix.mjs` derives the CI and Harness release matrices from it.

## Adding a platform

A new platform adds one private `packages/<platform>/` workspace (`package.json` with `os`/`cpu`, `prebuilds.json`, and README), a runner entry in `scripts/github-matrix.mjs`, and a row in [support-matrix.md](support-matrix.md). It enters the aggregate package only together with a native GitHub runner that builds and proves it.
