/**
 * Página principal (panel general) que se muestra después de iniciar sesión.
 *
 * Regla de diseño: un indicador solo muestra su cifra cuando es mayor que cero; si es 0,
 * nulo o no se pudo consultar, conserva la raya gris "—" (KpiValue).
 *
 * Contenido por rol (Fase 9):
 *   Administrador  KPIs de solicitudes, solicitudes recientes, Resumen Operativo del Sistema
 *                  (GET /admin/dashboard/resumen-operativo) y módulos del sistema.
 *   Coordinador    KPIs de solicitudes y solicitudes recientes a todo el ancho.
 *   Maestro        KPIs propios, horario semanal y sesiones de hoy (GET /admin/dashboard/maestro).
 *   Estudiante     Sin cambios: indicadores vacíos, sesiones y módulos.
 *
 * El botón "Estadísticas" (Fase 7) sigue disponible para Administrador y Coordinador.
 */
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Inbox,
  PieChart,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  UserCheck,
  UserMinus,
  UserRoundX,
  Users,
} from 'lucide-react'
import HorarioSemanalGrid from '../components/grupos/HorarioSemanalGrid'
import EstadoBadge from '../components/solicitudes/EstadoBadge'
import Button from '../components/ui/Button'
import { BACKOFFICE_ROLES } from '../config/navigation'
import { ROL, ROLES_ESTADISTICAS, etiquetaRol, tieneRol } from '../config/roles'
import { useAuth } from '../context/AuthContext'
import { getPanelMaestro, getResumenOperativo } from '../services/dashboardService'
import { getDashboardKpis, listSolicitudes } from '../services/solicitudesService'
import { formatLongDate, formatShortDate, getFirstName, getGreeting, hoyColombia } from '../utils/formatters'
import { aMinutos, hhmm } from '../utils/horarios'

// Fase 7: Recharts solo se descarga cuando se abre el modal de estadísticas.
const EstadisticasSolicitudesModal = lazy(() => import('../components/estadisticas/EstadisticasSolicitudesModal'))

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

/** Fase 9: indicadores del Maestro (claves de `kpis` en /admin/dashboard/maestro). */
const INDICATORS_MAESTRO = [
  {
    id: 'asignados',
    kpi: 'estudiantes_asignados',
    label: 'Estudiantes asignados',
    caption: 'Con vínculo activo en sus grupos',
    icon: Users,
  },
  {
    id: 'sin-asignacion',
    kpi: 'estudiantes_sin_asignacion',
    label: 'Estudiantes sin asignación',
    caption: 'Aprobados en sus programas sin grupo',
    icon: UserMinus,
  },
  {
    id: 'asistencias',
    kpi: 'asistencias_totales',
    label: 'Asistencias totales',
    caption: 'Registros marcados como presente',
    icon: UserCheck,
  },
  {
    id: 'inasistencias',
    kpi: 'inasistencias_totales',
    label: 'Inasistencias totales',
    caption: 'Registros marcados como ausente',
    icon: UserRoundX,
  },
]

/** Cantidad de solicitudes recientes que se muestran en el panel. */
const RECENT_LIMIT = 5

/** Módulos del sistema y su disponibilidad en la versión actual. */
const MODULES = [
  { name: 'Acceso y autenticación', available: true },
  { name: 'Radicación pública de inscripciones', available: true },
  { name: 'Programas y categorías', available: true },
  { name: 'Grupos', available: true },
  { name: 'Horarios y control de asistencia', available: true },
]

/** Encabezados de la tabla de solicitudes recientes. */
const REQUEST_COLUMNS = ['Radicado', 'Solicitante', 'Programa', 'Estado', 'Fecha']

/** Cada cuánto se recalcula el estado de las sesiones de hoy. */
const RELOJ_MS = 30_000

/** Orden de la tabla de sesiones: en curso, pendientes y realizadas. */
const ORDEN_SESION = { EN_CURSO: 0, PENDIENTE: 1, REALIZADA: 2 }

/** Minutos desde la medianoche en Colombia (UTC-5 fijo, igual que el backend). */
function minutosColombia(now) {
  const fecha = new Date(now - 5 * 60 * 60 * 1000)
  return fecha.getUTCHours() * 60 + fecha.getUTCMinutes()
}

/** Mismo criterio que dashboard_service.estado_sesion. */
function estadoSesion(sesion, ahora) {
  if (aMinutos(sesion.hora_fin) <= ahora) return 'REALIZADA'
  if (aMinutos(sesion.hora_inicio) <= ahora) return 'EN_CURSO'
  return 'PENDIENTE'
}

/**
 * Valor de un indicador. Solo se muestra la cifra si es mayor que cero; en
 * cualquier otro caso (0, nulo, vacío o sin datos) se mantiene la raya gris.
 * `small` se usa en las filas del Resumen Operativo.
 */
function KpiValue({ value, small = false }) {
  const number = Number(value)
  const size = small ? 'text-base' : 'text-3xl'
  if (value !== null && value !== undefined && value !== '' && Number.isFinite(number) && number > 0) {
    return (
      <span className={`${size} font-semibold tracking-tight text-pizarra-950 tabular-nums`}>
        {new Intl.NumberFormat('es-CO').format(number)}
      </span>
    )
  }
  return (
    <>
      <span aria-hidden="true" className={`${size} font-semibold tracking-tight text-pizarra-200 tabular-nums`}>
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

/** Fila de tarjetas KPI. gap-px sobre fondo gris dibuja las líneas divisorias entre tarjetas. */
function IndicatorGrid({ indicators, values, title }) {
  return (
    <section aria-labelledby="titulo-indicadores">
      <h2 id="titulo-indicadores" className="sr-only">
        {title}
      </h2>
      <dl className="grid gap-px overflow-hidden rounded-xl bg-slate-200/70 shadow-panel ring-1 ring-slate-200/80 sm:grid-cols-2 xl:grid-cols-4">
        {indicators.map(({ id, kpi, label, caption, icon: Icon }) => (
          <div key={id} className="bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm font-medium text-slate-600">{label}</dt>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-pizarra-50 text-pizarra-700 ring-1 ring-pizarra-100">
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
            </div>
            {/* Cifra solo si es mayor que cero; si no, raya gris "—" (ver KpiValue). */}
            <dd className="mt-3">
              <KpiValue value={values?.[kpi]} />
            </dd>
            <p className="mt-2 text-sm text-slate-500">{caption}</p>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** Tabla de las últimas solicitudes radicadas (Administrador y Coordinador). */
function SolicitudesRecientes({ recent, className = '' }) {
  return (
    <Panel
      title="Solicitudes recientes"
      description="Últimas solicitudes de inscripción radicadas desde el formulario público."
      className={className}
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
                <span className="font-mono text-[13px] font-semibold text-pizarra-950">{solicitud.numero_radicado}</span>
                <span className="order-3 col-span-2 min-w-0 truncate text-sm text-pizarra-900 md:order-none md:col-span-1">
                  {solicitud.nombre_completo}
                </span>
                <span className="hidden min-w-0 truncate text-sm text-slate-600 md:block">{solicitud.programa}</span>
                <span className="justify-self-end md:justify-self-start">
                  <EstadoBadge estado={solicitud.estado} />
                </span>
                <span className="hidden text-sm text-slate-500 md:block">{formatShortDate(solicitud.fecha_radicacion)}</span>
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
            Cuando una persona radique una solicitud de inscripción, aparecerá aquí con su número de radicado y su
            estado.
          </EmptyState>
        </div>
      )}
    </Panel>
  )
}

/** Estado de los módulos de la plataforma. */
function ModulosSistema() {
  return (
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
  )
}

/** Fase 9 (Administrador): configuración vigente y totales del sistema, con accesos directos. */
function ResumenOperativo({ resumen, status }) {
  const filas = [
    { label: 'Programas activos', value: resumen?.programas_activos },
    { label: 'Grupos creados', value: resumen?.grupos_creados },
    { label: 'Maestros activos', value: resumen?.maestros_activos },
  ]
  return (
    <Panel title="Resumen operativo del sistema" description="Configuración vigente y oferta académica.">
      <dl className="divide-y divide-slate-100">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <dt className="text-sm text-pizarra-900">Inscripciones públicas</dt>
          <dd>
            {status !== 'ready' ? (
              <span className="text-base font-semibold text-pizarra-200">—</span>
            ) : resumen.inscripciones_abiertas ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pradera-50 px-2.5 py-1 text-xs font-medium text-pradera-700 ring-1 ring-pradera-200/70">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-pradera-500" />
                Abiertas
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200/70">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-500" />
                Cerradas
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <dt className="text-sm text-pizarra-900">Periodo académico</dt>
          <dd className={`text-base font-semibold ${resumen?.periodo_academico ? 'text-pizarra-950' : 'text-pizarra-200'}`}>
            {resumen?.periodo_academico || '—'}
          </dd>
        </div>
        {filas.map((fila) => (
          <div key={fila.label} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
            <dt className="text-sm text-pizarra-900">{fila.label}</dt>
            <dd>
              <KpiValue value={fila.value} small />
            </dd>
          </div>
        ))}
      </dl>
      {status === 'error' && (
        <p className="px-5 pb-1 text-xs text-slate-500 sm:px-6">No fue posible consultar el resumen. Recargue la página.</p>
      )}
      <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-3 sm:px-6">
        <Link
          to="/dashboard/configuracion?tab=sistema"
          className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-pizarra-700 transition-colors hover:text-pizarra-950"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Configuración del sistema
        </Link>
        <Link
          to="/dashboard/usuarios"
          className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-pizarra-700 transition-colors hover:text-pizarra-950"
        >
          <Users aria-hidden="true" className="size-4" />
          Gestión de usuarios
        </Link>
      </div>
    </Panel>
  )
}

/** Fase 9 (Maestro): grupos de sus programas que tienen clase hoy, ordenados según la hora de Colombia. */
function SesionesHoy({ panel, status, ahora }) {
  if (status === 'loading') {
    return (
      <Panel title="Sesiones de clase" description="Clases de hoy en sus grupos.">
        <p role="status" className="px-6 py-12 text-center text-sm text-slate-500">
          Cargando sesiones…
        </p>
      </Panel>
    )
  }
  if (status === 'error') {
    return (
      <Panel title="Sesiones de clase" description="Clases de hoy en sus grupos.">
        <EmptyState icon={CalendarDays} title="No fue posible cargar las sesiones">
          Revise su conexión y recargue la página.
        </EmptyState>
      </Panel>
    )
  }

  const sesiones = panel.sesiones_hoy
    .map((sesion) => ({ ...sesion, estado: estadoSesion(sesion, ahora) }))
    .sort((a, b) => ORDEN_SESION[a.estado] - ORDEN_SESION[b.estado] || aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio))

  return (
    <Panel title="Sesiones de clase" description="Clases de hoy en sus grupos.">
      {panel.festivo ? (
        <EmptyState icon={CalendarDays} title={`Hoy es festivo: ${panel.festivo}`}>
          No hay sesiones de clase programadas.
        </EmptyState>
      ) : sesiones.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No tiene clases hoy">
          Las sesiones aparecen aquí los días en que sus grupos tienen horario.
        </EmptyState>
      ) : (
        <ul className="space-y-2 p-3 sm:p-4">
          {sesiones.map((sesion) => (
            <li
              key={`${sesion.grupo_id}-${sesion.hora_inicio}`}
              className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 ${
                sesion.estado === 'EN_CURSO'
                  ? 'border-pradera-200 bg-pradera-50'
                  : sesion.estado === 'REALIZADA'
                    ? 'border-slate-200 bg-slate-100/70 text-slate-400'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <span
                className={`w-[5.5rem] shrink-0 text-sm font-semibold tabular-nums ${
                  sesion.estado === 'REALIZADA' ? 'text-slate-400' : 'text-pizarra-950'
                }`}
              >
                {hhmm(sesion.hora_inicio)}–{hhmm(sesion.hora_fin)}
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  to={`/dashboard/asistencias?grupo=${sesion.grupo_id}`}
                  className={`block truncate text-sm font-medium hover:underline ${
                    sesion.estado === 'REALIZADA' ? 'text-slate-400' : 'text-pizarra-900'
                  }`}
                >
                  {sesion.grupo_nombre}
                </Link>
                <span className={`block truncate text-xs ${sesion.estado === 'REALIZADA' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {sesion.programa_nombre} · {sesion.estudiantes_activos} estudiante
                  {sesion.estudiantes_activos === 1 ? '' : 's'}
                </span>
              </span>
              {/* Solo en curso y realizada llevan etiqueta; las pendientes no. */}
              {sesion.estado === 'EN_CURSO' && (
                <span className="shrink-0 rounded-full bg-pradera-600 px-2 py-0.5 text-[11px] font-medium text-white">
                  En curso
                </span>
              )}
              {sesion.estado === 'REALIZADA' && (
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Realizada
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** Fase 9 (Maestro): grilla semanal limitada a las horas que usan sus grupos. */
function HorarioMaestro({ panel, status, className = '' }) {
  const conHorario = panel?.grupos.some((grupo) => grupo.horarios.length > 0)
  return (
    <Panel title="Horario semanal" description="Grupos de los programas que tiene asignados." className={className}>
      {status === 'loading' && (
        <p role="status" className="px-6 py-12 text-center text-sm text-slate-500">
          Cargando horario…
        </p>
      )}
      {status === 'error' && (
        <EmptyState icon={CalendarRange} title="No fue posible cargar el horario">
          Revise su conexión y recargue la página.
        </EmptyState>
      )}
      {status === 'ready' && !conHorario && (
        <EmptyState icon={CalendarRange} title="Aún no hay horarios registrados">
          El horario aparecerá cuando sus grupos tengan bloques de clase asignados.
        </EmptyState>
      )}
      {status === 'ready' && conHorario && (
        <div className="p-3 sm:p-4">
          <HorarioSemanalGrid grupos={panel.grupos} diaHoy={panel.dia_semana} ajustarRango />
        </div>
      )}
    </Panel>
  )
}

export default function DashboardBasePage() {
  const { user } = useAuth()
  const now = new Date()
  const canManageRequests = BACKOFFICE_ROLES.includes(user?.rol)
  const esAdministrador = tieneRol(user?.rol, [ROL.ADMINISTRADOR])
  const esCoordinador = tieneRol(user?.rol, [ROL.COORDINADOR])
  const esMaestro = tieneRol(user?.rol, [ROL.MAESTRO])

  const [kpis, setKpis] = useState(null)
  const [recent, setRecent] = useState([])
  const puedeVerEstadisticas = tieneRol(user?.rol, ROLES_ESTADISTICAS)
  const [estadisticasAbiertas, setEstadisticasAbiertas] = useState(false)

  const [resumen, setResumen] = useState({ status: 'loading', data: null })
  const [panelMaestro, setPanelMaestro] = useState({ status: 'loading', data: null })
  const [reloj, setReloj] = useState(() => Date.now())

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

  // Resumen operativo: solo Administrador.
  useEffect(() => {
    if (!esAdministrador) return undefined
    let cancelled = false
    getResumenOperativo()
      .then((data) => !cancelled && setResumen({ status: 'ready', data }))
      .catch(() => !cancelled && setResumen({ status: 'error', data: null }))
    return () => {
      cancelled = true
    }
  }, [esAdministrador])

  const cargarPanelMaestro = useCallback(() => {
    let cancelled = false
    getPanelMaestro()
      .then((data) => !cancelled && setPanelMaestro({ status: 'ready', data }))
      .catch(() => !cancelled && setPanelMaestro({ status: 'error', data: null }))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => (esMaestro ? cargarPanelMaestro() : undefined), [esMaestro, cargarPanelMaestro])

  // Reloj del Maestro: reordena las sesiones y, si cambió el día en Colombia, vuelve a consultar.
  useEffect(() => {
    if (!esMaestro) return undefined
    const id = setInterval(() => setReloj(Date.now()), RELOJ_MS)
    return () => clearInterval(id)
  }, [esMaestro])

  const hoyPanel = panelMaestro.data?.hoy
  useEffect(() => {
    if (hoyPanel && hoyPanel !== hoyColombia(reloj)) return cargarPanelMaestro()
    return undefined
  }, [hoyPanel, reloj, cargarPanelMaestro])

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
            {esMaestro
              ? 'Este es el resumen de sus grupos: estudiantes, asistencia, horario y las clases de hoy.'
              : 'Este es el resumen de la Casa de la Cultura. Los indicadores se completarán a medida que se radiquen solicitudes y se conformen los grupos.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-pizarra-800 ring-1 ring-slate-200">
            <ShieldCheck aria-hidden="true" className="size-4 text-pradera-600" />
            {etiquetaRol(user?.rol)}
          </span>
          {/* Fase 7: solo Administrador y Coordinador. */}
          {puedeVerEstadisticas && (
            <Button variant="secondary" icon={PieChart} onClick={() => setEstadisticasAbiertas(true)}>
              Estadísticas
            </Button>
          )}
        </div>
      </section>

      {puedeVerEstadisticas && estadisticasAbiertas && (
        <Suspense fallback={null}>
          <EstadisticasSolicitudesModal isOpen onClose={() => setEstadisticasAbiertas(false)} />
        </Suspense>
      )}

      {/* 2. Indicadores */}
      {esMaestro ? (
        <IndicatorGrid indicators={INDICATORS_MAESTRO} values={panelMaestro.data?.kpis} title="Indicadores de sus grupos" />
      ) : (
        <IndicatorGrid indicators={INDICATORS} values={kpis} title="Indicadores generales" />
      )}

      {/* 3. Contenido por rol */}
      {esAdministrador && (
        <div className="grid gap-6 lg:grid-cols-3">
          <SolicitudesRecientes recent={recent} className="lg:col-span-2" />
          <div className="space-y-6">
            <ResumenOperativo resumen={resumen.data} status={resumen.status} />
            <ModulosSistema />
          </div>
        </div>
      )}

      {/* Coordinador: sin sesiones ni módulos; la tabla ocupa todo el ancho. */}
      {esCoordinador && <SolicitudesRecientes recent={recent} />}

      {esMaestro && (
        <div className="grid gap-6 xl:grid-cols-3">
          {/* min-w-0: la grilla tiene ancho mínimo y se desplaza dentro del panel. */}
          <HorarioMaestro panel={panelMaestro.data} status={panelMaestro.status} className="min-w-0 xl:col-span-2" />
          <div className="space-y-6">
            <SesionesHoy panel={panelMaestro.data} status={panelMaestro.status} ahora={minutosColombia(reloj)} />
            <ModulosSistema />
          </div>
        </div>
      )}

      {/* Otros roles (Estudiante): misma vista de antes de la Fase 9. */}
      {!esAdministrador && !esCoordinador && !esMaestro && (
        <div className="grid gap-6 lg:grid-cols-3">
          <SolicitudesRecientes recent={recent} className="lg:col-span-2" />
          <div className="space-y-6">
            <Panel title="Próximas sesiones de clase">
              <EmptyState icon={CalendarDays} title="No hay sesiones programadas">
                Las sesiones aparecerán cuando se creen los grupos y se asignen sus docentes.
              </EmptyState>
            </Panel>
            <ModulosSistema />
          </div>
        </div>
      )}
    </div>
  )
}
