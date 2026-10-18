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
import { subset, valid } from 'semver'
import { OPTIONAL_BUNDLES } from '../packages/boot/app-boot/src/profile.ts'
import { ON_DEMAND_BUNDLES } from '../packages/boot/app-boot/src/official-bundle-packages.ts'
import { isExperimentalPackageName } from './experimental-package-policy.ts'

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
  if (normalized === 'vendor/hmr') return 'development-only'
  if (normalized.startsWith('vendor/')) return 'runtime'
  if (normalized === 'native/system/packages/entry') return 'runtime'
  if (normalized.startsWith('native/') || normalized.startsWith('python/')) return 'separate-distribution'
  if (['website', 'benchmarks', 'apps/desktop', 'apps/desktop-host', 'apps/plugin-market-generator'].includes(normalized)
    || normalized.startsWith('packages/test-support/') || normalized.startsWith('packages/examples/')) {
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
    'native/system/package.json',
    'native/system/packages/*/package.json',
    'benchmarks/package.json',
    'python/sdk-runtime/package.json',
    'website/package.json',
  ], { cwd: ROOT }).map(path => path.replaceAll('\\', '/')).sort()
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
  if (typeof version !== 'string' || valid(version) !== version) {
    throw new Error(`${pkg.directory}/package.json requires an exact package version`)
  }
  return version
}

/**
 * Replace workspace dependency selectors in one bundled manifest with concrete package versions.
 * @param manifest - source workspace manifest.
 * @param versions - exact bundled and outer Harness package versions by canonical name.
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
      if (valid(version) !== version) throw new Error(`bundled manifest requires an exact version for ${name}: ${version}`)
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
  return packageVersion(target)
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
  if (subset(left, right)) return left
  if (subset(right, left)) return right
  throw new Error(`conflicting dependency ranges for ${name}: ${left} and ${right}`)
}

/**
 * Collect third-party dependencies without promoting bundled or outer-package references.
 * @param packages - packages included in the public artifact.
 * @param all - workspace manifests by package name.
 * @param internalNames - bundled and outer Harness package names.
 * @param defaultPackages - packages whose ordinary third-party dependencies belong to the default product.
 * @returns compatible required and optional dependency ranges.
 */
export function aggregateExternalDependencies(
  packages: readonly WorkspacePackage[],
  all: ReadonlyMap<string, WorkspacePackage>,
  internalNames: ReadonlySet<string>,
  defaultPackages: ReadonlySet<string> = new Set(packages.map(pkg => pkg.name)),
): { dependencies: Record<string, string>; optionalDependencies: Record<string, string> } {
  const ranges = new Map<string, string>()
  const required = new Set<string>()
  for (const pkg of packages) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
      const values = pkg.manifest[section]
      if (values === null || typeof values !== 'object' || Array.isArray(values)) continue
      for (const [name, raw] of Object.entries(values)) {
        if (internalNames.has(name) || typeof raw !== 'string') continue
        const range = normalizedDependencyVersion(name, raw, all)
        ranges.set(name, mergeDependencyRanges(name, ranges.get(name), range))
        if (defaultPackages.has(pkg.name) && section !== 'optionalDependencies'
          && !name.startsWith('@nomix-ai/node-addon-')) required.add(name)
      }
    }
  }
  return {
    dependencies: Object.fromEntries([...ranges].filter(([name]) => required.has(name))),
    optionalDependencies: Object.fromEntries([...ranges].filter(([name]) => !required.has(name))),
  }
}

/**
 * Keep shipped implementations available without adding their optional capabilities to the default dependency graph.
 * @param harness - outer CLI package whose declarations select the default product.
 * @param bundled - physically bundled implementation and platform packages.
 * @param all - workspace manifests by canonical name.
 * @returns required defaults and optional carried implementations with compatible third-party ranges.
 */
export function aggregateRuntimeDependencies(
  harness: WorkspacePackage,
  bundled: readonly WorkspacePackage[],
  all: ReadonlyMap<string, WorkspacePackage>,
): { dependencies: Record<string, string>; optionalDependencies: Record<string, string> } {
  const offered = new Set(OPTIONAL_BUNDLES)
  const onDemand = new Set(ON_DEMAND_BUNDLES)
  const defaults = new Set([harness.name])
  const queue = [harness]
  for (const pkg of queue) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      const raw = pkg.manifest[section]
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue
      for (const name of Object.keys(raw)) {
        if (pkg === harness && (offered.has(name) || onDemand.has(name))) continue
        const target = all.get(name)
        if (target === undefined || defaults.has(name)) continue
        if (isExperimentalPackageName(name)) throw new Error(`default product depends on experimental package: ${pkg.name} -> ${name}`)
        if (onDemand.has(name)) throw new Error(`default product depends on on-demand package: ${pkg.name} -> ${name}`)
        defaults.add(name)
        queue.push(target)
      }
    }
  }
  const internal = new Set([harness.name, ...bundled.map(pkg => pkg.name)])
  const result = aggregateExternalDependencies([harness, ...bundled], all, internal, defaults)
  const direct = harness.manifest.dependencies
  const sourceDependencies = direct !== null && typeof direct === 'object' && !Array.isArray(direct)
    ? direct as Record<string, unknown>
    : {}
  for (const pkg of bundled) {
    const required = pkg.classification !== 'separate-distribution'
      && (defaults.has(pkg.name) || offered.has(pkg.name) && Object.hasOwn(sourceDependencies, pkg.name))
    const destination = required ? result.dependencies : result.optionalDependencies
    destination[pkg.name] = packageVersion(pkg)
  }
  return result
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
  for (const file of globSync('*.d.ts', { cwd: join(sourceRoot, 'types') })) {
    cpSync(join(sourceRoot, 'types', file), join(destination, file))
  }
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
  return packages.filter(pkg => pkg.directory.startsWith('native/system/packages/')
    && pkg.directory !== 'native/system/packages/entry')
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
  const versions = new Map([harness, ...bundled].map(pkg => [pkg.name, packageVersion(pkg)]))
  const external = aggregateRuntimeDependencies(harness, bundled, byName)

  rmSync(destinationRoot, { recursive: true, force: true })
  copyCli(destinationRoot)
  const pluginExports = writePluginFacades(destinationRoot, runtime)
  for (const pkg of bundled) copyRuntimeFiles(pkg, bundledPackagePath(destinationRoot, pkg.name), versions)

  const dependencies = { ...external.dependencies }
  const optionalDependencies = { ...external.optionalDependencies }
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
      './profile-boot': { types: './dist/cli/profile-boot.d.ts', default: './dist/cli/profile-boot.js' },
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
