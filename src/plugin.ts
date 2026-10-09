import type { Block, CollectionConfig, Config, GlobalConfig } from 'payload'

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
  fields: [{ name: 'heading', type: 'text', defaultValue: 'Guides & Resources', required: true }],
}

export const equiviqGuidesSettings: GlobalConfig = {
  slug: 'equiviq-guides-settings',
  label: 'Equiviq Guides',
  admin: { description: 'Place an Equiviq Guides block on any published page. Choose the primary page here for canonical article URLs. Configure the API URL and key as server secrets.' },
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
    return data
  }] },
  fields: [{
    name: 'primaryPage', label: 'Primary guide page', type: 'relationship', relationTo: 'pages',
    admin: { description: 'This page must contain an Equiviq Guides block. Other pages may also contain the block; search engines will use this page as the canonical article location.' },
  }, { name: 'legacyPaths', type: 'array', admin: { hidden: true }, fields: [{ name: 'path', type: 'text', required: true }] }],
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
      return { ...collection, fields: collection.fields.map((field) => field === layout ? { ...layout, blocks: [...layout.blocks, equiviqGuidesBlock] } : field) }
    })
    if (!found) throw new Error(`Equiviq Guides page collection ${pageSlug} was not found`)
    return {
      ...config,
      collections,
      globals: [...(config.globals || []), equiviqGuidesSettings],
      custom: { ...config.custom, equiviqGuides: { apiUrlEnv: options.apiUrlEnv, apiKeyEnv: options.apiKeyEnv } },
    }
  }
}
