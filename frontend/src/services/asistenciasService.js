/**
 * Servicio del módulo de asistencias (Fase 6): /admin/asistencias.
 * Administrador: todos los grupos. Maestro: solo los de sus programas (403 fuera de ellos).
 */
import apiClient from './apiClient'

/**
 * Matriz del grupo: estudiantes activos x fechas de clase (sin festivos).
 * @returns {Promise<{grupo_id: number, grupo_nombre: string, programa_nombre: string, hoy: string,
 *   es_dia_de_clase: boolean, sesiones: string[], festivos_omitidos: {fecha: string, nombre: string}[],
 *   estudiantes: {solicitud_id: number, nombre_completo: string, tipo_documento: string,
 *   numero_documento: string, asistencias: Record<string, 'PRESENTE'|'AUSENTE'|'EXCUSADO'>}[]}>}
 */
export async function getMatrizAsistencia(grupoId) {
  const { data } = await apiClient.get(`/admin/asistencias/grupo/${grupoId}`)
  return data
}

/**
 * Guarda la asistencia de HOY. La API responde 400 con cualquier otra fecha.
 * @param {number} grupoId
 * @param {string} fechaClase Fecha ISO (AAAA-MM-DD) de hoy, tal como la envió la matriz.
 * @param {{solicitud_id: number, estado: string}[]} registros
 */
export async function guardarAsistencia(grupoId, fechaClase, registros) {
  const { data } = await apiClient.post(`/admin/asistencias/grupo/${grupoId}`, {
    fecha_clase: fechaClase,
    registros,
  })
  return data
}
