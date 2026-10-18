/**
 * Modal de creación y edición de usuarios.
 *
 * Creación (`usuario` = null):
 *   Nombre, correo, tipo y número de documento, rol y contraseña inicial. El rol solo
 *   ofrece los que el usuario actual puede asignar (los entrega la API en `catalogos`):
 *   el Administrador ve todos; el Coordinador, Maestro y Estudiante.
 *
 * Edición (`usuario` = fila de la tabla):
 *   - El número de documento se muestra bloqueado: es inmutable.
 *   - "Guardar cambios" abre la confirmación "¿Estás seguro de realizar estos cambios?";
 *     al confirmar se envía el PUT, se muestra un aviso y se actualiza la tabla.
 *   - "Deshabilitar / Habilitar usuario" abre su propia confirmación; al confirmar se
 *     envía el PATCH, se muestra un aviso y se actualiza la tabla (el modal sigue abierto).
 *   - Nadie puede cambiar su propio rol ni deshabilitar su propia cuenta.
 *
 * @param {object} props
 * @param {object|null} props.usuario Usuario a editar; null para crear uno nuevo.
 * @param {{roles: object[], tipos_documento: object[]}} props.catalogos Opciones de las listas.
 * @param {number} props.currentUserId Id del usuario que inició sesión.
 * @param {() => void} props.onClose Cierra el modal.
 * @param {(usuario: object, accion: 'creado'|'actualizado'|'estado') => void} props.onSaved
 *   Se llama con el usuario que devolvió la API.
 */
import { useMemo, useRef, useState } from 'react'
import { BadgeCheck, CircleAlert, IdCard, Lock, Mail, Save, ShieldCheck, ShieldOff, UserPlus, UserRound } from 'lucide-react'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import PasswordField from '../ui/PasswordField'
import SelectField from '../ui/SelectField'
import TextField from '../ui/TextField'
import { UsuarioEstadoBadge } from './UsuarioBadges'
import { etiquetaRol } from '../../config/roles'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { actualizarUsuario, cambiarEstadoUsuario, crearUsuario } from '../../services/usuariosService'
import {
  limpiarEspacios,
  normalizarDocumento,
  validarCorreo,
  validarDocumento,
  validarNombre,
  validarPassword,
} from '../../utils/validators'

/** Valores iniciales del formulario. */
function initialForm(usuario, catalogos) {
  if (usuario) {
    return {
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      tipo_documento_id: String(usuario.tipo_documento_id),
      num_documento: usuario.num_documento,
      rol_id: String(usuario.rol_id),
      password: '',
    }
  }
  return {
    nombre_completo: '',
    email: '',
    tipo_documento_id: String(catalogos.tipos_documento[0]?.id ?? ''),
    num_documento: '',
    rol_id: '',
    password: '',
  }
}

/** Cuerpo que se envía a la API (sin espacios sobrantes y con ids numéricos). */
function toPayload(form, esEdicion) {
  const payload = {
    nombre_completo: limpiarEspacios(form.nombre_completo),
    email: form.email.trim().toLowerCase(),
    tipo_documento_id: Number(form.tipo_documento_id),
    rol_id: Number(form.rol_id),
  }
  if (!esEdicion) {
    payload.num_documento = normalizarDocumento(form.num_documento)
    payload.password = form.password
  }
  return payload
}

export default function UsuarioFormModal({ usuario, catalogos, currentUserId, onClose, onSaved }) {
  const toast = useToast()
  const esEdicion = Boolean(usuario)
  const esCuentaPropia = esEdicion && usuario.id === currentUserId

  const [actual, setActual] = useState(usuario) // Estado vigente (cambia al habilitar/deshabilitar).
  const [form, setForm] = useState(() => initialForm(usuario, catalogos))
  const [errors, setErrors] = useState({})
  const [confirmacion, setConfirmacion] = useState(null) // 'guardar' | 'estado' | null
  const [enviando, setEnviando] = useState(false)
  const fieldRefs = useRef({})

  // Opciones de rol: las que el usuario actual puede asignar. Si el rol vigente no está
  // (no debería ocurrir), se agrega deshabilitado para que la lista no quede en blanco.
  const roles = useMemo(() => {
    const lista = catalogos.roles
    if (esEdicion && !lista.some((rol) => rol.id === usuario.rol_id)) {
      return [{ id: usuario.rol_id, etiqueta: etiquetaRol(usuario.rol), disabled: true }, ...lista]
    }
    return lista
  }, [catalogos.roles, esEdicion, usuario])

  const payload = toPayload(form, esEdicion)
  const hayCambios =
    !esEdicion ||
    payload.nombre_completo !== actual.nombre_completo ||
    payload.email !== actual.email ||
    payload.tipo_documento_id !== actual.tipo_documento_id ||
    payload.rol_id !== actual.rol_id

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: '' }))
  }

  function validate() {
    const next = {
      nombre_completo: validarNombre(form.nombre_completo),
      email: validarCorreo(form.email),
      tipo_documento_id: form.tipo_documento_id ? '' : 'Seleccione el tipo de documento.',
      rol_id: form.rol_id ? '' : 'Seleccione el rol.',
    }
    if (!esEdicion) {
      next.num_documento = validarDocumento(form.num_documento)
      next.password = validarPassword(form.password)
    }
    const conError = Object.keys(next).filter((field) => next[field])
    setErrors(next)
    if (conError.length > 0) fieldRefs.current[conError[0]]?.focus()
    return conError.length === 0
  }

  /** Muestra los errores de la API junto a cada campo; si no son de un campo, como aviso. */
  function handleApiError(error, titulo) {
    const fieldErrors = getApiFieldErrors(error)
    const message = getApiErrorMessage(error)
    if (error.response?.status === 409) {
      // Correo o documento ya registrado.
      fieldErrors[/correo/i.test(message) ? 'email' : 'num_documento'] = message
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors((current) => ({ ...current, ...fieldErrors }))
      fieldRefs.current[Object.keys(fieldErrors)[0]]?.focus()
    }
    toast.error(titulo, message)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validate()) return
    if (esEdicion) {
      if (!hayCambios) {
        toast.info('Sin cambios', 'No modificó ningún dato del usuario.')
        return
      }
      setConfirmacion('guardar')
      return
    }

    setEnviando(true)
    try {
      const creado = await crearUsuario(payload)
      toast.success('Usuario creado', `${creado.nombre_completo} ya puede iniciar sesión.`)
      onSaved(creado, 'creado')
      onClose()
    } catch (error) {
      handleApiError(error, 'No fue posible crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  async function guardarCambios() {
    setEnviando(true)
    try {
      const actualizado = await actualizarUsuario(actual.id, payload)
      toast.success('Cambios guardados', `Se actualizaron los datos de ${actualizado.nombre_completo}.`)
      onSaved(actualizado, 'actualizado')
      onClose()
    } catch (error) {
      setConfirmacion(null)
      handleApiError(error, 'No fue posible guardar los cambios')
    } finally {
      setEnviando(false)
    }
  }

  async function cambiarEstado() {
    const activar = !actual.activo
    setEnviando(true)
    try {
      const actualizado = await cambiarEstadoUsuario(actual.id, activar)
      setActual(actualizado)
      onSaved(actualizado, 'estado')
      toast.success(
        activar ? 'Usuario habilitado' : 'Usuario deshabilitado',
        activar
          ? `${actualizado.nombre_completo} puede volver a iniciar sesión.`
          : `${actualizado.nombre_completo} ya no podrá iniciar sesión.`,
      )
    } catch (error) {
      toast.error(activar ? 'No fue posible habilitar el usuario' : 'No fue posible deshabilitar el usuario', getApiErrorMessage(error))
    } finally {
      setConfirmacion(null)
      setEnviando(false)
    }
  }

  const ref = (field) => (element) => {
    fieldRefs.current[field] = element
  }

  return (
    <>
      <Modal
        titleId="titulo-usuario"
        size="lg"
        dismissible={!enviando && confirmacion === null}
        onClose={onClose}
        header={
          <>
            <p className="text-xs font-medium text-slate-500">{esEdicion ? 'Editar usuario' : 'Usuarios y roles'}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 id="titulo-usuario" className="text-lg font-semibold text-pizarra-950">
                {esEdicion ? actual.nombre_completo : 'Crear usuario'}
              </h2>
              {esEdicion && <UsuarioEstadoBadge activo={actual.activo} />}
            </div>
          </>
        }
        footer={
          <>
            {esEdicion && !esCuentaPropia && (
              <button
                type="button"
                onClick={() => setConfirmacion('estado')}
                disabled={enviando}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold shadow-xs ring-1 ring-inset transition-colors disabled:text-slate-400 disabled:ring-slate-200 sm:mr-auto ${
                  actual.activo ? 'text-rose-700 ring-rose-200 hover:bg-rose-50' : 'text-pradera-700 ring-pradera-200 hover:bg-pradera-50'
                }`}
              >
                {actual.activo ? (
                  <ShieldOff aria-hidden="true" className="size-[18px]" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="size-[18px]" />
                )}
                {actual.activo ? 'Deshabilitar usuario' : 'Habilitar usuario'}
              </button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-usuario"
              icon={esEdicion ? Save : UserPlus}
              loading={enviando && confirmacion === null}
              loadingText={esEdicion ? 'Guardando…' : 'Creando…'}
              disabled={enviando}
            >
              {esEdicion ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </>
        }
      >
        <form id="form-usuario" noValidate onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
          {esEdicion && !actual.activo && (
            <p className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Esta cuenta está deshabilitada: el usuario no puede iniciar sesión hasta que se habilite de nuevo.
            </p>
          )}

          <TextField
            ref={ref('nombre_completo')}
            id="usuario-nombre"
            label="Nombre completo"
            icon={UserRound}
            value={form.nombre_completo}
            onChange={(event) => updateField('nombre_completo', event.target.value)}
            error={errors.nombre_completo}
            maxLength={100}
            autoComplete="off"
            disabled={enviando}
          />

          <TextField
            ref={ref('email')}
            id="usuario-email"
            label="Correo electrónico"
            icon={Mail}
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            error={errors.email}
            maxLength={150}
            autoComplete="off"
            disabled={enviando}
          />

          <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
            <SelectField
              ref={ref('tipo_documento_id')}
              id="usuario-tipo-documento"
              label="Tipo de documento"
              value={form.tipo_documento_id}
              onChange={(event) => updateField('tipo_documento_id', event.target.value)}
              error={errors.tipo_documento_id}
              disabled={enviando}
            >
              {catalogos.tipos_documento.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.sigla}
                </option>
              ))}
            </SelectField>
            <TextField
              ref={ref('num_documento')}
              id="usuario-documento"
              label="Número de documento"
              icon={esEdicion ? Lock : IdCard}
              value={form.num_documento}
              onChange={(event) => updateField('num_documento', event.target.value)}
              error={errors.num_documento}
              hint={esEdicion ? 'El número de documento no se puede modificar.' : undefined}
              readOnly={esEdicion}
              disabled={esEdicion || enviando}
              maxLength={20}
              inputMode="text"
              autoComplete="off"
            />
          </div>

          <SelectField
            ref={ref('rol_id')}
            id="usuario-rol"
            label="Rol"
            value={form.rol_id}
            onChange={(event) => updateField('rol_id', event.target.value)}
            error={errors.rol_id}
            hint={esCuentaPropia ? 'No puede cambiar su propio rol.' : undefined}
            disabled={esCuentaPropia || enviando}
          >
            {!esEdicion && (
              <option value="" disabled>
                Seleccione un rol
              </option>
            )}
            {roles.map((rol) => (
              <option key={rol.id} value={rol.id} disabled={rol.disabled}>
                {rol.etiqueta}
              </option>
            ))}
          </SelectField>

          {!esEdicion && (
            <PasswordField
              ref={ref('password')}
              id="usuario-password"
              label="Contraseña inicial"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              error={errors.password}
              hint="Mínimo 8 caracteres, con letras y números. Compártala con el usuario de forma segura."
              disabled={enviando}
            />
          )}

          {esCuentaPropia && (
            <p className="flex items-start gap-2 rounded-lg bg-pizarra-50/70 p-3 text-sm text-pizarra-700 ring-1 ring-pizarra-100">
              <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Esta es su cuenta. Puede cambiar su contraseña desde Configuración.
            </p>
          )}
        </form>
      </Modal>

      {confirmacion === 'guardar' && (
        <ConfirmDialog
          title="¿Estás seguro de realizar estos cambios?"
          description={`Se actualizarán los datos de ${actual.nombre_completo}.`}
          confirmLabel="Sí, guardar cambios"
          icon={Save}
          loading={enviando}
          onConfirm={guardarCambios}
          onCancel={() => setConfirmacion(null)}
        />
      )}

      {confirmacion === 'estado' && (
        <ConfirmDialog
          title={`¿Estás seguro de ${actual.activo ? 'deshabilitar' : 'habilitar'} este usuario?`}
          description={
            actual.activo
              ? `${actual.nombre_completo} no podrá iniciar sesión y perderá el acceso de inmediato.`
              : `${actual.nombre_completo} podrá volver a iniciar sesión con su contraseña.`
          }
          confirmLabel={actual.activo ? 'Sí, deshabilitar' : 'Sí, habilitar'}
          tone={actual.activo ? 'danger' : 'success'}
          icon={actual.activo ? ShieldOff : ShieldCheck}
          loading={enviando}
          onConfirm={cambiarEstado}
          onCancel={() => setConfirmacion(null)}
        />
      )}
    </>
  )
}
