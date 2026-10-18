/**
 * Virtual root of the worker host's in-memory filesystem. Kept
 * in one module so the process shim, the path/os shims, and the VFS image
 * collector cannot drift apart.
 */

/** Virtual filesystem root; `process.cwd()` and every absolute path start here. */
export const NOMIX_ROOT = '/nomix'

/** `$NOMIX_HOME`: durable-state directory inside the image. */
export const NOMIX_HOME = `${NOMIX_ROOT}/home`

/** Flat, symlink-free package tree resolved by the worker module loader. */
export const NOMIX_NODE_MODULES = `${NOMIX_ROOT}/node_modules`

/** Image configuration directory: the VFS manifest and the shipped agent presets. */
export const NOMIX_CONFIG = `${NOMIX_ROOT}/config`

/** Default (empty) workspace directory. */
export const NOMIX_WORKSPACE = `${NOMIX_ROOT}/workspace`

/** Temporary directory reported by `os.tmpdir()`. */
export const NOMIX_TMP = `${NOMIX_ROOT}/tmp`
