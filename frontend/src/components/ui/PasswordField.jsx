/**
 * Campo de contraseña: TextField con el botón para mostrar u ocultar el texto
 * (mismo comportamiento que el formulario de inicio de sesión).
 *
 * Acepta las mismas props que TextField, excepto `type` y `trailing`.
 */
import { forwardRef, useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import TextField from './TextField'

const PasswordField = forwardRef(function PasswordField({ icon = Lock, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      ref={ref}
      icon={icon}
      type={visible ? 'text' : 'password'}
      autoComplete="new-password"
      maxLength={72}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="grid size-9 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
        </button>
      }
      {...props}
    />
  )
})

export default PasswordField
