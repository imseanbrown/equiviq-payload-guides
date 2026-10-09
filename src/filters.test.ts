import { describe, expect, it } from 'vitest'
import { guideMatchesFilters } from './filters'
import type { PublicGuideSummary } from './server'

const guide: PublicGuideSummary = {
  id: '53ee2a53-7db1-4bc3-b2ab-56d647836641', document_number: 'FAQ-000005',
  title: 'Test article', slug: 'test-article-53ee2a53-7db1-4bc3-b2ab-56d647836641',
  updated_at: '2026-10-09T12:00:00Z', visibility_label: 'Public Access', public_access: true,
  category: 'Devices', company: 'Equiviq', folders: ['Product Guides / Setup'], tags: ['Network', 'Field'],
}

describe('guide placement filters', () => {
  it('shows all guides when no filter is selected', () => expect(guideMatchesFilters(guide, {})).toBe(true))
  it('matches any selected item of a facet and requires every selected facet', () => {
    expect(guideMatchesFilters(guide, { tagInclude: '["Other","Network"]', companyInclude: '["Equiviq"]' })).toBe(true)
    expect(guideMatchesFilters(guide, { tagInclude: '["Network"]', companyInclude: '["Other"]' })).toBe(false)
  })
  it('gives exclusions precedence even when the same value is included', () => {
    expect(guideMatchesFilters(guide, { folderInclude: '["Product Guides / Setup"]', folderExclude: '["Product Guides / Setup"]' })).toBe(false)
  })
  it('uses complete folder paths and supports old comma separated settings', () => {
    expect(guideMatchesFilters(guide, { folderInclude: '["Product Guides"]' })).toBe(false)
    expect(guideMatchesFilters(guide, { categoryInclude: 'Devices, Other' })).toBe(true)
  })
})
