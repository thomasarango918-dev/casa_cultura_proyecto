/**
 * Pestaña "Seguridad": cambio de contraseña del usuario que inició sesión.
 *
 * Muestra en vivo las reglas de la contraseña (las mismas que valida la API) y
 * exige que la confirmación coincida. La API además rechaza una contraseña igual
 * a la actual. La sesión sigue abierta después del cambio.
 */
import { useRef, useState } from 'react'
import { CircleCheck, Circle, KeyRound, Save } from 'lucide-react'
import Button from '../ui/Button'
import PasswordField from '../ui/PasswordField'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { cambiarMiPassword } from '../../services/configuracionService'
import { PASSWORD_REGLAS, validarPassword } from '../../utils/validators'

const EMPTY = { password_nueva: '', password_confirmacion: '' }

export default function SeguridadTab() {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const refs = useRef({})

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const next = {
      password_nueva: validarPassword(form.password_nueva),
      password_confirmacion: !form.password_confirmacion
        ? 'Confirme la nueva contraseña.'
        : form.password_confirmacion !== form.password_nueva
          ? 'La confirmación no coincide con la nueva contraseña.'
          : '',
    }
    setErrors(next)
    const conError = Object.keys(next).find((field) => next[field])
    if (conError) {
      refs.current[conError]?.focus()
      return
    }

    setSaving(true)
    try {
      await cambiarMiPassword(form)
      setForm(EMPTY)
      toast.success('Contraseña actualizada', 'Use la nueva contraseña la próxima vez que inicie sesión.')
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error)
      // 400: la nueva contraseña es igual a la actual.
      if (error.response?.status === 400) fieldErrors.password_nueva = getApiErrorMessage(error)
      setErrors((current) => ({ ...current, ...fieldErrors }))
      toast.error('No fue posible cambiar la contraseña', getApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-pizarra-950">Cambiar contraseña</h2>
          <p className="mt-1 text-sm text-slate-500">Elija una contraseña que no use en otros sitios.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            ref={(element) => (refs.current.password_nueva = element)}
            id="password-nueva"
            label="Nueva Contraseña"
            icon={KeyRound}
            value={form.password_nueva}
            onChange={(event) => updateField('password_nueva', event.target.value)}
            error={errors.password_nueva}
            disabled={saving}
          />
          <PasswordField
            ref={(element) => (refs.current.password_confirmacion = element)}
            id="password-confirmacion"
            label="Confirmar Nueva Contraseña"
            icon={KeyRound}
            value={form.password_confirmacion}
            onChange={(event) => updateField('password_confirmacion', event.target.value)}
            error={errors.password_confirmacion}
            disabled={saving}
          />
        </div>

        <ul aria-label="Requisitos de la contraseña" className="grid gap-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200/80 sm:grid-cols-3">
          {PASSWORD_REGLAS.map((regla) => {
            const cumple = regla.test(form.password_nueva)
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
      </div>

      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <Button type="submit" icon={Save} loading={saving} loadingText="Guardando…">
          Guardar Cambios
        </Button>
      </div>
    </form>
  )
}
