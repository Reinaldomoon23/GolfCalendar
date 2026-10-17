import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// https://vite.dev/config/
export default defineConfig(() => {
  const base = '/GolfTeam/';

  return {
    base: base,
    // Only browser-safe assets belong in the static bundle. Legacy PHP and
    // its private data remain outside Vercel's deployment output.
    publicDir: 'public-app',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon-180x180.png'],
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
            if (id.includes('/chart.js/') || id.includes('/react-chartjs-2/')) return 'charts';
            if (id.includes('/html2canvas/')) return 'pdf-export';
            return undefined;
          }
        }
      }
    },
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
