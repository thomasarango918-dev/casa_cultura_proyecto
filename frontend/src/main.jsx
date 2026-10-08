/**
 * Punto de entrada del frontend.
 *
 * Carga la tipografía Inter y los estilos globales, y monta el componente raíz
 * <App /> dentro del elemento #root de index.html.
 *
 * StrictMode solo actúa en desarrollo: ejecuta dos veces algunos efectos para
 * detectar errores comunes. No afecta la versión de producción.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles/globals.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
