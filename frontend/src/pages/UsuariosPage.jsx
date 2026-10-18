/**
 * Usuarios y roles (ruta protegida /dashboard/usuarios).
 *
 * Solo Administrador y Coordinador llegan aquí: RoleRoute muestra "Careces de los
 * suficientes permisos" a los demás roles antes de montar la página.
 *
 * Secciones:
 *   1. Encabezado con "Crear usuario".
 *   2. Buscador por documento de identidad (espera 350 ms y cancela la búsqueda anterior).
 *   3. Tabla: las cuentas deshabilitadas se ven atenuadas; el lápiz abre el modal de edición.
 *
 * Alcance (lo aplica la API): el Administrador ve todos los usuarios; el Coordinador,
 * solo Maestros y Estudiantes.
 */
import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, Pencil, RefreshCw, Search, SearchX, TriangleAlert, UserPlus, UsersRound, X } from 'lucide-react'
import AccessDenied from '../components/ui/AccessDenied'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import UsuarioFormModal from '../components/usuarios/UsuarioFormModal'
import { RolBadge, UsuarioEstadoBadge } from '../components/usuarios/UsuarioBadges'
import { ROL, claveRol } from '../config/roles'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import { getCatalogosUsuario, listUsuarios } from '../services/usuariosService'
import { normalizarDocumento } from '../utils/validators'

const PAGE_SIZE = 50
const SEARCH_DELAY_MS = 350

/** Espera a que el usuario deje de escribir antes de buscar. */
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function UsuariosPage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const esAdministrador = claveRol(user?.rol) === ROL.ADMINISTRADOR

  const [buscar, setBuscar] = useState('')
  const documento = useDebouncedValue(normalizarDocumento(buscar), SEARCH_DELAY_MS)

  const [data, setData] = useState({ total: 0, items: [] })
  const [status, setStatus] = useState('loading') // loading | ready | error | forbidden
  const [errorMessage, setErrorMessage] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [catalogos, setCatalogos] = useState(null)
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false)
  const [modal, setModal] = useState(null) // { usuario: object|null } | null

  // Consulta el listado cada vez que cambia la búsqueda; cancela la consulta anterior.
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    listUsuarios({ documento, limit: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setData(result)
        setStatus('ready')
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        // Un 403 aquí significa que el rol cambió durante la sesión: vista amigable, nunca el error crudo.
        if (error.response?.status === 403) {
          setStatus('forbidden')
          return
        }
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar los usuarios.'))
        setStatus('error')
      })
    return () => controller.abort()
  }, [documento, reloadKey])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const result = await listUsuarios({ documento, limit: PAGE_SIZE, offset: data.items.length })
      setData((current) => ({ total: result.total, items: [...current.items, ...result.items] }))
    } catch (error) {
      toast.error('No fue posible cargar más usuarios', getApiErrorMessage(error))
    } finally {
      setLoadingMore(false)
    }
  }

  /** Abre el modal; los catálogos (roles asignables y tipos de documento) se piden una sola vez. */
  async function openModal(usuario) {
    if (catalogos) {
      setModal({ usuario })
      return
    }
    setCargandoCatalogos(usuario?.id ?? 'nuevo')
    try {
      const result = await getCatalogosUsuario()
      setCatalogos(result)
      setModal({ usuario })
    } catch (error) {
      if (error.response?.status === 403) setStatus('forbidden')
      else toast.error('No fue posible abrir el formulario', getApiErrorMessage(error))
    } finally {
      setCargandoCatalogos(false)
    }
  }

  /** Refleja en la tabla el usuario creado o modificado, sin volver a consultar todo el listado. */
  const handleSaved = useCallback(
    (usuario, accion) => {
      setData((current) => {
        if (accion === 'creado') return { total: current.total + 1, items: [usuario, ...current.items] }
        return { ...current, items: current.items.map((item) => (item.id === usuario.id ? usuario : item)) }
      })
      // Si editó su propia cuenta, el encabezado muestra los datos nuevos.
      if (usuario.id === user?.id) {
        updateUser({ nombre_completo: usuario.nombre_completo, email: usuario.email, tipo_documento: usuario.tipo_documento })
      }
    },
    [user?.id, updateUser],
  )

  const closeModal = useCallback(() => setModal(null), [])

  if (status === 'forbidden') return <AccessDenied />

  return (
    <div className="space-y-6">
      {/* 1. Encabezado */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">Usuarios y roles</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            {esAdministrador
              ? 'Cree cuentas, asigne roles y habilite o deshabilite el acceso de cualquier usuario del sistema.'
              : 'Cree y administre las cuentas de maestros y estudiantes.'}
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
          <Button icon={UserPlus} onClick={() => openModal(null)} loading={cargandoCatalogos === 'nuevo'}>
            Crear usuario
          </Button>
        </div>
      </section>

      <section className="rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
        {/* 2. Buscador */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative sm:w-80">
            <label htmlFor="buscar-usuarios" className="sr-only">
              Buscar por documento de identidad
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
            />
            <input
              id="buscar-usuarios"
              type="search"
              inputMode="text"
              value={buscar}
              onChange={(event) => setBuscar(event.target.value)}
              maxLength={20}
              placeholder="Buscar por documento de identidad"
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
          {!esAdministrador && (
            <p className="text-xs text-slate-500">Como Coordinador, solo ve las cuentas de maestros y estudiantes.</p>
          )}
        </div>

        {/* 3. Tabla */}
        {status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando usuarios…
          </div>
        )}

        {status === 'error' && (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
              <TriangleAlert aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar los usuarios</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
            <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
              Reintentar
            </Button>
          </div>
        )}

        {status === 'ready' && data.items.length === 0 && (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              {documento ? <SearchX aria-hidden="true" className="size-6" /> : <UsersRound aria-hidden="true" className="size-6" />}
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">{documento ? 'Sin resultados' : 'Aún no hay usuarios'}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
              {documento
                ? `Ningún usuario tiene un documento que contenga «${documento}».`
                : 'Use el botón "Crear usuario" para registrar la primera cuenta.'}
            </p>
          </div>
        )}

        {status === 'ready' && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium sm:pl-6">Usuario</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Documento</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Rol</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Estado</th>
                    <th scope="col" className="px-4 py-2.5 sm:pr-6">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((usuario) => (
                    <tr
                      key={usuario.id}
                      // Regla visual: las cuentas deshabilitadas se ven sombreadas y en gris.
                      className={`transition-colors ${
                        usuario.activo ? 'hover:bg-slate-50' : 'bg-slate-100/70 text-slate-400 opacity-60 grayscale hover:opacity-80'
                      }`}
                    >
                      <td className="px-4 py-3.5 sm:pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar name={usuario.nombre_completo} className="hidden sm:inline-grid" />
                          <div className="min-w-0">
                            <p className="max-w-[16rem] truncate font-medium text-pizarra-900">
                              {usuario.nombre_completo}
                              {usuario.id === user?.id && <span className="ml-1.5 text-xs font-normal text-slate-500">(usted)</span>}
                            </p>
                            <p className="max-w-[16rem] truncate text-xs text-slate-500">{usuario.email}</p>
                            <p className="text-xs text-slate-500 sm:hidden">
                              {usuario.tipo_documento} {usuario.num_documento}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3.5 text-slate-700 sm:table-cell">
                        <span className="text-xs text-slate-500">{usuario.tipo_documento}</span>{' '}
                        <span className="font-mono text-[13px]">{usuario.num_documento}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <RolBadge rol={usuario.rol} />
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <UsuarioEstadoBadge activo={usuario.activo} />
                      </td>
                      <td className="px-4 py-3.5 text-right sm:pr-6">
                        <button
                          type="button"
                          onClick={() => openModal(usuario)}
                          disabled={cargandoCatalogos !== false}
                          className="inline-grid size-9 place-items-center rounded-lg text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950 disabled:text-slate-300"
                          aria-label={`Editar a ${usuario.nombre_completo}`}
                          title="Editar"
                        >
                          {cargandoCatalogos === usuario.id ? (
                            <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
                          ) : (
                            <Pencil aria-hidden="true" className="size-[18px]" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6">
              <p className="tabular-nums">
                Mostrando {data.items.length} de {data.total} usuario{data.total === 1 ? '' : 's'}
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

      {modal && catalogos && (
        <UsuarioFormModal
          key={modal.usuario?.id ?? 'nuevo'}
          usuario={modal.usuario}
          catalogos={catalogos}
          currentUserId={user?.id}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
