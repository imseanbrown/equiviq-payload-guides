'use client';
"use client";

// src/facet-field.tsx
import { useEffect, useId, useState } from "react";
import { useField } from "@payloadcms/ui";
import { jsx, jsxs } from "react/jsx-runtime";
var names = { folder: "folders", category: "categories", tag: "tags", company: "companies" };
var facetsPromise = null;
function loadFacets() {
  if (!facetsPromise) facetsPromise = fetch("/api/guide-facets", { credentials: "same-origin" }).then((response) => response.ok ? response.json() : null).catch(() => null);
  return facetsPromise;
}
function FacetField({ path, kind, mode }) {
  const { value, setValue } = useField({ path });
  const [facets, setFacets] = useState(null);
  const [search, setSearch] = useState("");
  const id = useId();
  useEffect(() => {
    let mounted = true;
    void loadFacets().then((data) => {
      if (mounted) setFacets(data);
    });
    return () => {
      mounted = false;
    };
  }, []);
  let selected = [];
  try {
    const parsed = JSON.parse(value || "[]");
    if (Array.isArray(parsed)) selected = parsed.filter((item) => typeof item === "string");
  } catch {
    selected = (value || "").split(",").map((item) => item.trim()).filter(Boolean);
  }
  const options = facets?.[names[kind]] || [];
  if (kind === "company" && facets && options.length <= 1 && selected.length === 0) return null;
  function toggle(item) {
    setValue(JSON.stringify(selected.includes(item) ? selected.filter((name) => name !== item) : [...selected, item]));
  }
  return /* @__PURE__ */ jsxs("div", { className: "equiviq-facet-field", style: { marginBlock: "1rem" }, children: [
    /* @__PURE__ */ jsxs("label", { htmlFor: id, className: "field-label", style: { display: "block", marginBottom: ".35rem" }, children: [
      mode,
      " ",
      names[kind]
    ] }),
    /* @__PURE__ */ jsx("p", { className: "field-description", children: mode === "Include" ? "Leave empty to show all." : "Excluded items take priority." }),
    selected.length > 0 && /* @__PURE__ */ jsx("div", { "aria-label": `Selected ${names[kind]}`, style: { display: "flex", flexWrap: "wrap", gap: ".4rem", marginBlock: ".6rem" }, children: selected.map((item) => /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => toggle(item), "aria-label": `Remove ${item}`, style: { border: "1px solid currentColor", borderRadius: 999, padding: ".25rem .65rem", background: "transparent", color: "inherit", cursor: "pointer" }, children: [
      item,
      " \xD7"
    ] }, item)) }),
    /* @__PURE__ */ jsx("input", { id, type: "search", value: search, onChange: (event) => setSearch(event.target.value), placeholder: `Find ${names[kind]}`, style: { width: "100%", padding: ".65rem" } }),
    /* @__PURE__ */ jsx("div", { role: "group", "aria-label": `${mode} ${names[kind]}`, style: { maxHeight: 180, overflowY: "auto", marginTop: ".5rem" }, children: facets ? options.filter((item) => item.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((item) => /* @__PURE__ */ jsxs("label", { style: { display: "flex", gap: ".65rem", alignItems: "center", padding: ".35rem .25rem", cursor: "pointer" }, children: [
      /* @__PURE__ */ jsx("input", { type: "checkbox", checked: selected.includes(item), onChange: () => toggle(item), style: { width: 16, height: 16, flex: "0 0 16px", margin: 0, accentColor: "var(--theme-elevation-900)" } }),
      /* @__PURE__ */ jsx("span", { children: item })
    ] }, item)) : /* @__PURE__ */ jsx("p", { children: "Choices are temporarily unavailable. Saved selections remain in place." }) })
  ] });
}
export {
  FacetField
};
