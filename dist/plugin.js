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

// src/leads.ts
import { parsePhoneNumberFromString, isSupportedCountry } from "libphonenumber-js/max";
var fieldNames = ["given_name", "surname", "email", "organization", "phone"];
var fieldLabel = { given_name: "Given name", surname: "Surname", email: "Email", organization: "Organization", phone: "Phone" };
var idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
var e164Pattern = /^\+[1-9][0-9]{1,14}$/;
function response(status, message, extra = {}) {
  return Response.json({ message, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}
function cleanURL(raw) {
  try {
    const url = new URL(String(raw || ""));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.href.length <= 500 ? url.href : null;
  } catch {
    return null;
  }
}
function required(cta, field) {
  return field === "email" || field === "organization" || Boolean(cta.fields?.[field]?.required);
}
function visible(cta, field) {
  return field === "email" || Boolean(cta.fields?.[field]?.visible);
}
function readText(input, name, limit) {
  return typeof input[name] === "string" ? input[name].trim().slice(0, limit + 1) : "";
}
function normalizePhone(input) {
  const raw = readText(input, "phone_e164", 40) || readText(input, "phone", 40);
  if (!raw) return "";
  const country = readText(input, "phone_country", 2).toUpperCase();
  if (!raw.startsWith("+") && !isSupportedCountry(country)) return null;
  const parsed = parsePhoneNumberFromString(raw, isSupportedCountry(country) ? country : void 0);
  return parsed?.isValid() && e164Pattern.test(parsed.number) ? parsed.number : null;
}
async function connection(req, options) {
  const global = await req.payload.findGlobal({ slug: "equiviq-guides-settings", depth: 0, overrideAccess: true, context: { equiviqGuidesInternal: true } });
  const saved = Boolean(global.apiUrl && global.apiKey);
  const apiUrl = saved ? global.apiUrl : process.env[options.apiUrlEnv];
  const apiKey = saved ? global.apiKey : process.env[options.apiKeyEnv];
  if (!apiUrl || !apiKey) return null;
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== "https:" || !/\/api\/public\/plugins\/equiviq-payload\/[^/]+\/guides\/?$/.test(url.pathname)) return null;
    url.pathname = url.pathname.replace(/guides\/?$/, "");
    return { base: url.href, key: apiKey };
  } catch {
    return null;
  }
}
async function upstream(req, options, suffix, body, timeout = 12e3) {
  const configured = await connection(req, options);
  if (!configured) return { status: 503, message: "The Equiviq connection is not configured." };
  try {
    const sent = await fetch(configured.base + suffix, {
      method: "POST",
      headers: { Authorization: `Bearer ${configured.key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeout)
    });
    const content = await sent.json().catch(() => ({}));
    return { status: sent.status, message: content.message || "", content };
  } catch {
    return { status: 503, message: "Equiviq is temporarily unavailable." };
  }
}
async function retryOneDueLead(req, options) {
  const due = await req.payload.find({
    collection: "equiviq-lead-queue",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { and: [{ needsReview: { equals: false } }, { nextAttemptAt: { less_than_equal: (/* @__PURE__ */ new Date()).toISOString() } }] },
    sort: "createdAt"
  });
  const item = due.docs[0];
  if (!item) return;
  const attempts = (item.attempts || 0) + 1;
  const nextAttemptAt = new Date(Date.now() + Math.min(24 * 3600, 120 * 2 ** Math.min(attempts, 9)) * 1e3).toISOString();
  await req.payload.update({ collection: "equiviq-lead-queue", id: item.id, data: { attempts, nextAttemptAt }, overrideAccess: true });
  const sent = await upstream(req, options, "leads", item.body, 3e3);
  if (sent.status === 200) await req.payload.delete({ collection: "equiviq-lead-queue", id: item.id, overrideAccess: true });
  else await req.payload.update({
    collection: "equiviq-lead-queue",
    id: item.id,
    data: { lastError: sent.message, needsReview: sent.status !== 503 && sent.status !== 429 },
    overrideAccess: true
  });
}
var equiviqLeadBlock = {
  slug: "equiviqLead",
  labels: { singular: "Equiviq Lead Form", plural: "Equiviq Lead Forms" },
  fields: [{ name: "cta", type: "relationship", relationTo: "equiviq-lead-ctas", required: true, label: "Call to action" }]
};
var equiviqLeadQueue = {
  slug: "equiviq-lead-queue",
  labels: { singular: "Undelivered lead", plural: "Undelivered leads" },
  admin: { group: "Equiviq", useAsTitle: "submissionId", description: "Submissions awaiting retry or administrator review." },
  access: { read: ({ req }) => Boolean(req.user), create: () => false, update: () => false, delete: ({ req }) => Boolean(req.user) },
  fields: [
    { name: "submissionId", type: "text", required: true, unique: true },
    { name: "body", type: "json", required: true },
    { name: "attempts", type: "number", required: true, defaultValue: 0 },
    { name: "lastError", type: "text" },
    { name: "needsReview", type: "checkbox", defaultValue: false },
    { name: "nextAttemptAt", type: "date", required: true, index: true }
  ]
};
function createLeadCTACollection(options) {
  return {
    slug: "equiviq-lead-ctas",
    labels: { singular: "Call to Action", plural: "Calls to Action" },
    admin: { group: "Equiviq", useAsTitle: "heading", description: "Configure a form, then select it in an Equiviq Lead Form block." },
    access: { read: ({ req }) => Boolean(req.user), create: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user), delete: ({ req }) => Boolean(req.user) },
    hooks: { afterRead: [async ({ doc, req }) => {
      if (req.context?.equiviqLeadRetrying) return doc;
      if (req.context) req.context.equiviqLeadRetrying = true;
      try {
        await retryOneDueLead(req, options);
      } catch {
      }
      return doc;
    }] },
    endpoints: [
      { path: "/submit", method: "post", handler: async (req) => {
        const input = await req.json?.().catch(() => null);
        if (!input || JSON.stringify(input).length > 8192) return response(400, "Invalid form submission.");
        const slug = readText(input, "cta_id", 128);
        if (!idPattern.test(slug)) return response(400, "This form is unavailable.");
        const matches = await req.payload.find({ collection: "equiviq-lead-ctas", where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
        const cta = matches.docs[0];
        if (!cta) return response(404, "This form is unavailable.");
        const leadSettings = await req.payload.findGlobal({ slug: "equiviq-lead-settings", depth: 0, overrideAccess: true });
        const blockFreeEmailDomains = leadSettings.blockFreeEmailDomains !== false;
        const elapsed = Date.now() - Number(input.started || 0);
        if (readText(input, "website", 100) || !Number.isFinite(elapsed) || elapsed < 2e3 || elapsed > 24 * 3600 * 1e3) return response(422, cta.errorMessage || "Please try again.");
        const page = cleanURL(input.source_url);
        const requestURL = cleanURL(req.url);
        const browserOrigin = req.headers.get("origin") || (requestURL ? new URL(requestURL).origin : "");
        if (!page || !browserOrigin || new URL(page).origin !== browserOrigin) return response(422, cta.errorMessage || "Please try again.");
        const email = readText(input, "email", 254).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response(422, "Enter a valid work email address.");
        for (const field of fieldNames) {
          if (visible(cta, field) && required(cta, field) && !readText(input, field, field === "organization" ? 240 : 120)) return response(422, `${fieldLabel[field]} is required.`);
        }
        const check = await upstream(req, options, "lead-email-check", { email, block_free_email_domains: blockFreeEmailDomains });
        if (check.status === 200 && check.content?.allowed === false) return response(422, "Please use your work email address");
        if (check.status !== 200) return response(503, check.message || cta.errorMessage || "Please try again.");
        const body = { submission_id: crypto.randomUUID(), cta_id: cta.slug, email, source_url: page, acquisition_source: cta.acquisitionSource || "", block_free_email_domains: blockFreeEmailDomains };
        for (const field of ["given_name", "surname"]) {
          if (visible(cta, field)) body[field] = readText(input, field, 120);
        }
        if (visible(cta, "organization")) body.organization = { name: readText(input, "organization", 240) };
        if (visible(cta, "phone")) {
          const phone = normalizePhone(input);
          if (phone === null) return response(422, "Enter a valid international phone number.");
          if (phone) body.phone_e164 = phone;
        }
        const sent = await upstream(req, options, "leads", body);
        if (sent.status === 200) return response(200, cta.successMessage || "Thank you. Your information was received.");
        if (sent.status === 503 || sent.status === 429) {
          await req.payload.create({ collection: "equiviq-lead-queue", data: {
            submissionId: body.submission_id,
            body,
            attempts: 0,
            lastError: sent.message,
            nextAttemptAt: new Date(Date.now() + 12e4).toISOString()
          }, overrideAccess: true });
          return response(202, cta.queuedMessage || "Your information is queued for delivery.", { queued: true });
        }
        return response(422, sent.message || cta.errorMessage || "Please check your information and try again.");
      } },
      { path: "/retry", method: "post", handler: async (req) => {
        if (!req.user) return response(401, "Sign in to retry submissions.");
        const queue = await req.payload.find({ collection: "equiviq-lead-queue", limit: 100, depth: 0, overrideAccess: true });
        let delivered = 0;
        for (const item of queue.docs) {
          const payload = item;
          const sent = await upstream(req, options, "leads", payload.body);
          if (sent.status === 200) {
            await req.payload.delete({ collection: "equiviq-lead-queue", id: payload.id, overrideAccess: true });
            delivered++;
          } else {
            await req.payload.update({ collection: "equiviq-lead-queue", id: payload.id, data: {
              attempts: (payload.attempts || 0) + 1,
              lastError: sent.message,
              needsReview: sent.status !== 503 && sent.status !== 429,
              nextAttemptAt: new Date(Date.now() + 3e5).toISOString()
            }, overrideAccess: true });
          }
        }
        return Response.json({ delivered, remaining: queue.docs.length - delivered });
      } }
    ],
    fields: [
      { name: "slug", type: "text", required: true, unique: true, admin: { description: "Stable ID used in submissions." }, validate: (value) => typeof value === "string" && idPattern.test(value) ? true : "Use letters, numbers, underscores, and hyphens." },
      { name: "heading", type: "text", required: true },
      { name: "ctaText", type: "textarea", label: "CTA text", admin: { description: "Optional text shown below the heading and above the form fields." } },
      { name: "acquisitionSource", type: "text", label: "Acquisition Source/Campaign", maxLength: 200 },
      { name: "privacyUrl", type: "text", label: "Privacy policy URL override", validate: (value) => !value || typeof value === "string" && /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(value) ? true : "Enter an HTTPS privacy policy URL." },
      { name: "successMessage", type: "text" },
      { name: "errorMessage", type: "text" },
      { name: "queuedMessage", type: "text" },
      { name: "fields", type: "group", fields: fieldNames.map((name) => ({
        name,
        type: "group",
        label: fieldLabel[name],
        fields: [
          { name: "label", type: "text", label: "Form label override", maxLength: 100, admin: { placeholder: fieldLabel[name] } },
          ...name === "email" ? [] : [{ name: "visible", type: "checkbox", defaultValue: false }],
          ...name === "organization" || name === "email" ? [] : [{ name: "required", type: "checkbox", defaultValue: false }],
          ...name === "phone" ? [{ name: "countryLabel", type: "text", label: "Country code label override", maxLength: 100, admin: { placeholder: "Country code" } }] : []
        ]
      })) },
      { name: "plannedActions", type: "select", hasMany: true, admin: { hidden: true, description: "Newsletter, ticket, and task actions are reserved for a later release." }, options: [
        { label: "Newsletter", value: "newsletter" },
        { label: "Ticket", value: "ticket" },
        { label: "Task", value: "task" }
      ] }
    ]
  };
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
  label: "Settings",
  admin: { group: "Equiviq", description: "Connect Knowledge and Lead Generation to Equiviq. The API key is encrypted and is never displayed again after saving. If these fields are empty, an existing server-secret connection remains active." },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  endpoints: [{ path: "/test-connection", method: "post", handler: async (req) => {
    if (!req.user) return Response.json({ message: "Sign in to test the connection." }, { status: 401 });
    const settings = await req.payload.findGlobal({ slug: "equiviq-guides-settings", depth: 0, context: { equiviqGuidesInternal: true } });
    const names = req.payload.config.custom?.equiviqGuides;
    const saved = Boolean(settings.apiUrl && settings.apiKey);
    const apiUrl = saved ? settings.apiUrl : names?.apiUrlEnv ? process.env[names.apiUrlEnv] : void 0;
    const apiKey = saved ? settings.apiKey : names?.apiKeyEnv ? process.env[names.apiKeyEnv] : void 0;
    if (!apiUrl || !apiKey) return Response.json({ message: "Save an API URL and key before testing." }, { status: 400 });
    try {
      const response2 = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(7e3) });
      if (!response2.ok) return Response.json({ message: response2.status === 401 || response2.status === 403 ? "Equiviq rejected this API key." : `Equiviq returned HTTP ${response2.status}.` }, { status: 502 });
      const body = await response2.json();
      if (!Array.isArray(body.guides)) return Response.json({ message: "Equiviq returned an unexpected response." }, { status: 502 });
      return Response.json({ message: `Connected to Equiviq using ${saved ? "saved settings" : "server secrets"}. Guides are available to your content blocks.` });
    } catch {
      return Response.json({ message: "Could not reach Equiviq. Check the API URL and try again." }, { status: 502 });
    }
  } }],
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
    // Retain existing values for sites upgrading from the combined settings screen.
    { name: "privacyPolicyUrl", type: "text", admin: { hidden: true } },
    { name: "primaryPage", type: "relationship", relationTo: "pages", admin: { hidden: true } },
    { name: "legacyPaths", type: "array", admin: { hidden: true }, fields: [{ name: "path", type: "text", required: true }] }
  ]
};
var equiviqKnowledgeSettings = {
  slug: "equiviq-knowledge-settings",
  label: "Knowledge",
  admin: { group: "Equiviq", description: "Choose the canonical page for published guides." },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
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
    return { ...data, configured: true };
  }] },
  fields: [
    { name: "configured", type: "checkbox", admin: { hidden: true }, defaultValue: false },
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
var equiviqLeadSettings = {
  slug: "equiviq-lead-settings",
  label: "Lead Generation",
  admin: { group: "Equiviq", description: "Set the default privacy policy for lead forms. Configure individual CTAs in Lead Generation CTAs." },
  access: { read: ({ req }) => Boolean(req.user), update: ({ req }) => Boolean(req.user) },
  hooks: { beforeChange: [({ data }) => ({ ...data, configured: true })] },
  fields: [
    { name: "configured", type: "checkbox", admin: { hidden: true }, defaultValue: false },
    {
      name: "blockFreeEmailDomains",
      label: "Block free email domains",
      type: "checkbox",
      defaultValue: true,
      admin: { description: "When disabled, a free-domain submission creates or updates a person without creating or assigning an organization." }
    },
    {
      name: "privacyPolicyUrl",
      label: "Site privacy policy URL",
      type: "text",
      admin: { description: "Used by lead forms unless a CTA overrides it. Forms require a privacy policy link." },
      validate: (value) => !value || typeof value === "string" && /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(value) ? true : "Enter an HTTPS privacy policy URL."
    }
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
      return { ...collection, fields: collection.fields.map((field) => field === layout ? { ...layout, blocks: [...layout.blocks, equiviqGuidesBlock, equiviqLeadBlock] } : field) };
    });
    if (!found) throw new Error(`Equiviq Guides page collection ${pageSlug} was not found`);
    return {
      ...config,
      collections: [...collections, createLeadCTACollection(options), equiviqLeadQueue],
      globals: [...config.globals || [], equiviqGuidesSettings, equiviqKnowledgeSettings, equiviqLeadSettings],
      custom: { ...config.custom, equiviqGuides: { apiUrlEnv: options.apiUrlEnv, apiKeyEnv: options.apiKeyEnv } }
    };
  };
}
export {
  equiviqGuidesBlock,
  equiviqGuidesPlugin,
  equiviqGuidesSettings,
  equiviqKnowledgeSettings,
  equiviqLeadSettings
};
