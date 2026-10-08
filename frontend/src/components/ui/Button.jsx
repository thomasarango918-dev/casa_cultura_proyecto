/**
 * Botón reutilizable con variantes visuales, tamaños y estado de carga.
 *
 * Mientras `loading` es true el botón se deshabilita (evita envíos dobles),
 * muestra un indicador giratorio y, si se indica, cambia su texto por `loadingText`.
 *
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'} [props.variant] Estilo del botón.
 * @param {'md'|'lg'} [props.size] Altura y tamaño del texto.
 * @param {boolean} [props.loading] Muestra el estado de carga.
 * @param {string} [props.loadingText] Texto alternativo durante la carga.
 * @param {React.ComponentType} [props.icon] Icono opcional a la izquierda del texto.
 */
import { LoaderCircle } from 'lucide-react'

/** Clases de color por variante. */
const VARIANTS = {
  primary:
    'bg-pizarra-900 text-white shadow-xs hover:bg-pizarra-800 active:bg-pizarra-950 disabled:bg-pizarra-300',
  secondary:
    'bg-white text-pizarra-900 ring-1 ring-inset ring-slate-300 shadow-xs hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-pizarra-700 hover:bg-slate-100 disabled:text-slate-400',
}

/** Clases de dimensiones por tamaño. */
const SIZES = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  icon: Icon,
  className = '',
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
      ) : (
        Icon && <Icon aria-hidden="true" className="size-[18px]" />
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  )
}
