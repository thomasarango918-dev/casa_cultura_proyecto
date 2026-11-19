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

/** @param {{categoria_id: number, nombre: string, maestros_ids: number[]}} programa */
export async function crearPrograma(programa) {
  const { data } = await apiClient.post('/admin/programas', programa)
  return data
}

/** @param {{nombre: string, maestros_ids: number[]}} programa Reemplaza la lista completa de maestros. */
export async function actualizarPrograma(id, programa) {
  const { data } = await apiClient.put(`/admin/programas/${id}`, programa)
  return data
}

/** Fase 10: reemplaza la eliminación. Deshabilitado = oculto en /inscripcion, conserva su historial. */
export async function cambiarEstadoPrograma(id, activo) {
  const { data } = await apiClient.patch(`/admin/programas/${id}/estado`, { activo })
  return data
}

/** Fase 9: renombra la categoría. 400 si el nombre ya existe (sin distinguir mayúsculas). */
export async function actualizarCategoria(id, categoria) {
  const { data } = await apiClient.put(`/admin/categorias/${id}`, categoria)
  return data
}

/** Fase 9: 400 si la categoría tiene programas asociados. */
export async function eliminarCategoria(id) {
  await apiClient.delete(`/admin/categorias/${id}`)
}
