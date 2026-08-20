/**
 * Publish one packed release family from the tarballs the pack step produced.
 *
 * Publication is decided per package against the registry, never from a list of
 * "what this release includes": a version the registry lacks is published, a
 * version whose published tarball has the same integrity is skipped, and a
 * version whose published tarball differs fails the run — that last case means
 * the content changed without a version bump
 * ([rationale](../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
 *
 * Skipping on identical integrity is what makes re-running the publish step over
 * the same artifact safe.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { attempt, attemptEchoed, isEntry } from './process.ts'
import { packedIdentity, readPublishOrder } from './tarball.ts'

/**
 * Registry codes that answer a write which did not settle, rather than a
 * rejection of what was sent. `E409 Failed to save packument` is the one this
 * sequence actually hits: publishing several packages in a row can outrun the
 * registry's own processing. A rejected payload (`E403` over an existing
 * version, a malformed manifest) never clears on a retry and must surface.
 */
const TRANSIENT_PUBLISH_CODES = ['E409', 'E429', 'E500', 'E502', 'E503', 'E504', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'] as const

/** Rate-limit policy for one publication run. */
export interface PublishPolicy {
  /** Maximum write attempts for one tarball. */
  readonly attempts: number
  /** Minimum delay between successful package writes. */
  readonly spacingMs: number
  /** Delay before the first retry; later retries use exponential backoff. */
  readonly retryBaseMs: number
  /** Upper bound for one retry delay. */
  readonly retryMaxMs: number
}

/** Read one positive integer from the release environment. */
function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer, got ${JSON.stringify(raw)}`)
  return parsed
}

/**
 * Resolve npm publication pacing from the environment.
 * @param env - release-process environment.
 * @returns Validated retry and spacing values.
 */
export function resolvePublishPolicy(env: NodeJS.ProcessEnv = process.env): PublishPolicy {
  const retryBaseMs = positiveInteger(env, 'NOMIX_NPM_PUBLISH_RETRY_BASE_MS', 30_000)
  const retryMaxMs = positiveInteger(env, 'NOMIX_NPM_PUBLISH_RETRY_MAX_MS', 300_000)
  if (retryMaxMs < retryBaseMs) {
    throw new Error('NOMIX_NPM_PUBLISH_RETRY_MAX_MS must be greater than or equal to NOMIX_NPM_PUBLISH_RETRY_BASE_MS')
  }
  return {
    attempts: positiveInteger(env, 'NOMIX_NPM_PUBLISH_ATTEMPTS', 6),
    spacingMs: positiveInteger(env, 'NOMIX_NPM_PUBLISH_SPACING_MS', 10_000),
    retryBaseMs,
    retryMaxMs,
  }
}

/** What the registry knows about one version. */
type RegistryState =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present'; readonly integrity: string }

/**
 * Whether a failed publish is worth another attempt.
 * @param output - combined npm output.
 * @returns True when the registry reported a write it did not commit.
 */
function isTransientFailure(output: string): boolean {
  return TRANSIENT_PUBLISH_CODES.some(code => output.includes(`code ${code}`))
}

/**
 * The subresource integrity string npm records for a tarball.
 * @param tarball - absolute tarball path.
 * @returns A `sha512-<base64>` string.
 */
function integrityOf(tarball: string): string {
  return `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
}

/**
 * Ask the registry whether a version exists, and with what integrity.
 * @param name - package name.
 * @param version - package version.
 * @param policy - retry policy for throttled registry reads.
 * @returns The registry state for that version.
 */
async function registryState(name: string, version: string, policy: PublishPolicy): Promise<RegistryState> {
  for (let tries = 1; tries <= policy.attempts; tries += 1) {
    const result = attempt('npm', ['view', `${name}@${version}`, 'dist.integrity', '--json'])
    if (result.status === 0) {
      const parsed: unknown = JSON.parse(result.stdout)
      if (typeof parsed !== 'string' || parsed === '') {
        throw new Error(`registry reported no dist.integrity for ${name}@${version}`)
      }
      return { kind: 'present', integrity: parsed }
    }
    const output = `${result.stdout}${result.stderr}`
    if (output.includes('E404') || output.includes('404 Not Found')) return { kind: 'absent' }
    if (tries === policy.attempts || !isTransientFailure(output)) {
      throw new Error(`npm view ${name}@${version} failed:\n${output}`)
    }
    const backoff = Math.min(policy.retryMaxMs, policy.retryBaseMs * 2 ** (tries - 1))
    console.log(
      `release publish: registry query for ${name}@${version} was throttled or unavailable`
      + ` (attempt ${String(tries)} of ${String(policy.attempts)}), retrying in ${String(backoff)}ms`,
    )
    await sleep(backoff)
  }
  throw new Error(`registry query for ${name}@${version} exhausted its attempts`)
}

/**
 * Publish one tarball, retrying a registry write that did not settle.
 *
 * Every retry re-reads the registry first, because `E409` can answer a write
 * that landed anyway: republishing a version that now exists fails permanently,
 * so the same integrity appearing under the failed attempt counts as success.
 * @param tarball - absolute tarball path.
 * @param name - package name the tarball declares.
 * @param version - package version the tarball declares.
 * @param policy - spacing and retry policy for registry writes.
 */
async function publishTarball(
  tarball: string,
  name: string,
  version: string,
  policy: PublishPolicy,
): Promise<void> {
  // A prerelease version never takes the latest dist-tag.
  const tagArgs = version.includes('-') ? ['--tag', 'next'] : []
  for (let tries = 1; tries <= policy.attempts; tries += 1) {
    // No --access: the sequences do not share one access level, so a
    // command-line flag could not serve both and would override the manifest
    // that does. Each packed manifest decides, and
    // check-workspace-constraints holds every manifest to its sequence's level.
    const result = attemptEchoed('npm', ['publish', tarball, ...tagArgs])
    const output = `${result.stdout}${result.stderr}`
    if (result.status === 0) return

    const settled = await registryState(name, version, policy)
    if (settled.kind === 'present' && settled.integrity === integrityOf(tarball)) {
      console.log(`release publish: ${name}@${version} landed despite a reported failure, continuing`)
      return
    }
    if (tries === policy.attempts || !isTransientFailure(output)) {
      throw new Error(`npm publish ${name}@${version} failed:\n${output}`)
    }
    const backoff = Math.min(policy.retryMaxMs, policy.retryBaseMs * 2 ** (tries - 1))
    console.log(
      `release publish: ${name}@${version} hit a transient registry failure`
      + ` (attempt ${String(tries)} of ${String(policy.attempts)}), retrying in ${String(backoff)}ms`,
    )
    await sleep(backoff)
  }
}

/** Publish the family named by `--family` from the directory named by `--from`. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { family: { type: 'string' }, from: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.family === undefined || values.from === undefined) {
    throw new Error('usage: publish.ts --family <dsh|vendor> --from <packed directory>')
  }

  const family = releaseFamily(values.family)
  const directory = resolve(process.cwd(), values.from)
  const policy = resolvePublishPolicy()

  // Every entry in the order settles as either published or already present, so
  // one counter answers "how far along is this run" for whoever is watching a
  // release that takes minutes per family.
  const order = readPublishOrder(directory)
  const total = String(order.length)
  let published = 0
  let skipped = 0
  console.log(
    `release publish: policy ${String(policy.spacingMs)}ms spacing, ${String(policy.attempts)} attempts,`
    + ` ${String(policy.retryBaseMs)}-${String(policy.retryMaxMs)}ms retry backoff`,
  )
  for (const [index, filename] of order.entries()) {
    const progress = `[${String(index + 1)}/${total}]`
    const tarball = join(directory, filename)
    const { name, version } = packedIdentity(tarball)
    const state = await registryState(name, version, policy)
    if (state.kind === 'present') {
      const local = integrityOf(tarball)
      if (state.integrity !== local) {
        throw new Error(
          `${name}@${version} is already published with different content`
          + `\n  registry: ${state.integrity}\n  packed:   ${local}`
          + '\nBump the version, or investigate why the build is not reproducible.',
        )
      }
      console.log(`release publish: ${progress} ${name}@${version} already published, skipping`)
      skipped += 1
      continue
    }
    // Space out the writes: the gap belongs between publishes, so a run that
    // only skips does not wait at all.
    if (published > 0) await sleep(policy.spacingMs)
    await publishTarball(tarball, name, version, policy)
    console.log(`release publish: ${progress} ${name}@${version} published`)
    published += 1
  }

  console.log(
    `release publish: family ${family.id}, ${total} member(s),`
    + ` ${String(published)} published, ${String(skipped)} already present`,
  )
}

if (isEntry(import.meta.url)) await main()
