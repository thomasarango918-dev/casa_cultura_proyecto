/**
 * Casilla de asistencia de 3 estados (reemplaza al checkbox nativo).
 *
 *   AUSENTE  (por defecto)  fondo rojo tenue, X roja.
 *   PRESENTE (clic)         fondo verde tenue, check verde. Otro clic vuelve a Ausente.
 *   EXCUSADO (doble clic)   fondo amarillo tenue, signo menos (justificado).
 *
 * Un doble clic dispara antes dos clics: el segundo (event.detail === 2) se ignora y el
 * onDoubleClick deja el estado en EXCUSADO. Con teclado: Enter/Espacio alterna y "E" excusa.
 *
 * @param {object} props
 * @param {'PRESENTE'|'AUSENTE'|'EXCUSADO'|null} props.value null = sin registro (solo lectura).
 * @param {(estado: string) => void} [props.onChange]
 * @param {boolean} [props.disabled] Columnas de días pasados: solo lectura.
 * @param {string} props.label Texto accesible, por ejemplo "Asistencia de ANA PÉREZ el 5 nov".
 */
import { Check, Minus, X } from 'lucide-react'

export const ESTADOS = {
  AUSENTE: { etiqueta: 'Ausente', icon: X, clase: 'bg-rose-50 text-rose-600 ring-rose-200' },
  PRESENTE: { etiqueta: 'Presente', icon: Check, clase: 'bg-pradera-50 text-pradera-700 ring-pradera-200' },
  EXCUSADO: { etiqueta: 'Excusado', icon: Minus, clase: 'bg-amber-50 text-amber-600 ring-amber-200' },
}

export default function AttendanceToggle({ value, onChange, disabled = false, label }) {
  const estado = ESTADOS[value]

  if (!estado) {
    return (
      <span
        className="inline-grid size-9 place-items-center rounded-lg text-slate-300 ring-1 ring-inset ring-slate-200"
        title="Sin registro"
        aria-label={`${label}: sin registro`}
        role="img"
      >
        –
      </span>
    )
  }

  const Icon = estado.icon

  function handleClick(event) {
    if (event.detail > 1) return // Parte de un doble clic: lo resuelve onDoubleClick.
    onChange?.(value === 'PRESENTE' ? 'AUSENTE' : 'PRESENTE')
  }

  function handleKeyDown(event) {
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault()
      onChange?.('EXCUSADO')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onDoubleClick={() => onChange?.('EXCUSADO')}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={`${label}: ${estado.etiqueta}`}
      title={disabled ? estado.etiqueta : `${estado.etiqueta} · clic: presente/ausente · doble clic: excusado`}
      className={`inline-grid size-9 select-none place-items-center rounded-lg ring-1 ring-inset transition-[transform,background-color,color] duration-100 ${estado.clase} ${
        disabled
          ? 'cursor-default opacity-70'
          : 'cursor-pointer hover:brightness-95 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pizarra-600'
      }`}
    >
      <Icon aria-hidden="true" className="size-[18px]" strokeWidth={2.75} />
    </button>
  )
}
