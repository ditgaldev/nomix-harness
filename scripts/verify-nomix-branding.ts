/** Verify that active repository files use only the Nomix product brand. */

import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

/** One forbidden product-brand spelling. */
export interface BrandingViolation {
  /** Repository-relative path. */
  readonly path: string
  /** One-based line number, or zero for a path-name violation. */
  readonly line: number
  /** Stable rule label. */
  readonly rule: string
}

const LEGACY_PREFIX = 'D' + 'SH'
const LEGACY_LOWER = 'd' + 'sh'
const LEGACY_PRODUCT = 'Deep' + 'Seek Harness'
const LEGACY_DISTRIBUTION = 'deepseek' + '-harness'

const RULES = [
  { rule: 'legacy product name', pattern: LEGACY_PRODUCT },
  { rule: 'legacy distribution name', pattern: LEGACY_DISTRIBUTION },
  { rule: 'legacy environment variable', pattern: `${LEGACY_PREFIX}_` },
  { rule: 'legacy boot marker', pattern: `__${LEGACY_PREFIX}_` },
  { rule: 'legacy manifest field', pattern: `${LEGACY_LOWER}.` },
  { rule: 'legacy home directory', pattern: `~/.${LEGACY_LOWER}` },
  { rule: 'legacy maintenance prefix', pattern: `${LEGACY_LOWER}-` },
  { rule: 'legacy attribution', pattern: `powered by ${LEGACY_LOWER}` },
] as const

/** Paths whose old spellings are immutable or intentionally exercise rejection. */
function isAllowed(path: string): boolean {
  return path.startsWith('vendor/')
    || path.startsWith('.agents/notes/archived/')
    || path === 'scripts/verify-nomix-branding.ts'
    || path === 'scripts/verify-nomix-branding.spec.ts'
    || path === 'packages/boot/app-boot/src/legacy-branding.ts'
    || path === 'packages/boot/app-boot/tests/legacy-branding.spec.ts'
    || path === 'docs/user/migrating-to-nomix-0.2.md'
    || path === 'docs/user/migrating-to-nomix-0.2.zh.md'
    || /(?:^|\/)LICEN[CS]E(?:\.|$)/i.test(path)
}

/** Scan tracked paths and text for forbidden product spellings. */
export function scanNomixBranding(paths: readonly string[]): BrandingViolation[] {
  const violations: BrandingViolation[] = []
  for (const path of paths) {
    const normalized = path.replaceAll('\\', '/')
    if (isAllowed(normalized)) continue
    try {
      statSync(normalized)
    } catch {
      continue
    }
    const pathLower = normalized.toLowerCase()
    if (pathLower.includes(`${LEGACY_LOWER}-`) || pathLower.includes(LEGACY_DISTRIBUTION)) {
      violations.push({ path: normalized, line: 0, rule: 'legacy path name' })
    }
    let contents: string
    try {
      contents = readFileSync(normalized, 'utf8')
    } catch {
      continue
    }
    for (const [index, line] of contents.split(/\r?\n/u).entries()) {
      for (const { rule, pattern } of RULES) {
        if (line.includes(pattern)) violations.push({ path: normalized, line: index + 1, rule })
      }
    }
  }
  return violations
}

/** Read the tracked file list without traversing generated or ignored files. */
function trackedFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'git ls-files failed')
  return result.stdout.split(/\r?\n/u).filter(Boolean)
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/verify-nomix-branding.ts')) {
  const violations = scanNomixBranding(trackedFiles())
  if (violations.length > 0) {
    for (const violation of violations) {
      const location = violation.line === 0 ? violation.path : `${violation.path}:${String(violation.line)}`
      console.error(`${location}: ${violation.rule}`)
    }
    process.exitCode = 1
  } else {
    console.log('Nomix branding verified.')
  }
}
