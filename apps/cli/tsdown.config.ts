import { defineConfig } from 'tsdown'

/**
 * The nomix CLI ships one entry: the `bin` referenced by package.json `bin`.
 * The root tsdown builds only `lib/types/index.js`, so this override points at
 * `lib/types/bin.js` instead; its reachable mode modules bundle with it.
 * Declarations come from `tsc -b` (dts: false), matching every package.
 */
const common = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
} as const

export default defineConfig([
  { ...common, entry: ['lib/types/bin.js'] },
  {
    ...common,
    entry: [
      'lib/types/index.js',
      'lib/types/config.js',
      'lib/types/public-plugin.js',
      'lib/types/plugins.js',
      'lib/types/bundles.js',
      'lib/types/runtime.js',
      'lib/types/sdk.js',
      'lib/types/testing.js',
    ],
  },
])
