/** Etiqueta de estado de una categoría, con el mismo estilo que UsuarioEstadoBadge. */
export function CategoriaEstadoBadge({ activo, className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        activo ? 'bg-pradera-50 text-pradera-700 ring-pradera-200/70' : 'bg-slate-100 text-slate-500 ring-slate-200'
      } ${className}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${activo ? 'bg-pradera-500' : 'bg-slate-400'}`} />
      {activo ? 'Habilitada' : 'Deshabilitada'}
    </span>
  )
}
