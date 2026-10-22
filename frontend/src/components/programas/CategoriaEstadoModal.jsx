/**
 * Modal del lápiz de una categoría: interruptor Habilitar/Deshabilitar y "Guardar Cambios".
 * Si la API lo rechaza (estudiantes activos) se informa con un toast y el modal sigue abierto.
 *
 * @param {object} props
 * @param {object} props.categoria Categoría con `programas` y `estudiantes_inscritos`.
 * @param {() => void} props.onClose
 * @param {(categoria: object) => void} props.onSaved
 */
import { useState } from 'react'
import { Save, TriangleAlert } from 'lucide-react'
import { CategoriaEstadoBadge } from './ProgramaBadges'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Toggle from '../ui/Toggle'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { cambiarEstadoCategoria } from '../../services/programasService'

export default function CategoriaEstadoModal({ categoria, onClose, onSaved }) {
  const toast = useToast()
  const [activo, setActivo] = useState(categoria.activo)
  const [enviando, setEnviando] = useState(false)

  const hayCambios = activo !== categoria.activo
  // Aviso anticipado; la regla real la aplica la API.
  const bloqueada = categoria.activo && !activo && categoria.estudiantes_inscritos > 0

  async function guardar() {
    if (!hayCambios) {
      onClose()
      return
    }
    setEnviando(true)
    try {
      const actualizada = await cambiarEstadoCategoria(categoria.id, activo)
      toast.success(
        activo ? 'Categoría habilitada' : 'Categoría deshabilitada',
        activo
          ? `Los programas de «${actualizada.nombre}» vuelven a aparecer en el formulario público.`
          : `Los programas de «${actualizada.nombre}» ya no aparecen en el formulario público.`,
      )
      onSaved(actualizada)
      onClose()
    } catch (error) {
      toast.error(
        activo ? 'No fue posible habilitar la categoría' : 'No fue posible deshabilitar la categoría',
        getApiErrorMessage(error),
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      titleId="titulo-estado-categoria"
      size="md"
      dismissible={!enviando}
      onClose={onClose}
      header={
        <>
          <p className="text-xs font-medium text-slate-500">Editar categoría</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2 id="titulo-estado-categoria" className="text-lg font-semibold text-pizarra-950">
              {categoria.nombre}
            </h2>
            <CategoriaEstadoBadge activo={categoria.activo} />
          </div>
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button icon={Save} onClick={guardar} loading={enviando} loadingText="Guardando…" disabled={!hayCambios}>
            Guardar Cambios
          </Button>
        </>
      }
    >
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {categoria.descripcion && <p className="text-sm leading-relaxed text-slate-600">{categoria.descripcion}</p>}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/80">
            <dt className="text-xs text-slate-500">Programas</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-pizarra-950">{categoria.programas.length}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/80">
            <dt className="text-xs text-slate-500">Estudiantes activos</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-pizarra-950">{categoria.estudiantes_inscritos}</dd>
          </div>
        </dl>

        <div className="rounded-lg p-4 ring-1 ring-slate-200">
          <Toggle
            id="categoria-activa"
            label={activo ? 'Categoría habilitada' : 'Categoría deshabilitada'}
            description="Deshabilitada, sus programas no se ofrecen en el formulario público de inscripción."
            checked={activo}
            onChange={setActivo}
            disabled={enviando}
          />
        </div>

        {bloqueada && (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200/80">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Hay {categoria.estudiantes_inscritos} estudiante{categoria.estudiantes_inscritos === 1 ? '' : 's'} con
            solicitudes pendientes o aprobadas en esta categoría; el sistema no permitirá deshabilitarla.
          </p>
        )}
      </div>
    </Modal>
  )
}
