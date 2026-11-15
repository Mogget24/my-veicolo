import { defineConfig } from 'tsdown'

// Bundles the API into dist/app.js. Workspace packages (@my-veicolo/*) are inlined
// so the Vercel Function only needs regular npm deps at runtime.
export default defineConfig({
  entry: { app: 'src/app.ts' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: false,
  deps: { alwaysBundle: [/^@my-veicolo\//] },
})
