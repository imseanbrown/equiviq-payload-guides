// src/server.ts
var guideSlug = /^[a-z0-9-]{38,200}$/;
var uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
function createGuideClient(options, resolveCredentials) {
  async function configuration() {
    const stored = await resolveCredentials?.().catch(() => null);
    const hasStoredConnection = Boolean(stored?.apiUrl && stored?.apiKey);
    const rawURL = hasStoredConnection ? stored.apiUrl : process.env[options.apiUrlEnv];
    const key = hasStoredConnection ? stored.apiKey : process.env[options.apiKeyEnv];
    if (!rawURL || !key) return null;
    try {
      const url = new URL(rawURL);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) return null;
      if (!/\/api\/public\/plugins\/equiviq-payload\/[^/]+\/guides\/?$/.test(url.pathname)) return null;
      return { url, key };
    } catch {
      return null;
    }
  }
  async function request(path = "", search = "") {
    const configured = await configuration();
    if (!configured) return null;
    const { url, key } = configured;
    url.pathname = `${url.pathname.replace(/\/$/, "")}${path ? `/${path}` : ""}`;
    if (search) url.searchParams.set("q", search);
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(7e3)
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }
  async function listGuides(search = "") {
    const query = search.trim().slice(0, 120);
    const result = await request("", query);
    const items = result && Array.isArray(result.guides) ? result.guides.map((guide) => ({
      ...guide,
      slug: guide.slug || guide.permalink?.split("/").pop() || ""
    })).filter((guide) => guideSlug.test(guide.slug) && guide.public_access === true && typeof guide.visibility_label === "string" && guide.visibility_label.trim() !== "") : null;
    return items && query && !result?.search_applied ? items.filter((guide) => guide.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : items;
  }
  async function getGuide(slug) {
    if (!guideSlug.test(slug)) return null;
    const article = await request(encodeURIComponent(slug));
    return article?.public_access === true && typeof article.visibility_label === "string" && article.visibility_label.trim() !== "" && Array.isArray(article.sections) ? { ...article, slug: article.slug || article.permalink?.split("/").pop() || "" } : null;
  }
  async function getImage(article, image) {
    if (!uuid.test(article) || !uuid.test(image)) return null;
    const configured = await configuration();
    if (!configured) return null;
    const { url, key } = configured;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${article}/images/${image}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(7e3)
      });
      const mime = response.headers.get("content-type");
      return response.ok && mime && ["image/png", "image/jpeg", "image/gif"].includes(mime) ? response : null;
    } catch {
      return null;
    }
  }
  async function recordView(slug, eventID, referrer) {
    if (!guideSlug.test(slug) || !uuid.test(eventID)) return false;
    const configured = await configuration();
    if (!configured) return false;
    const { url, key } = configured;
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${encodeURIComponent(slug)}/views`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventID, referrer }),
        cache: "no-store",
        signal: AbortSignal.timeout(7e3)
      });
      return response.status === 204;
    } catch {
      return false;
    }
  }
  async function getFacets() {
    const configured = await configuration();
    if (!configured) return null;
    const { url, key } = configured;
    url.pathname = url.pathname.replace(/\/guides\/?$/, "/guide-facets");
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(7e3) });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }
  return { listGuides, getGuide, getImage, recordView, getFacets };
}
export {
  createGuideClient
};
