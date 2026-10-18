/** Real Loader composition: the bridge mounted from a cordis.yml row beside the shipped core plugins. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@nomix-ai/cordis'
import Loader from '@nomix-ai/cordis-plugin-loader'
import Include from '@nomix-ai/cordis-plugin-include'
import AgentRegistry from '@nomix-ai/nomix-agent'
import AgentLoop from '@nomix-ai/nomix-agent-loop'
import CommandRuntime from '@nomix-ai/nomix-commands'
import LocalFileSystem from '@nomix-ai/nomix-fs-local'
import WorkingDirectory from '@nomix-ai/nomix-working-directory'
import LlmRuntime, { createUserMessage } from '@nomix-ai/nomix-llm'
import SessionStore, { SessionId } from '@nomix-ai/nomix-session'
import SessionProjectionRegistry from '@nomix-ai/nomix-session-projection'
import SystemPrompt from '@nomix-ai/nomix-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@nomix-ai/nomix-tools'
import * as ClaudeCodeMods from '../src/index.ts'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const FIXTURES = resolve(import.meta.dirname, 'fixtures')

let ctx: Context | undefined
let root: string | undefined

afterEach(async () => {
  await ctx?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  ctx = undefined
  root = undefined
})

it('loads from cordis.yml, counts the model\'s tool calls, and answers /tally through the composed command registry', async () => {
  root = await mkdtemp(join(tmpdir(), 'nomix-cc-mods-composition-'))
  const configPath = join(root, 'cordis.yml')
  const modules = new Map<string, unknown>([
    ['@nomix-ai/nomix-llm', LlmRuntime],
    ['@nomix-ai/nomix-session', SessionStore],
    ['@nomix-ai/nomix-session-projection', SessionProjectionRegistry],
    ['@nomix-ai/nomix-system-prompt', SystemPrompt],
    ['@nomix-ai/nomix-fs-local', LocalFileSystem],
    ['@nomix-ai/nomix-working-directory', WorkingDirectory],
    ['@nomix-ai/nomix-tools', ToolRuntime],
    ['@nomix-ai/nomix-agent', AgentRegistry],
    ['@nomix-ai/nomix-agent-loop', AgentLoop],
    ['@nomix-ai/nomix-commands', CommandRuntime],
    ['@nomix-ai/nomix-experimental-claude-code-mods', ClaudeCodeMods],
  ])
  // A mod is a plugin like any other: here the tutorial mod's `defineMod` wrapper, mounted by file URL after the bridge.
  const firstMod = pathToFileURL(resolve(FIXTURES, 'first-mod.ts')).href
  await writeFile(configPath, [
    ...[...modules.keys()].map(name => `- name: '${name}'`),
    `- name: '${firstMod}'`,
    '  config:',
    '    greeting: The model made',
  ].join('\n') + '\n')

  const context = ctx = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  // Without a Node internal loader the Loader imports bare names through this
  // test runner's module graph, which resolves workspace packages to `src`.
  context.loader.internal = undefined
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await context.loader.await()
  for (const entry of context.loader.entries()) await entry.fiber?.await()

  const adapter = new MockAdapter([toolCallResponse('c1', 'echo', { command: 'ls' }), textResponse('listed')])
  context.llm.registerAdapter(['mock'], adapter)
  context.tools.register(defineContentToolFixture({
    name: 'echo', description: 'echo', parameters: { command: { type: 'string' } },
    async execute(args) { return [{ type: 'text', text: `ran ${args.command}` }] },
  }))
  const agent = await context.agentLoop.create(SessionId('composed'), { provider: 'mock', model: 'mock' })
  expect(context.commands.list(agent).map(command => command.name)).toEqual(['tally'])
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'list the files here' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(adapter.requests).toHaveLength(2)
  const run = await context.commands.execute(agent, '/tally', [], new AbortController().signal)
  expect(run?.result).toEqual({ kind: 'success', text: 'first-mod: The model made 1 tool calls since this mod loaded' })
})
