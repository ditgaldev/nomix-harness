/**
 * Execute a packed CLI through npm exec in a throwaway consumer outside the
 * repository.
 *
 * Every registry package the installed tree owns comes from `--from`. For the
 * dsh family that is one portable CLI tarball whose bundled production tree
 * restores the product and vendored workspace packages from its compressed
 * runtime during installation; verification therefore does not depend on
 * those internal package names existing in the registry
 * ([rationale](../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
 *
 * What this proves is that the npx/npm-exec entry installs, its lifecycle
 * restores the compressed runtime, and its command starts. A workspace link or
 * stale `lib/` in the checkout cannot stand in for a missing file here.
 */

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { capture, isEntry } from './process.ts'
import { packedIdentity } from './tarball.ts'

/**
 * Environment for the installed artifact: no host Node hooks, no host DeepSeek
 * Harness home, and no ambient npm user agent that would confuse npm.
 * @param consumerRoot - the throwaway consumer directory.
 * @returns The child environment.
 */
function consumerEnvironment(consumerRoot: string): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.npm_config_user_agent
  delete environment.NPM_CONFIG_USER_AGENT
  delete environment.NODE_OPTIONS
  delete environment.NODE_PATH
  environment.DSH_HOME = resolve(consumerRoot, '.dsh')
  environment.DSH_AGENTS_HOME = resolve(consumerRoot, '.agents')
  environment.DSH_TELEMETRY_DISABLED = '1'
  environment.NPM_CONFIG_OMIT = 'optional'
  return environment
}

/**
 * Every packed tarball in the given directories, as `file:` dependency entries.
 *
 * The directories are read by their contents rather than a pack order file: a
 * directory here can hold tarballs packed only to satisfy a cross-sequence
 * dependency, which no release order describes.
 * @param directories - absolute directories holding packed tarballs.
 * @returns Package name to tarball file URL, and the version each carries.
 */
function packedDependencies(directories: readonly string[]): Map<string, { url: string; version: string }> {
  const dependencies = new Map<string, { url: string; version: string }>()
  for (const directory of directories) {
    const tarballs = readdirSync(directory).filter(name => name.endsWith('.tgz')).sort()
    if (tarballs.length === 0) throw new Error(`${directory} holds no packed tarball`)
    for (const filename of tarballs) {
      const tarball = join(directory, filename)
      const { name, version } = packedIdentity(tarball)
      dependencies.set(name, { url: pathToFileURL(tarball).href, version })
    }
  }
  return dependencies
}

/** Install every tarball under `--from` and drive the `--family` entry. */
function main(): void {
  const { values } = parseArgs({
    options: { family: { type: 'string' }, from: { type: 'string', multiple: true } },
    allowPositionals: false,
  })
  if (values.family === undefined || values.from === undefined || values.from.length === 0) {
    throw new Error('usage: verify-packed-install.ts --family <dsh|vendor> --from <packed directory> [--from ...]')
  }

  const family = releaseFamily(values.family)
  const entry = family.installedEntry
  if (entry === undefined) {
    console.log(`release verify-packed-install: family ${family.id} publishes no executable, nothing to drive`)
    return
  }

  const root = process.cwd()
  const packed = packedDependencies(values.from.map(directory => resolve(root, directory)))
  const expected = packed.get(entry.packageName)
  if (expected === undefined) throw new Error(`${entry.packageName} is not among the packed tarballs`)

  const consumerRoot = mkdtempSync(join(tmpdir(), `dsh-packed-${family.id}-`))
  try {
    writeFileSync(join(consumerRoot, 'package.json'), `${JSON.stringify({
      name: `dsh-packed-install-${family.id}`,
      version: '0.0.0',
      private: true,
    }, null, 2)}\n`)

    const environment = consumerEnvironment(consumerRoot)
    console.log(`release verify-packed-install: executing ${entry.command} from ${expected.url} in ${consumerRoot}`)
    const version = capture('npm', [
      'exec',
      '--yes',
      `--package=${expected.url}`,
      '--',
      entry.command,
      '--version',
    ], { cwd: consumerRoot, env: environment })
    if (version !== expected.version) {
      throw new Error(`installed ${entry.packageName} --version reported ${JSON.stringify(version)}, expected ${expected.version}`)
    }
    console.log(`release verify-packed-install: installed ${entry.packageName} reports ${version}`)
    if (entry.smokeArgs !== undefined) {
      const output = capture('npm', [
        'exec',
        '--yes',
        `--package=${expected.url}`,
        '--',
        entry.command,
        ...entry.smokeArgs,
      ], { cwd: consumerRoot, env: environment })
      if (entry.smokeOutput !== undefined && !output.includes(entry.smokeOutput)) {
        throw new Error(
          `installed ${entry.packageName} smoke output omitted ${JSON.stringify(entry.smokeOutput)}: ${JSON.stringify(output)}`,
        )
      }
      console.log(`release verify-packed-install: installed ${entry.packageName} application smoke passed`)
    }
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true })
  }
}

if (isEntry(import.meta.url)) main()
