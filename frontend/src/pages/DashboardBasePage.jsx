/**
 * Página principal (panel general) que se muestra después de iniciar sesión.
 *
 * Los indicadores se leen de GET /admin/dashboard/kpis. Regla de diseño: un
 * indicador solo muestra su cifra cuando es mayor que cero; si es 0, nulo o no
 * se pudo consultar, conserva la raya gris "—".
 *
 * Secciones:
 *   1. Encabezado con fecha, saludo y rol del usuario.
 *   2. Indicadores (KPI) del periodo.
 *   3. Solicitudes recientes.
 *   4. Próximas sesiones de clase y estado de los módulos del sistema.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Inbox,
  ShieldCheck,
  Stamp,
} from 'lucide-react'
import EstadoBadge from '../components/solicitudes/EstadoBadge'
import { BACKOFFICE_ROLES } from '../config/navigation'
import { etiquetaRol } from '../config/roles'
import { useAuth } from '../context/AuthContext'
import { getDashboardKpis, listSolicitudes } from '../services/solicitudesService'
import { formatLongDate, formatShortDate, getFirstName, getGreeting } from '../utils/formatters'

/** Indicadores del panel. `kpi` es la clave correspondiente en la respuesta de /admin/dashboard/kpis. */
const INDICATORS = [
  {
    id: 'radicadas',
    kpi: 'total',
    label: 'Solicitudes radicadas',
    caption: 'Recibidas desde el formulario público',
    icon: Stamp,
  },
  {
    id: 'pendientes',
    kpi: 'pendientes',
    label: 'Pendientes de revisión',
    caption: 'Esperan validación de documentos',
    icon: ClipboardCheck,
  },
  {
    id: 'aprobadas',
    kpi: 'aprobadas',
    label: 'Solicitudes aprobadas',
    caption: 'Con documentación validada',
    icon: CircleCheck,
  },
  {
    id: 'rechazadas',
    kpi: 'rechazadas',
    label: 'Solicitudes rechazadas',
    caption: 'No cumplieron los requisitos',
    icon: CircleX,
  },
]

/** Cantidad de solicitudes recientes que se muestran en el panel. */
const RECENT_LIMIT = 5

/** Módulos del sistema y su disponibilidad en la versión actual. */
const MODULES = [
  { name: 'Acceso y autenticación', available: true },
  { name: 'Radicación pública de inscripciones', available: true },
  { name: 'Programas y grupos', available: false },
  { name: 'Control de asistencia', available: false },
]

/** Encabezados de la tabla de solicitudes recientes. */
const REQUEST_COLUMNS = ['Radicado', 'Solicitante', 'Programa', 'Estado', 'Fecha']

/**
 * Valor de un indicador. Solo se muestra la cifra si es mayor que cero; en
 * cualquier otro caso (0, nulo, vacío o sin datos) se mantiene la raya gris.
 */
function KpiValue({ value }) {
  const number = Number(value)
  if (value !== null && value !== undefined && value !== '' && Number.isFinite(number) && number > 0) {
    return (
      <span className="text-3xl font-semibold tracking-tight text-pizarra-950 tabular-nums">
        {new Intl.NumberFormat('es-CO').format(number)}
      </span>
    )
  }
  return (
    <>
      <span aria-hidden="true" className="text-3xl font-semibold tracking-tight text-pizarra-200 tabular-nums">
        —
      </span>
      <span className="sr-only">Sin datos registrados</span>
    </>
  )
}

/** Tarjeta contenedora con título y descripción opcional. */
function Panel({ title, description, children, className = '' }) {
  return (
    <section className={`flex flex-col rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80 ${className}`}>
      <header className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h2 className="text-[15px] font-semibold text-pizarra-950">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </header>
      {children}
    </section>
  )
}

/** Mensaje para secciones sin datos: icono, título y explicación de cuándo habrá información. */
function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="px-6 py-12 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-pizarra-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{children}</p>
    </div>
  )
}

export default function DashboardBasePage() {
  const { user } = useAuth()
  const now = new Date()
  const canManageRequests = BACKOFFICE_ROLES.includes(user?.rol)

  const [kpis, setKpis] = useState(null)
  const [recent, setRecent] = useState([])

  // Indicadores y solicitudes recientes. Si la consulta falla, se conservan las rayas y el estado vacío.
  useEffect(() => {
    if (!canManageRequests) return undefined
    let cancelled = false
    getDashboardKpis()
      .then((data) => !cancelled && setKpis(data))
      .catch(() => !cancelled && setKpis(null))
    listSolicitudes({ limit: RECENT_LIMIT })
      .then((data) => !cancelled && setRecent(data.items))
      .catch(() => !cancelled && setRecent([]))
    return () => {
      cancelled = true
    }
  }, [canManageRequests])

  return (
    <div className="space-y-8">
      {/* 1. Encabezado de la página */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{formatLongDate(now)}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">
            {getGreeting(now)}, {getFirstName(user?.nombre_completo)}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Este es el resumen de la Casa de la Cultura. Los indicadores se completarán a medida que se
            radiquen solicitudes y se conformen los grupos.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-1.5 text-sm font-medium text-pizarra-800 ring-1 ring-slate-200 sm:self-auto">
          <ShieldCheck aria-hidden="true" className="size-4 text-pradera-600" />
          {etiquetaRol(user?.rol)}
        </span>
      </section>

      {/* 2. Indicadores. gap-px sobre fondo gris dibuja las líneas divisorias entre tarjetas. */}
      <section aria-labelledby="titulo-indicadores">
        <h2 id="titulo-indicadores" className="sr-only">
          Indicadores generales
        </h2>
        <dl className="grid gap-px overflow-hidden rounded-xl bg-slate-200/70 shadow-panel ring-1 ring-slate-200/80 sm:grid-cols-2 xl:grid-cols-4">
          {INDICATORS.map(({ id, kpi, label, caption, icon: Icon }) => (
            <div key={id} className="bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-sm font-medium text-slate-600">{label}</dt>
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-pizarra-50 text-pizarra-700 ring-1 ring-pizarra-100">
                  <Icon aria-hidden="true" className="size-[18px]" />
                </span>
              </div>
              {/* Cifra solo si es mayor que cero; si no, raya gris "—" (ver KpiValue). */}
              <dd className="mt-3">
                <KpiValue value={kpis?.[kpi]} />
              </dd>
              <p className="mt-2 text-sm text-slate-500">{caption}</p>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 3. Solicitudes recientes (ocupa dos de las tres columnas en escritorio) */}
        <Panel
          title="Solicitudes recientes"
          description="Últimas solicitudes de inscripción radicadas desde el formulario público."
          className="lg:col-span-2"
        >
          {/* Encabezados de la tabla; se ocultan en móvil, donde las filas se mostrarán como tarjetas. */}
          <div className="hidden border-b border-slate-100 bg-slate-50/60 px-6 py-2.5 md:grid md:grid-cols-[1.1fr_1.4fr_1.2fr_0.9fr_0.8fr] md:gap-4">
            {REQUEST_COLUMNS.map((column) => (
              <span key={column} className="text-xs font-medium text-slate-500">
                {column}
              </span>
            ))}
          </div>
          {recent.length > 0 ? (
            <>
              <ul className="divide-y divide-slate-100">
                {recent.map((solicitud) => (
                  <li
                    key={solicitud.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:px-6 md:grid-cols-[1.1fr_1.4fr_1.2fr_0.9fr_0.8fr]"
                  >
                    <span className="font-mono text-[13px] font-semibold text-pizarra-950">
                      {solicitud.numero_radicado}
                    </span>
                    <span className="order-3 col-span-2 min-w-0 truncate text-sm text-pizarra-900 md:order-none md:col-span-1">
                      {solicitud.nombre_completo}
                    </span>
                    <span className="hidden min-w-0 truncate text-sm text-slate-600 md:block">{solicitud.programa}</span>
                    <span className="justify-self-end md:justify-self-start">
                      <EstadoBadge estado={solicitud.estado} />
                    </span>
                    <span className="hidden text-sm text-slate-500 md:block">
                      {formatShortDate(solicitud.fecha_radicacion)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t border-slate-100 px-5 py-3 sm:px-6">
                <Link
                  to="/dashboard/solicitudes"
                  className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-pizarra-700 transition-colors hover:text-pizarra-950"
                >
                  Ver todas las solicitudes
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </>
          ) : (
            /* El estado vacío se centra en el alto disponible del panel. */
            <div className="grid flex-1 place-items-center">
              <EmptyState icon={Inbox} title="Aún no hay solicitudes radicadas">
                Cuando una persona radique una solicitud de inscripción, aparecerá aquí con su número de
                radicado y su estado.
              </EmptyState>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          {/* 4a. Próximas sesiones */}
          <Panel title="Próximas sesiones de clase">
            <EmptyState icon={CalendarDays} title="No hay sesiones programadas">
              Las sesiones aparecerán cuando se creen los grupos y se asignen sus docentes.
            </EmptyState>
          </Panel>

          {/* 4b. Estado de los módulos */}
          <Panel title="Módulos del sistema" description="Disponibilidad de las funciones de la plataforma.">
            <ul className="divide-y divide-slate-100">
              {MODULES.map((module) => (
                <li key={module.name} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
                  <span className="text-sm text-pizarra-900">{module.name}</span>
                  {module.available ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-pradera-50 px-2.5 py-1 text-xs font-medium text-pradera-700 ring-1 ring-pradera-200/70">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-pradera-500" />
                      Disponible
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-slate-300" />
                      En preparación
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
