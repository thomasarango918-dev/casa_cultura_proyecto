/**
 * Piezas compartidas por los gráficos de Recharts de la Fase 7: colores, ejes y tooltip.
 * Los textos usan la tinta de la interfaz (pizarra/slate), nunca el color de la serie.
 */

/** Color de las barras (una sola serie): pizarra-700. */
export const COLOR_BARRA = '#33415d'

/**
 * Colores de los segmentos de las columnas apiladas (programas de una categoría), en orden fijo.
 * Paleta categórica validada (contraste y daltonismo). Cada programa toma el color de su posición
 * dentro de su categoría (orden alfabético), así que el color se repite entre columnas distintas:
 * la identidad la dan la leyenda por categoría, el tooltip y la tabla.
 */
export const PALETA_PROGRAMAS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']

/** Estados de solicitud en el orden de la API. Colores validados (contraste y daltonismo) con leyenda y tabla. */
export const ESTADOS_SOLICITUD = {
  APROBADO: { etiqueta: 'Aprobado', color: '#059669' },
  PENDIENTE: { etiqueta: 'Pendiente', color: '#d97706' },
  RECHAZADO: { etiqueta: 'Rechazado', color: '#e11d48' },
}

/** Estilo de los ejes: recesivos, texto slate-500 de 12px. */
export const EJE = {
  tick: { fill: '#64748b', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: '#e2e8f0' },
}

/** Rejilla tenue (slate-100). */
export const REJILLA = { stroke: '#f1f5f9' }

const formatoNumero = new Intl.NumberFormat('es-CO')

/** Porcentaje con un decimal ("60,0 %"); 0 si el total es 0. */
export function porcentaje(valor, total) {
  const pct = total > 0 ? (valor / total) * 100 : 0
  return `${pct.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

/**
 * Tooltip de Recharts con el estilo de las tarjetas del sistema.
 * @param {string} unidad Texto después de la cifra ("estudiantes").
 * @param {(item: object) => string} [titulo] Título a partir del dato; por defecto, la etiqueta del eje.
 * @param {(item: object) => string} [detalle] Línea secundaria opcional (por ejemplo, el programa).
 */
export function TooltipGrafico({ active, payload, label, unidad, titulo, detalle }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  const valor = payload[0].value
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-float ring-1 ring-slate-200">
      <p className="font-semibold text-pizarra-950">{titulo ? titulo(item) : label}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle(item)}</p>}
      <p className="mt-1 tabular-nums text-slate-600">
        <span className="font-semibold text-pizarra-950">{formatoNumero.format(valor)}</span> {unidad}
      </p>
    </div>
  )
}
