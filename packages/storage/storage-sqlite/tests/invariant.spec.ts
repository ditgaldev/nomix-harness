import { describe, expect, it } from 'vitest'
import { Context } from '@nomix-ai/cordis'
import InvariantRegistry from '@nomix-ai/nomix-invariants'
import * as StorageSqliteInvariant from '../src/invariant.ts'

describe('invariant companion', () => {
  it('registers under the package name with an explained-empty installer', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(StorageSqliteInvariant).await()).resolves.toBeDefined()
  })
})
