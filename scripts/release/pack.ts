/**
 * Pack one release family's registry packages into a single directory, in
 * publish order, and record that order for the publish step. A portable family
 * first deploys its production workspace tree and bundles that tree into its
 * entry package.
 *
 * The pack step is the release boundary: it runs without credentials, produces
 * every tarball from one commit, and hands the publish step exactly those bytes
 * ([rationale](../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { releaseFamily, tarballName, type ReleaseFamily, type ReleaseMember } from './families.ts'
import { isEntry, run } from './process.ts'
import { PUBLISH_ORDER_FILE, tarballFiles } from './tarball.ts'

/** Where pack output lands when `--out` is omitted. */
const DEFAULT_OUTPUT = 'dist/npm'

/**
 * Pack one member and check what its tarball carries.
 * @param family - the release family being packed.
 * @param member - the member to pack.
 * @param destination - absolute output directory.
 * @returns The tarball filename.
 */
function packMember(family: ReleaseFamily, member: ReleaseMember, destination: string): string {
  const filename = tarballName(member)
  if (family.packing === 'portable-deploy') {
    const deployment = mkdtempSync(join(tmpdir(), 'nomix-npm-deploy-'))
    try {
      run('pnpm', [
        '--filter',
        member.name,
        'deploy',
        '--legacy',
        '--prod',
        '--config.node-linker=hoisted',
        '--config.auto-install-peers=false',
        '--config.link-workspace-packages=true',
        deployment,
      ])
      run('tar', [
        '-czf',
        join(destination, filename),
        '--transform=s,^\\./,package/,',
        '-C',
        deployment,
        '.',
      ])
    } finally {
      rmSync(deployment, { recursive: true, force: true })
    }
  } else {
    run('pnpm', ['--dir', member.directory, 'pack', '--pack-destination', destination])
  }

  const tarball = join(destination, filename)
  if (!existsSync(tarball)) throw new Error(`${member.name} produced no tarball at ${tarball}`)
  family.validatePayload(member, tarballFiles(tarball))
  return filename
}

/** Pack the family named by `--family` into `--out`. */
function main(): void {
  const { values } = parseArgs({
    options: { family: { type: 'string' }, out: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.family === undefined) throw new Error('usage: pack.ts --family <dsh|vendor> [--out dist/npm]')

  const family = releaseFamily(values.family)
  const root = process.cwd()
  const destination = resolve(root, values.out ?? DEFAULT_OUTPUT)
  const versionMembers = family.members(root)
  family.verifyVersions(versionMembers)
  const members = family.publishOrder(family.publicationMembers(versionMembers)).order

  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })

  const order: string[] = []
  for (const member of members) order.push(packMember(family, member, destination))
  writeFileSync(join(destination, PUBLISH_ORDER_FILE), `${order.join('\n')}\n`)

  console.log(`release pack: family ${family.id}, ${String(order.length)} tarball(s) in ${values.out ?? DEFAULT_OUTPUT}`)
}

if (isEntry(import.meta.url)) main()
