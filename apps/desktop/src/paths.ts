/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveNomixHome } from '@nomix-ai/nomix-home-paths'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param nomixHome - Harness home shared with npm-installed nomix.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(nomixHome: string = resolveNomixHome()): DesktopPaths {
  return {
    profile: join(nomixHome, 'profiles', 'desktop'),
    lock: join(nomixHome, 'profiles', 'desktop', 'lock'),
  }
}
