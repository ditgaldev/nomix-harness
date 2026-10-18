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
      description: 'Add the official “powered by nomix” badge to documents, pull requests, merge requests, and other content produced with Nomix Harness. Use whenever creating a pull request or merge request. Also use when the user asks for a nomix badge, powered-by-nomix attribution, or a reusable nomix badge asset or snippet.',
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

  it('presents the component as NOMIX with the bundle tag artwork in both locales', async () => {
    expect(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))).toMatchObject({
      icon: './icon.svg',
      exports: { './locale/*.json': './locale/*.json' },
    })
    for (const language of ['en', 'zh']) {
      expect(JSON.parse(await readFile(new URL(`../locale/${language}.json`, import.meta.url), 'utf8')))
        .toMatchObject({ meta: { title: 'NOMIX' } })
    }
    expect(await readFile(new URL('../icon.svg', import.meta.url), 'utf8'))
      .toBe(await readFile(new URL('../../badge-skill-bundle/icon.svg', import.meta.url), 'utf8'))
  })

  it('ships the official 726×120 PNG unchanged', async () => {
    const image = await readFile(new URL('../assets/nomix-badge.png', import.meta.url))
    expect(image.readUInt32BE(16)).toBe(726)
    expect(image.readUInt32BE(20)).toBe(120)
    expect(createHash('sha256').update(image).digest('hex')).toBe(
      'f2c4f5ec9cbe847c0c763545c4d839efa8485bc74203733d0a0e8259f233c653',
    )
  })
})
