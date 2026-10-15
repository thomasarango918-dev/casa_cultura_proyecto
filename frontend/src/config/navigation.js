/**
 * Configuración de la navegación: menú lateral, títulos de página y migas de pan.
 *
 * Para agregar una página nueva:
 *   1. Añadir el elemento en NAVIGATION con su ruta `to` (y quitar `disabled`).
 *   2. Registrar su título y migas de pan en ROUTE_META.
 *   3. Declarar la ruta en App.jsx dentro de MainLayout.
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

/**
 * Roles que gestionan solicitudes de inscripción. Debe coincidir con
 * ROLES_BACKOFFICE en backend/app/dependencies/solicitud_dependencies.py.
 */
export const BACKOFFICE_ROLES = ['Administrador', 'Coordinador']

/**
 * Estructura del menú lateral. Los elementos con `disabled: true` corresponden a
 * módulos de fases posteriores: se muestran atenuados y aún no navegan.
 * `roles` limita un grupo a ciertos roles (nombre tal como está en TBL_Roles).
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
    roles: BACKOFFICE_ROLES,
    items: [
      { label: 'Solicitudes', to: '/dashboard/solicitudes', icon: Stamp },
      { label: 'Documentos', to: '/dashboard/documentos', icon: ClipboardCheck },
    ],
  },
  {
    id: 'academico',
    label: 'Gestión académica',
    items: [
      { label: 'Programas', icon: BookOpen, disabled: true },
      { label: 'Grupos', icon: UsersRound, disabled: true },
      { label: 'Asistencia', icon: CalendarCheck, disabled: true },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    roles: ['Administrador'],
    items: [
      { label: 'Usuarios y roles', icon: UserCog, disabled: true },
      { label: 'Configuración', icon: Settings, disabled: true },
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
}

/** Devuelve el título y las migas de pan de una ruta; si no está registrada, un valor neutro. */
export function getRouteMeta(pathname) {
  return ROUTE_META[pathname] ?? { title: '', breadcrumbs: [{ label: 'Inicio', to: '/dashboard' }] }
}

/** Filtra los grupos del menú según el rol del usuario. */
export function getNavigationForRole(role) {
  return NAVIGATION.filter((group) => !group.roles || group.roles.includes(role))
}
