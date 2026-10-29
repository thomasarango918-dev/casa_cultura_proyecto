/**
 * Modal "Expandir": estudiantes activos del grupo. Quien gestiona el grupo puede
 * desasignarlos (soft delete en la API: queda la fecha de desvinculación).
 *
 * @param {object} props
 * @param {object} props.grupo
 * @param {boolean} props.puedeGestionar Muestra la columna de acciones.
 * @param {() => void} props.onChange Avisa que cambió el número de estudiantes.
 * @param {() => void} props.onClose
 */
import { useEffect, useState } from 'react'
import { LoaderCircle, RefreshCw, TriangleAlert, UserMinus, UsersRound, X } from 'lucide-react'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage } from '../../services/apiClient'
import { desasignarEstudiante, listEstudiantesGrupo } from '../../services/gruposService'
import { formatShortDate } from '../../utils/formatters'

export default function GrupoEstudiantesModal({ grupo, puedeGestionar, onChange, onClose }) {
  const toast = useToast()
  const [estado, setEstado] = useState({ status: 'loading', items: [], error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const [porQuitar, setPorQuitar] = useState(null)
  const [quitando, setQuitando] = useState(false)

  useEffect(() => {
    let cancelado = false
    setEstado((current) => ({ ...current, status: 'loading' }))
    listEstudiantesGrupo(grupo.id)
      .then((items) => !cancelado && setEstado({ status: 'ready', items, error: '' }))
      .catch((error) => !cancelado && setEstado({ status: 'error', items: [], error: getApiErrorMessage(error) }))
    return () => {
      cancelado = true
    }
  }, [grupo.id, reloadKey])

  const estudiantes = estado.items

  async function confirmarQuitar() {
    setQuitando(true)
    try {
      await desasignarEstudiante(grupo.id, porQuitar.solicitud_id)
      toast.success('Estudiante desasignado', `${porQuitar.nombre_completo} salió de «${grupo.nombre}».`)
      setEstado((current) => ({ ...current, items: current.items.filter((item) => item.solicitud_id !== porQuitar.solicitud_id) }))
      onChange()
    } catch (error) {
      toast.error('No fue posible desasignar al estudiante', getApiErrorMessage(error))
      // 404: otra persona ya lo había desasignado; la lista se pone al día.
      if (error.response?.status === 404) setReloadKey((key) => key + 1)
    } finally {
      setQuitando(false)
      setPorQuitar(null)
    }
  }

  return (
    <>
      <Modal
        titleId="titulo-estudiantes-grupo"
        size="xl"
        dismissible={porQuitar === null}
        onClose={onClose}
        header={
          <>
            <p className="text-xs font-medium text-slate-500">Estudiantes asignados</p>
            <h2 id="titulo-estudiantes-grupo" className="mt-0.5 text-lg font-semibold text-pizarra-950">
              {grupo.nombre} ({grupo.programa_nombre})
            </h2>
          </>
        }
        footer={
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        }
      >
        {estado.status === 'loading' && (
          <div role="status" className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Cargando estudiantes…
          </div>
        )}

        {estado.status === 'error' && (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500">
              <TriangleAlert aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">No fue posible cargar los estudiantes</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{estado.error}</p>
            <Button variant="secondary" icon={RefreshCw} onClick={() => setReloadKey((key) => key + 1)} className="mt-5">
              Reintentar
            </Button>
          </div>
        )}

        {estado.status === 'ready' && estudiantes.length === 0 && (
          <div className="px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
              <UsersRound aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-pizarra-900">Este grupo aún no tiene estudiantes</p>
            {puedeGestionar && (
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">Use el botón de asignar estudiantes en la tarjeta del grupo.</p>
            )}
          </div>
        )}

        {estado.status === 'ready' && estudiantes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-medium text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium sm:pl-6">Nombre completo</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Fecha de ingreso</th>
                  {puedeGestionar && (
                    <th scope="col" className="px-4 py-2.5 text-right font-medium sm:pr-6">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {estudiantes.map((estudiante) => (
                  <tr key={estudiante.solicitud_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 sm:pl-6">
                      <p className="font-medium text-pizarra-900">{estudiante.nombre_completo}</p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {estudiante.tipo_documento} {estudiante.numero_documento}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                      {formatShortDate(estudiante.fecha_ingreso)}
                    </td>
                    {puedeGestionar && (
                      <td className="whitespace-nowrap px-4 py-3 text-right sm:pr-6">
                        <button
                          type="button"
                          onClick={() => setPorQuitar(estudiante)}
                          className="inline-grid size-9 place-items-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          aria-label={`Desasignar a ${estudiante.nombre_completo}`}
                          title="Desasignar"
                        >
                          <X aria-hidden="true" className="size-[18px]" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {porQuitar && (
        <ConfirmDialog
          title="¿Eliminar al estudiante de este grupo?"
          description={
            <>
              <strong className="font-semibold text-pizarra-900">{porQuitar.nombre_completo}</strong> dejará de pertenecer a{' '}
              {grupo.nombre}. Su solicitud aprobada se conserva y podrá asignarse de nuevo.
            </>
          }
          confirmLabel="Sí, desasignar"
          tone="danger"
          icon={UserMinus}
          loading={quitando}
          onConfirm={confirmarQuitar}
          onCancel={() => setPorQuitar(null)}
        />
      )}
    </>
  )
}
