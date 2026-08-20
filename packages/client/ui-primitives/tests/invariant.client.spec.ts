import { describe, expect, it } from 'vitest'
import { Context } from '@nomix-ai/cordis'
import * as PrimitivesInvariant from '@nomix-ai/nomix-client-ui-primitives/invariant'
import InvariantRegistry from '@nomix-ai/nomix-invariants'

describe('invariant companion', () => {
  it('registers under the package name with an empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(PrimitivesInvariant).await()).resolves.toBeDefined()
  })
})
