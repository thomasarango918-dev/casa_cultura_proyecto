/**
 * Apertura de documentos adjuntos en una pestaña nueva del navegador.
 *
 * El endpoint de archivos exige el token JWT, que el navegador no envía al abrir
 * una URL directamente. Por eso el archivo se descarga con Axios (con token) y se
 * muestra como URL temporal `blob:`.
 *
 * Lo usan el modal de evaluación (EvaluacionModal) y el inventario de documentos
 * (DocumentosPage).
 */
import { fetchDocumentoBlob } from './solicitudesService'

/** Tiempo que se conserva la URL temporal de un documento abierto (5 minutos). */
const BLOB_URL_TTL_MS = 5 * 60 * 1000

/**
 * Abre un documento en una pestaña nueva.
 *
 * Debe llamarse directamente dentro del manejador del clic: la pestaña se abre
 * de inmediato (antes de descargar) para que el navegador no la bloquee.
 *
 * @param {number} solicitudId Id de la solicitud dueña del documento.
 * @param {{id: number, nombre_archivo: string}} documento
 * @returns {Promise<boolean>} true si se abrió; false si el navegador bloqueó la ventana.
 * @throws Error de Axios si la descarga falla (la pestaña provisional se cierra).
 */
export async function abrirDocumentoEnPestana(solicitudId, documento) {
  const tab = window.open('', '_blank')
  if (tab) {
    tab.document.title = documento.nombre_archivo
    tab.document.body.style.cssText = 'font-family: system-ui, sans-serif; color: #435473; padding: 2rem;'
    tab.document.body.textContent = 'Cargando documento…'
  }

  let url
  try {
    const blob = await fetchDocumentoBlob(solicitudId, documento.id)
    url = URL.createObjectURL(blob)
  } catch (error) {
    tab?.close()
    throw error
  }
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_TTL_MS)

  if (tab) {
    tab.opener = null
    tab.location.href = url
    return true
  }
  // Ventanas emergentes bloqueadas: se intenta abrir directamente.
  return Boolean(window.open(url, '_blank', 'noopener'))
}
