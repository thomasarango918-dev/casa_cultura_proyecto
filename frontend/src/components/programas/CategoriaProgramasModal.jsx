/**
 * Modal "Expandir": tabla de programas de una categoría con crear, editar y eliminar.
 *
 * @param {object} props
 * @param {object} props.categoria Versión vigente de la categoría (la página la mantiene al día).
 * @param {{status: string, items: object[]}} props.maestros
 * @param {() => void} props.onNeedMaestros Pide cargar los maestros (solo la primera vez).
 * @param {(programa: object, accion: 'creado'|'actualizado'|'eliminado') => void} props.onProgramaChange
 * @param {() => void} props.onClose
 */
import { useState } from 'react'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { CategoriaEstadoBadge } from './ProgramaBadges'
import ProgramaFormModal from './ProgramaFormModal'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { eliminarPrograma } from '../../services/programasService'

export default function CategoriaProgramasModal({ categoria, maestros, onNeedMaestros, onProgramaChange, onClose }) {
  const toast = useToast()
  const [formulario, setFormulario] = useState(null) // { programa: object|null } | null
  const [porEliminar, setPorEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  function abrirFormulario(programa) {
    onNeedMaestros()
    setFormulario({ programa })
  }

  async function confirmarEliminar() {
    setEliminando(true)
    try {
      await eliminarPrograma(porEliminar.id)
      toast.success('Programa eliminado', `«${porEliminar.nombre}» se eliminó de ${categoria.nombre}.`)
      onProgramaChange(porEliminar, 'eliminado')
    } catch (error) {
      toast.error('No fue posible eliminar el programa', getApiErrorMessage(error))
    } finally {
      setEliminando(false)
      setPorEliminar(null)
    }
  }

  const programas = categoria.programas
  const nombresMaestros = (programa) => programa.maestros.map((maestro) => maestro.nombre_completo).join(', ')

  return (
    <>
      <Modal
        titleId="titulo-programas-categoria"
        size="xl"
        dismissible={formulario === null && porEliminar === null}
        onClose={onClose}
        header={
          <>
            <p className="text-xs font-medium text-slate-500">Programas de la categoría</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h2 id="titulo-programas-categoria" className="text-lg font-semibold text-pizarra-950">
                {categoria.nombre}
              </h2>
              <CategoriaEstadoBadge activo={categoria.activo} />
            </div>
          </>
        }
        footer={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        {programas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <BookOpen aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">Esta categoría aún no tiene programas</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              Mientras no tenga programas no aparece en el formulario público.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium sm:pl-6">ID</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Nombre del Programa</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Maestros asignados</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Estudiantes Inscritos</th>
                  <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Grupos Creados</th>
                  <th scope="col" className="px-4 py-2.5 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programas.map((programa) => (
                  <tr key={programa.id} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-500 sm:pl-6">{programa.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-pizarra-900">{programa.nombre}</p>
                      <p className="text-xs text-slate-500 md:hidden">{nombresMaestros(programa) || 'Sin maestros asignados'}</p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {programa.maestros.length > 0 ? (
                        <span className="text-slate-700">{nombresMaestros(programa)}</span>
                      ) : (
                        <span className="text-slate-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-pizarra-900">{programa.estudiantes_inscritos}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-slate-500 sm:table-cell">{programa.grupos_creados}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right sm:pr-6">
                      <button
                        type="button"
                        onClick={() => abrirFormulario(programa)}
                        className="inline-grid size-9 place-items-center rounded-lg text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950"
                        aria-label={`Editar ${programa.nombre}`}
                        title="Editar"
                      >
                        <Pencil aria-hidden="true" className="size-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPorEliminar(programa)}
                        className="inline-grid size-9 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        aria-label={`Eliminar ${programa.nombre}`}
                        title="Eliminar"
                      >
                        <Trash2 aria-hidden="true" className="size-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
          <Button icon={Plus} onClick={() => abrirFormulario(null)}>
            Crear Nuevo Programa
          </Button>
        </div>
      </Modal>

      {formulario && (
        <ProgramaFormModal
          categoria={categoria}
          programa={formulario.programa}
          maestros={maestros}
          onRetryMaestros={onNeedMaestros}
          onClose={() => setFormulario(null)}
          onSaved={onProgramaChange}
        />
      )}

      {porEliminar && (
        <ConfirmDialog
          title="¿Estás seguro de eliminar el programa?"
          description={
            <>
              Se eliminará <strong className="font-semibold text-pizarra-900">{porEliminar.nombre}</strong> de {categoria.nombre}.
              Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Sí, eliminar"
          tone="danger"
          icon={Trash2}
          loading={eliminando}
          onConfirm={confirmarEliminar}
          onCancel={() => setPorEliminar(null)}
        />
      )}
    </>
  )
}
