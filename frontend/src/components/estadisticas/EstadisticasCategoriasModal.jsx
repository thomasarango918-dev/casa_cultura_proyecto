/**
 * Estadísticas de programas (Fase 7): columnas apiladas. Cada columna es una categoría cultural y se
 * divide en segmentos con los estudiantes APROBADOS de cada uno de sus programas.
 * Fuente: GET /admin/estadisticas/categorias (todas las categorías y todos sus programas, también en 0,
 * así que un programa o una categoría nuevos aparecen apenas se crean).
 */
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getEstadisticaCategorias } from '../../services/estadisticasService'
import { exportToCsv, fechaParaArchivo } from '../../utils/exportUtils'
import EstadisticaModal from './EstadisticaModal'
import { EJE, PALETA_PROGRAMAS, REJILLA, porcentaje } from './graficos'
import useEstadistica from './useEstadistica'

const STACK_ID = 'categoria'
const formatoNumero = new Intl.NumberFormat('es-CO')

const clavePrograma = (programaId) => `p${programaId}`
const colorPrograma = (indice) => PALETA_PROGRAMAS[indice % PALETA_PROGRAMAS.length]

/**
 * Etiqueta de LabelList que escribe el total de la columna encima del segmento superior.
 * Recharts no dibuja los segmentos en 0, así que el total se cuelga del último programa con aprobados.
 * Cada programa pertenece a una sola categoría: la columna se busca por la clave del programa
 * (el `index` de LabelList cuenta los rectángulos dibujados, no las filas de datos).
 */
function etiquetaTotal(columnas, clave) {
  const columna = columnas.find((item) => item._tope === clave)
  return function EtiquetaTotal({ x, y, width, value }) {
    if (!columna || !value) return null
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#152038" fontSize={12} fontWeight={600}>
        {formatoNumero.format(columna.total)}
      </text>
    )
  }
}

/** Tooltip de la columna: total de la categoría y el desglose de todos sus programas. */
function TooltipCategoria({ active, payload }) {
  if (!active || !payload?.length) return null
  const columna = payload[0].payload
  return (
    <div className="max-w-xs rounded-lg bg-white px-3 py-2 text-sm shadow-float ring-1 ring-slate-200">
      <p className="font-semibold text-pizarra-950">{columna.categoria}</p>
      <p className="tabular-nums text-slate-600">
        <span className="font-semibold text-pizarra-950">{formatoNumero.format(columna.total)}</span> estudiantes
        aprobados
      </p>
      <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        {columna.programas.map((programa, indice) => (
          <li key={programa.programa_id} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colorPrograma(indice) }} />
            <span className="flex-1 truncate text-pizarra-900">{programa.programa}</span>
            <span className="font-medium tabular-nums text-pizarra-950">{formatoNumero.format(programa.total)}</span>
          </li>
        ))}
        {columna.programas.length === 0 && <li className="text-slate-500">Sin programas registrados</li>}
      </ul>
    </div>
  )
}

export default function EstadisticasCategoriasModal({ isOpen, onClose }) {
  const { status, datos, errorMessage, recargar } = useEstadistica(getEstadisticaCategorias, isOpen)

  const total = datos.reduce((suma, item) => suma + item.total, 0)

  // Una fila por categoría con una clave por programa (p12: 3). `_tope` es la clave del último programa
  // con aprobados (el segmento superior de la pila), donde se escribe el total de la columna.
  const columnas = datos.map((categoria) => {
    const conValor = categoria.programas.filter((programa) => programa.total > 0)
    return {
      ...categoria,
      _tope: conValor.length ? clavePrograma(conValor[conValor.length - 1].programa_id) : null,
      ...Object.fromEntries(categoria.programas.map((programa) => [clavePrograma(programa.programa_id), programa.total])),
    }
  })
  // Un <Bar> por programa; cada programa solo tiene valor en la columna de su categoría.
  const segmentos = datos.flatMap((categoria) =>
    categoria.programas.map((programa, indice) => ({
      clave: clavePrograma(programa.programa_id),
      nombre: programa.programa,
      color: colorPrograma(indice),
    })),
  )

  // Tabla y CSV: una fila por programa; las categorías sin programas aparecen con una fila propia.
  const filas = datos.flatMap((categoria) => {
    const nombre = categoria.activa ? categoria.categoria : `${categoria.categoria} (inhabilitada)`
    if (categoria.programas.length === 0) {
      return [{ Categoría: nombre, Programa: 'Sin programas registrados', 'Estudiantes aprobados': 0, '% de la categoría': porcentaje(0, 0) }]
    }
    return categoria.programas.map((programa) => ({
      Categoría: nombre,
      Programa: programa.programa,
      'Estudiantes aprobados': programa.total,
      '% de la categoría': porcentaje(programa.total, categoria.total),
    }))
  })

  // Leyenda: solo las categorías con aprobados (las demás no dibujan segmentos).
  const conAprobados = datos.filter((categoria) => categoria.total > 0)

  return (
    <EstadisticaModal
      isOpen={isOpen}
      onClose={onClose}
      titulo="Estadísticas de demanda por categoría"
      descripcion="Estudiantes con solicitud aprobada en cada categoría cultural, divididos por programa."
      data={filas}
      onExport={() => exportToCsv(`estadisticas-categorias-programas-${fechaParaArchivo()}`, filas)}
      status={status}
      errorMessage={errorMessage}
      onRetry={recargar}
      vacio={total === 0}
      mensajeVacio="Aún no hay solicitudes aprobadas. La demanda por categoría y programa aparecerá cuando se aprueben inscripciones."
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={columnas} margin={{ top: 24, right: 8, bottom: 8, left: -12 }}>
            <CartesianGrid vertical={false} {...REJILLA} />
            <XAxis dataKey="categoria" interval={0} {...EJE} />
            <YAxis allowDecimals={false} {...EJE} axisLine={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={<TooltipCategoria />} />
            {segmentos.map((segmento) => (
              <Bar
                key={segmento.clave}
                dataKey={segmento.clave}
                name={segmento.nombre}
                stackId={STACK_ID}
                fill={segmento.color}
                stroke="#ffffff"
                strokeWidth={1}
                maxBarSize={56}
                isAnimationActive={false}
              >
                <LabelList dataKey={segmento.clave} content={etiquetaTotal(columnas, segmento.clave)} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda por categoría: el color de cada programa solo vale dentro de su columna. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {conAprobados.map((categoria) => (
          <div key={categoria.categoria_id ?? 'sin-categoria'}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{categoria.categoria}</p>
            <ul className="mt-1.5 space-y-1">
              {categoria.programas.map((programa, indice) => (
                <li key={programa.programa_id} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: colorPrograma(indice) }}
                  />
                  <span className="flex-1 truncate text-pizarra-900">{programa.programa}</span>
                  <span className="tabular-nums text-slate-600">{formatoNumero.format(programa.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </EstadisticaModal>
  )
}
