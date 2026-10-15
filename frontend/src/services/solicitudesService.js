/**
 * Servicio de solicitudes del BackOffice: endpoints /admin de la API (requieren token).
 */
import apiClient from './apiClient'

/**
 * Lista solicitudes con filtros opcionales.
 * @param {{estado?: string, buscar?: string, limit?: number, offset?: number}} [params]
 * @param {AbortSignal} [signal] Permite cancelar la búsqueda anterior al escribir.
 * @returns {Promise<{total: number, items: object[]}>}
 */
export async function listSolicitudes(params = {}, signal) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null))
  const { data } = await apiClient.get('/admin/solicitudes', { params: query, signal })
  return data
}

/** Detalle de una solicitud con sus documentos adjuntos. */
export async function getSolicitud(id) {
  const { data } = await apiClient.get(`/admin/solicitudes/${id}`)
  return data
}

/**
 * Aprueba o rechaza una solicitud pendiente.
 * @param {number} id
 * @param {{estado: 'APROBADO'|'RECHAZADO', justificacion: string}} evaluacion
 * @returns {Promise<object>} Detalle actualizado.
 */
export async function evaluarSolicitud(id, evaluacion) {
  const { data } = await apiClient.post(`/admin/solicitudes/${id}/evaluar`, evaluacion)
  return data
}

/**
 * Descarga un documento como Blob. Se usa en lugar de un enlace directo porque
 * el endpoint exige el token JWT, que el navegador no envía al abrir una URL.
 */
export async function fetchDocumentoBlob(solicitudId, documentoId) {
  const response = await apiClient.get(`/admin/solicitudes/${solicitudId}/documentos/${documentoId}/archivo`, {
    responseType: 'blob',
    timeout: 60_000,
  })
  const type = response.headers['content-type'] ?? response.data.type
  return new Blob([response.data], { type })
}

/** @returns {Promise<{total: number, pendientes: number, aprobadas: number, rechazadas: number}>} */
export async function getDashboardKpis() {
  const { data } = await apiClient.get('/admin/dashboard/kpis')
  return data
}

/**
 * Inventario de documentos: solicitudes (con sus documentos) cuyo documento de
 * identidad o número de radicado contiene el texto buscado.
 * @param {'documento'|'radicado'} metodo
 * @param {string} valor
 * @returns {Promise<{metodo: string, valor: string, total: number, total_documentos: number, items: object[]}>}
 */
export async function buscarDocumentos(metodo, valor) {
  const { data } = await apiClient.get('/admin/documentos', { params: { metodo, valor } })
  return data
}

/**
 * Opciones de autocompletado del inventario mientras se escribe.
 * @param {'documento'|'radicado'} metodo
 * @param {string} valor
 * @param {AbortSignal} [signal] Cancela la consulta anterior al seguir escribiendo.
 * @returns {Promise<Array<{valor: string, nombre: string, solicitudes: number}>>}
 */
export async function sugerenciasDocumentos(metodo, valor, signal) {
  const { data } = await apiClient.get('/admin/documentos/sugerencias', { params: { metodo, valor }, signal })
  return data
}
