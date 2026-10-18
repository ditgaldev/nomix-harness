/**
 * The identity, timestamp, link, mutation, and durability-sink guarantees
 * MemoryVfs owes its consumers, asserted directly rather than through the
 * `node:fs` bridge.
 *
 * `nomix-fs-local` builds a version token from `dev:ino:size:mtimeNs:ctimeNs` and
 * refuses a write whose token moved since it read. Two properties carry that:
 * `ino` identifies the entry at a path, and `mtimeMs` moves on every write. The
 * timestamp cases freeze the clock, because these writes are in memory and two
 * revisions routinely land in the same millisecond — a real-clock test passes
 * whether or not the strict increment exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryVfs } from '../../src/storage/memory.ts'
import type { VfsBigIntStats, VfsMutation, VfsMutationSink, VfsStats } from '../../src/storage/types.ts'

const identity = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).ino

const linkCount = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).nlink

const modified = (vfs: MemoryVfs, path: string): number => (vfs.statSync(path) as VfsStats).mtimeMs

afterEach(() => { vi.restoreAllMocks() })

describe('entry identity', () => {
  it('distinguishes paths and holds each identity across repeated stats', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/one.txt', 'one')
    vfs.seed('/nomix/two.txt', 'two')
    const first = identity(vfs, '/nomix/one.txt')
    expect(identity(vfs, '/nomix/two.txt')).not.toBe(first)
    expect(identity(vfs, '/nomix/one.txt')).toBe(first)
  })

  it('forgets the identities under a directory removed as a subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/skills/git/SKILL.md', '# git\n')
    const before = identity(vfs, '/nomix/skills/git/SKILL.md')
    vfs.rmSync('/nomix/skills', { recursive: true })
    vfs.seed('/nomix/skills/git/SKILL.md', '# git rebuilt\n')
    expect(identity(vfs, '/nomix/skills/git/SKILL.md')).not.toBe(before)
  })

  it('moves the source identity when a file replaces another path', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/from.txt', 'moved')
    vfs.seed('/nomix/to.txt', 'replaced')
    const [source, destination] = [identity(vfs, '/nomix/from.txt'), identity(vfs, '/nomix/to.txt')]
    vfs.renameSync('/nomix/from.txt', '/nomix/to.txt')
    const renamed = identity(vfs, '/nomix/to.txt')
    expect(vfs.readFileSync('/nomix/to.txt', 'utf8')).toBe('moved')
    expect([renamed === source, renamed === destination]).toEqual([true, false])
  })
})

describe('modification time', () => {
  it('hydrates explicit metadata without confusing timestamps with permission bits', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/restored', 'value', { mode: 0o600, mtimeMs: 1_600_000_000_000 })
    vfs.seedDirectory('/nomix/restored-directory', { mode: 0o700, mtimeMs: 1_600_000_000_001 })
    const stats = vfs.statSync('/nomix/restored') as VfsStats
    const directory = vfs.statSync('/nomix/restored-directory') as VfsStats
    expect([stats.mode & 0o777, stats.mtimeMs]).toEqual([0o600, 1_600_000_000_000])
    expect([directory.mode & 0o777, directory.mtimeMs]).toEqual([0o700, 1_600_000_000_001])
  })

  it('advances on every write even while the clock stands still', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/log.jsonl', 'first\n')
    const seeded = modified(vfs, '/nomix/log.jsonl')
    vfs.writeFileSync('/nomix/log.jsonl', 'second\n')
    const written = modified(vfs, '/nomix/log.jsonl')
    vfs.appendFileSync('/nomix/log.jsonl', 'third\n')
    const appended = modified(vfs, '/nomix/log.jsonl')
    vfs.truncateSync('/nomix/log.jsonl', 6)
    const truncated = modified(vfs, '/nomix/log.jsonl')
    expect([written > seeded, appended > written, truncated > appended]).toEqual([true, true, true])
    // One millisecond per revision: the increment is the minimum that separates
    // two tokens, not a coarser bump that would skew a real timestamp.
    expect(truncated - seeded).toBe(3)
  })

  it('takes the clock once the clock has passed the entry', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/log.jsonl', 'first\n')
    clock.mockReturnValue(1_700_000_005_000)
    vfs.writeFileSync('/nomix/log.jsonl', 'second\n')
    expect(modified(vfs, '/nomix/log.jsonl')).toBe(1_700_000_005_000)
  })

  it('extends truncation with zero bytes', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/file', new Uint8Array([1, 2]))
    vfs.truncateSync('/nomix/file', 5)
    expect([...vfs.readFileSync('/nomix/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0])
    const handle = vfs.open('/nomix/file', 'r+')
    await handle.truncate(7)
    expect([...vfs.readFileSync('/nomix/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0, 0, 0])
  })

  it('advances a directory only when its immediate entry set changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/nomix/workspace')
    const empty = modified(vfs, '/nomix/workspace')
    vfs.writeFileSync('/nomix/workspace/file.txt', 'one')
    const created = modified(vfs, '/nomix/workspace')
    vfs.writeFileSync('/nomix/workspace/file.txt', 'two')
    const rewritten = modified(vfs, '/nomix/workspace')
    vfs.rmSync('/nomix/workspace/file.txt')
    const removed = modified(vfs, '/nomix/workspace')
    expect([created > empty, rewritten === created, removed > rewritten]).toEqual([true, true, true])
  })
})

describe('mutation publication', () => {
  it('publishes only committed runtime changes and keeps image seeding silent', () => {
    const vfs = new MemoryVfs()
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.seed('/nomix/seeded.txt', 'seeded')
    expect(mutations).toEqual([])
    vfs.writeFileSync('/nomix/seeded.txt', 'changed')
    vfs.mkdirSync('/nomix/created')
    vfs.chmodSync('/nomix/created', 0o700)
    vfs.renameSync('/nomix/seeded.txt', '/nomix/renamed.txt')
    vfs.rmSync('/nomix/created', { recursive: true })
    expect(mutations.map(mutation => ({
      kind: mutation.kind,
      path: mutation.path,
      ...mutation.kind === 'write' ? { entryChanged: mutation.entryChanged } : {},
      ...mutation.kind === 'chmod' ? { mode: mutation.mode } : {},
    }))).toEqual([
      { kind: 'write', path: '/nomix/seeded.txt', entryChanged: false },
      { kind: 'mkdir', path: '/nomix/created' },
      { kind: 'chmod', path: '/nomix/created', mode: 0o700 },
      { kind: 'remove', path: '/nomix/seeded.txt' },
      { kind: 'write', path: '/nomix/renamed.txt', entryChanged: true },
      { kind: 'remove', path: '/nomix/created' },
    ])
    const renamed = mutations[4]
    expect(renamed?.kind === 'write' && new TextDecoder().decode(renamed.bytes)).toBe('changed')
    expect(() => { vfs.writeFileSync('/missing/file', 'no') }).toThrow(/ENOENT/)
    expect(mutations).toHaveLength(6)
  })

  it('contains a faulty observer and lets disposal stop later notifications', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/nomix')
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vfs.subscribe(() => { throw new Error('observer failed') })
    const seen: string[] = []
    const second = vfs.subscribe((mutation) => { seen.push(mutation.path) })
    vfs.writeFileSync('/nomix/one', '1')
    first()
    second()
    vfs.writeFileSync('/nomix/two', '2')
    expect(seen).toEqual(['/nomix/one'])
    expect(reported).toHaveBeenCalledOnce()
  })

  it('feeds the same complete mutations to a durable sink and live subscribers', async () => {
    const recorded: VfsMutation[] = []
    let flushes = 0
    const sink: VfsMutationSink = {
      record: (mutation) => { recorded.push(mutation) },
      flush: async () => { flushes += 1 },
    }
    const vfs = new MemoryVfs({ sink })
    vfs.seedDirectory('/nomix')
    const observed: VfsMutation[] = []
    vfs.subscribe((mutation) => { observed.push(mutation) })
    vfs.writeFileSync('/nomix/log', 'a')
    vfs.appendFileSync('/nomix/log', 'bc')
    await vfs.flush()
    expect(observed).toEqual(recorded)
    expect(observed[0]).toBe(recorded[0])
    expect(recorded[0]).toMatchObject({ kind: 'write', path: '/nomix/log', mode: 0o644, entryChanged: true })
    expect(recorded[1]).toMatchObject({ kind: 'write', path: '/nomix/log', mode: 0o644, entryChanged: false, appendedFrom: 1 })
    expect(recorded[1]?.kind === 'write' && new TextDecoder().decode(recorded[1].bytes)).toBe('abc')
    expect(flushes).toBe(1)
  })

  it('publishes descriptor writes at the file identity current path', () => {
    const mutations: VfsMutation[] = []
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/source', 'old')
    const descriptor = vfs.openFileSync('/nomix/source', 'r+')
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.renameSync('/nomix/source', '/nomix/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('new'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nomix/destination'])
    expect(vfs.readFileSync('/nomix/destination', 'utf8')).toBe('new')
    vfs.unlinkSync('/nomix/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('detached'))
    expect(mutations).toEqual([])
    expect(new TextDecoder().decode(descriptor.read(0, descriptor.stat().size))).toBe('detached')
  })

  it('reports the path identity through a BigInt file handle stat', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/session.lock', '')
    const handle = vfs.open('/nomix/session.lock', 'w')
    const held = await handle.stat({ bigint: true }) as VfsBigIntStats
    const current = vfs.statSync('/nomix/session.lock', { bigint: true }) as VfsBigIntStats

    expect([held.dev, held.ino]).toEqual([current.dev, current.ino])
    await handle.chmod(0o600)
    expect((vfs.statSync('/nomix/session.lock') as VfsStats).mode & 0o777).toBe(0o600)
    await handle.close()
  })

  it('decomposes a directory rename into replayable destination state', () => {
    const recorded: VfsMutation[] = []
    const vfs = new MemoryVfs({
      sink: { record: (mutation) => { recorded.push(mutation) }, flush: () => Promise.resolve() },
    })
    vfs.seedDirectory('/nomix/staging/nested', { mode: 0o700 })
    vfs.seed('/nomix/staging/nested/file', 'value', { mode: 0o600 })
    vfs.renameSync('/nomix/staging', '/nomix/published')

    expect(recorded.map(mutation => [mutation.kind, mutation.path])).toEqual([
      ['remove', '/nomix/staging'],
      ['mkdir', '/nomix/published'],
      ['mkdir', '/nomix/published/nested'],
      ['write', '/nomix/published/nested/file'],
    ])
    expect(recorded[3]).toMatchObject({ kind: 'write', mode: 0o600, entryChanged: true })
    expect(recorded[3]?.kind === 'write' && new TextDecoder().decode(recorded[3].bytes)).toBe('value')
  })
})

describe('directory rename', () => {
  it('rejects file, non-empty directory, and missing-parent destinations before mutation', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/source/nested/file', 'source')
    vfs.seed('/nomix/file', 'destination')
    vfs.seed('/nomix/non-empty/child', 'destination')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    expect(() => { vfs.renameSync('/nomix/source', '/nomix/file') })
      .toThrow(expect.objectContaining({ code: 'ENOTDIR' }))
    expect(() => { vfs.renameSync('/nomix/source', '/nomix/non-empty') })
      .toThrow(expect.objectContaining({ code: 'ENOTEMPTY' }))
    expect(() => { vfs.renameSync('/nomix/source', '/missing/destination') })
      .toThrow(expect.objectContaining({ code: 'ENOENT' }))

    expect(vfs.readFileSync('/nomix/source/nested/file', 'utf8')).toBe('source')
    expect(vfs.readFileSync('/nomix/file', 'utf8')).toBe('destination')
    expect(vfs.readFileSync('/nomix/non-empty/child', 'utf8')).toBe('destination')
    expect(mutations).toEqual([])
  })

  it('replaces an empty directory with the source subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/nomix/source/nested', { mode: 0o700 })
    vfs.seed('/nomix/source/nested/file', 'source')
    vfs.seedDirectory('/nomix/destination', { mode: 0o711 })

    vfs.renameSync('/nomix/source', '/nomix/destination')

    expect(vfs.existsSync('/nomix/source')).toBe(false)
    expect(vfs.readFileSync('/nomix/destination/nested/file', 'utf8')).toBe('source')
    expect((vfs.statSync('/nomix/destination') as VfsStats).mode & 0o777).toBe(0o755)
    expect((vfs.statSync('/nomix/destination/nested') as VfsStats).mode & 0o777).toBe(0o700)
  })
})

describe('hard links', () => {
  it('shares identity, bytes, and mode until one name is removed', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/session.jsonl', 'committed\n')
    vfs.linkSync('/nomix/session.jsonl', '/nomix/session-latest.jsonl')
    vfs.linkSync('/nomix/session-latest.jsonl', '/nomix/session-archive.jsonl')
    expect(identity(vfs, '/nomix/session-latest.jsonl')).toBe(identity(vfs, '/nomix/session.jsonl'))
    expect(linkCount(vfs, '/nomix/session.jsonl')).toBe(3n)
    expect(vfs.readFileSync('/nomix/session-latest.jsonl', 'utf8')).toBe('committed\n')
    const changedPaths: string[] = []
    vfs.subscribe((mutation) => { changedPaths.push(mutation.path) })
    vfs.appendFileSync('/nomix/session.jsonl', 'appended\n')
    expect(changedPaths).toEqual([
      '/nomix/session.jsonl',
      '/nomix/session-latest.jsonl',
      '/nomix/session-archive.jsonl',
    ])
    expect(vfs.readFileSync('/nomix/session.jsonl', 'utf8')).toBe('committed\nappended\n')
    expect(vfs.readFileSync('/nomix/session-latest.jsonl', 'utf8')).toBe('committed\nappended\n')
    vfs.chmodSync('/nomix/session-latest.jsonl', 0o600)
    expect((vfs.statSync('/nomix/session.jsonl') as VfsStats).mode & 0o777).toBe(0o600)
    vfs.unlinkSync('/nomix/session-latest.jsonl')
    expect(linkCount(vfs, '/nomix/session.jsonl')).toBe(2n)
    vfs.unlinkSync('/nomix/session-archive.jsonl')
    expect(linkCount(vfs, '/nomix/session.jsonl')).toBe(1n)
    expect(vfs.readFileSync('/nomix/session.jsonl', 'utf8')).toBe('committed\nappended\n')
  })

  it('treats rename between names of the same node as a no-op', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/source', 'value')
    vfs.linkSync('/nomix/source', '/nomix/alias')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    vfs.renameSync('/nomix/source', '/nomix/alias')

    expect(vfs.readFileSync('/nomix/source', 'utf8')).toBe('value')
    expect(vfs.readFileSync('/nomix/alias', 'utf8')).toBe('value')
    expect(linkCount(vfs, '/nomix/source')).toBe(2n)
    expect(mutations).toEqual([])
  })

  it('retargets linked names through file replacement and directory moves', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/replacement', 'replacement')
    vfs.seed('/nomix/target', 'old')
    vfs.linkSync('/nomix/target', '/nomix/target-alias')
    const replaced = vfs.openFileSync('/nomix/target', 'r+')
    vfs.renameSync('/nomix/replacement', '/nomix/target')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    replaced.write(0, new TextEncoder().encode('changed'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nomix/target-alias'])
    expect(vfs.readFileSync('/nomix/target', 'utf8')).toBe('replacement')
    expect(vfs.readFileSync('/nomix/target-alias', 'utf8')).toBe('changed')
    expect(linkCount(vfs, '/nomix/target-alias')).toBe(1n)

    vfs.seed('/nomix/tree/file', 'tree')
    vfs.linkSync('/nomix/tree/file', '/nomix/outside')
    const moved = vfs.openFileSync('/nomix/tree/file', 'r+')
    vfs.renameSync('/nomix/tree', '/nomix/moved')
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('moved'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nomix/outside', '/nomix/moved/file'])
    expect(linkCount(vfs, '/nomix/moved/file')).toBe(2n)

    vfs.rmSync('/nomix/moved', { recursive: true })
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('kept!'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/nomix/outside'])
    expect(vfs.readFileSync('/nomix/outside', 'utf8')).toBe('kept!')
    expect(linkCount(vfs, '/nomix/outside')).toBe(1n)
  })

  it('rejects renaming a file over an existing directory', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/nomix/file', 'value')
    vfs.seedDirectory('/nomix/directory')
    expect(() => { vfs.renameSync('/nomix/file', '/nomix/directory') }).toThrow(expect.objectContaining({ code: 'EISDIR' }))
    expect(vfs.readFileSync('/nomix/file', 'utf8')).toBe('value')
    expect(vfs.statSync('/nomix/directory').isDirectory()).toBe(true)
  })
})
