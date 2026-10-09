// src/credentials.ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
var prefix = "equiviq-guides:v1:";
function encryptionKey(secret) {
  if (!secret) throw new Error("Payload secret is required to store the Equiviq API key");
  return createHash("sha256").update("equiviq-guides-api-key\0").update(secret).digest();
}
function encryptGuideKey(value, secret) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), nonce);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${prefix}${Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}
function decryptGuideKey(value, secret) {
  if (!value.startsWith(prefix)) throw new Error("Invalid stored Equiviq API key");
  const bytes = Buffer.from(value.slice(prefix.length), "base64url");
  if (bytes.length < 29) throw new Error("Invalid stored Equiviq API key");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}

// src/plugin.ts
var equiviqGuidesBlock = {
  slug: "equiviqGuides",
  labels: { singular: "Equiviq Guides", plural: "Equiviq Guides" },
  interfaceName: "EquiviqGuidesBlock",
  fields: [
    { name: "heading", type: "text", defaultValue: "Guides & Resources", required: true },
    { name: "filters", type: "group", label: "Article filters", fields: [
      ...["folder", "category", "tag", "company"].flatMap((kind) => [
        { name: `${kind}Include`, type: "text", label: `Include ${kind}s`, admin: { components: { Field: { path: "@equiviq/payload-guides/facet-field#FacetField", clientProps: { kind, mode: "Include" } } } } },
        { name: `${kind}Exclude`, type: "text", label: `Exclude ${kind}s`, admin: { components: { Field: { path: "@equiviq/payload-guides/facet-field#FacetField", clientProps: { kind, mode: "Exclude" } } } } }
      ])
    ] },
    { name: "calloutStyle", type: "select", defaultValue: "equiviq", options: [
      { label: "Inherit from Equiviq", value: "equiviq" },
      { label: "Inherit from website theme", value: "theme" }
    ] },
    { name: "classification", type: "group", label: "Categorization block", fields: [
      { name: "show", type: "checkbox", defaultValue: true, label: "Show categorization block" },
      ...["folders", "category", "tags", "articleId", "version", "updated", "visibility"].map((name) => ({ name, type: "checkbox", defaultValue: true, label: `Show ${name}` }))
    ] },
    { name: "metadata", type: "group", label: "Metadata block", fields: [
      { name: "show", type: "checkbox", defaultValue: true, label: "Show metadata block" },
      ...["author", "updated", "published", "created", "approved", "permalink"].map((name) => ({ name, type: "checkbox", defaultValue: true, label: `Show ${name}` }))
    ] }
  ]
};
var equiviqGuidesSettings = {
  slug: "equiviq-guides-settings",
  label: "Equiviq Guides",
  admin: { description: "Connect to Equiviq, then place an Equiviq Guides block on a published page. The API key is encrypted and is never displayed again after saving." },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  endpoints: [{ path: "/test-connection", method: "post", handler: async (req) => {
    if (!req.user) return Response.json({ message: "Sign in to test the connection." }, { status: 401 });
    const settings = await req.payload.findGlobal({ slug: "equiviq-guides-settings", depth: 0, context: { equiviqGuidesInternal: true } });
    if (!settings.apiUrl || !settings.apiKey) return Response.json({ message: "Save an API URL and key before testing." }, { status: 400 });
    try {
      const response = await fetch(settings.apiUrl, { headers: { Authorization: `Bearer ${settings.apiKey}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(7e3) });
      if (!response.ok) return Response.json({ message: response.status === 401 || response.status === 403 ? "Equiviq rejected this API key." : `Equiviq returned HTTP ${response.status}.` }, { status: 502 });
      const body = await response.json();
      if (!Array.isArray(body.guides)) return Response.json({ message: "Equiviq returned an unexpected response." }, { status: 502 });
      return Response.json({ message: "Connected to Equiviq. Guides are available to your content blocks." });
    } catch {
      return Response.json({ message: "Could not reach Equiviq. Check the API URL and try again." }, { status: 502 });
    }
  } }],
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    const previous = typeof originalDoc?.primaryPage === "object" ? originalDoc.primaryPage?.id : originalDoc?.primaryPage;
    const selected = typeof data.primaryPage === "object" ? data.primaryPage?.id : data.primaryPage;
    if (selected) {
      const page = await req.payload.findByID({ collection: "pages", id: selected, depth: 0, req });
      if (!page?.layout?.some((block) => block.blockType === "equiviqGuides")) {
        throw new Error("The primary page must contain an Equiviq Guides block");
      }
    }
    if (previous && previous !== selected) {
      const oldPage = await req.payload.findByID({ collection: "pages", id: previous, depth: 0, req }).catch(() => null);
      if (oldPage?.slug && oldPage.slug !== "home") {
        const history = Array.isArray(originalDoc?.legacyPaths) ? originalDoc.legacyPaths : [];
        data.legacyPaths = [...history.filter((item) => item.path !== `/${oldPage.slug}`), { path: `/${oldPage.slug}` }];
      }
    }
    return data;
  }] },
  fields: [
    {
      name: "apiUrl",
      label: "Equiviq API URL",
      type: "text",
      admin: { description: "Paste the HTTPS Guides API URL from the Equiviq Payload plugin settings." },
      validate: (value) => {
        if (!value) return true;
        try {
          const url = new URL(String(value));
          return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && /\/api\/public\/plugins\/equiviq-payload\/[^/]+\/guides\/?$/.test(url.pathname) ? true : "Enter the HTTPS Guides API URL shown in Equiviq.";
        } catch {
          return "Enter a valid HTTPS Guides API URL.";
        }
      }
    },
    {
      name: "apiKey",
      label: "Equiviq API key",
      type: "text",
      admin: { description: "Paste a new API key to set or rotate it. Leave blank to keep the existing key. It will never be displayed again." },
      hooks: {
        beforeChange: [({ value, previousValue, req }) => value ? encryptGuideKey(String(value), req.payload.secret) : previousValue],
        afterRead: [({ value, req }) => req.context?.equiviqGuidesInternal === true && value ? decryptGuideKey(String(value), req.payload.secret) : null]
      }
    },
    { name: "connectionTest", type: "ui", admin: { components: { Field: "@equiviq/payload-guides/connection-test#ConnectionTest" } } },
    {
      name: "primaryPage",
      label: "Primary guide page",
      type: "relationship",
      relationTo: "pages",
      admin: { description: "This page must contain an Equiviq Guides block. Other pages may also contain the block; search engines will use this page as the canonical article location." }
    },
    { name: "legacyPaths", type: "array", admin: { hidden: true }, fields: [{ name: "path", type: "text", required: true }] }
  ]
};
function equiviqGuidesPlugin(options) {
  for (const name of [options.apiUrlEnv, options.apiKeyEnv]) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error("Equiviq guide environment variable names are invalid");
  }
  return (config) => {
    const pageSlug = options.pagesCollection || "pages";
    let found = false;
    const collections = (config.collections || []).map((collection) => {
      if (collection.slug !== pageSlug) return collection;
      found = true;
      const layout = collection.fields.find((field) => "name" in field && field.name === "layout");
      if (!layout || layout.type !== "blocks") throw new Error(`${pageSlug}.layout must be a blocks field`);
      return { ...collection, fields: collection.fields.map((field) => field === layout ? { ...layout, blocks: [...layout.blocks, equiviqGuidesBlock] } : field) };
    });
    if (!found) throw new Error(`Equiviq Guides page collection ${pageSlug} was not found`);
    return {
      ...config,
      collections,
      globals: [...config.globals || [], equiviqGuidesSettings],
      custom: { ...config.custom, equiviqGuides: { apiUrlEnv: options.apiUrlEnv, apiKeyEnv: options.apiKeyEnv } }
    };
  };
}
export {
  equiviqGuidesBlock,
  equiviqGuidesPlugin,
  equiviqGuidesSettings
};
