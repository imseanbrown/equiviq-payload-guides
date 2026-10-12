# Equiviq Guides for Payload

Reusable Payload 3 plugin and server-rendered Next.js components for public
Equiviq Knowledge guides. Guides are read from Equiviq on request and are never
copied into Payload collections or its search index.

## Configuration

Install this package from the public Equiviq GitHub repository in a Payload 3
project. The package includes compiled JavaScript, TypeScript declarations,
styles, and the Equiviq callout artwork; consumers do not need to compile its
TypeScript source.

```sh
pnpm add 'git+https://github.com/imseanbrown/payload-equiviq.git#v0.3.5'
```

The Git tag pins an exact package version. Payload has no WordPress-style
in-application updater for site plugins. Check this repository's releases,
change the Git tag in the host application's dependency, install, run any
documented database migrations, and rebuild/deploy the host application.
The `private` package setting prevents accidental npm registry publication;
it does not restrict installation from this public Git repository.

Payload requires a one-time plugin registration in its configuration. After
that, editors set the connection and place or configure content blocks in the
admin UI. A custom frontend still needs to render its Payload Pages; the
equiviq.com Next.js integration is the reference adapter for index and article
permalinks. The package does not alter unrelated frontend routes.

The plugin has two layers:

1. **Connection** — In Payload admin, open Globals → Equiviq Guides. Paste the
   Guides API URL and an Equiviq API key, save, then click **Test connection**.
   The key is encrypted with Payload's server secret, cannot be read back from
   the admin/API, and can be replaced by entering a new key. Keep the Payload
   secret stable across deployments. The same configuration works on Cloudflare
   Workers, Node, Docker, or another Payload host.
2. **Content** — Add an Equiviq Guides block to a Page. Each block controls its
   own filters, categorization, metadata, and callout style. The block fetches
   content from Equiviq on request rather than copying articles into Payload.

An existing environment-variable configuration remains supported as a fallback
until the admin connection is saved.

```ts
import { equiviqGuidesPlugin } from '@equiviq/payload-guides'

const options = {
  apiUrlEnv: 'EQUIVIQ_GUIDES_API_URL',
  apiKeyEnv: 'EQUIVIQ_GUIDES_API_KEY',
}

// In buildConfig({ plugins: [...] }):
equiviqGuidesPlugin(options)
```

For the test tenant, `EQUIVIQ_GUIDES_API_URL` is
`https://dev.equiviq.com/api/public/plugins/equiviq-payload/org-000002/guides`.
Create a key in Equiviq's Payload plugin settings. Paste it into Payload's
Equiviq Guides connection settings, or use the host's secret manager for the
legacy environment-variable setup. Never put it in `NEXT_PUBLIC_*` or a client
component. Payload stores only authenticated ciphertext when configured in the
admin UI.

The plugin adds an **Equiviq Guides** block to the Pages layout and an
**Equiviq Guides** settings page in Payload. Add the block to any number of
published Pages. Each page becomes a searchable index with article URLs under
its slug. Select one of those pages as **Primary guide page** in settings;
its URLs are canonical for SEO and the sitemap. The API never sets a site URL.

The host app owns its Next.js route files. Call `createGuideClient(options)` in
server code and use `GuideIndex` and `GuideArticle` to render each placement.
The guide image route should call `client.getImage(article, image)`. Import
`@equiviq/payload-guides/styles.css` once in the frontend layout. See the
equiviq.com integration for a complete example.

## Lead generation

The saved Guides API URL and key also authorize lead submissions. The plugin
adds **Equiviq → Lead Generation** CTA records and an **Equiviq Lead Form**
page block. Configure fields, acquisition text, visitor messages, and a
privacy policy URL, then place the CTA in a block. Email is always required;
organization is required whenever shown. Set a site privacy policy URL in
Equiviq connection settings or override it on the CTA.

The host renders `EquiviqLeadForm` from `@equiviq/payload-guides/lead-form` for
the page block. The equiviq.com `PageLayout` is the reference adapter. The
component submits to the Payload endpoint on the same site; the plugin checks
the tenant work-email domain and forwards to Equiviq with the server-side key.
The full page URL including query string is sent as the referring URL. No
Equiviq-hosted form or site-owner Cloudflare setup is used.

Temporary failures enter **Equiviq → Undelivered leads** with a stable
submission ID. Reading a CTA retries one due item with backoff, so published
form traffic drives automatic retries. Permanently rejected items stay visible
for administrator review. The authenticated
`POST /api/equiviq-lead-ctas/retry` endpoint also retries the current batch.
Newsletter, ticket, and task actions remain disabled.

Article URLs use readable slugs ending in the stable Equiviq article UUID.
The index supports full-text search through Equiviq Payload 0.1.2 or later.
Search results and article content are filtered in Equiviq to publicly
available, published guides and visible published sections only. During
structured approval, the last approved section snapshot remains available.

Responses remain uncached until visibility-change invalidation is implemented.
This makes unpublishing or restricting an article effective immediately.

## Callout icons

Place the four SVG files from `assets/` at `/callouts/` in the host site's
public directory when using the Equiviq callout style. They are the same
icons used by the Equiviq Knowledge print view. The website theme style
does not display icons.

Legacy published `> **NOTE**` and similar headings are normalized while
rendering. New callouts use the `[!NOTE]` Markdown marker. Both formats
render identically.
