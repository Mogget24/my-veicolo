// Renders the monochrome notification badge (assets/badge.svg) to public/badge-96.png.
// App icons are generated at build time by vite-plugin-pwa from public/icon.svg.
// Run after changing the glyph: pnpm --filter @my-veicolo/web icons
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))

await sharp(root('assets/badge.svg'), { density: 300 })
  .resize(96, 96)
  .png()
  .toFile(root('public/badge-96.png'))

console.log('public/badge-96.png generated')
