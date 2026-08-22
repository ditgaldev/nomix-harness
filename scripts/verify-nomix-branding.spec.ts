import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanNomixBranding } from './verify-nomix-branding.ts'

describe('Nomix branding gate', () => {
  it('allows the migration test and rejects a legacy product path', () => {
    expect(scanNomixBranding(['scripts/verify-nomix-branding.spec.ts'])).toEqual([])
    expect(scanNomixBranding(['THIRD_PARTY_NOTICES.md'])).toEqual([])
    const legacyPrefix = 'd' + 'sh'
    const fixtureDirectory = mkdtempSync(join(tmpdir(), `${legacyPrefix}-branding-`))
    const fixturePath = join(fixtureDirectory, 'index.ts')
    writeFileSync(fixturePath, '')
    try {
      const normalized = fixturePath.replaceAll('\\', '/')
      expect(scanNomixBranding([fixturePath])).toEqual([
        { path: normalized, line: 0, rule: 'legacy path name' },
      ])
    } finally {
      rmSync(fixtureDirectory, { recursive: true, force: true })
    }
  })
})
