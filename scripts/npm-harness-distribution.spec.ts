import { sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  bundledManifest,
  bundledPackagePath,
  classifyWorkspace,
  mergeDependencyRanges,
  pluginFacadeExport,
  pluginFacadeId,
  publishableArtifactPath,
  rewriteHarnessPackageAnchor,
} from './npm-harness-distribution.ts'

describe('npm Harness workspace classification', () => {
  it('classifies every distribution role explicitly', () => {
    expect(classifyWorkspace('packages/core/agent')).toBe('plugin')
    expect(classifyWorkspace('packages/bundle/base')).toBe('bundle')
    expect(classifyWorkspace('packages/boot/app-boot')).toBe('runtime')
    expect(classifyWorkspace('packages/sdk/client')).toBe('sdk')
    expect(classifyWorkspace('packages/test-support/loader-smoke')).toBe('development-only')
    expect(classifyWorkspace('vendor/cordis')).toBe('runtime')
    expect(classifyWorkspace('native/landlock-run/packages/entry')).toBe('runtime')
    expect(classifyWorkspace('native/landlock-run/packages/linux-x64')).toBe('separate-distribution')
  })

  it('rejects an unclassified workspace', () => {
    expect(() => classifyWorkspace('unknown/package')).toThrow('unclassified workspace')
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
})

describe('npm Harness dependency convergence', () => {
  it('converges the reviewed chokidar ranges on v5', () => {
    expect(mergeDependencyRanges('chokidar', '^4.0.3', '^5.0.0')).toBe('^5.0.0')
    expect(mergeDependencyRanges('chokidar', '^5.0.0', '^4.0.3')).toBe('^5.0.0')
  })

  it('rejects unreviewed incompatible ranges', () => {
    expect(() => mergeDependencyRanges('example', '^4.0.3', '^5.0.0'))
      .toThrow('conflicting dependency ranges for example')
    expect(() => mergeDependencyRanges('chokidar', '^5.0.0', '^6.0.0'))
      .toThrow('conflicting dependency ranges for chokidar')
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
