/**
 * Página de inicio de sesión.
 *
 * Diseño en dos columnas (en móvil se apilan):
 *   - Izquierda: panel institucional con la marca y el patrón de curvas de nivel.
 *   - Derecha:   formulario de acceso.
 *
 * Flujo del formulario:
 *   1. Validación local de los campos (sin llamar a la API).
 *   2. Envío de las credenciales mediante AuthContext.login().
 *   3. Éxito: aviso de bienvenida; PublicOnlyRoute redirige al panel.
 *   4. Error: aviso flotante con el mensaje de la API; si la contraseña es
 *      incorrecta, se limpia el campo y se le devuelve el foco.
 */
import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, KeyRound, Lock, TriangleAlert, UserRound } from 'lucide-react'
import BrandMark from '../components/brand/BrandMark'
import TopographicPattern from '../components/brand/TopographicPattern'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getApiErrorMessage } from '../services/apiClient'
import { getFirstName } from '../utils/formatters'

/** Validación básica de formato de correo: texto@dominio.extensión. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Valida los campos antes de enviarlos a la API.
 * Si el identificador contiene "@" se valida como correo; si no, como documento.
 *
 * @returns {{identificador?: string, password?: string}} Mensajes de error por campo (vacío si todo es válido).
 */
function validate({ identificador, password }) {
  const errors = {}
  const value = identificador.trim()

  if (!value) {
    errors.identificador = 'Ingrese su correo electrónico o número de documento.'
  } else if (value.includes('@') && !EMAIL_PATTERN.test(value)) {
    errors.identificador = 'El correo electrónico no tiene un formato válido.'
  } else if (!value.includes('@') && value.replace(/[\s.-]/g, '').length < 3) {
    errors.identificador = 'El número de documento debe tener al menos 3 caracteres.'
  }

  if (!password) errors.password = 'Ingrese su contraseña.'
  return errors
}

/** Título del aviso de error según la respuesta de la API (los códigos los define auth_controller.py). */
function getErrorTitle(error) {
  if (!error?.response) return 'Sin conexión con el servidor'
  if (error.response.status === 401) return 'Credenciales no válidas'
  if (error.response.status === 403) return 'Cuenta inactiva'
  if (error.response.status === 422) return 'Datos incompletos'
  return 'No fue posible iniciar sesión'
}

export default function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()

  // Estado del formulario
  const [form, setForm] = useState({ identificador: '', password: '' })
  const [errors, setErrors] = useState({})
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Referencias para mover el foco y para recordar el último aviso de error.
  const identificadorRef = useRef(null)
  const passwordRef = useRef(null)
  const errorToastRef = useRef(null)

  // Al abrir la página: título de la pestaña y foco en el primer campo.
  useEffect(() => {
    document.title = 'Iniciar sesión | Casa de la Cultura'
    identificadorRef.current?.focus()
  }, [])

  /** Actualiza el campo editado y borra su error en cuanto el usuario empieza a corregirlo. */
  function handleChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  /** Detecta si Bloq Mayús está activo mientras se escribe la contraseña. */
  function handlePasswordKey(event) {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'))
    }
  }

  /** Envía el formulario: valida, llama a la API y muestra el resultado. */
  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    // 1. Validación local; el foco va al primer campo con error.
    const validation = validate(form)
    setErrors(validation)
    if (validation.identificador) {
      identificadorRef.current?.focus()
      return
    }
    if (validation.password) {
      passwordRef.current?.focus()
      return
    }

    // Un nuevo intento reemplaza el aviso de error anterior.
    if (errorToastRef.current) {
      toast.dismiss(errorToastRef.current)
      errorToastRef.current = null
    }

    // 2. Envío a la API.
    setSubmitting(true)
    try {
      const usuario = await login(form.identificador.trim(), form.password, remember)
      // 3. Éxito: no hace falta navegar manualmente, PublicOnlyRoute redirige al panel.
      toast.success('Sesión iniciada', `Le damos la bienvenida, ${getFirstName(usuario.nombre_completo)}.`)
    } catch (error) {
      // 4. Error: se muestra el aviso y se reactiva el formulario.
      errorToastRef.current = toast.error(getErrorTitle(error), getApiErrorMessage(error))
      setSubmitting(false)
      if (error.response?.status === 401) {
        setForm((current) => ({ ...current, password: '' }))
        // Se espera al siguiente cuadro: el campo deja de estar deshabilitado tras el render.
        requestAnimationFrame(() => passwordRef.current?.focus())
      }
    }
  }

  const year = new Date().getFullYear()

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panel institucional */}
      <aside className="relative isolate overflow-hidden bg-pizarra-950 text-white">
        <TopographicPattern className="absolute inset-0 -z-10 size-full text-white" />
        <div className="flex h-full flex-col px-6 py-7 sm:px-10 sm:py-9 lg:min-h-dvh lg:px-14 lg:py-12">
          {/* Marca */}
          <div className="flex items-center gap-3">
            <BrandMark tone="light" className="size-11 shrink-0" />
            <div>
              <p className="text-[15px] font-semibold leading-tight">Casa de la Cultura</p>
              <p className="text-sm text-pizarra-300">San Pedro de los Milagros</p>
            </div>
          </div>

          {/* Título. En escritorio, lg:mt-auto lo empuja hacia la parte inferior del panel. */}
          <div className="mt-10 max-w-md lg:mt-auto">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-[2.5rem] lg:leading-[1.12]">
              Gestión académica de la Casa de la Cultura
            </h1>
          </div>

          <p className="mt-12 hidden text-sm text-pizarra-400 lg:block">
            Municipio de San Pedro de los Milagros, Antioquia
          </p>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex items-center justify-center px-6 py-10 sm:px-10 sm:py-14 lg:py-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-pizarra-950">Iniciar sesión</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
            Ingrese con su correo electrónico o su número de documento.
          </p>

          {/* noValidate desactiva los mensajes nativos del navegador; se usan los propios en español. */}
          <form noValidate onSubmit={handleSubmit} className="mt-8 space-y-5">
            <TextField
              ref={identificadorRef}
              id="identificador"
              name="identificador"
              label="Correo electrónico o documento"
              icon={UserRound}
              placeholder="nombre@correo.com o 1036123456"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={form.identificador}
              onChange={handleChange}
              error={errors.identificador}
              disabled={submitting}
            />

            <div>
              <TextField
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                label="Contraseña"
                icon={Lock}
                placeholder="Su contraseña"
                autoComplete="current-password"
                value={form.password}
                onChange={handleChange}
                onKeyUp={handlePasswordKey}
                onKeyDown={handlePasswordKey}
                onBlur={() => setCapsLockOn(false)}
                error={errors.password}
                disabled={submitting}
                trailing={
                  // Botón para mostrar u ocultar la contraseña.
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="grid size-9 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                    aria-controls="password"
                  >
                    {showPassword ? (
                      <EyeOff aria-hidden="true" className="size-[18px]" />
                    ) : (
                      <Eye aria-hidden="true" className="size-[18px]" />
                    )}
                  </button>
                }
              />
              {/* Aviso de Bloq Mayús, frecuente causa de contraseñas "incorrectas". */}
              {capsLockOn && (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-amber-700">
                  <TriangleAlert aria-hidden="true" className="size-4" />
                  Bloq Mayús está activado.
                </p>
              )}
            </div>

            {/* Marcado: la sesión sobrevive al cerrar el navegador (localStorage). Ver sessionStore.js. */}
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={submitting}
                className="size-4 rounded border-slate-300 accent-pizarra-900"
              />
              Mantener la sesión iniciada en este equipo
            </label>

            <Button
              type="submit"
              size="lg"
              loading={submitting}
              loadingText="Verificando…"
              className="w-full"
            >
              Iniciar sesión
            </Button>
          </form>

          {/* Ayuda para recuperar la contraseña */}
          <div className="mt-8 flex gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200/70">
            <KeyRound aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-pizarra-500" />
            <p>
              ¿Olvidó su contraseña? Solicite el restablecimiento a la coordinación académica de la Casa de
              la Cultura.
            </p>
          </div>

          <p className="mt-10 text-xs text-slate-400">
            © {year} Casa de la Cultura de San Pedro de los Milagros
          </p>
        </div>
      </main>
    </div>
  )
}
