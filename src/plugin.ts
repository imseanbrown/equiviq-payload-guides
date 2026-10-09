import type { Config } from 'payload'

export type EquiviqGuidesOptions = {
  /** Name of the server environment variable containing the HTTPS guide list API URL. */
  apiUrlEnv: string
  /** Name of the server environment variable containing the Equiviq API key. */
  apiKeyEnv: string
  /** Public path owned by this plugin, for example /guides or /support/guides. */
  basePath: string
}

export function normalizeBasePath(value: string): string {
  if (!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(value)) {
    throw new Error('Equiviq guide basePath must contain lowercase URL segments')
  }
  return value
}

export function equiviqGuidesPlugin(options: EquiviqGuidesOptions) {
  normalizeBasePath(options.basePath)
  for (const name of [options.apiUrlEnv, options.apiKeyEnv]) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error('Equiviq guide environment variable names are invalid')
  }
  return (config: Config): Config => ({
    ...config,
    custom: {
      ...config.custom,
      equiviqGuides: {
        apiUrlEnv: options.apiUrlEnv,
        apiKeyEnv: options.apiKeyEnv,
        basePath: options.basePath,
      },
    },
  })
}
