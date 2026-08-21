/** Public aggregate API for Nomix Harness. */

export {
  defineConfig,
  resolveProfile,
  type NomixConfig,
  type NomixLoaderEntry,
  type NomixProfileConfig,
} from './config.ts'
export { definePlugin, type PluginFactory, type PluginRegistration } from './public-plugin.ts'
export { builtins, builtin } from './plugins.ts'
export { bundles, type BundleDescriptor } from './bundles.ts'
