import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@nomix-ai/cordis'
import type {} from '@nomix-ai/nomix-subagent'

export const name = 'subagent-settlement-marker'

/** Publish a workspace marker after a subagent lifecycle end. */
export function apply(ctx: Context): void {
  ctx.on('subagent/end', () => {
    writeFileSync(join(process.cwd(), '.nomix-snapshot-subagent-settled'), '')
  })
}
