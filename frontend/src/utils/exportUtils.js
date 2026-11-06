/**
 * Exportación a CSV con JavaScript nativo (Fase 7): Blob + URL.createObjectURL, sin librerías.
 *
 * Las cabeceras son las claves del primer objeto, así que las filas deben llegar con
 * nombres de columna legibles ({ Estado: 'Aprobado', Solicitudes: 3 }).
 * El archivo empieza con el BOM UTF-8 (﻿) para que Excel muestre bien las tildes y la ñ.
 */

const BOM = '﻿'
const SEPARADOR = ','
const FIN_DE_LINEA = '\r\n'

/**
 * Convierte un valor en una celda CSV:
 *   - null/undefined -> celda vacía.
 *   - Comillas, separador o saltos de línea -> entre comillas dobles (las internas se duplican).
 *   - Texto que empieza por = + - @ -> se antepone ' para que Excel no lo ejecute como fórmula.
 */
function celda(valor) {
  if (valor === null || valor === undefined) return ''
  let texto = String(valor)
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  if (/[",\r\n]/.test(texto)) texto = `"${texto.replaceAll('"', '""')}"`
  return texto
}

/**
 * Descarga `rows` como archivo CSV.
 * @param {string} filename Nombre del archivo; se agrega ".csv" si no lo tiene.
 * @param {Record<string, unknown>[]} rows Filas con las mismas claves (las del primer objeto son las cabeceras).
 * @returns {boolean} false si no hay filas (no se descarga nada).
 */
export function exportToCsv(filename, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false

  const cabeceras = Object.keys(rows[0])
  const lineas = [
    cabeceras.map(celda).join(SEPARADOR),
    ...rows.map((fila) => cabeceras.map((clave) => celda(fila[clave])).join(SEPARADOR)),
  ]
  const blob = new Blob([BOM + lineas.join(FIN_DE_LINEA)], { type: 'text/csv;charset=utf-8;' })

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  enlace.style.display = 'none'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  // Se libera en el siguiente ciclo para no cancelar la descarga en algunos navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return true
}

/** Fecha local AAAA-MM-DD para el nombre de los archivos exportados. */
export function fechaParaArchivo(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`
}
