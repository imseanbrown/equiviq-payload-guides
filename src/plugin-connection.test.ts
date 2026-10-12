import { describe, expect, it } from 'vitest'
import { equiviqGuidesSettings, equiviqKnowledgeSettings, equiviqLeadSettings } from './plugin'

const keyField = equiviqGuidesSettings.fields.find((field) => 'name' in field && field.name === 'apiKey') as {
  hooks: { beforeChange: ((args: any) => string)[]; afterRead: ((args: any) => string | null)[] }
}
const req = { payload: { secret: 'stable-payload-secret' }, context: {} }

describe('Equiviq Guides admin connection', () => {
  it('keeps connection, knowledge, and lead settings in separate admin sections', () => {
    expect([equiviqGuidesSettings.label, equiviqKnowledgeSettings.label, equiviqLeadSettings.label]).toEqual(['Settings', 'Knowledge', 'Lead Generation'])
    const visible = (fields: typeof equiviqGuidesSettings.fields) => fields.filter((field) => !('admin' in field && (field.admin as { hidden?: boolean } | undefined)?.hidden)).map((field) => 'name' in field ? field.name : '')
    expect(visible(equiviqGuidesSettings.fields)).toContain('apiKey')
    expect(visible(equiviqGuidesSettings.fields)).not.toContain('primaryPage')
    expect(visible(equiviqKnowledgeSettings.fields)).toContain('primaryPage')
    expect(visible(equiviqLeadSettings.fields)).toContain('privacyPolicyUrl')
  })
  it('keeps the key out of admin reads and preserves it when the field is left empty', () => {
    const stored = keyField.hooks.beforeChange[0]({ value: 'private-api-key', req })
    expect(stored).not.toContain('private-api-key')
    expect(keyField.hooks.afterRead[0]({ value: stored, req })).toBeNull()
    expect(keyField.hooks.beforeChange[0]({ value: '', previousValue: stored, req })).toBe(stored)
    expect(keyField.hooks.afterRead[0]({ value: stored, req: { ...req, context: { equiviqGuidesInternal: true } } })).toBe('private-api-key')
  })
})
