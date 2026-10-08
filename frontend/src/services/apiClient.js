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
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
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
  // Sin respuesta: la API está apagada, la URL es incorrecta o no hay internet.
  if (!error?.response) {
    return 'No fue posible conectar con el servidor. Verifique su conexión a internet o que la API esté en ejecución.'
  }

  const { status, data } = error.response
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail
  if (status >= 500) return 'El servidor presentó un error. Intente nuevamente en unos minutos.'
  return fallback
}

export default apiClient
