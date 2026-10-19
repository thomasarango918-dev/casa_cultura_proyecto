/**
 * Página para restablecer la contraseña (ruta /reset-password?token=..., Fase 4).
 *
 * Lee el token del enlace que llegó por correo, pide la nueva contraseña dos
 * veces, valida que coincidan y cumplan la política, y llama a la API.
 * Al terminar muestra un aviso y lleva al inicio de sesión.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Circle, CircleCheck, KeyRound, TriangleAlert } from 'lucide-react'
import AuthShell from '../components/layout/AuthShell'
import Button from '../components/ui/Button'
import PasswordField from '../components/ui/PasswordField'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../services/apiClient'
import { restablecerPassword } from '../services/authService'
import { PASSWORD_REGLAS, validarPassword } from '../utils/validators'

const EMPTY = { nueva: '', confirmacion: '' }

export default function ResetPasswordPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  // true cuando la API dice que el enlace venció o ya se usó.
  const [enlaceInvalido, setEnlaceInvalido] = useState(false)
  const refs = useRef({})

  useEffect(() => {
    document.title = 'Restablecer contraseña | Casa de la Cultura'
    refs.current.nueva?.focus()
  }, [])

  /** Actualiza un campo y borra su error. */
  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  /** Valida localmente, envía a la API y redirige al login si todo sale bien. */
  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    // 1. Las dos contraseñas deben cumplir la política y coincidir.
    const next = {
      nueva: validarPassword(form.nueva),
      confirmacion: !form.confirmacion
        ? 'Confirme la nueva contraseña.'
        : form.confirmacion !== form.nueva
          ? 'Las contraseñas no coinciden.'
          : '',
    }
    setErrors(next)
    const conError = Object.keys(next).find((field) => next[field])
    if (conError) {
      refs.current[conError]?.focus()
      return
    }

    // 2. Envío a la API.
    setSubmitting(true)
    try {
      await restablecerPassword(token, form.nueva)
      toast.success('Contraseña actualizada', 'Ya puede iniciar sesión con su nueva contraseña.')
      navigate('/login', { replace: true })
    } catch (error) {
      const message = getApiErrorMessage(error)
      if (error.response?.status === 400 && /enlace/i.test(message)) {
        // Enlace vencido, alterado o ya usado: hay que pedir uno nuevo.
        setEnlaceInvalido(true)
      } else if (error.response?.status === 400) {
        // Por ejemplo: la nueva contraseña es igual a la actual.
        setErrors({ nueva: message })
      } else {
        const fieldErrors = getApiFieldErrors(error)
        if (fieldErrors.nueva_contrasena) setErrors({ nueva: fieldErrors.nueva_contrasena })
      }
      toast.error('No fue posible cambiar la contraseña', message)
      setSubmitting(false)
    }
  }

  // Sin token en la URL o con el enlace ya vencido: se ofrece pedir uno nuevo.
  if (!token || enlaceInvalido) {
    return (
      <AuthShell>
        <h2 className="text-2xl font-semibold tracking-tight text-pizarra-950">Enlace no válido</h2>
        <div className="mt-6 flex gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-amber-500" />
          <p>
            El enlace de recuperación no es válido, ya se usó o expiró (dura 15 minutos). Solicite uno nuevo para
            continuar.
          </p>
        </div>
        <Link
          to="/forgot-password"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-pizarra-900 px-5 text-[15px] font-semibold text-white shadow-xs transition-colors hover:bg-pizarra-800 active:bg-pizarra-950"
        >
          Solicitar un nuevo enlace
        </Link>
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

  return (
    <AuthShell>
      <h2 className="text-2xl font-semibold tracking-tight text-pizarra-950">Nueva contraseña</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
        Escriba su nueva contraseña. Elija una que no use en otros sitios.
      </p>

      <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
        <PasswordField
          ref={(element) => (refs.current.nueva = element)}
          id="nueva-contrasena"
          label="Nueva Contraseña"
          icon={KeyRound}
          value={form.nueva}
          onChange={(event) => updateField('nueva', event.target.value)}
          error={errors.nueva}
          disabled={submitting}
        />
        <PasswordField
          ref={(element) => (refs.current.confirmacion = element)}
          id="confirmar-contrasena"
          label="Confirmar Contraseña"
          icon={KeyRound}
          value={form.confirmacion}
          onChange={(event) => updateField('confirmacion', event.target.value)}
          error={errors.confirmacion}
          disabled={submitting}
        />

        {/* Requisitos de la contraseña, marcados en vivo (mismos que en Configuración → Seguridad). */}
        <ul aria-label="Requisitos de la contraseña" className="grid gap-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/80">
          {PASSWORD_REGLAS.map((regla) => {
            const cumple = regla.test(form.nueva)
            const Icon = cumple ? CircleCheck : Circle
            return (
              <li key={regla.id} className={`flex items-center gap-2 text-sm ${cumple ? 'text-pradera-700' : 'text-slate-500'}`}>
                <Icon aria-hidden="true" className={`size-4 shrink-0 ${cumple ? 'text-pradera-600' : 'text-slate-300'}`} />
                {regla.label}
                <span className="sr-only">{cumple ? '(cumple)' : '(pendiente)'}</span>
              </li>
            )
          })}
        </ul>

        <Button type="submit" size="lg" loading={submitting} loadingText="Guardando…" className="w-full">
          Cambiar contraseña
        </Button>
      </form>

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
