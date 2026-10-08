/**
 * Botón de notificaciones del encabezado con su panel desplegable.
 *
 * En esta fase el panel muestra el estado vacío; en fases posteriores listará
 * avisos como nuevas solicitudes radicadas o cambios en los grupos.
 */
import { useCallback, useRef, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import useDismiss from '../../hooks/useDismiss'

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  // Cierra el panel al hacer clic fuera o al presionar Escape.
  useDismiss(containerRef, open, close)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Notificaciones"
        className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-pizarra-900"
      >
        <Bell aria-hidden="true" className="size-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-xl bg-white shadow-float ring-1 ring-pizarra-900/10 animate-fade-in"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-pizarra-950">Notificaciones</p>
          </div>
          {/* Estado vacío */}
          <div className="px-6 py-8 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400">
              <BellOff aria-hidden="true" className="size-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-pizarra-900">No tiene notificaciones nuevas</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Aquí verá los avisos de nuevas solicitudes radicadas y cambios en sus grupos.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
