import type { EquiviqGuidesOptions } from './plugin'

export type PublicGuideSummary = {
  id: string
  document_number: string
  title: string
  updated_at: string
  slug: string
  visibility_label: string
  public_access: true
  category?: string
  company?: string
  tags?: string[]
  folders?: string[]
  /** Present only in Equiviq 0.1.0 responses during a rolling upgrade. */
  permalink?: string
}

export type PublicGuide = PublicGuideSummary & {
  callout_colors?: { note?: string; tip?: string; important?: string; warning?: string }
  description: string
  author: string
  manufacturer: string
  category: string
  tags: string[]
  folders: string[]
  version: number
  created_at: string
  published_at: string
  approved_at: string | null
  created_by: string
  updated_by: string
  approved_by: string
  published_by: string
  sections: { title: string; markdown: string }[]
}

export type GuideFacets = { folders: string[]; categories: string[]; tags: string[]; companies: string[] }

const guideSlug = /^[a-z0-9-]{38,200}$/
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export function createGuideClient(options: EquiviqGuidesOptions, resolveCredentials?: () => Promise<{ apiUrl?: string | null; apiKey?: string | null } | null>) {
  async function configuration(): Promise<{ url: URL; key: string } | null> {
    const stored = await resolveCredentials?.().catch((): null => null)
    const hasStoredConnection = Boolean(stored?.apiUrl && stored?.apiKey)
    const rawURL = hasStoredConnection ? stored!.apiUrl : process.env[options.apiUrlEnv]
    const key = hasStoredConnection ? stored!.apiKey : process.env[options.apiKeyEnv]
    if (!rawURL || !key) return null
    try {
      const url = new URL(rawURL)
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) return null
      if (!/\/api\/public\/plugins\/equiviq-payload\/[^/]+\/guides\/?$/.test(url.pathname)) return null
      return { url, key }
    } catch {
      return null
    }
  }

  async function request<T>(path = '', search = ''): Promise<T | null> {
    const configured = await configuration()
    if (!configured) return null
    const { url, key } = configured
    url.pathname = `${url.pathname.replace(/\/$/, '')}${path ? `/${path}` : ''}`
    if (search) url.searchParams.set('q', search)
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      })
      return response.ok ? (await response.json()) as T : null
    } catch {
      return null
    }
  }

  async function listGuides(search = ''): Promise<PublicGuideSummary[] | null> {
    const query = search.trim().slice(0, 120)
    const result = await request<{ guides: PublicGuideSummary[]; search_applied?: boolean }>('', query)
    const items = result && Array.isArray(result.guides) ? result.guides.map((guide) => ({
      ...guide, slug: guide.slug || guide.permalink?.split('/').pop() || '',
    })).filter((guide) => guideSlug.test(guide.slug) && guide.public_access === true && typeof guide.visibility_label === 'string' && guide.visibility_label.trim() !== '') : null
    return items && query && !result?.search_applied
      ? items.filter((guide) => guide.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      : items
  }

  async function getGuide(slug: string): Promise<PublicGuide | null> {
    if (!guideSlug.test(slug)) return null
    const article = await request<PublicGuide>(encodeURIComponent(slug))
    return article?.public_access === true && typeof article.visibility_label === 'string' && article.visibility_label.trim() !== '' && Array.isArray(article.sections)
      ? { ...article, slug: article.slug || article.permalink?.split('/').pop() || '' } : null
  }

  async function getImage(article: string, image: string): Promise<Response | null> {
    if (!uuid.test(article) || !uuid.test(image)) return null
    const configured = await configuration()
    if (!configured) return null
    const { url, key } = configured
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${article}/images/${image}`
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      })
      const mime = response.headers.get('content-type')
      return response.ok && mime && ['image/png', 'image/jpeg', 'image/gif'].includes(mime) ? response : null
    } catch {
      return null
    }
  }

  async function recordView(slug: string, eventID: string, referrer: string): Promise<boolean> {
    if (!guideSlug.test(slug) || !uuid.test(eventID)) return false
    const configured = await configuration()
    if (!configured) return false
    const { url, key } = configured
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(slug)}/views`
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventID, referrer }), cache: 'no-store', signal: AbortSignal.timeout(7000),
      })
      return response.status === 204
    } catch { return false }
  }

  async function getFacets(): Promise<GuideFacets | null> {
    const configured = await configuration()
    if (!configured) return null
    const { url, key } = configured
    url.pathname = url.pathname.replace(/\/guides\/?$/, '/guide-facets')
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(7000) })
      return response.ok ? (await response.json()) as GuideFacets : null
    } catch { return null }
  }

  return { listGuides, getGuide, getImage, recordView, getFacets }
}
