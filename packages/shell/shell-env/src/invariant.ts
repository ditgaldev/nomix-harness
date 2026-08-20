/**
 * Package-owned invariant companion for `@nomix-ai/nomix-shell-env`.
 * @module @nomix-ai/nomix-shell-env/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@nomix-ai/cordis'
import type { InvariantInstaller } from '@nomix-ai/nomix-invariants'

const PACKAGE_NAME = '@nomix-ai/nomix-shell-env'

/** Cordis companion plugin name. */
export const name = 'shell-env-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the environment registry validates ownership and collected values at each
 * registration/collection; it publishes no independent snapshot that a companion could cross-check.
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
