import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { GuideArticle, normalizeGuideCallouts } from './components'
import type { PublicGuide } from './server'

test('legacy Equiviq callouts use the selected Equiviq layout and exact icon family', () => {
  const source = '> **NOTE**\n>\n> \u00a0You need the device.\n\n> **WARNING**\n>\n> Unplug the phone.'
  assert.match(normalizeGuideCallouts(source), /^> \[!NOTE\]/)
  const article: PublicGuide = {
    id: '8fd82214-5f8c-4782-8924-a62ef1bc5912',
    document_number: 'FAQ-00001', title: 'Polycom SoundPoint', slug: 'polycom-soundpoint-8fd82214-5f8c-4782-8924-a62ef1bc5912',
    updated_at: '2026-10-09T00:00:00Z', visibility_label: 'Public Access', public_access: true,
    description: 'Factory reset guide', author: 'Equiviq', manufacturer: 'Polycom', category: '', tags: [], folders: [],
    version: 1, created_at: '2026-10-09T00:00:00Z', published_at: '2026-10-09T00:00:00Z', approved_at: null,
    callout_colors: { note: '#336699', warning: '#aabbcc' },
    created_by: '', updated_by: '', approved_by: '', published_by: '',
    sections: [{ title: 'Prerequisites', markdown: source }],
  }
  const html = renderToStaticMarkup(createElement(GuideArticle, {
    article, basePath: '/guides', canonicalURL: 'https://equiviq.com/guides/' + article.slug,
    settings: { calloutStyle: 'equiviq' },
  }))
  assert.match(html, /equiviq-guide-callout-note/)
  assert.match(html, /equiviq-guide-callout-warning/)
  assert.match(html, /equiviq-guide-callout-icon-pin/)
  assert.match(html, /equiviq-guide-callout-icon-warning/)
  assert.match(html, /--equiviq-callout-note:#336699/)
  assert.doesNotMatch(html, /<strong>NOTE<\/strong>/)
})

test('guide markdown tables keep semantic table markup inside a scrollable region', () => {
  const article: PublicGuide = {
    id: '8fd82214-5f8c-4782-8924-a62ef1bc5912',
    document_number: 'FAQ-00001', title: 'Credential security', slug: 'credential-security-8fd82214-5f8c-4782-8924-a62ef1bc5912',
    updated_at: '2026-10-09T00:00:00Z', visibility_label: 'Public Access', public_access: true,
    description: 'Security guide', author: 'Equiviq', manufacturer: '', category: '', tags: [], folders: [],
    version: 1, created_at: '2026-10-09T00:00:00Z', published_at: '2026-10-09T00:00:00Z', approved_at: null,
    created_by: '', updated_by: '', approved_by: '', published_by: '',
    sections: [{ title: 'Controls', markdown: '| Area | Responsibility |\n| --- | --- |\n| Keys | Rotate and back up keys |' }],
  }
  const html = renderToStaticMarkup(createElement(GuideArticle, {
    article, basePath: '/guides', canonicalURL: 'https://equiviq.com/guides/' + article.slug,
  }))
  assert.match(html, /<div class="equiviq-guide-table-scroll" role="region"[^>]*tabindex="0"><table>/)
  assert.match(html, /Swipe to see all columns/)
  assert.doesNotMatch(html, /class="equiviq-guide-status"/)
  assert.match(html, /<th>Area<\/th>/)
  assert.match(html, /<td>Rotate and back up keys<\/td>/)
})
