/**
 * Lista dinámica de bloques de horario del grupo (Ej. Lunes 08:00 - 10:00).
 * Selects nativos: día, inicio y fin en medias horas entre 08:00 y 22:00.
 *
 * @param {object} props
 * @param {{key: string, dia_semana: number, hora_inicio: string, hora_fin: string}[]} props.bloques
 * @param {(bloques: object[]) => void} props.onChange
 * @param {string} [props.error] Error general del horario (cruce de bloques, rango...).
 * @param {boolean} [props.disabled]
 */
import { CalendarClock, CircleAlert, Plus, Trash2 } from 'lucide-react'
import { DIAS_SEMANA, HORARIOS_MAX, OPCIONES_HORA, aMinutos } from '../../utils/horarios'

const SELECT =
  'h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 text-sm text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15 disabled:bg-slate-50 disabled:text-slate-500'

let siguienteClave = 0
/** Bloque nuevo con clave estable para React (no se envía a la API). */
export function nuevoBloque(datos = { dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00' }) {
  siguienteClave += 1
  return { key: `bloque-${siguienteClave}`, ...datos }
}

export default function HorarioBloquesField({ bloques, onChange, error, disabled = false }) {
  const actualizar = (key, cambios) =>
    onChange(bloques.map((bloque) => (bloque.key === key ? { ...bloque, ...cambios } : bloque)))

  function agregar() {
    // Sugiere el día siguiente al último bloque, con el mismo horario.
    const ultimo = bloques.at(-1)
    onChange([
      ...bloques,
      nuevoBloque(
        ultimo
          ? { dia_semana: (ultimo.dia_semana % 7) + 1, hora_inicio: ultimo.hora_inicio, hora_fin: ultimo.hora_fin }
          : undefined,
      ),
    ])
  }

  return (
    <fieldset className="space-y-3" aria-describedby={error ? 'horario-error' : 'horario-hint'}>
      <legend className="flex items-center gap-2 text-sm font-medium text-pizarra-900">
        <CalendarClock aria-hidden="true" className="size-4 text-slate-400" /> Horario semanal
      </legend>

      {bloques.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">
          Sin bloques de horario. Sin horario no se calculan sesiones de clase ni se toma asistencia.
        </p>
      ) : (
        <ul className="space-y-2">
          {bloques.map((bloque, index) => {
            const invalido = aMinutos(bloque.hora_inicio) >= aMinutos(bloque.hora_fin)
            return (
              <li
                key={bloque.key}
                className={`grid grid-cols-[1fr_auto] gap-2 rounded-lg p-2 ring-1 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center ${
                  invalido ? 'bg-rose-50/60 ring-rose-200' : 'bg-slate-50/70 ring-slate-200/80'
                }`}
              >
                <select
                  aria-label={`Día del bloque ${index + 1}`}
                  value={bloque.dia_semana}
                  onChange={(event) => actualizar(bloque.key, { dia_semana: Number(event.target.value) })}
                  disabled={disabled}
                  className={`${SELECT} col-span-1`}
                >
                  {DIAS_SEMANA.map((dia) => (
                    <option key={dia.valor} value={dia.valor}>
                      {dia.nombre}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(bloques.filter((item) => item.key !== bloque.key))}
                  disabled={disabled}
                  className="inline-grid size-10 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 disabled:text-slate-400 sm:order-last"
                  aria-label={`Quitar bloque ${index + 1}`}
                  title="Quitar bloque"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
                <div className="col-span-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:col-span-2">
                  <select
                    aria-label={`Hora de inicio del bloque ${index + 1}`}
                    value={bloque.hora_inicio}
                    onChange={(event) => actualizar(bloque.key, { hora_inicio: event.target.value })}
                    disabled={disabled}
                    className={SELECT}
                  >
                    {OPCIONES_HORA.slice(0, -1).map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                  <span aria-hidden="true" className="text-slate-400">
                    –
                  </span>
                  <select
                    aria-label={`Hora de fin del bloque ${index + 1}`}
                    aria-invalid={invalido ? 'true' : 'false'}
                    value={bloque.hora_fin}
                    onChange={(event) => actualizar(bloque.key, { hora_fin: event.target.value })}
                    disabled={disabled}
                    className={SELECT}
                  >
                    {OPCIONES_HORA.slice(1).map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={agregar}
          disabled={disabled || bloques.length >= HORARIOS_MAX}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-pradera-700 transition-colors hover:bg-pradera-50 disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          <Plus aria-hidden="true" className="size-4" /> Añadir bloque de horario
        </button>
        {!error && (
          <p id="horario-hint" className="text-xs text-slate-500">
            De 08:00 a 22:00, en bloques de media hora.
          </p>
        )}
      </div>

      {error && (
        <p id="horario-error" className="flex items-start gap-1.5 text-sm text-rose-600">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  )
}
