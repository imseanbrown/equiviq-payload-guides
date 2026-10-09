import { describe, expect, it } from 'vitest'
import { equiviqGuidesSettings } from './plugin'

const keyField = equiviqGuidesSettings.fields.find((field) => 'name' in field && field.name === 'apiKey') as {
  hooks: { beforeChange: ((args: any) => string)[]; afterRead: ((args: any) => string | null)[] }
}
const req = { payload: { secret: 'stable-payload-secret' }, context: {} }

describe('Equiviq Guides admin connection', () => {
  it('keeps the key out of admin reads and preserves it when the field is left empty', () => {
    const stored = keyField.hooks.beforeChange[0]({ value: 'private-api-key', req })
    expect(stored).not.toContain('private-api-key')
    expect(keyField.hooks.afterRead[0]({ value: stored, req })).toBeNull()
    expect(keyField.hooks.beforeChange[0]({ value: '', previousValue: stored, req })).toBe(stored)
    expect(keyField.hooks.afterRead[0]({ value: stored, req: { ...req, context: { equiviqGuidesInternal: true } } })).toBe('private-api-key')
  })
})
