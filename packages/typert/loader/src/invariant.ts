/**
 * Package-owned invariant companion for `@nomix-ai/nomix-typert-loader`.
 * @module @nomix-ai/nomix-typert-loader/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@nomix-ai/cordis'
import type { InvariantInstaller } from '@nomix-ai/nomix-invariants'

const PACKAGE_NAME = '@nomix-ai/nomix-typert-loader'

/** Cordis companion plugin name. */
export const name = 'typert-loader-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the Loader entry lifecycle directly owns each exact
 * registry disposer, and integration tests observe registration and removal.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
