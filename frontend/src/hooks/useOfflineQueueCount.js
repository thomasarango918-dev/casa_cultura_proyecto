/**
 * Cantidad de asistencias guardadas sin conexión y pendientes de sincronizar (Fase 8).
 * Se recalcula cada vez que la cola cambia (QUEUE_CHANGED_EVENT), también desde otras vistas.
 *
 * @param {number} [usuarioId] Solo las del usuario indicado.
 * @returns {number}
 */
import { useEffect, useState } from 'react'
import { QUEUE_CHANGED_EVENT, getQueueCount } from '../utils/offlineSync'

export default function useOfflineQueueCount(usuarioId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let activo = true
    const actualizar = () => {
      getQueueCount(usuarioId).then((total) => {
        if (activo) setCount(total)
      })
    }
    actualizar()
    window.addEventListener(QUEUE_CHANGED_EVENT, actualizar)
    return () => {
      activo = false
      window.removeEventListener(QUEUE_CHANGED_EVENT, actualizar)
    }
  }, [usuarioId])

  return count
}
