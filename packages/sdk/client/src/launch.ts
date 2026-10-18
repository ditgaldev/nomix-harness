/**
 * Resolve the public SDK launch configuration to one nomix subprocess.
 * @module @nomix-ai/nomix-sdk-client/launch
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HarnessClientOptions } from './types.ts'

/** Default bound for a profile to answer the SDK initialize handshake. */
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000

/** Internal generic process launch used by the transport and fake-runtime tests. */
export interface RuntimeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  /** Materialize the complete child environment when the client starts its subprocess. */
  environment: () => NodeJS.ProcessEnv
  description: string
  initializeTimeoutMs: number
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

/** Node argv plus internal profile patches required by one resolved nomix entry. */
export interface NomixNodeLaunch {
  /** Arguments before the profile selector. */
  nodeArgs: string[]
  /** Internal patches applied below caller-supplied patches. */
  patches: string[]
  /** Environment values required by the resolved entry mode. */
  environment: NodeJS.ProcessEnv
}

interface PackageManifest {
  version?: unknown
  bin?: unknown
}

/** Read a package manifest from one resolved package.json URL. */
function manifest(url: string): PackageManifest {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageManifest
}

/**
 * Resolve and version-check a nomix executable from package manifests.
 * @param nomixManifestUrl - resolved URL of the nomix package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @returns the absolute nomix executable path.
 */
export function resolveNomixBinFromManifests(nomixManifestUrl: string, clientManifestUrl: string): string {
  const nomixManifest = manifest(nomixManifestUrl)
  const clientManifest = manifest(clientManifestUrl)
  if (typeof nomixManifest.version !== 'string' || nomixManifest.version !== clientManifest.version) {
    throw new Error(`nomix SDK client ${String(clientManifest.version)} requires the same nomix version, got ${String(nomixManifest.version)}`)
  }
  const bin = typeof nomixManifest.bin === 'object' && nomixManifest.bin !== null
    ? (nomixManifest.bin as Record<string, unknown>).nomix
    : nomixManifest.bin
  if (typeof bin !== 'string' || bin === '') throw new Error('@nomix-ai/nomix-harness declares no nomix executable')
  return resolve(dirname(fileURLToPath(nomixManifestUrl)), bin)
}

/**
 * Resolve and version-check the built nomix executable installed with this SDK.
 * @returns the absolute built executable path, whether or not it exists in a source checkout.
 */
export function installedNomixBin(): string {
  return resolveNomixBinFromManifests(
    import.meta.resolve('@nomix-ai/nomix-harness/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve the Node launch for one same-version nomix package.
 * @param nomixManifestUrl - resolved URL of the nomix package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @param sourceLoaderUrl - optional absolute tsx loader URL for deterministic tests.
 * @returns built output, or the source entry plus its compatibility patch and tsx environment.
 */
export function resolveNomixNodeLaunchFromManifests(
  nomixManifestUrl: string,
  clientManifestUrl: string,
  sourceLoaderUrl?: string,
): NomixNodeLaunch {
  const bin = resolveNomixBinFromManifests(nomixManifestUrl, clientManifestUrl)
  if (existsSync(bin)) return { nodeArgs: [bin], patches: [], environment: {} }

  const packageDir = dirname(fileURLToPath(nomixManifestUrl))
  const sourceBin = resolve(packageDir, 'src/bin.ts')
  const sourcePatch = resolve(packageDir, 'src/sdk-source.cordis.patch.yml')
  const sourceTsconfig = resolve(packageDir, 'tsconfig.json')
  if (!existsSync(sourceBin) || !existsSync(sourcePatch) || !existsSync(sourceTsconfig)) {
    throw new Error(
      `@nomix-ai/nomix-harness is missing its built executable ${bin} and complete source launch files ${sourceBin}, ${sourcePatch}, ${sourceTsconfig}`,
    )
  }
  const loader = sourceLoaderUrl ?? import.meta.resolve('tsx/esm')
  return {
    nodeArgs: ['--import', loader, sourceBin],
    patches: [sourcePatch],
    environment: { TSX_TSCONFIG_PATH: sourceTsconfig },
  }
}

/**
 * Resolve the installed nomix package to a built or source Node launch.
 * @returns the launch descriptor for the current checkout or installed package.
 */
function installedNomixNodeLaunch(): NomixNodeLaunch {
  return resolveNomixNodeLaunchFromManifests(
    import.meta.resolve('@nomix-ai/nomix-harness/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve caller-relative filesystem inputs and construct canonical nomix argv.
 * @param options - public SDK launch options.
 * @param callerCwd - parent-process directory used for lexical resolution.
 * @returns one generic subprocess spec for the JSON-RPC transport.
 */
export function resolveNomixLaunch(
  options: HarnessClientOptions = {},
  callerCwd: string = process.cwd(),
): RuntimeProcessOptions {
  const profile = options.profile ?? 'sdk'
  const nomixLaunch = options.nomixBin === undefined
    ? installedNomixNodeLaunch()
    : { nodeArgs: [resolve(callerCwd, options.nomixBin)], patches: [], environment: {} }
  const patches = [
    ...nomixLaunch.patches,
    ...(options.patches ?? []).map(path => resolve(callerCwd, path)),
  ]
  const nomixHome = options.nomixHome === undefined ? undefined : resolve(callerCwd, options.nomixHome)
  return {
    command: process.execPath,
    args: [...nomixLaunch.nodeArgs, '--profile', profile, ...patches.flatMap(path => ['--patch', path])],
    ...options.processCwd === undefined ? {} : { cwd: resolve(callerCwd, options.processCwd) },
    environment: () => ({
      ...(options.env ?? process.env),
      ...nomixLaunch.environment,
      ...nomixHome === undefined ? {} : { NOMIX_HOME: nomixHome },
    }),
    description: `nomix profile ${JSON.stringify(profile)}`,
    initializeTimeoutMs: options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS,
    ...options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs },
    ...options.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: options.shutdownTimeoutMs },
    ...options.disposeEofGraceMs === undefined ? {} : { disposeEofGraceMs: options.disposeEofGraceMs },
    ...options.disposeGraceMs === undefined ? {} : { disposeGraceMs: options.disposeGraceMs },
  }
}
