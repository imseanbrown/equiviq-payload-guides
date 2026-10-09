import { describe, expect, it } from 'vitest'
import { decryptGuideKey, encryptGuideKey } from './credentials'

describe('Equiviq API key storage', () => {
  it('encrypts keys with a fresh nonce and rejects another Payload secret', () => {
    const first = encryptGuideKey('sample-key', 'payload-secret-one')
    const second = encryptGuideKey('sample-key', 'payload-secret-one')
    expect(first).not.toContain('sample-key')
    expect(first).not.toBe(second)
    expect(decryptGuideKey(first, 'payload-secret-one')).toBe('sample-key')
    expect(() => decryptGuideKey(first, 'payload-secret-two')).toThrow()
  })
})
