/** Release family discovery, publish order, tag naming, and the bump judgements. */

import { describe, expect, it } from 'vitest'
import { releaseFamily, type ReleaseMember } from './families.ts'
import { compareVersions, nextVendorVersion, reachesPayload } from './bump.ts'

/**
 * A release member standing in for a manifest on disk.
 * @param directory - repository-relative package directory.
 * @param name - package name.
 * @param manifest - manifest fields the subject reads.
 * @returns The member.
 */
function member(directory: string, name: string, manifest: Record<string, unknown> = {}): ReleaseMember {
  return { directory, name, version: '0.0.1', manifest }
}

describe('release families', () => {
  it('names one tag for the whole nomix family and one per vendored package', () => {
    const nomix = releaseFamily('nomix')
    const vendor = releaseFamily('vendor')
    const cli = member('apps/cli', '@nomix-ai/nomix-harness')
    const cordis = { ...member('vendor/cordis', '@nomix-ai/cordis'), version: '4.0.1' }

    expect(nomix.tagFor(cli)).toBe('nomix-v0.0.1')
    expect(vendor.tagFor(cordis)).toBe('vendor-cordis-v4.0.1')
    // The prefix is constructed, not recovered from a tag: a version with a
    // hyphen would defeat any suffix-stripping.
    expect(vendor.tagPrefixFor({ ...cordis, version: '4.0.0-rc.7' })).toBe('vendor-cordis-v')
    expect(vendor.tagFor({ ...cordis, version: '4.0.0-rc.7' })).toBe('vendor-cordis-v4.0.0-rc.7')
  })

  it('publishes the product as one native ESM Harness package', () => {
    const nomix = releaseFamily('nomix')
    const harness = member('apps/cli', '@nomix-ai/nomix-harness')
    const library = member('packages/core/library', '@nomix-ai/nomix-library')

    expect(nomix.publicationMembers([library, harness])).toEqual([harness])
    expect(nomix.packing).toBe('native-bundle')
  })

  it('rejects a family whose members disagree on the shared version', () => {
    const nomix = releaseFamily('nomix')
    const members = [member('apps/cli', '@nomix-ai/nomix-harness'), { ...member('apps/web', '@nomix-ai/nomix-web-frontend'), version: '0.0.2' }]

    expect(() => { nomix.verifyVersions(members) }).toThrow(/must share one version/)
    expect(() => { nomix.verifyVersions([members[0]!]) }).not.toThrow()
  })

  it('accepts independent vendored versions and rejects an unpublishable one', () => {
    const vendor = releaseFamily('vendor')
    const members = [
      { ...member('vendor/cordis', '@nomix-ai/cordis'), version: '4.0.1' },
      { ...member('vendor/cosmokit', '@nomix-ai/cosmokit'), version: '1.8.2' },
    ]

    expect(() => { vendor.verifyVersions(members) }).not.toThrow()
    expect(() => { vendor.verifyVersions([{ ...members[0]!, version: 'latest' }]) }).toThrow(/unpublishable version/)
  })

  it('publishes a dependency before its consumer, and orders ties by name', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/consumer', '@nomix-ai/nomix-consumer', { dependencies: { '@nomix-ai/nomix-library': 'workspace:^' } }),
      member('packages/a/library', '@nomix-ai/nomix-library'),
      member('packages/a/zebra', '@nomix-ai/nomix-zebra'),
    ]

    expect(nomix.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@nomix-ai/nomix-library',
      '@nomix-ai/nomix-consumer',
      '@nomix-ai/nomix-zebra',
    ])
  })

  it('reports a runtime dependency cycle instead of emitting an arbitrary order', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/left', '@nomix-ai/nomix-left', { dependencies: { '@nomix-ai/nomix-right': 'workspace:^' } }),
      member('packages/a/right', '@nomix-ai/nomix-right', { dependencies: { '@nomix-ai/nomix-left': 'workspace:^' } }),
    ]

    expect(() => { nomix.publishOrder(members) }).toThrow(/dependency cycle/)
  })

  it('publishes a peer before its consumer', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/consumer', '@nomix-ai/nomix-consumer', { peerDependencies: { '@nomix-ai/nomix-zebra': 'workspace:^' } }),
      member('packages/a/zebra', '@nomix-ai/nomix-zebra'),
    ]

    // Name order alone would place the consumer first; the peer edge moves it.
    expect(nomix.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@nomix-ai/nomix-zebra',
      '@nomix-ai/nomix-consumer',
    ])
  })

  it('orders around a peer cycle rather than refusing to publish, and reports the edge it dropped', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/left', '@nomix-ai/nomix-left', { peerDependencies: { '@nomix-ai/nomix-right': 'workspace:^' } }),
      member('packages/a/right', '@nomix-ai/nomix-right', { peerDependencies: { '@nomix-ai/nomix-left': 'workspace:^' } }),
    ]

    // Sibling packages declare each other as peers, and npm treats an unmet peer
    // as a warning, so this pair has to publish rather than fail the release.
    const plan = nomix.publishOrder(members)
    expect(plan.order.map(entry => entry.name)).toEqual([
      '@nomix-ai/nomix-right',
      '@nomix-ai/nomix-left',
    ])
    // One of the two edges has to give, and which one it is belongs in the log.
    expect(plan.droppedPeerEdges).toEqual([
      { consumer: '@nomix-ai/nomix-right', peer: '@nomix-ai/nomix-left' },
    ])
  })

  it('honours an install edge even when a peer cycle surrounds it', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/base', '@nomix-ai/nomix-base', { peerDependencies: { '@nomix-ai/nomix-consumer': 'workspace:^' } }),
      member('packages/a/consumer', '@nomix-ai/nomix-consumer', {
        dependencies: { '@nomix-ai/nomix-base': 'workspace:^' },
        peerDependencies: { '@nomix-ai/nomix-base': 'workspace:^' },
      }),
    ]

    // The install edge is absolute: base publishes first, and the peer edge that
    // would reverse it is the one dropped.
    const plan = nomix.publishOrder(members)
    expect(plan.order.map(entry => entry.name)).toEqual([
      '@nomix-ai/nomix-base',
      '@nomix-ai/nomix-consumer',
    ])
    expect(plan.droppedPeerEdges).toEqual([
      { consumer: '@nomix-ai/nomix-base', peer: '@nomix-ai/nomix-consumer' },
    ])
  })

  it('refuses an order that would publish a consumer before a dependency it installs', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/alpha', '@nomix-ai/nomix-alpha', { peerDependencies: { '@nomix-ai/nomix-bravo': 'workspace:^' } }),
      member('packages/a/bravo', '@nomix-ai/nomix-bravo', { peerDependencies: { '@nomix-ai/nomix-charlie': 'workspace:^' } }),
      member('packages/a/charlie', '@nomix-ai/nomix-charlie', { dependencies: { '@nomix-ai/nomix-alpha': 'workspace:^' } }),
    ]

    // A cycle of two peer edges closed by one install edge: dropping a peer edge
    // would order this, and the traversal drops the install edge instead. That
    // order would publish charlie before the alpha it installs, so it is refused
    // here rather than published.
    expect(() => { nomix.publishOrder(members) }).toThrow(/no publish order honours @nomix-ai\/nomix-charlie -> @nomix-ai\/nomix-alpha/)
  })

  it('ignores devDependencies when ordering', () => {
    const nomix = releaseFamily('nomix')
    const members = [
      member('packages/a/alpha', '@nomix-ai/nomix-alpha', { devDependencies: { '@nomix-ai/nomix-zebra': 'workspace:^' } }),
      member('packages/a/zebra', '@nomix-ai/nomix-zebra'),
    ]

    // A dev dependency is absent from the published package, so it must not move
    // the consumer behind it.
    expect(nomix.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@nomix-ai/nomix-alpha',
      '@nomix-ai/nomix-zebra',
    ])
  })

  it('applies the harness payload policy to nomix and keeps upstream payloads for vendored packages', () => {
    const nomix = releaseFamily('nomix')
    const vendor = releaseFamily('vendor')
    const harness = member('packages/a/library', '@nomix-ai/nomix-library')
    const vendored = member('vendor/cordis', '@nomix-ai/cordis')

    expect(() => { nomix.validatePayload(harness, ['package/lib/index.js', 'package/src/index.ts']) })
      .toThrow(/publishes source file/)
    expect(() => {
      nomix.validatePayload(harness, [
        'package/dist/cli/bin.js',
        'package/dist/plugin-api/index.js',
        'package/dist/plugins/manifest.json',
        'package/dist/bundles/manifest.json',
        'package/dist/kernel/manifest.json',
        'package/dist/sdk/index.js',
      ])
    }).not.toThrow()
    expect(() => { nomix.validatePayload(harness, ['package/dist/cli/bin.js']) }).toThrow(/carries no dist\/plugins\/manifest.json/)
    expect(() => {
      nomix.validatePayload(harness, [
        'package/dist/cli/bin.js',
        'package/dist/plugin-api/index.js',
        'package/dist/plugins/manifest.json',
        'package/dist/bundles/manifest.json',
        'package/dist/kernel/manifest.json',
        'package/dist/sdk/index.js',
        'package/dist/node_modules/example/index.js',
      ])
    }).toThrow(/forbidden source, source-map, or node_modules/)
    expect(() => { vendor.validatePayload(vendored, ['package/lib/index.js', 'package/src/index.ts']) }).not.toThrow()
    expect(() => { vendor.validatePayload(vendored, []) }).toThrow(/empty tarball/)
  })

  it('drives the installed entry only for the family that publishes one', () => {
    expect(releaseFamily('nomix').installedEntry).toEqual({
      packageName: '@nomix-ai/nomix-harness',
      command: 'nomix',
      smokeArgs: ['web', '--help'],
      smokeOutput: 'Usage: nomix --profile web',
      startupArgs: ['web', '--host', '127.0.0.1', '--port', '0'],
      startupOutput: 'nomix web: http://127.0.0.1:',
    })
    expect(releaseFamily('vendor').installedEntry).toBeUndefined()
  })

  it('rejects an unknown family identifier', () => {
    expect(() => { releaseFamily('native') }).toThrow(/unknown release family/)
  })
})

describe('vendored version baseline', () => {
  it('drops an upstream prerelease segment and increments the patch', () => {
    expect(nextVendorVersion('4.0.0-rc.7', undefined)).toBe('4.0.1')
    expect(nextVendorVersion('1.0.0-rc.5', undefined)).toBe('1.0.1')
    expect(nextVendorVersion('1.8.1', undefined)).toBe('1.8.2')
  })

  it('increments from the last published version when a re-sync restored a lower one', () => {
    // Upstream moved rc.7 -> rc.8 after this repository published 4.0.1;
    // incrementing the manifest alone would name 4.0.1 a second time.
    expect(nextVendorVersion('4.0.0-rc.8', '4.0.1')).toBe('4.0.2')
    expect(nextVendorVersion('4.1.0', '4.0.1')).toBe('4.1.1')
  })

  it('appends a rehearsal prerelease without consuming its release numbers', () => {
    // A rehearsal burns 4.0.1-rc.1 and leaves 4.0.1 free, so the stable release
    // that follows takes those same numbers instead of skipping to 4.0.2.
    expect(nextVendorVersion('4.0.0-rc.7', undefined, 'rc.1')).toBe('4.0.1-rc.1')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1-rc.1', 'rc.2')).toBe('4.0.1-rc.2')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1-rc.1')).toBe('4.0.1')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1')).toBe('4.0.2')
  })
})

describe('version precedence', () => {
  it('ranks a release above the prerelease it follows', () => {
    // git --sort=v:refname disagrees, placing 4.0.1-rc.1 above 4.0.1, which is
    // why the newest published version is chosen here rather than by git.
    expect(compareVersions('4.0.1', '4.0.1-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1')).toBeLessThan(0)
  })

  it('compares numeric prerelease fields numerically', () => {
    expect(compareVersions('4.0.1-rc.10', '4.0.1-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.2', '4.0.1-rc.10')).toBeLessThan(0)
  })

  it('ranks a numeric field below an alphanumeric one, and a shorter list below a longer', () => {
    expect(compareVersions('4.0.1-1', '4.0.1-alpha')).toBeLessThan(0)
    expect(compareVersions('4.0.1-rc', '4.0.1-rc.1')).toBeLessThan(0)
    expect(compareVersions('4.0.2', '4.0.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1-rc.1')).toBe(0)
  })
})

describe('payload change judgement', () => {
  const sourceShipping = member('vendor/cosmokit', '@nomix-ai/cosmokit', {
    files: ['lib/index.js', 'lib/types/**/*.d.ts', 'src'],
  })
  const buildOutputOnly = member('vendor/cordis', '@nomix-ai/cordis', {
    files: ['lib/index.js', 'lib/types/**/*.d.ts', 'bin.js'],
  })

  it('counts the manifest and the files npm always publishes', () => {
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/package.json')).toBe(true)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/README.md')).toBe(true)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/src/index.ts')).toBe(true)
  })

  it('counts build inputs for a package whose payload is build output', () => {
    // cordis publishes lib/ only, and lib/ is not tracked: without this, a real
    // source change reads as "nothing changed" and the next publish fails on a
    // version whose bytes moved.
    expect(reachesPayload(buildOutputOnly, 'vendor/cordis/src/context.ts')).toBe(true)
    expect(reachesPayload(buildOutputOnly, 'vendor/cordis/tsconfig.json')).toBe(true)
  })

  it('ignores paths no tarball carries', () => {
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/tests/unit.spec.ts')).toBe(false)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/CHANGELOG.md')).toBe(false)
    // The README pattern is deliberately loose: over-reporting a change costs one
    // unnecessary patch bump, while under-reporting fails the next publish on a
    // version whose bytes moved.
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/README.i18n.yaml')).toBe(true)
    expect(reachesPayload(member('packages/a/library', '@nomix-ai/nomix-library', { files: ['lib/index.js'] }),
      'packages/a/library/tests/library.spec.ts')).toBe(false)
  })
})
