/** Build the script-free @nomix-ai/nomix-harness npm payload with bundled workspace packages. */

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
import { dirname, join, resolve } from 'node:path'
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
  readonly manifest: Record<string, unknown>
  readonly classification: WorkspaceDistribution
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

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
    return { directory, name, manifest, classification: classifyWorkspace(directory) }
  })
}

/**
 * Decide whether one built path may enter the public npm artifact.
 * @param path - package-relative artifact path.
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
 * Resolve a bundled package's physical directory inside the aggregate package.
 * @param destinationRoot - aggregate package root.
 * @param packageName - scoped or unscoped npm package name.
 * @returns package directory below the aggregate package's node_modules.
 */
export function bundledPackagePath(destinationRoot: string, packageName: string): string {
  return join(destinationRoot, 'node_modules', ...packageName.split('/'))
}

/**
 * Convert an official package name to its stable Harness plugin API subpath.
 * @param packageName - canonical `@nomix-ai/nomix-*` package name.
 * @returns the part after `@nomix-ai/nomix-`.
 */
export function pluginFacadeId(packageName: string): string {
  const prefix = '@nomix-ai/nomix-'
  if (!packageName.startsWith(prefix)) throw new Error(`cannot expose non-Nomix package ${packageName}`)
  return packageName.slice(prefix.length)
}

/**
 * Describe one generated capability export in the aggregate manifest.
 * @param packageName - canonical bundled Nomix package name.
 * @returns the public subpath and its runtime and declaration targets.
 */
export function pluginFacadeExport(packageName: string): {
  subpath: string
  target: { types: string; default: string }
} {
  const id = pluginFacadeId(packageName)
  return {
    subpath: `./plugin/${id}`,
    target: {
      types: `./dist/plugin/${id}.d.ts`,
      default: `./dist/plugin/${id}.js`,
    },
  }
}

function packageVersion(pkg: WorkspacePackage): string {
  const version = pkg.manifest.version
  if (typeof version !== 'string') throw new Error(`${pkg.directory}/package.json has no version`)
  return version
}

/**
 * Replace workspace dependency selectors in one bundled manifest with concrete package versions.
 * @param manifest - source workspace manifest.
 * @param versions - bundled package versions by canonical package name.
 * @returns a detached manifest suitable for npm installation outside the workspace.
 */
export function bundledManifest(
  manifest: Readonly<Record<string, unknown>>,
  versions: ReadonlyMap<string, string>,
): Record<string, unknown> {
  const output = structuredClone(manifest)
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    const raw = output[section]
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue
    const dependencies = raw as Record<string, unknown>
    for (const [name, value] of Object.entries(dependencies)) {
      if (typeof value !== 'string' || !value.startsWith('workspace:')) continue
      const version = versions.get(name)
      if (version === undefined) throw new Error(`bundled manifest cannot resolve workspace dependency ${name}`)
      dependencies[name] = version
    }
  }
  return output
}

function copyRuntimeFiles(
  pkg: WorkspacePackage,
  destination: string,
  versions: ReadonlyMap<string, string>,
): void {
  const source = join(ROOT, pkg.directory)
  mkdirSync(destination, { recursive: true })
  const declared = Array.isArray(pkg.manifest.files)
    ? pkg.manifest.files.filter((entry): entry is string => typeof entry === 'string' && !entry.startsWith('!'))
    : []
  const candidates = new Set<string>()
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
  writeFileSync(join(destination, 'package.json'), `${JSON.stringify(bundledManifest(pkg.manifest, versions), null, 2)}\n`)
}

function normalizedDependencyVersion(name: string, range: string, all: ReadonlyMap<string, WorkspacePackage>): string {
  if (!range.startsWith('workspace:')) return range
  const target = all.get(name)
  if (target === undefined) throw new Error(`cannot resolve workspace version for external dependency ${name}`)
  const version = packageVersion(target)
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
 * Merge external ranges for the aggregate npm distribution.
 * @param name - external dependency name.
 * @param left - range already selected from an earlier workspace.
 * @param right - range declared by the next workspace.
 * @returns one range accepted by every bundled workspace.
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

function aggregateExternalDependencies(
  packages: readonly WorkspacePackage[],
  all: ReadonlyMap<string, WorkspacePackage>,
  bundledNames: ReadonlySet<string>,
): { dependencies: Record<string, string>; optionalDependencies: Record<string, string> } {
  const dependencies: Record<string, string> = {}
  const optionalDependencies: Record<string, string> = {}
  for (const pkg of packages) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      const values = pkg.manifest[section]
      if (values === null || typeof values !== 'object' || Array.isArray(values)) continue
      for (const [name, raw] of Object.entries(values)) {
        if (bundledNames.has(name) || typeof raw !== 'string') continue
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

function copyCli(destinationRoot: string): void {
  const sourceRoot = join(ROOT, 'apps', 'cli', 'lib')
  const destination = join(destinationRoot, 'dist', 'cli')
  mkdirSync(destination, { recursive: true })
  for (const file of globSync('*.js', { cwd: sourceRoot })) {
    const source = join(sourceRoot, file)
    const target = join(destination, file)
    writeFileSync(target, rewriteHarnessPackageAnchor(readFileSync(source, 'utf8')))
  }
  cpSync(
    join(sourceRoot, 'types', 'plugin-api.d.ts'),
    join(destination, 'plugin-api.d.ts'),
  )
}

/** Generate stable Harness subpaths that forward to bundled capability packages. */
function writePluginFacades(
  destinationRoot: string,
  packages: readonly WorkspacePackage[],
): Record<string, { types: string; default: string }> {
  const destination = join(destinationRoot, 'dist', 'plugin')
  mkdirSync(destination, { recursive: true })
  const exports: Record<string, { types: string; default: string }> = {}
  for (const pkg of packages.filter(pkg => pkg.name.startsWith('@nomix-ai/nomix-')).sort((a, b) => a.name.localeCompare(b.name))) {
    const id = pluginFacadeId(pkg.name)
    const facade = pluginFacadeExport(pkg.name)
    const statement = `export * from ${JSON.stringify(pkg.name)};\n`
    writeFileSync(join(destination, `${id}.js`), statement)
    writeFileSync(join(destination, `${id}.d.ts`), statement)
    exports[facade.subpath] = facade.target
  }
  return exports
}

function platformPackages(packages: readonly WorkspacePackage[]): WorkspacePackage[] {
  return packages.filter(pkg => /^native\/landlock-run\/packages\/linux-[^/]+$/u.test(pkg.directory))
}

/** Build one complete npm package directory from already-built workspace artifacts. */
export function buildNpmHarnessDistribution(destinationRoot: string): void {
  const packages = workspacePackages()
  const byName = new Map(packages.map(pkg => [pkg.name, pkg]))
  const harness = byName.get('@nomix-ai/nomix-harness')
  if (harness === undefined) throw new Error('workspace has no @nomix-ai/nomix-harness package')
  const runtime = packages.filter(pkg => ['plugin', 'bundle', 'runtime', 'sdk'].includes(pkg.classification)
    && pkg.name !== harness.name)
  const platforms = platformPackages(packages)
  const bundled = [...runtime, ...platforms]
  const versions = new Map(bundled.map(pkg => [pkg.name, packageVersion(pkg)]))
  const bundledNames = new Set(versions.keys())

  rmSync(destinationRoot, { recursive: true, force: true })
  copyCli(destinationRoot)
  const pluginExports = writePluginFacades(destinationRoot, runtime)
  cpSync(join(ROOT, 'apps', 'cli', 'config'), join(destinationRoot, 'dist', 'config'), { recursive: true })
  for (const pkg of bundled) copyRuntimeFiles(pkg, bundledPackagePath(destinationRoot, pkg.name), versions)

  const external = aggregateExternalDependencies([harness, ...bundled], byName, bundledNames)
  const dependencies = { ...external.dependencies }
  for (const pkg of runtime) dependencies[pkg.name] = packageVersion(pkg)
  const optionalDependencies = { ...external.optionalDependencies }
  for (const pkg of platforms) optionalDependencies[pkg.name] = packageVersion(pkg)
  const manifest = {
    name: harness.name,
    version: packageVersion(harness),
    description: harness.manifest.description,
    type: 'module',
    license: 'MIT',
    engines: { node: '^22.19.0 || >=24.0.0' },
    publishConfig: { access: 'public', provenance: true },
    repository: harness.manifest.repository,
    bin: { nomix: './dist/cli/bin.js' },
    main: './dist/cli/plugin-api.js',
    types: './dist/cli/plugin-api.d.ts',
    exports: {
      '.': { types: './dist/cli/plugin-api.d.ts', default: './dist/cli/plugin-api.js' },
      './plugin': { types: './dist/cli/plugin-api.d.ts', default: './dist/cli/plugin-api.js' },
      ...pluginExports,
      './package.json': './package.json',
    },
    files: ['dist'],
    dependencies,
    optionalDependencies,
    bundledDependencies: bundled.map(pkg => pkg.name).sort(),
  }
  writeFileSync(join(destinationRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  cpSync(join(ROOT, 'LICENSE'), join(destinationRoot, 'LICENSE'))
  cpSync(join(ROOT, 'apps', 'cli', 'README.md'), join(destinationRoot, 'README.md'))
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const destination = resolve(process.argv[2] ?? join(ROOT, 'dist/npm-package'))
  buildNpmHarnessDistribution(destination)
  console.log(`Built ${destination}`)
}
