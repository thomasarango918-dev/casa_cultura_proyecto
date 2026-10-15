/**
 * Modal de revisión y evaluación de una solicitud.
 *
 * Contenido:
 *   1. Datos del aspirante.
 *   2. Documentos adjuntos: cada uno se abre en una pestaña nueva del navegador.
 *   3. Evaluación (solo si la solicitud está PENDIENTE):
 *        - Justificación obligatoria (mínimo 10 caracteres).
 *        - Botones "Aprobar" y "Rechazar", que se habilitan solo cuando el
 *          funcionario abrió TODOS los documentos adjuntos.
 *      Si ya fue evaluada, se muestra la decisión, su justificación y quién la tomó.
 *
 * Los documentos se descargan con el token (services/documentViewer.js) y se abren como
 * URL temporal (blob:), porque una pestaña nueva no envía el encabezado Authorization.
 *
 * @param {object} props
 * @param {number|null} props.solicitudId Solicitud a mostrar; null cierra el modal.
 * @param {() => void} props.onClose Cierra el modal.
 * @param {(detalle: object) => void} props.onEvaluated Se llama con el detalle actualizado tras evaluar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  ExternalLink,
  Eye,
  FileImage,
  FileText,
  LoaderCircle,
  RefreshCw,
  UsersRound,
  X,
} from 'lucide-react'
import Button from '../ui/Button'
import EstadoBadge from './EstadoBadge'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { abrirDocumentoEnPestana } from '../../services/documentViewer'
import { evaluarSolicitud, getSolicitud } from '../../services/solicitudesService'
import { formatBirthDate, formatDateTime } from '../../utils/formatters'

const MIN_JUSTIFICACION = 10
const MAX_JUSTIFICACION = 2000

/** Fila de datos del aspirante. */
function Dato({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-pizarra-900">{children || '—'}</dd>
    </div>
  )
}

export default function EvaluacionModal({ solicitudId, onClose, onEvaluated }) {
  const toast = useToast()
  const [detalle, setDetalle] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState('')
  const [abiertos, setAbiertos] = useState(() => new Set())
  const [abriendo, setAbriendo] = useState(null)
  const [justificacion, setJustificacion] = useState('')
  const [justificacionError, setJustificacionError] = useState('')
  const [enviando, setEnviando] = useState(null) // 'APROBADO' | 'RECHAZADO' | null

  const dialogRef = useRef(null)
  const textareaRef = useRef(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await getSolicitud(solicitudId)
      setDetalle(data)
      setStatus('ready')
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'No fue posible cargar la solicitud.'))
      setStatus('error')
    }
  }, [solicitudId])

  useEffect(() => {
    load()
  }, [load])

  // Enfoca el modal al abrirlo para que el teclado y los lectores de pantalla empiecen en él.
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // Bloquea el desplazamiento de la página y cierra con Escape (salvo mientras se guarda).
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event) => {
      if (event.key === 'Escape' && !enviando) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose, enviando])

  /** Descarga el documento con el token y lo muestra en una pestaña nueva (ver documentViewer.js). */
  async function abrirDocumento(documento) {
    setAbriendo(documento.id)
    try {
      const abierto = await abrirDocumentoEnPestana(detalle.id, documento)
      if (!abierto) {
        toast.warning('Ventana bloqueada', 'Permita las ventanas emergentes de este sitio para ver los documentos.')
        return
      }
      setAbiertos((current) => new Set(current).add(documento.id))
    } catch (error) {
      toast.error('No fue posible abrir el documento', getApiErrorMessage(error))
    } finally {
      setAbriendo(null)
    }
  }

  async function evaluar(estado) {
    const texto = justificacion.trim()
    if (texto.length < MIN_JUSTIFICACION) {
      setJustificacionError(
        texto
          ? `La justificación debe tener al menos ${MIN_JUSTIFICACION} caracteres.`
          : 'Escriba la justificación de la respuesta.',
      )
      textareaRef.current?.focus()
      return
    }

    setEnviando(estado)
    try {
      const actualizado = await evaluarSolicitud(detalle.id, { estado, justificacion: texto })
      onEvaluated(actualizado)
      toast.success(
        estado === 'APROBADO' ? 'Solicitud aprobada' : 'Solicitud rechazada',
        `La solicitud ${actualizado.numero_radicado} fue ${estado === 'APROBADO' ? 'aprobada' : 'rechazada'}.`,
      )
      onClose()
    } catch (error) {
      if (error.response?.status === 409) {
        // Otro funcionario la evaluó primero: se muestra la decisión vigente.
        toast.warning('Solicitud ya evaluada', getApiErrorMessage(error))
        const vigente = await getSolicitud(detalle.id).catch(() => null)
        if (vigente) {
          setDetalle(vigente)
          onEvaluated(vigente)
        }
      } else {
        toast.error('No fue posible guardar la evaluación', getApiErrorMessage(error))
      }
    } finally {
      setEnviando(null)
    }
  }

  const documentos = detalle?.documentos ?? []
  const totalAbiertos = documentos.filter((documento) => abiertos.has(documento.id)).length
  const todosAbiertos = documentos.length > 0 && totalAbiertos === documentos.length
  const pendiente = detalle?.estado === 'PENDIENTE'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* Fondo oscuro: un clic fuera del panel cierra el modal. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar"
        onClick={() => !enviando && onClose()}
        className="absolute inset-0 bg-pizarra-950/60 backdrop-blur-[2px] animate-fade-in"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-evaluacion"
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-float ring-1 ring-pizarra-900/10 animate-fade-in focus:outline-none sm:rounded-2xl"
      >
        {/* Encabezado */}
        <header className="flex items-start gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">Solicitud de inscripción</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 id="titulo-evaluacion" className="font-mono text-lg font-semibold text-pizarra-950">
                {detalle?.numero_radicado ?? 'Cargando…'}
              </h2>
              {detalle && <EstadoBadge estado={detalle.estado} />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(enviando)}
            className="-mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {status === 'loading' && (
            <div role="status" className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando solicitud…
            </div>
          )}

          {status === 'error' && (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
                <CircleAlert aria-hidden="true" className="size-6" />
              </span>
              <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar la solicitud</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{loadError}</p>
              <Button variant="secondary" icon={RefreshCw} onClick={load} className="mt-5">
                Reintentar
              </Button>
            </div>
          )}

          {status === 'ready' && detalle && (
            <>
              {/* 1. Datos del aspirante */}
              <section aria-label="Datos del aspirante" className="px-5 py-5 sm:px-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Dato label="Aspirante">{detalle.nombre_completo}</Dato>
                  <Dato label="Documento">
                    {detalle.tipo_documento} {detalle.numero_documento}
                  </Dato>
                  <Dato label="Correo electrónico">{detalle.correo_electronico}</Dato>
                  <Dato label="Teléfono">{detalle.telefono}</Dato>
                  <Dato label="Fecha de nacimiento">
                    {detalle.fecha_nacimiento && formatBirthDate(detalle.fecha_nacimiento)}
                  </Dato>
                  <Dato label="Edad">
                    {detalle.edad !== null && (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {detalle.edad} {detalle.edad === 1 ? 'año' : 'años'}
                        {detalle.es_menor_de_edad && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80">
                            Menor de edad
                          </span>
                        )}
                      </span>
                    )}
                  </Dato>
                  <Dato label="Programa">{detalle.programa}</Dato>
                  <Dato label="Fecha de radicación">{formatDateTime(detalle.fecha_radicacion)}</Dato>
                </dl>
              </section>

              {/* 1b. Acudiente (solo aspirantes menores de edad) */}
              {detalle.acudiente && (
                <section aria-labelledby="titulo-acudiente" className="border-t border-slate-100 px-5 py-5 sm:px-6">
                  <h3 id="titulo-acudiente" className="flex items-center gap-2 text-sm font-semibold text-pizarra-950">
                    <UsersRound aria-hidden="true" className="size-4 text-pizarra-600" />
                    Acudiente
                  </h3>
                  <dl className="mt-3 grid gap-4 rounded-xl bg-pizarra-50/60 p-4 ring-1 ring-pizarra-100 sm:grid-cols-2">
                    <Dato label="Nombre completo">{detalle.acudiente.nombre}</Dato>
                    <Dato label="Parentesco">{detalle.acudiente.parentesco}</Dato>
                    <Dato label="Cédula">{detalle.acudiente.documento}</Dato>
                    <Dato label="Número de contacto">{detalle.acudiente.telefono}</Dato>
                  </dl>
                </section>
              )}

              {/* 2. Documentos */}
              <section aria-labelledby="titulo-documentos" className="border-t border-slate-100 px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 id="titulo-documentos" className="text-sm font-semibold text-pizarra-950">
                    Documentos adjuntos
                  </h3>
                  {pendiente && (
                    <span
                      className={`text-xs font-medium tabular-nums ${todosAbiertos ? 'text-pradera-700' : 'text-slate-500'}`}
                    >
                      Revisados {totalAbiertos} de {documentos.length}
                    </span>
                  )}
                </div>
                <ul className="mt-3 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                  {documentos.map((documento) => {
                    const isPdf = documento.tipo_documento === 'application/pdf'
                    const Icon = isPdf ? FileText : FileImage
                    const abierto = abiertos.has(documento.id)
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
                          {/* Título: el documento requerido; los archivos anteriores al ajuste no tienen requisito. */}
                          <span className="block truncate text-sm font-medium text-pizarra-950">
                            {documento.requisito_nombre ?? 'Documento adjunto'}
                          </span>
                          <span className="block truncate text-xs text-slate-500">{documento.nombre_archivo}</span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            {abierto ? (
                              <>
                                <CircleCheck aria-hidden="true" className="size-3.5 text-pradera-600" />
                                <span className="text-pradera-700">Revisado</span>
                              </>
                            ) : (
                              <>{isPdf ? 'PDF' : 'Imagen'} · sin abrir</>
                            )}
                          </span>
                        </span>
                        <Button
                          variant="secondary"
                          icon={abierto ? Eye : ExternalLink}
                          loading={abriendo === documento.id}
                          disabled={abriendo !== null && abriendo !== documento.id}
                          onClick={() => abrirDocumento(documento)}
                          className="shrink-0"
                          aria-label={`Abrir ${documento.requisito_nombre ?? documento.nombre_archivo} en una pestaña nueva`}
                        >
                          {abierto ? 'Ver' : 'Abrir'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {/* 3a. Decisión ya tomada */}
              {!pendiente && (
                <section aria-label="Resultado de la evaluación" className="border-t border-slate-100 px-5 py-5 sm:px-6">
                  <div
                    className={`rounded-xl p-4 ring-1 ${
                      detalle.estado === 'APROBADO' ? 'bg-pradera-50 ring-pradera-200/70' : 'bg-rose-50 ring-rose-200/80'
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-pizarra-950">
                      {detalle.estado === 'APROBADO' ? (
                        <CircleCheck aria-hidden="true" className="size-[18px] text-pradera-600" />
                      ) : (
                        <CircleX aria-hidden="true" className="size-[18px] text-rose-600" />
                      )}
                      {detalle.estado === 'APROBADO' ? 'Solicitud aprobada' : 'Solicitud rechazada'}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                      {detalle.justificacion_respuesta}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      {detalle.evaluado_por ? `${detalle.evaluado_por} · ` : ''}
                      {formatDateTime(detalle.fecha_evaluacion)}
                    </p>
                  </div>
                </section>
              )}

              {/* 3b. Formulario de evaluación */}
              {pendiente && (
                <section aria-labelledby="titulo-justificacion" className="border-t border-slate-100 px-5 py-5 sm:px-6">
                  <label id="titulo-justificacion" htmlFor="justificacion" className="block text-sm font-semibold text-pizarra-950">
                    Justificación de la respuesta <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    ref={textareaRef}
                    id="justificacion"
                    rows={4}
                    maxLength={MAX_JUSTIFICACION}
                    value={justificacion}
                    onChange={(event) => {
                      setJustificacion(event.target.value)
                      if (justificacionError) setJustificacionError('')
                    }}
                    disabled={Boolean(enviando)}
                    placeholder="Explique el motivo de la decisión."
                    aria-invalid={justificacionError ? 'true' : 'false'}
                    aria-describedby="justificacion-ayuda"
                    className={`mt-1.5 block w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 disabled:bg-slate-50 ${
                      justificacionError
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                        : 'border-slate-300 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15'
                    }`}
                  />
                  <div id="justificacion-ayuda" className="mt-1.5 flex justify-between gap-4 text-sm">
                    {justificacionError ? (
                      <p className="flex items-start gap-1.5 text-rose-600">
                        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                        {justificacionError}
                      </p>
                    ) : (
                      <p className="text-slate-500">Obligatoria, mínimo {MIN_JUSTIFICACION} caracteres.</p>
                    )}
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {justificacion.length}/{MAX_JUSTIFICACION}
                    </span>
                  </div>

                  {!todosAbiertos && (
                    <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200/80">
                      <Eye aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      Abra todos los documentos adjuntos para habilitar las opciones de aprobar o rechazar.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* Acciones */}
        {status === 'ready' && pendiente && (
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={() => evaluar('RECHAZADO')}
              disabled={!todosAbiertos || Boolean(enviando)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-rose-700 shadow-xs ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-50 disabled:bg-white disabled:text-slate-400 disabled:ring-slate-200"
            >
              {enviando === 'RECHAZADO' ? (
                <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
              ) : (
                <CircleX aria-hidden="true" className="size-[18px]" />
              )}
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => evaluar('APROBADO')}
              disabled={!todosAbiertos || Boolean(enviando)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-pradera-600 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-pradera-700 disabled:bg-pradera-200"
            >
              {enviando === 'APROBADO' ? (
                <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
              ) : (
                <CircleCheck aria-hidden="true" className="size-[18px]" />
              )}
              Aprobar
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}
