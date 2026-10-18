/** Official bundles offered without enabling their provider runtimes in default profiles. */

import type { PluginLocalizedMeta } from '@nomix-ai/nomix-package-manifest'

export { ON_DEMAND_BUNDLES } from './official-bundle-packages.ts'

/** Offline discovery metadata; installation state and the requested version belong to the running host. */
export interface OfficialBundleCatalogEntry {
  /** Exact npm package name accepted by the existing bundle installer. */
  readonly packageName: string
  /** Package-owned localized text and a self-contained icon, embedded without provider code. */
  readonly meta: Required<Pick<PluginLocalizedMeta, 'title' | 'description' | 'icon'>>
}

export { OFFICIAL_ON_DEMAND_CATALOG } from './official-bundles.generated.ts'
