import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      // Pudhu deploy aana udane pazhaya cache-a thookki pudhu version load pannum (blank page problem fix)
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api/]
      },
      manifest: {
        name: 'Surya Engineering College Classroom',
        short_name: 'SEC Classroom',
        description: 'Classroom with AI',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0b2545',
        background_color: '#ffffff',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
});