# Agent Note: Nomix native npm distribution

Status: implemented

English | [中文](2026-08-21-nomix-native-npm-distribution.zh.md)

## Problem

The former npm artifact deployed the workspace dependency tree, compressed its nested `node_modules` as a private runtime archive, and restored it from `postinstall`. That artifact could not be installed with lifecycle scripts disabled, exposed no stable plugin API, and coupled every consumer to a repository-specific deployment layout. The repository also retained product names that predated Nomix across TypeScript, Python, configuration, protocol fields, documentation, maintenance Skills, and release automation.

## Decision

`@nomix-ai/nomix-harness` 0.2 is the only public product package. The build projects every production workspace into a classified ESM distribution under `dist/`: CLI, kernel modules, plugin API, lazy plugin registry, bundles, runtime, SDK, testing helpers, and assets. Internal product package imports are rewritten to package-relative ESM paths; external libraries remain ordinary dependencies and native platform wrappers remain optional dependencies. The packed artifact contains no nested `node_modules`, runtime archive, install script, source, test, internal documentation, or source map.

Built-in factories return Loader descriptors only. They neither import nor initialize their implementation. `resolveProfile` turns a business application's selected descriptors into Loader entries and rejects an unknown profile. Packaged bundle rows use `cordis:nomix/<plugin-id>`, and the generated Loader registry imports a selected module on first access. Cordis continues to own activation, dependency injection, effects, auditing, and disposal. The default bundles do not register a model provider; DeepSeek is compiled as an optional provider and loads only after explicit selection.

All active product names use Nomix, including `NOMIX_*`, `~/.nomix`, `nomix.profile`, `nomix.bundle`, the TypeScript SDK, and the Python distributions and modules. Old variables and manifest fields fail with the replacement name. No alias or automatic home migration exists. A repository gate rejects old names outside frozen archives, vendor sources, licenses, provider-specific identifiers, and migration rejection tests.

Tags matching `nomix-v*` publish the already verified tarball from GitHub Actions through npm Trusted Publishing with provenance. Pull requests and `master` build and verify the same package on Linux, Windows, and macOS. The workflow has no registry token or access-repair path.

## Consequences

- A business system installs one package and registers only the built-ins and external business bundles it needs.
- `npm ci --ignore-scripts` is a supported installation path.
- The build fails when a workspace lacks a distribution classification, a required plugin is absent from the manifest, or the tarball exposes a forbidden path.
- 0.2 is intentionally incompatible with old environment variables, profile fields, home paths, SDK type names, and Python imports.
- Publishing still requires the repository administrator to configure the `npm-publish` environment and npm Trusted Publisher before creating the release tag.
