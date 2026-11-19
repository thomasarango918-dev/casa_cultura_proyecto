/**
 * Programas y categorías (ruta protegida /dashboard/programas, Administrador y Coordinador).
 *
 * Grid de categorías: el lápiz abre el modal de estado y "Expandir" la tabla de programas.
 * Los modales devuelven lo que respondió la API y la página lo refleja sin recargar todo.
 * "Estadísticas" (Fase 7, Administrador y Coordinador): demanda por categoría con exportación a CSV.
 * Fase 9: "Renombrar" y "Eliminar" en el pie de cada tarjeta (Administrador y Coordinador).
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  FolderPlus,
  Layers,
  LoaderCircle,
  Maximize2,
  PenLine,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import CategoriaEstadoModal from '../components/programas/CategoriaEstadoModal'
import CategoriaFormModal from '../components/programas/CategoriaFormModal'
import CategoriaProgramasModal from '../components/programas/CategoriaProgramasModal'
import { CategoriaEstadoBadge } from '../components/programas/ProgramaBadges'
import AccessDenied from '../components/ui/AccessDenied'
import Button from '../components/ui/Button'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { ROLES_ESTADISTICAS, ROLES_GESTION_PROGRAMAS, tieneRol } from '../config/roles'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import { eliminarCategoria, listCategorias, listMaestros } from '../services/programasService'
import { getProgramIcon } from '../utils/programIcons'

// Fase 7: Recharts solo se descarga cuando se abre el modal de estadísticas.
const EstadisticasCategoriasModal = lazy(() => import('../components/estadisticas/EstadisticasCategoriasModal'))

// Programas visibles en la tarjeta; el resto se ve con "Expandir".
const VISTA_PREVIA = 5

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es')

/** Aplica a una categoría el programa creado, actualizado o eliminado, y recalcula su total. */
function aplicarCambioPrograma(categoria, programa, accion) {
  let programas = categoria.programas
  if (accion === 'creado') programas = [...programas, programa]
  if (accion === 'actualizado') programas = programas.map((item) => (item.id === programa.id ? programa : item))
  if (accion === 'eliminado') programas = programas.filter((item) => item.id !== programa.id)
  programas = [...programas].sort(porNombre)
  return {
    ...categoria,
    programas,
    estudiantes_inscritos: programas.reduce((total, item) => total + item.estudiantes_inscritos, 0),
  }
}

function CategoriaCard({ categoria, onEditar, onExpandir, onRenombrar, onEliminar }) {
  const Icon = getProgramIcon(categoria.nombre)
  // Fase 10: la vista macro solo cuenta y lista los programas habilitados.
  const activos = categoria.programas.filter((programa) => programa.activo !== false)
  const total = activos.length
  const estudiantes = activos.reduce((suma, programa) => suma + programa.estudiantes_inscritos, 0)
  const restantes = total - VISTA_PREVIA

  return (
    <article
      className={`flex flex-col rounded-xl shadow-panel ring-1 ring-slate-200/80 transition-opacity ${
        // Regla visual: categoría deshabilitada = tarjeta gris opaca (igual que los usuarios inactivos).
        categoria.activo ? 'bg-white' : 'bg-slate-100/70 opacity-60 grayscale hover:opacity-80'
      }`}
    >
      <header className="flex items-start gap-3 px-5 pt-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pizarra-50 text-pizarra-700 ring-1 ring-pizarra-100">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h2 className="truncate text-base font-semibold text-pizarra-950">{categoria.nombre}</h2>
            <button
              type="button"
              onClick={onEditar}
              className="-my-1 inline-grid size-8 shrink-0 place-items-center rounded-lg text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950"
              aria-label={`Editar la categoría ${categoria.nombre}`}
              title="Editar"
            >
              <Pencil aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">
            {total} programa{total === 1 ? '' : 's'} · {estudiantes} estudiante
            {estudiantes === 1 ? '' : 's'} activo{estudiantes === 1 ? '' : 's'}
          </p>
        </div>
        {!categoria.activo && <CategoriaEstadoBadge activo={false} />}
      </header>

      {categoria.descripcion && (
        <p className="mt-3 line-clamp-2 px-5 text-sm leading-relaxed text-slate-600">{categoria.descripcion}</p>
      )}

      <div className="flex-1 px-5 py-4">
        {total === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">
            {categoria.programas.length === 0 ? 'Sin programas todavía' : 'Sin programas habilitados'}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {activos.slice(0, VISTA_PREVIA).map((programa) => (
              <li key={programa.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-pradera-500" />
                <span className="truncate">{programa.nombre}</span>
              </li>
            ))}
            {restantes > 0 && (
              <li className="pl-3.5 text-xs text-slate-500">
                y {restantes} más
              </li>
            )}
          </ul>
        )}
      </div>

      <footer className="flex items-center gap-1 border-t border-slate-100 px-3 py-2">
        <Button variant="ghost" icon={Maximize2} onClick={onExpandir} className="flex-1">
          Expandir
        </Button>
        {/* Fase 9: sin handlers (rol sin permiso) no se dibujan. */}
        {onRenombrar && (
          <button
            type="button"
            onClick={onRenombrar}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950"
            aria-label={`Renombrar la categoría ${categoria.nombre}`}
            title="Renombrar"
          >
            <PenLine aria-hidden="true" className="size-4" />
          </button>
        )}
        {onEliminar && (
          <button
            type="button"
            onClick={onEliminar}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
            aria-label={`Eliminar la categoría ${categoria.nombre}`}
            title="Eliminar"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        )}
      </footer>
    </article>
  )
}

export default function ProgramasPage() {
  const toast = useToast()
  const { user } = useAuth()
  const puedeVerEstadisticas = tieneRol(user?.rol, ROLES_ESTADISTICAS)
  const puedeGestionar = tieneRol(user?.rol, ROLES_GESTION_PROGRAMAS)
  const [categorias, setCategorias] = useState([])
  const [eliminando, setEliminando] = useState(false)
  const [status, setStatus] = useState('loading') // loading | ready | error | forbidden
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // { tipo: 'crear' | 'estadisticas' } | { tipo: 'estado' | 'expandir' | 'renombrar' | 'eliminar', id }
  const [modal, setModal] = useState(null)
  const [maestros, setMaestros] = useState({ status: 'idle', items: [] })
  const maestrosStatus = useRef('idle')

  useEffect(() => {
    let cancelado = false
    setStatus('loading')
    listCategorias()
      .then((data) => {
        if (cancelado) return
        setCategorias(data)
        setStatus('ready')
      })
      .catch((error) => {
        if (cancelado) return
        if (error.response?.status === 403) {
          setStatus('forbidden')
          return
        }
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar las categorías.'))
        setStatus('error')
      })
    return () => {
      cancelado = true
    }
  }, [reloadKey])

  // Los maestros solo se piden al abrir el primer formulario de programa.
  const cargarMaestros = useCallback(() => {
    if (maestrosStatus.current === 'ready' || maestrosStatus.current === 'loading') return
    const actualizar = (next) => {
      maestrosStatus.current = next.status
      setMaestros(next)
    }
    actualizar({ status: 'loading', items: [] })
    listMaestros()
      .then((items) => actualizar({ status: 'ready', items }))
      .catch((error) => {
        actualizar({ status: 'error', items: [] })
        toast.error('No fue posible cargar los maestros', getApiErrorMessage(error))
      })
  }, [toast])

  const reemplazarCategoria = useCallback((actualizada) => {
    setCategorias((current) => current.map((item) => (item.id === actualizada.id ? actualizada : item)))
  }, [])

  const agregarCategoria = useCallback((nueva) => {
    setCategorias((current) => [...current, nueva].sort(porNombre))
  }, [])

  // Fase 9: el nombre cambia el orden alfabético de la grilla.
  const renombrarCategoria = useCallback((editada) => {
    setCategorias((current) => current.map((item) => (item.id === editada.id ? editada : item)).sort(porNombre))
  }, [])

  async function confirmarEliminacion() {
    const categoria = categorias.find((item) => item.id === modal?.id)
    if (!categoria) return
    setEliminando(true)
    try {
      await eliminarCategoria(categoria.id)
      setCategorias((current) => current.filter((item) => item.id !== categoria.id))
      toast.success('Categoría eliminada', `«${categoria.nombre}» ya no aparece en el formulario público.`)
      setModal(null)
    } catch (error) {
      // 403 sin texto crudo: mensaje propio.
      const mensaje =
        error.response?.status === 403 ? 'Careces de los suficientes permisos.' : getApiErrorMessage(error)
      toast.error('No fue posible eliminar la categoría', mensaje)
      setModal(null)
    } finally {
      setEliminando(false)
    }
  }

  const cambiarPrograma = useCallback(
    (programa, accion) => {
      const categoriaId = modal?.id
      setCategorias((current) =>
        current.map((item) => (item.id === categoriaId ? aplicarCambioPrograma(item, programa, accion) : item)),
      )
    },
    [modal?.id],
  )

  const closeModal = useCallback(() => setModal(null), [])
  const seleccionada = modal?.id ? categorias.find((item) => item.id === modal.id) : null

  if (status === 'forbidden') return <AccessDenied />

  const activas = categorias.filter((item) => item.activo).length

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">Programas y categorías</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Organice la oferta formativa por categorías, asigne maestros y controle qué aparece en el formulario público
            de inscripción.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {puedeVerEstadisticas && (
            <Button variant="secondary" icon={BarChart3} onClick={() => setModal({ tipo: 'estadisticas' })}>
              Estadísticas
            </Button>
          )}
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={status === 'loading'}
          >
            Actualizar
          </Button>
          <Button icon={FolderPlus} onClick={() => setModal({ tipo: 'crear' })}>
            Crear Categoría
          </Button>
        </div>
      </section>

      {status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-16 text-sm text-slate-500 shadow-panel ring-1 ring-slate-200/80">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando categorías…
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar las categorías</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
            Reintentar
          </Button>
        </div>
      )}

      {status === 'ready' && categorias.length === 0 && (
        <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Layers aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">Aún no hay categorías</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Use "Crear Categoría" para registrar la primera.</p>
        </div>
      )}

      {status === 'ready' && categorias.length > 0 && (
        <>
          <p className="text-sm tabular-nums text-slate-500">
            {categorias.length} categoría{categorias.length === 1 ? '' : 's'} · {activas} habilitada{activas === 1 ? '' : 's'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {categorias.map((categoria) => (
              <CategoriaCard
                key={categoria.id}
                categoria={categoria}
                onEditar={() => setModal({ tipo: 'estado', id: categoria.id })}
                onExpandir={() => setModal({ tipo: 'expandir', id: categoria.id })}
                onRenombrar={puedeGestionar ? () => setModal({ tipo: 'renombrar', id: categoria.id }) : undefined}
                onEliminar={puedeGestionar ? () => setModal({ tipo: 'eliminar', id: categoria.id }) : undefined}
              />
            ))}
          </div>
        </>
      )}

      {puedeVerEstadisticas && modal?.tipo === 'estadisticas' && (
        <Suspense fallback={null}>
          <EstadisticasCategoriasModal isOpen onClose={closeModal} />
        </Suspense>
      )}

      {modal?.tipo === 'crear' && <CategoriaFormModal onClose={closeModal} onCreated={agregarCategoria} />}

      {modal?.tipo === 'renombrar' && seleccionada && (
        <CategoriaFormModal categoria={seleccionada} onClose={closeModal} onUpdated={renombrarCategoria} />
      )}

      {modal?.tipo === 'eliminar' && seleccionada && (
        <ConfirmDialog
          title={`¿Eliminar la categoría «${seleccionada.nombre}»?`}
          description={
            seleccionada.programas.length > 0
              ? `Tiene ${seleccionada.programas.length} programa${seleccionada.programas.length === 1 ? '' : 's'}. Debe eliminarlos o reasignarlos antes de borrar la categoría.`
              : 'La categoría se borrará de forma permanente y dejará de aparecer en el formulario público.'
          }
          confirmLabel="Eliminar"
          tone="danger"
          icon={Trash2}
          loading={eliminando}
          onConfirm={confirmarEliminacion}
          onCancel={closeModal}
        />
      )}

      {modal?.tipo === 'estado' && seleccionada && (
        <CategoriaEstadoModal categoria={seleccionada} onClose={closeModal} onSaved={reemplazarCategoria} />
      )}

      {modal?.tipo === 'expandir' && seleccionada && (
        <CategoriaProgramasModal
          categoria={seleccionada}
          maestros={maestros}
          onNeedMaestros={cargarMaestros}
          onProgramaChange={cambiarPrograma}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
