/**
 * Pestaña "Mi Perfil": datos personales del usuario que inició sesión.
 *
 * Se pueden cambiar el nombre completo y el correo. El documento y el rol se muestran
 * bloqueados: solo un Administrador o un Coordinador los gestiona desde Usuarios y roles.
 * Al guardar, el encabezado del sistema refleja los datos nuevos (AuthContext.updateUser).
 *
 * @param {object} props
 * @param {object} props.perfil Datos de GET /admin/configuracion/me.
 * @param {(perfil: object) => void} props.onSaved Se llama con el perfil actualizado.
 */
import { useRef, useState } from 'react'
import { IdCard, Lock, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { actualizarMiPerfil } from '../../services/configuracionService'
import { limpiarEspacios, validarCorreo, validarNombre } from '../../utils/validators'

export default function PerfilTab({ perfil, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ nombre_completo: perfil.nombre_completo, email: perfil.email })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const refs = useRef({})

  const payload = { nombre_completo: limpiarEspacios(form.nombre_completo), email: form.email.trim().toLowerCase() }
  const hayCambios = payload.nombre_completo !== perfil.nombre_completo || payload.email !== perfil.email

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const next = { nombre_completo: validarNombre(form.nombre_completo), email: validarCorreo(form.email) }
    setErrors(next)
    const conError = Object.keys(next).find((field) => next[field])
    if (conError) {
      refs.current[conError]?.focus()
      return
    }
    if (!hayCambios) {
      toast.info('Sin cambios', 'Sus datos personales ya están actualizados.')
      return
    }

    setSaving(true)
    try {
      const actualizado = await actualizarMiPerfil(payload)
      onSaved(actualizado)
      setForm({ nombre_completo: actualizado.nombre_completo, email: actualizado.email })
      toast.success('Perfil actualizado', 'Sus datos personales se guardaron correctamente.')
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error)
      if (error.response?.status === 409) fieldErrors.email = getApiErrorMessage(error)
      setErrors((current) => ({ ...current, ...fieldErrors }))
      toast.error('No fue posible guardar los cambios', getApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <div className="space-y-5 px-5 py-6 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-pizarra-950">Datos personales</h2>
          <p className="mt-1 text-sm text-slate-500">Esta información identifica su cuenta dentro del sistema.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            ref={(element) => (refs.current.nombre_completo = element)}
            id="perfil-nombre"
            label="Nombre completo"
            icon={UserRound}
            value={form.nombre_completo}
            onChange={(event) => updateField('nombre_completo', event.target.value)}
            error={errors.nombre_completo}
            maxLength={100}
            autoComplete="name"
            disabled={saving}
          />
          <TextField
            ref={(element) => (refs.current.email = element)}
            id="perfil-email"
            label="Correo electrónico"
            icon={Mail}
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            error={errors.email}
            hint="También puede usarlo para iniciar sesión."
            maxLength={150}
            autoComplete="email"
            disabled={saving}
          />
          <TextField
            id="perfil-documento"
            label="Documento de identidad"
            icon={IdCard}
            value={`${perfil.tipo_documento} ${perfil.num_documento}`}
            hint="El número de documento no se puede modificar."
            readOnly
            disabled
          />
          <TextField
            id="perfil-rol"
            label="Rol"
            icon={ShieldCheck}
            value={perfil.rol_etiqueta}
            hint="Solo la administración puede cambiar su rol."
            readOnly
            disabled
            trailing={<Lock aria-hidden="true" className="mr-2 size-4 text-slate-400" />}
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
        <Button type="submit" icon={Save} loading={saving} loadingText="Guardando…" disabled={!hayCambios && !saving}>
          Guardar Cambios
        </Button>
      </div>
    </form>
  )
}
