/**
 * Interruptor (switch) accesible con etiqueta y descripción.
 *
 * Es un <button role="switch"> con `aria-checked`: se activa con clic, Espacio o Enter
 * y los lectores de pantalla anuncian "activado / desactivado".
 *
 * @param {object} props
 * @param {string} props.id Identificador del interruptor.
 * @param {string} props.label Texto de la etiqueta.
 * @param {string} [props.description] Texto de ayuda debajo de la etiqueta.
 * @param {boolean} props.checked Estado actual.
 * @param {(checked: boolean) => void} props.onChange Se llama con el nuevo estado.
 * @param {boolean} [props.disabled]
 */
export default function Toggle({ id, label, description, checked, onChange, disabled = false }) {
  const labelId = `${id}-label`
  const descriptionId = `${id}-description`

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span id={labelId} className="block text-sm font-medium text-pizarra-900">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="mt-0.5 block text-sm text-slate-500">
            {description}
          </span>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pizarra-600/20 disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? 'bg-pradera-600' : 'bg-slate-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-5 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
