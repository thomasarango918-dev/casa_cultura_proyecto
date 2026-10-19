/**
 * Página "¿Olvidaste tu contraseña?" (ruta /forgot-password, Fase 4).
 *
 * Pide solo el número de documento. La API responde siempre lo mismo, exista o
 * no el documento, y si existe envía el enlace al correo registrado del usuario.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, IdCard, MailCheck } from 'lucide-react'
import AuthShell from '../components/layout/AuthShell'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import { solicitarRecuperacion } from '../services/authService'
import { normalizarDocumento, validarDocumento } from '../utils/validators'

/** Mensaje genérico (el mismo que devuelve la API). */
const MENSAJE_ENVIADO = 'Si el documento existe en el sistema, hemos enviado las instrucciones al correo asociado.'

export default function ForgotPasswordPage() {
  const toast = useToast()
  const [documento, setDocumento] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const inputRef = useRef(null)

  // Título de la pestaña y foco en el campo al abrir la página.
  useEffect(() => {
    document.title = 'Recuperar contraseña | Casa de la Cultura'
    inputRef.current?.focus()
  }, [])

  /** Valida el documento, llama a la API y muestra el aviso. */
  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const mensajeError = validarDocumento(documento)
    setError(mensajeError)
    if (mensajeError) {
      inputRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      const { mensaje } = await solicitarRecuperacion(normalizarDocumento(documento))
      toast.success('Solicitud enviada', mensaje || MENSAJE_ENVIADO)
      setEnviado(true)
    } catch (err) {
      toast.error('No fue posible enviar la solicitud', getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight text-pizarra-950">Recuperar contraseña</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        Escriba su número de documento y le enviaremos un enlace al correo registrado.
      </p>

      {enviado ? (
        // Confirmación: no se revela si el documento existe.
        <div className="mt-8 flex gap-3 rounded-xl bg-pradera-50 p-4 text-sm leading-relaxed text-pradera-700 ring-1 ring-pradera-200">
          <MailCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-pradera-600" />
          <div>
            <p>{MENSAJE_ENVIADO}</p>
            <p className="mt-2 text-slate-600">El enlace vence en 15 minutos. Revise también la carpeta de spam.</p>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
          <TextField
            ref={inputRef}
            id="numero_documento"
            name="numero_documento"
            label="Número de Documento"
            icon={IdCard}
            placeholder="1036123456"
            inputMode="text"
            autoComplete="username"
            spellCheck={false}
            value={documento}
            onChange={(event) => {
              setDocumento(event.target.value)
              if (error) setError('')
            }}
            error={error}
            disabled={submitting}
          />
          <Button type="submit" size="lg" loading={submitting} loadingText="Enviando…" className="w-full">
            Solicitar Recuperación
          </Button>
        </form>
      )}

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-pizarra-700 hover:text-pizarra-950 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Volver a iniciar sesión
      </Link>
    </AuthShell>
  )
}
