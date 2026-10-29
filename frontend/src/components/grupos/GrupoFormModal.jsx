/**
 * Modal para crear un grupo (programa + nombre) o renombrarlo y eliminarlo.
 *
 * @param {object} props
 * @param {object|null} props.grupo Grupo a editar; null para crear.
 * @param {() => void} props.onClose
 * @param {(grupo: object, accion: 'creado'|'actualizado') => void} props.onSaved
 * @param {(grupo: object) => void} [props.onDeleted]
 */
import { useEffect, useRef, useState } from 'react'
import { Plus, Save, Trash2, UsersRound } from 'lucide-react'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import SelectField from '../ui/SelectField'
import TextField from '../ui/TextField'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { crearGrupo, eliminarGrupo, listProgramasParaGrupos, renombrarGrupo } from '../../services/gruposService'
import { limpiarEspacios } from '../../utils/validators'

const NOMBRE_MIN = 2
const NOMBRE_MAX = 100

function validarNombre(nombre) {
  const limpio = limpiarEspacios(nombre)
  if (!limpio) return 'Escriba el nombre del grupo.'
  if (limpio.length < NOMBRE_MIN) return `El nombre debe tener al menos ${NOMBRE_MIN} caracteres.`
  return ''
}

export default function GrupoFormModal({ grupo, onClose, onSaved, onDeleted }) {
  const toast = useToast()
  const esEdicion = Boolean(grupo)

  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [programaId, setProgramaId] = useState('')
  const [programas, setProgramas] = useState({ status: esEdicion ? 'ready' : 'loading', items: [] })
  const [errors, setErrors] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const nombreRef = useRef(null)

  useEffect(() => {
    if (esEdicion) return
    let cancelado = false
    listProgramasParaGrupos()
      .then((items) => {
        if (cancelado) return
        setProgramas({ status: 'ready', items })
        // Un maestro con un solo programa no tiene que elegir.
        if (items.length === 1) setProgramaId(String(items[0].id))
      })
      .catch((error) => {
        if (cancelado) return
        setProgramas({ status: 'error', items: [] })
        toast.error('No fue posible cargar los programas', getApiErrorMessage(error))
      })
    return () => {
      cancelado = true
    }
  }, [esEdicion, toast])

  const nombreLimpio = limpiarEspacios(nombre)
  const hayCambios = !esEdicion || nombreLimpio !== grupo.nombre
  const puedeEliminar = esEdicion && grupo.estudiantes_activos === 0

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!esEdicion && !programaId) nextErrors.programa_id = 'Seleccione el programa del grupo.'
    const errorNombre = validarNombre(nombre)
    if (errorNombre) nextErrors.nombre = errorNombre
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      if (nextErrors.nombre) nombreRef.current?.focus()
      return
    }
    if (!hayCambios) {
      onClose()
      return
    }

    setEnviando(true)
    try {
      const guardado = esEdicion
        ? await renombrarGrupo(grupo.id, nombreLimpio)
        : await crearGrupo({ programa_id: Number(programaId), nombre: nombreLimpio })
      toast.success(
        esEdicion ? 'Grupo actualizado' : 'Grupo creado',
        `«${guardado.nombre}» (${guardado.programa_nombre}).`,
      )
      onSaved(guardado, esEdicion ? 'actualizado' : 'creado')
      onClose()
    } catch (error) {
      const message = getApiErrorMessage(error)
      const fieldErrors = getApiFieldErrors(error)
      if (error.response?.status === 400) fieldErrors[/programa/i.test(message) ? 'programa_id' : 'nombre'] = message
      setErrors(fieldErrors)
      toast.error(esEdicion ? 'No fue posible guardar el grupo' : 'No fue posible crear el grupo', message)
    } finally {
      setEnviando(false)
    }
  }

  async function handleEliminar() {
    setEliminando(true)
    try {
      await eliminarGrupo(grupo.id)
      toast.success('Grupo eliminado', `«${grupo.nombre}» se eliminó de ${grupo.programa_nombre}.`)
      onDeleted?.(grupo)
      onClose()
    } catch (error) {
      toast.error('No fue posible eliminar el grupo', getApiErrorMessage(error))
      setConfirmarEliminar(false)
    } finally {
      setEliminando(false)
    }
  }

  let programaHint
  if (programas.status === 'loading') programaHint = 'Cargando programas…'
  else if (programas.status === 'ready' && programas.items.length === 0)
    programaHint = 'No tiene programas asignados donde crear grupos.'

  const ocupado = enviando || eliminando

  return (
    <>
      <Modal
        titleId="titulo-grupo"
        size="md"
        dismissible={!ocupado && !confirmarEliminar}
        onClose={onClose}
        header={
          <>
            <p className="text-xs font-medium text-slate-500">{esEdicion ? 'Modificar grupo' : 'Crear nuevo grupo'}</p>
            <h2 id="titulo-grupo" className="mt-0.5 text-lg font-semibold text-pizarra-950">
              {esEdicion ? `${grupo.nombre} (${grupo.programa_nombre})` : 'Nuevo grupo'}
            </h2>
          </>
        }
        footer={
          <>
            {esEdicion && (
              <button
                type="button"
                onClick={() => setConfirmarEliminar(true)}
                disabled={!puedeEliminar || ocupado}
                title={puedeEliminar ? undefined : 'Desasigne primero a todos los estudiantes'}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:text-slate-400 disabled:hover:bg-transparent sm:mr-auto"
              >
                <Trash2 aria-hidden="true" className="size-[18px]" /> Eliminar Grupo
              </button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={ocupado}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-grupo"
              icon={esEdicion ? Save : Plus}
              loading={enviando}
              loadingText={esEdicion ? 'Guardando…' : 'Creando…'}
              disabled={!hayCambios || eliminando || (!esEdicion && programas.items.length === 0)}
            >
              {esEdicion ? 'Guardar' : 'Crear'}
            </Button>
          </>
        }
      >
        <form id="form-grupo" noValidate onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
          {!esEdicion && (
            <SelectField
              id="grupo-programa"
              label="Programa"
              value={programaId}
              onChange={(event) => {
                setProgramaId(event.target.value)
                if (errors.programa_id) setErrors((current) => ({ ...current, programa_id: '' }))
              }}
              error={errors.programa_id}
              hint={programaHint}
              disabled={ocupado || programas.status !== 'ready'}
            >
              <option value="">Seleccione un programa</option>
              {programas.items.map((programa) => (
                <option key={programa.id} value={programa.id}>
                  {programa.nombre}
                  {programa.categoria_nombre ? ` · ${programa.categoria_nombre}` : ''}
                </option>
              ))}
            </SelectField>
          )}

          <TextField
            ref={nombreRef}
            id="grupo-nombre"
            label="Nombre del grupo"
            icon={UsersRound}
            value={nombre}
            onChange={(event) => {
              setNombre(event.target.value)
              if (errors.nombre) setErrors((current) => ({ ...current, nombre: '' }))
            }}
            error={errors.nombre}
            maxLength={NOMBRE_MAX}
            placeholder="Ej. Grupo A - Sábados"
            autoComplete="off"
            disabled={ocupado}
          />

          {esEdicion && !puedeEliminar && (
            <p className="text-sm text-slate-500">
              Para eliminar el grupo primero desasigne a sus {grupo.estudiantes_activos} estudiante
              {grupo.estudiantes_activos === 1 ? '' : 's'}.
            </p>
          )}
        </form>
      </Modal>

      {confirmarEliminar && (
        <ConfirmDialog
          title="¿Estás seguro de eliminar el grupo?"
          description={
            <>
              Se eliminará <strong className="font-semibold text-pizarra-900">{grupo.nombre}</strong> de{' '}
              {grupo.programa_nombre}. Esta acción no se puede deshacer.
            </>
          }
          confirmLabel="Sí, eliminar"
          tone="danger"
          icon={Trash2}
          loading={eliminando}
          onConfirm={handleEliminar}
          onCancel={() => setConfirmarEliminar(false)}
        />
      )}
    </>
  )
}
