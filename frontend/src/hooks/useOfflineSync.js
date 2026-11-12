/**
 * Motor de sincronización automática de asistencias (Fase 8). Se monta una vez en MainLayout.
 *
 * Envía a la API la cola local (utils/offlineSync.js) del usuario autenticado:
 *   - al montar (si hay red),
 *   - al recuperar la conexión (evento `online`),
 *   - al volver a la pestaña, y cada 60 s mientras haya pendientes (`navigator.onLine` puede
 *     decir "online" aunque la API no responda).
 *
 * Por cada entrada:
 *   200                       se quita de la cola.
 *   Error de red / 5xx / 401  se conserva para el siguiente intento (un 401 cierra la sesión por
 *                             apiClient; la cola sigue guardada y se envía al volver a entrar).
 *   400 / 403 / 404 / 422     rechazo definitivo (p. ej. la fecha ya no se puede sincronizar):
 *                             se quita y se avisa con el motivo, para no reintentarla para siempre.
 *
 * La API es idempotente (UPSERT por grupo, estudiante y fecha): reenviar una entrada que ya
 * llegó no duplica registros.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage, isNetworkError, isOffline } from '../services/apiClient'
import { guardarAsistencia } from '../services/asistenciasService'
import { QUEUE_CHANGED_EVENT, getQueue, removeFromQueue } from '../utils/offlineSync'

/** Evento emitido al terminar una sincronización con al menos una entrada enviada. */
export const SYNC_DONE_EVENT = 'casacultura:offline-sync-done'

const REINTENTO_MS = 60_000

export default function useOfflineSync(usuarioId) {
  const toast = useToast()
  const enCurso = useRef(false)

  const sincronizar = useCallback(async () => {
    if (enCurso.current || usuarioId == null || isOffline()) return
    enCurso.current = true
    try {
      const pendientes = await getQueue(usuarioId)
      if (pendientes.length === 0) return

      let enviados = 0
      const rechazados = []
      for (const item of pendientes) {
        try {
          await guardarAsistencia(item.grupo_id, item.fecha_clase, item.registros, { offline: true })
          await removeFromQueue(item.id)
          enviados += 1
        } catch (error) {
          const status = error?.response?.status
          // Sin red o sesión vencida: se detiene y se reintenta después.
          if (isNetworkError(error) || status === 401) break
          // Error del servidor: esta entrada se reintenta más tarde.
          if (!status || status >= 500) continue
          await removeFromQueue(item.id)
          rechazados.push(`${item.grupo_nombre ?? `Grupo ${item.grupo_id}`} (${item.fecha_clase}): ${getApiErrorMessage(error)}`)
        }
      }

      if (enviados > 0) {
        toast.success('Asistencias offline sincronizadas con éxito', undefined, { duration: 3500 })
      }
      if (rechazados.length > 0) {
        toast.warning('Algunas asistencias offline no se pudieron sincronizar', rechazados.join(' · '), { duration: 0 })
      }
      if (enviados > 0 || rechazados.length > 0) {
        window.dispatchEvent(new CustomEvent(SYNC_DONE_EVENT))
      }
    } finally {
      enCurso.current = false
    }
  }, [usuarioId, toast])

  useEffect(() => {
    sincronizar()

    const alVolverVisible = () => {
      if (document.visibilityState === 'visible') sincronizar()
    }
    window.addEventListener('online', sincronizar)
    document.addEventListener('visibilitychange', alVolverVisible)
    const intervalo = setInterval(sincronizar, REINTENTO_MS)
    return () => {
      window.removeEventListener('online', sincronizar)
      document.removeEventListener('visibilitychange', alVolverVisible)
      clearInterval(intervalo)
    }
  }, [sincronizar])

  // Una entrada nueva guardada mientras hay red (la API no respondía) se intenta enviar pronto.
  useEffect(() => {
    let timer = null
    const programar = () => {
      clearTimeout(timer)
      timer = setTimeout(sincronizar, 5_000)
    }
    window.addEventListener(QUEUE_CHANGED_EVENT, programar)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(QUEUE_CHANGED_EVENT, programar)
    }
  }, [sincronizar])
}
