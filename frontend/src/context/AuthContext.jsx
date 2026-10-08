/**
 * Contexto de autenticación: estado global de la sesión del usuario.
 *
 * Estados posibles (`status`):
 *   'checking'       Hay un token guardado y se está validando contra la API.
 *   'authenticated'  Sesión activa; `user` contiene los datos del usuario.
 *   'anonymous'      Sin sesión; las rutas protegidas redirigen al login.
 *
 * Uso desde cualquier componente:
 *   const { user, isAuthenticated, login, logout } = useAuth()
 *
 * La sesión se cierra automáticamente cuando:
 *   - El token llega a su fecha de vencimiento (temporizador local).
 *   - La API responde 401 a cualquier petición (evento SESSION_EXPIRED_EVENT).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCurrentUser, loginRequest } from '../services/authService'
import { SESSION_EXPIRED_EVENT } from '../services/apiClient'
import {
  clearSession,
  getTokenExpiry,
  isTokenExpired,
  readSession,
  saveSession,
  updateSessionUser,
} from '../services/sessionStore'
import { useToast } from './ToastContext'

const AuthContext = createContext(null)

/** Máximo admitido por setTimeout (~24,8 días). */
const MAX_TIMEOUT_MS = 2_147_483_647

/** Calcula el estado inicial a partir de la sesión guardada en el navegador. */
function getInitialState() {
  const stored = readSession()
  if (!stored?.accessToken || isTokenExpired(stored.accessToken)) {
    clearSession()
    return { status: 'anonymous', user: null }
  }
  // Hay un token vigente: se valida contra la API antes de mostrar el sistema.
  return { status: 'checking', user: stored.user ?? null }
}

export function AuthProvider({ children }) {
  const toast = useToast()
  const [state, setState] = useState(getInitialState)

  // Copia del estado actual accesible desde callbacks sin volver a crearlos en cada render.
  const statusRef = useRef(state.status)

  useEffect(() => {
    statusRef.current = state.status
  }, [state.status])

  /** Cierre de sesión iniciado por el usuario. */
  const logout = useCallback(() => {
    clearSession()
    setState({ status: 'anonymous', user: null })
  }, [])

  /** Cierre de sesión forzado (token vencido o rechazado). Avisa solo si había una sesión activa. */
  const expireSession = useCallback(() => {
    const wasAuthenticated = statusRef.current === 'authenticated'
    clearSession()
    setState({ status: 'anonymous', user: null })
    if (wasAuthenticated) {
      toast.warning('Su sesión expiró', 'Por seguridad, inicie sesión nuevamente para continuar.')
    }
  }, [toast])

  /**
   * Autentica contra la API y guarda la sesión.
   * Si las credenciales son incorrectas, el error se propaga para que LoginPage lo muestre.
   *
   * @param {string} identificador Correo electrónico o número de documento.
   * @param {string} password Contraseña.
   * @param {boolean} remember Mantener la sesión al cerrar el navegador.
   * @returns {Promise<object>} Usuario autenticado.
   */
  const login = useCallback(async (identificador, password, remember) => {
    const data = await loginRequest({ identificador, password })
    saveSession(
      {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
        user: data.usuario,
      },
      remember,
    )
    setState({ status: 'authenticated', user: data.usuario })
    return data.usuario
  }, [])

  // Valida el token guardado al recargar la aplicación.
  useEffect(() => {
    if (state.status !== 'checking') return undefined
    // Evita actualizar el estado si el componente se desmonta antes de que responda la API.
    let cancelled = false

    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return
        updateSessionUser(user)
        setState({ status: 'authenticated', user })
      })
      .catch((error) => {
        if (cancelled) return
        const status = error.response?.status
        if (status === 401 || status === 403) {
          // Token rechazado o cuenta inactiva: se descarta la sesión.
          clearSession()
          setState({ status: 'anonymous', user: null })
        } else {
          // Sin conexión con la API: se conserva la sesión local mientras el token siga vigente.
          setState((current) => ({ status: 'authenticated', user: current.user }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [state.status])

  // Cierra la sesión cuando la API rechaza el token (lo notifica apiClient.js).
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession)
  }, [expireSession])

  // Cierra la sesión exactamente cuando vence el token.
  useEffect(() => {
    if (state.status !== 'authenticated') return undefined
    const expiresAt = getTokenExpiry(readSession()?.accessToken)
    if (!expiresAt) return undefined
    const timer = setTimeout(expireSession, Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMEOUT_MS))
    return () => clearTimeout(timer)
  }, [state.status, expireSession])

  // Valor público del contexto, memorizado para evitar renders innecesarios.
  const value = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      isAuthenticated: state.status === 'authenticated',
      login,
      logout,
    }),
    [state, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Hook de acceso a la sesión. Debe usarse dentro de <AuthProvider>. */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  return context
}
