import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// icon.svg is full-bleed dark with the glyph already inside the maskable safe zone,
// so no extra padding; any uncovered area is filled with the app background.
const background = '#0b0c0e'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
