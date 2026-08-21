/** Public configuration helpers for an installed Nomix Harness. */

import type { PluginRegistration } from './public-plugin.ts'

/** One named application profile. */
export interface NomixProfileConfig {
  /** Plugins mounted in declaration order. */
  readonly plugins: readonly PluginRegistration[]
}

/** Consumer-owned Nomix configuration. */
export interface NomixConfig {
  /** Named product compositions selected by the host application. */
  readonly profiles: Readonly<Record<string, NomixProfileConfig>>
}

/** Cordis Loader entry materialized from a business application's selected plugins. */
export interface NomixLoaderEntry<Config = unknown> {
  /** Stable entry id inside the profile. */
  readonly id: string
  /** Cordis builtin or external package specifier. */
  readonly name: string
  /** Plugin configuration passed to Cordis. */
  readonly config?: Config
}

/** Preserve literal plugin ids and profile names while checking the public configuration type. */
export function defineConfig<const Config extends NomixConfig>(config: Config): Config {
  return config
}

/** Resolve one configured profile to the Loader entries mounted by a Nomix host. */
export function resolveProfile(config: NomixConfig, profile: string): readonly NomixLoaderEntry[] {
  const selected = config.profiles[profile]
  if (selected === undefined) throw new Error(`Nomix profile ${JSON.stringify(profile)} is not registered`)
  return selected.plugins.map(plugin => ({
    id: plugin.id,
    name: plugin.name,
    ...(plugin.config === undefined ? {} : { config: plugin.config }),
  }))
}
