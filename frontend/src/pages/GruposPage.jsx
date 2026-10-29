/**
 * Grupos (ruta protegida /dashboard/grupos).
 *
 * La API ya filtra por rol: el Maestro solo recibe los grupos de sus programas.
 * Los botones de acción se ocultan al Coordinador (solo consulta); el 403 de la API
 * sigue siendo la verificación real.
 */
import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, Maximize2, Pencil, Plus, RefreshCw, TriangleAlert, UserPlus, UsersRound } from 'lucide-react'
import AsignarEstudiantesModal from '../components/grupos/AsignarEstudiantesModal'
import GrupoEstudiantesModal from '../components/grupos/GrupoEstudiantesModal'
import GrupoFormModal from '../components/grupos/GrupoFormModal'
import AccessDenied from '../components/ui/AccessDenied'
import Button from '../components/ui/Button'
import { ROL, ROLES_GESTION_GRUPOS, claveRol, tieneRol } from '../config/roles'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import { listGrupos } from '../services/gruposService'
import { getProgramIcon } from '../utils/programIcons'

const porProgramaYNombre = (a, b) =>
  a.programa_nombre.localeCompare(b.programa_nombre, 'es') || a.nombre.localeCompare(b.nombre, 'es')

const DESCRIPCION = {
  [ROL.ADMINISTRADOR]: 'Cree los grupos de cada programa y asigne los estudiantes con solicitud aprobada.',
  [ROL.COORDINADOR]: 'Consulte los grupos de todos los programas y cuántos estudiantes tiene cada uno.',
  [ROL.MAESTRO]: 'Gestione los grupos de los programas que tiene asignados.',
}

function GrupoCard({ grupo, puedeGestionar, onEditar, onAsignar, onExpandir }) {
  const Icon = getProgramIcon(grupo.programa_nombre)
  const maestros = grupo.maestros.map((maestro) => maestro.nombre_completo).join(', ')

  return (
    <article className="flex flex-col rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
      <header className="flex items-start gap-3 px-5 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pizarra-50 text-pizarra-700 ring-1 ring-pizarra-100">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <h2 className="min-w-0 flex-1 pt-2 text-base font-semibold leading-snug text-pizarra-950">
          {grupo.nombre} <span className="font-normal text-slate-500">({grupo.programa_nombre})</span>
        </h2>
        {puedeGestionar && (
          <div className="-mr-2 flex shrink-0">
            <button
              type="button"
              onClick={onEditar}
              className="inline-grid size-9 place-items-center rounded-lg text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950"
              aria-label={`Modificar ${grupo.nombre}`}
              title="Modificar"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              onClick={onAsignar}
              className="inline-grid size-9 place-items-center rounded-lg text-pradera-700 transition-colors hover:bg-pradera-50 hover:text-pradera-800"
              aria-label={`Asignar estudiantes a ${grupo.nombre}`}
              title="Asignar estudiantes"
            >
              <UserPlus aria-hidden="true" className="size-[18px]" />
            </button>
          </div>
        )}
      </header>

      <dl className="flex-1 space-y-1.5 px-5 py-4 text-sm">
        <div className="flex gap-1.5">
          <dt className="shrink-0 text-slate-500">Maestros:</dt>
          <dd className={maestros ? 'text-slate-700' : 'text-slate-400'}>{maestros || 'Sin maestros asignados'}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-slate-500">Estudiantes asignados:</dt>
          <dd className="font-semibold tabular-nums text-pizarra-900">{grupo.estudiantes_activos}</dd>
        </div>
      </dl>

      <footer className="border-t border-slate-100 px-3 py-2">
        <Button variant="ghost" icon={Maximize2} onClick={onExpandir} className="w-full">
          Expandir
        </Button>
      </footer>
    </article>
  )
}

export default function GruposPage() {
  const toast = useToast()
  const { user } = useAuth()
  const puedeGestionar = tieneRol(user?.rol, ROLES_GESTION_GRUPOS)

  const [grupos, setGrupos] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error | forbidden
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  // { tipo: 'crear' } | { tipo: 'editar' | 'asignar' | 'expandir', id }
  const [modal, setModal] = useState(null)

  useEffect(() => {
    let cancelado = false
    setStatus('loading')
    listGrupos()
      .then((data) => {
        if (cancelado) return
        setGrupos(data)
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelado) return
        if (error.response?.status === 403) {
          setStatus('forbidden')
          return
        }
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar los grupos.'))
        setStatus('error')
      })
    return () => {
      cancelado = true
    }
  }, [reloadKey])

  // Tras asignar o desasignar: actualiza los contadores sin el estado de carga de toda la página.
  const refrescar = useCallback(() => {
    listGrupos()
      .then(setGrupos)
      .catch((error) => toast.error('No fue posible actualizar los grupos', getApiErrorMessage(error)))
  }, [toast])

  const guardarGrupo = useCallback((grupo, accion) => {
    setGrupos((current) =>
      (accion === 'creado' ? [...current, grupo] : current.map((item) => (item.id === grupo.id ? grupo : item))).sort(
        porProgramaYNombre,
      ),
    )
  }, [])

  const quitarGrupo = useCallback((grupo) => {
    setGrupos((current) => current.filter((item) => item.id !== grupo.id))
  }, [])

  const closeModal = useCallback(() => setModal(null), [])
  const seleccionado = modal?.id ? grupos.find((item) => item.id === modal.id) : null

  if (status === 'forbidden') return <AccessDenied />

  const totalEstudiantes = grupos.reduce((total, grupo) => total + grupo.estudiantes_activos, 0)
  const totalProgramas = new Set(grupos.map((grupo) => grupo.programa_id)).size

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">Grupos</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            {DESCRIPCION[claveRol(user?.rol)] ?? DESCRIPCION[ROL.COORDINADOR]}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={status === 'loading'}
          >
            Actualizar
          </Button>
          {puedeGestionar && (
            <Button icon={Plus} onClick={() => setModal({ tipo: 'crear' })}>
              Crear Grupo
            </Button>
          )}
        </div>
      </section>

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
          <p className="mt-4 text-sm font-semibold text-pizarra-900">Aún no hay grupos</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {puedeGestionar
              ? 'Use "Crear Grupo" para registrar el primero.'
              : 'Los grupos aparecerán aquí cuando el Administrador o los maestros los creen.'}
          </p>
        </div>
      )}

      {status === 'ready' && grupos.length > 0 && (
        <>
          <p className="text-sm tabular-nums text-slate-500">
            {grupos.length} grupo{grupos.length === 1 ? '' : 's'} en {totalProgramas} programa
            {totalProgramas === 1 ? '' : 's'} · {totalEstudiantes} estudiante{totalEstudiantes === 1 ? '' : 's'} asignado
            {totalEstudiantes === 1 ? '' : 's'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {grupos.map((grupo) => (
              <GrupoCard
                key={grupo.id}
                grupo={grupo}
                puedeGestionar={puedeGestionar}
                onEditar={() => setModal({ tipo: 'editar', id: grupo.id })}
                onAsignar={() => setModal({ tipo: 'asignar', id: grupo.id })}
                onExpandir={() => setModal({ tipo: 'expandir', id: grupo.id })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.tipo === 'crear' && <GrupoFormModal grupo={null} onClose={closeModal} onSaved={guardarGrupo} />}

      {modal?.tipo === 'editar' && seleccionado && (
        <GrupoFormModal grupo={seleccionado} onClose={closeModal} onSaved={guardarGrupo} onDeleted={quitarGrupo} />
      )}

      {modal?.tipo === 'asignar' && seleccionado && (
        <AsignarEstudiantesModal grupo={seleccionado} onClose={closeModal} onAssigned={refrescar} />
      )}

      {modal?.tipo === 'expandir' && seleccionado && (
        <GrupoEstudiantesModal
          grupo={seleccionado}
          puedeGestionar={puedeGestionar}
          onChange={refrescar}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
