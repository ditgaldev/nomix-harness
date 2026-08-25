# Agent Note: Single npm Harness distribution

Status: implemented

English | [中文](2026-08-25-single-npm-harness-distribution.zh.md)

## Problem

Publishing Cordis, its plugins, and Landlock as independent npm packages makes one product release depend on twelve preliminary package publications. Partial publication leaves the registry in a state that users cannot install, while the product exposes none of those workspaces as independently supported distributions.

## Decision

`@nomix-ai/nomix-harness` is the only publishable `@nomix-ai` package produced by this repository. Vendor and native manifests are private implementation units. The Nomix release workflow is the only npm write path, and pushes to `npm-nomix-harness` publish one verified Harness tarball.

The aggregate builder copies every runtime workspace, including vendored Cordis and the Landlock JavaScript entry, into `dist/kernel` and rewrites their `@nomix-ai/*` imports to package-internal relative imports. The generated kernel manifest retains canonical package identities so Cordis configuration and out-of-tree plugin peer resolution continue to work without standalone installations.

Landlock's x64 and ARM64 binaries are built on matching GitHub runners, verified against the checked-in platform matrix, and copied into `dist/native/landlock-run/<platform>`. `launcherPath()` selects that package-internal binary before its source-workspace fallback. The aggregate tarball carries the BSD-3-Clause notice and fails validation unless both supported binaries are present and executable.

The tarball manifest contains no dependency on a repository-owned `@nomix-ai` package. Third-party dependencies remain ordinary npm dependencies, including their own platform-specific packages where applicable.

## Alternatives considered

**Keep three release families.** This preserves npm's ordinary per-package resolution and lets installers download only one Landlock architecture, but recreates the publication ordering and partial-registry failures that the aggregate Harness distribution exists to remove.

**Compile Landlock during installation.** This keeps the tarball smaller but requires a musl toolchain on consumer machines and makes confinement availability depend on install-time compilation. The launcher remains prebuilt and fail-closed.

**Embed only Linux x64.** This reduces package size but removes ARM64 support. Both supported launchers ship in the aggregate package, accepting the small unused download on other platforms.

## Consequences

Consumers install and execute one package, and a Harness version names the complete JavaScript, vendor, Web, and native runtime. A publication cannot expose a Harness version that points at missing repository-owned packages.

Every consumer downloads both Linux launchers, including Windows, macOS, and the unused Linux architecture. Existing standalone versions already present on npm remain historical registry entries, but the Harness manifest does not reference them and this repository does not publish new ones.

This decision supersedes the npm topology in [three independent npm release sequences](../../archived/process/2026-08-10-npm-release-sequences.md) and the publication mechanism in [in-repository Landlock release](../../archived/process/2026-08-06-in-repository-landlock-release.md). Their native-build verification and immutable-byte publication rationale remain in force where the aggregate workflow uses them.
