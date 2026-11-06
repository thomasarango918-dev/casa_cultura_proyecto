/**
 * "Mi Horario Semanal": calendario universitario hecho con CSS Grid.
 *
 *   Columnas: Lunes a Domingo.  Filas: franjas de 30 min de 08:00 a 22:00 (cada hora ocupa 2 filas).
 *
 * Recibe los grupos que ya cargó la página: la API los filtra por rol (el Maestro solo
 * recibe los de sus programas; el Administrador, todos). Si dos bloques se cruzan en el
 * mismo día se dibujan uno al lado del otro.
 *
 * @param {object} props
 * @param {object[]} props.grupos Grupos con `horarios` (GET /admin/grupos).
 * @param {string} props.titulo
 * @param {() => void} props.onClose
 */
import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { DIAS_SEMANA, HORA_FIN_DIA, HORA_INICIO_DIA, aMinutos, hhmm } from '../../utils/horarios'

const MINUTOS_FILA = 30
const FILAS = ((HORA_FIN_DIA - HORA_INICIO_DIA) * 60) / MINUTOS_FILA
const HORAS = Array.from({ length: HORA_FIN_DIA - HORA_INICIO_DIA }, (_, i) => HORA_INICIO_DIA + i)

// Un color por grupo (clases completas para que Tailwind las genere).
const COLORES = [
  'bg-pizarra-100 text-pizarra-900 ring-pizarra-300 border-l-pizarra-600',
  'bg-pradera-100 text-pradera-900 ring-pradera-300 border-l-pradera-600',
  'bg-amber-100 text-amber-900 ring-amber-300 border-l-amber-500',
  'bg-sky-100 text-sky-900 ring-sky-300 border-l-sky-600',
  'bg-violet-100 text-violet-900 ring-violet-300 border-l-violet-600',
  'bg-rose-100 text-rose-900 ring-rose-300 border-l-rose-500',
]

/** Fila de la grilla (la 1 es el encabezado de los días). */
const filaDe = (hora) => (aMinutos(hora) - HORA_INICIO_DIA * 60) / MINUTOS_FILA + 2

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

export default function HorarioSemanalModal({ grupos, titulo, onClose }) {
  const hoy = ((new Date().getDay() + 6) % 7) + 1 // getDay: 0 = domingo -> ISO 7

  const bloques = useMemo(() => {
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
  }, [grupos])

  const sinHorario = grupos.filter((grupo) => !grupo.horarios?.length)

  return (
    <Modal
      titleId="titulo-horario-semanal"
      size="xl"
      onClose={onClose}
      header={
        <>
          <p className="text-xs font-medium text-slate-500">Calendario de clases</p>
          <h2 id="titulo-horario-semanal" className="mt-0.5 text-lg font-semibold text-pizarra-950">
            {titulo}
          </h2>
        </>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-6">
        {bloques.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <CalendarDays aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">Aún no hay horarios registrados</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Agregue bloques de horario al crear o modificar un grupo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
            <div
              role="region"
              aria-label="Horario semanal"
              className="grid min-w-[44rem] bg-white text-xs"
              style={{
                gridTemplateColumns: '3.75rem repeat(7, minmax(5.5rem, 1fr))',
                gridTemplateRows: `auto repeat(${FILAS}, 1.5rem)`,
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
              {HORAS.map((hora, i) => (
                <div
                  key={`h-${hora}`}
                  className="border-t border-slate-100 pr-2 pt-1 text-right tabular-nums text-slate-500"
                  style={{ gridColumn: 1, gridRow: `${i * 2 + 2} / span 2` }}
                >
                  {String(hora).padStart(2, '0')}:00
                </div>
              ))}
              {HORAS.flatMap((hora, i) =>
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
        )}

        {sinHorario.length > 0 && bloques.length > 0 && (
          <p className="text-sm text-slate-500">
            Sin horario: {sinHorario.map((grupo) => `${grupo.nombre} (${grupo.programa_nombre})`).join(', ')}.
          </p>
        )}
      </div>
    </Modal>
  )
}
