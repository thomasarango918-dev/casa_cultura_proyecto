/**
 * Avatar circular con las iniciales del usuario.
 *
 * Es decorativo (aria-hidden): el nombre completo siempre aparece como texto
 * junto al avatar, así que no se repite para los lectores de pantalla.
 *
 * @param {object} props
 * @param {string} props.name Nombre completo del que se obtienen las iniciales.
 * @param {'sm'|'md'|'lg'} [props.size] Tamaño del círculo.
 */
import { getInitials } from '../../utils/formatters'

const SIZES = {
  sm: 'size-9 text-sm',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
}

export default function Avatar({ name, size = 'sm', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-full bg-pradera-100 font-semibold text-pradera-700 ring-2 ring-white ${SIZES[size]} ${className}`}
    >
      {getInitials(name)}
    </span>
  )
}
