type CTA = {
    slug: string;
    heading: string;
    privacyUrl?: string | null;
    successMessage?: string | null;
    errorMessage?: string | null;
    fields?: Record<string, {
        visible?: boolean | null;
        required?: boolean | null;
        label?: string | null;
        countryLabel?: string | null;
    } | null> | null;
};
export declare function EquiviqLeadForm({ cta, privacyPolicyUrl }: {
    cta: CTA;
    privacyPolicyUrl?: string;
}): import("react/jsx-runtime").JSX.Element;
export {};
