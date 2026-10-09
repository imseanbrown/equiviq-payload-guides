# Equiviq Guides for Payload

Reusable Payload 3 plugin and server-rendered Next.js components for public
Equiviq Knowledge guides. Guides are read from Equiviq on request and are never
copied into Payload collections or its search index.

## Configuration

Set the guide list API URL and API key as **server environment variables** on
the host running Payload. The key must be treated as a secret. This works on
Cloudflare Workers, a Node server, Docker, or another Payload deployment.

```ts
import { equiviqGuidesPlugin } from '@equiviq/payload-guides'

const options = {
  apiUrlEnv: 'EQUIVIQ_GUIDES_API_URL',
  apiKeyEnv: 'EQUIVIQ_GUIDES_API_KEY',
  basePath: '/guides',
}

// In buildConfig({ plugins: [...] }):
equiviqGuidesPlugin(options)
```

For the test tenant, `EQUIVIQ_GUIDES_API_URL` is
`https://dev.equiviq.com/api/public/plugins/equiviq-payload/org-000002/guides`.
Create a key in Equiviq's Payload plugin settings. Place it in the host's
secret manager; never put it in `NEXT_PUBLIC_*`, a Payload Global, or a client
component. The plugin records only the variable names in Payload's config.

The host app owns its Next.js route files. Call `createGuideClient(options)` in
server code and use `GuideIndex` and `GuideArticle` in the catch-all route. The
guide image route should call `client.getImage(article, image)`. Import
`@equiviq/payload-guides/styles.css` once in the frontend layout. See the
equiviq.com integration for a complete example.

The base path configured here must match the publication path in Equiviq.
Article URLs use readable slugs ending in the stable Equiviq article UUID.
The index supports full-text search through Equiviq Payload 0.1.1 or later.
Search results and article content are filtered in Equiviq to active, publicly
available, published guides and visible published sections only.

Responses remain uncached until visibility-change invalidation is implemented.
This makes unpublishing or restricting an article effective immediately.
