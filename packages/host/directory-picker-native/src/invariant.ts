/**
 * Package-owned invariant companion for the native directory-picker backend.
 * @module @nomix-ai/nomix-host-directory-picker-native/invariant
 */

import type { Context } from '@nomix-ai/cordis'
import type { InvariantInstaller } from '@nomix-ai/nomix-invariants'

const PACKAGE_NAME = '@nomix-ai/nomix-host-directory-picker-native'

/** Cordis companion plugin name. */
export const name = 'host-directory-picker-native-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: each pick is one stateless subprocess round trip; the chooser outcome is only the returned path. */
const install: InvariantInstaller = () => {}

/**
 * Register the native directory-picker invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
