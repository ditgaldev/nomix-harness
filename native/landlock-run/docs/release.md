# Release

Landlock has no independent npm release. Its private workspaces keep a shared source version for tests and binary compatibility, while the published artifact takes the Harness version.

`Release (Nomix)` derives the native matrix from `packages/*/prebuilds.json`, builds each target on its matching runner, verifies and transfers the binaries, and embeds them in the single Harness tarball. The Harness publish job is the only npm write path.

For source validation, run:

```sh
pnpm --dir native/landlock-run build:ts
pnpm --dir native/landlock-run typecheck
pnpm --dir native/landlock-run test:entry
```

`pnpm --dir native/landlock-run build:native` and `test:launcher` additionally require Linux and a musl toolchain. CI owns the complete x64 and ARM64 signal.
