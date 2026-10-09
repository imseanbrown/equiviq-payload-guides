import type { Block, Config, GlobalConfig } from 'payload';
export type EquiviqGuidesOptions = {
    /** Name of the server environment variable containing the HTTPS guide list API URL. */
    apiUrlEnv: string;
    /** Name of the server environment variable containing the Equiviq API key. */
    apiKeyEnv: string;
    /** Payload collection that owns guide index blocks. Defaults to pages. */
    pagesCollection?: string;
};
export declare const equiviqGuidesBlock: Block;
export declare const equiviqGuidesSettings: GlobalConfig;
export declare function equiviqGuidesPlugin(options: EquiviqGuidesOptions): (config: Config) => Config;
