/**
 * Bloqueo global de acciones de escritura sin conexión (Fase 8).
 *
 * MainLayout provee `true` cuando el navegador está offline y la ruta NO es el módulo de
 * Asistencias (el único que guarda en la cola local). Fuera de MainLayout (login, inscripción
 * pública) el valor por defecto es `false`: nada se bloquea.
 *
 * Lo consumen:
 *   - Button:        bloquea los botones `type="submit"` y los marcados con `requiresNetwork`.
 *   - ConfirmDialog: bloquea el botón de confirmar (deshabilitar, eliminar, guardar cambios...).
 * Un botón de envío que debe seguir activo sin red se marca con `requiresNetwork={false}`.
 */
import { createContext, useContext } from 'react'

export const OfflineBlockContext = createContext(false)

/** Texto que explica por qué la acción está bloqueada (tooltip y lectores de pantalla). */
export const OFFLINE_BLOCK_MESSAGE = 'Sin conexión: esta acción requiere internet.'

/** @returns {boolean} true si las acciones de escritura están bloqueadas por falta de red. */
export function useOfflineBlock() {
  return useContext(OfflineBlockContext)
}
