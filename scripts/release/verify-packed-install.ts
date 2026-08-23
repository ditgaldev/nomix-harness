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

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { releaseFamily } from './families.ts'
import { capture, commandInvocation, isEntry, run, type CommandInvocation } from './process.ts'
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
    run('corepack', ['yarn', 'install', '--no-immutable', '--mode=skip-build'], { cwd, env: environment })
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

function managerInvocation(manager: PackageManager, command: string, args: readonly string[], environment: NodeJS.ProcessEnv) {
  if (manager === 'npm') return commandInvocation('npm', ['exec', '--offline', '--', command, ...args], environment)
  if (manager === 'pnpm') return commandInvocation('pnpm', ['exec', command, ...args], environment)
  return commandInvocation('corepack', ['yarn', 'exec', command, ...args], environment)
}

function installedBinInvocation(
  packageName: string,
  command: string,
  args: readonly string[],
  cwd: string,
): CommandInvocation | undefined {
  const manifestPath = join(cwd, 'node_modules', packageName, 'package.json')
  if (!existsSync(manifestPath)) return undefined
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
  const declared = typeof manifest.bin === 'string'
    ? manifest.bin
    : manifest.bin !== null && typeof manifest.bin === 'object' && !Array.isArray(manifest.bin)
      ? (manifest.bin as Record<string, unknown>)[command]
      : undefined
  if (typeof declared !== 'string') {
    throw new Error(`installed ${packageName} does not declare the ${command} executable`)
  }
  return { command: process.execPath, args: [resolve(dirname(manifestPath), declared), ...args] }
}

/** Exercise the installed sandbox's private Windows runner lookup against the flattened kernel. */
function verifyNomixKernel(packageName: string, cwd: string, environment: NodeJS.ProcessEnv): void {
  const moduleUrl = pathToFileURL(join(
    cwd,
    'node_modules',
    packageName,
    'dist',
    'kernel',
    'sandbox-local',
    'lib',
    'index.js',
  )).href
  const probe = [
    'const { fileURLToPath } = await import("node:url")',
    'const loaded = await import(process.argv[1])',
    'const sandbox = Object.create(loaded.LocalSandboxProvider.prototype)',
    'sandbox.internals = {}',
    'const invocation = sandbox.windowsAclRunnerInvocation()',
    'const expected = fileURLToPath(new URL("../../sandbox-windows-acl/lib/runner.js", process.argv[1]))',
    'if (invocation[0] !== process.execPath) throw new Error(`unexpected runner executable: ${JSON.stringify(invocation)}`)',
    'if (invocation[1] !== expected) throw new Error(`unexpected runner entry: ${JSON.stringify(invocation)}, expected ${expected}`)',
  ].join(';')
  run(process.execPath, ['--input-type=module', '--eval', probe, moduleUrl], { cwd, env: environment })
}

/** Start an installed persistent application, require readiness, then stop it through its signal handler. */
function executeUntilOutput(
  manager: PackageManager,
  packageName: string,
  command: string,
  args: readonly string[],
  expectedOutput: string,
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolveStartup, rejectStartup) => {
    const direct = installedBinInvocation(packageName, command, args, cwd)
    const invocation = direct ?? managerInvocation(manager, command, args, environment)
    // Yarn PnP has no physical package directory, so its wrapper remains the
    // parent. A separate POSIX group lets readiness cleanup reach both it and
    // the CLI process it owns.
    const detached = direct === undefined && process.platform !== 'win32'
    const child = spawn(invocation.command, [...invocation.args], {
      cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached,
    })
    let stdout = ''
    let stderr = ''
    let ready = false
    const stop = (signal: NodeJS.Signals): void => {
      if (!detached || child.pid === undefined) {
        child.kill(signal)
        return
      }
      try {
        process.kill(-child.pid, signal)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      }
    }
    const timer = setTimeout(() => {
      stop('SIGKILL')
      rejectStartup(new Error(
        `installed ${command} did not print ${JSON.stringify(expectedOutput)} within 60s\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      ))
    }, 60_000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      if (!ready && stdout.includes(expectedOutput)) {
        ready = true
        stop('SIGTERM')
      }
    })
    child.stderr.on('data', (chunk: string) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      rejectStartup(error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (!ready) {
        rejectStartup(new Error(
          `installed ${command} exited before readiness with ${String(code ?? signal)}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ))
        return
      }
      if (code !== 0 && signal !== 'SIGTERM') {
        rejectStartup(new Error(
          `installed ${command} exited with ${String(code ?? signal)} after readiness\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ))
        return
      }
      resolveStartup()
    })
  })
}

/** Install every tarball under `--from` and drive the `--family` entry. */
async function main(): Promise<void> {
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
    if (manager === 'yarn') {
      // Cordis resolves configured plugins dynamically. Yarn's PnP resolver
      // attributes those imports to the loader package instead of the owning
      // application, so supported Yarn consumers use its node_modules linker.
      writeFileSync(join(consumerRoot, '.yarnrc.yml'), 'nodeLinker: node-modules\n')
    }

    const environment = consumerEnvironment(consumerRoot)
    console.log(`release verify-packed-install: installing ${expected.url} with ${manager} in ${consumerRoot}`)
    install(manager, consumerRoot, environment)
    console.log(`release verify-packed-install: executing installed ${entry.command} with ${manager} in ${consumerRoot}`)
    const version = execute(manager, entry.command, ['--version'], consumerRoot, environment)
    if (version !== expected.version) {
      throw new Error(`installed ${entry.packageName} --version reported ${JSON.stringify(version)}, expected ${expected.version}`)
    }
    console.log(`release verify-packed-install: installed ${entry.packageName} reports ${version}`)
    if (family.id === 'nomix') {
      verifyNomixKernel(entry.packageName, consumerRoot, environment)
      console.log(`release verify-packed-install: installed ${entry.packageName} kernel runner resolution passed`)
    }
    if (entry.smokeArgs !== undefined) {
      const output = execute(manager, entry.command, entry.smokeArgs, consumerRoot, environment)
      if (entry.smokeOutput !== undefined && !output.includes(entry.smokeOutput)) {
        throw new Error(
          `installed ${entry.packageName} smoke output omitted ${JSON.stringify(entry.smokeOutput)}: ${JSON.stringify(output)}`,
        )
      }
      console.log(`release verify-packed-install: installed ${entry.packageName} application smoke passed`)
    }
    if (entry.startupArgs !== undefined && entry.startupOutput !== undefined) {
      await executeUntilOutput(
        manager,
        entry.packageName,
        entry.command,
        entry.startupArgs,
        entry.startupOutput,
        consumerRoot,
        environment,
      )
      console.log(`release verify-packed-install: installed ${entry.packageName} reached application readiness`)
    }
  } finally {
    rmSync(consumerRoot, { recursive: true, force: true })
  }
}

if (isEntry(import.meta.url)) await main()
