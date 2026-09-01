import { describe, expect, it } from 'vitest'
import { defineConfig, resolveProfile } from '../src/config.ts'
import { builtins } from '../src/plugins.ts'

describe('public plugin registration API', () => {
  it('describes selected built-ins without importing their implementations', () => {
    const config = defineConfig({
      profiles: {
        web: {
          plugins: [
            builtins.session.sqlite(),
            builtins.agent.loop(),
            builtins.llm.deepseek({ apiKeyEnv: 'DEEPSEEK_API_KEY' }),
          ],
        },
      },
    })

    expect(config.profiles.web.plugins).toEqual([
      { id: 'session-persistence-sqlite', name: '@nomix-ai/nomix-session-persistence-sqlite' },
      { id: 'agent-loop', name: '@nomix-ai/nomix-agent-loop' },
      { id: 'llm-deepseek', name: '@nomix-ai/nomix-llm-deepseek', config: { apiKeyEnv: 'DEEPSEEK_API_KEY' } },
    ])
    expect(resolveProfile(config, 'web')).toEqual(config.profiles.web.plugins)
    expect(() => resolveProfile(config, 'missing')).toThrow('Nomix profile "missing" is not registered')
  })
})
