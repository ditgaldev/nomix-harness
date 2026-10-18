import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualNomixInstallLayout,
  assertResolutionWorkBudget,
  buildDualNomixRegistry,
  MAX_RESOLUTION_WORK_UNITS,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@nomix-ai/nomix-harness': '0.2.0', 'nomix-previous': 'npm:@nomix-ai/nomix-harness@0.1.0' } },
      'node_modules/@nomix-ai/cordis': { version: '4.0.1' },
      'node_modules/@nomix-ai/nomix-harness': {
        version: '0.2.0',
        dependencies: { '@nomix-ai/nomix-child': '^0.2.0' },
        peerDependencies: { '@nomix-ai/cordis': '^4.0.1' },
      },
      'node_modules/@nomix-ai/nomix-child': {
        version: '0.2.0',
        dependencies: { '@nomix-ai/nomix-leaf': '^0.2.0' },
      },
      'node_modules/@nomix-ai/nomix-leaf': { version: '0.2.0' },
      'node_modules/nomix-previous': {
        name: '@nomix-ai/nomix-harness',
        version: '0.1.0',
        dependencies: { '@nomix-ai/nomix-child': '^0.1.0' },
        peerDependencies: { '@nomix-ai/cordis': '^4.0.1' },
      },
      'node_modules/nomix-previous/node_modules/@nomix-ai/nomix-child': {
        version: '0.1.0',
        dependencies: { '@nomix-ai/nomix-leaf': '^0.1.0' },
      },
      'node_modules/nomix-previous/node_modules/@nomix-ai/nomix-leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every NOMIX package', () => {
    const index: RegistryIndex = new Map([
      ['@nomix-ai/nomix-harness', new Map([['0.1.1-rc.2', {
        name: '@nomix-ai/nomix-harness',
        version: '0.1.1-rc.2',
        dependencies: { '@nomix-ai/nomix-child': '^0.1.1-rc.2' },
        peerDependencies: { '@nomix-ai/cordis': '^4.0.1' },
      }]])],
      ['@nomix-ai/nomix-child', new Map([['0.1.1-rc.2', {
        name: '@nomix-ai/nomix-child',
        version: '0.1.1-rc.2',
      }]])],
      ['@nomix-ai/cordis', new Map([['4.0.1', {
        name: '@nomix-ai/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualNomixRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@nomix-ai/nomix-harness')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@nomix-ai/nomix-harness')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@nomix-ai/nomix-child': '^0.1.0' },
      peerDependencies: { '@nomix-ai/cordis': '^4.0.1' },
    })
    expect(dual.get('@nomix-ai/nomix-harness')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@nomix-ai/nomix-child': '^0.2.0' },
    })
    expect(dual.get('@nomix-ai/cordis')).toBe(index.get('@nomix-ai/cordis'))
  })

  it('accepts isolated NOMIX releases with one shared Cordis installation', () => {
    expect(assertDualNomixInstallLayout(validLayout())).toEqual({
      nomixPackagesPerVersion: 3,
      checkedNomixEdges: 4,
    })
  })

  it.each([
    ['react', 'node_modules/react'],
    ['react-dom', 'node_modules/react-dom'],
    ['react', 'node_modules/nomix-previous/node_modules/react'],
    ['react-dom', 'node_modules/nomix-previous/node_modules/react-dom'],
  ])('rejects browser runtime %s installed at %s in the NOMIX-only consumer', (name, path) => {
    const layout = validLayout()
    const packages = { ...layout.packages, [path]: { version: '18.3.1' } }
    expect(() => assertDualNomixInstallLayout({ ...layout, packages })).toThrow(
      `${path}: ${name} is a browser build input`,
    )
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/nomix-previous/node_modules/@nomix-ai/nomix-leaf')

    expect(() => assertDualNomixInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/nomix-previous/node_modules/@nomix-ai/nomix-child: dependencies '
      + '@nomix-ai/nomix-leaf resolves to node_modules/@nomix-ai/nomix-leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/nomix-previous/node_modules/@nomix-ai/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualNomixInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @nomix-ai/cordis',
    )
  })
})

describe('resolution work budget', () => {
  it('accepts the measured dual-release graph', () => {
    expect(assertResolutionWorkBudget({ nomixPackagesPerVersion: 277, checkedNomixEdges: 2524 }))
      .toBe(699_148)
  })

  it('accepts a graph exactly at the budget and rejects one internal edge above it', () => {
    const packages = 350
    const edgesAtBudget = Math.floor(MAX_RESOLUTION_WORK_UNITS / packages)

    expect(packages * edgesAtBudget).toBe(MAX_RESOLUTION_WORK_UNITS)
    expect(assertResolutionWorkBudget({ nomixPackagesPerVersion: packages, checkedNomixEdges: edgesAtBudget }))
      .toBe(MAX_RESOLUTION_WORK_UNITS)
    expect(() => assertResolutionWorkBudget({
      nomixPackagesPerVersion: packages,
      checkedNomixEdges: edgesAtBudget + 1,
    })).toThrow(`= ${String(MAX_RESOLUTION_WORK_UNITS + packages)} unit(s), budget ${String(MAX_RESOLUTION_WORK_UNITS)} unit(s)`)
  })

  it('accepts the headroom and rejects a runaway graph with its own measured counts', () => {
    expect(assertResolutionWorkBudget({ nomixPackagesPerVersion: 300, checkedNomixEdges: 2800 }))
      .toBe(840_000)
    expect(() => assertResolutionWorkBudget({ nomixPackagesPerVersion: 400, checkedNomixEdges: 3000 }))
      .toThrow('400 package(s) per release x 3000 internal edge(s) = 1200000 unit(s), budget 875000 unit(s)')
  })
})
