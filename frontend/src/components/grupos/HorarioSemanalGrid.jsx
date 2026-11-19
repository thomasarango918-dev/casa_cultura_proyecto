/**
 * Grilla semanal de clases con CSS Grid (extraída de HorarioSemanalModal en la Fase 9).
 *
 *   Columnas: Lunes a Domingo.  Filas: franjas de 30 min (cada hora ocupa 2 filas).
 *
 * Si dos bloques se cruzan en el mismo día se dibujan uno al lado del otro.
 *
 * @param {object} props
 * @param {object[]} props.grupos Grupos con `horarios` y `programa_nombre`.
 * @param {number} [props.diaHoy] Día ISO resaltado; por defecto el del navegador.
 * @param {boolean} [props.ajustarRango] true: solo las horas que usan los bloques; false: 08:00 a 22:00.
 */
import { useMemo } from 'react'
import { DIAS_SEMANA, HORA_FIN_DIA, HORA_INICIO_DIA, aMinutos, hhmm } from '../../utils/horarios'

const MINUTOS_FILA = 30

// Un color por grupo (clases completas para que Tailwind las genere).
const COLORES = [
  'bg-pizarra-100 text-pizarra-900 ring-pizarra-300 border-l-pizarra-600',
  'bg-pradera-100 text-pradera-900 ring-pradera-300 border-l-pradera-600',
  'bg-amber-100 text-amber-900 ring-amber-300 border-l-amber-500',
  'bg-sky-100 text-sky-900 ring-sky-300 border-l-sky-600',
  'bg-violet-100 text-violet-900 ring-violet-300 border-l-violet-600',
  'bg-rose-100 text-rose-900 ring-rose-300 border-l-rose-500',
]

/** Reparte en carriles los bloques de un día que se cruzan: [{...bloque, carril, carriles}]. */
function asignarCarriles(bloques) {
  const ordenados = [...bloques].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)
  const resultado = []
  let racimo = []
  let finRacimo = -1
  const cerrar = () => {
    const carriles = Math.max(1, ...racimo.map((b) => b.carril + 1))
    racimo.forEach((b) => resultado.push({ ...b, carriles }))
    racimo = []
  }
  for (const bloque of ordenados) {
    if (bloque.inicio >= finRacimo) cerrar()
    const ocupados = new Set(racimo.filter((b) => b.fin > bloque.inicio).map((b) => b.carril))
    let carril = 0
    while (ocupados.has(carril)) carril += 1
    racimo.push({ ...bloque, carril })
    finRacimo = Math.max(finRacimo, bloque.fin)
  }
  cerrar()
  return resultado
}

/** Bloques de todos los grupos, ya repartidos en carriles. */
export function bloquesDeGrupos(grupos) {
  const porDia = new Map()
  grupos.forEach((grupo, indice) => {
    for (const h of grupo.horarios ?? []) {
      const lista = porDia.get(h.dia_semana) ?? []
      lista.push({
        key: `${grupo.id}-${h.dia_semana}-${h.hora_inicio}`,
        grupo,
        dia: h.dia_semana,
        desde: hhmm(h.hora_inicio),
        hasta: hhmm(h.hora_fin),
        inicio: aMinutos(h.hora_inicio),
        fin: aMinutos(h.hora_fin),
        color: COLORES[indice % COLORES.length],
      })
      porDia.set(h.dia_semana, lista)
    }
  })
  return [...porDia.values()].flatMap(asignarCarriles)
}

export default function HorarioSemanalGrid({ grupos, diaHoy, ajustarRango = false }) {
  const hoy = diaHoy ?? ((new Date().getDay() + 6) % 7) + 1 // getDay: 0 = domingo -> ISO 7
  const bloques = useMemo(() => bloquesDeGrupos(grupos), [grupos])

  // Rango visible: horas completas que cubren el primer inicio y el último fin.
  const desde = ajustarRango && bloques.length ? Math.floor(Math.min(...bloques.map((b) => b.inicio)) / 60) : HORA_INICIO_DIA
  const hasta = ajustarRango && bloques.length ? Math.ceil(Math.max(...bloques.map((b) => b.fin)) / 60) : HORA_FIN_DIA
  const filas = ((hasta - desde) * 60) / MINUTOS_FILA
  const horas = Array.from({ length: hasta - desde }, (_, i) => desde + i)
  const filaDe = (hora) => (aMinutos(hora) - desde * 60) / MINUTOS_FILA + 2 // la fila 1 es el encabezado

  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
      <div
        role="region"
        aria-label="Horario semanal"
        className="grid min-w-[44rem] bg-white text-xs"
        style={{
          gridTemplateColumns: '3.75rem repeat(7, minmax(5.5rem, 1fr))',
          gridTemplateRows: `auto repeat(${filas}, 1.5rem)`,
        }}
      >
        {/* Encabezado */}
        <div className="border-b border-slate-200 bg-slate-50" style={{ gridColumn: 1, gridRow: 1 }} />
        {DIAS_SEMANA.map((dia) => (
          <div
            key={dia.valor}
            className={`border-b border-l border-slate-200 px-2 py-2 text-center font-semibold ${
              dia.valor === hoy ? 'bg-pizarra-900 text-white' : 'bg-slate-50 text-pizarra-900'
            }`}
            style={{ gridColumn: dia.valor + 1, gridRow: 1 }}
          >
            <span className="hidden sm:inline">{dia.nombre}</span>
            <span className="sm:hidden">{dia.corto}</span>
          </div>
        ))}

        {/* Horas y celdas de fondo (una por hora y día) */}
        {horas.map((hora, i) => (
          <div
            key={`h-${hora}`}
            className="border-t border-slate-100 pr-2 pt-1 text-right tabular-nums text-slate-500"
            style={{ gridColumn: 1, gridRow: `${i * 2 + 2} / span 2` }}
          >
            {String(hora).padStart(2, '0')}:00
          </div>
        ))}
        {horas.flatMap((hora, i) =>
          DIAS_SEMANA.map((dia) => (
            <div
              key={`c-${hora}-${dia.valor}`}
              aria-hidden="true"
              className={`border-l border-t border-slate-100 ${dia.valor === hoy ? 'bg-pizarra-50/50' : ''}`}
              style={{ gridColumn: dia.valor + 1, gridRow: `${i * 2 + 2} / span 2` }}
            />
          )),
        )}

        {/* Bloques de clase */}
        {bloques.map((b) => (
          <div
            key={b.key}
            title={`${b.grupo.nombre} (${b.grupo.programa_nombre}) · ${b.desde}–${b.hasta}`}
            className={`z-10 m-0.5 overflow-hidden rounded-md border-l-4 px-1.5 py-1 shadow-xs ring-1 ring-inset ${b.color}`}
            style={{
              gridColumn: b.dia + 1,
              gridRow: `${filaDe(b.desde)} / ${filaDe(b.hasta)}`,
              width: `calc(${100 / b.carriles}% - 0.25rem)`,
              marginLeft: `calc(${(100 * b.carril) / b.carriles}% + 0.125rem)`,
              justifySelf: 'start',
            }}
          >
            <p className="truncate font-semibold leading-tight">{b.grupo.nombre}</p>
            <p className="truncate leading-tight opacity-80">{b.grupo.programa_nombre}</p>
            <p className="truncate tabular-nums leading-tight opacity-70">
              {b.desde}–{b.hasta}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
