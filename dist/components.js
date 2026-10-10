// src/components.tsx
import { Children, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jsx, jsxs } from "react/jsx-runtime";
var calloutKinds = /* @__PURE__ */ new Set(["NOTE", "INFO", "TIP", "IMPORTANT", "WARNING", "CAUTION"]);
function normalizeGuideCallouts(markdown) {
  return markdown.replace(
    /^(\s*>\s*)(?:\*\*|__)(NOTE|INFO|TIP|IMPORTANT|WARNING|CAUTION)(?:\*\*|__)(?:\s|\u00a0)*$/gim,
    (_line, quote, kind) => `${quote}[!${kind.toUpperCase()}]`
  );
}
function GuideBlockquote({ children, style = "equiviq" }) {
  const paragraphs = Children.toArray(children).filter((part) => typeof part !== "string" || part.trim());
  const first = paragraphs[0];
  if (!isValidElement(first)) return /* @__PURE__ */ jsx("blockquote", { children });
  const firstParts = Children.toArray(first.props.children);
  const firstText = typeof firstParts[0] === "string" ? firstParts[0] : "";
  const marker = firstText.match(/^\s*\[!(NOTE|INFO|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s|$)/i);
  if (!marker || !calloutKinds.has(marker[1].toUpperCase())) return /* @__PURE__ */ jsx("blockquote", { children });
  const kind = marker[1].toUpperCase();
  const remainder = firstText.slice(marker[0].length).trim();
  return /* @__PURE__ */ jsxs("blockquote", { className: `equiviq-guide-callout equiviq-guide-callout-${kind.toLowerCase()} ${style === "theme" ? "equiviq-guide-callout-theme" : ""}`, children: [
    style === "equiviq" && /* @__PURE__ */ jsx("span", { className: "equiviq-guide-callout-icon", "aria-hidden": "true", children: /* @__PURE__ */ jsx("span", { className: `equiviq-guide-callout-icon-${kind === "TIP" ? "lightbulb" : kind === "IMPORTANT" || kind === "CAUTION" ? "hand-right" : kind === "WARNING" ? "warning" : "pin"}` }) }),
    /* @__PURE__ */ jsxs("div", { className: "equiviq-guide-callout-content", children: [
      /* @__PURE__ */ jsx("p", { className: "equiviq-guide-callout-label", children: kind }),
      (remainder || firstParts.length > 1) && /* @__PURE__ */ jsxs("p", { children: [
        remainder,
        firstParts.slice(1)
      ] }),
      paragraphs.slice(1)
    ] })
  ] });
}
function date(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
function faqPairs(article) {
  const faq = article.sections.find((section) => /^frequently asked questions$/i.test(section.title.trim()));
  if (!faq) return [];
  const parts = faq.markdown.split(/^#{2,3}\s+(.+\?)\s*$/gm);
  const pairs = [];
  for (let index = 1; index + 1 < parts.length; index += 2) {
    const question = parts[index].trim();
    const answer = parts[index + 1].trim();
    if (question && answer) pairs.push({ question, answer });
  }
  return pairs;
}
function GuideIndex({ guides, query, basePath, heading = "Guides & Resources" }) {
  return /* @__PURE__ */ jsx("div", { className: "equiviq-guide-shell", children: /* @__PURE__ */ jsxs("section", { className: "equiviq-guide-card equiviq-guide-index", children: [
    /* @__PURE__ */ jsx("p", { className: "equiviq-guide-eyebrow", children: "Equiviq Knowledge" }),
    /* @__PURE__ */ jsx("h1", { children: heading }),
    /* @__PURE__ */ jsx("p", { className: "equiviq-guide-intro", children: "Search guides from Equiviq." }),
    /* @__PURE__ */ jsxs("form", { action: basePath, method: "get", role: "search", className: "equiviq-guide-search", children: [
      /* @__PURE__ */ jsx("label", { htmlFor: "equiviq-guide-query", children: "Search guides" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("input", { id: "equiviq-guide-query", name: "q", type: "search", defaultValue: query, placeholder: "Search titles and article content", maxLength: 120 }),
        /* @__PURE__ */ jsx("button", { type: "submit", children: "Search" })
      ] })
    ] }),
    query && /* @__PURE__ */ jsxs("div", { className: "equiviq-guide-result-heading", children: [
      /* @__PURE__ */ jsx("h2", { children: guides.length ? `Results for \u201C${query}\u201D` : `No results for \u201C${query}\u201D` }),
      /* @__PURE__ */ jsx("a", { href: basePath, children: "Clear search" })
    ] }),
    guides.length ? /* @__PURE__ */ jsx("ul", { className: "equiviq-guide-list", children: guides.map(
      (guide) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("a", { href: `${basePath}/${guide.slug}`, children: [
        /* @__PURE__ */ jsx("strong", { children: guide.title }),
        /* @__PURE__ */ jsxs("span", { children: [
          guide.document_number,
          " ",
          /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: "\xB7" }),
          " Updated ",
          date(guide.updated_at)
        ] })
      ] }) }, guide.id)
    ) }) : /* @__PURE__ */ jsx("p", { className: "equiviq-guide-empty", children: query ? "Try another term or browse all guides." : "No guides are available yet." })
  ] }) });
}
function visible(group, key) {
  return group?.show !== false && group?.[key] !== false;
}
function GuideArticle({ article, basePath, canonicalURL, settings }) {
  const safeColor = (value) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : void 0;
  const calloutVariables = {
    "--equiviq-callout-note": safeColor(article.callout_colors?.note),
    "--equiviq-callout-tip": safeColor(article.callout_colors?.tip),
    "--equiviq-callout-important": safeColor(article.callout_colors?.important),
    "--equiviq-callout-warning": safeColor(article.callout_colors?.warning)
  };
  const questions = faqPairs(article);
  const structured = questions.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer }
    }))
  } : {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    mainEntityOfPage: canonicalURL,
    author: article.author ? { "@type": "Person", name: article.author } : void 0
  };
  return /* @__PURE__ */ jsxs("main", { className: "equiviq-guide-shell", children: [
    /* @__PURE__ */ jsx("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(structured).replace(/</g, "\\u003c") } }),
    /* @__PURE__ */ jsxs("article", { className: "equiviq-guide-card equiviq-guide-article", style: calloutVariables, children: [
      /* @__PURE__ */ jsxs("header", { className: "equiviq-guide-heading", children: [
        /* @__PURE__ */ jsx("a", { className: "equiviq-guide-back", href: basePath, children: "\u2190 All guides" }),
        /* @__PURE__ */ jsx("p", { className: "equiviq-guide-eyebrow", children: "Guides & Resources" }),
        /* @__PURE__ */ jsx("h1", { children: article.title })
      ] }),
      settings?.classification?.show !== false && /* @__PURE__ */ jsxs("section", { className: "equiviq-guide-classification", "aria-label": "Article details", children: [
        /* @__PURE__ */ jsxs("dl", { children: [
          visible(settings?.classification, "folders") && article.folders?.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Folders" }),
            /* @__PURE__ */ jsx("dd", { children: article.folders.join(", ") })
          ] }),
          visible(settings?.classification, "category") && article.category && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Category" }),
            /* @__PURE__ */ jsx("dd", { children: article.category })
          ] }),
          visible(settings?.classification, "tags") && article.tags?.length > 0 && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Tags" }),
            /* @__PURE__ */ jsx("dd", { children: article.tags.join(", ") })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("dl", { children: [
          visible(settings?.classification, "articleId") && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Article ID" }),
            /* @__PURE__ */ jsx("dd", { children: article.document_number })
          ] }),
          visible(settings?.classification, "version") && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Version" }),
            /* @__PURE__ */ jsxs("dd", { children: [
              "v",
              article.version
            ] })
          ] }),
          visible(settings?.classification, "updated") && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Updated" }),
            /* @__PURE__ */ jsx("dd", { children: date(article.updated_at) })
          ] }),
          visible(settings?.classification, "visibility") && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { children: "Visibility" }),
            /* @__PURE__ */ jsx("dd", { children: article.visibility_label })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "equiviq-guide-content", children: article.sections.map((section, index) => /* @__PURE__ */ jsxs("section", { className: "equiviq-guide-section", children: [
        /* @__PURE__ */ jsx("h2", { children: section.title }),
        /* @__PURE__ */ jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: {
          blockquote: ({ children }) => /* @__PURE__ */ jsx(GuideBlockquote, { style: settings?.calloutStyle === "theme" ? "theme" : "equiviq", children }),
          table: ({ children }) => /* @__PURE__ */ jsxs("div", { className: "equiviq-guide-table-frame", children: [
            /* @__PURE__ */ jsx("p", { className: "equiviq-guide-table-hint", "aria-hidden": "true", children: "Swipe to see all columns \u2192" }),
            /* @__PURE__ */ jsx("div", { className: "equiviq-guide-table-scroll", role: "region", "aria-label": "Guide table; scroll horizontally to see all columns", tabIndex: 0, children: /* @__PURE__ */ jsx("table", { children }) })
          ] }),
          img: ({ src, alt }) => {
            const source = typeof src === "string" ? src : void 0;
            const match = source?.match(/\/knowledge\/article-images\/guides-resources\/([0-9a-f-]{36})/i);
            const safe = match ? `/guide-media/${article.id}/${match[1]}` : source;
            return safe ? /* @__PURE__ */ jsx("img", { src: safe, alt: alt || "", loading: "lazy" }) : null;
          }
        }, children: normalizeGuideCallouts(section.markdown) })
      ] }, `${section.title}-${index}`)) })
    ] }),
    settings?.metadata?.show !== false && /* @__PURE__ */ jsxs("section", { className: "equiviq-guide-card equiviq-guide-metadata", "aria-labelledby": "equiviq-guide-metadata-heading", children: [
      /* @__PURE__ */ jsx("h2", { id: "equiviq-guide-metadata-heading", children: "Article metadata" }),
      /* @__PURE__ */ jsxs("dl", { children: [
        visible(settings?.metadata, "author") && article.author && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Author" }),
          /* @__PURE__ */ jsx("dd", { children: article.author })
        ] }),
        visible(settings?.metadata, "created") && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Created" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            date(article.created_at),
            " \xB7 ",
            article.created_by
          ] })
        ] }),
        visible(settings?.metadata, "updated") && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Updated" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            date(article.updated_at),
            " \xB7 ",
            article.updated_by
          ] })
        ] }),
        visible(settings?.metadata, "approved") && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Approved" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            article.approved_at ? date(article.approved_at) : "Not recorded",
            " \xB7 ",
            article.approved_by
          ] })
        ] }),
        visible(settings?.metadata, "published") && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "Published" }),
          /* @__PURE__ */ jsxs("dd", { children: [
            date(article.published_at),
            " \xB7 ",
            article.published_by
          ] })
        ] }),
        visible(settings?.metadata, "permalink") && /* @__PURE__ */ jsxs("div", { className: "equiviq-guide-permalink", children: [
          /* @__PURE__ */ jsx("dt", { children: "Permalink" }),
          /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("a", { href: canonicalURL, children: canonicalURL }) })
        ] })
      ] })
    ] })
  ] });
}
export {
  GuideArticle,
  GuideIndex,
  normalizeGuideCallouts
};
