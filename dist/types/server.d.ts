import type { EquiviqGuidesOptions } from './plugin';
export type PublicGuideSummary = {
    id: string;
    document_number: string;
    title: string;
    updated_at: string;
    slug: string;
    visibility_label: string;
    public_access: true;
    category?: string;
    company?: string;
    tags?: string[];
    folders?: string[];
    /** Present only in Equiviq 0.1.0 responses during a rolling upgrade. */
    permalink?: string;
};
export type PublicGuide = PublicGuideSummary & {
    callout_colors?: {
        note?: string;
        tip?: string;
        important?: string;
        warning?: string;
    };
    description: string;
    author: string;
    manufacturer: string;
    category: string;
    tags: string[];
    folders: string[];
    version: number;
    created_at: string;
    published_at: string;
    approved_at: string | null;
    created_by: string;
    updated_by: string;
    approved_by: string;
    published_by: string;
    sections: {
        title: string;
        markdown: string;
    }[];
};
export type GuideFacets = {
    folders: string[];
    categories: string[];
    tags: string[];
    companies: string[];
};
export declare function createGuideClient(options: EquiviqGuidesOptions, resolveCredentials?: () => Promise<{
    apiUrl?: string | null;
    apiKey?: string | null;
} | null>): {
    listGuides: (search?: string) => Promise<PublicGuideSummary[] | null>;
    getGuide: (slug: string) => Promise<PublicGuide | null>;
    getImage: (article: string, image: string) => Promise<Response | null>;
    recordView: (slug: string, eventID: string, referrer: string) => Promise<boolean>;
    getFacets: () => Promise<GuideFacets | null>;
};
