/** Install the portable CLI's compressed production dependency tree. */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extract } from 'tar'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const archive = join(packageRoot, 'nomix-runtime.tgz')

if (!existsSync(archive)) throw new Error(`portable Nomix runtime archive is missing: ${archive}`)

const native = spawnSync('tar', ['-xzf', archive, '-C', packageRoot], { stdio: 'inherit' })
if (native.error !== undefined && (native.error as NodeJS.ErrnoException).code === 'ENOENT') {
  await extract({
    cwd: packageRoot,
    file: archive,
    preservePaths: false,
    strict: true,
  })
} else if (native.error !== undefined) {
  throw native.error
} else if (native.status !== 0) {
  throw new Error(`tar exited with status ${String(native.status)} while installing the portable Nomix runtime`)
}
