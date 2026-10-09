import type { PublicGuide, PublicGuideSummary } from './server';
export declare function normalizeGuideCallouts(markdown: string): string;
export declare function GuideIndex({ guides, query, basePath, heading }: {
    guides: PublicGuideSummary[];
    query: string;
    basePath: string;
    heading?: string;
}): import("react/jsx-runtime").JSX.Element;
type VisibilitySettings = {
    show?: boolean | null;
    [key: string]: boolean | null | undefined;
};
type ArticleSettings = {
    calloutStyle?: 'equiviq' | 'theme' | null;
    classification?: VisibilitySettings | null;
    metadata?: VisibilitySettings | null;
};
export declare function GuideArticle({ article, basePath, canonicalURL, settings }: {
    article: PublicGuide;
    basePath: string;
    canonicalURL: string;
    settings?: ArticleSettings;
}): import("react/jsx-runtime").JSX.Element;
export {};
