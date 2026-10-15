/**
 * Funciones de formato para textos y fechas que se muestran en la interfaz.
 * Son funciones puras: no dependen de React ni del estado de la aplicación.
 */

/**
 * Iniciales para el avatar: primera letra del primer y del último nombre.
 * Ejemplo: "María Fernanda Restrepo Gómez" -> "MG".
 */
export function getInitials(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return `${first}${last}`.toUpperCase()
}

/** Primer nombre, para saludos. Ejemplo: "María Fernanda Restrepo" -> "María". */
export function getFirstName(fullName = '') {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

/** Saludo según la hora local: mañana (antes de 12), tarde (antes de 19) o noche. */
export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * Fecha larga en español de Colombia con la primera letra en mayúscula.
 * Ejemplo: "Jueves, 8 de octubre de 2026".
 */
export function formatLongDate(date = new Date()) {
  const text = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Fecha y hora corta en español de Colombia. Ejemplo: "14 oct 2026, 8:15 p. m.".
 * Acepta un Date o el texto ISO que devuelve la API.
 */
export function formatDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/** Fecha corta sin hora. Ejemplo: "14 oct 2026". */
export function formatShortDate(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date)
}

/**
 * Fecha de calendario sin hora (por ejemplo, la fecha de nacimiento "2012-03-01").
 * Se arma con año, mes y día locales: new Date("2012-03-01") se interpreta en UTC
 * y en Colombia mostraría el día anterior. Ejemplo: "1 mar 2012".
 */
export function formatBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return ''
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date)
}

/** Tamaño de archivo legible. Ejemplo: 1536000 -> "1,5 MB". */
export function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let size = bytes / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`
}
