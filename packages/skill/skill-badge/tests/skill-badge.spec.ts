import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Context } from '@nomix-ai/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@nomix-ai/nomix-skill'
import * as SkillBadge from '@nomix-ai/nomix-skill-badge'

describe('nomix-skill-badge', () => {
  it('registers and disposes the bundled badge skill', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillBadge)
    const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))

    expect(await ctx.skills.list()).toEqual([{
      name: 'nomix-badge',
      description: 'Add the official “powered by Nomix” badge to documents, pull requests, merge requests, and other content produced with Nomix Harness. Use whenever creating a pull request or merge request. Also use when the user asks for a Nomix badge, Nomix attribution, or a reusable Nomix badge asset or snippet.',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'nomix-badge',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('nomix-badge')
    expect(loaded?.content).toContain('Preserve the badge\'s 121×20 dimensions')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })

  it('ships the official 726×120 SVG unchanged', async () => {
    const image = await readFile(new URL('../assets/nomix-badge.svg', import.meta.url))
    expect(image.toString('utf8')).toContain('width="726" height="120"')
    expect(image.toString('utf8')).toContain('powered by Nomix')
    expect(createHash('sha256').update(image).digest('hex')).toBe(
      '19a6df4b883b0f824d1f5ee9aad9fa28d23afe317f1399775871ef4514896ca0',
    )
  })
})
