import { Children, isValidElement, type CSSProperties, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { PublicGuide, PublicGuideSummary } from './server'

const calloutKinds = new Set(['NOTE', 'INFO', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])

// Older Equiviq editor versions stored the callout heading as bold text inside
// a quote. Normalize that source at render time so published snapshots and
// newly authored callouts use the same presentation without rewriting history.
export function normalizeGuideCallouts(markdown: string): string {
  return markdown.replace(/^(\s*>\s*)(?:\*\*|__)(NOTE|INFO|TIP|IMPORTANT|WARNING|CAUTION)(?:\*\*|__)(?:\s|\u00a0)*$/gim,
    (_line, quote: string, kind: string) => `${quote}[!${kind.toUpperCase()}]`)
}

function GuideBlockquote({ children, style = 'equiviq' }: { children?: ReactNode; style?: 'equiviq' | 'theme' }) {
  const paragraphs = Children.toArray(children).filter((part) => typeof part !== 'string' || part.trim())
  const first = paragraphs[0]
  if (!isValidElement<{ children?: ReactNode }>(first)) return <blockquote>{children}</blockquote>
  const firstParts = Children.toArray(first.props.children)
  const firstText = typeof firstParts[0] === 'string' ? firstParts[0] : ''
  const marker = firstText.match(/^\s*\[!(NOTE|INFO|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s|$)/i)
  if (!marker || !calloutKinds.has(marker[1].toUpperCase())) return <blockquote>{children}</blockquote>
  const kind = marker[1].toUpperCase()
  const remainder = firstText.slice(marker[0].length).trim()
  return <blockquote className={`equiviq-guide-callout equiviq-guide-callout-${kind.toLowerCase()} ${style === 'theme' ? 'equiviq-guide-callout-theme' : ''}`}>
    {style === 'equiviq' && <span className="equiviq-guide-callout-icon" aria-hidden="true"><span className={`equiviq-guide-callout-icon-${kind === 'TIP' ? 'lightbulb' : kind === 'IMPORTANT' || kind === 'CAUTION' ? 'hand-right' : kind === 'WARNING' ? 'warning' : 'pin'}`} /></span>}
    <div className="equiviq-guide-callout-content">
      <p className="equiviq-guide-callout-label">{kind}</p>
      {(remainder || firstParts.length > 1) && <p>{remainder}{firstParts.slice(1)}</p>}
      {paragraphs.slice(1)}
    </div>
  </blockquote>
}

function date(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(parsed)
}

function faqPairs(article: PublicGuide): { question: string; answer: string }[] {
  const faq = article.sections.find((section) => /^frequently asked questions$/i.test(section.title.trim()))
  if (!faq) return []
  const parts = faq.markdown.split(/^#{2,3}\s+(.+\?)\s*$/gm)
  const pairs: { question: string; answer: string }[] = []
  for (let index = 1; index + 1 < parts.length; index += 2) {
    const question = parts[index].trim()
    const answer = parts[index + 1].trim()
    if (question && answer) pairs.push({ question, answer })
  }
  return pairs
}

export function GuideIndex({ guides, query, basePath, heading = 'Guides & Resources' }: { guides: PublicGuideSummary[]; query: string; basePath: string; heading?: string }) {
  return <div className="equiviq-guide-shell">
    <section className="equiviq-guide-card equiviq-guide-index">
      <p className="equiviq-guide-eyebrow">Equiviq Knowledge</p>
      <h1>{heading}</h1>
      <p className="equiviq-guide-intro">Search guides from Equiviq.</p>
      <form action={basePath} method="get" role="search" className="equiviq-guide-search">
        <label htmlFor="equiviq-guide-query">Search guides</label>
        <div><input id="equiviq-guide-query" name="q" type="search" defaultValue={query} placeholder="Search titles and article content" maxLength={120} /><button type="submit">Search</button></div>
      </form>
      {query && <div className="equiviq-guide-result-heading"><h2>{guides.length ? `Results for “${query}”` : `No results for “${query}”`}</h2><a href={basePath}>Clear search</a></div>}
      {guides.length ? <ul className="equiviq-guide-list">{guides.map((guide) =>
        <li key={guide.id}><a href={`${basePath}/${guide.slug}`}><strong>{guide.title}</strong><span>{guide.document_number} <span aria-hidden="true">·</span> Updated {date(guide.updated_at)}</span></a></li>,
      )}</ul> : <p className="equiviq-guide-empty">{query ? 'Try another term or browse all guides.' : 'No guides are available yet.'}</p>}
    </section>
  </div>
}

type VisibilitySettings = { show?: boolean | null; [key: string]: boolean | null | undefined }
type ArticleSettings = { calloutStyle?: 'equiviq' | 'theme' | null; classification?: VisibilitySettings | null; metadata?: VisibilitySettings | null }
function visible(group: VisibilitySettings | null | undefined, key: string): boolean { return group?.show !== false && group?.[key] !== false }

export function GuideArticle({ article, basePath, canonicalURL, settings }: { article: PublicGuide; basePath: string; canonicalURL: string; settings?: ArticleSettings }) {
  const safeColor = (value?: string) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined
  const calloutVariables = {
    '--equiviq-callout-note': safeColor(article.callout_colors?.note),
    '--equiviq-callout-tip': safeColor(article.callout_colors?.tip),
    '--equiviq-callout-important': safeColor(article.callout_colors?.important),
    '--equiviq-callout-warning': safeColor(article.callout_colors?.warning),
  } as CSSProperties
  const questions = faqPairs(article)
  const structured = questions.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: questions.map(({ question, answer }) => ({
      '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  } : {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: article.title, description: article.description,
    datePublished: article.published_at, dateModified: article.updated_at,
    mainEntityOfPage: canonicalURL,
    author: article.author ? { '@type': 'Person', name: article.author } : undefined,
  }

  return <main className="equiviq-guide-shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
    <article className="equiviq-guide-card equiviq-guide-article" style={calloutVariables}>
      <header className="equiviq-guide-heading">
        <a className="equiviq-guide-back" href={basePath}>← All guides</a>
        <p className="equiviq-guide-eyebrow">Guides &amp; Resources</p>
        <h1>{article.title}</h1>
        {visible(settings?.classification, 'visibility') && <span className="equiviq-guide-status">{article.visibility_label}</span>}
      </header>
      {settings?.classification?.show !== false && <section className="equiviq-guide-classification" aria-label="Article details">
        <dl>
          {visible(settings?.classification, 'folders') && article.folders?.length > 0 && <div><dt>Folders</dt><dd>{article.folders.join(', ')}</dd></div>}
          {visible(settings?.classification, 'category') && article.category && <div><dt>Category</dt><dd>{article.category}</dd></div>}
          {visible(settings?.classification, 'tags') && article.tags?.length > 0 && <div><dt>Tags</dt><dd>{article.tags.join(', ')}</dd></div>}
        </dl>
        <dl>
          {visible(settings?.classification, 'articleId') && <div><dt>Article ID</dt><dd>{article.document_number}</dd></div>}
          {visible(settings?.classification, 'version') && <div><dt>Version</dt><dd>v{article.version}</dd></div>}
          {visible(settings?.classification, 'updated') && <div><dt>Updated</dt><dd>{date(article.updated_at)}</dd></div>}
          {visible(settings?.classification, 'visibility') && <div><dt>Visibility</dt><dd>{article.visibility_label}</dd></div>}
        </dl>
      </section>}
      <div className="equiviq-guide-content">
        {article.sections.map((section, index) => <section key={`${section.title}-${index}`} className="equiviq-guide-section">
          <h2>{section.title}</h2>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            blockquote: ({ children }) => <GuideBlockquote style={settings?.calloutStyle === 'theme' ? 'theme' : 'equiviq'}>{children}</GuideBlockquote>,
            img: ({ src, alt }) => {
              const source = typeof src === 'string' ? src : undefined
              const match = source?.match(/\/knowledge\/article-images\/guides-resources\/([0-9a-f-]{36})/i)
              const safe = match ? `/guide-media/${article.id}/${match[1]}` : source
              return safe ? <img src={safe} alt={alt || ''} loading="lazy" /> : null
            },
          }}>{normalizeGuideCallouts(section.markdown)}</ReactMarkdown>
        </section>)}
      </div>
    </article>
    {settings?.metadata?.show !== false && <section className="equiviq-guide-card equiviq-guide-metadata" aria-labelledby="equiviq-guide-metadata-heading">
      <h2 id="equiviq-guide-metadata-heading">Article metadata</h2>
      <dl>
        {visible(settings?.metadata, 'author') && article.author && <div><dt>Author</dt><dd>{article.author}</dd></div>}
        {visible(settings?.metadata, 'created') && <div><dt>Created</dt><dd>{date(article.created_at)} · {article.created_by}</dd></div>}
        {visible(settings?.metadata, 'updated') && <div><dt>Updated</dt><dd>{date(article.updated_at)} · {article.updated_by}</dd></div>}
        {visible(settings?.metadata, 'approved') && <div><dt>Approved</dt><dd>{article.approved_at ? date(article.approved_at) : 'Not recorded'} · {article.approved_by}</dd></div>}
        {visible(settings?.metadata, 'published') && <div><dt>Published</dt><dd>{date(article.published_at)} · {article.published_by}</dd></div>}
        {visible(settings?.metadata, 'permalink') && <div className="equiviq-guide-permalink"><dt>Permalink</dt><dd><a href={canonicalURL}>{canonicalURL}</a></dd></div>}
      </dl>
    </section>}
  </main>
}
