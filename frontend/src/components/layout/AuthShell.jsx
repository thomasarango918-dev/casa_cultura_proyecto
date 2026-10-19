/**
 * Marco de las pantallas de recuperación de contraseña (Fase 4).
 *
 * Usa el mismo diseño de dos columnas del inicio de sesión:
 *   - Izquierda: panel institucional con la marca y el patrón de curvas de nivel.
 *   - Derecha:   el contenido de la página (`children`).
 */
import BrandMark from '../brand/BrandMark'
import TopographicPattern from '../brand/TopographicPattern'

export default function AuthShell({ children }) {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panel institucional (igual al del login) */}
      <aside className="relative isolate overflow-hidden bg-pizarra-950 text-white">
        <TopographicPattern className="absolute inset-0 -z-10 size-full text-white" />
        <div className="flex h-full flex-col px-6 py-7 sm:px-10 sm:py-9 lg:min-h-dvh lg:px-14 lg:py-12">
          <div className="flex items-center gap-3">
            <BrandMark tone="light" className="size-11 shrink-0" />
            <div>
              <p className="text-[15px] font-semibold leading-tight">Casa de la Cultura</p>
              <p className="text-sm text-pizarra-300">San Pedro de los Milagros</p>
            </div>
          </div>

          <div className="mt-10 max-w-md lg:mt-auto">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-[2.5rem] lg:leading-[1.12]">
              Gestión académica de la Casa de la Cultura
            </h1>
          </div>

          <p className="mt-12 hidden text-sm text-pizarra-400 lg:block">
            Municipio de San Pedro de los Milagros, Antioquia
          </p>
        </div>
      </aside>

      {/* Contenido de la página */}
      <main className="flex items-center justify-center px-6 py-10 sm:px-10 sm:py-14 lg:py-12">
        <div className="w-full max-w-sm">
          {children}
          <p className="mt-10 text-xs text-slate-400">© {year} Casa de la Cultura de San Pedro de los Milagros</p>
        </div>
      </main>
    </div>
  )
}
