// src/filters.ts
function values(value) {
  let entries;
  try {
    const parsed = JSON.parse(value || "[]");
    entries = Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    entries = (value || "").split(",");
  }
  return new Set(entries.map((part) => part.trim().toLocaleLowerCase()).filter(Boolean));
}
function allowed(items, include, exclude) {
  const normalized = items.map((item) => item.toLocaleLowerCase());
  const included = values(include);
  const excluded = values(exclude);
  return !normalized.some((item) => excluded.has(item)) && (included.size === 0 || normalized.some((item) => included.has(item)));
}
function guideMatchesFilters(guide, filters) {
  if (!filters) return true;
  return allowed(guide.folders || [], filters.folderInclude, filters.folderExclude) && allowed(guide.category ? [guide.category] : [], filters.categoryInclude, filters.categoryExclude) && allowed(guide.tags || [], filters.tagInclude, filters.tagExclude) && allowed(guide.company ? [guide.company] : [], filters.companyInclude, filters.companyExclude);
}
function guideMatchesAnyBlock(guide, blocks) {
  return blocks.some((block) => guideMatchesFilters(guide, block.filters));
}
export {
  guideMatchesAnyBlock,
  guideMatchesFilters
};
