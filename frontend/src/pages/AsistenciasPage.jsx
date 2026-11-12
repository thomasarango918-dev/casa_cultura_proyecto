/**
 * Asistencia (ruta protegida /dashboard/asistencias, Administrador y Maestro).
 *
 *   Sin ?grupo=  Listado de los grupos visibles (la API filtra: el Maestro solo recibe los de sus programas).
 *   ?grupo=ID    Matriz de asistencia del grupo (MatrizAsistencia).
 *
 * El grupo seleccionado queda en la URL: recargar la página no pierde la vista.
 *
 * Fase 8 (sin conexión):
 *   - El listado se guarda en IndexedDB (cached_snapshots) y se muestra desde allí si no hay red.
 *   - Con red, se descargan en segundo plano las matrices de los grupos que aún no tienen copia
 *     de hoy: así la asistencia se puede tomar sin conexión el resto del día.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, HardDrive, LoaderCircle, RefreshCw, TriangleAlert, UsersRound } from 'lucide-react'
import MatrizAsistencia from '../components/asistencias/MatrizAsistencia'
import AccessDenied from '../components/ui/AccessDenied'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage, isNetworkError } from '../services/apiClient'
import { getMatrizAsistencia } from '../services/asistenciasService'
import { listGrupos } from '../services/gruposService'
import { formatDateTime, hoyColombia } from '../utils/formatters'
import { resumenHorario } from '../utils/horarios'
import { getSnapshot, saveSnapshot, snapshotGrupos, snapshotMatriz } from '../utils/offlineSync'

/** Máximo de matrices que se descargan en segundo plano por visita al listado. */
const MAX_PRECARGA = 30

/** Descarga y guarda la matriz de los grupos que no tienen copia de hoy (en serie, sin bloquear la vista). */
async function precargarMatrices(usuarioId, grupos, cancelado) {
  const hoy = hoyColombia()
  const candidatos = grupos.filter((g) => g.estudiantes_activos > 0 && g.horarios?.length).slice(0, MAX_PRECARGA)
  for (const grupo of candidatos) {
    if (cancelado()) return
    const copia = await getSnapshot(snapshotMatriz(usuarioId, grupo.id))
    if (copia?.data?.hoy === hoy) continue
    try {
      await saveSnapshot(snapshotMatriz(usuarioId, grupo.id), await getMatrizAsistencia(grupo.id))
    } catch {
      return // sin red o sin permiso: se intenta en la próxima visita
    }
  }
}

function ListadoGrupos({ onSeleccionar }) {
  const { user } = useAuth()
  const usuarioId = user?.id
  const [grupos, setGrupos] = useState([])
  // Fecha de la copia local cuando el listado se muestra sin conexión; null si viene de la API.
  const [copiaLocal, setCopiaLocal] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error | forbidden
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelado = false
    setStatus('loading')
    listGrupos()
      .then((data) => {
        if (cancelado) return
        setGrupos(data)
        setCopiaLocal(null)
        setStatus('ready')
        saveSnapshot(snapshotGrupos(usuarioId), data)
        precargarMatrices(usuarioId, data, () => cancelado)
      })
      .catch(async (error) => {
        if (cancelado) return
        if (error.response?.status === 403) {
          setStatus('forbidden')
          return
        }
        // Sin red: se muestra la última copia guardada en este equipo.
        if (isNetworkError(error)) {
          const copia = await getSnapshot(snapshotGrupos(usuarioId))
          if (cancelado) return
          if (copia) {
            setGrupos(copia.data)
            setCopiaLocal(copia.guardado_en)
            setStatus('ready')
            return
          }
        }
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar los grupos.'))
        setStatus('error')
      })
    return () => {
      cancelado = true
    }
  }, [reloadKey, usuarioId])

  if (status === 'forbidden') return <AccessDenied />

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">Asistencia</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Seleccione un grupo para tomar la asistencia de hoy y consultar la de las clases anteriores. Los festivos de
            Colombia no se cuentan como clase.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={status === 'loading'}
          className="shrink-0"
        >
          Actualizar
        </Button>
      </section>

      {status === 'ready' && copiaLocal && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <HardDrive aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <p>Sin conexión: se muestra la copia guardada en este equipo el {formatDateTime(copiaLocal)}.</p>
        </div>
      )}

      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-16 text-sm text-slate-500 shadow-panel ring-1 ring-slate-200/80">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando grupos…
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar los grupos</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
            Reintentar
          </Button>
        </div>
      )}

      {status === 'ready' && grupos.length === 0 && (
        <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <UsersRound aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">No tiene grupos asignados</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Los grupos se crean en el módulo de Grupos.</p>
        </div>
      )}

      {status === 'ready' && grupos.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium sm:pl-6">Grupo</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Horario</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Estudiantes</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium sm:pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grupos.map((grupo) => {
                const horario = resumenHorario(grupo.horarios)
                return (
                  <tr key={grupo.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 sm:pl-6">
                      <p className="font-medium text-pizarra-900">{grupo.nombre}</p>
                      <p className="text-xs text-slate-500">{grupo.programa_nombre}</p>
                    </td>
                    <td className={`px-4 py-3 tabular-nums ${horario ? 'text-slate-600' : 'text-slate-400'}`}>
                      {horario || 'Sin horario'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-pizarra-900">
                      {grupo.estudiantes_activos}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right sm:pr-6">
                      <button
                        type="button"
                        onClick={() => onSeleccionar(grupo.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-pradera-700 transition-colors hover:bg-pradera-50 hover:text-pradera-800"
                        aria-label={`Tomar asistencia de ${grupo.nombre}`}
                        title="Tomar Asistencia"
                      >
                        <ClipboardCheck aria-hidden="true" className="size-[18px]" />
                        <span className="hidden sm:inline">Tomar Asistencia</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AsistenciasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const grupoId = Number(searchParams.get('grupo')) || null

  if (grupoId) {
    return <MatrizAsistencia key={grupoId} grupoId={grupoId} onVolver={() => setSearchParams({})} />
  }
  return <ListadoGrupos onSeleccionar={(id) => setSearchParams({ grupo: String(id) })} />
}
