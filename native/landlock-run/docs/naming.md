# Naming

## Private workspaces

The source workspaces use the `@nomix-ai/node-addon-landlock-run` prefix but set `private: true` and never publish independently:

```text
@nomix-ai/node-addon-landlock-run
@nomix-ai/node-addon-landlock-run-<platform>
```

Platform suffixes carry no libc component (binaries are static musl) and no variant component — variants stay inside `prebuilds.json` and binary filenames.

## Binaries

The launcher executable is `landlock-run`, built at `bin/landlock-run` in each platform workspace and shipped under `dist/native/landlock-run/<platform>/landlock-run` in Harness.

## Environment variables

The `NALR_` prefix (Node Addon Landlock Run) is reserved for build/test orchestration:

```text
NALR_REQUIRE_LANDLOCK   test-only: an unenforcing kernel fails instead of skipping
```

Runtime binaries and entry packages read NO environment variables — a runtime safety rule ([AGENTS.md](../AGENTS.md)), not a naming convention. Do not include the npm scope in environment variable names.

## C symbols

The launcher is a single C file with static linkage; there is no exported symbol namespace. Kernel UAPI constants keep their kernel names prefixed `LL_` where locally defined.
