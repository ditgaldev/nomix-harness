/** npm tarball metadata and path validation. */

import { describe, expect, it } from 'vitest'
import { validateNpmTarballPaths, validateNpmTarListing } from './tarball.ts'

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

  it('rejects hard-link entries that the npm registry refuses', () => {
    expect(() => { validateNpmTarListing(['-rw-r--r-- user/group 10 date package/a', 'drwxr-xr-x user/group 0 date package/lib/']) })
      .not.toThrow()
    expect(() => { validateNpmTarListing(['hrw-r--r-- user/group 0 date package/b link to package/a']) })
      .toThrow(/npm tarball contains hard link/)
  })
})
