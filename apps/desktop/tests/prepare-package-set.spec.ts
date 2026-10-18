import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertDesktopHostPackageFiles,
  selectDesktopPackageClosure,
  type PackedDesktopPackage,
} from '../scripts/prepare-package-set.ts'

function packed(name: string, manifest: Record<string, unknown> = {}): PackedDesktopPackage {
  return { tarball: `${name}.tgz`, manifest: { name, version: '1.0.0', ...manifest } }
}

describe('desktop package-set selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not select a packaging target when imported as a library', async () => {
    vi.stubEnv('NOMIX_DESKTOP_TARGET_PLATFORM', 'linux')
    vi.stubEnv('NOMIX_DESKTOP_TARGET_ARCH', 'x64')
    vi.resetModules()
    await expect(import('../scripts/prepare-package-set.ts')).resolves.toHaveProperty('prepareDesktopPackageSet')
  })

  it('includes only the available internal production closure', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@nomix-ai/nomix-harness', packed('@nomix-ai/nomix-harness', {
        dependencies: { '@nomix-ai/nomix-base': '^1.0.0', external: '^2.0.0' },
        optionalDependencies: { '@nomix-ai/platform-package': '1.0.0', '@nomix-ai/missing-platform': '1.0.0' },
      })],
      ['@nomix-ai/nomix-desktop-host', packed('@nomix-ai/nomix-desktop-host', {
        dependencies: { '@nomix-ai/nomix-harness': '^1.0.0' },
      })],
      ['@nomix-ai/nomix-base', packed('@nomix-ai/nomix-base', {
        peerDependencies: { '@nomix-ai/cordis': '^1.0.0' },
      })],
      ['@nomix-ai/cordis', packed('@nomix-ai/cordis')],
      ['@nomix-ai/platform-package', packed('@nomix-ai/platform-package')],
      ['@nomix-ai/unused', packed('@nomix-ai/unused')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@nomix-ai/cordis',
      '@nomix-ai/nomix-harness',
      '@nomix-ai/nomix-base',
      '@nomix-ai/nomix-desktop-host',
      '@nomix-ai/platform-package',
    ])
  })

  it.each([
    '@nomix-ai/nomix-base', '@nomix-ai/cordis', '@nomix-ai/node-addon-system',
  ])('rejects required prepared package %s absent from the packed release inputs', (dependency) => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@nomix-ai/nomix-harness', packed('@nomix-ai/nomix-harness', {
        dependencies: { [dependency]: '^1.0.0' },
      })],
      ['@nomix-ai/nomix-desktop-host', packed('@nomix-ai/nomix-desktop-host', {
        dependencies: { '@nomix-ai/nomix-harness': '^1.0.0' },
      })],
    ])
    expect(() => selectDesktopPackageClosure(available)).toThrow(/unpacked package/u)
    expect(() => selectDesktopPackageClosure(new Map([
      ['@nomix-ai/nomix-harness', packed('@nomix-ai/nomix-harness')],
    ]))).toThrow(/omit @nomix-ai\/nomix-desktop-host/u)
  })

  it('leaves independently published Office packages to npm resolution', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@nomix-ai/nomix-harness', packed('@nomix-ai/nomix-harness', {
        dependencies: {
          '@deepseek-ai/libreoffice-kit': '0.0.1',
          '@deepseek-ai/libreoffice-kit-wasm': '0.0.1',
        },
      })],
      ['@nomix-ai/nomix-desktop-host', packed('@nomix-ai/nomix-desktop-host')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@nomix-ai/nomix-harness', '@nomix-ai/nomix-desktop-host',
    ])
  })

  it('requires both Desktop Host and public CLI entries', () => {
    const files = [
      'package/lib/index.js',
      'package/lib/cli.js',
    ]
    expect(() => {
      assertDesktopHostPackageFiles(files)
    }).not.toThrow()
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(1))
    }).toThrow(/lib\/index\.js/u)
    expect(() => { assertDesktopHostPackageFiles(files.slice(0, 1)) }).toThrow(/lib\/cli\.js/u)
  })
})
