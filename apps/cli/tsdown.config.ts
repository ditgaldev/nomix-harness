import { defineConfig } from 'tsdown'

/**
 * The nomix package ships the `bin` referenced by package.json and the public
 * plugin-authoring API. The root tsdown builds only `lib/types/index.js`, so
 * this override names both emitted declaration inputs explicitly.
 * Declarations come from `tsc -b` (dts: false), matching every package.
 */
export default defineConfig({
  entry: ['lib/types/bin.js', 'lib/types/plugin-api.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
