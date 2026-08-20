/**
 * Package-owned invariant companion for `@nomix-ai/nomix-acp`.
 * @module @nomix-ai/nomix-acp/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@nomix-ai/cordis'
import type { InvariantInstaller } from '@nomix-ai/nomix-invariants'

const PACKAGE_NAME = '@nomix-ai/nomix-acp'

/** Cordis companion plugin name. */
export const name = 'acp-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this transport owns no durable package-local event stream;
 * protocol and lifecycle tests cover its mapping.
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
