import type { Block, CollectionConfig, Config, GlobalConfig } from 'payload'
import { decryptGuideKey, encryptGuideKey } from './credentials'
import { createLeadCTACollection, equiviqLeadBlock, equiviqLeadQueue } from './leads'

export type EquiviqGuidesOptions = {
  /** Name of the server environment variable containing the HTTPS guide list API URL. */
  apiUrlEnv: string
  /** Name of the server environment variable containing the Equiviq API key. */
  apiKeyEnv: string
  /** Payload collection that owns guide index blocks. Defaults to pages. */
  pagesCollection?: string
}

export const equiviqGuidesBlock: Block = {
  slug: 'equiviqGuides',
  labels: { singular: 'Equiviq Guides', plural: 'Equiviq Guides' },
  interfaceName: 'EquiviqGuidesBlock',
  fields: [
    { name: 'heading', type: 'text', defaultValue: 'Guides & Resources', required: true },
    { name: 'filters', type: 'group', label: 'Article filters', fields: [
      ...(['folder', 'category', 'tag', 'company'] as const).flatMap((kind) => [
        { name: `${kind}Include`, type: 'text' as const, label: `Include ${kind}s`, admin: { components: { Field: { path: '@equiviq/payload-guides/facet-field#FacetField', clientProps: { kind, mode: 'Include' } } } } },
        { name: `${kind}Exclude`, type: 'text' as const, label: `Exclude ${kind}s`, admin: { components: { Field: { path: '@equiviq/payload-guides/facet-field#FacetField', clientProps: { kind, mode: 'Exclude' } } } } },
      ]),
    ] },
    { name: 'calloutStyle', type: 'select', defaultValue: 'equiviq', options: [
      { label: 'Inherit from Equiviq', value: 'equiviq' },
      { label: 'Inherit from website theme', value: 'theme' },
    ] },
    { name: 'classification', type: 'group', label: 'Categorization block', fields: [
      { name: 'show', type: 'checkbox', defaultValue: true, label: 'Show categorization block' },
      ...(['folders', 'category', 'tags', 'articleId', 'version', 'updated', 'visibility'] as const).map((name) => ({ name, type: 'checkbox' as const, defaultValue: true, label: `Show ${name}` })),
    ] },
    { name: 'metadata', type: 'group', label: 'Metadata block', fields: [
      { name: 'show', type: 'checkbox', defaultValue: true, label: 'Show metadata block' },
      ...(['author', 'updated', 'published', 'created', 'approved', 'permalink'] as const).map((name) => ({ name, type: 'checkbox' as const, defaultValue: true, label: `Show ${name}` })),
    ] },
  ],
}

export const equiviqGuidesSettings: GlobalConfig = {
  slug: 'equiviq-guides-settings',
  label: 'Settings',
  admin: { group: 'Equiviq', description: 'Connect Knowledge and Lead Generation to Equiviq. The API key is encrypted and is never displayed again after saving. If these fields are empty, an existing server-secret connection remains active.' },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  endpoints: [{ path: '/test-connection', method: 'post', handler: async (req) => {
    if (!req.user) return Response.json({ message: 'Sign in to test the connection.' }, { status: 401 })
    const settings = await req.payload.findGlobal({ slug: 'equiviq-guides-settings', depth: 0, context: { equiviqGuidesInternal: true } }) as { apiUrl?: string; apiKey?: string }
    const names = req.payload.config.custom?.equiviqGuides as { apiUrlEnv?: string; apiKeyEnv?: string } | undefined
    const saved = Boolean(settings.apiUrl && settings.apiKey)
    const apiUrl = saved ? settings.apiUrl : names?.apiUrlEnv ? process.env[names.apiUrlEnv] : undefined
    const apiKey = saved ? settings.apiKey : names?.apiKeyEnv ? process.env[names.apiKeyEnv] : undefined
    if (!apiUrl || !apiKey) return Response.json({ message: 'Save an API URL and key before testing.' }, { status: 400 })
    try {
      const response = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(7000) })
      if (!response.ok) return Response.json({ message: response.status === 401 || response.status === 403 ? 'Equiviq rejected this API key.' : `Equiviq returned HTTP ${response.status}.` }, { status: 502 })
      const body = await response.json() as { guides?: unknown }
      if (!Array.isArray(body.guides)) return Response.json({ message: 'Equiviq returned an unexpected response.' }, { status: 502 })
      return Response.json({ message: `Connected to Equiviq using ${saved ? 'saved settings' : 'server secrets'}. Guides are available to your content blocks.` })
    } catch { return Response.json({ message: 'Could not reach Equiviq. Check the API URL and try again.' }, { status: 502 }) }
  } }],
  fields: [
  { name: 'apiUrl', label: 'Equiviq API URL', type: 'text', admin: { description: 'Paste the HTTPS Guides API URL from the Equiviq Payload plugin settings.' },
    validate: (value: unknown) => {
      if (!value) return true
      try {
        const url = new URL(String(value))
        return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && /\/api\/public\/plugins\/equiviq-payload\/[^/]+\/guides\/?$/.test(url.pathname)
          ? true : 'Enter the HTTPS Guides API URL shown in Equiviq.'
      } catch { return 'Enter a valid HTTPS Guides API URL.' }
    } },
  { name: 'apiKey', label: 'Equiviq API key', type: 'text', admin: { description: 'Paste a new API key to set or rotate it. Leave blank to keep the existing key. It will never be displayed again.' },
    hooks: {
      beforeChange: [({ value, previousValue, req }) => value ? encryptGuideKey(String(value), req.payload.secret) : previousValue],
      afterRead: [({ value, req }) => req.context?.equiviqGuidesInternal === true && value ? decryptGuideKey(String(value), req.payload.secret) : null],
    } },
  { name: 'connectionTest', type: 'ui', admin: { components: { Field: '@equiviq/payload-guides/connection-test#ConnectionTest' } } },
  // Retain existing values for sites upgrading from the combined settings screen.
  { name: 'privacyPolicyUrl', type: 'text', admin: { hidden: true } },
  { name: 'primaryPage', type: 'relationship', relationTo: 'pages', admin: { hidden: true } },
  { name: 'legacyPaths', type: 'array', admin: { hidden: true }, fields: [{ name: 'path', type: 'text', required: true }] },
  ],
}

export const equiviqKnowledgeSettings: GlobalConfig = {
  slug: 'equiviq-knowledge-settings',
  label: 'Knowledge',
  admin: { group: 'Equiviq', description: 'Choose the canonical page for published guides.' },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    const previous = typeof originalDoc?.primaryPage === 'object' ? originalDoc.primaryPage?.id : originalDoc?.primaryPage
    const selected = typeof data.primaryPage === 'object' ? data.primaryPage?.id : data.primaryPage
    if (selected) {
      const page = await req.payload.findByID({ collection: 'pages', id: selected, depth: 0, req })
      if (!page?.layout?.some((block: { blockType?: string }) => block.blockType === 'equiviqGuides')) {
        throw new Error('The primary page must contain an Equiviq Guides block')
      }
    }
    if (previous && previous !== selected) {
      const oldPage = await req.payload.findByID({ collection: 'pages', id: previous, depth: 0, req }).catch((): null => null)
      if (oldPage?.slug && oldPage.slug !== 'home') {
        const history = Array.isArray(originalDoc?.legacyPaths) ? originalDoc.legacyPaths : []
        data.legacyPaths = [...history.filter((item: { path?: string }) => item.path !== `/${oldPage.slug}`), { path: `/${oldPage.slug}` }]
      }
    }
    return { ...data, configured: true }
  }] },
  fields: [
  { name: 'configured', type: 'checkbox', admin: { hidden: true }, defaultValue: false },
  {
    name: 'primaryPage', label: 'Primary guide page', type: 'relationship', relationTo: 'pages',
    admin: { description: 'This page must contain an Equiviq Guides block. Other pages may also contain the block; search engines will use this page as the canonical article location.' },
  }, { name: 'legacyPaths', type: 'array', admin: { hidden: true }, fields: [{ name: 'path', type: 'text', required: true }] },
  ],
}

export const equiviqLeadSettings: GlobalConfig = {
  slug: 'equiviq-lead-settings',
  label: 'Lead Generation',
  admin: { group: 'Equiviq', description: 'Set the default privacy policy for lead forms. Configure individual CTAs in Lead Generation CTAs.' },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  hooks: { beforeChange: [({ data }) => ({ ...data, configured: true })] },
  fields: [
    { name: 'configured', type: 'checkbox', admin: { hidden: true }, defaultValue: false },
    { name: 'blockFreeEmailDomains', label: 'Block free email domains', type: 'checkbox', defaultValue: true,
      admin: { description: 'When disabled, a free-domain submission creates or updates a person without creating or assigning an organization.' } },
    { name: 'privacyPolicyUrl', label: 'Site privacy policy URL', type: 'text', admin: { description: 'Used by lead forms unless a CTA overrides it. Forms require a privacy policy link.' },
      validate: (value: unknown) => !value || (typeof value === 'string' && /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(value)) ? true : 'Enter an HTTPS privacy policy URL.' },
  ],
}

export function equiviqGuidesPlugin(options: EquiviqGuidesOptions) {
  for (const name of [options.apiUrlEnv, options.apiKeyEnv]) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Equiviq guide environment variable names are invalid')
  }
  return (config: Config): Config => {
    const pageSlug = options.pagesCollection || 'pages'
    let found = false
    const collections = (config.collections || []).map((collection): CollectionConfig => {
      if (collection.slug !== pageSlug) return collection
      found = true
      const layout = collection.fields.find((field) => 'name' in field && field.name === 'layout')
      if (!layout || layout.type !== 'blocks') throw new Error(`${pageSlug}.layout must be a blocks field`)
      return { ...collection, fields: collection.fields.map((field) => field === layout ? { ...layout, blocks: [...layout.blocks, equiviqGuidesBlock, equiviqLeadBlock] } : field) }
    })
    if (!found) throw new Error(`Equiviq Guides page collection ${pageSlug} was not found`)
    return {
      ...config,
      collections: [...collections, createLeadCTACollection(options), equiviqLeadQueue],
      globals: [...(config.globals || []), equiviqGuidesSettings, equiviqKnowledgeSettings, equiviqLeadSettings],
      custom: { ...config.custom, equiviqGuides: { apiUrlEnv: options.apiUrlEnv, apiKeyEnv: options.apiKeyEnv } },
    }
  }
}
