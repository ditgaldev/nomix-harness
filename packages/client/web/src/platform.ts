/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * @module @nomix-ai/nomix-client-web/src/platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@nomix-ai/cordis',
  '@nomix-ai/nomix-client-ui-slots',
  '@nomix-ai/nomix-client-web-react',
  '@nomix-ai/nomix-client-ui-primitives',
  '@nomix-ai/nomix-client-ui-attachment',
  '@nomix-ai/nomix-client-schema-form',
] as const

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
