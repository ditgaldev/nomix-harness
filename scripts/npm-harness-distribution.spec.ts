import { globSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  bundledManifest,
  aggregateExternalDependencies,
  aggregateRuntimeDependencies,
  bundledPackagePath,
  classifyWorkspace,
  mergeDependencyRanges,
  pluginFacadeExport,
  pluginFacadeId,
  publishableArtifactPath,
  rewriteHarnessPackageAnchor,
} from './npm-harness-distribution.ts'
import { OPTIONAL_BUNDLES } from '../packages/boot/app-boot/src/profile.ts'
import { ON_DEMAND_BUNDLES } from '../packages/boot/app-boot/src/official-bundle-packages.ts'
import { isExperimentalPackageName } from './experimental-package-policy.ts'

describe('npm Harness workspace classification', () => {
  it('classifies every distribution role explicitly', () => {
    expect(classifyWorkspace('packages/core/agent')).toBe('plugin')
    expect(classifyWorkspace('packages/bundle/base')).toBe('bundle')
    expect(classifyWorkspace('packages/boot/app-boot')).toBe('runtime')
    expect(classifyWorkspace('packages/sdk/client')).toBe('sdk')
    expect(classifyWorkspace('packages/test-support/loader-smoke')).toBe('development-only')
    expect(classifyWorkspace('vendor/cordis')).toBe('runtime')
    expect(classifyWorkspace('vendor/hmr')).toBe('development-only')
    expect(classifyWorkspace('native/system/packages/entry')).toBe('runtime')
    expect(classifyWorkspace('native/system/packages/linux-x64')).toBe('separate-distribution')
    expect(classifyWorkspace('native/system/packages/darwin-arm64')).toBe('separate-distribution')
    expect(classifyWorkspace('apps/web')).toBe('runtime')
    for (const directory of ['apps/desktop', 'apps/desktop-host', 'apps/plugin-market-generator', 'benchmarks']) {
      expect(classifyWorkspace(directory)).toBe('development-only')
    }
    expect(classifyWorkspace('apps\\desktop')).toBe('development-only')
  })

  it('rejects an unclassified workspace', () => {
    expect(() => classifyWorkspace('unknown/package')).toThrow('unclassified workspace')
  })

  it('classifies the current workspace graph and includes every declared native platform', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifests = globSync([
      'packages/*/*/package.json', 'apps/*/package.json', 'vendor/*/package.json',
      'native/system/package.json', 'native/system/packages/*/package.json',
      'benchmarks/package.json', 'website/package.json', 'python/sdk-runtime/package.json',
    ], { cwd: root }).map(path => path.replaceAll('\\', '/'))
    expect(manifests.length).toBeGreaterThan(300)
    for (const path of manifests) expect(() => classifyWorkspace(path.slice(0, -'/package.json'.length))).not.toThrow()
    const platforms = manifests.filter(path => path.startsWith('native/system/packages/')
      && path !== 'native/system/packages/entry/package.json')
    expect(platforms.map(path => path.split('/')[3]).sort()).toEqual(['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'])
    const entry = JSON.parse(readFileSync(join(root, 'native/system/packages/entry/package.json'), 'utf8')) as {
      optionalDependencies: Record<string, string>
    }
    const platformNames = platforms.map((path) => {
      const value = JSON.parse(readFileSync(join(root, path), 'utf8')) as { name: string }
      return value.name
    })
    expect(platformNames.sort()).toEqual(Object.keys(entry.optionalDependencies).sort())
    for (const path of manifests) {
      const value = JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, Record<string, string>>
      for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        expect(value[section] ?? {}).not.toHaveProperty('@nomix-ai/cordis-plugin-hmr')
      }
    }
  })
})

describe('npm Harness bundled packages', () => {
  it('places scoped packages under the aggregate node_modules', () => {
    expect(bundledPackagePath('aggregate', '@nomix-ai/nomix-agent'))
      .toBe(['aggregate', 'node_modules', '@nomix-ai', 'nomix-agent'].join(sep))
  })

  it('maps official package names to stable Harness plugin API subpaths', () => {
    expect(pluginFacadeId('@nomix-ai/nomix-tools')).toBe('tools')
    expect(pluginFacadeExport('@nomix-ai/nomix-tools')).toEqual({
      subpath: './plugin/tools',
      target: {
        types: './dist/plugin/tools.d.ts',
        default: './dist/plugin/tools.js',
      },
    })
    expect(() => pluginFacadeId('@nomix-ai/cordis')).toThrow('cannot expose non-Nomix package')
  })

  it('materializes workspace dependency selectors without changing external ranges', () => {
    const manifest = bundledManifest({
      name: '@nomix-ai/nomix-consumer',
      dependencies: {
        '@nomix-ai/nomix-agent': 'workspace:^',
        commander: '^15.0.0',
      },
      peerDependencies: { '@nomix-ai/cordis': 'workspace:*' },
    }, new Map([
      ['@nomix-ai/nomix-agent', '0.2.7'],
      ['@nomix-ai/cordis', '0.2.7'],
    ]))
    expect(manifest).toMatchObject({
      dependencies: {
        '@nomix-ai/nomix-agent': '0.2.7',
        commander: '^15.0.0',
      },
      peerDependencies: { '@nomix-ai/cordis': '0.2.7' },
    })
  })

  it('rejects a workspace dependency omitted from the aggregate', () => {
    expect(() => bundledManifest({ dependencies: { '@nomix-ai/missing': 'workspace:^' } }, new Map()))
      .toThrow('cannot resolve workspace dependency @nomix-ai/missing')
  })

  it('materializes the SDK outer-package reference without adding a self-dependency', () => {
    const harness = {
      directory: 'apps/cli', name: '@nomix-ai/nomix-harness', classification: 'runtime' as const,
      manifest: { version: '0.2.9' },
    }
    const sdk = {
      directory: 'packages/sdk/client', name: '@nomix-ai/nomix-sdk-client', classification: 'sdk' as const,
      manifest: { dependencies: { '@nomix-ai/nomix-harness': 'workspace:*', '@deepseek-ai/libreoffice-kit': '^0.1.5' } },
    }
    expect(bundledManifest(sdk.manifest, new Map([[harness.name, '0.2.9']]))).toMatchObject({
      dependencies: { '@nomix-ai/nomix-harness': '0.2.9', '@deepseek-ai/libreoffice-kit': '^0.1.5' },
    })
    const all = new Map<string, typeof harness | typeof sdk>([[harness.name, harness], [sdk.name, sdk]])
    expect(aggregateExternalDependencies([harness, sdk], all, new Set([harness.name, sdk.name])))
      .toEqual({ dependencies: { '@deepseek-ai/libreoffice-kit': '^0.1.5' }, optionalDependencies: {} })
    expect(() => bundledManifest(sdk.manifest, new Map([[harness.name, '^0.2.9']])))
      .toThrow('requires an exact version')
  })
})

describe('npm Harness dependency convergence', () => {
  it('selects ranges that every consumer accepts, including exact versions', () => {
    expect(mergeDependencyRanges('yaml', '^2.4.2', '^2.9.0')).toBe('^2.9.0')
    expect(mergeDependencyRanges('zod', '4.4.3', '^4.4.3')).toBe('4.4.3')
    expect(mergeDependencyRanges('zod', '^4.4.3', '4.4.3')).toBe('4.4.3')
    expect(mergeDependencyRanges('example', '^1.0.0', '~1.2.0')).toBe('~1.2.0')
  })

  it('rejects unreviewed incompatible ranges', () => {
    expect(() => mergeDependencyRanges('example', '^4.0.3', '^5.0.0'))
      .toThrow('conflicting dependency ranges for example')
    expect(() => mergeDependencyRanges('chokidar', '^5.0.0', '^6.0.0'))
      .toThrow('conflicting dependency ranges for chokidar')
    expect(() => mergeDependencyRanges('chokidar', '^4.0.3', '5.0.0'))
      .toThrow('conflicting dependency ranges for chokidar')
    expect(() => mergeDependencyRanges('example', '^0.0.1', '^0.0.2'))
      .toThrow('conflicting dependency ranges for example')
  })
})

describe('npm Harness default dependency graph', () => {
  it('carries non-default implementations and their third-party libraries as optional packages', () => {
    const offered = OPTIONAL_BUNDLES[0]!
    const onDemand = ON_DEMAND_BUNDLES[0]!
    const make = (name: string, manifest: Record<string, unknown>, directory = 'packages/core/example') => {
      const resolvedManifest: Record<string, unknown> = { version: '0.2.9', ...manifest }
      return { name, directory, classification: classifyWorkspace(directory), manifest: resolvedManifest }
    }
    const harness = make('@nomix-ai/nomix-harness', { dependencies: { core: 'workspace:*', [offered]: 'workspace:*' } }, 'apps/cli')
    const core = make('core', { dependencies: { shared: '^1.0.0' } })
    const optional = make(offered, { dependencies: { shared: '^1.1.0', extra: '^2.0.0', '@nomix-ai/nomix-experimental-inner': 'workspace:*' } })
    const inner = make('@nomix-ai/nomix-experimental-inner', {})
    const provider = make(onDemand, { dependencies: { sdk: '3.0.0' } })
    const platform = make('@nomix-ai/node-addon-system-linux-x64', {}, 'native/system/packages/linux-x64')
    const bundled = [core, optional, inner, provider, platform]
    const all = new Map([harness, ...bundled].map(pkg => [pkg.name, pkg]))
    const result = aggregateRuntimeDependencies(harness, bundled, all)
    expect(result.dependencies).toEqual({ shared: '^1.1.0', core: '0.2.9', [offered]: '0.2.9' })
    expect(result.optionalDependencies).toEqual({
      extra: '^2.0.0', sdk: '3.0.0', [inner.name]: '0.2.9', [onDemand]: '0.2.9', [platform.name]: '0.2.9',
    })
    expect(result.dependencies).not.toHaveProperty(harness.name)
    expect(result.optionalDependencies).not.toHaveProperty(harness.name)
    core.manifest = { version: '0.2.9', dependencies: { [onDemand]: 'workspace:*' } }
    expect(() => aggregateRuntimeDependencies(harness, bundled, all)).toThrow('default product depends on on-demand package')
    core.manifest = { version: '0.2.9', dependencies: { [inner.name]: 'workspace:*' } }
    expect(() => aggregateRuntimeDependencies(harness, bundled, all)).toThrow('default product depends on experimental package')
  })

  it('keeps the real graph compatible and on-demand implementations outside default dependencies', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const inventory = globSync([
      'packages/*/*/package.json', 'apps/*/package.json', 'vendor/*/package.json',
      'native/system/packages/*/package.json',
    ], { cwd: root }).map((path) => {
      const directory = path.replaceAll('\\', '/').slice(0, -'/package.json'.length)
      const manifest = JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>
      return { directory, manifest, name: String(manifest.name), classification: classifyWorkspace(directory) }
    })
    const all = new Map(inventory.map(pkg => [pkg.name, pkg]))
    const harness = all.get('@nomix-ai/nomix-harness')!
    const bundled = inventory.filter(pkg => pkg !== harness && pkg.classification !== 'development-only')
    const result = aggregateRuntimeDependencies(harness, bundled, all)
    expect(result.dependencies.chokidar).toBe('5.0.0')
    expect(result.dependencies).not.toHaveProperty('@nomix-ai/cordis-plugin-hmr')
    for (const name of ON_DEMAND_BUNDLES) {
      expect(result.dependencies).not.toHaveProperty(name)
      expect(result.optionalDependencies[name]).toBe(harness.manifest.version)
    }
    for (const name of Object.keys(result.dependencies).filter(isExperimentalPackageName)) expect(OPTIONAL_BUNDLES).toContain(name)
  })
})

describe('npm Harness artifact filtering', () => {
  it('excludes source maps and compiler state from every copied artifact tree', () => {
    expect(publishableArtifactPath('apps/web/dist/assets/index.js')).toBe(true)
    expect(publishableArtifactPath('apps/web/dist/assets/index.js.map')).toBe(false)
    expect(publishableArtifactPath('packages/core/agent/lib/tsconfig.tsbuildinfo')).toBe(false)
  })

  it('retargets single- and double-quoted CLI package anchors', () => {
    expect(rewriteHarnessPackageAnchor("new URL('../package.json', import.meta.url)"))
      .toBe("new URL('../../package.json', import.meta.url)")
    expect(rewriteHarnessPackageAnchor('new URL("../package.json", import.meta.url)'))
      .toBe('new URL("../../package.json", import.meta.url)')
  })
})
