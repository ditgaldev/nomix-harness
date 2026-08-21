/** Public types and helpers for Nomix plugins. */

/** Loader entry produced by a built-in or external Nomix plugin factory. */
export interface PluginRegistration<Config = unknown> {
  /** Stable entry id inside the selected profile. */
  readonly id: string
  /** Cordis builtin or external package specifier. */
  readonly name: string
  /** Plugin configuration passed to Cordis. */
  readonly config?: Config
}

/** A side-effect-free factory that describes one plugin registration. */
export type PluginFactory<Config = Record<string, unknown>> = (config?: Config) => PluginRegistration<Config>

/** Define an external plugin factory without importing or initializing its implementation. */
export function definePlugin<Config = Record<string, unknown>>(
  id: string,
  name: string,
): PluginFactory<Config> {
  return (config?: Config): PluginRegistration<Config> => ({ id, name, ...(config === undefined ? {} : { config }) })
}
