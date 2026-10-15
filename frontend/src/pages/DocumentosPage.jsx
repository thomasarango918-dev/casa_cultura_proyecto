/**
 * Inventario de documentos (ruta protegida /dashboard/documentos).
 *
 * Permite ubicar los documentos adjuntos sin recorrer el listado de solicitudes.
 * Es solo de consulta: no aprueba ni rechaza (eso se hace en /dashboard/solicitudes).
 *
 * Flujo:
 *   1. El funcionario elige el método de búsqueda: documento de identidad o número de radicado.
 *   2. Escribe el valor (completo o parcial). Mientras escribe aparecen sugerencias con los
 *      valores existentes que lo contienen; puede elegir una con el mouse o con el teclado.
 *   3. Pulsa "Buscar" (o Enter): se listan las solicitudes que coinciden, cada una con sus
 *      documentos, que se abren en una pestaña nueva.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  CalendarDays,
  ExternalLink,
  Eye,
  FileImage,
  FileSearch,
  FileText,
  Hash,
  IdCard,
  LoaderCircle,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from 'lucide-react'
import Button from '../components/ui/Button'
import EstadoBadge from '../components/solicitudes/EstadoBadge'
import { useToast } from '../context/ToastContext'
import useDismiss from '../hooks/useDismiss'
import { getApiErrorMessage } from '../services/apiClient'
import { abrirDocumentoEnPestana } from '../services/documentViewer'
import { buscarDocumentos, sugerenciasDocumentos } from '../services/solicitudesService'
import { formatShortDate } from '../utils/formatters'

/** Caracteres mínimos para buscar y sugerir (igual que MIN_BUSQUEDA en el backend). */
const MIN_CARACTERES = 2
const SUGGESTION_DELAY_MS = 250

/** Métodos de búsqueda disponibles. `value` es el parámetro `metodo` de la API. */
const METODOS = [
  {
    value: 'documento',
    label: 'Documento de identidad',
    icon: IdCard,
    placeholder: 'Ej.: 1036123456 o parte del número',
  },
  {
    value: 'radicado',
    label: 'Número de radicado',
    icon: Hash,
    placeholder: 'Ej.: RAD-2026-0001 o 0001',
  },
]

/** Normaliza el texto igual que el backend, para resaltar la coincidencia en pantalla. */
function normalizar(metodo, valor) {
  return metodo === 'documento' ? valor.replace(/[\s.-]/g, '').toUpperCase() : valor.replace(/\s/g, '').toUpperCase()
}

/** Muestra `texto` con la parte que coincide con `buscado` resaltada. */
function Resaltado({ texto, buscado }) {
  const index = buscado ? texto.toUpperCase().indexOf(buscado.toUpperCase()) : -1
  if (index < 0) return texto
  return (
    <>
      {texto.slice(0, index)}
      <mark className="rounded-sm bg-pradera-100 px-0.5 text-pizarra-950">{texto.slice(index, index + buscado.length)}</mark>
      {texto.slice(index + buscado.length)}
    </>
  )
}

/** Mensaje centrado para los estados sin resultados. */
function EmptyState({ icon: Icon, title, children, tone = 'slate' }) {
  return (
    <div className="px-6 py-14 text-center">
      <span
        className={`mx-auto grid size-12 place-items-center rounded-full ${
          tone === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-400'
        }`}
      >
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-pizarra-900">{title}</p>
      <div className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500">{children}</div>
    </div>
  )
}

export default function DocumentosPage() {
  const toast = useToast()
  const listboxId = useId()

  const [metodo, setMetodo] = useState('documento')
  const [texto, setTexto] = useState('')
  const [inputError, setInputError] = useState('')

  // Autocompletado
  const [sugerencias, setSugerencias] = useState([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [activa, setActiva] = useState(-1)
  const [cargandoSugerencias, setCargandoSugerencias] = useState(false)

  // Resultados
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [resultado, setResultado] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [abriendo, setAbriendo] = useState(null)
  const [vistos, setVistos] = useState(() => new Set())

  const inputRef = useRef(null)
  const comboRef = useRef(null)
  // Evita volver a mostrar sugerencias justo después de elegir una o de buscar.
  const omitirSugerencias = useRef(false)

  const metodoActual = METODOS.find((item) => item.value === metodo)
  const cerrarSugerencias = useCallback(() => {
    setMostrarSugerencias(false)
    setActiva(-1)
  }, [])
  useDismiss(comboRef, mostrarSugerencias, cerrarSugerencias)

  // Sugerencias mientras se escribe: espera una pausa y cancela la consulta anterior.
  useEffect(() => {
    if (omitirSugerencias.current) {
      omitirSugerencias.current = false
      return undefined
    }
    const valor = normalizar(metodo, texto)
    if (valor.length < MIN_CARACTERES) {
      setSugerencias([])
      setMostrarSugerencias(false)
      return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setCargandoSugerencias(true)
      sugerenciasDocumentos(metodo, texto, controller.signal)
        .then((data) => {
          setSugerencias(data)
          setActiva(-1)
          setMostrarSugerencias(true)
        })
        .catch(() => {
          if (!controller.signal.aborted) setSugerencias([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setCargandoSugerencias(false)
        })
    }, SUGGESTION_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [metodo, texto])

  useEffect(() => {
    document.title = 'Documentos | Casa de la Cultura'
  }, [])

  function cambiarMetodo(value) {
    if (value === metodo) return
    setMetodo(value)
    setTexto('')
    setInputError('')
    setSugerencias([])
    setMostrarSugerencias(false)
    setResultado(null)
    setStatus('idle')
    inputRef.current?.focus()
  }

  /** Ejecuta la búsqueda con el valor indicado (o con el texto escrito). */
  async function buscar(valor = texto) {
    const limpio = valor.trim()
    if (normalizar(metodo, limpio).length < MIN_CARACTERES) {
      setInputError(`Escriba al menos ${MIN_CARACTERES} caracteres.`)
      inputRef.current?.focus()
      return
    }
    setInputError('')
    cerrarSugerencias()
    setStatus('loading')
    try {
      const data = await buscarDocumentos(metodo, limpio)
      setResultado(data)
      setStatus('ready')
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible buscar los documentos.'))
      setStatus('error')
    }
  }

  function elegirSugerencia(sugerencia) {
    // Si el texto cambia, el efecto de sugerencias se ejecutará una vez: se omite esa ejecución.
    if (sugerencia.valor !== texto) omitirSugerencias.current = true
    setTexto(sugerencia.valor)
    buscar(sugerencia.valor)
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (mostrarSugerencias && activa >= 0 && sugerencias[activa]) {
      elegirSugerencia(sugerencias[activa])
      return
    }
    buscar()
  }

  /** Navegación del autocompletado con el teclado (flechas y Escape). */
  function handleKeyDown(event) {
    if (!mostrarSugerencias || sugerencias.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiva((current) => (current + 1) % sugerencias.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiva((current) => (current <= 0 ? sugerencias.length - 1 : current - 1))
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cerrarSugerencias()
    }
  }

  async function abrirDocumento(solicitudId, documento) {
    setAbriendo(documento.id)
    try {
      const abierto = await abrirDocumentoEnPestana(solicitudId, documento)
      if (!abierto) {
        toast.warning('Ventana bloqueada', 'Permita las ventanas emergentes de este sitio para ver los documentos.')
        return
      }
      setVistos((current) => new Set(current).add(documento.id))
    } catch (error) {
      toast.error('No fue posible abrir el documento', getApiErrorMessage(error))
    } finally {
      setAbriendo(null)
    }
  }

  const textoNormalizado = normalizar(metodo, texto)
  const listaVisible = mostrarSugerencias && textoNormalizado.length >= MIN_CARACTERES

  return (
    <div className="space-y-6">
      {/* 1. Encabezado */}
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-pizarra-950 sm:text-[1.75rem]">
          Inventario de documentos
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-600">
          Consulte los documentos adjuntos de cualquier solicitud buscando por el documento de identidad del aspirante o
          por el número de radicado.
        </p>
      </section>

      {/* 2. Buscador */}
      <section aria-label="Buscador de documentos" className="rounded-xl bg-white shadow-panel ring-1 ring-slate-200/80">
        <form noValidate onSubmit={handleSubmit} className="space-y-4 px-4 py-5 sm:px-6">
          {/* Método de búsqueda */}
          <div>
            <p id="metodo-busqueda" className="text-sm font-medium text-pizarra-900">
              Buscar por
            </p>
            <div role="radiogroup" aria-labelledby="metodo-busqueda" className="mt-2 grid gap-2 sm:inline-grid sm:grid-cols-2">
              {METODOS.map(({ value, label, icon: Icon }) => {
                const active = metodo === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => cambiarMetodo(value)}
                    className={`inline-flex h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-pizarra-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:text-pizarra-900'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Campo de texto con autocompletado + botón Buscar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div ref={comboRef} className="relative flex-1">
              <label htmlFor="valor-busqueda" className="sr-only">
                {metodoActual.label}
              </label>
              <Search
                aria-hidden="true"
                className={`pointer-events-none absolute left-3.5 top-[22px] size-[18px] -translate-y-1/2 ${
                  inputError ? 'text-rose-500' : 'text-slate-400'
                }`}
              />
              <input
                ref={inputRef}
                id="valor-busqueda"
                type="text"
                role="combobox"
                autoComplete="off"
                spellCheck={false}
                maxLength={50}
                value={texto}
                onChange={(event) => {
                  setTexto(event.target.value)
                  if (inputError) setInputError('')
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
                placeholder={metodoActual.placeholder}
                aria-expanded={listaVisible}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={listaVisible && activa >= 0 ? `${listboxId}-${activa}` : undefined}
                aria-invalid={inputError ? 'true' : 'false'}
                aria-describedby="valor-busqueda-ayuda"
                className={`block h-11 w-full rounded-lg border bg-white pl-10 pr-10 text-[15px] text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 ${
                  inputError
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                    : 'border-slate-300 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15'
                }`}
              />
              {/* Indicador de carga o botón para limpiar el campo */}
              <span className="absolute right-1.5 top-[22px] -translate-y-1/2">
                {cargandoSugerencias ? (
                  <LoaderCircle aria-hidden="true" className="mr-1.5 size-4 animate-spin text-slate-400" />
                ) : (
                  texto && (
                    <button
                      type="button"
                      onClick={() => {
                        setTexto('')
                        setSugerencias([])
                        cerrarSugerencias()
                        inputRef.current?.focus()
                      }}
                      className="grid size-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Limpiar búsqueda"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  )
                )}
              </span>

              {/* Lista de sugerencias */}
              {listaVisible && (
                <ul
                  id={listboxId}
                  role="listbox"
                  aria-label={`Coincidencias por ${metodoActual.label.toLowerCase()}`}
                  className="absolute inset-x-0 z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-white p-1.5 shadow-float ring-1 ring-pizarra-900/10 animate-fade-in"
                >
                  {sugerencias.length === 0 ? (
                    <li role="presentation" className="px-3 py-2.5 text-sm text-slate-500">
                      No hay coincidencias para «{texto.trim()}».
                    </li>
                  ) : (
                    sugerencias.map((sugerencia, index) => (
                      <li
                        key={sugerencia.valor}
                        id={`${listboxId}-${index}`}
                        role="option"
                        aria-selected={index === activa}
                        // mousedown (y no click) para elegir antes de que el campo pierda el foco.
                        onMouseDown={(event) => {
                          event.preventDefault()
                          elegirSugerencia(sugerencia)
                        }}
                        onMouseEnter={() => setActiva(index)}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${
                          index === activa ? 'bg-pizarra-50' : ''
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-sm font-semibold text-pizarra-950">
                            <Resaltado texto={sugerencia.valor} buscado={textoNormalizado} />
                          </span>
                          <span className="block truncate text-xs text-slate-500">{sugerencia.nombre}</span>
                        </span>
                        {sugerencia.solicitudes > 1 && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {sugerencia.solicitudes} solicitudes
                          </span>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}

              {inputError ? (
                <p id="valor-busqueda-ayuda" className="mt-1.5 text-sm text-rose-600">
                  {inputError}
                </p>
              ) : (
                <p id="valor-busqueda-ayuda" className="mt-1.5 text-sm text-slate-500">
                  Puede escribir el valor completo o solo una parte; aparecerán las coincidencias.
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              icon={Search}
              loading={status === 'loading'}
              loadingText="Buscando…"
              className="sm:w-36"
            >
              Buscar
            </Button>
          </div>
        </form>

        {/* 3. Resultados */}
        <div className="border-t border-slate-100">
          {status === 'idle' && (
            <EmptyState icon={FileSearch} title="Busque los documentos de una solicitud">
              Elija si desea buscar por documento de identidad o por número de radicado, escriba el valor y pulse{' '}
              <span className="font-medium text-pizarra-900">Buscar</span>.
            </EmptyState>
          )}

          {status === 'loading' && (
            <div role="status" className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Buscando documentos…
            </div>
          )}

          {status === 'error' && (
            <EmptyState icon={TriangleAlert} title="No fue posible realizar la búsqueda" tone="rose">
              <p>{errorMessage}</p>
              <Button variant="secondary" onClick={() => buscar()} className="mt-5">
                Reintentar
              </Button>
            </EmptyState>
          )}

          {status === 'ready' && resultado && resultado.items.length === 0 && (
            <EmptyState icon={SearchX} title="Sin resultados">
              No hay solicitudes con {resultado.metodo === 'documento' ? 'un documento de identidad' : 'un número de radicado'}{' '}
              que contenga «{resultado.valor}».
            </EmptyState>
          )}

          {status === 'ready' && resultado && resultado.items.length > 0 && (
            <div className="px-4 py-5 sm:px-6">
              <p className="text-sm text-slate-600" role="status">
                {resultado.total} solicitud{resultado.total === 1 ? '' : 'es'} con {resultado.total_documentos} documento
                {resultado.total_documentos === 1 ? '' : 's'} para «
                <span className="font-medium text-pizarra-900">{resultado.valor}</span>».
                {resultado.total > resultado.items.length &&
                  ` Se muestran las primeras ${resultado.items.length}; escriba un valor más completo para afinar.`}
              </p>

              <ul className="mt-4 space-y-4">
                {resultado.items.map((item) => (
                  <li key={item.solicitud_id} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                    {/* Datos de la solicitud */}
                    <div className="flex flex-col gap-2 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-pizarra-950">
                            {resultado.metodo === 'radicado' ? (
                              <Resaltado texto={item.numero_radicado} buscado={resultado.valor} />
                            ) : (
                              item.numero_radicado
                            )}
                          </span>
                          <EstadoBadge estado={item.estado} />
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-600">
                          <span className="font-medium text-pizarra-900">{item.nombre_completo}</span>
                          {' · '}
                          {item.tipo_documento}{' '}
                          {resultado.metodo === 'documento' ? (
                            <Resaltado texto={item.numero_documento} buscado={resultado.valor} />
                          ) : (
                            item.numero_documento
                          )}
                          {' · '}
                          {item.programa}
                        </p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-slate-500">
                        <CalendarDays aria-hidden="true" className="size-4" />
                        {formatShortDate(item.fecha_radicacion)}
                      </span>
                    </div>

                    {/* Documentos de la solicitud */}
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                      {item.documentos.map((documento) => {
                        const isPdf = documento.tipo_documento === 'application/pdf'
                        const Icon = isPdf ? FileText : FileImage
                        const visto = vistos.has(documento.id)
                        return (
                          <li key={documento.id} className="flex items-center gap-3 px-4 py-3">
                            <span
                              className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                                isPdf ? 'bg-rose-50 text-rose-600' : 'bg-pizarra-50 text-pizarra-700'
                              }`}
                            >
                              <Icon aria-hidden="true" className="size-[18px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-pizarra-950">
                                {documento.requisito_nombre ?? 'Documento adjunto'}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {documento.nombre_archivo} · {isPdf ? 'PDF' : 'Imagen'}
                              </span>
                            </span>
                            <Button
                              variant="secondary"
                              icon={visto ? Eye : ExternalLink}
                              loading={abriendo === documento.id}
                              disabled={abriendo !== null && abriendo !== documento.id}
                              onClick={() => abrirDocumento(item.solicitud_id, documento)}
                              className="shrink-0"
                              aria-label={`Abrir ${documento.requisito_nombre ?? documento.nombre_archivo} de ${item.numero_radicado} en una pestaña nueva`}
                            >
                              {visto ? 'Ver' : 'Abrir'}
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
