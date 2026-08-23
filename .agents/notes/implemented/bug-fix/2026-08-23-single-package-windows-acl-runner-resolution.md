# Agent Note: Single-package Windows ACL runner resolution

Status: implemented

English | [中文](2026-08-23-single-package-windows-acl-runner-resolution.zh.md)

## Problem

The native npm package contains `sandbox-local` and `sandbox-windows-acl` as sibling directories under `dist/kernel`, but the local sandbox resolved the ACL runner through the unpublished workspace package name. Static imports were rewritten during packing, while the package name inside `import.meta.resolve()` remained unchanged. An installed Windows consumer therefore loaded the Web application but failed when a shell tool first selected the ACL sandbox.

## Decision

The local sandbox resolves the built ACL runner through a URL relative to its own module. The same relative layout exists in workspace build output and the flattened npm kernel. Source execution retains a relative fallback to the sibling package's TypeScript runner.

Packed-install verification imports the installed `sandbox-local` kernel module and exercises its default runner lookup. The check fails if the aggregate package requires an internal workspace package name or points anywhere other than the included `sandbox-windows-acl/lib/runner.js`.

## Alternatives considered

**Publish `@nomix-ai/nomix-sandbox-windows-acl` separately.** This would make the stale package lookup resolve, but would reverse the single-package distribution decision and expose an internal implementation unit solely to compensate for an artifact path bug.

**Teach the packer to rewrite string arguments to `import.meta.resolve()`.** A general string rewrite must distinguish package resolution from ordinary data and would add transformation rules for a path whose packaged relative location is already stable.

## Consequences

Windows shell tools can select the included ACL runner without installing another Nomix package. The release matrix now checks this delayed runtime lookup after installing the tarball, so Web readiness alone cannot hide the defect. The relative layout between the two kernel directories is an artifact invariant.
