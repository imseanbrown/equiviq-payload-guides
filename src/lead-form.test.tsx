import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EquiviqLeadForm } from './lead-form'

describe('Equiviq lead form CTA copy', () => {
  it('renders multiline CTA text between the heading and inputs', () => {
    const html = renderToStaticMarkup(<EquiviqLeadForm cta={{ slug: 'qa-cta', heading: 'Talk to us', ctaText: 'Tell us what you need.\nWe will follow up.', privacyUrl: 'https://example.test/privacy' }} />)
    expect(html).toContain('white-space:pre-line')
    expect(html.indexOf('Talk to us')).toBeLessThan(html.indexOf('Tell us what you need.'))
    expect(html.indexOf('We will follow up.')).toBeLessThan(html.indexOf('name="email"'))
  })
})
