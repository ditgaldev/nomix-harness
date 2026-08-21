import { describe, expect, it } from 'vitest'
import { rejectLegacyEnvironment, rejectLegacyManifestSection } from '../src/index.ts'

const oldPrefix = 'D' + 'SH'
const oldSection = 'd' + 'sh'

describe('legacy product names', () => {
  it('reports the replacement for old environment variables', () => {
    expect(() => rejectLegacyEnvironment({ [`${oldPrefix}_HOME`]: '/old' }))
      .toThrow('NOMIX_HOME')
  })

  it('rejects the old profile section', () => {
    expect(() => rejectLegacyManifestSection({ [oldSection]: {} }, 'package.json'))
      .toThrow('rename it to nomix')
  })
})
