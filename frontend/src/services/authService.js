/**
 * Servicio de autenticación del frontend: llamadas a los endpoints /auth de la API.
 *
 * Los componentes no usan Axios directamente; llaman a estas funciones, lo que
 * mantiene en un solo lugar las rutas y opciones de cada endpoint.
 */
import apiClient from './apiClient'

/**
 * Inicia sesión con correo electrónico o número de documento.
 *
 * Usa `skipAuth` (aún no hay token) y `skipAuthRedirect` (un 401 aquí significa
 * credenciales incorrectas, no una sesión vencida).
 *
 * @param {{identificador: string, password: string}} credenciales
 * @returns {Promise<{access_token: string, token_type: string, expires_in: number, usuario: object}>}
 */
export async function loginRequest({ identificador, password }) {
  const { data } = await apiClient.post(
    '/auth/login',
    { identificador, password },
    { skipAuth: true, skipAuthRedirect: true },
  )
  return data
}

/**
 * Devuelve el usuario dueño del token vigente.
 * Se usa al recargar la página para confirmar que la sesión guardada sigue siendo válida.
 */
export async function fetchCurrentUser() {
  const { data } = await apiClient.get('/auth/me', { skipAuthRedirect: true })
  return data
}
