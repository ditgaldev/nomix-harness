import { describe, expect, it } from 'vitest'
import { scanNomixBranding } from './verify-nomix-branding.ts'

describe('Nomix branding gate', () => {
  it('allows the migration test and rejects a legacy product path', () => {
    expect(scanNomixBranding(['scripts/verify-nomix-branding.spec.ts'])).toEqual([])
    expect(scanNomixBranding(['packages/example/dsh-plugin/index.ts'])).toEqual([
      { path: 'packages/example/dsh-plugin/index.ts', line: 0, rule: 'legacy path name' },
    ])
  })
})
