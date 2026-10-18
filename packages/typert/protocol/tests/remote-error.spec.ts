import { describe, expect, it } from 'vitest'
import { RemoteError, remoteErrorOf } from '@nomix-ai/nomix-typert-protocol'

describe('RemoteError identification across module copies', () => {
  it('recognizes the Nomix marker without a shared prototype', () => {
    const error = new RemoteError('gateway/internal', 'failed', {})
    expect(error.isNomixRemoteError).toBe(true)
    expect(remoteErrorOf(error)).toBe(error)
    const otherCopy = { isNomixRemoteError: true, code: 'gateway/internal', details: {} }
    expect(remoteErrorOf(otherCopy)).toBe(otherCopy)
  })

  it('does not accept the retired marker or a missing code', () => {
    expect(remoteErrorOf({ isDSHRemoteError: true, code: 'gateway/internal' })).toBeUndefined()
    expect(remoteErrorOf({ isNomixRemoteError: true })).toBeUndefined()
    expect(remoteErrorOf(null)).toBeUndefined()
  })
})
