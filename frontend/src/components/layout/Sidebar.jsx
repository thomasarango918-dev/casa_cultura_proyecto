/**
 * Menú lateral de navegación.
 *
 * Comportamiento según el tamaño de pantalla:
 *   - Escritorio (lg y mayores): fijo a la izquierda; se puede contraer a solo iconos.
 *   - Móvil y tableta: oculto; se abre como panel deslizable sobre un fondo oscuro.
 *
 * El contenido de ambas versiones es el mismo componente (SidebarContent).
 */
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import BrandMark from '../brand/BrandMark'
import { getNavigationForRole } from '../../config/navigation'

/**
 * Elemento individual del menú.
 * Si está deshabilitado se muestra atenuado y sin enlace; si no, usa NavLink,
 * que marca automáticamente la opción de la página actual.
 */
function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon
  const base = `group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
    collapsed ? 'h-11 justify-center' : 'gap-3 px-3 py-2.5'
  }`

  // Módulo aún no disponible: no navega.
  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        title={collapsed ? item.label : undefined}
        className={`${base} cursor-not-allowed text-pizarra-500`}
      >
        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
        {collapsed ? (
          <span className="sr-only">{item.label}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        )}
      </span>
    )
  }

  // Opción activa: fondo resaltado y una barra verde a la izquierda (pseudo-elemento ::before).
  return (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `${base} ${
          isActive
            ? 'bg-white/[0.08] text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-pradera-400'
            : 'text-pizarra-300 hover:bg-white/5 hover:text-white'
        }`
      }
    >
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      {/* Con el menú contraído el texto queda solo para lectores de pantalla. */}
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

/**
 * Contenido del menú: marca, grupos de navegación y pie con el periodo académico.
 *
 * @param {object} props
 * @param {boolean} props.collapsed Mostrar solo iconos.
 * @param {string} props.role Rol del usuario; filtra los grupos visibles.
 * @param {() => void} [props.onNavigate] Se llama al elegir una opción (cierra el panel móvil).
 * @param {() => void} [props.onClose] Si existe, muestra el botón de cerrar (solo en móvil).
 */
function SidebarContent({ collapsed, role, onNavigate, onClose }) {
  const groups = getNavigationForRole(role)
  const year = new Date().getFullYear()

  return (
    <div className="flex h-full flex-col">
      {/* Encabezado con la marca institucional */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-white/[0.06] ${
          collapsed ? 'justify-center px-0' : 'gap-3 px-5'
        }`}
      >
        <BrandMark tone="light" className="size-9 shrink-0" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Casa de la Cultura</p>
            <p className="truncate text-xs text-pizarra-400">San Pedro de los Milagros</p>
          </div>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-lg text-pizarra-300 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      {/* Grupos de navegación. Contraído, el título del grupo se reemplaza por una línea divisoria. */}
      <nav aria-label="Navegación principal" className="scrollbar-thin flex-1 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.id} className="mb-6 last:mb-0">
            {collapsed ? (
              <div aria-hidden="true" className="mx-3 mb-2 h-px bg-white/[0.06]" />
            ) : (
              <p className="px-3 pb-2 text-xs font-medium text-pizarra-400">{group.label}</p>
            )}
            <ul className="space-y-1" aria-label={collapsed ? group.label : undefined}>
              {group.items.map((item) => (
                <li key={item.label}>
                  <NavItem item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pie del menú */}
      {!collapsed && (
        <div className="shrink-0 border-t border-white/[0.06] px-5 py-4">
          <p className="text-xs leading-relaxed text-pizarra-400">
            Periodo académico {year}
            <br />
            Versión 1.0
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * @param {object} props
 * @param {boolean} props.collapsed Menú de escritorio contraído.
 * @param {boolean} props.mobileOpen Panel móvil abierto.
 * @param {() => void} props.onCloseMobile Cierra el panel móvil.
 * @param {string} props.role Rol del usuario autenticado.
 */
export default function Sidebar({ collapsed, mobileOpen, onCloseMobile, role }) {
  return (
    <>
      {/* Versión escritorio: fija; el ancho cambia entre 288 px (w-72) y 80 px (w-20). */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden bg-pizarra-950 transition-[width] duration-200 ease-out lg:block ${
          collapsed ? 'w-20' : 'w-72'
        }`}
      >
        <SidebarContent collapsed={collapsed} role={role} />
      </aside>

      {/* Versión móvil: panel modal con fondo oscuro; tocar el fondo lo cierra. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar menú"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-pizarra-950/60 backdrop-blur-[2px] animate-fade-in"
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-pizarra-950 shadow-2xl animate-drawer-in">
            <SidebarContent collapsed={false} role={role} onNavigate={onCloseMobile} onClose={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  )
}
