/**
 * Hook para cerrar menús desplegables y paneles flotantes.
 *
 * Mientras el menú está abierto escucha tres eventos del documento:
 *   - mousedown / touchstart fuera del contenedor: cierra el menú.
 *   - tecla Escape: cierra el menú.
 * Los escuchadores se quitan al cerrar el menú para no gastar recursos.
 */
import { useEffect } from 'react'

/**
 * @param {React.RefObject<HTMLElement>} ref Contenedor del menú (incluye el botón que lo abre).
 * @param {boolean} open Si el menú está abierto.
 * @param {() => void} onClose Acción de cierre.
 */
export default function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined

    function handlePointer(event) {
      // Solo se cierra si el clic ocurrió fuera del contenedor del menú.
      if (ref.current && !ref.current.contains(event.target)) onClose()
    }
    function handleKey(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer, { passive: true })
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [ref, open, onClose])
}
