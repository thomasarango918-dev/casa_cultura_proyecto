/**
 * Servicio del módulo de programas y categorías (Fase 5): /admin/categorias y /admin/programas.
 * Requieren token y rol Administrador o Coordinador.
 */
import apiClient from './apiClient'

/** Categorías con sus programas y las métricas de cada uno. */
export async function listCategorias() {
  const { data } = await apiClient.get('/admin/categorias')
  return data
}

/** @param {{nombre: string, descripcion: string|null}} categoria */
export async function crearCategoria(categoria) {
  const { data } = await apiClient.post('/admin/categorias', categoria)
  return data
}

/** La API responde 400 si se deshabilita con estudiantes activos. */
export async function cambiarEstadoCategoria(id, activo) {
  const { data } = await apiClient.patch(`/admin/categorias/${id}/estado`, { activo })
  return data
}

/** Usuarios con rol Maestro (incluye cuentas deshabilitadas, marcadas con `activo: false`). */
export async function listMaestros() {
  const { data } = await apiClient.get('/admin/programas/maestros')
  return data
}

/** @param {{categoria_id: number, nombre: string, maestro_id: number|null}} programa */
export async function crearPrograma(programa) {
  const { data } = await apiClient.post('/admin/programas', programa)
  return data
}

/** @param {{nombre: string, maestro_id: number|null}} programa */
export async function actualizarPrograma(id, programa) {
  const { data } = await apiClient.put(`/admin/programas/${id}`, programa)
  return data
}

/** La API responde 400 si el programa tiene estudiantes activos o historial. */
export async function eliminarPrograma(id) {
  await apiClient.delete(`/admin/programas/${id}`)
}
