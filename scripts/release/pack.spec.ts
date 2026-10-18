/** Real-pnpm regression coverage for release packing, selection, hooks, and payload checks. */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { officialClientBuildEnvironment, writeClientBuildRecord } from '../client-build-environment.ts'
import { runGate, type Gate } from '../run-gates.ts'
import { removeFixtureSafely } from '../test-fixture-cleanup.ts'
import { releaseFamily, tarballName } from './families.ts'
import { packedIdentity, PUBLISH_ORDER_FILE, readPublishOrder } from './tarball.ts'

const require = createRequire(import.meta.url)
const packScript = resolve(import.meta.dirname, 'pack.ts')
const tsxHook = pathToFileURL(require.resolve('tsx/esm')).href
const pnpmEntry = join(dirname(require.resolve('pnpm')), 'bin/pnpm.cjs')
const roots: string[] = []
const commit = 'abcdef0'

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'nomix-release-pack-'))
  roots.push(root)
  write(join(root, 'package.json'), JSON.stringify({ name: '@nomix-ai/pack-root', private: true, version: '1.2.3', type: 'module' }))
  write(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - vendor/*\n  - native/*\n  - packages/*/*\n  - apps/*\n')
  return root
}

function packageFixture(root: string, directory: string, name: string, additions: Record<string, unknown> = {}): void {
  write(join(root, directory, 'package.json'), JSON.stringify({
    name, version: '1.2.3', files: ['lib/index.js', 'hook.cjs'],
    scripts: {
      prepack: 'node hook.cjs prepack',
      prepare: 'node hook.cjs prepare',
      postpack: 'node hook.cjs postpack',
    },
    ...additions,
  }))
  write(join(root, directory, 'lib/index.js'), 'export const value = 1;\n')
  write(join(root, directory, 'hook.cjs'), [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const manifest = require('./package.json');",
    "fs.appendFileSync(path.join(process.env.NOMIX_PACK_FIXTURE, 'hooks.log'), `${manifest.name}:${process.argv[2]}\\n`);",
    '',
  ].join('\n'))
}

/** Exercise the real pack CLI and validators while replacing only the repository-wide artifact builder. */
function aggregateFixture(root: string, additions: { dependencies?: Record<string, string>; [key: string]: unknown } = {}): void {
  packageFixture(root, 'apps/cli', '@nomix-ai/nomix-harness')
  write(join(root, 'apps/web/dist/index.html'), '<main></main>')
  writeClientBuildRecord(root, officialClientBuildEnvironment(root, { NOMIX_CLIENT_COMMIT_HASH: commit }))
  const payloads: Record<string, string[]> = {
    '@nomix-ai/cordis': ['lib/index.js'],
    '@nomix-ai/nomix-agent': ['lib/index.js'],
    '@nomix-ai/nomix-web-app': ['cordis.patch.yml'],
    '@nomix-ai/nomix-web-frontend': ['dist/index.html'],
    '@nomix-ai/node-addon-system': ['lib/index.js'],
    ...Object.fromEntries(['linux-x64', 'linux-arm64'].map(platform => [
      `@nomix-ai/node-addon-system-${platform}`, ['bin/landlock-run', 'bin/glibc/system.node', 'bin/musl/system.node'],
    ])),
    ...Object.fromEntries(['darwin-x64', 'darwin-arm64'].map(platform => [
      `@nomix-ai/node-addon-system-${platform}`, ['bin/system.node'],
    ])),
  }
  const dependencies = Object.fromEntries(Object.keys(payloads).map(name => [name, '1.2.3']))
  write(join(root, 'aggregate/package.json'), JSON.stringify({
    name: '@nomix-ai/nomix-harness', version: '1.2.3', files: ['dist'],
    ...additions,
    dependencies: { ...dependencies, ...additions.dependencies },
    bundledDependencies: Object.keys(payloads),
  }))
  write(join(root, 'aggregate/dist/cli/bin.js'), 'console.log("fixture")\n')
  for (const [name, files] of Object.entries(payloads)) {
    write(join(root, 'aggregate/node_modules', name, 'package.json'), JSON.stringify({ name, version: '1.2.3' }))
    for (const file of files) write(join(root, 'aggregate/node_modules', name, file), 'fixture\n')
  }
  const builder = join(root, 'fixture-builder.ts')
  write(builder, [
    "import { cpSync } from 'node:fs'",
    "import { join } from 'node:path'",
    "export function buildNpmHarnessDistribution(destination) { cpSync(join(process.cwd(), 'aggregate'), destination, { recursive: true }) }",
    '',
  ].join('\n'))
  const source = readFileSync(packScript, 'utf8').replace(/from '(\.[^']+)'/g, (_match: string, specifier: string) =>
    `from '${pathToFileURL(specifier === '../npm-harness-distribution.ts' ? builder : resolve(dirname(packScript), specifier)).href}'`)
  write(join(root, 'pack-fixture.ts'), source)
}

function packGate(root: string, args: string[] = []): Gate {
  const cwd = join(root, 'fixture-cwd.mjs')
  write(cwd, 'process.chdir(process.env.NOMIX_PACK_FIXTURE)\n')
  return {
    id: 'release-pack-fixture',
    label: 'release pack fixture',
    displayCommand: 'node release pack fixture',
    command: process.execPath,
    args: ['--import', tsxHook, '--import', pathToFileURL(cwd).href,
      existsSync(join(root, 'pack-fixture.ts')) ? join(root, 'pack-fixture.ts') : packScript,
      '--family', 'vendor', '--out', 'packed', ...args],
    env: { npm_execpath: pnpmEntry, npm_config_cache: join(root, '.npm-cache'), NOMIX_PACK_FIXTURE: root, NOMIX_CLIENT_COMMIT_HASH: commit },
  }
}

async function runPack(root: string, args: string[] = []) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 90_000)
  try {
    const result = await runGate(packGate(root, args), controller.signal)
    expect(result.error).toBeUndefined()
    expect(result.aborted).toBe(false)
    expect(result.signalCode).toBeNull()
    return {
      status: result.exitCode,
      stderr: result.output.filter(chunk => chunk.stream === 'stderr').map(chunk => chunk.text).join(''),
    }
  } finally {
    clearTimeout(timer)
  }
}

function stopped(pid: number): boolean {
  if (process.platform === 'linux') {
    try {
      return /\)\s+Z\s/.test(readFileSync(`/proc/${pid}/stat`, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
      throw error
    }
  }
  try {
    process.kill(pid, 0)
    return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
    throw error
  }
}

function readyHookPids(root: string): number[] {
  const ready: unknown = JSON.parse(readFileSync(join(root, 'hook-ready.json'), 'utf8'))
  if (ready === null || typeof ready !== 'object' || !('hook' in ready) || !('child' in ready)
    || typeof ready.hook !== 'number' || !Number.isSafeInteger(ready.hook) || ready.hook < 1
    || typeof ready.child !== 'number' || !Number.isSafeInteger(ready.child) || ready.child < 1) {
    throw new Error('pack fixture hook readiness requires positive process ids')
  }
  return [ready.hook, ready.child]
}

afterEach(() => {
  for (const root of roots.splice(0)) removeFixtureSafely(root)
})

describe('release pack CLI', () => {
  it.each([undefined, '1', '2'])('packs only public family members and records their publish order (concurrency=%s)', async (concurrency) => {
    const root = fixture()
    // Publication places zebra before alpha; pnpm's workspace dev edge points in the opposite direction.
    packageFixture(root, 'vendor/alpha', '@nomix-ai/alpha', { peerDependencies: { '@nomix-ai/zebra': '*' } })
    packageFixture(root, 'vendor/zebra', '@nomix-ai/zebra', { devDependencies: { '@nomix-ai/alpha': 'workspace:*' } })
    write(join(root, 'vendor/zebra/node_modules/@nomix-ai/alpha/package.json'), JSON.stringify({ name: '@nomix-ai/alpha', version: '1.2.3' }))
    packageFixture(root, 'vendor/private', '@nomix-ai/private', { private: true })
    packageFixture(root, 'native/unselected', '@nomix-ai/unselected')
    const family = releaseFamily('vendor')
    const members = family.publishOrder(family.members(root)).order
    const expectedOrder = members.map(tarballName)

    const result = await runPack(root, concurrency === undefined ? [] : ['--concurrency', concurrency])

    expect(result.status, result.stderr).toBe(0)
    expect(readPublishOrder(join(root, 'packed'))).toEqual(expectedOrder)
    expect(readdirSync(join(root, 'packed')).sort()).toEqual([...expectedOrder, PUBLISH_ORDER_FILE].sort())
    for (const member of members) {
      expect(packedIdentity(join(root, 'packed', tarballName(member))))
        .toEqual({ name: member.name, version: member.version })
    }
    const hooks = readFileSync(join(root, 'hooks.log'), 'utf8').trim().split('\n')
    const expectedHooks = members.flatMap(member => ['prepack', 'prepare', 'postpack'].map(phase => `${member.name}:${phase}`))
    expect([...hooks].sort()).toEqual([...expectedHooks].sort())
    if (concurrency !== '2') expect(hooks).toEqual(expectedHooks)
  }, 120_000)

  it('overlaps two independent packs and keeps later packages within the concurrency limit', async () => {
    const root = fixture()
    const names = ['alpha', 'bravo', 'charlie'].map(name => `@nomix-ai/${name}`)
    for (const name of names) {
      const directory = `vendor/${name.slice('@nomix-ai/'.length)}`
      packageFixture(root, directory, name, {
        scripts: { prepack: 'node hook.cjs start', postpack: 'node hook.cjs finish' },
      })
      write(join(root, directory, 'hook.cjs'), [
        "const { get } = require('node:http');",
        "const { name } = require('./package.json');",
        'const url = `${process.env.NOMIX_PACK_COORDINATOR}/${process.argv[2]}?name=${encodeURIComponent(name)}&pid=${process.pid}`;',
        'const request = get(url, { agent: false }, response => {',
        '  response.resume();',
        "  response.on('end', () => { if (response.statusCode !== 200) process.exitCode = 1; });",
        '});',
        "request.on('error', error => { console.error(error); process.exitCode = 1; });",
        '',
      ].join('\n'))
    }

    const active = new Set<string>()
    const waiting = new Map<string, ServerResponse>()
    const started: string[] = []
    const completed: string[] = []
    const pids = new Set<number>()
    const errors: string[] = []
    let maximumActive = 0
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const name = url.searchParams.get('name') ?? ''
      const pid = Number(url.searchParams.get('pid'))
      if (!names.includes(name) || !Number.isSafeInteger(pid) || pid < 1
        || (url.pathname !== '/start' && url.pathname !== '/finish')) {
        errors.push(`unexpected hook request ${request.url ?? ''}`)
        response.writeHead(400).end()
        return
      }
      pids.add(pid)
      if (url.pathname === '/start') {
        if (active.has(name)) errors.push(`${name} started twice`)
        started.push(name)
        active.add(name)
        maximumActive = Math.max(maximumActive, active.size)
        waiting.set(name, response)
      } else {
        if (!active.delete(name)) errors.push(`${name} finished without starting`)
        completed.push(name)
        response.end()
      }
    })
    const release = (name: string | undefined): void => {
      const response = name === undefined ? undefined : waiting.get(name)
      if (name === undefined || response === undefined) throw new Error('pack hook has not reached its barrier')
      waiting.delete(name)
      response.end()
    }
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, 90_000)
    let pending: ReturnType<typeof runGate> | undefined
    try {
      await new Promise<void>((resolveListen, rejectListen) => {
        server.once('error', rejectListen)
        server.listen(0, '127.0.0.1', () => {
          server.off('error', rejectListen)
          resolveListen()
        })
      })
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('pack coordinator has no TCP address')
      const gate = packGate(root, ['--concurrency', '2'])
      gate.env = { ...gate.env, NOMIX_PACK_COORDINATOR: `http://127.0.0.1:${address.port}` }
      pending = runGate(gate, controller.signal)

      await vi.waitFor(() => { expect(started).toHaveLength(2) }, { timeout: 30_000, interval: 25 })
      expect(active.size).toBe(2)
      expect([...pids].every(pid => !stopped(pid))).toBe(true)
      expect(completed).toEqual([])
      release(started[0])

      await vi.waitFor(() => { expect(started).toHaveLength(3) }, { timeout: 30_000, interval: 25 })
      expect(completed).toEqual([started[0]])
      expect(active.size).toBe(2)
      expect(maximumActive).toBe(2)
      release(started[1])
      release(started[2])

      const result = await pending
      expect(result.error).toBeUndefined()
      expect(result.aborted).toBe(false)
      expect(result.signalCode).toBeNull()
      expect(result.exitCode, result.output.map(chunk => chunk.text).join('')).toBe(0)
      expect(errors).toEqual([])
      expect([...started].sort()).toEqual(names)
      expect([...completed].sort()).toEqual(names)
      expect(active.size).toBe(0)
      expect(maximumActive).toBe(2)
      await vi.waitFor(() => { expect([...pids].every(stopped)).toBe(true) }, { timeout: 10_000, interval: 25 })
      expect(readPublishOrder(join(root, 'packed'))).toHaveLength(3)
    } finally {
      clearTimeout(timer)
      controller.abort()
      try {
        await pending
      } finally {
        if (server.listening) {
          const closed = new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              if (error === undefined) resolveClose()
              else rejectClose(error)
            })
          })
          server.closeAllConnections()
          await closed
        }
      }
    }
  }, 120_000)

  it('does not broaden an empty parallel family to the whole workspace', async () => {
    const root = fixture()
    packageFixture(root, 'vendor/private', '@nomix-ai/private', { private: true })
    packageFixture(root, 'native/unselected', '@nomix-ai/unselected')

    const result = await runPack(root, ['--concurrency', '8'])

    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(root, 'packed', PUBLISH_ORDER_FILE), 'utf8')).toBe('\n')
    expect(readdirSync(join(root, 'packed'))).toEqual([PUBLISH_ORDER_FILE])
    expect(existsSync(join(root, 'hooks.log'))).toBe(false)
  }, 120_000)

  it('leaves no publish order after a pack hook fails', async () => {
    const root = fixture()
    packageFixture(root, 'vendor/failing', '@nomix-ai/failing', { scripts: { prepack: 'node failing.cjs' } })
    write(join(root, 'vendor/failing/failing.cjs'), "throw new Error('pack fixture failure')\n")

    const result = await runPack(root, ['--concurrency', '8'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('pack fixture failure')
    expect(existsSync(join(root, 'packed', PUBLISH_ORDER_FILE))).toBe(false)
  }, 120_000)

  it('rejects a successful command that did not produce the expected member tarball', async () => {
    const root = fixture()
    packageFixture(root, 'vendor/expected', '@nomix-ai/expected', { scripts: { prepack: 'node rename.cjs' } })
    write(join(root, 'vendor/expected/rename.cjs'), [
      "const fs = require('node:fs');",
      "const manifest = require('./package.json');",
      "manifest.name = '@nomix-ai/renamed';",
      "fs.writeFileSync('package.json', JSON.stringify(manifest));",
      '',
    ].join('\n'))

    const result = await runPack(root, ['--concurrency', '8'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('@nomix-ai/expected produced no tarball')
    expect(existsSync(join(root, 'packed', 'nomix-ai-renamed-1.2.3.tgz'))).toBe(true)
    expect(existsSync(join(root, 'packed', PUBLISH_ORDER_FILE))).toBe(false)
  }, 120_000)

  it('validates the aggregate tarball before recording the publish order', async () => {
    const root = fixture()
    aggregateFixture(root, { files: ['dist', 'src'] })
    write(join(root, 'aggregate/src/index.ts'), 'export const source = 1\n')

    const result = await runPack(root, ['--family', 'nomix', '--concurrency', '8'])

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('@nomix-ai/nomix-harness publishes source file package/src/index.ts')
    expect(readdirSync(join(root, 'packed')).filter(name => name.endsWith('.tgz'))).toHaveLength(1)
    expect(existsSync(join(root, 'packed', PUBLISH_ORDER_FILE))).toBe(false)
  }, 120_000)

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'])(
    'rejects nonexact NOMIX %s in the produced tarball before recording publication', async (section) => {
      const root = fixture()
      aggregateFixture(root, { [section]: { '@nomix-ai/nomix-library': '^1.2.3' } })
      const result = await runPack(root, ['--family', 'nomix'])
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(`packed ${section}.@nomix-ai/nomix-library must equal 1.2.3`)
      expect(existsSync(join(root, 'packed', PUBLISH_ORDER_FILE))).toBe(false)
    }, 120_000,
  )

  it('stops the ready pack hook and its stalled descendant before fixture cleanup', async () => {
    const root = fixture()
    packageFixture(root, 'vendor/stalled', '@nomix-ai/stalled', { scripts: { prepack: 'node stalled.cjs' } })
    write(join(root, 'vendor/stalled/stalled.cjs'), [
      "const { spawn } = require('node:child_process');",
      "spawn(process.execPath, ['descendant.cjs'], { stdio: 'inherit' });",
      '',
    ].join('\n'))
    write(join(root, 'vendor/stalled/descendant.cjs'), [
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      "process.on('SIGTERM', () => {});",
      'setInterval(() => {}, 1000);',
      "fs.writeFileSync(path.join(process.env.NOMIX_PACK_FIXTURE, 'hook-ready.json'), JSON.stringify({ hook: process.ppid, child: process.pid }));",
      '',
    ].join('\n'))
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, 90_000)
    const pending = runGate(packGate(root, ['--concurrency', '8']), controller.signal)
    try {
      let pids: number[] = []
      await vi.waitFor(() => {
        pids = readyHookPids(root)
        expect(pids.every(pid => !stopped(pid))).toBe(true)
      }, { timeout: 30_000, interval: 25 })

      controller.abort()
      const result = await pending

      expect(result.aborted).toBe(true)
      expect(result.status).toBe('failed')
      await vi.waitFor(() => { expect(pids.every(stopped)).toBe(true) }, { timeout: 10_000, interval: 25 })
      expect(existsSync(join(root, 'packed', PUBLISH_ORDER_FILE))).toBe(false)
    } finally {
      clearTimeout(timer)
      controller.abort()
      await pending
    }
  }, 120_000)
})
