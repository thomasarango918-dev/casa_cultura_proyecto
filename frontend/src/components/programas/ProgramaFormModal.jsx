/**
 * Sub-modal para crear o editar un programa (nombre y maestro asignado).
 * Se abre encima del modal de la categoría, por eso usa la capa z-[60].
 *
 * @param {object} props
 * @param {object} props.categoria Categoría dueña del programa (su nombre va en el encabezado).
 * @param {object|null} props.programa Programa a editar; null para crear.
 * @param {{status: 'loading'|'ready'|'error', items: object[]}} props.maestros Usuarios con rol Maestro.
 * @param {() => void} props.onRetryMaestros
 * @param {() => void} props.onClose
 * @param {(programa: object, accion: 'creado'|'actualizado') => void} props.onSaved
 */
import { useRef, useState } from 'react'
import { BookOpen, Plus, Save } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import SelectField from '../ui/SelectField'
import TextField from '../ui/TextField'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { actualizarPrograma, crearPrograma } from '../../services/programasService'
import { CATALOGO_NOMBRE_MAX, limpiarEspacios, validarNombreCatalogo } from '../../utils/validators'

export default function ProgramaFormModal({ categoria, programa, maestros, onRetryMaestros, onClose, onSaved }) {
  const toast = useToast()
  const esEdicion = Boolean(programa)

  const [nombre, setNombre] = useState(programa?.nombre ?? '')
  const [maestroId, setMaestroId] = useState(programa?.maestro_id ? String(programa.maestro_id) : '')
  const [errors, setErrors] = useState({})
  const [enviando, setEnviando] = useState(false)
  const nombreRef = useRef(null)

  const payload = { nombre: limpiarEspacios(nombre), maestro_id: maestroId ? Number(maestroId) : null }
  const hayCambios = !esEdicion || payload.nombre !== programa.nombre || payload.maestro_id !== programa.maestro_id

  // Un maestro deshabilitado solo se lista si ya es el asignado, para no dejar el select en blanco.
  const opciones = maestros.items.filter((maestro) => maestro.activo || maestro.id === programa?.maestro_id)

  async function handleSubmit(event) {
    event.preventDefault()
    const errorNombre = validarNombreCatalogo(nombre)
    if (errorNombre) {
      setErrors({ nombre: errorNombre })
      nombreRef.current?.focus()
      return
    }
    if (!hayCambios) {
      onClose()
      return
    }

    setEnviando(true)
    try {
      const guardado = esEdicion
        ? await actualizarPrograma(programa.id, payload)
        : await crearPrograma({ ...payload, categoria_id: categoria.id })
      toast.success(
        esEdicion ? 'Programa actualizado' : 'Programa creado',
        esEdicion ? `Se guardaron los cambios de «${guardado.nombre}».` : `«${guardado.nombre}» se agregó a ${categoria.nombre}.`,
      )
      onSaved(guardado, esEdicion ? 'actualizado' : 'creado')
      onClose()
    } catch (error) {
      const message = getApiErrorMessage(error)
      const fieldErrors = getApiFieldErrors(error)
      if (error.response?.status === 400) {
        fieldErrors[/maestro/i.test(message) ? 'maestro_id' : 'nombre'] = message
      }
      setErrors(fieldErrors)
      if (fieldErrors.nombre) nombreRef.current?.focus()
      toast.error(esEdicion ? 'No fue posible guardar el programa' : 'No fue posible crear el programa', message)
    } finally {
      setEnviando(false)
    }
  }

  let maestroHint = 'Opcional. Puede asignarlo más adelante.'
  if (maestros.status === 'loading') maestroHint = 'Cargando maestros…'
  else if (maestros.status === 'ready' && opciones.length === 0) maestroHint = 'No hay usuarios activos con rol Maestro.'

  return (
    <Modal
      titleId="titulo-programa"
      size="md"
      layer="z-[60]"
      dismissible={!enviando}
      onClose={onClose}
      header={
        <>
          <p className="text-xs font-medium text-slate-500">{esEdicion ? 'Editar programa' : 'Crear nuevo programa'}</p>
          <h2 id="titulo-programa" className="mt-0.5 text-lg font-semibold text-pizarra-950">
            {categoria.nombre}
          </h2>
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-programa"
            icon={esEdicion ? Save : Plus}
            loading={enviando}
            loadingText={esEdicion ? 'Guardando…' : 'Creando…'}
            disabled={!hayCambios}
          >
            {esEdicion ? 'Guardar cambios' : 'Crear'}
          </Button>
        </>
      }
    >
      <form id="form-programa" noValidate onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
        <TextField
          ref={nombreRef}
          id="programa-nombre"
          label="Nombre del programa"
          icon={BookOpen}
          value={nombre}
          onChange={(event) => {
            setNombre(event.target.value)
            if (errors.nombre) setErrors((current) => ({ ...current, nombre: '' }))
          }}
          error={errors.nombre}
          maxLength={CATALOGO_NOMBRE_MAX}
          placeholder="Ej. Piano"
          autoComplete="off"
          disabled={enviando}
        />

        <div>
          <SelectField
            id="programa-maestro"
            label="Maestro asignado"
            value={maestroId}
            onChange={(event) => {
              setMaestroId(event.target.value)
              if (errors.maestro_id) setErrors((current) => ({ ...current, maestro_id: '' }))
            }}
            error={errors.maestro_id}
            hint={maestros.status === 'error' ? undefined : maestroHint}
            disabled={enviando || maestros.status === 'loading'}
          >
            <option value="">Sin asignar</option>
            {opciones.map((maestro) => (
              <option key={maestro.id} value={maestro.id}>
                {maestro.nombre_completo}
                {maestro.activo ? '' : ' (cuenta deshabilitada)'}
              </option>
            ))}
          </SelectField>
          {maestros.status === 'error' && (
            <p className="mt-1.5 text-sm text-slate-500">
              No fue posible cargar los maestros.{' '}
              <button type="button" onClick={onRetryMaestros} className="font-semibold text-pizarra-700 underline-offset-2 hover:underline">
                Reintentar
              </button>
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
