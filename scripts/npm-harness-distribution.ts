/** Build the standard, script-free @nomix-ai/nomix-harness npm payload. */

import {
  cpSync,
  existsSync,
  globSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Required distribution classification for every workspace. */
export type WorkspaceDistribution =
  | 'plugin'
  | 'bundle'
  | 'runtime'
  | 'sdk'
  | 'development-only'
  | 'separate-distribution'

/** One workspace package used by the aggregate distribution. */
interface WorkspacePackage {
  readonly directory: string
  readonly name: string
  readonly id: string
  readonly manifest: Record<string, unknown>
  readonly classification: WorkspaceDistribution
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const INTERNAL_PREFIX = '@nomix-ai/nomix-'
const TEXT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.d.ts', '.json', '.yml', '.yaml', '.css', '.html'])
const INTERNAL_MODULE_SPECIFIER = new RegExp(
  String.raw`(\bfrom\s+|\b(?:import|require(?:\.resolve)?)\s*\(\s*|import\.meta\.resolve\s*\(\s*|\bimport\s+)`
  + String.raw`(['"])(@nomix-ai\/[^/'"]+)(?:\/([^'"]+))?\2`,
  'gu',
)

/** Classify a workspace by ownership and runtime role. */
export function classifyWorkspace(directory: string): WorkspaceDistribution {
  const normalized = directory.replaceAll('\\', '/')
  if (normalized.startsWith('vendor/')) return 'runtime'
  if (normalized === 'native/landlock-run/packages/entry') return 'runtime'
  if (normalized.startsWith('native/') || normalized.startsWith('python/')) return 'separate-distribution'
  if (normalized === 'website' || normalized.startsWith('packages/test-support/') || normalized.startsWith('packages/examples/')) {
    return 'development-only'
  }
  if (normalized.startsWith('packages/bundle/')) return 'bundle'
  if (normalized.startsWith('packages/sdk/')) return 'sdk'
  if (normalized.startsWith('packages/boot/') || normalized.startsWith('packages/util/') || normalized.startsWith('apps/')) {
    return 'runtime'
  }
  if (normalized.startsWith('packages/')) return 'plugin'
  throw new Error(`unclassified workspace: ${directory}`)
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

function workspacePackages(): WorkspacePackage[] {
  const manifests = globSync([
    'packages/*/*/package.json',
    'apps/*/package.json',
    'vendor/*/package.json',
    'native/landlock-run/package.json',
    'native/landlock-run/packages/*/package.json',
    'website/package.json',
  ], { cwd: ROOT }).sort()
  return manifests.map((path) => {
    const manifest = readJson(join(ROOT, path))
    const name = manifest.name
    if (typeof name !== 'string') throw new Error(`${path} has no package name`)
    const directory = path.slice(0, -'/package.json'.length)
    return {
      directory,
      name,
      id: name.startsWith(INTERNAL_PREFIX) ? name.slice(INTERNAL_PREFIX.length) : name.replace(/^@nomix-ai\//u, ''),
      manifest,
      classification: classifyWorkspace(directory),
    }
  })
}

function exportTarget(manifest: Record<string, unknown>, subpath: string): string {
  const exports = manifest.exports
  const key = subpath === '' ? '.' : `./${subpath}`
  let value: unknown
  if (typeof exports === 'string' && key === '.') value = exports
  if (exports !== null && typeof exports === 'object' && !Array.isArray(exports)) {
    value = (exports as Record<string, unknown>)[key]
    if (value === undefined) {
      for (const [pattern, candidate] of Object.entries(exports)) {
        if (!pattern.includes('*')) continue
        const [prefix, suffix] = pattern.split('*') as [string, string]
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue
        const middle = key.slice(prefix.length, key.length - suffix.length)
        const raw = typeof candidate === 'string'
          ? candidate
          : candidate !== null && typeof candidate === 'object'
            ? (candidate as Record<string, unknown>).default
            : undefined
        if (typeof raw === 'string') value = raw.replace('*', middle)
      }
    }
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const conditions = value as Record<string, unknown>
    value = conditions.import ?? conditions.default ?? conditions.node ?? conditions.types
  }
  if (typeof value === 'string') return value.replace(/^\.\//u, '')
  if (key === '.' && typeof manifest.main === 'string') return manifest.main.replace(/^\.\//u, '')
  if (subpath === 'package.json') return 'package.json'
  return `lib/${subpath || 'index'}.js`
}

function textFile(path: string): boolean {
  return [...TEXT_EXTENSIONS].some(extension => path.endsWith(extension))
}

/**
 * Decide whether one built path may enter the public npm artifact.
 * @param path - source or repository-relative artifact path.
 * @returns true for distributable runtime files and false for source, tests, documentation, source maps, or compiler state.
 */
export function publishableArtifactPath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  return !normalized.includes('/src/')
    && !normalized.startsWith('src/')
    && !normalized.includes('/tests/')
    && !normalized.endsWith('.map')
    && !normalized.endsWith('.tsbuildinfo')
    && !/(^|\/)README(?:\.|$)/iu.test(normalized)
}

/**
 * Retarget a built CLI package anchor after moving the module under dist/cli.
 * @param contents - compiled CLI module text.
 * @returns module text whose package anchor resolves the public package root.
 */
export function rewriteHarnessPackageAnchor(contents: string): string {
  return contents.replace(
    /new URL\((['"])\.\.\/package\.json\1, import\.meta\.url\)/gu,
    (_match, quote: string) => `new URL(${quote}../../package.json${quote}, import.meta.url)`,
  )
}

/**
 * Rewrite only JavaScript/TypeScript module specifiers, leaving product data strings unchanged.
 * @param contents - compiled JavaScript or declaration text.
 * @param resolveSpecifier - maps one internal package name and optional subpath to its package-relative target.
 * @returns text with imports and runtime module-resolution calls rewritten.
 */
export function rewriteInternalModuleSpecifiers(
  contents: string,
  resolveSpecifier: (name: string, subpath: string) => string | undefined,
  preserveSpecifier: (name: string, subpath: string) => boolean = () => false,
): string {
  return contents.replace(
    INTERNAL_MODULE_SPECIFIER,
    (match, prefix: string, quote: string, name: string, subpath: string = '') => {
      if (preserveSpecifier(name, subpath)) return match
      const replacement = resolveSpecifier(name, subpath)
      return replacement === undefined ? match : `${prefix}${quote}${replacement}${quote}`
    },
  )
}

/**
 * Whether one copied artifact is the browser factory declared by `nomix.client`.
 * @param manifest - owning workspace manifest.
 * @param artifactPath - path relative to the copied workspace kernel directory.
 * @returns true when module-table specifiers must retain their canonical names.
 */
export function isBrowserClientBundle(manifest: Record<string, unknown>, artifactPath: string): boolean {
  const nomix = manifest.nomix
  if (nomix === null || typeof nomix !== 'object' || Array.isArray(nomix)) return false
  const client = (nomix as Record<string, unknown>).client
  if (client === null || typeof client !== 'object' || Array.isArray(client)) return false
  if ((client as Record<string, unknown>).platform !== 'web') return false
  return artifactPath.replaceAll('\\', '/') === exportTarget(manifest, 'client')
}

/**
 * Reject filesystem-relative requires that the browser module table cannot resolve.
 * @param contents - one generated browser client factory.
 * @param ownerName - package name used in the diagnostic.
 */
export function verifyBrowserClientRequires(contents: string, ownerName: string): void {
  const relativeRequires = [...contents.matchAll(/\brequire\(\s*(['"])(\.[^'"]+)\1\s*\)/gu)]
    .map(match => match[2])
  if (relativeRequires.length === 0) return
  throw new Error(
    `${ownerName} browser client factory contains filesystem-relative module-table requires: ${relativeRequires.join(', ')}`,
  )
}

function rewriteInternalImports(
  path: string,
  owner: WorkspacePackage,
  destinationRoot: string,
  internal: ReadonlyMap<string, WorkspacePackage>,
): void {
  if (!textFile(path)) return
  let contents = readFileSync(path, 'utf8')
  const ownerRoot = join(destinationRoot, 'dist', 'kernel', owner.id)
  const preserveClientModuleTable = isBrowserClientBundle(owner.manifest, relative(ownerRoot, path))
  contents = rewriteInternalModuleSpecifiers(contents, (name, subpath) => {
    const target = internal.get(name)
    if (target === undefined) return undefined
    const targetPath = join(destinationRoot, 'dist', 'kernel', target.id, exportTarget(target.manifest, subpath))
    let specifier = relative(dirname(path), targetPath).split(sep).join('/')
    if (!specifier.startsWith('.')) specifier = `./${specifier}`
    return specifier
  }, () => preserveClientModuleTable)
  if (owner.name === '@nomix-ai/nomix-harness') {
    contents = rewriteHarnessPackageAnchor(contents)
  }
  if (preserveClientModuleTable) verifyBrowserClientRequires(contents, owner.name)
  writeFileSync(path, contents)
}

function copyRuntimeFiles(pkg: WorkspacePackage, destination: string): void {
  const source = join(ROOT, pkg.directory)
  mkdirSync(destination, { recursive: true })
  const declared = Array.isArray(pkg.manifest.files)
    ? pkg.manifest.files.filter((entry): entry is string => typeof entry === 'string' && !entry.startsWith('!'))
    : []
  const candidates = new Set<string>(['package.json'])
  for (const pattern of declared) {
    const recursive = pattern.endsWith('/') ? `${pattern}**/*` : `${pattern}/**/*`
    for (const match of globSync([pattern, recursive], { cwd: source })) candidates.add(match)
  }
  for (const match of globSync('lib/**/*', { cwd: source })) candidates.add(match)
  for (const item of [...candidates].sort()) {
    const normalized = item.replaceAll('\\', '/')
    if (!publishableArtifactPath(normalized)) continue
    const from = join(source, item)
    if (!existsSync(from) || statSync(from).isDirectory()) continue
    const to = join(destination, item)
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to)
  }
}

/** Copy every checked-in Landlock platform target into the aggregate package. */
function copyLandlockPrebuilds(destinationRoot: string): void {
  const manifests = globSync('native/landlock-run/packages/linux-*/prebuilds.json', { cwd: ROOT }).sort()
  if (manifests.length === 0) throw new Error('Landlock distribution declares no platform prebuilds')
  for (const manifestPath of manifests) {
    const manifest = readJson(join(ROOT, manifestPath))
    const platform = manifest.platform
    const binaries = manifest.binaries
    if (typeof platform !== 'string' || !/^[a-z0-9]+-[a-z0-9]+$/u.test(platform)) {
      throw new Error(`${manifestPath} declares an invalid platform`)
    }
    if (!Array.isArray(binaries) || binaries.length === 0) {
      throw new Error(`${manifestPath} declares no binaries`)
    }
    for (const binary of binaries) {
      if (binary === null || typeof binary !== 'object' || Array.isArray(binary)) {
        throw new Error(`${manifestPath} contains an invalid binary entry`)
      }
      const binaryPath = (binary as Record<string, unknown>).path
      if (typeof binaryPath !== 'string' || !/^bin\/[a-z0-9-]+$/u.test(binaryPath)) {
        throw new Error(`${manifestPath} contains an invalid binary path`)
      }
      const source = join(ROOT, dirname(manifestPath), binaryPath)
      if (!existsSync(source)) throw new Error(`built Landlock binary is missing: ${source}`)
      const target = join(destinationRoot, 'dist', 'native', 'landlock-run', platform, basename(binaryPath))
      mkdirSync(dirname(target), { recursive: true })
      cpSync(source, target)
      if ((statSync(target).mode & 0o111) === 0) throw new Error(`embedded Landlock binary is not executable: ${target}`)
    }
  }
  const license = join(ROOT, 'native', 'landlock-run', 'LICENSE')
  const target = join(destinationRoot, 'dist', 'licenses', 'landlock-run.LICENSE')
  mkdirSync(dirname(target), { recursive: true })
  cpSync(license, target)
}

function normalizedDependencyVersion(name: string, range: string, all: ReadonlyMap<string, WorkspacePackage>): string {
  if (!range.startsWith('workspace:')) return range
  const version = all.get(name)?.manifest.version
  if (typeof version !== 'string') throw new Error(`cannot resolve workspace version for external dependency ${name}`)
  const selector = range.slice('workspace:'.length)
  return selector === '^' || selector === '*' ? `^${version}` : selector === '~' ? `~${version}` : selector
}

const DEPENDENCY_CONVERGENCE: Readonly<Record<string, {
  readonly acceptedRanges: readonly string[]
  readonly outputRange: string
}>> = {
  chokidar: {
    acceptedRanges: ['^4.0.3', '^5.0.0'],
    outputRange: '^5.0.0',
  },
}

/**
 * Merge external ranges for the flattened npm distribution.
 * @param name - external dependency name.
 * @param left - range already selected from an earlier workspace.
 * @param right - range declared by the next workspace.
 * @returns one range that satisfies the distribution's declared convergence policy.
 */
export function mergeDependencyRanges(name: string, left: string | undefined, right: string): string {
  if (left === undefined || left === right) return right
  const convergence = DEPENDENCY_CONVERGENCE[name]
  if (convergence !== undefined
    && convergence.acceptedRanges.includes(left)
    && convergence.acceptedRanges.includes(right)) return convergence.outputRange
  const parse = (range: string): { operator: '^' | '~'; parts: [number, number, number] } | undefined => {
    const match = /^(\^|~)(\d+)\.(\d+)\.(\d+)$/u.exec(range)
    return match === null
      ? undefined
      : {
        operator: match[1] as '^' | '~',
        parts: [Number(match[2]), Number(match[3]), Number(match[4])],
      }
  }
  const a = parse(left)
  const b = parse(right)
  if (a === undefined || b === undefined || a.operator !== b.operator) {
    throw new Error(`conflicting dependency ranges for ${name}: ${left} and ${right}`)
  }
  const compatible = a.operator === '~'
    ? a.parts[0] === b.parts[0] && a.parts[1] === b.parts[1]
    : a.parts[0] === b.parts[0] && (a.parts[0] !== 0 || a.parts[1] === b.parts[1])
  if (!compatible) throw new Error(`conflicting dependency ranges for ${name}: ${left} and ${right}`)
  const [aMajor, aMinor, aPatch] = a.parts
  const [bMajor, bMinor, bPatch] = b.parts
  if (aMajor !== bMajor) return aMajor > bMajor ? left : right
  if (aMinor !== bMinor) return aMinor > bMinor ? left : right
  if (aPatch !== bPatch) return aPatch > bPatch ? left : right
  return left
}

function aggregateDependencies(
  included: readonly WorkspacePackage[],
  all: ReadonlyMap<string, WorkspacePackage>,
  internal: ReadonlyMap<string, WorkspacePackage>,
): { dependencies: Record<string, string>; optionalDependencies: Record<string, string> } {
  const dependencies: Record<string, string> = {}
  const optionalDependencies: Record<string, string> = {}
  for (const pkg of included) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      const values = pkg.manifest[section]
      if (values === null || typeof values !== 'object' || Array.isArray(values)) continue
      for (const [name, raw] of Object.entries(values)) {
        if (internal.has(name) || name.startsWith('@nomix-ai/node-addon-landlock-run-linux-') || typeof raw !== 'string') continue
        const range = normalizedDependencyVersion(name, raw, all)
        const target = section === 'optionalDependencies' || name.startsWith('@nomix-ai/node-addon-')
          ? optionalDependencies
          : dependencies
        target[name] = mergeDependencyRanges(name, target[name], range)
      }
    }
  }
  return { dependencies, optionalDependencies }
}

function writeRegistry(destinationRoot: string, plugins: readonly WorkspacePackage[]): void {
  const entries: string[] = []
  for (const pkg of plugins) {
    const exports = pkg.manifest.exports
    const subpaths = new Set<string>([''])
    if (exports !== null && typeof exports === 'object' && !Array.isArray(exports)) {
      for (const key of Object.keys(exports)) {
        if (key === '.' || key === './package.json' || key.includes('*') || key.startsWith('./src/')) continue
        subpaths.add(key.replace(/^\.\//u, ''))
      }
    }
    for (const subpath of subpaths) {
      const target = exportTarget(pkg.manifest, subpath)
      if (!existsSync(join(destinationRoot, 'dist', 'kernel', pkg.id, target))) continue
      const id = `nomix/${pkg.id}${subpath === '' ? '' : `/${subpath}`}`
      entries.push(`  ['${id}', () => import('../kernel/${pkg.id}/${target}')],`)
    }
  }
  const source = `/** Generated lazy registry for packaged Nomix plugins. */\n\nexport function registerNomixBuiltins(ctx) {\n  const cache = new Map()\n  for (const [id, load] of [\n${entries.join('\n')}\n  ]) {\n    Object.defineProperty(ctx.loader.builtins, id, {\n      configurable: true,\n      enumerable: true,\n      get() {\n        let pending = cache.get(id)\n        if (pending === undefined) { pending = load(); cache.set(id, pending) }\n        return pending\n      },\n    })\n  }\n}\n`
  writeFileSync(join(destinationRoot, 'dist', 'cli', 'builtin-registry.js'), source)
}

function writeKernelManifest(destinationRoot: string, packages: readonly WorkspacePackage[]): void {
  const manifest = Object.fromEntries(packages.map(pkg => [pkg.name, `./${pkg.id}`]))
  writeFileSync(
    join(destinationRoot, 'dist', 'kernel', 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}

function copyPublicFace(destinationRoot: string): void {
  const cli = join(ROOT, 'apps/cli/lib')
  const mappings = [
    ['index', 'index'],
    ['config', 'config'],
    ['public-plugin', 'public-plugin'],
    ['public-plugin', 'plugin-api/index'],
    ['plugins', 'plugins/index'],
    ['bundles', 'bundles/index'],
    ['runtime', 'runtime/index'],
    ['sdk', 'sdk/index'],
    ['testing', 'testing/index'],
  ] as const
  for (const [sourceName, targetName] of mappings) {
    for (const [sourceSuffix, targetSuffix] of [['.js', '.js'], ['.d.ts', '.d.ts']] as const) {
      const source = sourceSuffix === '.d.ts'
        ? join(cli, 'types', `${sourceName}${sourceSuffix}`)
        : join(cli, `${sourceName}${sourceSuffix}`)
      if (!existsSync(source)) throw new Error(`built public entry is missing: ${source}`)
      const target = join(destinationRoot, 'dist', `${targetName}${targetSuffix}`)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(source, target)
    }
  }
  for (const nested of ['plugins/index.js', 'plugins/index.d.ts', 'bundles/index.js', 'bundles/index.d.ts']) {
    const path = join(destinationRoot, 'dist', nested)
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll("'./public-plugin.js'", "'../public-plugin.js'"))
  }
}

/** Build one complete npm package directory from already-built workspace artifacts. */
export function buildNpmHarnessDistribution(destinationRoot: string): void {
  const packages = workspacePackages()
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const included = packages.filter(pkg => ['plugin', 'bundle', 'runtime', 'sdk'].includes(pkg.classification)
    && pkg.name !== '@nomix-ai/nomix-harness')
  const internal = new Map(included.filter(pkg => pkg.name.startsWith('@nomix-ai/')).map(pkg => [pkg.name, pkg]))
  const harness = byName.get('@nomix-ai/nomix-harness')
  if (harness === undefined) throw new Error('workspace has no @nomix-ai/nomix-harness package')

  rmSync(destinationRoot, { recursive: true, force: true })
  mkdirSync(join(destinationRoot, 'dist', 'cli'), { recursive: true })
  for (const file of globSync(['*.js', 'types/*.d.ts'], { cwd: join(ROOT, 'apps/cli/lib') })) {
    const source = join(ROOT, 'apps/cli/lib', file)
    const target = join(destinationRoot, 'dist', 'cli', basename(file))
    cpSync(source, target)
  }
  for (const pkg of included) copyRuntimeFiles(pkg, join(destinationRoot, 'dist', 'kernel', pkg.id))
  copyLandlockPrebuilds(destinationRoot)
  for (const file of globSync('dist/{cli,kernel}/**/*', { cwd: destinationRoot })) {
    const path = join(destinationRoot, file)
    if (!statSync(path).isFile()) continue
    const normalized = file.replaceAll('\\', '/')
    const owner = normalized.startsWith('dist/cli/')
      ? harness
      : included.find(pkg => normalized.startsWith(`dist/kernel/${pkg.id}/`))
    if (owner !== undefined) rewriteInternalImports(path, owner, destinationRoot, internal)
  }
  copyPublicFace(destinationRoot)
  for (const file of globSync(['dist/*.js', 'dist/*.d.ts', 'dist/{plugin-api,plugins,bundles,runtime,sdk,testing}/**/*'], {
    cwd: destinationRoot,
  })) {
    const path = join(destinationRoot, file)
    if (statSync(path).isFile()) rewriteInternalImports(path, harness, destinationRoot, internal)
  }
  writeRegistry(destinationRoot, included)
  writeKernelManifest(destinationRoot, included)

  const bundleManifest: Record<string, { packageName: string; patch: string }> = {}
  for (const pkg of included.filter(pkg => pkg.classification === 'bundle')) {
    const declared = (pkg.manifest.nomix as { bundle?: { patch?: unknown } } | undefined)?.bundle?.patch
    if (typeof declared !== 'string') continue
    const source = join(ROOT, pkg.directory, declared)
    const directory = join(destinationRoot, 'dist', 'bundles', pkg.id)
    mkdirSync(directory, { recursive: true })
    // Keep canonical package names in configuration data. The installed
    // profile fallback links them to package-internal kernel directories,
    // preserving package metadata discovery for Client and Typert plugins.
    writeFileSync(join(directory, 'cordis.patch.yml'), readFileSync(source, 'utf8'))
    writeFileSync(join(directory, 'package.json'), `${JSON.stringify({
      name: pkg.name,
      type: 'module',
      nomix: { bundle: { patch: './cordis.patch.yml' } },
    }, null, 2)}\n`)
    bundleManifest[pkg.id] = { packageName: pkg.name, patch: `./${pkg.id}/cordis.patch.yml` }
  }
  writeFileSync(join(destinationRoot, 'dist', 'bundles', 'manifest.json'), `${JSON.stringify(bundleManifest, null, 2)}\n`)

  const pluginManifest = included.filter(pkg => pkg.classification === 'plugin').map(pkg => ({
    id: pkg.id,
    packageName: pkg.name,
    module: `../kernel/${pkg.id}/${exportTarget(pkg.manifest, '')}`,
  }))
  writeFileSync(join(destinationRoot, 'dist', 'plugins', 'manifest.json'), `${JSON.stringify(pluginManifest, null, 2)}\n`)

  const webAssets = join(ROOT, 'apps/web/dist')
  if (!existsSync(join(webAssets, 'index.html'))) {
    throw new Error(`built Web frontend is missing: ${join(webAssets, 'index.html')}`)
  }
  cpSync(webAssets, join(destinationRoot, 'dist', 'assets', 'web'), {
    recursive: true,
    filter: publishableArtifactPath,
  })
  cpSync(join(ROOT, 'apps/cli/config'), join(destinationRoot, 'dist', 'config'), { recursive: true })

  const { dependencies, optionalDependencies } = aggregateDependencies([harness, ...included], byName, internal)
  const manifest = {
    name: harness.name,
    version: harness.manifest.version,
    description: 'Nomix Harness plugin runtime, built-in catalog, bundles, CLI, and SDK',
    type: 'module',
    license: 'MIT',
    engines: { node: '^22.19.0 || >=24.0.0' },
    publishConfig: { access: 'public', provenance: true },
    repository: harness.manifest.repository,
    bin: { nomix: './dist/cli/bin.js' },
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: harness.manifest.exports,
    files: ['dist'],
    dependencies,
    optionalDependencies,
  }
  writeFileSync(join(destinationRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  cpSync(join(ROOT, 'LICENSE'), join(destinationRoot, 'LICENSE'))
  cpSync(join(ROOT, 'apps/cli/README.md'), join(destinationRoot, 'README.md'))
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = resolve(process.argv[2] ?? join(ROOT, 'dist/npm-package'))
  buildNpmHarnessDistribution(destination)
  console.log(`Built ${destination}`)
}
