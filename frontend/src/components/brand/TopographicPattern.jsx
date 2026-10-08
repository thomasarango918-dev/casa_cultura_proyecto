/**
 * Patrón decorativo de curvas de nivel para fondos institucionales oscuros.
 *
 * Las curvas normales usan el color del texto del contenedor (`currentColor`) con
 * baja opacidad; las curvas índice usan el verde pradera. Es puramente decorativo,
 * por eso se oculta a los lectores de pantalla (aria-hidden).
 */
import { useMemo } from 'react'
import { buildContours } from './topography'

export default function TopographicPattern({ className = '' }) {
  // La geometría se calcula una sola vez por montaje del componente.
  const contours = useMemo(() => buildContours(), [])

  return (
    <svg
      viewBox="0 0 600 800"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" strokeLinejoin="round">
        {contours.map((contour) => (
          <path
            key={contour.id}
            d={contour.d}
            className={contour.isIndex ? 'stroke-pradera-400' : 'stroke-current'}
            strokeOpacity={contour.isIndex ? 0.5 : 0.13}
            strokeWidth={contour.isIndex ? 1.4 : 1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {/* Punto que marca la cima. Se oculta en pantallas pequeñas, donde queda junto al logo. */}
      <circle cx="420" cy="330" r="3" className="fill-pradera-300 max-lg:hidden" />
    </svg>
  )
}
