/**
 * Marco principal del sistema (shell) para todas las páginas protegidas.
 *
 * Estructura:
 *   +----------+-------------------------------+
 *   |          | Topbar (encabezado)           |
 *   | Sidebar  +-------------------------------+
 *   | (menú    | Breadcrumbs (migas de pan)    |
 *   | lateral) +-------------------------------+
 *   |          | <Outlet /> página activa      |
 *   |          +-------------------------------+
 *   |          | Pie de página                 |
 *   +----------+-------------------------------+
 *
 * También administra el estado del menú lateral (contraído en escritorio,
 * abierto en móvil) y el título de la pestaña del navegador.
 */
import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Breadcrumbs from './Breadcrumbs'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { getRouteMeta } from '../../config/navigation'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

/** Clave de localStorage donde se recuerda si el usuario prefiere el menú contraído. */
const COLLAPSE_KEY = 'casacultura.sidebar-collapsed'

/** Lee la preferencia guardada del menú contraído (false si no hay o si el almacenamiento está bloqueado). */
function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export default function MainLayout() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(readCollapsedPreference)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Título y migas de pan de la página actual (definidos en config/navigation.js).
  const meta = getRouteMeta(location.pathname)
  const year = new Date().getFullYear()

  // Recuerda la preferencia del menú contraído entre visitas.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* preferencia no persistida */
    }
  }, [collapsed])

  // Cierra el menú móvil al cambiar de página.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Con el menú móvil abierto: bloquea el desplazamiento y permite cerrar con Escape.
  useEffect(() => {
    if (!mobileOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event) => event.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [mobileOpen])

  // Título de la pestaña del navegador.
  useEffect(() => {
    document.title = meta.title ? `${meta.title} | Casa de la Cultura` : 'Casa de la Cultura'
  }, [meta.title])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const handleLogout = useCallback(() => {
    logout()
    toast.info('Sesión cerrada', 'Cerró su sesión correctamente.')
  }, [logout, toast])

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Enlace oculto que aparece al navegar con teclado: permite saltar directo al contenido. */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-pizarra-900 focus:shadow-float"
      >
        Saltar al contenido
      </a>

      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={closeMobile} role={user?.rol} />

      {/* Columna de contenido: su margen izquierdo acompaña el ancho del menú lateral en escritorio. */}
      <div
        className={`flex min-h-dvh flex-col transition-[padding] duration-200 ease-out ${
          collapsed ? 'lg:pl-20' : 'lg:pl-72'
        }`}
      >
        <Topbar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          onOpenMobile={() => setMobileOpen(true)}
          user={user}
          onLogout={handleLogout}
        />

        {/* Migas de pan */}
        <div className="border-b border-slate-200/70 bg-white/60">
          <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <Breadcrumbs items={meta.breadcrumbs} />
          </div>
        </div>

        {/* Contenido de la página activa (definida en App.jsx) */}
        <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>

        {/* Pie de página */}
        <footer className="border-t border-slate-200/70">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
            <p>© {year} Casa de la Cultura de San Pedro de los Milagros</p>
            <p>Sistema de gestión académica, versión 1.0</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
