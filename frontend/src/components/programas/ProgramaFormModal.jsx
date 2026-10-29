/**
 * Sub-modal para crear o editar un programa (nombre y maestros asignados, uno por select).
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
import { BookOpen, Plus, Save, X } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import SelectField from '../ui/SelectField'
import TextField from '../ui/TextField'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { actualizarPrograma, crearPrograma } from '../../services/programasService'
import { CATALOGO_NOMBRE_MAX, limpiarEspacios, validarNombreCatalogo } from '../../utils/validators'

// Debe coincidir con MAESTROS_MAX en backend/app/schemas/programa_schema.py.
const MAESTROS_MAX = 3

export default function ProgramaFormModal({ categoria, programa, maestros, onRetryMaestros, onClose, onSaved }) {
  const toast = useToast()
  const esEdicion = Boolean(programa)

  const [nombre, setNombre] = useState(programa?.nombre ?? '')
  const asignados = programa?.maestros_ids ?? []
  // Un valor por select; '' = select sin elegir.
  const [seleccion, setSeleccion] = useState(asignados.length ? asignados.map(String) : [''])
  const [errors, setErrors] = useState({})
  const [enviando, setEnviando] = useState(false)
  const nombreRef = useRef(null)

  const maestrosIds = seleccion.filter(Boolean).map(Number)
  const payload = { nombre: limpiarEspacios(nombre), maestros_ids: maestrosIds }
  const mismosMaestros = maestrosIds.length === asignados.length && maestrosIds.every((id) => asignados.includes(id))
  const hayCambios = !esEdicion || payload.nombre !== programa.nombre || !mismosMaestros

  // Un maestro deshabilitado solo se lista si ya estaba asignado, para no dejar su select en blanco.
  const opciones = maestros.items.filter((maestro) => maestro.activo || asignados.includes(maestro.id))
  const limiteAlcanzado = seleccion.length >= MAESTROS_MAX

  function limpiarErrorMaestros() {
    if (errors.maestros_ids) setErrors((current) => ({ ...current, maestros_ids: '' }))
  }

  function elegirMaestro(indice, valor) {
    limpiarErrorMaestros()
    if (valor && seleccion.some((actual, i) => i !== indice && actual === valor)) {
      toast.warning('Este maestro ya fue asignado', 'Elija un maestro diferente en este campo.')
      valor = ''
    }
    setSeleccion((current) => current.map((actual, i) => (i === indice ? valor : actual)))
  }

  function quitarMaestro(indice) {
    limpiarErrorMaestros()
    // El último select se vacía en vez de desaparecer, para que siempre quede uno.
    setSeleccion((current) => (current.length === 1 ? [''] : current.filter((_, i) => i !== indice)))
  }

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
        fieldErrors[/maestro/i.test(message) ? 'maestros_ids' : 'nombre'] = message
      }
      setErrors(fieldErrors)
      if (fieldErrors.nombre) nombreRef.current?.focus()
      toast.error(esEdicion ? 'No fue posible guardar el programa' : 'No fue posible crear el programa', message)
    } finally {
      setEnviando(false)
    }
  }

  let maestroHint = 'Opcional. Puede asignarlos más adelante.'
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

        <fieldset>
          <legend className="block text-sm font-medium text-pizarra-900">Maestros asignados</legend>
          <div className="mt-1.5 space-y-2">
            {seleccion.map((valor, indice) => (
              <div key={indice} className="flex items-start gap-2">
                <SelectField
                  id={`programa-maestro-${indice}`}
                  label={`Maestro ${indice + 1}`}
                  className="flex-1 [&>div]:mt-0 [&>label]:sr-only"
                  value={valor}
                  onChange={(event) => elegirMaestro(indice, event.target.value)}
                  error={errors.maestros_ids && indice === 0 ? errors.maestros_ids : undefined}
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
                {(seleccion.length > 1 || valor) && (
                  <button
                    type="button"
                    onClick={() => quitarMaestro(indice)}
                    disabled={enviando}
                    className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                    aria-label={`Quitar el maestro ${indice + 1}`}
                    title="Quitar"
                  >
                    <X aria-hidden="true" className="size-[18px]" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setSeleccion((current) => [...current, ''])}
            disabled={enviando || maestros.status !== 'ready' || seleccion.length >= opciones.length || limiteAlcanzado}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-pizarra-700 transition-colors hover:bg-pizarra-50 hover:text-pizarra-950 disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            <Plus aria-hidden="true" className="size-4" /> Añadir más maestros
          </button>
          {limiteAlcanzado && (
            <p role="status" className="mt-1 text-sm font-medium text-amber-700">
              Limite maximo de profesores ({MAESTROS_MAX})
            </p>
          )}

          {maestros.status === 'error' ? (
            <p className="mt-1.5 text-sm text-slate-500">
              No fue posible cargar los maestros.{' '}
              <button type="button" onClick={onRetryMaestros} className="font-semibold text-pizarra-700 underline-offset-2 hover:underline">
                Reintentar
              </button>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">{maestroHint}</p>
          )}
        </fieldset>
      </form>
    </Modal>
  )
}
