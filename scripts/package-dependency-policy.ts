/** Explicit exceptions and Host packages for the published dependency policy. */

/** Packages treated as Client/Host packages without declaring `nomix.client`. */
const CLIENT_FACE_INCLUDE: readonly string[] = []

/** Packages exempted from automatic Client/Host treatment despite declaring `nomix.client`. */
const CLIENT_FACE_EXCLUDE: readonly string[] = [
  '@nomix-ai/nomix-api-session-controller',
  '@nomix-ai/nomix-api-workspace-controller',
]

/** Host-only packages whose peer relays are deliberately flattened. */
const HOST_DEPENDENCY_PACKAGES: readonly string[] = [
  '@nomix-ai/nomix-llm',
  '@nomix-ai/nomix-session',
]

/** Required Cordis services whose Host imports are type-only. */
const REQUIRED_SERVICE_PEERS = {
  '@nomix-ai/nomix-api-terminal-controller': ['@nomix-ai/nomix-subprocess'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Development-only package relationships not represented by source imports. */
const CONFIGURATION_ONLY_DEV_DEPENDENCIES = {
  '@nomix-ai/nomix-client-locale': ['@nomix-ai/nomix-api-remotes'],
  '@nomix-ai/nomix-client-ui-conversation': [
    '@nomix-ai/nomix-api-remotes',
    '@nomix-ai/nomix-client-ui-workspace',
  ],
  '@nomix-ai/nomix-client-ui-model-selection': ['@nomix-ai/nomix-client-ui-input-trigger'],
  '@nomix-ai/nomix-client-ui-sidebar': ['@nomix-ai/nomix-client-ui-workspace'],
  '@nomix-ai/nomix-client-ui-subagent': ['@nomix-ai/nomix-client-ui-input-trigger'],
  '@nomix-ai/nomix-client-ui-theme': ['@nomix-ai/nomix-api-remotes'],
  '@nomix-ai/nomix-client-ui-tool': ['@nomix-ai/nomix-api-remotes'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Workspace packages whose complete runtime surface is safe across duplicate installations. */
const DUPLICATE_SAFE_PACKAGES: readonly string[] = [
  '@nomix-ai/nomix-brand',
  '@nomix-ai/nomix-lazy-require',
  '@nomix-ai/nomix-typert-protocol',
  '@nomix-ai/nomix-util-code-language',
  '@nomix-ai/nomix-util-crypto',
  '@nomix-ai/nomix-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 * New entries are forbidden by default. Automated agents must not add an
 * exception; every addition requires explicit human review and a dedicated,
 * prominent heading in the pull request description.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@nomix-ai/nomix-credentials': ['credentialKey'],
  '@nomix-ai/nomix-deque': ['Deque'],
  '@nomix-ai/nomix-llm': ['callConfigEquals'],
  '@nomix-ai/nomix-session-format': ['sessionFormatLogFilename'],
  '@nomix-ai/nomix-timeout': ['MAX_TIMER_DELAY_MS'],
  '@nomix-ai/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  // `instanceof` checks need the translator's own class instance.
  '@nomix-ai/nomix-experimental-translator': ['TranslationError'],
  '@nomix-ai/nomix-scope': ['carrierKeyOf', 'createScope', 'scopeOf', 'scopeTarget'],
  '@nomix-ai/nomix-session': ['SESSION_FORMAT_VERSION'],
  '@nomix-ai/nomix-session-persistence': ['SessionPersistenceNotFoundError'],
} as const satisfies HostDependencyExports

/** Exact import specifier to reviewed runtime exports. */
type HostDependencyExports = Readonly<Record<string, readonly string[]>>

/** Complete configurable input to package dependency classification. */
export interface PackageDependencyPolicy {
  readonly clientFaceInclude: readonly string[]
  readonly clientFaceExclude: readonly string[]
  readonly hostPackages: readonly string[]
  readonly requiredServicePeers?: Readonly<Record<string, readonly string[]>>
  readonly configurationOnlyDevDependencies: Readonly<Record<string, readonly string[]>>
  readonly duplicateSafePackages?: readonly string[]
  readonly safeHostDependencyExports: HostDependencyExports
  readonly peerRequiredHostExports: HostDependencyExports
}

/** Repository dependency policy consumed by verification and benchmarking. */
export const PACKAGE_DEPENDENCY_POLICY: PackageDependencyPolicy = {
  clientFaceInclude: CLIENT_FACE_INCLUDE,
  clientFaceExclude: CLIENT_FACE_EXCLUDE,
  hostPackages: HOST_DEPENDENCY_PACKAGES,
  requiredServicePeers: REQUIRED_SERVICE_PEERS,
  configurationOnlyDevDependencies: CONFIGURATION_ONLY_DEV_DEPENDENCIES,
  duplicateSafePackages: DUPLICATE_SAFE_PACKAGES,
  safeHostDependencyExports: SAFE_HOST_DEPENDENCY_EXPORTS,
  peerRequiredHostExports: PEER_REQUIRED_HOST_EXPORTS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a package manifest declares a dynamically loaded Client entry. */
export function hasClientDeclaration(nomixField: unknown): boolean {
  return isRecord(nomixField) && Object.hasOwn(nomixField, 'client')
}
