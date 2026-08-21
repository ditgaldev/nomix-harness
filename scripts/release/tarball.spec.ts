/** npm tarball metadata and path validation. */

import { describe, expect, it } from 'vitest'
import { validateNpmTarballPaths } from './tarball.ts'

describe('npm tarball paths', () => {
  it('accepts only the conventional package archive root', () => {
    expect(() => { validateNpmTarballPaths(['package/', 'package/package.json', 'package/lib/index.js']) })
      .not.toThrow()
    expect(() => { validateNpmTarballPaths(['package', 'package/package.json']) }).not.toThrow()
  })

  it('rejects a root entry that the npm registry refuses', () => {
    expect(() => { validateNpmTarballPaths(['./', 'package/package.json']) })
      .toThrow('npm tarball contains invalid path: ./')
  })
})
