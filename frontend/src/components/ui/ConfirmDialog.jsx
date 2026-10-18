/**
 * Modal de confirmación ("¿Estás seguro…?") para acciones que cambian datos.
 *
 * Se dibuja por encima de otros modales (z-[60]). Mientras `loading` es true no se
 * puede cerrar y el botón de confirmar muestra el indicador de carga.
 *
 * @param {object} props
 * @param {string} props.title Pregunta principal.
 * @param {React.ReactNode} [props.description] Detalle de lo que va a pasar.
 * @param {string} [props.confirmLabel] Texto del botón de confirmar.
 * @param {'primary'|'danger'|'success'} [props.tone] Color del botón de confirmar.
 * @param {React.ComponentType} [props.icon] Icono del encabezado.
 * @param {boolean} [props.loading] La acción está en curso.
 * @param {() => void} props.onConfirm Ejecuta la acción.
 * @param {() => void} props.onCancel Cierra sin hacer cambios.
 */
import { CircleHelp, LoaderCircle } from 'lucide-react'
import Button from './Button'
import Modal from './Modal'

const TONES = {
  primary: {
    button: 'bg-pizarra-900 text-white hover:bg-pizarra-800 disabled:bg-pizarra-300',
    icon: 'bg-pizarra-50 text-pizarra-700',
  },
  danger: {
    button: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
    icon: 'bg-rose-50 text-rose-600',
  },
  success: {
    button: 'bg-pradera-600 text-white hover:bg-pradera-700 disabled:bg-pradera-200',
    icon: 'bg-pradera-50 text-pradera-600',
  },
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  tone = 'primary',
  icon: Icon = CircleHelp,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const styles = TONES[tone] ?? TONES.primary

  return (
    <Modal
      titleId="titulo-confirmacion"
      role="alertdialog"
      size="sm"
      layer="z-[60]"
      dismissible={!loading}
      onClose={onCancel}
      header={
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${styles.icon}`}>
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <h2 id="titulo-confirmacion" className="pt-2 text-base font-semibold text-pizarra-950">
            {title}
          </h2>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-xs transition-colors ${styles.button}`}
          >
            {loading && <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <div className="px-5 py-4 text-sm leading-relaxed text-slate-600 sm:px-6">{description}</div>}
    </Modal>
  )
}
