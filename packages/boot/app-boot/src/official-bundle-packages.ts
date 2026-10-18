/** Package admission shared by offline catalog generation and release ordering. */

/**
 * The bundles the nomix installation ships for a person to switch on: each a
 * runtime dependency of the installation that declares `nomix.bundle.patch`,
 * an `icon`, and `./locale/*.json` display metadata, selected by no shipped
 * template, and offered switched off by the plugin manager
 * ([rationale](../../../../.agents/notes/implemented/process/2026-09-15-shipped-optional-bundles.md),
 * [admission](../../../../.agents/notes/implemented/architecture/2026-09-21-experimental-capabilities-as-optional-bundles.md)).
 */
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@nomix-ai/nomix-experimental-session-search',
  '@nomix-ai/nomix-experimental-ralph-bundle',
  '@nomix-ai/nomix-experimental-terminal-bundle',
  '@nomix-ai/nomix-experimental-badge-skill-bundle',
  '@nomix-ai/nomix-experimental-session-titles-bundle',
  '@nomix-ai/nomix-experimental-agent-team-profile',
  '@nomix-ai/nomix-experimental-voice-input-bundle',
  '@nomix-ai/nomix-experimental-cot-translation-bundle',
  '@nomix-ai/nomix-experimental-auto-review',
  '@nomix-ai/nomix-experimental-inspector-profile',
  '@nomix-ai/nomix-experimental-plugin-market-bundle',
  '@nomix-ai/nomix-experimental-tool-worktree',
]

/** Public NOMIX release members available through the ordinary on-demand bundle installer. */
export const ON_DEMAND_BUNDLES: readonly string[] = [
  '@nomix-ai/nomix-subagent-claude-code',
  '@nomix-ai/nomix-subagent-codex',
]
