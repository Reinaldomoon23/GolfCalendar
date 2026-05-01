import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = '/GolfTeam/';

  return {
    base: base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'mask-icon.svg'],
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes('/profiles/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'user-profiles',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 // 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Calendario Golf 2026',
          short_name: 'Golf 2026',
          description: 'Seguimiento de torneos y hándicap de golf.',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '.',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    server: {
      proxy: {
        // Dynamic proxying might be tricky. Let's cover both cases or generic.
        // If we request /GolfTeam/api, we want it to go to /api on localhost:8000 (backend)
        // If we request /Nicole26/api, same.
        [`${base}api`]: {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${base}api`), '/api')
        },
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true
        }
      }
    }
  };
})
