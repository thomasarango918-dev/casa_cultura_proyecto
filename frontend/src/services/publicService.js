/**
 * Servicio del formulario público de inscripción: endpoints /public de la API.
 *
 * Ninguna de estas peticiones lleva token (`skipAuth`) ni cierra la sesión del
 * BackOffice si la API respondiera 401 (`skipAuthRedirect`): el formulario es
 * completamente independiente del panel administrativo.
 */
import apiClient from './apiClient'

const PUBLIC_OPTIONS = { skipAuth: true, skipAuthRedirect: true }

/** Límites de la carga de documentos (deben coincidir con backend/app/config/uploads.py). */
export const UPLOAD_LIMITS = {
  maxFileSize: 5 * 1024 * 1024,
  extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
  accept: '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
}

/** @returns {Promise<Array<{id: number, nombre: string}>>} */
export async function fetchProgramas() {
  const { data } = await apiClient.get('/public/programas', PUBLIC_OPTIONS)
  return data
}

/** @returns {Promise<Array<{id: number, sigla: string}>>} */
export async function fetchTiposDocumento() {
  const { data } = await apiClient.get('/public/tipos-documento', PUBLIC_OPTIONS)
  return data
}

/** Parentescos para la lista desplegable del acudiente. @returns {Promise<Array<{id: number, nombre: string}>>} */
export async function fetchParentescos() {
  const { data } = await apiClient.get('/public/parentescos', PUBLIC_OPTIONS)
  return data
}

/**
 * Documentos que el aspirante debe adjuntar (uno por requisito).
 * @returns {Promise<Array<{codigo: string, nombre: string, descripcion: string|null, obligatorio: boolean}>>}
 */
export async function fetchRequisitos() {
  const { data } = await apiClient.get('/public/requisitos', PUBLIC_OPTIONS)
  return data
}

/**
 * Radica la solicitud con sus documentos (multipart/form-data).
 *
 * Cada archivo viaja en el campo `archivos` y, en el mismo orden, el código del
 * requisito al que corresponde en el campo `requisitos`.
 *
 * @param {object} datos Campos del formulario (nombres, apellidos, fecha_nacimiento, acudiente_*, ...).
 * @param {Array<{requisito: string, file: File}>} documentos Un archivo por requisito.
 * @param {(percent: number) => void} [onProgress] Avance de la carga, de 0 a 100.
 * @returns {Promise<object>} Confirmación con `numero_radicado`.
 */
export async function radicarSolicitud(datos, documentos, onProgress) {
  const formData = new FormData()
  Object.entries(datos).forEach(([key, value]) => formData.append(key, value ?? ''))
  documentos.forEach(({ requisito, file }) => {
    formData.append('archivos', file, file.name)
    formData.append('requisitos', requisito)
  })

  const { data } = await apiClient.post('/public/solicitudes', formData, {
    ...PUBLIC_OPTIONS,
    // Axios reemplaza este valor por el encabezado multipart con su "boundary".
    headers: { 'Content-Type': 'multipart/form-data' },
    // La carga de varios archivos puede tardar más que las peticiones normales.
    timeout: 120_000,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
  return data
}
