/**
 * Etiqueta de color con el estado de una solicitud (PENDIENTE, APROBADO, RECHAZADO).
 * Sigue el estilo de las etiquetas "Disponible / En preparación" del panel general.
 */

/** Texto y colores de cada estado. Se reutiliza en filtros y en el panel general. */
export const ESTADOS = {
  PENDIENTE: {
    label: 'Pendiente',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/80',
    dot: 'bg-amber-400',
  },
  APROBADO: {
    label: 'Aprobada',
    badge: 'bg-pradera-50 text-pradera-700 ring-pradera-200/70',
    dot: 'bg-pradera-500',
  },
  RECHAZADO: {
    label: 'Rechazada',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200/80',
    dot: 'bg-rose-500',
  },
}

export default function EstadoBadge({ estado, className = '' }) {
  const config = ESTADOS[estado] ?? { label: estado, badge: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-300' }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${config.badge} ${className}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
