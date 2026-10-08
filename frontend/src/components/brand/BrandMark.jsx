/**
 * Marca gráfica de la Casa de la Cultura: dos arcos (portal y puerta) sobre una línea de base.
 *
 * @param {object} props
 * @param {string} [props.className] Clases de tamaño, por ejemplo "size-10".
 * @param {'dark'|'light'} [props.tone] "dark" para fondos claros; "light" para fondos oscuros.
 * @param {string} [props.title] Texto alternativo para lectores de pantalla.
 */
export default function BrandMark({ className = 'size-10', tone = 'dark', title = 'Casa de la Cultura' }) {
  const isDark = tone === 'dark'
  const outer = isDark ? 'stroke-white' : 'stroke-pizarra-900'

  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label={title}>
      {/* Fondo cuadrado con esquinas redondeadas */}
      <rect width="40" height="40" rx="10" className={isDark ? 'fill-pizarra-900' : 'fill-white'} />
      {/* Arco exterior: el portal */}
      <path
        d="M11 30V19a9 9 0 0 1 18 0v11"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={outer}
      />
      {/* Arco interior en verde: la puerta */}
      <path
        d="M16.5 30v-9a3.5 3.5 0 0 1 7 0v9"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={isDark ? 'stroke-pradera-400' : 'stroke-pradera-500'}
      />
      {/* Línea de base */}
      <path d="M8 30h24" fill="none" strokeWidth="2.5" strokeLinecap="round" className={outer} />
    </svg>
  )
}
