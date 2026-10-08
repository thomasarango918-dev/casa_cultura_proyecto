/**
 * Campo de texto reutilizable con etiqueta, icono opcional, acción al final y mensaje de error.
 *
 * Accesibilidad:
 *   - La etiqueta queda asociada al input mediante `id` / `htmlFor`.
 *   - El mensaje de error o de ayuda se enlaza con `aria-describedby`.
 *   - `aria-invalid` indica a los lectores de pantalla que el valor tiene un error.
 *
 * Se declara con forwardRef para que el formulario pueda mover el foco al campo.
 *
 * @param {object} props
 * @param {string} props.id Identificador único del input.
 * @param {string} props.label Texto de la etiqueta.
 * @param {React.ComponentType} [props.icon] Icono que se muestra a la izquierda.
 * @param {string} [props.error] Mensaje de error; si existe, el campo se pinta en rojo.
 * @param {string} [props.hint] Texto de ayuda (se oculta cuando hay error).
 * @param {React.ReactNode} [props.trailing] Elemento a la derecha, por ejemplo el botón de mostrar contraseña.
 */
import { forwardRef } from 'react'
import { CircleAlert } from 'lucide-react'

const TextField = forwardRef(function TextField(
  { id, label, icon: Icon, error, hint, trailing, className = '', ...inputProps },
  ref,
) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  // Colores del borde y del anillo de foco según haya o no error.
  const stateClasses = error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
    : 'border-slate-300 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15'

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-pizarra-900">
        {label}
      </label>
      <div className="relative mt-1.5">
        {Icon && (
          <Icon
            aria-hidden="true"
            className={`pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 ${
              error ? 'text-rose-500' : 'text-slate-400'
            }`}
          />
        )}
        {/* El relleno lateral se ajusta para dejar espacio al icono y a la acción final. */}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={`block h-11 w-full rounded-lg border bg-white text-[15px] text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${trailing ? 'pr-12' : 'pr-3.5'} ${stateClasses}`}
          {...inputProps}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-rose-600">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1.5 text-sm text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
})

export default TextField
