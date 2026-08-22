/**
 * Install a packed CLI without lifecycle scripts and execute its local bin through a supported
 * package manager in a throwaway consumer outside the repository.
 *
 * Every registry package the installed tree owns comes from `--from`. For the
 * nomix family that is one native ESM tarball whose dist tree already contains
 * the internal product runtime; verification therefore does not depend on
 * install scripts or internal package names existing in the registry
 * ([rationale](../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
 *
 * What this proves is that a supported package manager installs the entry with scripts disabled
 * and resolves its command. A workspace link or
 * stale `lib/` in the checkout cannot stand in for a missing file here.
 */

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { capture, isEntry, run } from './process.ts'
import { packedIdentity } from './tarball.ts'

/**
 * Environment for the installed artifact: no host Node hooks, no host Nomix home, and no ambient
 * package-manager user agent that would confuse the install.
 * @param consumerRoot - the throwaway consumer directory.
 * @returns The child environment.
 */
function consumerEnvironment(consumerRoot: string): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.npm_config_user_agent
  delete environment.NPM_CONFIG_USER_AGENT
  delete environment.NODE_OPTIONS
  delete environment.NODE_PATH
  environment.NOMIX_HOME = resolve(consumerRoot, '.nomix')
  environment.NOMIX_AGENTS_HOME = resolve(consumerRoot, '.agents')
  environment.NOMIX_TELEMETRY_DISABLED = '1'
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

type PackageManager = 'npm' | 'pnpm' | 'yarn'

function packageManager(value: string | undefined): PackageManager {
  if (value === undefined || value === 'npm') return 'npm'
  if (value === 'pnpm' || value === 'yarn') return value
  throw new Error(`unsupported package manager ${value}; expected npm, pnpm, or yarn`)
}

function install(manager: PackageManager, cwd: string, environment: NodeJS.ProcessEnv): void {
  if (manager === 'npm') {
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd, env: environment })
  } else if (manager === 'pnpm') {
    run('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], { cwd, env: environment })
  } else {
    run('corepack', ['yarn', 'install', '--mode=skip-build'], { cwd, env: environment })
  }
}

function execute(
  manager: PackageManager,
  command: string,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): string {
  if (manager === 'npm') return capture('npm', ['exec', '--offline', '--', command, ...args], { cwd, env: environment })
  if (manager === 'pnpm') return capture('pnpm', ['exec', command, ...args], { cwd, env: environment })
  return capture('corepack', ['yarn', 'exec', command, ...args], { cwd, env: environment })
}

/** Install every tarball under `--from` and drive the `--family` entry. */
function main(): void {
  const { values } = parseArgs({
    options: {
      family: { type: 'string' },
      from: { type: 'string', multiple: true },
      manager: { type: 'string' },
    },
    allowPositionals: false,
  })
  if (values.family === undefined || values.from === undefined || values.from.length === 0) {
    throw new Error('usage: verify-packed-install.ts --family <nomix|vendor> --from <packed directory> [--from ...]')
  }

  const manager = packageManager(values.manager)
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

  const consumerRoot = mkdtempSync(join(tmpdir(), `nomix-packed-${family.id}-`))
  try {
    writeFileSync(join(consumerRoot, 'package.json'), `${JSON.stringify({
      name: `nomix-packed-install-${family.id}`,
      version: '0.0.0',
      private: true,
      ...(manager === 'yarn' ? { packageManager: 'yarn@4.17.1' } : {}),
      dependencies: { [entry.packageName]: expected.url },
    }, null, 2)}\n`)

    const environment = consumerEnvironment(consumerRoot)
    console.log(`release verify-packed-install: installing ${expected.url} with ${manager} in ${consumerRoot}`)
    install(manager, consumerRoot, environment)
    console.log(`release verify-packed-install: executing installed ${entry.command} with ${manager} in ${consumerRoot}`)
    const version = execute(manager, entry.command, ['--version'], consumerRoot, environment)
    if (version !== expected.version) {
      throw new Error(`installed ${entry.packageName} --version reported ${JSON.stringify(version)}, expected ${expected.version}`)
    }
    console.log(`release verify-packed-install: installed ${entry.packageName} reports ${version}`)
    if (entry.smokeArgs !== undefined) {
      const output = execute(manager, entry.command, entry.smokeArgs, consumerRoot, environment)
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
