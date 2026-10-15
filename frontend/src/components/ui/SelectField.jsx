/**
 * Lista desplegable con la misma apariencia y accesibilidad que TextField.
 *
 * @param {object} props
 * @param {string} props.id Identificador único del select.
 * @param {string} props.label Texto de la etiqueta.
 * @param {string} [props.error] Mensaje de error; si existe, el campo se pinta en rojo.
 * @param {string} [props.hint] Texto de ayuda (se oculta cuando hay error).
 * @param {React.ReactNode} props.children Opciones (<option>).
 */
import { forwardRef } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'

const SelectField = forwardRef(function SelectField(
  { id, label, error, hint, className = '', children, ...selectProps },
  ref,
) {
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  const stateClasses = error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
    : 'border-slate-300 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15'

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-pizarra-900">
        {label}
      </label>
      <div className="relative mt-1.5">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={`block h-11 w-full appearance-none rounded-lg border bg-white pl-3.5 pr-10 text-[15px] text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 disabled:bg-slate-50 disabled:text-slate-500 ${stateClasses}`}
          {...selectProps}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400"
        />
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

export default SelectField
