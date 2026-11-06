/**
 * Horarios de los grupos (Fase 6). Debe coincidir con backend/app/schemas/grupo_schema.py:
 * días ISO (1 = Lunes ... 7 = Domingo), clases entre 08:00 y 22:00 en bloques de media hora.
 */

export const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes', corto: 'Lun' },
  { valor: 2, nombre: 'Martes', corto: 'Mar' },
  { valor: 3, nombre: 'Miércoles', corto: 'Mié' },
  { valor: 4, nombre: 'Jueves', corto: 'Jue' },
  { valor: 5, nombre: 'Viernes', corto: 'Vie' },
  { valor: 6, nombre: 'Sábado', corto: 'Sáb' },
  { valor: 7, nombre: 'Domingo', corto: 'Dom' },
]

export const HORA_INICIO_DIA = 8
export const HORA_FIN_DIA = 22
export const HORARIOS_MAX = 21

/** '08:00', '08:30', ..., '22:00'. */
export const OPCIONES_HORA = Array.from({ length: (HORA_FIN_DIA - HORA_INICIO_DIA) * 2 + 1 }, (_, i) => {
  const minutos = HORA_INICIO_DIA * 60 + i * 30
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${minutos % 60 ? '30' : '00'}`
})

/** '18:00:00' (API) -> '18:00'. */
export const hhmm = (hora) => String(hora ?? '').slice(0, 5)

/** '18:30' -> 1110 minutos desde la medianoche. */
export function aMinutos(hora) {
  const [h, m] = hhmm(hora).split(':').map(Number)
  return h * 60 + m
}

export const nombreDia = (valor) => DIAS_SEMANA[valor - 1]?.nombre ?? ''

/** "Lun 08:00–10:00 · Jue 18:00–20:30". */
export function resumenHorario(horarios = []) {
  return horarios
    .map((h) => `${DIAS_SEMANA[h.dia_semana - 1]?.corto} ${hhmm(h.hora_inicio)}–${hhmm(h.hora_fin)}`)
    .join(' · ')
}

/** Primer error de una lista de bloques (mismas reglas que la API) o '' si es válida. */
export function validarHorarios(horarios) {
  if (horarios.length > HORARIOS_MAX) return `Un grupo puede tener como máximo ${HORARIOS_MAX} bloques de horario.`
  for (const h of horarios) {
    if (aMinutos(h.hora_inicio) >= aMinutos(h.hora_fin)) {
      return `${nombreDia(h.dia_semana)}: la hora de fin debe ser posterior a la de inicio.`
    }
  }
  const ordenados = [...horarios].sort((a, b) => a.dia_semana - b.dia_semana || aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio))
  for (let i = 1; i < ordenados.length; i += 1) {
    const [anterior, actual] = [ordenados[i - 1], ordenados[i]]
    if (anterior.dia_semana === actual.dia_semana && aMinutos(actual.hora_inicio) < aMinutos(anterior.hora_fin)) {
      return `Los bloques del ${nombreDia(actual.dia_semana)} se cruzan.`
    }
  }
  return ''
}

/** Mismo horario sin importar el orden (para saber si hubo cambios). */
export function mismoHorario(a = [], b = []) {
  const clave = (lista) =>
    lista
      .map((h) => `${h.dia_semana}-${hhmm(h.hora_inicio)}-${hhmm(h.hora_fin)}`)
      .sort()
      .join('|')
  return clave(a) === clave(b)
}
