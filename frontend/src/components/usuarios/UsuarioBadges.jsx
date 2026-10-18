/**
 * Etiquetas de la tabla de usuarios: rol (con el nombre para mostrar, "Profesor" -> "Maestro")
 * y estado de la cuenta (Activo / Inactivo). Siguen el estilo de EstadoBadge.
 */
import { ROL_BADGE, claveRol, etiquetaRol } from '../../config/roles'

export function RolBadge({ rol, className = '' }) {
  const colores = ROL_BADGE[claveRol(rol)] ?? 'bg-slate-50 text-slate-600 ring-slate-200'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${colores} ${className}`}>
      {etiquetaRol(rol)}
    </span>
  )
}

export function UsuarioEstadoBadge({ activo, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        activo ? 'bg-pradera-50 text-pradera-700 ring-pradera-200/70' : 'bg-slate-100 text-slate-500 ring-slate-200'
      } ${className}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${activo ? 'bg-pradera-500' : 'bg-slate-400'}`} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}
