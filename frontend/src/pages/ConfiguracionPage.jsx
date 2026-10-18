/**
 * Configuración de la cuenta (ruta protegida /dashboard/configuracion, todos los roles).
 *
 * Pestañas:
 *   Mi Perfil  Datos personales del usuario que inició sesión.
 *   Seguridad  Cambio de contraseña.
 *   Sistema    Solo Administrador: inscripciones públicas y periodo académico.
 *
 * La pestaña activa se guarda en la URL (?tab=seguridad) para poder enlazarla.
 * Las pestañas se recorren con las flechas izquierda/derecha (patrón ARIA de tabs).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoaderCircle, RefreshCw, Settings2, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import PerfilTab from '../components/configuracion/PerfilTab'
import SeguridadTab from '../components/configuracion/SeguridadTab'
import SistemaTab from '../components/configuracion/SistemaTab'
import { ROL, claveRol, etiquetaRol } from '../config/roles'
import { useAuth } from '../context/AuthContext'
import { getApiErrorMessage } from '../services/apiClient'
import { getMiPerfil } from '../services/configuracionService'

const TABS = [
  { id: 'perfil', label: 'Mi Perfil', icon: UserRound },
  { id: 'seguridad', label: 'Seguridad', icon: ShieldCheck },
  { id: 'sistema', label: 'Sistema', icon: Settings2, roles: [ROL.ADMINISTRADOR] },
]

export default function ConfiguracionPage() {
  const { user, updateUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabRefs = useRef({})

  const rol = claveRol(user?.rol)
  const tabs = TABS.filter((tab) => !tab.roles || tab.roles.includes(rol))
  const requested = searchParams.get('tab')
  const activeTab = tabs.some((tab) => tab.id === requested) ? requested : 'perfil'

  const [perfil, setPerfil] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('')

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      setPerfil(await getMiPerfil())
      setStatus('ready')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar los datos de su cuenta.'))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function selectTab(id) {
    setSearchParams(id === 'perfil' ? {} : { tab: id }, { replace: true })
  }

  /** Flechas, Inicio y Fin mueven el foco entre pestañas y las activan. */
  function handleTabKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.id === activeTab)
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }
    if (!(event.key in moves)) return
    event.preventDefault()
    const next = tabs[(moves[event.key] + tabs.length) % tabs.length]
    selectTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const handlePerfilSaved = useCallback(
    (actualizado) => {
      setPerfil(actualizado)
      updateUser({ nombre_completo: actualizado.nombre_completo, email: actualizado.email })
    },
    [updateUser],
  )

  const nombre = perfil?.nombre_completo ?? user?.nombre_completo ?? 'Usuario'

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <section className="flex items-center gap-4">
        <Avatar name={nombre} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">Configuración</h1>
          <p className="mt-1 truncate text-[15px] text-slate-600">
            {nombre} · {etiquetaRol(perfil?.rol ?? user?.rol)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
        {/* Pestañas */}
        <div
          role="tablist"
          aria-label="Secciones de configuración"
          className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3 sm:px-5"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                ref={(element) => (tabRefs.current[tab.id] = element)}
                id={`tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${tab.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(tab.id)}
                onKeyDown={handleTabKeyDown}
                className={`-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-pizarra-900 text-pizarra-950'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-pizarra-900'
                }`}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Panel activo */}
        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="focus:outline-none">
          {activeTab === 'seguridad' && <SeguridadTab />}
          {activeTab === 'sistema' && <SistemaTab />}

          {activeTab === 'perfil' && status === 'loading' && (
            <div role="status" className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando sus datos…
            </div>
          )}
          {activeTab === 'perfil' && status === 'error' && (
            <div className="px-6 py-14 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
                <TriangleAlert aria-hidden="true" className="size-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar sus datos</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
              <Button variant="secondary" icon={RefreshCw} onClick={load} className="mt-5">
                Reintentar
              </Button>
            </div>
          )}
          {activeTab === 'perfil' && status === 'ready' && perfil && <PerfilTab perfil={perfil} onSaved={handlePerfilSaved} />}
        </div>
      </section>
    </div>
  )
}
