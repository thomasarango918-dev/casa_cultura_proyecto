/**
 * "Mi Horario Semanal": calendario universitario hecho con CSS Grid.
 *
 *   Columnas: Lunes a Domingo.  Filas: franjas de 30 min de 08:00 a 22:00 (cada hora ocupa 2 filas).
 *
 * Recibe los grupos que ya cargó la página: la API los filtra por rol (el Maestro solo
 * recibe los de sus programas; el Administrador, todos). Si dos bloques se cruzan en el
 * mismo día se dibujan uno al lado del otro. La grilla vive en HorarioSemanalGrid (Fase 9),
 * que también usa el panel general del Maestro.
 *
 * @param {object} props
 * @param {object[]} props.grupos Grupos con `horarios` (GET /admin/grupos).
 * @param {string} props.titulo
 * @param {() => void} props.onClose
 */
import { CalendarDays } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import HorarioSemanalGrid from './HorarioSemanalGrid'

export default function HorarioSemanalModal({ grupos, titulo, onClose }) {
  const conHorario = grupos.some((grupo) => grupo.horarios?.length)
  const sinHorario = grupos.filter((grupo) => !grupo.horarios?.length)

  return (
    <Modal
      titleId="titulo-horario-semanal"
      size="xl"
      onClose={onClose}
      header={
        <>
          <p className="text-xs font-medium text-slate-500">Calendario de clases</p>
          <h2 id="titulo-horario-semanal" className="mt-0.5 text-lg font-semibold text-pizarra-950">
            {titulo}
          </h2>
        </>
      }
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-6">
        {!conHorario ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <CalendarDays aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">Aún no hay horarios registrados</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Agregue bloques de horario al crear o modificar un grupo.
            </p>
          </div>
        ) : (
          <HorarioSemanalGrid grupos={grupos} />
        )}

        {sinHorario.length > 0 && conHorario && (
          <p className="text-sm text-slate-500">
            Sin horario: {sinHorario.map((grupo) => `${grupo.nombre} (${grupo.programa_nombre})`).join(', ')}.
          </p>
        )}
      </div>
    </Modal>
  )
}
