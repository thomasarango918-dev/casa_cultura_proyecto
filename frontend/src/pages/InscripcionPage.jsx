/**
 * Formulario público de inscripción (ruta /inscripcion).
 *
 * Vista aislada del BackOffice: no usa MainLayout, no muestra la barra lateral
 * y no requiere sesión. Las peticiones se hacen sin token (ver publicService.js).
 *
 * Flujo en tres pasos:
 *   1. Datos personales, fecha de nacimiento y edad (calculada). Si el aspirante
 *      es menor de 18 años aparece la sección obligatoria "Datos del acudiente".
 *   2. Programa: primero la categoría y luego un programa de esa categoría (Fase 5;
 *      GET /public/programas ya llega agrupado y solo con categorías activas).
 *   3. Documentos: un espacio de carga por cada documento requerido
 *      (GET /public/requisitos): documento de identidad, certificado de EPS y
 *      formato de inscripción firmado.
 * Al radicar se muestra una tarjeta de confirmación con el número RAD-AAAA-XXXX.
 *
 * Antes de mostrar los pasos se consulta GET /public/configuracion. Si el Administrador
 * cerró las inscripciones (Configuración → Sistema), el formulario no se renderiza y
 * aparece la tarjeta "En este momento no hay convocatorias abiertas". Si se cierran
 * mientras el aspirante llena el formulario, la API responde 403 y se muestra la misma tarjeta.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarX,
  Check,
  ChevronRight,
  CircleCheck,
  CloudUpload,
  Copy,
  FileImage,
  FileText,
  IdCard,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  Send,
  TriangleAlert,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import BrandMark from '../components/brand/BrandMark'
import TopographicPattern from '../components/brand/TopographicPattern'
import Button from '../components/ui/Button'
import SelectField from '../components/ui/SelectField'
import TextField from '../components/ui/TextField'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchConfiguracionPublica,
  fetchParentescos,
  fetchProgramas,
  fetchRequisitos,
  fetchTiposDocumento,
  radicarSolicitud,
  UPLOAD_LIMITS,
} from '../services/publicService'
import { formatDateTime, formatFileSize } from '../utils/formatters'
import { getProgramIcon } from '../utils/programIcons'

const STEPS = [
  { id: 'datos', title: 'Datos personales', description: 'Identificación y contacto' },
  { id: 'programa', title: 'Programa', description: 'Taller de su interés' },
  { id: 'documentos', title: 'Documentos', description: 'Soportes en PDF o imagen' },
]

/** Campos de cada paso: se usan para volver al paso que tiene errores. */
const STEP_FIELDS = [
  [
    'nombres',
    'apellidos',
    'tipo_documento',
    'numero_documento',
    'fecha_nacimiento',
    'edad',
    'correo_electronico',
    'telefono',
    'acudiente_nombre',
    'acudiente_documento',
    'acudiente_telefono',
    'acudiente_parentesco',
  ],
  ['programa_id'],
  ['archivos'],
]

const INITIAL_FORM = {
  nombres: '',
  apellidos: '',
  tipo_documento: 'CC',
  numero_documento: '',
  fecha_nacimiento: '',
  correo_electronico: '',
  telefono: '',
  programa_id: '',
  acudiente_nombre: '',
  acudiente_documento: '',
  acudiente_telefono: '',
  acudiente_parentesco: '',
}

/** Edad desde la cual el aspirante no necesita acudiente (debe coincidir con el backend). */
const MAYORIA_DE_EDAD = 18
const EDAD_MAXIMA = 120

/** Nombres de los tipos de documento (TBL_TipoDocumento solo guarda la sigla). */
const TIPO_DOCUMENTO_LABELS = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  CE: 'Cédula de extranjería',
  PA: 'Pasaporte',
  PPT: 'Permiso por Protección Temporal',
  RC: 'Registro civil de nacimiento',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** Fecha de hoy en formato AAAA-MM-DD según la hora local (límite del selector de fecha). */
function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Años cumplidos a partir de una fecha AAAA-MM-DD. Se calcula con los números
 * de la fecha (no con Date.parse) para evitar desfases por zona horaria.
 * @returns {number|null} null si la fecha no es válida o es posterior a hoy.
 */
function calcularEdad(fechaIso) {
  const match = DATE_PATTERN.exec(fechaIso ?? '')
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const now = new Date()
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
  if (year > today[0] || (year === today[0] && (month > today[1] || (month === today[1] && day > today[2])))) {
    return null
  }
  const cumpleanosPendiente = today[1] < month || (today[1] === month && today[2] < day)
  return today[0] - year - (cumpleanosPendiente ? 1 : 0)
}

/** Valida los campos de un paso. Devuelve los mensajes de error por campo. */
function validateStep(step, form, documentos, requisitos) {
  const errors = {}
  if (step === 0) {
    if (form.nombres.trim().length < 2) errors.nombres = 'Ingrese sus nombres.'
    if (form.apellidos.trim().length < 2) errors.apellidos = 'Ingrese sus apellidos.'
    if (!form.tipo_documento) errors.tipo_documento = 'Seleccione el tipo de documento.'
    const documento = form.numero_documento.replace(/[\s.-]/g, '')
    if (!documento) errors.numero_documento = 'Ingrese su número de documento.'
    else if (!/^[0-9A-Za-z]{3,20}$/.test(documento)) {
      errors.numero_documento = 'Use solo letras y números (entre 3 y 20 caracteres).'
    }

    const edad = calcularEdad(form.fecha_nacimiento)
    if (!form.fecha_nacimiento) errors.fecha_nacimiento = 'Ingrese su fecha de nacimiento.'
    else if (edad === null) errors.fecha_nacimiento = 'La fecha de nacimiento no puede ser posterior a hoy.'
    else if (edad > EDAD_MAXIMA) errors.fecha_nacimiento = 'Revise la fecha de nacimiento.'

    const correo = form.correo_electronico.trim()
    if (!correo) errors.correo_electronico = 'Ingrese su correo electrónico.'
    else if (!EMAIL_PATTERN.test(correo)) errors.correo_electronico = 'El correo electrónico no tiene un formato válido.'
    const telefono = form.telefono.trim()
    if (telefono && !PHONE_PATTERN.test(telefono)) {
      errors.telefono = 'Use solo números, espacios, guiones o el signo +.'
    }

    // Datos del acudiente: obligatorios solo para menores de edad.
    if (edad !== null && edad < MAYORIA_DE_EDAD) {
      if (form.acudiente_nombre.trim().length < 3) errors.acudiente_nombre = 'Ingrese el nombre completo del acudiente.'
      const cedula = form.acudiente_documento.replace(/[\s.-]/g, '')
      if (!cedula) errors.acudiente_documento = 'Ingrese la cédula del acudiente.'
      else if (!/^[0-9A-Za-z]{3,20}$/.test(cedula)) {
        errors.acudiente_documento = 'Use solo letras y números (entre 3 y 20 caracteres).'
      }
      const contacto = form.acudiente_telefono.trim()
      if (!contacto) errors.acudiente_telefono = 'Ingrese el número de contacto del acudiente.'
      else if (!PHONE_PATTERN.test(contacto)) errors.acudiente_telefono = 'Use solo números, espacios, guiones o el signo +.'
      if (!form.acudiente_parentesco) errors.acudiente_parentesco = 'Seleccione el parentesco.'
    }
  }
  if (step === 1 && !form.programa_id) errors.programa_id = 'Seleccione el programa al que desea inscribirse.'
  if (step === 2) {
    for (const requisito of requisitos) {
      if (requisito.obligatorio && !documentos[requisito.codigo]) {
        errors[`doc-${requisito.codigo}`] = 'Adjunte este documento.'
      }
    }
  }
  return errors
}

/** Barra de progreso de los tres pasos. */
function Stepper({ current }) {
  return (
    <ol className="grid grid-cols-3 gap-3 sm:gap-4">
      {STEPS.map((step, index) => {
        const status = index < current ? 'complete' : index === current ? 'current' : 'upcoming'
        return (
          <li key={step.id} aria-current={status === 'current' ? 'step' : undefined}>
            <span
              aria-hidden="true"
              className={`block h-1 rounded-full transition-colors ${
                status === 'complete' ? 'bg-pradera-500' : status === 'current' ? 'bg-pizarra-900' : 'bg-slate-200'
              }`}
            />
            <div className="mt-3 flex items-start gap-2">
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  status === 'complete'
                    ? 'bg-pradera-500 text-white'
                    : status === 'current'
                      ? 'bg-pizarra-900 text-white'
                      : 'bg-white text-slate-500 ring-1 ring-slate-300'
                }`}
              >
                {status === 'complete' ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-medium leading-6 ${
                    status === 'upcoming' ? 'text-slate-500' : 'text-pizarra-950'
                  }`}
                >
                  <span className="sr-only">Paso {index + 1}: </span>
                  {step.title}
                  {status === 'complete' && <span className="sr-only"> (completado)</span>}
                </span>
                <span className="hidden text-xs text-slate-500 sm:block">{step.description}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Espacio de carga de UN documento requerido: título, descripción y zona para
 * arrastrar o seleccionar el archivo. Si ya hay archivo, muestra su nombre con
 * las opciones de cambiarlo o quitarlo.
 */
function RequisitoUpload({ numero, requisito, file, error, disabled, onSelect, onRemove }) {
  const [dragActive, setDragActive] = useState(false)
  const inputId = `doc-${requisito.codigo}`
  const errorId = `${inputId}-error`
  const isPdf = file?.name.toLowerCase().endsWith('.pdf')
  const FileIcon = isPdf ? FileText : FileImage

  function handleDrop(event) {
    event.preventDefault()
    setDragActive(false)
    if (!disabled && event.dataTransfer.files?.[0]) onSelect(event.dataTransfer.files[0])
  }

  return (
    <section
      aria-labelledby={`${inputId}-titulo`}
      className={`rounded-xl p-4 ring-1 sm:p-5 ${
        error ? 'bg-rose-50/40 ring-rose-200' : file ? 'bg-pradera-50/40 ring-pradera-200/70' : 'bg-white ring-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${
            file ? 'bg-pradera-500 text-white' : 'bg-pizarra-900 text-white'
          }`}
        >
          {file ? <Check className="size-4" /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${inputId}-titulo`} className="text-[15px] font-semibold text-pizarra-950">
            {requisito.nombre}
            {requisito.obligatorio ? (
              <span className="text-rose-600"> *</span>
            ) : (
              <span className="font-normal text-slate-500"> (opcional)</span>
            )}
          </h3>
          {requisito.descripcion && <p className="mt-0.5 text-sm text-slate-600">{requisito.descripcion}</p>}
        </div>
      </div>

      <div className="mt-4 sm:pl-10">
        {file ? (
          <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 ring-1 ring-slate-200">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                isPdf ? 'bg-rose-50 text-rose-600' : 'bg-pizarra-50 text-pizarra-700'
              }`}
            >
              <FileIcon aria-hidden="true" className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-pizarra-950">{file.name}</span>
              <span className="block text-xs text-slate-500">{formatFileSize(file.size)}</span>
            </span>
            {/* "Cambiar" reutiliza el mismo input oculto. */}
            <label
              htmlFor={inputId}
              className={`shrink-0 rounded-md px-2 py-1 text-sm font-medium text-pizarra-700 transition-colors hover:bg-pizarra-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pradera-500 ${
                disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'
              }`}
            >
              Cambiar
            </label>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              aria-label={`Quitar ${file.name}`}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors has-[:focus-visible]:border-pradera-500 sm:flex-row sm:gap-3 sm:text-left ${
              dragActive
                ? 'border-pizarra-600 bg-pizarra-50'
                : error
                  ? 'border-rose-300 bg-white'
                  : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <CloudUpload aria-hidden="true" className="size-6 shrink-0 text-pizarra-600" />
            <span className="text-sm">
              <span className="font-semibold text-pizarra-950">
                Arrastre el archivo aquí o{' '}
                <span className="text-pradera-700 underline underline-offset-2">selecciónelo</span>
              </span>
              <span className="block text-slate-500">
                PDF, JPG, PNG o WEBP · hasta {formatFileSize(UPLOAD_LIMITS.maxFileSize)}
              </span>
            </span>
          </label>
        )}
        <input
          id={inputId}
          type="file"
          accept={UPLOAD_LIMITS.accept}
          disabled={disabled}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            if (event.target.files?.[0]) onSelect(event.target.files[0])
            // Permite volver a elegir el mismo archivo después de quitarlo.
            event.target.value = ''
          }}
          className="sr-only"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-rose-600">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

/** Tarjeta final con el número de radicado. */
function Confirmacion({ resultado, onReset }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  async function copyRadicado() {
    try {
      await navigator.clipboard.writeText(resultado.numero_radicado)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.info('No fue posible copiar', 'Anote el número de radicado que aparece en pantalla.')
    }
  }

  return (
    <section
      aria-labelledby="titulo-confirmacion"
      className="overflow-hidden rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80 animate-fade-in"
    >
      <div className="px-6 pb-8 pt-10 text-center sm:px-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-pradera-50 text-pradera-600 ring-8 ring-pradera-50/60">
          <CircleCheck aria-hidden="true" className="size-8" />
        </span>
        <h2 id="titulo-confirmacion" className="mt-6 text-2xl font-semibold tracking-tight text-pizarra-950">
          Solicitud radicada
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
          Recibimos su solicitud de inscripción. La coordinación revisará sus documentos y tomará una decisión.
        </p>

        {/* Número de radicado destacado */}
        <div className="mx-auto mt-8 max-w-sm rounded-xl bg-pizarra-950 px-6 py-5 text-white">
          <p className="text-xs font-medium uppercase tracking-wider text-pizarra-300">Número de radicado</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-[2rem]">
            {resultado.numero_radicado}
          </p>
          <button
            type="button"
            onClick={copyRadicado}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-pradera-300 transition-colors hover:bg-white/5 hover:text-pradera-200"
          >
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            {copied ? 'Copiado' : 'Copiar número'}
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-500">Guarde este número: lo necesitará para consultar su solicitud.</p>
      </div>

      <dl className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-2">
        {[
          ['Aspirante', resultado.nombre_completo],
          ['Programa', resultado.programa],
          ['Correo electrónico', resultado.correo_electronico],
          ['Fecha de radicación', formatDateTime(resultado.fecha_radicacion)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-6 py-4">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-pizarra-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-center border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        <Button variant="secondary" icon={RefreshCw} onClick={onReset}>
          Radicar otra solicitud
        </Button>
      </div>
    </section>
  )
}

/** Tarjeta que reemplaza al formulario cuando el Administrador cerró las inscripciones. */
function ConvocatoriaCerrada() {
  return (
    <section
      aria-labelledby="titulo-convocatoria"
      className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white text-center shadow-panel ring-1 ring-slate-200/80 animate-fade-in"
    >
      <div className="px-6 pb-10 pt-12 sm:px-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-pizarra-50 text-pizarra-600 ring-8 ring-pizarra-50/60">
          <CalendarX aria-hidden="true" className="size-7" />
        </span>
        <h2 id="titulo-convocatoria" className="mt-6 text-xl font-semibold tracking-tight text-pizarra-950 text-balance">
          En este momento no hay convocatorias abiertas
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
          Gracias por su interés en los programas de la Casa de la Cultura. Las inscripciones se habilitarán de nuevo
          en la próxima convocatoria; vuelva a consultar esta página más adelante.
        </p>
      </div>
    </section>
  )
}

export default function InscripcionPage() {
  const toast = useToast()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_FORM)
  // Un archivo por requisito: { DOCUMENTO_IDENTIDAD: File, CERTIFICADO_EPS: File, ... }
  const [documentos, setDocumentos] = useState({})
  const [errors, setErrors] = useState({})
  const [catalogos, setCatalogos] = useState({
    status: 'loading',
    categorias: [],
    tipos: [],
    parentescos: [],
    requisitos: [],
  })
  // Estado de la convocatoria (GET /public/configuracion): el formulario solo se muestra si está abierta.
  const [convocatoria, setConvocatoria] = useState('loading') // loading | abierta | cerrada | error
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resultado, setResultado] = useState(null)
  // Paso 2 en dos tiempos: categoría elegida (null = se muestran las categorías).
  const [categoriaId, setCategoriaId] = useState(null)

  const headingRef = useRef(null)
  const isFirstRender = useRef(true)

  useEffect(() => {
    document.title = 'Inscripción | Casa de la Cultura'
  }, [])

  const loadCatalogos = useCallback(async () => {
    setCatalogos((current) => ({ ...current, status: 'loading' }))
    try {
      const [categorias, tipos, parentescos, requisitos] = await Promise.all([
        fetchProgramas(),
        fetchTiposDocumento(),
        fetchParentescos(),
        fetchRequisitos(),
      ])
      setCatalogos({ status: 'ready', categorias, tipos, parentescos, requisitos })
    } catch {
      setCatalogos({ status: 'error', categorias: [], tipos: [], parentescos: [], requisitos: [] })
    }
  }, [])

  const loadConvocatoria = useCallback(async () => {
    setConvocatoria('loading')
    try {
      const { inscripciones_abiertas: abiertas } = await fetchConfiguracionPublica()
      setConvocatoria(abiertas ? 'abierta' : 'cerrada')
    } catch {
      setConvocatoria('error')
    }
  }, [])

  useEffect(() => {
    loadConvocatoria()
    loadCatalogos()
  }, [loadConvocatoria, loadCatalogos])

  // Al cambiar de paso el foco va al título, para que el lector de pantalla anuncie el paso nuevo.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step, resultado])

  // Edad calculada a partir de la fecha de nacimiento (null mientras la fecha no sea válida).
  const edad = calcularEdad(form.fecha_nacimiento)
  const esMenor = edad !== null && edad < MAYORIA_DE_EDAD

  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (errors[name] || (name === 'fecha_nacimiento' && errors.edad)) {
      setErrors((current) => ({ ...current, [name]: undefined, edad: undefined }))
    }
  }

  function selectCategoria(id) {
    setCategoriaId(id)
    const categoria = catalogos.categorias.find((item) => item.id === id)
    // El programa elegido antes solo se conserva si pertenece a la nueva categoría.
    if (!categoria?.programas.some((programa) => String(programa.id) === form.programa_id)) {
      setForm((current) => ({ ...current, programa_id: '' }))
    }
    if (errors.programa_id) setErrors((current) => ({ ...current, programa_id: undefined }))
  }

  function selectPrograma(id) {
    setForm((current) => ({ ...current, programa_id: String(id) }))
    if (errors.programa_id) setErrors((current) => ({ ...current, programa_id: undefined }))
  }

  /** Asigna el archivo de un requisito validando formato y tamaño. */
  function selectDocumento(requisito, file) {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    let problema = ''
    if (!UPLOAD_LIMITS.extensions.includes(extension)) problema = 'Solo se admiten archivos PDF, JPG, PNG o WEBP.'
    else if (file.size === 0) problema = 'El archivo está vacío.'
    else if (file.size > UPLOAD_LIMITS.maxFileSize) problema = `El archivo supera ${formatFileSize(UPLOAD_LIMITS.maxFileSize)}.`

    if (problema) {
      toast.warning(`«${file.name}» no se agregó`, problema)
      return
    }
    setDocumentos((current) => ({ ...current, [requisito.codigo]: file }))
    setErrors((current) => ({ ...current, [`doc-${requisito.codigo}`]: undefined }))
  }

  function removeDocumento(codigo) {
    setDocumentos((current) => {
      const next = { ...current }
      delete next[codigo]
      return next
    })
  }

  /** Datos que se envían a la API. Los del acudiente solo viajan si el aspirante es menor. */
  function buildPayload() {
    const payload = {
      nombres: form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento.trim(),
      fecha_nacimiento: form.fecha_nacimiento,
      edad: edad ?? '',
      correo_electronico: form.correo_electronico.trim(),
      telefono: form.telefono.trim(),
      programa_id: form.programa_id,
    }
    if (esMenor) {
      payload.acudiente_nombre = form.acudiente_nombre.trim()
      payload.acudiente_documento = form.acudiente_documento.trim()
      payload.acudiente_telefono = form.acudiente_telefono.trim()
      payload.acudiente_parentesco = form.acudiente_parentesco
    }
    return payload
  }

  function goNext() {
    const validation = validateStep(step, form, documentos, catalogos.requisitos)
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      // Foco en el primer campo con error.
      const firstField = Object.keys(validation)[0]
      const programaFocus = categoriaId ? 'programa-0' : 'categoria-0'
      document.getElementById(firstField === 'programa_id' ? programaFocus : firstField)?.focus()
      return
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function goBack() {
    setErrors({})
    setStep((current) => Math.max(current - 1, 0))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    if (step < STEPS.length - 1) {
      goNext()
      return
    }

    // Se revalidan todos los pasos por si el usuario volvió atrás y cambió algo.
    for (let index = 0; index < STEPS.length; index += 1) {
      const validation = validateStep(index, form, documentos, catalogos.requisitos)
      if (Object.keys(validation).length > 0) {
        setErrors(validation)
        setStep(index)
        return
      }
    }

    setSubmitting(true)
    setProgress(0)
    try {
      const archivos = catalogos.requisitos
        .filter((requisito) => documentos[requisito.codigo])
        .map((requisito) => ({ requisito: requisito.codigo, file: documentos[requisito.codigo] }))
      const data = await radicarSolicitud(buildPayload(), archivos, setProgress)
      setResultado(data)
      toast.success('Solicitud radicada', `Su número de radicado es ${data.numero_radicado}.`)
    } catch (error) {
      // 403: el Administrador cerró las inscripciones mientras se llenaba el formulario.
      if (error.response?.status === 403) {
        setConvocatoria('cerrada')
        toast.info('Inscripciones cerradas', getApiErrorMessage(error))
        return
      }
      // 422: errores por campo; se vuelve al primer paso que tenga alguno.
      const fieldErrors = {}
      for (const item of error.response?.data?.errores ?? []) {
        const field = item.campo?.split('.').pop()
        if (field) fieldErrors[field] = item.mensaje
      }
      // 400 del programa: se deshabilitó su categoría o se eliminó mientras se llenaba el formulario.
      if (error.response?.status === 400 && /programa/i.test(getApiErrorMessage(error))) {
        fieldErrors.programa_id = getApiErrorMessage(error)
        setForm((current) => ({ ...current, programa_id: '' }))
        setCategoriaId(null)
        loadCatalogos()
      }
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
        const stepWithError = STEP_FIELDS.findIndex((fields) => fields.some((field) => fieldErrors[field]))
        if (stepWithError >= 0) setStep(stepWithError)
      }
      toast.error('No fue posible radicar la solicitud', getApiErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setForm(INITIAL_FORM)
    setDocumentos({})
    setErrors({})
    setProgress(0)
    setResultado(null)
    setCategoriaId(null)
    setStep(0)
  }

  const categoriaSeleccionada = catalogos.categorias.find((categoria) => categoria.id === categoriaId) ?? null
  const programaSeleccionado = categoriaSeleccionada?.programas.find((programa) => String(programa.id) === form.programa_id)
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Encabezado institucional. El formulario va debajo, separado (no se superpone). */}
      <header className="relative isolate overflow-hidden bg-pizarra-950 text-white">
        <TopographicPattern className="absolute inset-0 -z-10 size-full text-white" />
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6 sm:pb-12">
          <div className="flex items-center gap-3">
            <BrandMark tone="light" className="size-10 shrink-0" />
            <div>
              <p className="text-[15px] font-semibold leading-tight">Casa de la Cultura</p>
              <p className="text-sm text-pizarra-300">San Pedro de los Milagros</p>
            </div>
          </div>
          <h1 className="mt-10 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Solicitud de inscripción {year}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-pizarra-200">
            {convocatoria === 'cerrada'
              ? 'Aquí podrá radicar su solicitud cuando se abra una nueva convocatoria.'
              : 'Complete los tres pasos y adjunte los documentos solicitados. Al finalizar recibirá un número de radicado.'}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {resultado ? (
          <div ref={headingRef} tabIndex={-1} className="focus:outline-none">
            <Confirmacion resultado={resultado} onReset={handleReset} />
          </div>
        ) : convocatoria === 'loading' ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-16 text-sm text-slate-500 shadow-panel ring-1 ring-slate-200/80"
          >
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando el formulario…
          </div>
        ) : convocatoria === 'cerrada' ? (
          <ConvocatoriaCerrada />
        ) : convocatoria === 'error' ? (
          <div className="rounded-xl bg-white px-6 py-14 text-center shadow-panel ring-1 ring-slate-200/80">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
              <TriangleAlert aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar el formulario</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Verifique su conexión e intente de nuevo.</p>
            <Button variant="secondary" icon={RefreshCw} onClick={loadConvocatoria} className="mt-5">
              Reintentar
            </Button>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80"
          >
            <div className="border-b border-slate-100 px-5 py-5 sm:px-8">
              <Stepper current={step} />
            </div>

            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-semibold text-pizarra-950 focus:outline-none"
              >
                {STEPS[step].title}
              </h2>

              {/* Catálogos no disponibles: sin ellos no se puede continuar. */}
              {catalogos.status === 'error' && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-start gap-2">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    No fue posible cargar la información del formulario. Verifique su conexión.
                  </p>
                  <Button variant="secondary" icon={RefreshCw} onClick={loadCatalogos}>
                    Reintentar
                  </Button>
                </div>
              )}

              {/* Paso 1: datos personales */}
              {step === 0 && (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <TextField
                    id="nombres"
                    name="nombres"
                    label="Nombres"
                    icon={UserRound}
                    autoComplete="given-name"
                    maxLength={100}
                    value={form.nombres}
                    onChange={handleChange}
                    error={errors.nombres}
                  />
                  <TextField
                    id="apellidos"
                    name="apellidos"
                    label="Apellidos"
                    autoComplete="family-name"
                    maxLength={100}
                    value={form.apellidos}
                    onChange={handleChange}
                    error={errors.apellidos}
                  />
                  <SelectField
                    id="tipo_documento"
                    name="tipo_documento"
                    label="Tipo de documento"
                    value={form.tipo_documento}
                    onChange={handleChange}
                    error={errors.tipo_documento}
                    disabled={catalogos.status !== 'ready'}
                  >
                    {catalogos.status !== 'ready' && <option value={form.tipo_documento}>Cargando…</option>}
                    {catalogos.tipos.map((tipo) => (
                      <option key={tipo.id} value={tipo.sigla}>
                        {TIPO_DOCUMENTO_LABELS[tipo.sigla] ? `${TIPO_DOCUMENTO_LABELS[tipo.sigla]} (${tipo.sigla})` : tipo.sigla}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    id="numero_documento"
                    name="numero_documento"
                    label="Número de documento"
                    icon={IdCard}
                    inputMode="text"
                    autoComplete="off"
                    maxLength={25}
                    placeholder="1036123456"
                    value={form.numero_documento}
                    onChange={handleChange}
                    error={errors.numero_documento}
                  />
                  <TextField
                    id="fecha_nacimiento"
                    name="fecha_nacimiento"
                    type="date"
                    label="Fecha de nacimiento"
                    icon={CalendarDays}
                    autoComplete="bday"
                    max={todayIso()}
                    min="1900-01-01"
                    value={form.fecha_nacimiento}
                    onChange={handleChange}
                    error={errors.fecha_nacimiento}
                  />
                  {/* La edad se calcula sola a partir de la fecha de nacimiento. */}
                  <TextField
                    id="edad"
                    name="edad"
                    label="Edad"
                    readOnly
                    tabIndex={-1}
                    placeholder="Se calcula con la fecha de nacimiento"
                    value={edad !== null ? `${edad} ${edad === 1 ? 'año' : 'años'}` : ''}
                    error={errors.edad}
                    hint={esMenor ? 'Menor de edad: debe registrar un acudiente.' : undefined}
                    className="[&_input]:bg-slate-50 [&_input]:text-slate-700"
                  />
                  <TextField
                    id="correo_electronico"
                    name="correo_electronico"
                    type="email"
                    label="Correo electrónico"
                    icon={Mail}
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={150}
                    placeholder="nombre@correo.com"
                    value={form.correo_electronico}
                    onChange={handleChange}
                    error={errors.correo_electronico}
                  />
                  <TextField
                    id="telefono"
                    name="telefono"
                    type="tel"
                    label="Teléfono (opcional)"
                    icon={Phone}
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="300 123 4567"
                    value={form.telefono}
                    onChange={handleChange}
                    error={errors.telefono}
                  />

                  {/* Datos del acudiente: solo aparecen (y son obligatorios) si el aspirante es menor de edad. */}
                  {esMenor && (
                    <fieldset className="rounded-xl bg-pizarra-50/60 p-4 ring-1 ring-pizarra-100 animate-fade-in sm:col-span-2 sm:p-5">
                      <legend className="sr-only">Datos del acudiente</legend>
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-pizarra-700 ring-1 ring-pizarra-100">
                          <UsersRound aria-hidden="true" className="size-[18px]" />
                        </span>
                        <div>
                          <p className="text-[15px] font-semibold text-pizarra-950">Datos del acudiente</p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            El aspirante tiene {edad} {edad === 1 ? 'año' : 'años'}. Registre los datos de la madre, el
                            padre o el adulto responsable.
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <TextField
                          id="acudiente_nombre"
                          name="acudiente_nombre"
                          label="Nombre completo del acudiente"
                          icon={UserRound}
                          autoComplete="off"
                          maxLength={150}
                          value={form.acudiente_nombre}
                          onChange={handleChange}
                          error={errors.acudiente_nombre}
                          className="sm:col-span-2"
                        />
                        <TextField
                          id="acudiente_documento"
                          name="acudiente_documento"
                          label="Cédula del acudiente"
                          icon={IdCard}
                          autoComplete="off"
                          maxLength={25}
                          placeholder="43111222"
                          value={form.acudiente_documento}
                          onChange={handleChange}
                          error={errors.acudiente_documento}
                        />
                        <TextField
                          id="acudiente_telefono"
                          name="acudiente_telefono"
                          type="tel"
                          label="Número de contacto"
                          icon={Phone}
                          autoComplete="off"
                          maxLength={20}
                          placeholder="300 123 4567"
                          value={form.acudiente_telefono}
                          onChange={handleChange}
                          error={errors.acudiente_telefono}
                        />
                        <SelectField
                          id="acudiente_parentesco"
                          name="acudiente_parentesco"
                          label="Parentesco con el aspirante"
                          value={form.acudiente_parentesco}
                          onChange={handleChange}
                          error={errors.acudiente_parentesco}
                          className="sm:col-span-2"
                        >
                          <option value="">Seleccione el parentesco…</option>
                          {catalogos.parentescos.map((parentesco) => (
                            <option key={parentesco.id} value={parentesco.nombre}>
                              {parentesco.nombre}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    </fieldset>
                  )}
                </div>
              )}

              {/* Paso 2: categoría y luego programa */}
              {step === 1 && (
                <div className="mt-6">
                  {catalogos.status === 'loading' && (
                    <p className="flex items-center gap-2 text-sm text-slate-500">
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando programas…
                    </p>
                  )}

                  {catalogos.status === 'ready' && catalogos.categorias.length === 0 && (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      En este momento no hay programas disponibles para inscripción.
                    </p>
                  )}

                  {catalogos.status === 'ready' && catalogos.categorias.length > 0 && !categoriaSeleccionada && (
                    <>
                      <p className="text-sm text-slate-600">Primero, elija la categoría que le interesa.</p>
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {catalogos.categorias.map((categoria, index) => {
                          const Icon = getProgramIcon(categoria.nombre)
                          const total = categoria.programas.length
                          return (
                            <li key={categoria.id}>
                              <button
                                id={`categoria-${index}`}
                                type="button"
                                onClick={() => selectCategoria(categoria.id)}
                                className="group flex h-full w-full items-center gap-3 rounded-xl bg-white p-4 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pradera-500"
                              >
                                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-pizarra-50 text-pizarra-700 ring-1 ring-pizarra-100">
                                  <Icon aria-hidden="true" className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-pizarra-950">{categoria.nombre}</span>
                                  {categoria.descripcion && (
                                    <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500">{categoria.descripcion}</span>
                                  )}
                                  <span className="mt-1 block text-xs font-medium text-pradera-700">
                                    {total} programa{total === 1 ? '' : 's'}
                                  </span>
                                </span>
                                <ChevronRight
                                  aria-hidden="true"
                                  className="size-5 shrink-0 text-slate-300 transition-colors group-hover:text-pizarra-700"
                                />
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}

                  {catalogos.status === 'ready' && categoriaSeleccionada && (
                    <fieldset>
                      <legend className="text-sm text-slate-600">
                        Ahora seleccione el programa de{' '}
                        <span className="font-medium text-pizarra-900">{categoriaSeleccionada.nombre}</span>.
                      </legend>
                      <Button variant="ghost" icon={ArrowLeft} onClick={() => selectCategoria(null)} className="-ml-3 mt-2">
                        Cambiar categoría
                      </Button>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {categoriaSeleccionada.programas.map((programa, index) => {
                          // Todos los programas llevan el icono de su categoría.
                          const Icon = getProgramIcon(categoriaSeleccionada.nombre)
                          const selected = String(programa.id) === form.programa_id
                          return (
                            <label
                              key={programa.id}
                              className={`relative flex cursor-pointer items-center gap-3 rounded-xl p-4 ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pradera-500 ${
                                selected
                                  ? 'bg-pizarra-50 ring-2 ring-pizarra-900'
                                  : 'bg-white ring-slate-200 hover:bg-slate-50 hover:ring-slate-300'
                              }`}
                            >
                              <input
                                id={`programa-${index}`}
                                type="radio"
                                name="programa_id"
                                value={programa.id}
                                checked={selected}
                                onChange={() => selectPrograma(programa.id)}
                                className="sr-only"
                              />
                              <span
                                className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                                  selected ? 'bg-pizarra-900 text-white' : 'bg-pizarra-50 text-pizarra-700 ring-1 ring-pizarra-100'
                                }`}
                              >
                                <Icon aria-hidden="true" className="size-5" />
                              </span>
                              <span className="min-w-0 flex-1 text-sm font-medium text-pizarra-950">{programa.nombre}</span>
                              {selected && <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-pradera-600" />}
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}

                  {errors.programa_id && (
                    <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-rose-600">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {errors.programa_id}
                    </p>
                  )}
                </div>
              )}

              {/* Paso 3: un espacio de carga por cada documento requerido */}
              {step === 2 && (
                <div className="mt-6 space-y-6">
                  <p className="text-sm text-slate-600">
                    Adjunte cada documento en su espacio. Todos los marcados con{' '}
                    <span className="text-rose-600">*</span> son obligatorios.
                  </p>

                  <div className="space-y-4">
                    {catalogos.requisitos.map((requisito, index) => (
                      <RequisitoUpload
                        key={requisito.codigo}
                        numero={index + 1}
                        requisito={requisito}
                        file={documentos[requisito.codigo]}
                        error={errors[`doc-${requisito.codigo}`] ?? (index === 0 ? errors.archivos : undefined)}
                        disabled={submitting}
                        onSelect={(file) => selectDocumento(requisito, file)}
                        onRemove={() => removeDocumento(requisito.codigo)}
                      />
                    ))}
                  </div>

                  {/* Resumen antes de radicar */}
                  <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200/70 sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Aspirante</dt>
                      <dd className="mt-0.5 truncate font-medium text-pizarra-900">
                        {form.nombres.trim()} {form.apellidos.trim()}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Documento · Edad</dt>
                      <dd className="mt-0.5 truncate font-medium text-pizarra-900">
                        {form.tipo_documento} {form.numero_documento}
                        {edad !== null && ` · ${edad} años`}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">Programa · {categoriaSeleccionada?.nombre}</dt>
                      <dd className="mt-0.5 truncate font-medium text-pizarra-900">{programaSeleccionado?.nombre}</dd>
                    </div>
                    {esMenor && (
                      <div className="min-w-0 sm:col-span-3">
                        <dt className="text-xs text-slate-500">Acudiente</dt>
                        <dd className="mt-0.5 truncate font-medium text-pizarra-900">
                          {form.acudiente_nombre.trim()} ({form.acudiente_parentesco}) · {form.acudiente_telefono.trim()}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {submitting && (
                    <div role="status" aria-live="polite">
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>{progress < 100 ? 'Enviando documentos…' : 'Registrando la solicitud…'}</span>
                        <span className="tabular-nums">{progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-pradera-500 transition-[width]" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navegación entre pasos */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              {step > 0 ? (
                <Button variant="secondary" icon={ArrowLeft} onClick={goBack} disabled={submitting}>
                  Anterior
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex items-center gap-3 sm:ml-auto">
                <span className="hidden text-sm text-slate-500 sm:inline">
                  Paso {step + 1} de {STEPS.length}
                </span>
                {step < STEPS.length - 1 ? (
                  <Button type="submit" disabled={catalogos.status !== 'ready'} className="w-full sm:w-auto">
                    Continuar
                    <ArrowRight aria-hidden="true" className="-mr-1 ml-2 inline-block size-[18px] align-[-4px]" />
                  </Button>
                ) : (
                  <Button type="submit" icon={Send} loading={submitting} loadingText="Radicando…" className="w-full sm:w-auto">
                    Radicar solicitud
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </main>

      <footer className="border-t border-slate-200/70">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 text-xs text-slate-500 sm:px-6">
          © {year} Casa de la Cultura de San Pedro de los Milagros · Municipio de San Pedro de los Milagros, Antioquia
        </div>
      </footer>
    </div>
  )
}
