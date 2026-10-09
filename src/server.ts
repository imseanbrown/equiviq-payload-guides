import 'server-only'

import { normalizeBasePath, type EquiviqGuidesOptions } from './plugin'

export type PublicGuideSummary = {
  id: string
  document_number: string
  title: string
  updated_at: string
  permalink: string
}

export type PublicGuide = PublicGuideSummary & {
  description: string
  author: string
  manufacturer: string
  category: string
  tags: string[]
  folders: string[]
  version: number
  visibility: 'Publicly Available'
  created_at: string
  published_at: string
  approved_at: string | null
  created_by: string
  updated_by: string
  approved_by: string
  published_by: string
  sections: { title: string; markdown: string }[]
}

const guideSlug = /^[a-z0-9-]{38,200}$/
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export function createGuideClient(options: EquiviqGuidesOptions) {
  const basePath = normalizeBasePath(options.basePath)

  function guideRouteSuffix(segments: string[]): string[] | null {
    const prefix = basePath.split('/').filter(Boolean)
    if (segments.length < prefix.length || prefix.some((part, index) => segments[index] !== part)) return null
    return segments.slice(prefix.length)
  }

  function configuration(): { url: URL; key: string } | null {
    const rawURL = process.env[options.apiUrlEnv]
    const key = process.env[options.apiKeyEnv]
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
    const configured = configuration()
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
    const result = await request<{ guides: PublicGuideSummary[] }>('', query)
    return result && Array.isArray(result.guides) ? result.guides : null
  }

  async function getGuide(slug: string): Promise<PublicGuide | null> {
    if (!guideSlug.test(slug)) return null
    const article = await request<PublicGuide>(encodeURIComponent(slug))
    return article?.visibility === 'Publicly Available' && Array.isArray(article.sections) ? article : null
  }

  async function getImage(article: string, image: string): Promise<Response | null> {
    if (!uuid.test(article) || !uuid.test(image)) return null
    const configured = configuration()
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

  return { basePath, guideRouteSuffix, listGuides, getGuide, getImage }
}
