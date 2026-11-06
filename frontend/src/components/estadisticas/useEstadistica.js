/**
 * Consulta una estadística cada vez que se abre su modal (los datos siempre llegan frescos).
 * Si cambia `fetcher` (por ejemplo, otro maestro), vuelve a consultar y nunca devuelve los datos
 * de la consulta anterior mientras llega la nueva.
 * @param {() => Promise<unknown[]>} fetcher Función de services/estadisticasService.js (estable o memorizada).
 * @param {boolean} isOpen Solo consulta con el modal abierto.
 * @returns {{status: 'loading'|'ready'|'error', datos: unknown[], errorMessage: string, recargar: () => void}}
 */
import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../services/apiClient'

const CARGANDO = { status: 'loading', datos: [], errorMessage: '' }

export default function useEstadistica(fetcher, isOpen) {
  const [estado, setEstado] = useState({ ...CARGANDO, origen: null })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelado = false
    setEstado({ ...CARGANDO, origen: fetcher })
    fetcher()
      .then((datos) => !cancelado && setEstado({ status: 'ready', datos, errorMessage: '', origen: fetcher }))
      .catch((error) => {
        if (cancelado) return
        const errorMessage =
          error?.response?.status === 403
            ? 'Careces de los suficientes permisos para consultar estas estadísticas.'
            : getApiErrorMessage(error)
        setEstado({ status: 'error', datos: [], errorMessage, origen: fetcher })
      })
    return () => {
      cancelado = true
    }
  }, [fetcher, isOpen, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  // Resultado de otra consulta (el efecto aún no corrió para el fetcher nuevo): se informa como carga.
  const { status, datos, errorMessage } = estado.origen === fetcher ? estado : CARGANDO
  return { status, datos, errorMessage, recargar }
}
