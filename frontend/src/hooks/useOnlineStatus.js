/**
 * Estado de la red del navegador (Fase 8). Se actualiza con los eventos `online` y `offline`.
 *
 *   const online = useOnlineStatus()
 *
 * `navigator.onLine === true` solo indica que hay una red, no que la API responda: por eso
 * el guardado de asistencias también pasa a la cola local ante un error de red.
 */
import { useSyncExternalStore } from 'react'

function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const getSnapshot = () => navigator.onLine
const getServerSnapshot = () => true

export default function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
