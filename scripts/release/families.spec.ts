/** Release family discovery, publish order, tag naming, and the bump judgements. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { officialClientBuildEnvironment, writeClientBuildRecord } from '../client-build-environment.ts'
import { releaseFamily, type ReleaseMember } from './families.ts'
import { compareVersions, nextVendorVersion, planShared, reachesPayload } from './bump.ts'

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

const roots: string[] = []

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function buildFixture(environment: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'nomix-release-build-'))
  roots.push(root)
  write(join(root, 'package.json'), `${JSON.stringify({ version: environment.NOMIX_CLIENT_VERSION ?? '0.0.1' })}\n`)
  write(join(root, 'apps/web/dist/index.html'), '<main></main>')
  write(join(root, 'packages/client/example/lib/client.js'), 'module.exports = {}\n')
  writeClientBuildRecord(root, environment)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('release families', () => {
  it('publishes all current experimental packages', () => {
    const members = releaseFamily('nomix').members(resolve(import.meta.dirname, '../..'))

    expect(members
      .filter(member => member.directory.startsWith('packages/experimental/'))
      .map(member => member.name)).toEqual([
      '@nomix-ai/nomix-experimental-agent-team-profile',
      '@nomix-ai/nomix-experimental-agent-team',
      '@nomix-ai/nomix-experimental-api-speech-to-text',
      '@nomix-ai/nomix-experimental-auto-review',
      '@nomix-ai/nomix-experimental-badge-skill-bundle',
      '@nomix-ai/nomix-experimental-browser-use-chrome-devtools-mcp',
      '@nomix-ai/nomix-experimental-browser-use-playwright-mcp',
      '@nomix-ai/nomix-experimental-browser-use-runtime',
      '@nomix-ai/nomix-experimental-browser-use-stagehand-native',
      '@nomix-ai/nomix-experimental-claude-code-mods',
      '@nomix-ai/nomix-experimental-client-ui-agent-team',
      '@nomix-ai/nomix-experimental-client-ui-claude-code-mods',
      '@nomix-ai/nomix-experimental-client-ui-cot-translation',
      '@nomix-ai/nomix-experimental-client-ui-voice-input',
      '@nomix-ai/nomix-experimental-computer-use-cua-driver-mcp',
      '@nomix-ai/nomix-experimental-computer-use-cua-driver-native',
      '@nomix-ai/nomix-experimental-cot-translation-bundle',
      '@nomix-ai/nomix-experimental-cua-macos',
      '@nomix-ai/nomix-cua',
      '@nomix-ai/nomix-hook-protocol',
      '@nomix-ai/nomix-hooks-claude-code',
      '@nomix-ai/nomix-hooks-codex',
      '@nomix-ai/nomix-experimental-inspector-profile',
      '@nomix-ai/nomix-experimental-inspector',
      '@nomix-ai/nomix-experimental-plugin-market-bundle',
      '@nomix-ai/nomix-experimental-ptc-runtime-python',
      '@nomix-ai/nomix-experimental-ralph-bundle',
      '@nomix-ai/nomix-experimental-session-inspector',
      '@nomix-ai/nomix-experimental-session-search',
      '@nomix-ai/nomix-session-title-all-prompts-llm',
      '@nomix-ai/nomix-experimental-session-titles-bundle',
      '@nomix-ai/nomix-skill-badge',
      '@nomix-ai/nomix-experimental-speech-to-text-sensevoice',
      '@nomix-ai/nomix-experimental-speech-to-text',
      '@nomix-ai/nomix-experimental-terminal-bundle',
      '@nomix-ai/nomix-experimental-tool-agent-team',
      '@nomix-ai/nomix-tool-ralph',
      '@nomix-ai/nomix-tool-session-query',
      '@nomix-ai/nomix-tool-terminal',
      '@nomix-ai/nomix-experimental-tool-worktree',
      '@nomix-ai/nomix-experimental-translator',
      '@nomix-ai/nomix-experimental-voice-input-bundle',
      '@nomix-ai/nomix-webhook-github',
      '@nomix-ai/nomix-webhook',
      '@nomix-ai/nomix-experimental-webworker-packer',
      '@nomix-ai/nomix-experimental-webworker-runtime',
      '@nomix-ai/nomix-experimental-worktree',
    ])
  })

  it('excludes private applications from the publish set', () => {
    const root = mkdtempSync(join(tmpdir(), 'nomix-release-private-'))
    roots.push(root)
    write(join(root, 'apps/public/package.json'), '{"name":"@nomix-ai/nomix-public","version":"0.0.1"}\n')
    write(join(root, 'apps/private/package.json'), '{"name":"@nomix-ai/nomix-private","version":"0.0.1","private":true}\n')

    expect(releaseFamily('nomix').members(root).map(entry => entry.name)).toEqual(['@nomix-ai/nomix-public'])
  })

  it('publishes unlisted experimental packages while retaining private exclusions', () => {
    const root = mkdtempSync(join(tmpdir(), 'nomix-release-experimental-'))
    roots.push(root)
    write(join(root, 'packages/experimental/prototype/package.json'), JSON.stringify({
      name: '@nomix-ai/nomix-experimental-prototype',
      version: '0.0.1',
      publishConfig: { access: 'public' },
    }))
    write(join(root, 'packages/experimental/inspector/package.json'), JSON.stringify({
      name: '@nomix-ai/nomix-experimental-inspector',
      version: '0.0.1',
      private: true,
    }))

    expect(releaseFamily('nomix').members(root).map(entry => entry.name)).toEqual([
      '@nomix-ai/nomix-experimental-prototype',
    ])
  })

  it('bumps private nomix workspaces without adding release tags', () => {
    const root = mkdtempSync(join(tmpdir(), 'nomix-release-version-'))
    roots.push(root)
    write(join(root, 'package.json'), '{"version":"0.0.1"}\n')
    write(join(root, 'apps/desktop/package.json'), '{"version":"0.0.1","private":true}\n')
    write(join(root, 'packages/experimental/prototype/package.json'), '{"version":"0.0.1","private":true}\n')
    write(join(root, 'packages/core/unselected/package.json'), '{"version":"0.0.1"}\n')

    const nomix = releaseFamily('nomix')
    const published = member('packages/core/published', '@nomix-ai/nomix-published')
    const { planned } = planShared(nomix, root, [published], '0.0.2')

    expect(planned.map(entry => ({ path: entry.manifestPath, tag: entry.tag }))).toEqual([
      { path: 'package.json', tag: undefined },
      { path: 'packages/core/published/package.json', tag: 'nomix-v0.0.2' },
      { path: 'apps/desktop/package.json', tag: undefined },
      { path: 'packages/experimental/prototype/package.json', tag: undefined },
    ])
  })

  it.each(['0.0.2-alpha.1', '0.0.2-canary.1', '0.0.2-rc.1'])(
    'accepts the explicit nomix prerelease version %s',
    (version) => {
      const root = mkdtempSync(join(tmpdir(), 'nomix-release-prerelease-'))
      roots.push(root)
      write(join(root, 'package.json'), '{"version":"0.0.1"}\n')

      const nomix = releaseFamily('nomix')
      const published = member('packages/core/published', '@nomix-ai/nomix-published')
      const plan = planShared(nomix, root, [published], version)

      expect(plan.version).toBe(version)
      expect(plan.planned[1]?.tag).toBe(`nomix-v${version}`)
    },
  )

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

  it('publishes Nomix as one aggregate package from its dedicated branch', () => {
    const nomix = releaseFamily('nomix')
    const harness = member('apps/cli', '@nomix-ai/nomix-harness')
    const internal = member('packages/core/agent', '@nomix-ai/nomix-agent')

    expect(nomix.publicationMembers([internal, harness])).toEqual([harness])
    expect(nomix.publicationRefs([internal, harness])).toEqual([
      'refs/heads/npm-nomix-harness',
      'refs/tags/nomix-v0.0.1',
    ])
    expect(nomix.packing).toBe('bundled-workspaces')
  })

  it('assigns alpha and canary dist-tags only to nomix releases', () => {
    const nomix = releaseFamily('nomix')
    const vendor = releaseFamily('vendor')

    expect(nomix.distTagForVersion('0.0.2-alpha.1')).toBe('alpha')
    expect(nomix.distTagForVersion('0.0.2-canary.1')).toBe('canary')
    expect(nomix.distTagForVersion('0.0.2-rc.1')).toBe('next')
    expect(nomix.distTagForVersion('0.0.2')).toBeUndefined()
    expect(vendor.distTagForVersion('4.0.1-alpha.1')).toBe('next')
    expect(vendor.distTagForVersion('4.0.1-canary.1')).toBe('next')
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

  it('requires a current official client build only for nomix artifacts', () => {
    const nomix = releaseFamily('nomix')
    const vendor = releaseFamily('vendor')
    const officialEnvironment = officialClientBuildEnvironment(resolve(import.meta.dirname, '../..'))
    vi.stubEnv('NOMIX_CLIENT_COMMIT_HASH', officialEnvironment.NOMIX_CLIENT_COMMIT_HASH)
    const official = buildFixture(officialEnvironment)
    const defaultBuild = buildFixture({})
    const missing = join(defaultBuild, 'missing')
    write(join(missing, 'package.json'), `${JSON.stringify({ version: officialEnvironment.NOMIX_CLIENT_VERSION })}\n`)

    expect(() => { nomix.verifyBuildArtifacts(official) }).not.toThrow()
    expect(() => { nomix.verifyBuildArtifacts(defaultBuild) }).toThrow(/NOMIX_CLIENT_TITLE/)
    expect(() => { nomix.verifyBuildArtifacts(missing) }).toThrow(/record.*missing/)
    expect(() => { vendor.verifyBuildArtifacts(missing) }).not.toThrow()

    write(join(official, 'packages/client/example/lib/client.js'), 'module.exports = { changed: true }\n')
    expect(() => { nomix.verifyBuildArtifacts(official) }).toThrow(/artifacts differ/)
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

  it('packs catalog providers in the aggregate without separate registry prerequisites', () => {
    const harness = member('apps/cli', '@nomix-ai/nomix-harness')
    expect(releaseFamily('nomix').publishOrder([harness]).order).toEqual([harness])
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'])(
    'requires exact packed NOMIX %s while preserving external ranges', (section) => {
      const pkg = member('packages/example/provider', '@nomix-ai/nomix-provider')
      const family = releaseFamily('nomix')
      const manifest = { name: pkg.name, version: pkg.version, [section]: { '@nomix-ai/nomix-tools': pkg.version, external: '^4.0.0' } }
      expect(() => { family.validatePackedManifest(pkg, manifest) }).not.toThrow()
      for (const range of ['workspace:*', '^0.0.1', '~0.0.1', '0.0.2', '*']) {
        expect(() => { family.validatePackedManifest(pkg, { ...manifest, [section]: { '@nomix-ai/nomix-tools': range } }) })
          .toThrow(`packed ${section}.@nomix-ai/nomix-tools must equal`)
      }
    },
  )

  it('checks packed identities and preserves independent vendor versions', () => {
    const pkg = member('vendor/example', '@nomix-ai/example')
    const family = releaseFamily('vendor')
    expect(() => { family.validatePackedManifest(pkg, { name: pkg.name, version: pkg.version, dependencies: { '@nomix-ai/nomix-tools': '^4.0.0' } }) })
      .not.toThrow()
    expect(() => { family.validatePackedManifest(pkg, { name: '@nomix-ai/other', version: pkg.version }) }).toThrow('packed identity')
    expect(() => { family.validatePackedManifest(pkg, { name: pkg.name, version: '0.0.2' }) }).toThrow('packed identity')
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
    expect(() => { vendor.validatePayload(vendored, ['package/lib/index.js', 'package/src/index.ts']) }).not.toThrow()
    expect(() => { vendor.validatePayload(vendored, []) }).toThrow(/empty tarball/)
  })

  it('requires every supported native payload in the aggregate tarball', () => {
    const harness = member('apps/cli', '@nomix-ai/nomix-harness')
    const files = [
      'package/dist/cli/bin.js',
      'package/node_modules/@nomix-ai/cordis/lib/index.js',
      'package/node_modules/@nomix-ai/nomix-agent/lib/index.js',
      'package/node_modules/@nomix-ai/nomix-web-app/cordis.patch.yml',
      'package/node_modules/@nomix-ai/nomix-web-frontend/dist/index.html',
      'package/node_modules/@nomix-ai/node-addon-system/lib/index.js',
      ...['linux-x64', 'linux-arm64'].flatMap(platform => [
        `package/node_modules/@nomix-ai/node-addon-system-${platform}/bin/landlock-run`,
        ...['glibc', 'musl'].map(libc => `package/node_modules/@nomix-ai/node-addon-system-${platform}/bin/${libc}/system.node`),
      ]),
      ...['darwin-x64', 'darwin-arm64'].map(platform => `package/node_modules/@nomix-ai/node-addon-system-${platform}/bin/system.node`),
    ]
    const family = releaseFamily('nomix')
    expect(() => { family.validatePayload(harness, files) }).not.toThrow()
    for (const missing of files.filter(file => file.includes('node-addon-system'))) {
      expect(() => { family.validatePayload(harness, files.filter(file => file !== missing)) }).toThrow(missing.slice('package/'.length))
    }
  })

  it('drives the installed entry only for the family that publishes one', () => {
    expect(releaseFamily('nomix').installedEntry).toEqual({
      packageName: '@nomix-ai/nomix-harness',
      binPath: 'dist/cli/bin.js',
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
  it('orders alpha, canary, and release-candidate versions by semver precedence', () => {
    expect(compareVersions('4.0.1-alpha.1', '4.0.1-canary.1')).toBeLessThan(0)
    expect(compareVersions('4.0.1-canary.1', '4.0.1-rc.1')).toBeLessThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1')).toBeLessThan(0)
  })

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
