/**
 * Almacenamiento local para el trabajo sin conexión (Fase 8), con IndexedDB (librería `idb`).
 *
 * Base de datos `CasaCulturaDB` (versión 1):
 *
 *   pending_attendances   Cola de asistencias guardadas sin conexión, pendientes de enviar a la API.
 *                         Una entrada por (usuario, grupo, fecha): guardar de nuevo la misma fecha
 *                         reemplaza la entrada anterior (la última toma es la que vale).
 *                         {id, usuario_id, grupo_id, grupo_nombre, fecha_clase, registros, guardado_en}
 *
 *   cached_snapshots      Última copia recibida de la API para poder mostrar la pantalla sin red:
 *                         `grupos:<usuario>` (listado de grupos) y `matriz:<usuario>:<grupo>`
 *                         (matriz de asistencia). Se borra al cerrar sesión (datos personales).
 *
 * Cada cambio en la cola emite el evento global QUEUE_CHANGED_EVENT para que los
 * indicadores (ícono de nube, contadores) se actualicen sin consultar en bucle.
 *
 * El motor que envía la cola a la API está en hooks/useOfflineSync.js.
 */
import { openDB } from 'idb'

const DB_NAME = 'CasaCulturaDB'
const DB_VERSION = 1
const STORE_QUEUE = 'pending_attendances'
const STORE_SNAPSHOTS = 'cached_snapshots'

/** Evento global emitido cada vez que cambia la cola de asistencias pendientes. */
export const QUEUE_CHANGED_EVENT = 'casacultura:offline-queue-changed'

let dbPromise = null

/** Abre (o crea) la base de datos una sola vez por pestaña. */
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
          store.createIndex('usuario_id', 'usuario_id')
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' })
        }
      },
    }).catch((error) => {
      // Sin IndexedDB (modo privado antiguo, almacenamiento bloqueado): se permite reintentar.
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

function notificarCambio() {
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT))
}

/** Clave única de una toma de asistencia en la cola. */
export function queueId(usuarioId, grupoId, fechaClase) {
  return `${usuarioId}:${grupoId}:${fechaClase}`
}

// ---- Cola de asistencias ------------------------------------------------------------

/**
 * Guarda (o reemplaza) una toma de asistencia en la cola local.
 * Lanza un error si el navegador no permite IndexedDB: la vista debe avisarlo.
 *
 * @param {{usuario_id: number, grupo_id: number, grupo_nombre?: string, fecha_clase: string,
 *   registros: {solicitud_id: number, estado: string}[]}} entrada
 * @returns {Promise<object>} La entrada guardada (con `id` y `guardado_en`).
 */
export async function saveToQueue(entrada) {
  const item = {
    ...entrada,
    id: queueId(entrada.usuario_id, entrada.grupo_id, entrada.fecha_clase),
    guardado_en: new Date().toISOString(),
  }
  const db = await getDb()
  await db.put(STORE_QUEUE, item)
  notificarCambio()
  return item
}

/**
 * Devuelve las asistencias pendientes, de la más antigua a la más reciente.
 * @param {number} [usuarioId] Si se indica, solo las de ese usuario (cada quien sincroniza con su token).
 * @returns {Promise<object[]>} Lista vacía si IndexedDB no está disponible.
 */
export async function getQueue(usuarioId) {
  try {
    const db = await getDb()
    const items =
      usuarioId == null
        ? await db.getAll(STORE_QUEUE)
        : await db.getAllFromIndex(STORE_QUEUE, 'usuario_id', usuarioId)
    return items.sort((a, b) => a.guardado_en.localeCompare(b.guardado_en))
  } catch {
    return []
  }
}

/** Quita una entrada de la cola (después de sincronizarla o si la API la rechazó definitivamente). */
export async function removeFromQueue(id) {
  const db = await getDb()
  await db.delete(STORE_QUEUE, id)
  notificarCambio()
}

/**
 * Cantidad de asistencias pendientes de sincronizar.
 * @param {number} [usuarioId] Si se indica, solo las de ese usuario.
 */
export async function getQueueCount(usuarioId) {
  try {
    const db = await getDb()
    return usuarioId == null
      ? await db.count(STORE_QUEUE)
      : await db.countFromIndex(STORE_QUEUE, 'usuario_id', usuarioId)
  } catch {
    return 0
  }
}

/** Devuelve la entrada pendiente de un grupo en una fecha, o null. */
export async function getQueueItem(usuarioId, grupoId, fechaClase) {
  try {
    const db = await getDb()
    return (await db.get(STORE_QUEUE, queueId(usuarioId, grupoId, fechaClase))) ?? null
  } catch {
    return null
  }
}

// ---- Copias locales de la API -------------------------------------------------------

/** Claves de las copias locales (por usuario: en un mismo equipo pueden entrar varios). */
export const snapshotGrupos = (usuarioId) => `grupos:${usuarioId}`
export const snapshotMatriz = (usuarioId, grupoId) => `matriz:${usuarioId}:${grupoId}`

/** Guarda la última respuesta de la API bajo una clave. Un fallo se ignora (es solo una caché). */
export async function saveSnapshot(key, data) {
  try {
    const db = await getDb()
    await db.put(STORE_SNAPSHOTS, { key, data, guardado_en: new Date().toISOString() })
  } catch {
    /* sin IndexedDB: la pantalla solo funcionará con conexión */
  }
}

/** @returns {Promise<{key: string, data: any, guardado_en: string} | null>} */
export async function getSnapshot(key) {
  try {
    const db = await getDb()
    return (await db.get(STORE_SNAPSHOTS, key)) ?? null
  } catch {
    return null
  }
}

/** Borra todas las copias locales (al cerrar sesión). La cola de pendientes NO se borra. */
export async function clearSnapshots() {
  try {
    const db = await getDb()
    await db.clear(STORE_SNAPSHOTS)
  } catch {
    /* se ignora */
  }
}
