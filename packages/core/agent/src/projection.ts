import type { TurnBoundaryProjection } from './types.ts'
import type {} from '@nomix-ai/nomix-session-projection'

declare module '@nomix-ai/nomix-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The agent session's open/last turn and step boundary facts (whole value). */
    turnBoundary: TurnBoundaryProjection
  }
}

export {}
