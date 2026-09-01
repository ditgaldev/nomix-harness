import { describe, expect, it } from 'vitest'
import {
  classifyWorkspace,
  isBrowserClientBundle,
  mergeDependencyRanges,
  publishableArtifactPath,
  rewriteHarnessPackageAnchor,
  rewriteInternalModuleSpecifiers,
  verifyBrowserClientRequires,
} from './npm-harness-distribution.ts'

describe('npm Harness workspace classification', () => {
  it('classifies every public distribution role explicitly', () => {
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

  it('rewrites module specifiers without changing package-name data', () => {
    const source = [
      'import value from \'@nomix-ai/nomix-example\'',
      'const lazy = import(\'@nomix-ai/nomix-example/subpath\')',
      'const resolved = import.meta.resolve(\'@nomix-ai/nomix-example\')',
      'const profile = [\'@nomix-ai/nomix-example\']',
    ].join('\n')
    expect(rewriteInternalModuleSpecifiers(source, (name, subpath) => `../kernel/${name.slice(16)}/${subpath || 'index.js'}`))
      .toBe([
        'import value from \'../kernel/example/index.js\'',
        'const lazy = import(\'../kernel/example/subpath\')',
        'const resolved = import.meta.resolve(\'../kernel/example/index.js\')',
        'const profile = [\'@nomix-ai/nomix-example\']',
      ].join('\n'))
  })

  it('keeps browser client factory requires on canonical module-table keys', () => {
    const manifest = {
      exports: {
        './client': { default: './lib/client.js' },
      },
      nomix: { client: { platform: 'web' } },
    }
    expect(isBrowserClientBundle(manifest, 'lib/client.js')).toBe(true)
    expect(isBrowserClientBundle(manifest, 'lib/index.js')).toBe(false)

    const source = 'const slots = require("@nomix-ai/nomix-client-ui-slots")'
    expect(rewriteInternalModuleSpecifiers(
      source,
      () => '../../client-ui-slots/lib/index.js',
      () => true,
    )).toBe(source)
    expect(() => { verifyBrowserClientRequires(source, '@nomix-ai/nomix-client-runtime') }).not.toThrow()
    expect(() => {
      verifyBrowserClientRequires(
        'const slots = require("../../client-ui-slots/lib/index.js")',
        '@nomix-ai/nomix-client-runtime',
      )
    }).toThrow('filesystem-relative module-table requires: ../../client-ui-slots/lib/index.js')
  })
})
