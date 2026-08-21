/** Install the portable CLI's compressed production dependency tree. */

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extract } from 'tar'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const archive = join(packageRoot, 'nomix-runtime.tgz')

if (!existsSync(archive)) throw new Error(`portable Nomix runtime archive is missing: ${archive}`)

await extract({
  cwd: packageRoot,
  file: archive,
  preservePaths: false,
  strict: true,
})
