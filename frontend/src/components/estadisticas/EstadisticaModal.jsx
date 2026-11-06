/**
 * Modal base de las estadísticas contextuales (Fase 7).
 *
 * Estructura: filtros opcionales -> gráfico (children) -> tabla HTML con los datos exactos (`data`)
 * -> "Exportar a CSV".
 * La tabla usa como columnas las claves del primer objeto de `data`, las mismas que exporta
 * exportToCsv, así que lo que se ve es exactamente lo que se descarga.
 *
 * @param {object} props
 * @param {boolean} props.isOpen Muestra u oculta el modal.
 * @param {() => void} props.onClose Cierra el modal.
 * @param {string} props.titulo Título (por ejemplo, "Estadísticas de ocupación").
 * @param {string} [props.descripcion] Subtítulo bajo el título.
 * @param {React.ReactNode} props.children Gráfico de Recharts.
 * @param {Record<string, string|number>[]} props.data Filas de la tabla (y del CSV).
 * @param {() => void} props.onExport Llama a exportToCsv.
 * @param {React.ReactNode} [props.filtros] Controles sobre el gráfico (por ejemplo, la lista de maestros).
 * @param {'idle'|'loading'|'ready'|'error'} [props.status] Estado de la consulta; 'idle' = falta elegir un filtro.
 * @param {string} [props.mensajeInicial] Indicación que se muestra mientras status es 'idle'.
 * @param {string} [props.errorMessage] Mensaje si status es 'error'.
 * @param {() => void} [props.onRetry] Reintenta la consulta.
 * @param {boolean} [props.vacio] No hay datos que graficar (por defecto, data vacío).
 * @param {string} [props.mensajeVacio] Explicación del estado vacío.
 */
import { BarChart3, Download, ListFilter, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

const TITLE_ID = 'estadistica-modal-titulo'

const formatoNumero = new Intl.NumberFormat('es-CO')

function TablaDatos({ data }) {
  const columnas = Object.keys(data[0])
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna}
                scope="col"
                className={`whitespace-nowrap px-4 py-2.5 text-xs font-medium text-slate-500 ${
                  typeof data[0][columna] === 'number' ? 'text-right' : 'text-left'
                }`}
              >
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((fila, indice) => (
            <tr key={indice}>
              {columnas.map((columna) => {
                const valor = fila[columna]
                const esNumero = typeof valor === 'number'
                return (
                  <td
                    key={columna}
                    className={`px-4 py-2.5 ${
                      esNumero ? 'text-right font-medium tabular-nums text-pizarra-950' : 'text-pizarra-900'
                    }`}
                  >
                    {esNumero ? formatoNumero.format(valor) : valor}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function EstadisticaModal({
  isOpen,
  onClose,
  titulo,
  descripcion,
  children,
  data = [],
  onExport,
  filtros,
  status = 'ready',
  mensajeInicial = 'Seleccione un filtro para ver las estadísticas.',
  errorMessage,
  onRetry,
  vacio,
  mensajeVacio = 'Todavía no hay datos para mostrar.',
}) {
  if (!isOpen) return null

  const sinDatos = vacio ?? data.length === 0
  const listo = status === 'ready' && !sinDatos

  return (
    <Modal
      titleId={TITLE_ID}
      onClose={onClose}
      size="xl"
      header={
        <>
          <h2 id={TITLE_ID} className="text-lg font-semibold text-pizarra-950">
            {titulo}
          </h2>
          {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button icon={Download} onClick={onExport} disabled={!listo}>
            Exportar a CSV
          </Button>
        </>
      }
    >
      <div className="space-y-6 px-5 py-5 sm:px-6">
        {filtros}

        {status === 'idle' && (
          <div className="py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-pizarra-50 text-pizarra-500">
              <ListFilter aria-hidden="true" className="size-6" />
            </span>
            <p className="mx-auto mt-4 max-w-sm text-sm text-slate-500">{mensajeInicial}</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="grid place-items-center py-16 text-sm text-slate-500" role="status">
            <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-pizarra-400" />
            <span className="mt-3">Cargando estadísticas…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600">
              <TriangleAlert aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar las estadísticas</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
            {onRetry && (
              <Button variant="secondary" icon={RefreshCw} onClick={onRetry} className="mt-5">
                Reintentar
              </Button>
            )}
          </div>
        )}

        {status === 'ready' && sinDatos && (
          <div className="py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <BarChart3 aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">Sin datos para graficar</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{mensajeVacio}</p>
          </div>
        )}

        {listo && (
          <>
            <figure aria-label={titulo}>{children}</figure>
            <section aria-label="Datos del gráfico">
              <h3 className="mb-2 text-sm font-semibold text-pizarra-950">Datos exactos</h3>
              <TablaDatos data={data} />
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}
