/** Experimental-package isolation for the installed default product's dependency graph. */

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { hasExperimentalPackageReference } from '../experimental-package-policy.ts'
import { OPTIONAL_BUNDLES } from '../../packages/boot/app-boot/src/profile.ts'

interface InstalledManifest {
  name: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  bundledDependencies?: readonly string[]
}

/**
 * Reject experimental dependencies reachable from one installed product entry.
 * Other packages installed beside the entry and development dependencies do not join its graph.
 * Only the aggregate root's physically present bundled optional implementations are excluded from traversal.
 * @param directory - installed entry package directory.
 * @param optionalBundles - shipped switched-off bundles whose direct entry dependency is exempt.
 * @returns number of distinct installed packages visited.
 */
export function verifyInstalledProductIsolation(directory: string, optionalBundles: readonly string[] = OPTIONAL_BUNDLES): number {
  const visited = new Set<string>()
  const queue = [{ directory, chain: [] as string[] }]
  for (const item of queue) {
    const canonical = realpathSync(item.directory)
    if (visited.has(canonical)) continue
    visited.add(canonical)
    const manifest = JSON.parse(readFileSync(join(canonical, 'package.json'), 'utf8')) as InstalledManifest
    const chain = [...item.chain, manifest.name]
    rejectExperimental(manifest.name, chain)
    // The bundles the entry package ships switched off are installed beside the product, not required by it.
    const offered = item.chain.length === 0 ? new Set(optionalBundles) : new Set<string>()
    for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
      for (const [name, range] of Object.entries(manifest[section] ?? {})) {
        // Aggregate-only optional implementations are carried bytes; a transitive edge still joins the default graph.
        if (item.chain.length === 0 && manifest.name === '@nomix-ai/nomix-harness'
          && section === 'optionalDependencies' && !Object.hasOwn(manifest.dependencies ?? {}, name)
          && manifest.bundledDependencies?.includes(name) === true) {
          const bundled = join(canonical, 'node_modules', name, 'package.json')
          if (existsSync(bundled)) {
            const identity = JSON.parse(readFileSync(bundled, 'utf8')) as InstalledManifest
            if (identity.name !== name) throw new Error(`bundled optional package identity differs: ${name} -> ${identity.name}`)
            continue
          }
        }
        if (section === 'dependencies' && offered.has(name)) {
          if (installedPackage(canonical, name) === undefined) throw new Error(`optional bundle is missing: ${[...chain, name].join(' -> ')}`)
          continue
        }
        rejectExperimental(name, [...chain, name])
        if (range.startsWith('npm:')) {
          rejectExperimental(range.slice(4), [...chain, `${name} (${range})`])
        }
        const dependency = installedPackage(canonical, name)
        if (dependency === undefined) {
          if (section === 'optionalDependencies'
            || Object.hasOwn(manifest.optionalDependencies ?? {}, name)
            || section === 'peerDependencies' && manifest.peerDependenciesMeta?.[name]?.optional === true) continue
          throw new Error(`default product dependency is missing: ${[...chain, name].join(' -> ')}`)
        }
        queue.push({ directory: dependency, chain })
      }
    }
  }
  return visited.size
}

function rejectExperimental(name: string, chain: readonly string[]): void {
  if (hasExperimentalPackageReference(name)) {
    throw new Error(`default product includes an experimental package: ${chain.join(' -> ')}`)
  }
}

/** Resolve a dependency directory through the installed package's ancestor node_modules. */
function installedPackage(from: string, name: string): string | undefined {
  const resolver = createRequire(join(from, 'package.json'))
  for (const directory of resolver.resolve.paths(name) ?? []) {
    const candidate = join(directory, name)
    if (existsSync(join(candidate, 'package.json'))) return candidate
  }
  return undefined
}
