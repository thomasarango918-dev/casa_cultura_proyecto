/**
 * Configuración de Vite (servidor de desarrollo y empaquetador del frontend).
 *
 * Plugins:
 *   - react():       soporte para JSX y recarga en caliente de componentes.
 *   - tailwindcss(): compila las clases de Tailwind CSS v4 usadas en el código.
 *   - VitePWA():     (Fase 8) manifiesto de la aplicación instalable y service worker de Workbox.
 *
 * Service worker (solo en `npm run build` / `npm run preview`; en `npm run dev` está apagado):
 *   - Precarga los archivos estáticos del build (JS, CSS, HTML, fuentes, íconos): la aplicación
 *     abre sin conexión.
 *   - Toda navegación (/dashboard/...) responde con index.html desde la caché (SPA).
 *   - La API NO se guarda en caché del service worker: los datos que deben estar disponibles sin
 *     conexión (asistencias) se guardan en IndexedDB (src/utils/offlineSync.js).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // El service worker nuevo se activa solo al publicar otra versión (sin preguntar al usuario).
      registerType: 'autoUpdate',
      // Inyecta en index.html el script que registra el service worker.
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Casa de la Cultura',
        short_name: 'Casa Cultura',
        description:
          'Sistema de gestión académica de la Casa de la Cultura de San Pedro de los Milagros.',
        lang: 'es-CO',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f8fafc',
        theme_color: '#0c1528',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Recharts queda en un chunk aparte (> 2 MiB por defecto no se precarga).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        // Las rutas de la API nunca se responden con index.html.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        // En desarrollo no hay service worker: evita servir archivos viejos mientras se programa.
        enabled: false,
      },
    }),
  ],
  server: {
    // Puerto fijo: debe coincidir con CORS_ORIGINS en backend/.env.
    port: 5173,
    // Si el puerto está ocupado, falla en lugar de usar otro (que la API rechazaría por CORS).
    strictPort: true,
  },
  preview: {
    // Puerto de `npm run preview`, que sirve la versión compilada de producción.
    port: 4173,
  },
})
