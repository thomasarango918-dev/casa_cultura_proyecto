/**
 * Menú de usuario del encabezado: avatar, nombre y rol, con un panel desplegable
 * que muestra los datos de la cuenta y la opción de cerrar sesión.
 *
 * En móvil solo se ve el avatar; el nombre y el rol aparecen desde el tamaño md.
 *
 * @param {object} props
 * @param {object} props.user Usuario autenticado (estructura de UsuarioAutenticado en la API).
 * @param {() => void} props.onLogout Acción de cierre de sesión.
 */
import { useCallback, useRef, useState } from 'react'
import { ChevronDown, CircleUserRound, LogOut } from 'lucide-react'
import Avatar from '../ui/Avatar'
import useDismiss from '../../hooks/useDismiss'

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  // Cierra el menú al hacer clic fuera o al presionar Escape.
  useDismiss(containerRef, open, close)

  const name = user?.nombre_completo ?? 'Usuario'

  return (
    <div ref={containerRef} className="relative">
      {/* Botón que abre y cierra el menú */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="menu-usuario"
        className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-slate-100 md:pr-2"
      >
        <Avatar name={name} />
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-[12rem] truncate text-sm font-medium leading-tight text-pizarra-900">
            {name}
          </span>
          <span className="block text-xs text-slate-500">{user?.rol}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`hidden size-4 text-slate-400 transition-transform md:block ${open ? 'rotate-180' : ''}`}
        />
        <span className="sr-only">Abrir menú de usuario</span>
      </button>

      {/* Panel desplegable */}
      {open && (
        <div
          id="menu-usuario"
          role="menu"
          aria-label="Menú de usuario"
          className="absolute right-0 z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-xl bg-white p-1.5 shadow-float ring-1 ring-pizarra-900/10 animate-fade-in"
        >
          {/* Identidad del usuario */}
          <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
            <Avatar name={name} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-pizarra-950">{name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          {/* Datos de la cuenta */}
          <dl className="mx-1.5 mb-1.5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
            <div className="min-w-0">
              <dt className="text-slate-500">Rol</dt>
              <dd className="mt-0.5 truncate font-medium text-pizarra-900">{user?.rol}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-slate-500">Documento</dt>
              <dd className="mt-0.5 truncate font-medium text-pizarra-900">
                {user?.tipo_documento} {user?.num_documento}
              </dd>
            </div>
          </dl>

          <div className="my-1 h-px bg-slate-100" />

          {/* "Mi perfil" queda deshabilitado hasta que exista la página de perfil. */}
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400"
          >
            <CircleUserRound aria-hidden="true" className="size-[18px]" />
            <span className="flex-1 text-left">Mi perfil</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              onLogout()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <LogOut aria-hidden="true" className="size-[18px]" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
