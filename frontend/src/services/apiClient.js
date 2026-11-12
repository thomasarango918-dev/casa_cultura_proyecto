/**
 * Cliente HTTP compartido (Axios) para comunicarse con la API de FastAPI.
 *
 * Responsabilidades:
 *   - Fijar la URL base de la API (variable VITE_API_URL del archivo .env).
 *   - Adjuntar el token JWT a cada petición (interceptor de petición).
 *   - Avisar a la aplicación cuando la API rechaza el token (interceptor de respuesta).
 *   - Traducir los errores técnicos a mensajes claros para el usuario.
 */
import axios from 'axios'
import { getAccessToken } from './sessionStore'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

/** Evento global que se emite cuando la API rechaza el token (401). Lo escucha AuthContext. */
export const SESSION_EXPIRED_EVENT = 'casacultura:session-expired'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000, // 15 segundos antes de considerar que el servidor no responde.
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

/*
 * Interceptor de petición: agrega "Authorization: Bearer <token>" si hay sesión.
 * La opción propia `skipAuth: true` lo omite (se usa en el login, que aún no tiene token).
 */
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/*
 * Interceptor de respuesta: ante un 401 emite SESSION_EXPIRED_EVENT para que la
 * aplicación cierre la sesión y vuelva al login. La opción `skipAuthRedirect: true`
 * lo evita en peticiones donde un 401 es una respuesta esperada (credenciales erradas).
 *
 * Fase 8 (PWA): la sesión se cierra SOLO si el servidor respondió estrictamente 401.
 * Un "Network Error", un timeout (ECONNABORTED), una petición cancelada o cualquier otro
 * código NO borran el token: sin conexión el usuario sigue trabajando (asistencias offline).
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response ? error.response.status : null
    if (status === 401 && !error.config?.skipAuthRedirect) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

/**
 * Traduce cualquier error de Axios a un mensaje claro para el usuario.
 *
 * Prioridad: mensaje `detail` enviado por la API > mensaje según el tipo de fallo > texto por defecto.
 *
 * @param {unknown} error Error capturado en un bloque catch.
 * @param {string} [fallback] Mensaje a usar si no hay uno más específico.
 * @returns {string}
 */
export function getApiErrorMessage(error, fallback = 'No fue posible completar la solicitud.') {
  if (axios.isCancel(error)) return 'La solicitud fue cancelada.'
  if (error?.code === 'ECONNABORTED') {
    return 'El servidor tardó demasiado en responder. Intente de nuevo.'
  }
  // Fase 8: el navegador reporta que no hay red (modo offline de la PWA).
  if (!error?.response && isOffline()) {
    return 'Sin conexión a internet. Esta acción requiere conexión; intente de nuevo cuando vuelva la red.'
  }
  // Sin respuesta: la API está apagada, la URL es incorrecta o no hay internet.
  if (!error?.response) {
    return 'No fue posible conectar con el servidor. Verifique su conexión a internet o que la API esté en ejecución.'
  }

  const { status, data } = error.response
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail
  if (status >= 500) return 'El servidor presentó un error. Intente nuevamente en unos minutos.'
  return fallback
}

/** Indica si el navegador reporta que no hay conexión de red (`navigator.onLine === false`). */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Indica si el error es de red: la petición no obtuvo respuesta (sin internet, API apagada o
 * timeout). Una respuesta HTTP (400, 401, 500...) NO es un error de red.
 */
export function isNetworkError(error) {
  return Boolean(error) && !axios.isCancel(error) && !error.response
}

export default apiClient

/**
 * Extrae los errores por campo de una respuesta 422 (formato `{detail, errores: [{campo, mensaje}]}`).
 * Quita el prefijo técnico "Value error, " que Pydantic agrega a los mensajes propios.
 *
 * @param {unknown} error Error capturado en un bloque catch.
 * @returns {Record<string, string>} Mensaje por nombre de campo (vacío si no hay errores por campo).
 */
export function getApiFieldErrors(error) {
  const fieldErrors = {}
  for (const item of error?.response?.data?.errores ?? []) {
    const field = item.campo?.split('.').pop()
    if (field && !fieldErrors[field]) fieldErrors[field] = String(item.mensaje ?? '').replace(/^Value error,\s*/i, '')
  }
  return fieldErrors
}
