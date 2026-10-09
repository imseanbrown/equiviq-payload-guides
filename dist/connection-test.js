'use client';
"use client";

// src/connection-test.tsx
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
function ConnectionTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/globals/equiviq-guides-settings/test-connection", { method: "POST", credentials: "same-origin" });
      const body = await response.json();
      setResult({ ok: response.ok, message: body.message || "The connection test did not complete." });
    } catch {
      setResult({ ok: false, message: "The connection test could not be completed." });
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { style: { marginBlock: "1.5rem", padding: "1.25rem", border: "1px solid var(--theme-elevation-150)", borderRadius: 12 }, children: [
    /* @__PURE__ */ jsx("strong", { children: "Connection status" }),
    /* @__PURE__ */ jsx("p", { style: { marginBlock: ".5rem 1rem" }, children: "Test the saved connection, or the existing server-secret connection if these fields are empty." }),
    /* @__PURE__ */ jsx("button", { type: "button", className: "btn btn--style-primary", disabled: busy, onClick: test, children: busy ? "Checking connection\u2026" : "Test connection" }),
    result && /* @__PURE__ */ jsx("p", { role: "status", style: { marginTop: "1rem", color: result.ok ? "var(--theme-success-700)" : "var(--theme-error-700)" }, children: result.message })
  ] });
}
export {
  ConnectionTest
};
