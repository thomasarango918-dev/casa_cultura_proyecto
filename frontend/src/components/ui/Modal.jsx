/**
 * Ventana modal reutilizable con el mismo estilo de EvaluacionModal.
 *
 *   - Fondo oscuro: un clic fuera del panel cierra el modal.
 *   - Escape cierra el modal; bloquea el desplazamiento de la página mientras está abierto.
 *   - Enfoca el panel al abrirse para que el teclado y los lectores de pantalla empiecen en él.
 *   - En móvil se abre desde abajo; desde sm aparece centrado.
 *
 * `dismissible={false}` desactiva el cierre (por ejemplo, mientras se guarda o mientras
 * hay un modal de confirmación encima, para que Escape no cierre los dos).
 *
 * @param {object} props
 * @param {string} props.titleId Id del título, para aria-labelledby.
 * @param {React.ReactNode} props.header Contenido del encabezado (título y subtítulo).
 * @param {React.ReactNode} props.children Cuerpo con desplazamiento propio.
 * @param {React.ReactNode} [props.footer] Barra de acciones inferior.
 * @param {() => void} props.onClose Cierra el modal.
 * @param {boolean} [props.dismissible] Permite cerrar con Escape, el fondo o la X.
 * @param {'sm'|'md'|'lg'} [props.size] Ancho máximo del panel.
 * @param {string} [props.layer] Clase z-index; un modal encima de otro usa uno mayor.
 * @param {string} [props.role] 'dialog' o 'alertdialog'.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export default function Modal({
  titleId,
  header,
  children,
  footer,
  onClose,
  dismissible = true,
  size = 'lg',
  layer = 'z-50',
  role = 'dialog',
}) {
  const panelRef = useRef(null)
  // Referencias actualizadas para usarlas en los escuchadores sin volver a registrarlos.
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  useEffect(() => {
    onCloseRef.current = onClose
    dismissibleRef.current = dismissible
  })

  // Enfoca el panel al abrirlo y devuelve el foco al elemento anterior al cerrarlo.
  useEffect(() => {
    const previous = document.activeElement
    panelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  // Bloquea el desplazamiento y cierra con Escape.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.stopPropagation()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  return (
    <div className={`fixed inset-0 flex items-end justify-center sm:items-center sm:p-6 ${layer}`}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar"
        onClick={() => dismissible && onClose()}
        className="absolute inset-0 bg-pizarra-950/60 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-float ring-1 ring-pizarra-900/10 animate-fade-in focus:outline-none sm:rounded-2xl ${SIZES[size]}`}
      >
        <header className="flex items-start gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            className="-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
