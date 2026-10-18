/**
 * Pestaña "Sistema" (solo Administrador): configuración global de la aplicación.
 *
 *   - "Habilitar Inscripciones Públicas": si se apaga, /inscripcion muestra
 *     "En este momento no hay convocatorias abiertas" y la API rechaza radicaciones (403).
 *   - "Periodo Académico Actual" (ej. 2026-2): se guarda en cada solicitud radicada.
 *
 * Endpoints: GET/PUT /admin/configuracion/sistema. La pestaña solo se muestra al
 * Administrador (ConfiguracionPage) y la API responde 403 a los demás roles.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarRange, LoaderCircle, RefreshCw, Save, TriangleAlert } from 'lucide-react'
import AccessDenied from '../ui/AccessDenied'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import Toggle from '../ui/Toggle'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { actualizarConfiguracionSistema, getConfiguracionSistema } from '../../services/configuracionService'

// Deben coincidir con backend/app/schemas/configuracion_schema.py.
const PERIODO_MAX = 20
const PERIODO_PATTERN = /^[0-9A-Z]+(?:[- ][0-9A-Z]+)*$/

/** ' 2026 - 2 ' -> '2026-2' (misma normalización que la API). */
function normalizarPeriodo(value) {
  return value.trim().split(/\s+/).join(' ').toUpperCase().replace(/\s*-\s*/g, '-')
}

function validarPeriodo(value) {
  if (!value) return 'Escriba el periodo académico. Ejemplo: 2026-2.'
  if (value.length > PERIODO_MAX) return `El periodo académico admite máximo ${PERIODO_MAX} caracteres.`
  if (!PERIODO_PATTERN.test(value)) return 'Use solo letras y números, separados por un guion. Ejemplo: 2026-2.'
  return ''
}

export default function SistemaTab() {
  const toast = useToast()
  const periodoRef = useRef(null)

  const [status, setStatus] = useState('loading') // loading | ready | error | forbidden
  const [errorMessage, setErrorMessage] = useState('')
  const [guardado, setGuardado] = useState(null)
  const [form, setForm] = useState({ inscripciones_abiertas: true, periodo_academico: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await getConfiguracionSistema()
      setGuardado(data)
      setForm(data)
      setStatus('ready')
    } catch (err) {
      if (err.response?.status === 403) {
        setStatus('forbidden')
        return
      }
      setErrorMessage(getApiErrorMessage(err, 'No fue posible cargar la configuración del sistema.'))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(event) {
    event.preventDefault()
    const payload = {
      inscripciones_abiertas: form.inscripciones_abiertas,
      periodo_academico: normalizarPeriodo(form.periodo_academico),
    }
    const problema = validarPeriodo(payload.periodo_academico)
    setError(problema)
    if (problema) {
      periodoRef.current?.focus()
      return
    }

    setSaving(true)
    try {
      const data = await actualizarConfiguracionSistema(payload)
      setGuardado(data)
      setForm(data)
      toast.success(
        'Configuración guardada',
        data.inscripciones_abiertas
          ? `Inscripciones públicas habilitadas para el periodo ${data.periodo_academico}.`
          : 'Las inscripciones públicas quedaron cerradas.',
      )
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err)
      if (fieldErrors.periodo_academico) setError(fieldErrors.periodo_academico)
      toast.error('No fue posible guardar la configuración', getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (status === 'forbidden') return <AccessDenied />

  if (status === 'loading') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando la configuración…
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="px-6 py-14 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar la configuración</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{errorMessage}</p>
        <Button variant="secondary" icon={RefreshCw} onClick={load} className="mt-5">
          Reintentar
        </Button>
      </div>
    )
  }

  const abiertas = guardado?.inscripciones_abiertas

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-6 px-5 py-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-pizarra-950">Configuraciones globales de la aplicación</h2>
            <p className="mt-1 text-sm text-slate-500">Controle las inscripciones públicas y el periodo académico vigente.</p>
          </div>
          {/* Estado guardado (no el del formulario sin guardar). */}
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
              abiertas ? 'bg-pradera-50 text-pradera-700 ring-pradera-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
            }`}
          >
            <span aria-hidden="true" className={`size-1.5 rounded-full ${abiertas ? 'bg-pradera-500' : 'bg-slate-400'}`} />
            {abiertas ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
          </span>
        </div>

        <div className="rounded-xl p-4 ring-1 ring-slate-200/80">
          <Toggle
            id="inscripciones-abiertas"
            label="Habilitar Inscripciones Públicas"
            description={
              form.inscripciones_abiertas
                ? 'El formulario público /inscripcion recibe solicitudes.'
                : 'El formulario público mostrará: "En este momento no hay convocatorias abiertas".'
            }
            checked={form.inscripciones_abiertas}
            onChange={(checked) => setForm((current) => ({ ...current, inscripciones_abiertas: checked }))}
            disabled={saving}
          />
        </div>

        <TextField
          ref={periodoRef}
          id="periodo-academico"
          label="Periodo Académico Actual"
          icon={CalendarRange}
          placeholder="Ej: 2026-2"
          maxLength={PERIODO_MAX + 10}
          value={form.periodo_academico}
          onChange={(event) => {
            setForm((current) => ({ ...current, periodo_academico: event.target.value }))
            if (error) setError('')
          }}
          error={error}
          hint="Se guarda automáticamente en cada solicitud que se radique."
          disabled={saving}
          className="sm:max-w-xs"
        />
      </div>

      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <Button type="submit" icon={Save} loading={saving} loadingText="Guardando…">
          Guardar Configuración
        </Button>
      </div>
    </form>
  )
}
