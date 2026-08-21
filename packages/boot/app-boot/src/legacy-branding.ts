/** Fail loudly when a pre-0.2 Nomix product name reaches the runtime. */

const OLD_PREFIX = 'D' + 'SH'
const OLD_SECTION = 'd' + 'sh'

/** Reject old Harness environment variables instead of silently ignoring them. */
export function rejectLegacyEnvironment(env: Record<string, string | undefined>): void {
  const legacy = Object.keys(env).filter(key => key === `${OLD_PREFIX}_HOME` || key.startsWith(`${OLD_PREFIX}_`)).sort()
  if (legacy.length === 0) return
  const replacements = legacy.map(key => `${key} -> NOMIX_${key.slice(OLD_PREFIX.length + 1)}`)
  throw new Error(`Nomix 0.2 does not accept legacy environment variables: ${replacements.join(', ')}`)
}

/** Reject the old package.json section with an actionable replacement. */
export function rejectLegacyManifestSection(manifest: Readonly<Record<string, unknown>>, path: string): void {
  if (!Object.hasOwn(manifest, OLD_SECTION)) return
  throw new Error(`${path} uses the legacy ${OLD_SECTION} manifest field; rename it to nomix`)
}
