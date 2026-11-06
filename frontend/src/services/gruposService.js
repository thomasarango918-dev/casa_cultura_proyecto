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

/**
 * Horario: [{dia_semana: 1-7, hora_inicio: 'HH:MM', hora_fin: 'HH:MM'}], entre 08:00 y 22:00.
 * @param {{programa_id: number, nombre: string, horarios: object[]}} grupo
 */
export async function crearGrupo(grupo) {
  const { data } = await apiClient.post('/admin/grupos', grupo)
  return data
}

/**
 * Renombra el grupo y reemplaza su horario completo.
 * @param {{nombre: string, horarios: object[]}} grupo
 */
export async function actualizarGrupo(id, grupo) {
  const { data } = await apiClient.put(`/admin/grupos/${id}`, grupo)
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

/** Fechas de clase desde la creación del grupo hasta hoy, sin festivos de Colombia. */
export async function getSesionesClase(id) {
  const { data } = await apiClient.get(`/admin/grupos/${id}/sesiones-clase`)
  return data
}
