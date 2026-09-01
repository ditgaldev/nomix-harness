/** Built-in Nomix product compositions. */

/** One shipped profile bundle stored in the package bundle manifest. */
export interface BundleDescriptor {
  /** Stable bundle id used by the Nomix profile resolver. */
  readonly id: string
  /** Source workspace package represented by the bundled patch. */
  readonly packageName: string
}

function bundle(id: string, packageName: string): BundleDescriptor {
  return { id, packageName }
}

/** Shipped bundle descriptors; selecting one is explicit and side-effect free. */
export const bundles = {
  base: (): BundleDescriptor => bundle('base', '@nomix-ai/nomix-base'),
  headless: (): BundleDescriptor => bundle('headless', '@nomix-ai/nomix-headless'),
  web: (): BundleDescriptor => bundle('web-app', '@nomix-ai/nomix-web-app'),
} as const
