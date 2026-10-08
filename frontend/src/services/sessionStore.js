/**
 * Persistencia de la sesión en el navegador.
 *
 * Se guarda un objeto { accessToken, expiresAt, user } bajo una sola clave:
 *   - Con "Mantener la sesión iniciada": localStorage (sobrevive al cerrar el navegador).
 *   - Sin esa opción: sessionStorage (la sesión termina al cerrar la pestaña).
 *
 * Todos los accesos al almacenamiento van dentro de try/catch porque el navegador
 * puede bloquearlo (modo privado, políticas de la organización). En ese caso la
 * aplicación sigue funcionando y la sesión vive solo en memoria.
 */
const SESSION_KEY = 'casacultura.session'

/** Margen de seguridad: el token se considera vencido 30 segundos antes de su expiración real. */
const EXPIRY_MARGIN_MS = 30_000

/** Devuelve los almacenamientos disponibles (local y de sesión), omitiendo los bloqueados. */
function safeStorages() {
  const stores = []
  try {
    stores.push(window.localStorage)
  } catch {
    /* almacenamiento bloqueado por el navegador */
  }
  try {
    stores.push(window.sessionStorage)
  } catch {
    /* almacenamiento bloqueado por el navegador */
  }
  return stores
}

/**
 * Lee la sesión guardada.
 * @returns {{accessToken: string, expiresAt: number, user: object} | null}
 */
export function readSession() {
  for (const store of safeStorages()) {
    try {
      const raw = store.getItem(SESSION_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* valor corrupto: se ignora */
    }
  }
  return null
}

/**
 * Guarda la sesión después de un login exitoso.
 * @param {object} session Datos de la sesión (token, vencimiento y usuario).
 * @param {boolean} remember true = localStorage; false = sessionStorage.
 */
export function saveSession(session, remember) {
  // Se borra cualquier sesión previa para no dejar copias en ambos almacenamientos.
  clearSession()
  try {
    const store = remember ? window.localStorage : window.sessionStorage
    store.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    /* sin almacenamiento disponible: la sesión vive solo en memoria */
  }
}

/** Actualiza solo los datos del usuario, conservando el token (se usa tras consultar /auth/me). */
export function updateSessionUser(user) {
  for (const store of safeStorages()) {
    try {
      const raw = store.getItem(SESSION_KEY)
      if (raw) store.setItem(SESSION_KEY, JSON.stringify({ ...JSON.parse(raw), user }))
    } catch {
      /* se ignora */
    }
  }
}

/** Elimina la sesión de ambos almacenamientos (cierre de sesión o token vencido). */
export function clearSession() {
  for (const store of safeStorages()) {
    try {
      store.removeItem(SESSION_KEY)
    } catch {
      /* se ignora */
    }
  }
}

/** Devuelve el token JWT guardado o null si no hay sesión. */
export function getAccessToken() {
  return readSession()?.accessToken ?? null
}

/**
 * Lee el contenido (payload) de un JWT sin verificar la firma.
 * La verificación real la hace siempre el backend; aquí solo se consulta la fecha de vencimiento.
 */
function decodeJwtPayload(token) {
  try {
    // El JWT usa Base64URL: se convierte a Base64 estándar y se completa el relleno "=".
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

/** Devuelve el momento de vencimiento del token en milisegundos, o null si no se puede leer. */
export function getTokenExpiry(token) {
  const payload = token ? decodeJwtPayload(token) : null
  // El claim "exp" viene en segundos; JavaScript trabaja en milisegundos.
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null
}

/** Indica si el token ya venció (o vence en los próximos 30 segundos). */
export function isTokenExpired(token) {
  const expiresAt = getTokenExpiry(token)
  return expiresAt === null || Date.now() >= expiresAt - EXPIRY_MARGIN_MS
}
