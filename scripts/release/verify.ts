/**
 * Verify a release family's version baseline, and — when publishing — that the
 * run comes from an approved publication ref and its members are publishable.
 *
 * Publication happens only from GitHub Actions, so the ref and publishability
 * checks are gates on the workflow, not advisory local warnings
 * ([rationale](../../.agents/notes/implemented/process/2026-08-10-npm-release-sequences.md)).
 */

import { parseArgs } from 'node:util'
import { isEntry } from './process.ts'
import { releaseFamily, type PublishPlan, type ReleaseFamily, type ReleaseMember } from './families.ts'

/**
 * Print the publish order the release will follow, and the peer declarations it
 * leaves unordered.
 *
 * The order is the release's own plan: an interrupted publication leaves exactly
 * a prefix of it, so reading it is how anyone judges what a partial run left on
 * the registry, and printing it on every pull request is what makes a change to
 * the order reviewable rather than only observable during a publication.
 * @param family - the release family.
 * @param plan - the resolved order and its dropped edges.
 */
function reportPublishOrder(family: ReleaseFamily, plan: PublishPlan): void {
  console.log(`release verify: publish order for family ${family.id}, ${String(plan.order.length)} member(s):`)
  const width = String(plan.order.length).length
  for (const [index, member] of plan.order.entries()) {
    console.log(`  ${String(index + 1).padStart(width, ' ')}  ${member.name}@${member.version}`)
  }
  if (plan.droppedPeerEdges.length === 0) return
  console.log(
    `release verify: ${String(plan.droppedPeerEdges.length)} peer declaration(s) publish unordered,`
    + ' because the peer cannot precede the package declaring it without contradicting a dependency edge'
    + ' or its own cycle. npm treats an unmet peer as a warning, so this orders nothing and blocks nothing:',
  )
  for (const edge of plan.droppedPeerEdges) console.log(`  ${edge.consumer} -> ${edge.peer}`)
}

/**
 * Assert every member may be published: npm refuses a `private` package.
 * @param members - the family's members.
 */
function verifyPublishable(members: readonly ReleaseMember[]): void {
  const priv = members.filter(member => member.manifest.private === true)
  if (priv.length > 0) {
    throw new Error(`publishing requires removing "private": true from:\n${priv.map(member => member.directory).join('\n')}`)
  }
}

/**
 * Assert the workflow runs from a Git ref this family permits for publication.
 * @param family - the release family.
 * @param members - the family's members.
 * @param ref - the `GITHUB_REF` value.
 */
function verifyPublicationRef(family: ReleaseFamily, members: readonly ReleaseMember[], ref: string): void {
  const expected = family.publicationRefs(members)
  if (!expected.includes(ref)) {
    throw new Error(
      `publishing release family ${family.id} requires one of these Git refs:\n${expected.join('\n')}\ngot ${ref || '(no ref)'}`,
    )
  }
}

/** Run the verification for the family named by `--family`. */
function main(): void {
  const { values } = parseArgs({
    options: { family: { type: 'string' } },
    allowPositionals: false,
  })
  if (values.family === undefined) throw new Error('usage: verify.ts --family <nomix|vendor>')

  const family = releaseFamily(values.family)
  const versionMembers = family.members(process.cwd())
  family.verifyVersions(versionMembers)
  const members = family.publicationMembers(versionMembers)
  // Resolve the publish order here, before the build: an install-edge cycle
  // makes the order unrepresentable, and that has to surface at the first gate
  // rather than when pack is already writing tarballs.
  const plan = family.publishOrder(members)
  if (plan.order.length !== members.length) {
    throw new Error(
      `release family ${family.id}: publish order covers ${String(plan.order.length)} of ${String(members.length)} members`,
    )
  }
  reportPublishOrder(family, plan)

  const publishing = process.env.RELEASE_PUBLISH === 'true'
  if (publishing) {
    verifyPublishable(members)
    verifyPublicationRef(family, members, process.env.GITHUB_REF ?? '')
  }

  const versions = [...new Set(versionMembers.map(member => member.version))]
  const summary = versions.length === 1 ? versions[0] : `${String(versions.length)} versions`
  console.log(
    `release verify: family ${family.id}, ${String(versionMembers.length)} version member(s),`
    + ` ${String(members.length)} registry package(s), ${summary},`
    + ` publish order resolved, ${String(plan.droppedPeerEdges.length)} peer declaration(s) unordered`
    + (publishing ? ', publish gates passed' : ''),
  )
}

if (isEntry(import.meta.url)) main()
