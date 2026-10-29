/**
 * Modal "Asignar estudiantes": solicitudes aprobadas del programa que aún no están en el grupo.
 * La búsqueda filtra en el navegador por nombre o número de documento.
 *
 * @param {object} props
 * @param {object} props.grupo
 * @param {() => void} props.onClose
 * @param {(asignados: number) => void} props.onAssigned
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, RefreshCw, Search, TriangleAlert, UserPlus, UsersRound } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { asignarEstudiantes, listEstudiantesDisponibles } from '../../services/gruposService'

// Sin tildes ni mayúsculas: "jose" encuentra a "JOSÉ".
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export default function AsignarEstudiantesModal({ grupo, onClose, onAssigned }) {
  const toast = useToast()
  const [estado, setEstado] = useState({ status: 'loading', items: [], error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState(() => new Set())
  const [enviando, setEnviando] = useState(false)
  const todosRef = useRef(null)

  useEffect(() => {
    let cancelado = false
    setEstado((current) => ({ ...current, status: 'loading' }))
    listEstudiantesDisponibles(grupo.id)
      .then((items) => {
        if (cancelado) return
        setEstado({ status: 'ready', items, error: '' })
        // Quien ya no está disponible no puede seguir seleccionado.
        setSeleccion((current) => new Set(items.filter((item) => current.has(item.solicitud_id)).map((item) => item.solicitud_id)))
      })
      .catch((error) => {
        if (!cancelado) setEstado({ status: 'error', items: [], error: getApiErrorMessage(error) })
      })
    return () => {
      cancelado = true
    }
  }, [grupo.id, reloadKey])

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    if (!termino) return estado.items
    return estado.items.filter(
      (item) => normalizar(item.nombre_completo).includes(termino) || item.numero_documento.includes(termino),
    )
  }, [busqueda, estado.items])

  const visiblesSeleccionados = visibles.filter((item) => seleccion.has(item.solicitud_id)).length
  const todosMarcados = visibles.length > 0 && visiblesSeleccionados === visibles.length

  useEffect(() => {
    if (todosRef.current) todosRef.current.indeterminate = visiblesSeleccionados > 0 && !todosMarcados
  }, [visiblesSeleccionados, todosMarcados])

  function alternar(id) {
    setSeleccion((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // "Seleccionar todos" actúa sobre el resultado de la búsqueda, no sobre la lista completa.
  function alternarTodos() {
    setSeleccion((current) => {
      const next = new Set(current)
      for (const item of visibles) {
        if (todosMarcados) next.delete(item.solicitud_id)
        else next.add(item.solicitud_id)
      }
      return next
    })
  }

  async function handleAsignar() {
    setEnviando(true)
    try {
      const { asignados } = await asignarEstudiantes(grupo.id, [...seleccion])
      toast.success(
        'Estudiantes asignados',
        `${asignados} estudiante${asignados === 1 ? '' : 's'} ingresaron a «${grupo.nombre}».`,
      )
      onAssigned(asignados)
      onClose()
    } catch (error) {
      toast.error('No fue posible asignar los estudiantes', getApiErrorMessage(error))
      if (error.response?.status === 400) setReloadKey((key) => key + 1)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      titleId="titulo-asignar"
      size="xl"
      dismissible={!enviando}
      onClose={onClose}
      header={
        <>
          <p className="text-xs font-medium text-slate-500">Asignar estudiantes</p>
          <h2 id="titulo-asignar" className="mt-0.5 text-lg font-semibold text-pizarra-950">
            {grupo.nombre} ({grupo.programa_nombre})
          </h2>
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button icon={UserPlus} onClick={handleAsignar} loading={enviando} loadingText="Asignando…" disabled={seleccion.size === 0}>
            Asignar Seleccionados{seleccion.size > 0 ? ` (${seleccion.size})` : ''}
          </Button>
        </>
      }
    >
      <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o número de documento"
            aria-label="Buscar estudiantes"
            autoComplete="off"
            disabled={estado.status !== 'ready'}
            className="block h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15 disabled:bg-slate-50"
          />
        </div>
      </div>

      {estado.status === 'loading' && (
        <div role="status" className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-slate-500">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando estudiantes…
        </div>
      )}

      {estado.status === 'error' && (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
            <TriangleAlert aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar los estudiantes</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{estado.error}</p>
          <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
            Reintentar
          </Button>
        </div>
      )}

      {estado.status === 'ready' && visibles.length === 0 && (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <UsersRound aria-hidden="true" className="size-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-pizarra-900">
            {estado.items.length === 0 ? 'No hay estudiantes disponibles' : 'Sin resultados'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {estado.items.length === 0
              ? `Todas las solicitudes aprobadas de ${grupo.programa_nombre} ya están en este grupo.`
              : 'Ningún estudiante coincide con la búsqueda.'}
          </p>
        </div>
      )}

      {estado.status === 'ready' && visibles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
              <tr>
                <th scope="col" className="w-12 px-4 py-2.5 sm:pl-6">
                  <input
                    ref={todosRef}
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    disabled={enviando}
                    aria-label="Seleccionar todos"
                    title="Seleccionar todos"
                    className="size-4 rounded border-slate-300 accent-pizarra-900"
                  />
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">Nombre completo</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Documento</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell sm:pr-6">Radicado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((estudiante) => {
                const marcado = seleccion.has(estudiante.solicitud_id)
                return (
                  <tr
                    key={estudiante.solicitud_id}
                    onClick={() => !enviando && alternar(estudiante.solicitud_id)}
                    className={`cursor-pointer transition-colors ${marcado ? 'bg-pizarra-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-3 sm:pl-6">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternar(estudiante.solicitud_id)}
                        onClick={(event) => event.stopPropagation()}
                        disabled={enviando}
                        aria-label={`Seleccionar a ${estudiante.nombre_completo}`}
                        className="size-4 rounded border-slate-300 accent-pizarra-900"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-pizarra-900">{estudiante.nombre_completo}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                      {estudiante.tipo_documento} {estudiante.numero_documento}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-500 sm:table-cell sm:pr-6">
                      {estudiante.numero_radicado}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {estado.status === 'ready' && estado.items.length > 0 && (
        <p className="border-t border-slate-100 px-4 py-3 text-xs tabular-nums text-slate-500 sm:px-6">
          {estado.items.length} disponible{estado.items.length === 1 ? '' : 's'} · {seleccion.size} seleccionado
          {seleccion.size === 1 ? '' : 's'}
        </p>
      )}
    </Modal>
  )
}
