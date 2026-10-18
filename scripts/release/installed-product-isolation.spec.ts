/** Installed-product isolation uses resolved package identities and runtime edges. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS } from '../experimental-package-policy.ts'
import { verifyInstalledProductIsolation } from './installed-product-isolation.ts'

const roots: string[] = []
const experimental = '@nomix-ai/nomix-experimental-example'

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'nomix-installed-isolation-'))
  roots.push(root)
  return root
}

function writePackage(root: string, key: string, manifest: Record<string, unknown>): string {
  const directory = join(root, 'node_modules', key)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify({ name: key, ...manifest })}\n`)
  return directory
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe.each([experimental, ...Object.values(EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS)])('installed default-product isolation: %s', (experimental) => {
  it('ignores development dependencies and unrelated installed experimental packages', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', {
      dependencies: { core: '1.0.0' },
      devDependencies: { [experimental]: '1.0.0' },
    })
    writePackage(root, 'core', { peerDependencies: { '@nomix-ai/nomix-harness': '1.0.0' } })
    writePackage(root, experimental, {})

    expect(verifyInstalledProductIsolation(entry)).toBe(2)
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'])(
    'rejects a transitive experimental %s',
    (section) => {
      const root = fixture()
      const entry = writePackage(root, '@nomix-ai/nomix-harness', { dependencies: { thirdParty: '1.0.0' } })
      writePackage(root, 'thirdParty', { [section]: { [experimental]: '1.0.0' } })

      expect(() => verifyInstalledProductIsolation(entry)).toThrow(
        `@nomix-ai/nomix-harness -> thirdParty -> ${experimental}`,
      )
    },
  )

  it('skips the entry package\'s optional bundles, which must be installed, and still rejects other experimental edges', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', { dependencies: { core: '1.0.0', [experimental]: '1.0.0' } })
    writePackage(root, 'core', {})
    writePackage(root, experimental, { dependencies: { '@nomix-ai/nomix-experimental-inner': '1.0.0' } })
    expect(verifyInstalledProductIsolation(entry, [experimental])).toBe(2)

    writePackage(root, 'core', { dependencies: { [experimental]: '1.0.0' } })
    expect(() => verifyInstalledProductIsolation(entry, [experimental])).toThrow(`core -> ${experimental}`)

    const missing = writePackage(root, '@nomix-ai/nomix-missing', { dependencies: { absent: '1.0.0' } })
    expect(() => verifyInstalledProductIsolation(missing, ['absent'])).toThrow('optional bundle is missing: @nomix-ai/nomix-missing -> absent')
  })

  it('rejects experimental identities hidden behind an installed alias', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', { dependencies: { safeName: 'file:../prototype' } })
    writePackage(root, 'safeName', { name: experimental })

    expect(() => verifyInstalledProductIsolation(entry)).toThrow(experimental)
  })

  it('skips only physically bundled optional implementations at the aggregate root', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', {
      dependencies: { core: '1.0.0' },
      optionalDependencies: { [experimental]: '1.0.0' },
      bundledDependencies: ['core', experimental],
    })
    writePackage(entry, 'core', {})
    writePackage(entry, experimental, { dependencies: { '@nomix-ai/nomix-experimental-inner': '1.0.0' } })
    expect(verifyInstalledProductIsolation(entry)).toBe(2)
    writePackage(entry, 'core', {
      optionalDependencies: { [experimental]: '1.0.0' },
      bundledDependencies: [experimental],
    })
    expect(() => verifyInstalledProductIsolation(entry)).toThrow(`core -> ${experimental}`)
  })

  it('does not exempt unbundled, missing or required experimental root dependencies', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', {
      optionalDependencies: { [experimental]: '1.0.0' },
    })
    writePackage(entry, experimental, {})
    expect(() => verifyInstalledProductIsolation(entry)).toThrow(experimental)
    const missing = writePackage(root, '@nomix-ai/nomix-harness', {
      optionalDependencies: { '@nomix-ai/nomix-experimental-absent': '1.0.0' },
      bundledDependencies: ['@nomix-ai/nomix-experimental-absent'],
    })
    expect(() => verifyInstalledProductIsolation(missing)).toThrow('experimental-absent')
    writePackage(root, '@nomix-ai/nomix-harness', {
      dependencies: { [experimental]: '1.0.0' },
      optionalDependencies: { [experimental]: '1.0.0' },
      bundledDependencies: [experimental],
    })
    expect(() => verifyInstalledProductIsolation(entry)).toThrow(experimental)
  })

  it('rejects mismatched identities in root bundled optional packages', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', {
      optionalDependencies: { safeName: '1.0.0' },
      bundledDependencies: ['safeName'],
    })
    writePackage(entry, 'safeName', { name: experimental })
    expect(() => verifyInstalledProductIsolation(entry)).toThrow('bundled optional package identity differs')
  })

  it('rejects experimental npm aliases even when an optional package is omitted', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', {
      optionalDependencies: { safeName: `npm:${experimental}@1.0.0` },
    })

    expect(() => verifyInstalledProductIsolation(entry)).toThrow(experimental)
  })

  it('follows nested installations rather than an unrelated hoisted package', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', { dependencies: { core: '1.0.0' } })
    writePackage(root, 'core', {})
    writePackage(entry, 'core', { dependencies: { [experimental]: '1.0.0' } })

    expect(() => verifyInstalledProductIsolation(entry)).toThrow(experimental)
  })

  it('permits missing optional packages and optional peers but rejects missing dependencies', () => {
    const root = fixture()
    const entry = writePackage(root, '@nomix-ai/nomix-harness', {
      dependencies: { optional: '1.0.0' },
      optionalDependencies: { optional: '1.0.0' },
      peerDependencies: { peer: '1.0.0' },
      peerDependenciesMeta: { peer: { optional: true } },
    })
    expect(verifyInstalledProductIsolation(entry)).toBe(1)
    writePackage(root, '@nomix-ai/nomix-harness', { dependencies: { missing: '1.0.0' } })
    expect(() => verifyInstalledProductIsolation(entry)).toThrow('dependency is missing')
  })
})
