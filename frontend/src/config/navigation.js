/**
 * Configuración de la navegación: menú lateral, títulos de página y migas de pan.
 *
 * Para agregar una página nueva:
 *   1. Añadir el elemento en NAVIGATION con su ruta `to` (y quitar `disabled`).
 *   2. Registrar su título y migas de pan en ROUTE_META.
 *   3. Declarar la ruta en App.jsx dentro de MainLayout (con RoleRoute si es restringida).
 *
 * Visibilidad por rol (Fase 3). `roles` acepta claves de config/roles.js y se puede
 * poner en un grupo o en un elemento; un grupo sin elementos visibles no se muestra:
 *   Administrador  Todos los módulos.
 *   Coordinador    Todos excepto "Asistencia".
 *   Maestro        Gestión académica (Grupos y Asistencia) y Administración (solo Configuración).
 *   Estudiante     Asistencia y Configuración.
 * "Panel general" es la página de inicio de todos los roles.
 */
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Stamp,
  UserCog,
  UsersRound,
} from 'lucide-react'
import { ROL, ROLES_GESTION_USUARIOS, tieneRol } from './roles'

/**
 * Roles que gestionan solicitudes de inscripción. Debe coincidir con
 * ROLES_BACKOFFICE en backend/app/dependencies/solicitud_dependencies.py.
 */
export const BACKOFFICE_ROLES = ['Administrador', 'Coordinador']

/** Claves de rol de BACKOFFICE_ROLES (para las reglas de visibilidad del menú). */
const BACKOFFICE = [ROL.ADMINISTRADOR, ROL.COORDINADOR]

/**
 * Estructura del menú lateral. Los elementos con `disabled: true` corresponden a
 * módulos de fases posteriores: se muestran atenuados y aún no navegan.
 * `roles` limita un grupo o un elemento a ciertos roles (claves de config/roles.js).
 */
export const NAVIGATION = [
  {
    id: 'principal',
    label: 'Principal',
    items: [{ label: 'Panel general', to: '/dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'radicacion',
    label: 'Radicación',
    roles: BACKOFFICE,
    items: [
      { label: 'Solicitudes', to: '/dashboard/solicitudes', icon: Stamp },
      { label: 'Documentos', to: '/dashboard/documentos', icon: ClipboardCheck },
    ],
  },
  {
    id: 'academico',
    label: 'Gestión académica',
    items: [
      { label: 'Programas', icon: BookOpen, disabled: true, roles: BACKOFFICE },
      { label: 'Grupos', icon: UsersRound, disabled: true, roles: [...BACKOFFICE, ROL.MAESTRO] },
      { label: 'Asistencia', icon: CalendarCheck, disabled: true, roles: [ROL.ADMINISTRADOR, ROL.MAESTRO, ROL.ESTUDIANTE] },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    items: [
      { label: 'Usuarios y roles', to: '/dashboard/usuarios', icon: UserCog, roles: ROLES_GESTION_USUARIOS },
      { label: 'Configuración', to: '/dashboard/configuracion', icon: Settings },
    ],
  },
]

/** Título (pestaña del navegador) y migas de pan de cada ruta protegida. */
const ROUTE_META = {
  '/dashboard': {
    title: 'Panel general',
    breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }, { label: 'Panel general' }],
  },
  '/dashboard/solicitudes': {
    title: 'Solicitudes',
    breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }, { label: 'Radicación' }, { label: 'Solicitudes' }],
  },
  '/dashboard/documentos': {
    title: 'Documentos',
    breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }, { label: 'Radicación' }, { label: 'Documentos' }],
  },
  '/dashboard/usuarios': {
    title: 'Usuarios y roles',
    breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }, { label: 'Administración' }, { label: 'Usuarios y roles' }],
  },
  '/dashboard/configuracion': {
    title: 'Configuración',
    breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }, { label: 'Administración' }, { label: 'Configuración' }],
  },
}

/** Devuelve el título y las migas de pan de una ruta; si no está registrada, un valor neutro. */
export function getRouteMeta(pathname) {
  return ROUTE_META[pathname] ?? { title: '', breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }] }
}

/** Filtra los grupos y elementos del menú según el rol del usuario; omite los grupos que quedan vacíos. */
export function getNavigationForRole(role) {
  return NAVIGATION.filter((group) => tieneRol(role, group.roles))
    .map((group) => ({ ...group, items: group.items.filter((item) => tieneRol(role, item.roles)) }))
    .filter((group) => group.items.length > 0)
}
