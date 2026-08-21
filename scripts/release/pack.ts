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

import {
  cpSync,
  existsSync,
  globSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { releaseFamily, tarballName, type ReleaseFamily, type ReleaseMember } from './families.ts'
import { isEntry, run } from './process.ts'
import { PUBLISH_ORDER_FILE, tarballFiles, validateNpmTarballPaths } from './tarball.ts'

/** Where pack output lands when `--out` is omitted. */
const DEFAULT_OUTPUT = 'dist/npm'
const RUNTIME_DEPENDENCY_SECTIONS = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const
let workspaceInternalPackages: ReadonlyMap<string, string> | undefined

/**
 * Resolve one internal package from the built workspace source tree.
 * @param name - scoped package name.
 * @returns Its absolute directory, if this repository owns it.
 */
function workspaceInternalPackage(name: string): string | undefined {
  if (workspaceInternalPackages === undefined) {
    const packages = new Map<string, string>()
    const manifests = globSync([
      'apps/*/package.json',
      'packages/*/*/package.json',
      'vendor/*/package.json',
      'native/landlock-run/packages/*/package.json',
    ], { cwd: process.cwd() }).sort()
    for (const manifestPath of manifests) {
      const manifest = JSON.parse(readFileSync(resolve(process.cwd(), manifestPath), 'utf8')) as { name?: unknown }
      if (typeof manifest.name === 'string') packages.set(manifest.name, dirname(resolve(process.cwd(), manifestPath)))
    }
    workspaceInternalPackages = packages
  }
  return workspaceInternalPackages.get(name)
}

/**
 * Return the first symlink below a deployed node_modules tree, excluding its
 * virtual store because that store is removed after its package links are copied.
 * @param directory - directory to scan.
 * @param virtualStore - absolute `.pnpm` directory to skip.
 * @returns The symlink path, if one remains.
 */
function findDeployedSymlink(directory: string, virtualStore: string): string | undefined {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (path === virtualStore) continue
    const metadata = lstatSync(path)
    if (metadata.isSymbolicLink()) return path
    if (metadata.isDirectory()) {
      const nested = findDeployedSymlink(path, virtualStore)
      if (nested !== undefined) return nested
    }
  }
  return undefined
}

/**
 * Copy one internal package without its deploy-time dependency links.
 * @param source - real package directory.
 * @param destination - flattened package directory.
 */
function copyInternalPackage(source: string, destination: string): void {
  const nestedNodeModules = join(source, 'node_modules')
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(source, destination, {
    recursive: true,
    dereference: true,
    filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
  })
}

/**
 * Hoist every internal dependency reachable from the deployed top-level
 * packages. Legacy deploy can leave workspace dependencies only beside their
 * consumer, so scanning the virtual store alone does not find the whole set.
 * @param internalRoot - deployed `node_modules/@nomix-ai` directory.
 * @param virtualStore - deployed pnpm virtual store used only for named fallbacks.
 */
function restoreInternalClosure(internalRoot: string, virtualStore: string): void {
  const queue = readdirSync(internalRoot).sort()
  const visited = new Set<string>()
  while (queue.length > 0) {
    const packageName = queue.shift()
    if (packageName === undefined || visited.has(packageName)) continue
    visited.add(packageName)
    const packageDirectory = realpathSync(join(internalRoot, packageName))
    const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8')) as Record<string, unknown>
    for (const section of RUNTIME_DEPENDENCY_SECTIONS) {
      const dependencies = manifest[section]
      if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue
      for (const dependencyName of Object.keys(dependencies).filter(name => name.startsWith('@nomix-ai/')).sort()) {
        const unscoped = dependencyName.slice('@nomix-ai/'.length)
        const destination = join(internalRoot, unscoped)
        if (!existsSync(destination)) {
          let source: string | undefined
          for (let ancestor = packageDirectory; source === undefined;) {
            const candidate = join(ancestor, 'node_modules', ...dependencyName.split('/'))
            if (existsSync(candidate)) source = realpathSync(candidate)
            const parent = dirname(ancestor)
            if (parent === ancestor) break
            ancestor = parent
          }
          for (const entry of readdirSync(virtualStore).sort()) {
            if (source !== undefined) break
            const candidate = join(virtualStore, entry, 'node_modules', ...dependencyName.split('/'))
            if (existsSync(candidate)) source = realpathSync(candidate)
          }
          if (source === undefined && section === 'optionalDependencies') continue
          source ??= workspaceInternalPackage(dependencyName)
          if (source === undefined) {
            throw new Error(`${dependencyName} is absent from the deployed dependency tree of @nomix-ai/${packageName}`)
          }
          copyInternalPackage(source, destination)
        }
        queue.push(unscoped)
      }
    }
  }
}

/**
 * Replace deploy-time package links with package files and remove the duplicate
 * pnpm virtual store. Runtime dependencies then form one finite npm payload.
 * @param deployment - portable deployment root.
 */
function materializeDeployment(deployment: string): void {
  const nodeModules = join(deployment, 'node_modules')
  const virtualStore = join(nodeModules, '.pnpm')
  const internalRoot = join(nodeModules, '@nomix-ai')
  mkdirSync(internalRoot, { recursive: true })
  restoreInternalClosure(internalRoot, virtualStore)
  let link = findDeployedSymlink(nodeModules, virtualStore)
  while (link !== undefined) {
    const segments = link.slice(nodeModules.length + 1).split(sep)
    const binIndex = segments.lastIndexOf('.bin')
    if (binIndex >= 0) {
      rmSync(join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true })
    } else {
      const source = realpathSync(link)
      const nestedNodeModules = join(source, 'node_modules')
      rmSync(link, { recursive: true, force: true })
      mkdirSync(dirname(link), { recursive: true })
      cpSync(source, link, {
        recursive: true,
        dereference: true,
        filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
      })
    }
    link = findDeployedSymlink(nodeModules, virtualStore)
  }
  rmSync(virtualStore, { recursive: true, force: true })
  rmSync(join(nodeModules, '.modules.yaml'), { force: true })
}

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
    const archiveRoot = mkdtempSync(join(tmpdir(), 'nomix-npm-archive-'))
    const deployment = join(archiveRoot, 'package')
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
      materializeDeployment(deployment)
      run('tar', [
        '-czf',
        join(destination, filename),
        '-C',
        archiveRoot,
        'package',
      ])
    } finally {
      rmSync(archiveRoot, { recursive: true, force: true })
    }
  } else {
    run('pnpm', ['--dir', member.directory, 'pack', '--pack-destination', destination])
  }

  const tarball = join(destination, filename)
  if (!existsSync(tarball)) throw new Error(`${member.name} produced no tarball at ${tarball}`)
  const files = tarballFiles(tarball)
  validateNpmTarballPaths(files)
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
