/** Pack a release family and validate the exact npm tarballs. */

import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildNpmHarnessDistribution } from '../npm-harness-distribution.ts'
import { releaseFamily, tarballName, type ReleaseFamily, type ReleaseMember } from './families.ts'
import { isEntry, run } from './process.ts'
import { PUBLISH_ORDER_FILE, tarballFiles, validateNpmTarballListing, validateNpmTarballPaths } from './tarball.ts'

/** Where pack output lands when `--out` is omitted. */
const DEFAULT_OUTPUT = 'dist/npm'

/** Pack one member and validate its payload. */
function packMember(family: ReleaseFamily, member: ReleaseMember, destination: string): string {
  const filename = tarballName(member)
  if (family.packing === 'native-bundle') {
    const temporary = mkdtempSync(join(tmpdir(), 'nomix-npm-package-'))
    try {
      buildNpmHarnessDistribution(temporary)
      run('npm', ['pack', temporary, '--pack-destination', destination, '--ignore-scripts'])
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  } else {
    run('pnpm', ['--dir', member.directory, 'pack', '--pack-destination', destination])
  }

  const tarball = join(destination, filename)
  if (!existsSync(tarball)) throw new Error(`${member.name} produced no tarball at ${tarball}`)
  const files = tarballFiles(tarball)
  validateNpmTarballPaths(files)
  validateNpmTarballListing(tarball)
  family.validatePayload(member, files)
  console.log(
    `release pack: ${member.name}@${member.version}, ${String(files.length)} file(s),`
    + ` ${(statSync(tarball).size / (1024 * 1024)).toFixed(1)} MiB`,
  )
  return filename
}

/** Pack the family named by `--family` into `--out`. */
function main(): void {
  const { values } = parseArgs({
    options: { family: { type: 'string' }, out: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.family === undefined) throw new Error('usage: pack.ts --family <nomix|vendor> [--out dist/npm]')

  const family = releaseFamily(values.family)
  const root = process.cwd()
  const destination = resolve(root, values.out ?? DEFAULT_OUTPUT)
  const versionMembers = family.members(root)
  family.verifyVersions(versionMembers)
  const members = family.publishOrder(family.publicationMembers(versionMembers)).order

  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  const order = members.map(member => packMember(family, member, destination))
  writeFileSync(join(destination, PUBLISH_ORDER_FILE), `${order.join('\n')}\n`)
  console.log(`release pack: family ${family.id}, ${String(order.length)} tarball(s) in ${values.out ?? DEFAULT_OUTPUT}`)
}

if (isEntry(import.meta.url)) main()
