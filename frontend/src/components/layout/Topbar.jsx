/**
 * Encabezado superior del sistema.
 *
 * Contiene, de izquierda a derecha:
 *   - Botón para abrir el menú lateral (móvil) o para contraerlo/expandirlo (escritorio).
 *   - La marca institucional, solo en móvil y tableta (en escritorio ya está en el menú lateral).
 *   - Notificaciones y menú del usuario.
 *
 * Es "sticky": permanece visible al desplazarse por la página.
 *
 * @param {object} props
 * @param {boolean} props.collapsed Estado del menú lateral en escritorio.
 * @param {() => void} props.onToggleCollapsed Contrae o expande el menú lateral.
 * @param {() => void} props.onOpenMobile Abre el menú lateral en móvil.
 * @param {object} props.user Usuario autenticado.
 * @param {() => void} props.onLogout Cierra la sesión.
 */
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import BrandMark from '../brand/BrandMark'
import NotificationsMenu from './NotificationsMenu'
import UserMenu from './UserMenu'

export default function Topbar({ collapsed, onToggleCollapsed, onOpenMobile, user, onLogout }) {
  // Estilo compartido por los botones de solo icono.
  const iconButton =
    'grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-pizarra-900'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Móvil y tableta: abre el panel de navegación */}
        <button
          type="button"
          onClick={onOpenMobile}
          className={`${iconButton} -ml-2 lg:hidden`}
          aria-label="Abrir menú de navegación"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        {/* Escritorio: contrae o expande el menú lateral */}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`${iconButton} -ml-2 hidden lg:grid`}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          aria-pressed={collapsed}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-5" />
          )}
        </button>

        {/* En móvil y tableta el menú lateral está oculto: se muestra la identidad institucional. */}
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <BrandMark className="size-8 shrink-0" />
          <span className="truncate text-sm font-semibold text-pizarra-950">Casa de la Cultura</span>
        </div>

        {/* Acciones a la derecha (ml-auto empuja el bloque hasta el borde) */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <NotificationsMenu />
          <div aria-hidden="true" className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  )
}
