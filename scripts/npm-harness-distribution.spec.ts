import { describe, expect, it } from 'vitest'
import { classifyWorkspace, mergeDependencyRanges } from './npm-harness-distribution.ts'

describe('npm Harness workspace classification', () => {
  it('classifies every public distribution role explicitly', () => {
    expect(classifyWorkspace('packages/core/agent')).toBe('plugin')
    expect(classifyWorkspace('packages/bundle/base')).toBe('bundle')
    expect(classifyWorkspace('packages/boot/app-boot')).toBe('runtime')
    expect(classifyWorkspace('packages/sdk/client')).toBe('sdk')
    expect(classifyWorkspace('packages/test-support/loader-smoke')).toBe('development-only')
    expect(classifyWorkspace('vendor/cordis')).toBe('separate-distribution')
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
