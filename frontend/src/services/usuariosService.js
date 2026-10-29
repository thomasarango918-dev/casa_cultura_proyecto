/**
 * Servicio del módulo de usuarios y roles: endpoints /admin/usuarios (requieren token
 * y rol Administrador o Coordinador).
 */
import apiClient from './apiClient'

/**
 * Lista usuarios. El Coordinador solo recibe Maestros y Estudiantes.
 * @param {{documento?: string, limit?: number, offset?: number}} [params]
 * @param {AbortSignal} [signal] Permite cancelar la búsqueda anterior al escribir.
 * @returns {Promise<{total: number, items: object[]}>}
 */
export async function listUsuarios(params = {}, signal) {
  const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null))
  const { data } = await apiClient.get('/admin/usuarios', { params: query, signal })
  return data
}

/** @returns {Promise<{roles: object[], tipos_documento: {id: number, sigla: string}[]}>} Roles que el usuario actual puede asignar. */
export async function getCatalogosUsuario() {
  const { data } = await apiClient.get('/admin/usuarios/catalogos')
  return data
}

/**
 * @param {{nombre_completo: string, email: string, tipo_documento_id: number, num_documento: string, rol_id: number, password: string}} usuario
 */
export async function crearUsuario(usuario) {
  const { data } = await apiClient.post('/admin/usuarios', usuario)
  return data
}

/**
 * Actualiza datos y rol. El número de documento es inmutable (la API responde 400 si cambia).
 * @param {number} id
 * @param {{nombre_completo: string, email: string, tipo_documento_id: number, rol_id: number}} usuario
 */
export async function actualizarUsuario(id, usuario) {
  const { data } = await apiClient.put(`/admin/usuarios/${id}`, usuario)
  return data
}

/** Habilita (`activo: true`) o deshabilita (`activo: false`) una cuenta. */
export async function cambiarEstadoUsuario(id, activo) {
  const { data } = await apiClient.patch(`/admin/usuarios/${id}/estado`, { activo })
  return data
}

/** Solo Administrador. La API responde 400 si es la cuenta propia o si tiene historial. */
export async function eliminarUsuario(id) {
  await apiClient.delete(`/admin/usuarios/${id}`)
}
