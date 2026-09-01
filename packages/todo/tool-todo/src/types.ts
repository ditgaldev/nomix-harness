/**
 * Pure types of the todo domain: the ONE home of the `todos` projection-key
 * declaration plus its payload types, free of this package's host-side value
 * imports (nomix-tools, zod). Two namespace projections serve it — `./types`
 * for host consumers, `./client/types` (the browser half-entry's re-export)
 * for client aggregates — with zero content duplication.
 *
 * @module @nomix-ai/nomix-tool-todo/types
 */

import type { TodoItem } from '@nomix-ai/nomix-session/types'

export type { TodoItem } from '@nomix-ai/nomix-session/types'

declare module '@nomix-ai/nomix-session-projection/types' {
  interface SessionProjectionStateMap {
    todos: TodoItem[] | null
  }
  interface SessionProjectionMap {
    /**
     * The agent's current whole todo list (the latest `todo/write` snapshot),
     * or `null` before the first write. Whole-value rule: every `todo/write`
     * carries the complete replacement list, so the fold is last-wins.
     */
    todos: TodoItem[] | null
  }
}
