import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLeadCTACollection } from './leads'

afterEach(() => vi.unstubAllGlobals())

describe('Payload free email policy', () => {
  it.each([true, false])('forwards setting %s to both Equiviq requests', async (blockFreeEmailDomains: boolean) => {
    const sent: Array<{ url: string; body: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      sent.push({ url, body: JSON.parse(init.body) })
      return Response.json(url.endsWith('/lead-email-check') ? { allowed: true } : { person_id: 'person-1' })
    }))
    const req = {
      url: 'https://example.test/api/equiviq-lead-ctas/submit',
      headers: new Headers({ origin: 'https://example.test' }),
      json: async () => ({ cta_id: 'demo', email: 'person@gmail.com', organization: 'Example', source_url: 'https://example.test/contact', started: Date.now() - 3000 }),
      payload: {
        find: async () => ({ docs: [{ slug: 'demo', fields: { organization: { visible: true } } }] }),
        findGlobal: async ({ slug }: { slug: string }) => slug === 'equiviq-lead-settings'
          ? { blockFreeEmailDomains }
          : { apiUrl: 'https://api.example.test/api/public/plugins/equiviq-payload/example/guides', apiKey: 'test-key' },
      },
    }
    const endpoints = createLeadCTACollection({ apiUrlEnv: 'API_URL', apiKeyEnv: 'API_KEY' }).endpoints
    if (!endpoints) throw new Error('Expected lead endpoint')
    const handler = endpoints[0].handler
    const result = await handler?.(req as any)
    expect(result?.status).toBe(200)
    expect(sent).toHaveLength(2)
    expect(sent[0].body.block_free_email_domains).toBe(blockFreeEmailDomains)
    expect(sent[1].body.block_free_email_domains).toBe(blockFreeEmailDomains)
  })
})
