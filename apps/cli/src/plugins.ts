/** Side-effect-free catalog of plugins compiled into the Nomix npm package. */

import { definePlugin, type PluginFactory } from './public-plugin.ts'

/** Create a descriptor for any built-in plugin id listed in the packaged manifest. */
export function builtin<Config = Record<string, unknown>>(id: string): PluginFactory<Config> {
  return definePlugin<Config>(id, `@nomix-ai/nomix-${id}`)
}

/** Frequently used built-ins with stable, typed discovery paths. */
export const builtins = {
  session: {
    sqlite: builtin('session-persistence-sqlite'),
    jsonl: builtin('session-persistence-jsonl'),
  },
  agent: {
    core: builtin('agent'),
    loop: builtin('agent-loop'),
  },
  web: {
    server: builtin('host-webserver'),
    app: builtin('web-app'),
    tool: builtin('tool-web'),
  },
  llm: {
    deepseek: builtin('llm-deepseek'),
    piAi: builtin('llm-pi-ai'),
  },
  workflow: {
    workerThread: builtin('workflow-worker-thread'),
    tool: builtin('tool-workflow'),
  },
  use: builtin,
} as const
