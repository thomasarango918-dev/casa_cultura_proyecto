/**
 * Modal "Expandir": tabla de programas de una categoría con crear, editar y deshabilitar/habilitar.
 * Fase 10: arriba los activos; debajo del separador "Deshabilitado", los inactivos en gris.
 *
 * @param {object} props
 * @param {object} props.categoria Versión vigente de la categoría (la página la mantiene al día).
 * @param {{status: string, items: object[]}} props.maestros
 * @param {() => void} props.onNeedMaestros Pide cargar los maestros (solo la primera vez).
 * @param {(programa: object, accion: 'creado'|'actualizado') => void} props.onProgramaChange
 * @param {() => void} props.onClose
 */
import { useState } from 'react'
import { BookOpen, Pencil, Plus, Power, PowerOff } from 'lucide-react'
import { CategoriaEstadoBadge } from './ProgramaBadges'
import ProgramaFormModal from './ProgramaFormModal'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { cambiarEstadoPrograma } from '../../services/programasService'

const nombresMaestros = (programa) => programa.maestros.map((maestro) => maestro.nombre_completo).join(', ')

/** Fila de la tabla. `deshabilitado` cambia el sombreado y el botón de estado. */
function FilaPrograma({ programa, deshabilitado, onEditar, onCambiarEstado }) {
  return (
    <tr
      className={
        deshabilitado ? 'border-slate-200 bg-slate-100/80 text-slate-500' : 'transition-colors hover:bg-slate-50'
      }
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-slate-500 sm:pl-6">{programa.id}</td>
      <td className="px-4 py-3">
        <p className={`font-medium ${deshabilitado ? 'text-slate-500' : 'text-pizarra-900'}`}>{programa.nombre}</p>
        <p className="text-xs text-slate-500 md:hidden">{nombresMaestros(programa) || 'Sin maestros asignados'}</p>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        {programa.maestros.length > 0 ? (
          <span className={deshabilitado ? 'text-slate-500' : 'text-slate-700'}>{nombresMaestros(programa)}</span>
        ) : (
          <span className="text-slate-400">Sin asignar</span>
        )}
      </td>
      <td className={`px-4 py-3 text-right tabular-nums ${deshabilitado ? 'text-slate-500' : 'text-pizarra-900'}`}>
        {programa.estudiantes_inscritos}
      </td>
      <td className="hidden px-4 py-3 text-right tabular-nums text-slate-500 sm:table-cell">{programa.grupos_creados}</td>
      <td className="whitespace-nowrap px-4 py-3 text-right sm:pr-6">
        <button
          type="button"
          onClick={onEditar}
          className="inline-grid size-9 place-items-center rounded-lg text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950"
          aria-label={`Editar ${programa.nombre}`}
          title="Editar"
        >
          <Pencil aria-hidden="true" className="size-[18px]" />
        </button>
        {deshabilitado ? (
          <button
            type="button"
            onClick={onCambiarEstado}
            className="inline-grid size-9 place-items-center rounded-lg text-pradera-700 transition-colors hover:bg-pradera-50 hover:text-pradera-800"
            aria-label={`Habilitar ${programa.nombre}`}
            title="Habilitar"
          >
            <Power aria-hidden="true" className="size-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onCambiarEstado}
            className="inline-grid size-9 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
            aria-label={`Deshabilitar ${programa.nombre}`}
            title="Deshabilitar"
          >
            <PowerOff aria-hidden="true" className="size-[18px]" />
          </button>
        )}
      </td>
    </tr>
  )
}

export default function CategoriaProgramasModal({ categoria, maestros, onNeedMaestros, onProgramaChange, onClose }) {
  const toast = useToast()
  const [formulario, setFormulario] = useState(null) // { programa: object|null } | null
  const [porCambiar, setPorCambiar] = useState(null) // programa a deshabilitar o habilitar
  const [cambiando, setCambiando] = useState(false)

  function abrirFormulario(programa) {
    onNeedMaestros()
    setFormulario({ programa })
  }

  async function confirmarCambioEstado() {
    const activar = !porCambiar.activo
    setCambiando(true)
    try {
      const actualizado = await cambiarEstadoPrograma(porCambiar.id, activar)
      toast.success(
        activar ? 'Programa habilitado' : 'Programa deshabilitado',
        activar
          ? `«${actualizado.nombre}» vuelve a aparecer en el formulario público.`
          : `«${actualizado.nombre}» ya no aparece en el formulario público.`,
      )
      onProgramaChange(actualizado, 'actualizado')
    } catch (error) {
      // 403 sin texto crudo: mensaje propio.
      const mensaje =
        error.response?.status === 403 ? 'Careces de los suficientes permisos.' : getApiErrorMessage(error)
      toast.error(activar ? 'No fue posible habilitar el programa' : 'No fue posible deshabilitar el programa', mensaje)
    } finally {
      setCambiando(false)
      setPorCambiar(null)
    }
  }

  const programas = categoria.programas
  // activo undefined (respuesta anterior a la Fase 10) se trata como habilitado.
  const activos = programas.filter((programa) => programa.activo !== false)
  const deshabilitados = programas.filter((programa) => programa.activo === false)

  return (
    <>
      <Modal
        titleId="titulo-programas-categoria"
        size="xl"
        dismissible={formulario === null && porCambiar === null}
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
                {activos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400 sm:px-6">
                      No hay programas habilitados en esta categoría
                    </td>
                  </tr>
                )}
                {activos.map((programa) => (
                  <FilaPrograma
                    key={programa.id}
                    programa={programa}
                    onEditar={() => abrirFormulario(programa)}
                    onCambiarEstado={() => setPorCambiar(programa)}
                  />
                ))}
              </tbody>
              {deshabilitados.length > 0 && (
                <tbody className="divide-y divide-slate-200">
                  {/* Separador con etiqueta entre activos y deshabilitados. */}
                  <tr>
                    <th scope="colgroup" colSpan={6} className="px-4 pb-2 pt-5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                          Deshabilitado
                        </span>
                        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                      </div>
                    </th>
                  </tr>
                  {deshabilitados.map((programa) => (
                    <FilaPrograma
                      key={programa.id}
                      programa={programa}
                      deshabilitado
                      onEditar={() => abrirFormulario(programa)}
                      onCambiarEstado={() => setPorCambiar(programa)}
                    />
                  ))}
                </tbody>
              )}
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

      {porCambiar && porCambiar.activo !== false && (
        <ConfirmDialog
          title="¿Deshabilitar el programa?"
          description={
            <>
              <strong className="font-semibold text-pizarra-900">{porCambiar.nombre}</strong> dejará de aparecer en el
              formulario público de inscripción y pasará a la sección de deshabilitados. Sus solicitudes, grupos y
              asistencias se conservan.
            </>
          }
          confirmLabel="Sí, deshabilitar"
          tone="danger"
          icon={PowerOff}
          loading={cambiando}
          onConfirm={confirmarCambioEstado}
          onCancel={() => setPorCambiar(null)}
        />
      )}

      {porCambiar && porCambiar.activo === false && (
        <ConfirmDialog
          title="¿Habilitar el programa?"
          description={
            <>
              <strong className="font-semibold text-pizarra-900">{porCambiar.nombre}</strong> volverá a aparecer en el
              formulario público de inscripción.
            </>
          }
          confirmLabel="Sí, habilitar"
          tone="success"
          icon={Power}
          loading={cambiando}
          onConfirm={confirmarCambioEstado}
          onCancel={() => setPorCambiar(null)}
        />
      )}
    </>
  )
}
