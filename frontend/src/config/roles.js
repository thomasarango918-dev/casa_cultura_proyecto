/**
 * Roles del sistema y control de acceso por rol (RBAC) del frontend.
 *
 * En TBL_Roles el rol docente se llama "Profesor" y en pantalla se muestra como
 * "Maestro". Para no depender del texto exacto, cada nombre se traduce a una
 * clave canónica. Debe coincidir con backend/app/config/roles.py.
 *
 * La verificación real siempre la hace la API (403); estas reglas solo deciden
 * qué se muestra y evitan peticiones que el servidor rechazaría.
 */

export const ROL = Object.freeze({
  ADMINISTRADOR: 'ADMINISTRADOR',
  COORDINADOR: 'COORDINADOR',
  MAESTRO: 'MAESTRO',
  ESTUDIANTE: 'ESTUDIANTE',
})

/** Nombres aceptados en TBL_Roles (en minúsculas) para cada clave. */
const ALIAS = {
  administrador: ROL.ADMINISTRADOR,
  coordinador: ROL.COORDINADOR,
  profesor: ROL.MAESTRO,
  maestro: ROL.MAESTRO,
  docente: ROL.MAESTRO,
  estudiante: ROL.ESTUDIANTE,
}

const ETIQUETAS = {
  [ROL.ADMINISTRADOR]: 'Administrador',
  [ROL.COORDINADOR]: 'Coordinador',
  [ROL.MAESTRO]: 'Maestro',
  [ROL.ESTUDIANTE]: 'Estudiante',
}

/** Todos los roles conocidos. */
export const TODOS_LOS_ROLES = Object.values(ROL)

/** Roles que entran al módulo de usuarios (ROLES_GESTION_USUARIOS en el backend). */
export const ROLES_GESTION_USUARIOS = [ROL.ADMINISTRADOR, ROL.COORDINADOR]

/** Fase 5: roles que administran categorías y programas (ROLES_GESTION_PROGRAMAS en el backend). */
export const ROLES_GESTION_PROGRAMAS = [ROL.ADMINISTRADOR, ROL.COORDINADOR]

/** Fase 6: roles que ven el módulo de grupos (ROLES_GRUPOS en el backend). */
export const ROLES_GRUPOS = [ROL.ADMINISTRADOR, ROL.COORDINADOR, ROL.MAESTRO]

/** Roles que crean, editan y asignan en grupos; el Coordinador solo consulta. */
export const ROLES_GESTION_GRUPOS = [ROL.ADMINISTRADOR, ROL.MAESTRO]

/** 'Profesor' -> 'MAESTRO'. Devuelve null si el rol no es uno de los cuatro conocidos. */
export function claveRol(nombre) {
  return ALIAS[String(nombre ?? '').trim().toLowerCase()] ?? null
}

/** Nombre del rol para mostrar: 'Profesor' -> 'Maestro'. */
export function etiquetaRol(nombre) {
  const clave = claveRol(nombre)
  return clave ? ETIQUETAS[clave] : (nombre ?? '')
}

/**
 * Indica si un nombre de rol (tal como llega de la API) pertenece a una lista de claves.
 * @param {string} nombre Rol del usuario, por ejemplo user.rol.
 * @param {string[]} [claves] Claves permitidas; sin lista, cualquier rol está permitido.
 */
export function tieneRol(nombre, claves) {
  if (!claves) return true
  const clave = claveRol(nombre)
  return clave !== null && claves.includes(clave)
}

/** Colores de la etiqueta de cada rol en la tabla de usuarios. */
export const ROL_BADGE = {
  [ROL.ADMINISTRADOR]: 'bg-pizarra-900 text-white ring-pizarra-900',
  [ROL.COORDINADOR]: 'bg-pizarra-50 text-pizarra-800 ring-pizarra-200',
  [ROL.MAESTRO]: 'bg-pradera-50 text-pradera-700 ring-pradera-200/70',
  [ROL.ESTUDIANTE]: 'bg-amber-50 text-amber-800 ring-amber-200/80',
}
