/**
 * Indicador del estado de la red en el encabezado (Fase 8).
 *
 *   Online:  círculo verde + "Online".
 *   Offline: círculo rojo + "Offline".
 *
 * Si hay asistencias guardadas sin conexión pendientes de sincronizar, se indica su cantidad
 * en el texto de ayuda (y en la etiqueta accesible).
 *
 * @param {object} props
 * @param {boolean} props.online Estado actual de la red (useOnlineStatus).
 * @param {number} [props.pendientes] Asistencias en la cola local.
 */
export default function NetworkStatus({ online, pendientes = 0 }) {
  const detalle =
    pendientes > 0
      ? ` · ${pendientes} asistencia${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de sincronizar`
      : ''
  const ayuda = online
    ? `Conectado a internet${detalle}`
    : `Sin conexión: solo se puede tomar asistencia (se guarda en este equipo)${detalle}`

  return (
    <span
      role="status"
      aria-live="polite"
      title={ayuda}
      aria-label={ayuda}
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 ring-inset ${
        online ? 'bg-pradera-50 text-pradera-800 ring-pradera-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
      }`}
    >
      <span aria-hidden="true" className="relative flex size-2.5">
        {!online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />}
        <span className={`relative inline-flex size-2.5 rounded-full ${online ? 'bg-pradera-500' : 'bg-rose-500'}`} />
      </span>
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
