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
        const check = await upstream(req, options, "lead-email-check", { email });
        if (check.status === 200 && check.content?.allowed === false) return response(422, "Please use your work email address");
        if (check.status !== 200) return response(503, check.message || cta.errorMessage || "Please try again.");
        const body = { submission_id: crypto.randomUUID(), cta_id: cta.slug, email, source_url: page, acquisition_source: cta.acquisitionSource || "" };
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
export {
  createLeadCTACollection,
  equiviqLeadBlock,
  equiviqLeadQueue
};
