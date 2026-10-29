/**
 * Servicio del módulo de grupos (Fase 6): /admin/grupos.
 * La API filtra por rol: el Maestro solo recibe los grupos de sus programas y 403 fuera de ellos.
 */
import apiClient from './apiClient'

export async function listGrupos() {
  const { data } = await apiClient.get('/admin/grupos')
  return data
}

/** Programas donde el usuario puede crear grupos (403 para el Coordinador). */
export async function listProgramasParaGrupos() {
  const { data } = await apiClient.get('/admin/grupos/programas')
  return data
}

/** @param {{programa_id: number, nombre: string}} grupo */
export async function crearGrupo(grupo) {
  const { data } = await apiClient.post('/admin/grupos', grupo)
  return data
}

export async function renombrarGrupo(id, nombre) {
  const { data } = await apiClient.put(`/admin/grupos/${id}`, { nombre })
  return data
}

/** La API responde 400 si el grupo tiene estudiantes activos. */
export async function eliminarGrupo(id) {
  await apiClient.delete(`/admin/grupos/${id}`)
}

export async function listEstudiantesGrupo(id) {
  const { data } = await apiClient.get(`/admin/grupos/${id}/estudiantes`)
  return data
}

/** Solicitudes aprobadas del programa del grupo que aún no están en él. */
export async function listEstudiantesDisponibles(id) {
  const { data } = await apiClient.get(`/admin/grupos/${id}/estudiantes-disponibles`)
  return data
}

/** @returns {Promise<{asignados: number}>} */
export async function asignarEstudiantes(id, solicitudesIds) {
  const { data } = await apiClient.post(`/admin/grupos/${id}/estudiantes`, { solicitudes_ids: solicitudesIds })
  return data
}

/** Soft delete: la API marca la salida con fecha, no borra el registro. */
export async function desasignarEstudiante(id, solicitudId) {
  await apiClient.delete(`/admin/grupos/${id}/estudiantes/${solicitudId}`)
}
