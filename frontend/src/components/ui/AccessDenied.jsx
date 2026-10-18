/**
 * Vista amigable para un usuario que entra a una sección que su rol no permite.
 *
 * La usa RoleRoute (antes de montar la página, sin consultar la API) y las páginas
 * que reciben un 403 inesperado. Nunca se muestra el error técnico.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldX } from 'lucide-react'

export default function AccessDenied() {
  return (
    <section className="flex min-h-[55dvh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white px-6 py-10 text-center shadow-panel ring-1 ring-slate-200/80 sm:px-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-pizarra-50 text-pizarra-700 ring-8 ring-pizarra-50/50">
          <ShieldX aria-hidden="true" className="size-7" />
        </span>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-pizarra-950">Careces de los suficientes permisos</h1>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-slate-600">
          Tu rol no tiene acceso a esta sección. Si crees que se trata de un error, comunícate con la coordinación de la
          Casa de la Cultura.
        </p>
        <Link
          to="/dashboard"
          className="mt-7 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-pizarra-900 px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-pizarra-800"
        >
          <ArrowLeft aria-hidden="true" className="size-[18px]" />
          Volver al panel general
        </Link>
      </div>
    </section>
  )
}
