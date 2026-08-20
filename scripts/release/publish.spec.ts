import { describe, expect, it } from 'vitest'
import { resolvePublishPolicy } from './publish.ts'

describe('release publish policy', () => {
  it('reads validated pacing values from the environment', () => {
    expect(resolvePublishPolicy({
      NOMIX_NPM_PUBLISH_ATTEMPTS: '8',
      NOMIX_NPM_PUBLISH_SPACING_MS: '20000',
      NOMIX_NPM_PUBLISH_RETRY_BASE_MS: '120000',
      NOMIX_NPM_PUBLISH_RETRY_MAX_MS: '600000',
    })).toEqual({ attempts: 8, spacingMs: 20_000, retryBaseMs: 120_000, retryMaxMs: 600_000 })
  })

  it('rejects invalid values and an inverted retry range', () => {
    expect(() => resolvePublishPolicy({ NOMIX_NPM_PUBLISH_ATTEMPTS: '0' })).toThrow(/positive integer/)
    expect(() => resolvePublishPolicy({
      NOMIX_NPM_PUBLISH_RETRY_BASE_MS: '2000',
      NOMIX_NPM_PUBLISH_RETRY_MAX_MS: '1000',
    })).toThrow(/greater than or equal/)
  })
})
