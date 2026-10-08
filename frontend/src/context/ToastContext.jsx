/**
 * Sistema de notificaciones flotantes (toasts).
 *
 * Uso desde cualquier componente:
 *   const toast = useToast()
 *   toast.success('Título', 'Mensaje opcional')
 *   toast.error('Título', 'Mensaje')        // dura 7 s por defecto
 *   const id = toast.info('Título')          // devuelve un id
 *   toast.dismiss(id)                        // cierra ese aviso antes de tiempo
 *
 * Los avisos aparecen en la esquina superior derecha (arriba y a lo ancho en
 * móvil), se cierran solos y muestran una barra con el tiempo restante.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)

/** Máximo de avisos visibles a la vez; al superarlo se descarta el más antiguo. */
const MAX_VISIBLE = 4

/** Icono y colores de cada tipo de aviso. */
const VARIANTS = {
  success: { icon: CircleCheck, iconClass: 'text-pradera-600', barClass: 'bg-pradera-500' },
  error: { icon: CircleAlert, iconClass: 'text-rose-600', barClass: 'bg-rose-500' },
  warning: { icon: TriangleAlert, iconClass: 'text-amber-500', barClass: 'bg-amber-400' },
  info: { icon: Info, iconClass: 'text-pizarra-600', barClass: 'bg-pizarra-500' },
}

/** Genera un identificador único para cada aviso (con respaldo para navegadores antiguos). */
function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Tarjeta individual de un aviso. */
function ToastItem({ toast, onDismiss }) {
  const { icon: Icon, iconClass, barClass } = VARIANTS[toast.variant] ?? VARIANTS.info
  // Errores y advertencias se anuncian de inmediato a los lectores de pantalla.
  const isUrgent = toast.variant === 'error' || toast.variant === 'warning'

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      className="pointer-events-auto relative overflow-hidden rounded-xl bg-white shadow-float ring-1 ring-pizarra-900/10 animate-toast-in"
    >
      <div className="flex items-start gap-3 p-4">
        <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-pizarra-950">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{toast.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cerrar notificación"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      {/* Barra de tiempo restante: se encoge durante `duration` milisegundos. */}
      {toast.duration > 0 && (
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-0.5 origin-left ${barClass}`}
          style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }}
        />
      )}
    </div>
  )
}

/** Proveedor que guarda la lista de avisos y los dibuja sobre toda la aplicación. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  // Temporizadores de cierre automático, indexados por id del aviso.
  const timers = useRef(new Map())

  /** Quita un aviso de la lista y cancela su temporizador. */
  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  /**
   * Muestra un aviso nuevo.
   * @param {{variant?: string, title: string, message?: string, duration?: number}} options
   *   duration en milisegundos; 0 = el aviso no se cierra solo.
   * @returns {string} id del aviso, útil para cerrarlo con dismiss().
   */
  const show = useCallback(
    ({ variant = 'info', title, message = '', duration = 5000 }) => {
      const id = createId()
      setToasts((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, variant, title, message, duration }])
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  // Al desmontar el proveedor se cancelan los temporizadores pendientes.
  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((timer) => clearTimeout(timer))
      pending.clear()
    }
  }, [])

  // API pública del contexto. useMemo evita que los consumidores se rendericen de nuevo sin necesidad.
  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (title, message, options) => show({ ...options, variant: 'success', title, message }),
      error: (title, message, options) =>
        show({ duration: 7000, ...options, variant: 'error', title, message }),
      warning: (title, message, options) => show({ ...options, variant: 'warning', title, message }),
      info: (title, message, options) => show({ ...options, variant: 'info', title, message }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Contenedor fijo de los avisos. pointer-events-none deja pasar los clics entre tarjetas. */}
      <div
        aria-label="Notificaciones"
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-96"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Hook de acceso a las notificaciones. Debe usarse dentro de <ToastProvider>. */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>.')
  return context
}
