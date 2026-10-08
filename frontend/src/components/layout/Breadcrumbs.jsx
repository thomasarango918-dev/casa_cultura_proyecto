/**
 * Migas de pan: muestran dónde está el usuario dentro del sistema (Inicio > Panel general).
 *
 * El primer elemento lleva el icono de casa; el último representa la página actual,
 * no es enlace y se marca con aria-current="page".
 *
 * @param {object} props
 * @param {Array<{label: string, to?: string}>} props.items Elementos en orden, de la raíz a la página actual.
 */
import { Link } from 'react-router-dom'
import { ChevronRight, House } from 'lucide-react'

export default function Breadcrumbs({ items = [] }) {
  if (items.length === 0) return null
  const lastIndex = items.length - 1

  return (
    <nav aria-label="Ruta de navegación">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === lastIndex
          const content = (
            <>
              {index === 0 && <House aria-hidden="true" className="size-4" />}
              <span>{item.label}</span>
            </>
          )

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {/* Separador entre elementos */}
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-slate-300" />}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="inline-flex items-center gap-1.5 rounded transition-colors hover:text-pizarra-900"
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 ${isLast ? 'font-medium text-pizarra-900' : ''}`}
                >
                  {content}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
