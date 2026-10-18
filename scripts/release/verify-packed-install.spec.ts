/** Dependency-free packed-install startup and npm cache ownership through the real verifier entry. */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const roots: string[] = []

afterEach(() => {
  for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true })
})

it('starts the real packed-install verifier and checks isolation without workspace dependencies', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nomix-packed-clean-'))
  roots.push(directory)
  for (const source of ['scripts', 'packages/boot/app-boot/src']) {
    cpSync(join(root, source), join(directory, source), { recursive: true })
  }
  writeFileSync(join(directory, 'package.json'), '{"type":"module"}\n')
  expect(existsSync(join(directory, 'node_modules'))).toBe(false)
  expect(existsSync(join(directory, 'tsconfig.json'))).toBe(false)
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^NODE_(OPTIONS|PATH)$/i.test(key)))
  const startup = spawnSync(process.execPath, [
    'scripts/release/verify-packed-install.ts', '--family', 'vendor', '--from', 'unused',
  ], { cwd: directory, env: environment, encoding: 'utf8', timeout: 30_000 })
  expect(startup.error).toBeUndefined()
  expect(startup.signal).toBeNull()
  expect(startup.status, startup.stdout + startup.stderr).toBe(0)
  expect(startup.stdout).toContain('family vendor publishes no executable')

  const isolation = spawnSync(process.execPath, ['--input-type=module', '--eval', `
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { verifyInstalledProductIsolation } from './scripts/release/installed-product-isolation.ts'
mkdirSync('installed')
writeFileSync('installed/package.json', JSON.stringify({ name: '@fixture/product' }))
assert.equal(verifyInstalledProductIsolation('installed'), 1)
writeFileSync('installed/package.json', JSON.stringify({
  name: '@fixture/product', dependencies: { '@nomix-ai/nomix-experimental-prototype': '*' },
}))
assert.throws(() => verifyInstalledProductIsolation('installed'), /default product includes an experimental package/)
`], { cwd: directory, env: environment, encoding: 'utf8', timeout: 30_000 })
  expect(isolation.error).toBeUndefined()
  expect(isolation.signal).toBeNull()
  expect(isolation.status, isolation.stdout + isolation.stderr).toBe(0)
})

// The release verifier invokes POSIX npm directly, not the Windows npm.cmd shim.
describe.skipIf(process.platform === 'win32')('packed-install npm cache', () => {
  // The verifier starts npm, lifecycle scripts, and the installed entry serially.
  it.each(['success', 'install failure', 'entry failure'] as const)(
    'owns cache writes and removes them after %s',
    (outcome) => {
      const directory = mkdtempSync(join(tmpdir(), 'nomix-packed-cache-test-'))
      roots.push(directory)
      const source = join(directory, 'package')
      const packed = join(directory, 'packed')
      const ambient = join(directory, 'ambient-cache')
      const configured = join(directory, 'configured-cache')
      const temporary = join(directory, 'temporary')
      for (const path of [join(source, 'lib'), packed, ambient, configured, temporary]) mkdirSync(path, { recursive: true })
      writeFileSync(join(ambient, 'sentinel'), 'ambient cache must survive\n')
      writeFileSync(join(configured, 'sentinel'), 'configured cache must survive\n')
      const npmrc = join(directory, 'npmrc')
      writeFileSync(npmrc, `cache=${configured}\n`)
      const evidence = join(directory, 'evidence.json')
      const probe = `
const fs = require('node:fs')
const path = require('node:path')
const consumer = process.env.INIT_CWD || process.cwd()
const cache = path.join(consumer, '.npm-cache', '_cacache')
const files = fs.existsSync(cache) ? fs.readdirSync(cache, { recursive: true }).filter(name => fs.statSync(path.join(cache, name)).isFile()) : []
fs.writeFileSync(process.env.CACHE_EVIDENCE, JSON.stringify({ consumer, files }))
`
      writeFileSync(join(source, 'probe.cjs'), probe + (outcome === 'install failure' ? '\nprocess.exit(37)\n' : ''))
      writeFileSync(join(source, 'lib/bin.js'), outcome === 'entry failure' ? 'process.exit(37)\n' : 'console.log("0.0.1")\n')
      writeFileSync(join(source, 'package.json'), JSON.stringify({
        name: '@nomix-ai/nomix-harness',
        version: '0.0.1',
        scripts: { postinstall: 'node probe.cjs' },
      }))
      const archive = spawnSync('tar', ['-czf', join(packed, 'nomix.tgz'), '-C', directory, 'package'], { encoding: 'utf8', timeout: 30_000 })
      expect(archive.error).toBeUndefined()
      expect(archive.signal).toBeNull()
      expect(archive.status, archive.stderr).toBe(0)
      const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)))
      Object.assign(environment, {
        npm_config_cache: ambient,
        npm_config_userconfig: npmrc,
        npm_config_offline: 'true',
        npm_config_ignore_scripts: 'false',
        CACHE_EVIDENCE: evidence,
        TMPDIR: temporary,
        TMP: temporary,
        TEMP: temporary,
      })
      const result = spawnSync(process.execPath, [
        '--import', 'tsx', 'scripts/release/verify-packed-install.ts', '--family', 'nomix', '--from', packed,
      ], { cwd: root, env: environment, encoding: 'utf8', timeout: 120_000 })
      expect(result.error).toBeUndefined()
      expect(result.signal).toBeNull()
      expect(result.status, result.stdout + result.stderr).toBe(outcome === 'success' ? 0 : 1)
      const observation = JSON.parse(readFileSync(evidence, 'utf8')) as { consumer: string; files: string[] }
      expect(observation.files.length, 'npm must write tarball content into the consumer-private cache').toBeGreaterThan(0)
      expect(observation.consumer).toContain('nomix-packed-nomix-')
      expect(existsSync(observation.consumer), 'the verifier finally must remove its consumer and cache').toBe(false)
      expect(readdirSync(ambient)).toEqual(['sentinel'])
      expect(readFileSync(join(ambient, 'sentinel'), 'utf8')).toBe('ambient cache must survive\n')
      expect(readdirSync(configured)).toEqual(['sentinel'])
      expect(readFileSync(join(configured, 'sentinel'), 'utf8')).toBe('configured cache must survive\n')
    },
    180_000,
  )
})
