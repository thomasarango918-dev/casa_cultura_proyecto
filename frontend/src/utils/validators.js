/**
 * Validaciones de formularios de cuentas de usuario (Fase 3).
 *
 * Replican las del backend (backend/app/schemas/usuario_schema.py) para avisar
 * antes de enviar; la API siempre vuelve a validar.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const PASSWORD_MIN = 8
const PASSWORD_MAX_BYTES = 72

/** Reglas de la contraseña, para mostrarlas como lista de verificación. */
export const PASSWORD_REGLAS = [
  { id: 'longitud', label: `Al menos ${PASSWORD_MIN} caracteres`, test: (value) => value.length >= PASSWORD_MIN },
  { id: 'letra', label: 'Al menos una letra', test: (value) => /\p{L}/u.test(value) },
  { id: 'numero', label: 'Al menos un número', test: (value) => /\d/.test(value) },
]

/** Elimina puntos, guiones y espacios del documento y lo pasa a mayúsculas (mismo criterio que la API). */
export function normalizarDocumento(value) {
  return String(value ?? '').replace(/[\s.-]/g, '').toUpperCase()
}

/** Quita espacios sobrantes: '  ana   maría ' -> 'ana maría'. */
export function limpiarEspacios(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function validarNombre(value) {
  const nombre = limpiarEspacios(value)
  if (!nombre) return 'Escriba el nombre completo.'
  if (nombre.length < 3) return 'El nombre debe tener al menos 3 caracteres.'
  if (nombre.length > 100) return 'El nombre no puede superar 100 caracteres.'
  return ''
}

export function validarCorreo(value) {
  const correo = String(value ?? '').trim()
  if (!correo) return 'Escriba el correo electrónico.'
  if (correo.length > 150 || !EMAIL_PATTERN.test(correo)) return 'El correo electrónico no tiene un formato válido.'
  return ''
}

export function validarDocumento(value) {
  const documento = normalizarDocumento(value)
  if (!documento) return 'Escriba el número de documento.'
  if (!/^[\p{L}\p{N}]+$/u.test(documento)) return 'El número de documento solo puede contener letras y números.'
  if (documento.length < 3 || documento.length > 20) return 'El número de documento debe tener entre 3 y 20 caracteres.'
  return ''
}

export function validarPassword(value) {
  const password = String(value ?? '')
  if (!password) return 'Escriba la contraseña.'
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return 'La contraseña es demasiado larga (máximo 72 caracteres).'
  }
  if (password !== password.trim()) return 'La contraseña no puede empezar ni terminar con espacios.'
  const fallida = PASSWORD_REGLAS.find((regla) => !regla.test(password))
  if (fallida) return `La contraseña debe tener: ${fallida.label.toLowerCase()}.`
  return ''
}
