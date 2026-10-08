/**
 * Configuración de Vite (servidor de desarrollo y empaquetador del frontend).
 *
 * Plugins:
 *   - react():       soporte para JSX y recarga en caliente de componentes.
 *   - tailwindcss(): compila las clases de Tailwind CSS v4 usadas en el código.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
