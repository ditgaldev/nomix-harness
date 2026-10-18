/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@nomix-ai/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('nomix-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      nomix?: { bundle?: { patch?: string } }
    }
    expect(manifest.nomix?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.nomix!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@nomix-ai/nomix-sdk-app'],
      ['sdk-jsonrpc-server', '@nomix-ai/nomix-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@nomix-ai/nomix-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@nomix-ai/nomix-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@nomix-ai/nomix-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@nomix-ai/nomix-llm-deepseek-api-key'],
      ['sandbox', '@nomix-ai/nomix-sandbox-local'],
      ['filesystem', '@nomix-ai/nomix-fs-local'],
      ['attachment-local', '@nomix-ai/nomix-attachment-local'],
      ['tool-fs', '@nomix-ai/nomix-tool-fs'],
      ['working-directory', '@nomix-ai/nomix-working-directory'],
      ['tool-working-directory', '@nomix-ai/nomix-tool-working-directory'],
      ['session-projection', '@nomix-ai/nomix-session-projection'],
      ['token-meter', '@nomix-ai/nomix-token-meter'],
      ['compaction-basic', '@nomix-ai/nomix-compaction-basic'],
      ['image-offload', '@nomix-ai/nomix-compaction-image-offload'],
      ['sandbox-policy', '@nomix-ai/nomix-sandbox-policy'],
      ['subprocess', '@nomix-ai/nomix-subprocess-local'],
      ['pty', '@nomix-ai/nomix-terminal'],
      ['terminal-bash', '@nomix-ai/nomix-terminal-bash'],
      ['terminal-pwsh', '@nomix-ai/nomix-terminal-bash'],
      ['timer', '@nomix-ai/cordis-plugin-timer'],
      ['llm', '@nomix-ai/nomix-llm'],
      ['session', '@nomix-ai/nomix-session'],
      ['session-title', '@nomix-ai/nomix-session-title'],
      ['system-prompt', '@nomix-ai/nomix-system-prompt'],
      ['tools', '@nomix-ai/nomix-tools'],
      ['mcp-resources', '@nomix-ai/nomix-mcp-resources'],
      ['agent', '@nomix-ai/nomix-agent'],
      ['llm-retry', '@nomix-ai/nomix-llm-retry'],
      ['jobs', '@nomix-ai/nomix-jobs-local'],
      ['agent-loop', '@nomix-ai/nomix-agent-loop'],
      ['persistent-bash', '@nomix-ai/nomix-tool-bash-persistent'],
      ['persistent-pwsh', '@nomix-ai/nomix-tool-pwsh-persistent'],
      ['sessions', '@nomix-ai/nomix-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-deepseek')?.config).toEqual({
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.NOMIX_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      personaPrefix: { __jsExpr: "process.env.NOMIX_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'tool-fs')?.config).toEqual({ read: false, readImage: true, write: false, edit: false })
    expect(rows.find(row => row.id === 'compaction-basic')?.config).toBeUndefined()
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
