type Kind = 'folder' | 'category' | 'tag' | 'company';
export declare function FacetField({ path, kind, mode }: {
    path: string;
    kind: Kind;
    mode: 'Include' | 'Exclude';
}): import("react/jsx-runtime").JSX.Element | null;
export {};
