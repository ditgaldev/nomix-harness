# Agent Note: Nomix native npm distribution

Status: implemented

English | [中文](2026-08-21-nomix-native-npm-distribution.zh.md)

## Problem

The former npm artifact deployed the workspace dependency tree, compressed its nested `node_modules` as a private runtime archive, and restored it from `postinstall`. That artifact could not be installed with lifecycle scripts disabled, exposed no stable plugin API, and coupled every consumer to a repository-specific deployment layout. The repository also retained product names that predated Nomix across TypeScript, Python, configuration, protocol fields, documentation, maintenance Skills, and release automation.

## Decision

`@nomix-ai/nomix-harness` 0.2 is the only public product package. The build projects every production workspace into a classified ESM distribution under `dist/`: CLI, kernel modules, plugin API, lazy plugin registry, bundles, runtime, SDK, testing helpers, and assets. Internal product package imports in Node artifacts are rewritten to package-relative ESM paths. Browser client factories retain the canonical specifiers supplied by the frozen client module table because their injected `require` does not perform filesystem resolution. External libraries remain ordinary dependencies and native platform wrappers remain optional dependencies. The packed artifact contains no nested `node_modules`, runtime archive, install script, source, test, internal documentation, or source map.

Built-in factories return Loader descriptors only. They neither import nor initialize their implementation. `resolveProfile` turns a business application's selected descriptors into Loader entries and rejects an unknown profile. Descriptors, packaged bundle rows, and preset rows retain canonical `@nomix-ai/nomix-*` package names. The aggregate package carries a generated kernel manifest, and profile startup maintains package-name links from `$NOMIX_HOME/profiles/node_modules` to the matching `dist/kernel/*` directories. Loader imports stay lazy while Client and Typert metadata discovery keep the same package identity used in the workspace. Cordis continues to own activation, dependency injection, effects, auditing, and disposal. The default bundles do not register a model provider; DeepSeek is compiled as an optional provider and loads only after explicit selection.

All active product names use Nomix, including `NOMIX_*`, `~/.nomix`, `nomix.profile`, `nomix.bundle`, the TypeScript SDK, and the Python distributions and modules. Old variables and manifest fields fail with the replacement name. No alias or automatic home migration exists. A repository gate rejects old names outside frozen archives, vendor sources, licenses, provider-specific identifiers, and migration rejection tests.

Tags matching `nomix-v*` publish the already verified tarball from GitHub Actions with provenance. Pull requests and the release branch build and verify the same package on Linux, Windows, and macOS. The publish job reads `NPM_TOKEN` only through `NODE_AUTH_TOKEN` and has no access-repair path.

## Alternatives considered

**Rewrite every internal package name to a Loader builtin.** Rejected because Client and Typert discovery use package manifests and canonical package names as graph identities; replacing configuration data with `cordis:nomix/*` removes that metadata relationship. Package-name links preserve lazy Loader imports and the original identity together.

**Publish or install every production workspace separately.** Rejected because it restores the multi-package release ordering and registry dependency that the aggregate artifact removes. Kernel directories already contain the required package exports, so runtime-created links provide Node resolution without nested `node_modules` or additional public packages.

## Consequences

- A business system installs one package and registers only the built-ins and external business bundles it needs.
- `npm ci --ignore-scripts` is a supported installation path.
- The build fails when a workspace lacks a distribution classification, a required plugin or Web asset is absent from the package, or the tarball exposes a forbidden path.
- Packed-install verification starts the installed Web profile, waits for its ready URL, and shuts it down on every supported platform and package manager.
- 0.2 is intentionally incompatible with old environment variables, profile fields, home paths, SDK type names, and Python imports.
- Publishing requires the repository administrator to configure the `npm-publish` environment with an `NPM_TOKEN` repository secret that can publish public packages in the `@nomix-ai` scope. The publish job exposes it only as `NODE_AUTH_TOKEN`; GitHub OIDC remains enabled solely for npm provenance.
