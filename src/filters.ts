import type { PublicGuideSummary } from './server'

export type GuideFilters = Partial<Record<'folderInclude' | 'folderExclude' | 'categoryInclude' | 'categoryExclude' | 'tagInclude' | 'tagExclude' | 'companyInclude' | 'companyExclude', string | null>>

function values(value: string | null | undefined): Set<string> {
  let entries: string[]
  try { const parsed: unknown = JSON.parse(value || '[]'); entries = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] }
  catch { entries = (value || '').split(',') }
  return new Set(entries.map((part) => part.trim().toLocaleLowerCase()).filter(Boolean))
}

function allowed(items: string[], include: string | null | undefined, exclude: string | null | undefined): boolean {
  const normalized = items.map((item) => item.toLocaleLowerCase())
  const included = values(include)
  const excluded = values(exclude)
  return !normalized.some((item) => excluded.has(item)) && (included.size === 0 || normalized.some((item) => included.has(item)))
}

export function guideMatchesFilters(guide: PublicGuideSummary, filters?: GuideFilters | null): boolean {
  if (!filters) return true
  return allowed(guide.folders || [], filters.folderInclude, filters.folderExclude)
    && allowed(guide.category ? [guide.category] : [], filters.categoryInclude, filters.categoryExclude)
    && allowed(guide.tags || [], filters.tagInclude, filters.tagExclude)
    && allowed(guide.company ? [guide.company] : [], filters.companyInclude, filters.companyExclude)
}

export function guideMatchesAnyBlock(guide: PublicGuideSummary, blocks: { filters?: GuideFilters | null }[]): boolean {
  return blocks.some((block) => guideMatchesFilters(guide, block.filters))
}
