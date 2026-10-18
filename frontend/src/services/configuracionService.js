/**
 * Servicio de configuración:
 *   - Cuenta propia: endpoints /admin/configuracion/me (token; todos los roles).
 *   - Sistema: /admin/configuracion/sistema (token; solo Administrador).
 */
import apiClient from './apiClient'

export async function getMiPerfil() {
  const { data } = await apiClient.get('/admin/configuracion/me')
  return data
}

/** @param {{nombre_completo: string, email: string}} perfil */
export async function actualizarMiPerfil(perfil) {
  const { data } = await apiClient.put('/admin/configuracion/me', perfil)
  return data
}

/** @param {{password_nueva: string, password_confirmacion: string}} cambio */
export async function cambiarMiPassword(cambio) {
  await apiClient.put('/admin/configuracion/me/password', cambio)
}

/* ---- Configuración del sistema (solo Administrador) ---- */

/** @returns {Promise<{inscripciones_abiertas: boolean, periodo_academico: string}>} */
export async function getConfiguracionSistema() {
  const { data } = await apiClient.get('/admin/configuracion/sistema')
  return data
}

/** @param {{inscripciones_abiertas: boolean, periodo_academico: string}} configuracion */
export async function actualizarConfiguracionSistema(configuracion) {
  const { data } = await apiClient.put('/admin/configuracion/sistema', configuracion)
  return data
}
