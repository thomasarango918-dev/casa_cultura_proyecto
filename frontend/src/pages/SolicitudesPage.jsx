/**
 * Gestión de solicitudes de inscripción (ruta protegida /dashboard/solicitudes).
 *
 * Se muestra dentro de MainLayout (barra lateral y encabezado del BackOffice).
 *
 * Secciones:
 *   1. Encabezado con acciones (actualizar, abrir el formulario público).
 *   2. Filtros por estado (con sus conteos) y buscador.
 *   3. Tabla de solicitudes; al elegir una fila se abre el modal de evaluación.
 *
 * Al evaluar una solicitud la fila se actualiza en el acto (o sale del listado
 * si ya no cumple el filtro) y los conteos se vuelven a consultar.
 */
import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, Inbox, LoaderCircle, Paperclip, RefreshCw, Search, SearchX, TriangleAlert, X } from 'lucide-react'
import Button from '../components/ui/Button'
import EstadoBadge from '../components/solicitudes/EstadoBadge'
import EvaluacionModal from '../components/solicitudes/EvaluacionModal'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import { getDashboardKpis, listSolicitudes } from '../services/solicitudesService'
import { formatDateTime, formatShortDate } from '../utils/formatters'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 350

/** Filtros por estado; `kpi` es la clave del conteo en /admin/dashboard/kpis. */
const FILTROS = [
  { value: '', label: 'Todas', kpi: 'total' },
  { value: 'PENDIENTE', label: 'Pendientes', kpi: 'pendientes' },
  { value: 'APROBADO', label: 'Aprobadas', kpi: 'aprobadas' },
  { value: 'RECHAZADO', label: 'Rechazadas', kpi: 'rechazadas' },
]

/** Espera a que el usuario deje de escribir antes de buscar. */
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function SolicitudesPage() {
  const toast = useToast()
  const [estado, setEstado] = useState('PENDIENTE')
  const [buscar, setBuscar] = useState('')
  const buscarDebounced = useDebouncedValue(buscar.trim(), SEARCH_DELAY_MS)

  const [data, setData] = useState({ total: 0, items: [] })
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [kpis, setKpis] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState(null)

  const loadKpis = useCallback(() => {
    getDashboardKpis()
      .then(setKpis)
      .catch(() => setKpis(null))
  }, [])

  useEffect(() => {
    loadKpis()
  }, [loadKpis, reloadKey])

  // Consulta el listado cada vez que cambian el filtro o la búsqueda; cancela la consulta anterior.
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listSolicitudes({ estado, buscar: buscarDebounced, limit: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setData(result)
        setStatus('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar las solicitudes.'))
        setStatus('error')
      })
    return () => controller.abort()
  }, [estado, buscarDebounced, reloadKey])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const result = await listSolicitudes({
        estado,
        buscar: buscarDebounced,
        limit: PAGE_SIZE,
        offset: data.items.length,
      })
      setData((current) => ({ total: result.total, items: [...current.items, ...result.items] }))
    } catch (error) {
      toast.error('No fue posible cargar más solicitudes', getApiErrorMessage(error))
    } finally {
      setLoadingMore(false)
    }
  }

  /** Refleja la evaluación en la tabla sin volver a consultar todo el listado. */
  const handleEvaluated = useCallback(
    (detalle) => {
      setData((current) => {
        const sigueEnFiltro = !estado || detalle.estado === estado
        if (!sigueEnFiltro) {
          return { total: Math.max(current.total - 1, 0), items: current.items.filter((item) => item.id !== detalle.id) }
        }
        return {
          ...current,
          items: current.items.map((item) => (item.id === detalle.id ? { ...item, estado: detalle.estado } : item)),
        }
      })
      loadKpis()
    },
    [estado, loadKpis],
  )

  const closeModal = useCallback(() => setSelectedId(null), [])
  const hasFilters = Boolean(buscarDebounced)

  return (
    <div className="space-y-6">
      {/* 1. Encabezado */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">
            Solicitudes de inscripción
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Revise los documentos de cada solicitud radicada y registre la decisión con su justificación.
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
          <a
            href="/inscripcion"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-pizarra-700 transition-colors hover:bg-slate-100"
          >
            <ExternalLink aria-hidden="true" className="size-[18px]" />
            Formulario público
          </a>
        </div>
      </section>

      <section className="rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
        {/* 2. Filtros y buscador */}
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Filtrar por estado" className="-mx-1 flex gap-1 overflow-x-auto px-1">
            {FILTROS.map((filtro) => {
              const active = estado === filtro.value
              const count = kpis?.[filtro.kpi]
              return (
                <button
                  key={filtro.value || 'todas'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEstado(filtro.value)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                    active ? 'bg-pizarra-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-pizarra-900'
                  }`}
                >
                  {filtro.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                        active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="relative lg:w-80">
            <label htmlFor="buscar-solicitudes" className="sr-only">
              Buscar solicitudes
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
            />
            <input
              id="buscar-solicitudes"
              type="search"
              value={buscar}
              onChange={(event) => setBuscar(event.target.value)}
              maxLength={100}
              placeholder="Radicado, nombre, documento o correo"
              className="block h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-9 text-sm text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15 [&::-webkit-search-cancel-button]:hidden"
            />
            {buscar && (
              <button
                type="button"
                onClick={() => setBuscar('')}
                className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Limpiar búsqueda"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Tabla */}
        {status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando solicitudes…
          </div>
        )}

        {status === 'error' && (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
              <TriangleAlert aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar las solicitudes</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
            <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
              Reintentar
            </Button>
          </div>
        )}

        {status === 'ready' && data.items.length === 0 && (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              {hasFilters ? <SearchX aria-hidden="true" className="size-6" /> : <Inbox aria-hidden="true" className="size-6" />}
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">
              {hasFilters ? 'Sin resultados' : 'No hay solicitudes en esta categoría'}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
              {hasFilters
                ? 'Ninguna solicitud coincide con la búsqueda. Revise el texto o cambie el filtro de estado.'
                : 'Las solicitudes radicadas desde el formulario público aparecerán aquí.'}
            </p>
          </div>
        )}

        {status === 'ready' && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium sm:pl-6">Radicado</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Solicitante</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Programa</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Documentos</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Fecha</th>
                    <th scope="col" className="px-4 py-2.5 sm:pr-6">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((solicitud) => (
                    <tr
                      key={solicitud.id}
                      onClick={() => setSelectedId(solicitud.id)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[13px] font-semibold text-pizarra-950 sm:pl-6">
                        {solicitud.numero_radicado}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-[16rem] truncate font-medium text-pizarra-900">{solicitud.nombre_completo}</p>
                        <p className="text-xs text-slate-500">
                          {solicitud.tipo_documento} {solicitud.numero_documento}
                          {solicitud.edad !== null && ` · ${solicitud.edad} años`}
                          {solicitud.es_menor_de_edad && (
                            <span className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200/80">
                              Menor
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3.5 text-slate-700 md:table-cell">{solicitud.programa}</td>
                      <td className="hidden px-4 py-3.5 lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Paperclip aria-hidden="true" className="size-3.5 text-slate-400" />
                          <span className="tabular-nums">{solicitud.total_documentos}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <EstadoBadge estado={solicitud.estado} />
                      </td>
                      <td
                        className="hidden whitespace-nowrap px-4 py-3.5 text-slate-600 sm:table-cell"
                        title={formatDateTime(solicitud.fecha_radicacion)}
                      >
                        {formatShortDate(solicitud.fecha_radicacion)}
                      </td>
                      <td className="px-4 py-3.5 text-right sm:pr-6">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedId(solicitud.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950"
                          aria-label={`${solicitud.estado === 'PENDIENTE' ? 'Revisar' : 'Ver'} solicitud ${solicitud.numero_radicado}`}
                        >
                          {solicitud.estado === 'PENDIENTE' ? 'Revisar' : 'Ver'}
                          <ChevronRight aria-hidden="true" className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6">
              <p className="tabular-nums">
                Mostrando {data.items.length} de {data.total} solicitud{data.total === 1 ? '' : 'es'}
              </p>
              {data.items.length < data.total && (
                <Button variant="ghost" loading={loadingMore} loadingText="Cargando…" onClick={loadMore}>
                  Cargar más
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {selectedId !== null && (
        <EvaluacionModal solicitudId={selectedId} onClose={closeModal} onEvaluated={handleEvaluated} />
      )}
    </div>
  )
}
