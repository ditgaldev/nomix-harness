/**
 * Typed failures shared by subagent service and provider operations.
 *
 * @module @nomix-ai/nomix-subagent
 */

import { HarnessError } from '@nomix-ai/nomix-llm'

/** Typed failure for the subagent seam. */
export class SubagentError extends HarnessError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
    this.name = 'SubagentError'
  }
}
