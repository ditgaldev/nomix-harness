# Agent Note: Single npm Harness distribution

Status: implemented

English | [中文](2026-08-25-single-npm-harness-distribution.zh.md)

## Problem

Publishing Cordis, its plugins, and Landlock as independent npm packages makes one product release depend on twelve preliminary package publications. Partial publication leaves the registry in a state that users cannot install, while the product exposes none of those workspaces as independently supported distributions.

## Decision

The Nomix product publishes as `@nomix-ai/nomix-harness`. Vendor and native packages are bundled implementation units in this product, not preliminary publication targets. Pushes to `npm-nomix-harness` publish one verified Harness tarball. The retained manual vendor and native release workflows are separate upstream tooling; the Nomix product release does not invoke them.

The aggregate builder copies every runtime workspace, including vendored Cordis and the Landlock packages, into the Harness tarball as npm `bundledDependencies`. Each bundled manifest replaces workspace selectors with the referenced package's concrete version. Desktop assemblies, benchmark tooling, and unused legacy HMR stay outside the npm runtime. Default runtime dependencies remain required; other carried implementations are bundled optional dependencies. Installed-product isolation skips only these explicit aggregate root optionals and still checks every dependency of the default runtime graph. Node, Cordis configuration, and out-of-tree plugin peers continue to resolve canonical package names, while npm publishes only the outer Harness package.

The system addon's Linux and macOS x64/ARM64 packages are built on matching GitHub runners, verified against the checked-in platform matrix, and bundled as optional dependencies. Linux payloads include glibc and musl launchers and addons; macOS payloads include addons. The aggregate tarball fails validation unless all four platform payloads are complete.

The tarball manifest lists repository-owned packages only as bundled dependencies, so installers consume their bytes from the Harness tarball rather than the registry. Third-party dependencies remain ordinary npm dependencies. The outer package exposes the plugin-authoring facade defined by the [single-dependency plugin API](../architecture/2026-09-02-single-dependency-plugin-api.md); application, profile, and native-launcher behavior remains unchanged.

## Alternatives considered

Release validation installs the aggregate tarball with npm and pnpm, the installers that preserve npm bundled dependencies without resolving their names from the registry. Yarn 4 resolves those names from the registry even when their bytes are present in the tarball, so it is not a supported installer for this distribution. Supporting it would require changing the flattened runtime layout rather than validating the npm package format produced here.

Post-publication verification checks the outer package's registry signature, npm build attestation predicate, integrity, release-channel tag, and installed CLI version. It does not run `npm audit signatures`: that command re-resolves bundled workspace names through the registry and therefore rejects the deliberate single-package topology even after a correct install.

A publication rerun first asks the registry whether this exact version already exists. An absent version follows the strict packed-byte publication path; an existing immutable version skips every npm write and runs the outer-package verification against the registry copy. This permits verification-only workflow fixes after a successful upload without weakening the publisher's rejection of a different tarball under the same version.

**Keep three release families.** This lets installers download only one Landlock architecture, but recreates the publication ordering and partial-registry failures that the aggregate Harness distribution exists to remove.

**Compile Landlock during installation.** This keeps the tarball smaller but requires a musl toolchain on consumer machines and makes confinement availability depend on install-time compilation. The launcher remains prebuilt and fail-closed.

**Embed only Linux x64.** This reduces package size but removes ARM64 support. Both supported launchers ship in the aggregate package, accepting the small unused download on other platforms.

## Consequences

Consumers install and execute one registry package, and a Harness version names the complete JavaScript, vendor, Web, and native runtime. A publication cannot expose a Harness version that points at missing repository-owned packages.

Every consumer downloads all four platform payloads and the carried opt-in implementations, including those unused on its platform. Catalog discovery does not mean provider activation; the aggregate does not promise that opt-in provider bytes are absent. Existing standalone versions already present on npm remain historical registry entries, but the Harness manifest does not reference them and the Nomix product release does not publish new ones.

This decision supersedes the npm topology in [three independent npm release sequences](../../archived/process/2026-08-10-npm-release-sequences.md) and the publication mechanism in [in-repository Landlock release](../../archived/process/2026-08-06-in-repository-landlock-release.md). Their native-build verification and immutable-byte publication rationale remain in force where the aggregate workflow uses them.
