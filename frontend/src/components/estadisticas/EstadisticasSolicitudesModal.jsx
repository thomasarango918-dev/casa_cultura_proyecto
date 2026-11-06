/**
 * Estadísticas del panel general (Fase 7): dona de solicitudes por estado.
 * Verde = Aprobado, Ámbar = Pendiente, Rojo = Rechazado. Fuente: GET /admin/estadisticas/solicitudes.
 */
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getEstadisticaSolicitudes } from '../../services/estadisticasService'
import { exportToCsv, fechaParaArchivo } from '../../utils/exportUtils'
import EstadisticaModal from './EstadisticaModal'
import { ESTADOS_SOLICITUD, TooltipGrafico, porcentaje } from './graficos'
import useEstadistica from './useEstadistica'

const formatoNumero = new Intl.NumberFormat('es-CO')

export default function EstadisticasSolicitudesModal({ isOpen, onClose }) {
  const { status, datos, errorMessage, recargar } = useEstadistica(getEstadisticaSolicitudes, isOpen)

  const total = datos.reduce((suma, item) => suma + item.total, 0)
  const segmentos = datos.map((item) => ({ ...item, ...ESTADOS_SOLICITUD[item.estado] }))
  // Los estados en 0 no dibujan sector, pero siguen en la leyenda y en la tabla.
  const sectores = segmentos.filter((item) => item.total > 0)
  const filas = segmentos.map((item) => ({
    Estado: item.etiqueta,
    Solicitudes: item.total,
    Porcentaje: porcentaje(item.total, total),
  }))

  return (
    <EstadisticaModal
      isOpen={isOpen}
      onClose={onClose}
      titulo="Estadísticas de solicitudes"
      descripcion="Solicitudes de inscripción radicadas, agrupadas por estado."
      data={filas}
      onExport={() => exportToCsv(`estadisticas-solicitudes-${fechaParaArchivo()}`, filas)}
      status={status}
      errorMessage={errorMessage}
      onRetry={recargar}
      vacio={total === 0}
      mensajeVacio="Cuando se radiquen solicitudes desde el formulario público, aquí verá cuántas están aprobadas, pendientes y rechazadas."
    >
      <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sectores}
                dataKey="total"
                nameKey="etiqueta"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={sectores.length > 1 ? 2 : 0}
                stroke="#ffffff"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {sectores.map((item) => (
                  <Cell key={item.estado} fill={item.color} />
                ))}
              </Pie>
              <Tooltip
                content={<TooltipGrafico unidad="solicitudes" titulo={(item) => item.etiqueta} />}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Total en el centro de la dona. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-pizarra-950">
                {formatoNumero.format(total)}
              </p>
              <p className="text-xs text-slate-500">solicitudes</p>
            </div>
          </div>
        </div>

        {/* Leyenda con cifra y porcentaje: la identidad nunca depende solo del color. */}
        <ul className="space-y-3 sm:min-w-52">
          {segmentos.map((item) => (
            <li key={item.estado} className="flex items-center gap-3 text-sm">
              <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="flex-1 text-pizarra-900">{item.etiqueta}</span>
              <span className="font-semibold tabular-nums text-pizarra-950">{formatoNumero.format(item.total)}</span>
              <span className="w-16 text-right tabular-nums text-slate-500">{porcentaje(item.total, total)}</span>
            </li>
          ))}
        </ul>
      </div>
    </EstadisticaModal>
  )
}
