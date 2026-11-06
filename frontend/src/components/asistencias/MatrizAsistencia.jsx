/**
 * Matriz de asistencia de un grupo.
 *
 *   Filas:    estudiantes activos (primera columna fija con sticky left-0).
 *   Columnas: fechas de clase en orden cronológico; la API ya omitió los festivos.
 *   Celdas:   <AttendanceToggle />. Solo la columna de HOY es interactiva; las pasadas son de solo lectura.
 *
 * "Guardar Asistencia de Hoy" envía solo la columna de hoy (la API responde 400 con otra fecha).
 *
 * @param {object} props
 * @param {number} props.grupoId
 * @param {() => void} props.onVolver
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, CalendarX2, Info, LoaderCircle, RefreshCw, Save, TriangleAlert, UsersRound } from 'lucide-react'
import AttendanceToggle, { ESTADOS } from './AttendanceToggle'
import AccessDenied from '../ui/AccessDenied'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { getMatrizAsistencia, guardarAsistencia } from '../../services/asistenciasService'

/** 'AAAA-MM-DD' -> Date local (new Date('AAAA-MM-DD') sería UTC y en Colombia mostraría el día anterior). */
function fechaLocal(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

const formatoDia = new Intl.DateTimeFormat('es-CO', { weekday: 'short' })
const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })
const formatoLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

/** Estado de hoy de cada estudiante: lo guardado o AUSENTE por defecto. */
function estadosDeHoy(matriz) {
  return Object.fromEntries(
    matriz.estudiantes.map((e) => [e.solicitud_id, e.asistencias[matriz.hoy] ?? 'AUSENTE']),
  )
}

export default function MatrizAsistencia({ grupoId, onVolver }) {
  const toast = useToast()
  const [estado, setEstado] = useState({ status: 'loading', matriz: null, error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [hoyEstados, setHoyEstados] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelado = false
    setEstado((current) => ({ ...current, status: 'loading' }))
    getMatrizAsistencia(grupoId)
      .then((matriz) => {
        if (cancelado) return
        setEstado({ status: 'ready', matriz, error: '' })
        setHoyEstados(estadosDeHoy(matriz))
      })
      .catch((error) => {
        if (cancelado) return
        if (error.response?.status === 403) {
          setEstado({ status: 'forbidden', matriz: null, error: '' })
          return
        }
        setEstado({ status: 'error', matriz: null, error: getApiErrorMessage(error, 'No fue posible cargar la asistencia.') })
      })
    return () => {
      cancelado = true
    }
  }, [grupoId, reloadKey])

  const matriz = estado.matriz
  const guardados = useMemo(() => (matriz ? estadosDeHoy(matriz) : {}), [matriz])
  const hayCambios = Object.entries(hoyEstados).some(([id, valor]) => guardados[id] !== valor)
  const hoyGuardado = Boolean(matriz?.estudiantes.some((e) => e.asistencias[matriz.hoy]))

  // La columna de hoy queda al final: se desplaza la tabla hasta ella al cargar.
  useEffect(() => {
    if (estado.status === 'ready' && scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [estado.status])

  // Aviso del navegador si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hayCambios) return undefined
    const avisar = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  const resumen = useMemo(() => {
    const conteo = { PRESENTE: 0, AUSENTE: 0, EXCUSADO: 0 }
    Object.values(hoyEstados).forEach((valor) => {
      conteo[valor] += 1
    })
    return conteo
  }, [hoyEstados])

  async function handleGuardar() {
    setGuardando(true)
    try {
      const registros = matriz.estudiantes.map((e) => ({ solicitud_id: e.solicitud_id, estado: hoyEstados[e.solicitud_id] }))
      const resultado = await guardarAsistencia(grupoId, matriz.hoy, registros)
      toast.success(
        'Asistencia guardada',
        `${resultado.guardados} estudiante${resultado.guardados === 1 ? '' : 's'} · ${formatoLargo.format(fechaLocal(matriz.hoy))}.`,
      )
      // Lo enviado pasa a ser lo guardado.
      setEstado((current) => ({
        ...current,
        matriz: {
          ...current.matriz,
          estudiantes: current.matriz.estudiantes.map((e) => ({
            ...e,
            asistencias: { ...e.asistencias, [current.matriz.hoy]: hoyEstados[e.solicitud_id] },
          })),
        },
      }))
    } catch (error) {
      toast.error('No fue posible guardar la asistencia', getApiErrorMessage(error))
      // 400 por estudiantes que ya no están o por cambio de día: se recarga la matriz.
      if (error.response?.status === 400) setReloadKey((key) => key + 1)
    } finally {
      setGuardando(false)
    }
  }

  const volver = () => (hayCambios ? setConfirmarSalida(true) : onVolver())

  if (estado.status === 'forbidden') return <AccessDenied />

  const festivoHoy = matriz?.festivos_omitidos.find((f) => f.fecha === matriz.hoy)
  const puedeGuardar = matriz?.es_dia_de_clase && matriz.estudiantes.length > 0

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={volver}
            className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-pizarra-700 transition-colors hover:bg-slate-100"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Volver a los grupos
          </button>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">
            {matriz ? matriz.grupo_nombre : 'Asistencia'}
            {matriz && <span className="font-normal text-slate-500"> ({matriz.programa_nombre})</span>}
          </h1>
          {matriz && (
            <p className="mt-2 text-[15px] text-slate-600">
              Hoy, {formatoLargo.format(fechaLocal(matriz.hoy))}
              {matriz.es_dia_de_clase && (hoyGuardado ? ' · asistencia registrada' : ' · asistencia pendiente')}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={estado.status === 'loading' || guardando}
          >
            Actualizar
          </Button>
          <Button
            icon={Save}
            onClick={handleGuardar}
            loading={guardando}
            loadingText="Guardando…"
            disabled={!puedeGuardar || estado.status !== 'ready'}
            title={puedeGuardar ? undefined : 'Hoy no hay clase programada para este grupo'}
          >
            Guardar Asistencia de Hoy
          </Button>
        </div>
      </section>

      {estado.status === 'loading' && !matriz && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-16 text-sm text-slate-500 shadow-panel ring-1 ring-slate-200/80">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando asistencia…
        </div>
      )}

      {estado.status === 'error' && (
        <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar la asistencia</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{estado.error}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
            Reintentar
          </Button>
        </div>
      )}

      {matriz && (
        <>
          {!matriz.es_dia_de_clase && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <CalendarX2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <p>
                {festivoHoy
                  ? `Hoy es festivo (${festivoHoy.nombre}): no hay clase.`
                  : 'Hoy no hay clase según el horario de este grupo.'}{' '}
                Las fechas anteriores son de solo lectura.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
            {Object.entries(ESTADOS).map(([clave, { etiqueta, icon: Icon, clase }]) => (
              <span key={clave} className="inline-flex items-center gap-2">
                <span className={`inline-grid size-6 place-items-center rounded-md ring-1 ring-inset ${clase}`}>
                  <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.75} />
                </span>
                {etiqueta}
                {matriz.es_dia_de_clase && <span className="font-semibold tabular-nums text-pizarra-900">{resumen[clave]}</span>}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Info aria-hidden="true" className="size-4" /> Clic: presente/ausente · Doble clic: excusado
            </span>
            {matriz.festivos_omitidos.length > 0 && (
              <span
                className="text-slate-500"
                title={matriz.festivos_omitidos.map((f) => `${f.fecha}: ${f.nombre}`).join('\n')}
              >
                {matriz.festivos_omitidos.length} festivo{matriz.festivos_omitidos.length === 1 ? '' : 's'} sin clase
              </span>
            )}
          </div>

          {matriz.estudiantes.length === 0 ? (
            <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                <UsersRound aria-hidden="true" className="size-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-pizarra-900">Este grupo aún no tiene estudiantes</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Asígnelos desde el módulo de Grupos.</p>
            </div>
          ) : matriz.sesiones.length === 0 ? (
            <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
                <CalendarX2 aria-hidden="true" className="size-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-pizarra-900">Todavía no hay sesiones de clase</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Las fechas aparecen según el horario del grupo, desde su creación hasta hoy. Revise que el grupo tenga
                horario.
              </p>
            </div>
          ) : (
            <div ref={scrollRef} className="overflow-x-auto rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
              <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs font-medium text-slate-500">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-20 min-w-56 border-b border-r border-slate-200 bg-slate-50 px-4 py-2.5 font-medium sm:pl-6"
                    >
                      Estudiante
                    </th>
                    {matriz.sesiones.map((fecha) => {
                      const esHoy = fecha === matriz.hoy
                      const dia = fechaLocal(fecha)
                      return (
                        <th
                          key={fecha}
                          scope="col"
                          className={`min-w-16 border-b border-slate-200 px-2 py-2 text-center font-medium ${
                            esHoy ? 'bg-pizarra-900 text-white' : 'bg-slate-50/60'
                          }`}
                        >
                          <span className="block capitalize">{esHoy ? 'Hoy' : formatoDia.format(dia)}</span>
                          <span className={`block tabular-nums ${esHoy ? 'text-pizarra-100' : 'text-slate-400'}`}>
                            {formatoFecha.format(dia)}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {matriz.estudiantes.map((estudiante) => (
                    <tr key={estudiante.solicitud_id} className="group">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-2.5 font-normal transition-colors group-hover:bg-slate-50 sm:pl-6"
                      >
                        <p className="max-w-64 truncate font-medium text-pizarra-900">{estudiante.nombre_completo}</p>
                        <p className="text-xs tabular-nums text-slate-500">
                          {estudiante.tipo_documento} {estudiante.numero_documento}
                        </p>
                      </th>
                      {matriz.sesiones.map((fecha) => {
                        const esHoy = fecha === matriz.hoy
                        const etiqueta = `Asistencia de ${estudiante.nombre_completo} el ${formatoFecha.format(fechaLocal(fecha))}`
                        return (
                          <td
                            key={fecha}
                            className={`border-b border-slate-100 px-2 py-2 text-center transition-colors ${
                              esHoy ? 'bg-pizarra-50/60' : 'group-hover:bg-slate-50'
                            }`}
                          >
                            {esHoy ? (
                              <AttendanceToggle
                                value={hoyEstados[estudiante.solicitud_id]}
                                onChange={(valor) =>
                                  setHoyEstados((current) => ({ ...current, [estudiante.solicitud_id]: valor }))
                                }
                                disabled={guardando}
                                label={etiqueta}
                              />
                            ) : (
                              <AttendanceToggle value={estudiante.asistencias[fecha] ?? null} disabled label={etiqueta} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {confirmarSalida && (
        <ConfirmDialog
          title="¿Salir sin guardar la asistencia?"
          description="Los cambios de hoy que no ha guardado se perderán."
          confirmLabel="Sí, salir"
          tone="danger"
          icon={ArrowLeft}
          onConfirm={onVolver}
          onCancel={() => setConfirmarSalida(false)}
        />
      )}
    </div>
  )
}
