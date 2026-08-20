/**
 * Package-owned invariant companion for `@nomix-ai/nomix-session-telemetry`.
 * @module @nomix-ai/nomix-session-telemetry/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@nomix-ai/cordis'
import type { InvariantInstaller } from '@nomix-ai/nomix-invariants'

const PACKAGE_NAME = '@nomix-ai/nomix-session-telemetry'

/** Cordis companion plugin name. */
export const name = 'session-telemetry-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the package's whole output is the backend handoff — a
 * synchronous `emit()` call outside every authoritative event stream — and its
 * capture side never appends session events, so no event/data relation exists
 * for an independent companion to observe.
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
