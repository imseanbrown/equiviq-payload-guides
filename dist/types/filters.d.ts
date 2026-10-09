import type { PublicGuideSummary } from './server';
export type GuideFilters = Partial<Record<'folderInclude' | 'folderExclude' | 'categoryInclude' | 'categoryExclude' | 'tagInclude' | 'tagExclude' | 'companyInclude' | 'companyExclude', string | null>>;
export declare function guideMatchesFilters(guide: PublicGuideSummary, filters?: GuideFilters | null): boolean;
export declare function guideMatchesAnyBlock(guide: PublicGuideSummary, blocks: {
    filters?: GuideFilters | null;
}[]): boolean;
