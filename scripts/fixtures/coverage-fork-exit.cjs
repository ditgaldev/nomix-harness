// Preserve Node's exit before Vitest installs its test-level process.exit guard.
globalThis.__nomixCoverageFixtureExit = process.exit.bind(process)
