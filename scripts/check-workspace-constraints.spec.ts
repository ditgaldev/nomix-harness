/** Experimental-package publication and dependency constraints. */

import { describe, expect, it } from 'vitest'
import {
  checkExperimentalDependencyIsolation,
  checkExperimentalManifest,
  type WorkspaceManifest,
} from './check-workspace-constraints.ts'

const experimental: WorkspaceManifest = {
  dir: 'packages/experimental/prototype',
  manifest: { name: '@nomix-ai/nomix-experimental-prototype', private: true },
}

describe('experimental workspace constraints', () => {
  it('requires the experimental package-name prefix', () => {
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, name: '@nomix-ai/nomix-prototype' },
    })).toEqual([
      '@nomix-ai/nomix-prototype: experimental package name must start with "@nomix-ai/nomix-experimental-"',
    ])
  })

  it('requires private manifests without publication metadata', () => {
    expect(checkExperimentalManifest(experimental)).toEqual([])
    expect(checkExperimentalManifest({
      ...experimental,
      manifest: { ...experimental.manifest, private: false, publishConfig: { access: 'public' } },
    })).toEqual([
      '@nomix-ai/nomix-experimental-prototype: experimental package must set "private": true',
      '@nomix-ai/nomix-experimental-prototype: experimental package must omit publishConfig',
    ])
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'] as const)(
    'rejects release %s on an experimental package',
    (section) => {
      expect(checkExperimentalDependencyIsolation([experimental, {
        dir: 'packages/core/consumer',
        manifest: {
          name: '@nomix-ai/nomix-consumer',
          [section]: { '@nomix-ai/nomix-experimental-prototype': 'workspace:^' },
        },
      }])).toEqual([
        `@nomix-ai/nomix-consumer: ${section}.@nomix-ai/nomix-experimental-prototype must not reference an experimental package`,
      ])
    },
  )

  it('allows development and experimental consumers but rejects the Python release runtime', () => {
    const manifests: WorkspaceManifest[] = [experimental, {
      dir: 'packages/core/test-only',
      manifest: {
        name: '@nomix-ai/nomix-test-only',
        devDependencies: { '@nomix-ai/nomix-experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'packages/experimental/consumer',
      manifest: {
        name: '@nomix-ai/nomix-experimental-consumer',
        dependencies: { '@nomix-ai/nomix-experimental-prototype': 'workspace:^' },
      },
    }, {
      dir: 'python/sdk-runtime',
      manifest: {
        name: '@nomix-ai/nomix-python-runtime',
        dependencies: { '@nomix-ai/nomix-experimental-prototype': 'workspace:^' },
      },
    }]

    expect(checkExperimentalDependencyIsolation(manifests)).toEqual([
      '@nomix-ai/nomix-python-runtime: dependencies.@nomix-ai/nomix-experimental-prototype must not reference an experimental package',
    ])
  })
})
