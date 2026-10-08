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
