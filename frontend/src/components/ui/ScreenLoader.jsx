/**
 * Pantalla de carga a página completa.
 * Se muestra mientras se verifica la sesión guardada contra la API.
 *
 * @param {object} props
 * @param {string} [props.message] Texto que acompaña al indicador de carga.
 */
import { LoaderCircle } from 'lucide-react'
import BrandMark from '../brand/BrandMark'

export default function ScreenLoader({ message = 'Cargando…' }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-slate-50 px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <BrandMark className="size-12" />
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-pizarra-600" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  )
}
