/**
 * Servicio de estadísticas (Fase 7): /admin/estadisticas. Solo lectura.
 * Solicitudes y categorías: Administrador y Coordinador. Maestros y ocupación de grupos: también el
 * Maestro, limitado a sí mismo. El resto de casos recibe 403.
 */
import apiClient from './apiClient'

/** @returns {Promise<{estado: 'APROBADO'|'PENDIENTE'|'RECHAZADO', total: number}[]>} Siempre los tres estados. */
export async function getEstadisticaSolicitudes() {
  const { data } = await apiClient.get('/admin/estadisticas/solicitudes')
  return data
}

/**
 * Aprobados por categoría con el desglose de TODOS sus programas (los que tienen 0 también).
 * @returns {Promise<{categoria_id: number|null, categoria: string, activa: boolean, total: number,
 *   programas: {programa_id: number, programa: string, total: number}[]}[]>}
 */
export async function getEstadisticaCategorias() {
  const { data } = await apiClient.get('/admin/estadisticas/categorias')
  return data
}

/**
 * Maestros del filtro de ocupación. Administrador y Coordinador reciben todos; el Maestro, solo a sí mismo.
 * @returns {Promise<{id: number, nombre_completo: string, activo: boolean}[]>}
 */
export async function getEstadisticaMaestros() {
  const { data } = await apiClient.get('/admin/estadisticas/maestros')
  return data
}

/**
 * Estudiantes activos por grupo de los programas de un maestro. Un Maestro que pide otro id recibe 403.
 * @param {number} maestroId
 * @returns {Promise<{grupo_id: number, grupo: string, programa: string, total: number}[]>}
 */
export async function getEstadisticaOcupacionGrupos(maestroId) {
  const { data } = await apiClient.get('/admin/estadisticas/ocupacion-grupos', { params: { maestro_id: maestroId } })
  return data
}
