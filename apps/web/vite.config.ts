import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { APP_NAME } from '@my-veicolo/shared/brand'

export default defineConfig({
  plugins: [
    // Replaces %APP_NAME% in index.html, so the name lives only in @my-veicolo/shared/brand.
    { name: 'app-name', transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME) },
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: 'Scadenze, manutenzione e documenti dei tuoi veicoli',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b0c0e',
        background_color: '#0b0c0e',
      },
      injectManifest: {
        // No webmanifest here: the plugin adds it itself, and a duplicate URL with a
        // different revision makes Workbox throw, so the SW never installs.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      devOptions: { enabled: true, type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
