'use client';
"use client";

// src/lead-form.tsx
import { useEffect, useState } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js/max";
import { jsx, jsxs } from "react/jsx-runtime";
var labels = { given_name: "Given name", surname: "Surname", email: "Email", organization: "Organization", phone: "Phone" };
var countryNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
var countries = getCountries().map((code) => ({ code, label: `${code} +${getCountryCallingCode(code)}`, name: countryNames?.of(code) || code })).sort((left, right) => left.name.localeCompare(right.name));
function EquiviqLeadForm({ cta, privacyPolicyUrl }) {
  const [started, setStarted] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const privacy = cta.privacyUrl || privacyPolicyUrl;
  useEffect(() => {
    setStarted(Date.now());
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (sending || !started) return;
    setSending(true);
    setMessage("");
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form).entries());
    if (typeof fields.phone === "string" && fields.phone.trim()) {
      const parsed = parsePhoneNumberFromString(fields.phone, String(fields.phone_country || "US"));
      if (!parsed?.isValid()) {
        setMessage("Enter a valid international phone number.");
        setSending(false);
        return;
      }
      fields.phone_e164 = parsed.number;
    }
    try {
      const reply = await fetch("/api/equiviq-lead-ctas/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, cta_id: cta.slug, started, source_url: window.location.href.split("#")[0] })
      });
      const result = await reply.json();
      setMessage(result.message || (reply.ok ? "Thank you." : cta.errorMessage || "Please try again."));
      if (reply.ok) {
        setSent(true);
        form.reset();
      }
    } catch {
      setMessage(cta.errorMessage || "The form could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }
  if (!privacy) return /* @__PURE__ */ jsx("p", { children: "Lead form unavailable: configure a privacy policy URL." });
  if (sent) return /* @__PURE__ */ jsxs("section", { className: "equiviq-lead-form", role: "status", children: [
    /* @__PURE__ */ jsx("h2", { children: cta.heading }),
    /* @__PURE__ */ jsx("p", { children: message })
  ] });
  const field = (name) => {
    if (name !== "email" && !cta.fields?.[name]?.visible) return null;
    const label = cta.fields?.[name]?.label?.trim() || labels[name];
    const required = name === "email" || name === "organization" || Boolean(cta.fields?.[name]?.required);
    return /* @__PURE__ */ jsxs("div", { className: `equiviq-lead-field equiviq-lead-field-${name}`, children: [
      name === "phone" && /* @__PURE__ */ jsx("select", { name: "phone_country", defaultValue: "US", "aria-label": cta.fields?.phone?.countryLabel?.trim() || "Country code", title: cta.fields?.phone?.countryLabel?.trim() || "Country code", children: countries.map(({ code, label: label2, name: name2 }) => /* @__PURE__ */ jsx("option", { value: code, title: name2, children: label2 }, code)) }),
      /* @__PURE__ */ jsx("input", { id: `${cta.slug}-${name}`, name, type: name === "email" ? "email" : name === "phone" ? "tel" : "text", placeholder: label, "aria-label": label, autoComplete: { given_name: "given-name", surname: "family-name", email: "email", organization: "organization", phone: "tel" }[name], required, maxLength: name === "organization" ? 240 : name === "email" ? 254 : 120 })
    ] }, name);
  };
  return /* @__PURE__ */ jsxs("form", { className: "equiviq-lead-form", onSubmit: submit, children: [
    /* @__PURE__ */ jsx("h2", { children: cta.heading }),
    /* @__PURE__ */ jsx("div", { "aria-hidden": "true", className: "equiviq-lead-honeypot", children: /* @__PURE__ */ jsxs("label", { children: [
      "Leave blank",
      /* @__PURE__ */ jsx("input", { name: "website", autoComplete: "off", tabIndex: -1 })
    ] }) }),
    (cta.fields?.given_name?.visible || cta.fields?.surname?.visible) && /* @__PURE__ */ jsxs("div", { className: "equiviq-lead-name-row", children: [
      field("given_name"),
      field("surname")
    ] }),
    field("email"),
    field("organization"),
    field("phone"),
    privacy && /* @__PURE__ */ jsxs("p", { children: [
      "By submitting, you opt in to contact. ",
      /* @__PURE__ */ jsx("a", { href: privacy, target: "_blank", rel: "noopener noreferrer", children: "Privacy policy and opt-out" })
    ] }),
    /* @__PURE__ */ jsx("button", { type: "submit", disabled: sending, children: sending ? "Sending\u2026" : "Submit" }),
    /* @__PURE__ */ jsx("p", { "aria-live": "polite", role: "status", children: message })
  ] });
}
export {
  EquiviqLeadForm
};
