/**
 * Modal "Crear categoría": nombre y descripción.
 *
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {(categoria: object) => void} props.onCreated Recibe la categoría que devolvió la API.
 */
import { useRef, useState } from 'react'
import { CircleAlert, FolderPlus, Tag } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import TextField from '../ui/TextField'
import { useToast } from '../../context/ToastContext'
import { getApiErrorMessage, getApiFieldErrors } from '../../services/apiClient'
import { crearCategoria } from '../../services/programasService'
import {
  CATALOGO_DESCRIPCION_MAX,
  CATALOGO_NOMBRE_MAX,
  limpiarEspacios,
  validarNombreCatalogo,
} from '../../utils/validators'

export default function CategoriaFormModal({ onClose, onCreated }) {
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [errors, setErrors] = useState({})
  const [enviando, setEnviando] = useState(false)
  const nombreRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    const errorNombre = validarNombreCatalogo(nombre)
    if (errorNombre) {
      setErrors({ nombre: errorNombre })
      nombreRef.current?.focus()
      return
    }

    setEnviando(true)
    try {
      const creada = await crearCategoria({ nombre: limpiarEspacios(nombre), descripcion: descripcion.trim() || null })
      toast.success('Categoría creada', `«${creada.nombre}» ya puede recibir programas.`)
      onCreated(creada)
      onClose()
    } catch (error) {
      const message = getApiErrorMessage(error)
      const fieldErrors = getApiFieldErrors(error)
      // El 400 de nombre repetido no trae campo: se ubica en el nombre igualmente.
      if (error.response?.status === 400) fieldErrors.nombre = message
      setErrors(fieldErrors)
      if (fieldErrors.nombre) nombreRef.current?.focus()
      toast.error('No fue posible crear la categoría', message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal
      titleId="titulo-categoria"
      size="md"
      dismissible={!enviando}
      onClose={onClose}
      header={
        <>
          <p className="text-xs font-medium text-slate-500">Programas y categorías</p>
          <h2 id="titulo-categoria" className="mt-0.5 text-lg font-semibold text-pizarra-950">
            Crear categoría
          </h2>
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-categoria" icon={FolderPlus} loading={enviando} loadingText="Creando…">
            Crear categoría
          </Button>
        </>
      }
    >
      <form id="form-categoria" noValidate onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
        <TextField
          ref={nombreRef}
          id="categoria-nombre"
          label="Nombre"
          icon={Tag}
          value={nombre}
          onChange={(event) => {
            setNombre(event.target.value)
            if (errors.nombre) setErrors((current) => ({ ...current, nombre: '' }))
          }}
          error={errors.nombre}
          maxLength={CATALOGO_NOMBRE_MAX}
          placeholder="Ej. Música"
          autoComplete="off"
          disabled={enviando}
        />

        <div>
          <label htmlFor="categoria-descripcion" className="block text-sm font-medium text-pizarra-900">
            Descripción <span className="font-normal text-slate-400">(opcional)</span>
          </label>
          <textarea
            id="categoria-descripcion"
            rows={3}
            maxLength={CATALOGO_DESCRIPCION_MAX}
            value={descripcion}
            onChange={(event) => {
              setDescripcion(event.target.value)
              if (errors.descripcion) setErrors((current) => ({ ...current, descripcion: '' }))
            }}
            disabled={enviando}
            placeholder="Qué tipo de programas agrupa."
            aria-invalid={errors.descripcion ? 'true' : 'false'}
            aria-describedby="categoria-descripcion-ayuda"
            className={`mt-1.5 block w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] text-pizarra-950 shadow-xs outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 disabled:bg-slate-50 ${
              errors.descripcion
                ? 'border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
                : 'border-slate-300 hover:border-slate-400 focus:border-pizarra-600 focus:ring-4 focus:ring-pizarra-600/15'
            }`}
          />
          {errors.descripcion ? (
            <p id="categoria-descripcion-ayuda" className="mt-1.5 flex items-start gap-1.5 text-sm text-rose-600">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{errors.descripcion}</span>
            </p>
          ) : (
            <p id="categoria-descripcion-ayuda" className="mt-1.5 text-right text-xs tabular-nums text-slate-400">
              {descripcion.length}/{CATALOGO_DESCRIPCION_MAX}
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
