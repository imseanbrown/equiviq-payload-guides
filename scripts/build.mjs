import { build } from 'esbuild'
import { cp, mkdir } from 'node:fs/promises'

const shared = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  packages: 'external',
  jsx: 'automatic',
  outdir: 'dist',
  logLevel: 'info',
}

await mkdir('dist', { recursive: true })
await build({ ...shared, entryPoints: {
  plugin: 'src/plugin.ts', server: 'src/server.ts', filters: 'src/filters.ts', components: 'src/components.tsx',
} })
await build({ ...shared, banner: { js: "'use client';" }, entryPoints: {
  'facet-field': 'src/facet-field.tsx', 'connection-test': 'src/connection-test.tsx', 'view-tracker': 'src/view-tracker.tsx',
} })
await cp('src/styles.css', 'dist/styles.css')
