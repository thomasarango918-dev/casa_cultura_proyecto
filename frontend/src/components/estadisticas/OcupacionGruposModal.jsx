/**
 * Estadísticas de grupos (Fase 7): barras horizontales (layout="vertical") con los estudiantes
 * activos de cada grupo que maneja un maestro (grupos de los programas que tiene asignados).
 *
 * Primero se elige el maestro en la lista desplegable; solo entonces aparecen el gráfico y la tabla.
 *   - Administrador y Coordinador: pueden elegir cualquier maestro.
 *   - Maestro: la lista solo lo trae a él (GET /admin/estadisticas/maestros), se selecciona sola y
 *     queda bloqueada. La API responde 403 si pide otro maestro.
 * Fuentes: GET /admin/estadisticas/maestros y /admin/estadisticas/ocupacion-grupos?maestro_id=N.
 */
import { useCallback, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ROL, claveRol } from '../../config/roles'
import { useAuth } from '../../context/AuthContext'
import { getEstadisticaMaestros, getEstadisticaOcupacionGrupos } from '../../services/estadisticasService'
import { exportToCsv, fechaParaArchivo } from '../../utils/exportUtils'
import SelectField from '../ui/SelectField'
import EstadisticaModal from './EstadisticaModal'
import { COLOR_BARRA, EJE, REJILLA, TooltipGrafico } from './graficos'
import useEstadistica from './useEstadistica'

// Alto de cada barra (con su espacio) y ancho del eje de nombres según el nombre más largo.
const ALTO_POR_GRUPO = 40
const ANCHO_EJE_MIN = 96
const ANCHO_EJE_MAX = 220
const LARGO_ETIQUETA_MAX = 28

/** Recorta los nombres largos en el eje; el tooltip y la tabla muestran el nombre completo. */
const recortar = (nombre) =>
  nombre.length > LARGO_ETIQUETA_MAX ? `${nombre.slice(0, LARGO_ETIQUETA_MAX - 1)}…` : nombre

/** "maestro-piano-1" para el nombre del archivo CSV. */
const slug = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export default function OcupacionGruposModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const esMaestro = claveRol(user?.rol) === ROL.MAESTRO

  const maestros = useEstadistica(getEstadisticaMaestros, isOpen)
  const [seleccion, setSeleccion] = useState('')
  // El Maestro solo recibe su propio registro: queda elegido sin que tenga que tocar la lista.
  const maestroId = esMaestro ? (maestros.datos[0]?.id ?? '') : seleccion
  const maestro = maestros.datos.find((item) => String(item.id) === String(maestroId))

  const consultarOcupacion = useCallback(() => getEstadisticaOcupacionGrupos(maestroId), [maestroId])
  const ocupacion = useEstadistica(consultarOcupacion, isOpen && Boolean(maestro))

  // Estado combinado: primero la lista de maestros, luego la ocupación del elegido.
  let status = ocupacion.status
  let errorMessage = ocupacion.errorMessage
  let onRetry = ocupacion.recargar
  if (maestros.status !== 'ready') {
    status = maestros.status
    errorMessage = maestros.errorMessage
    onRetry = maestros.recargar
  } else if (maestros.datos.length > 0 && !maestro) {
    status = 'idle'
  }

  const datos = maestro ? ocupacion.datos : []
  const total = datos.reduce((suma, item) => suma + item.total, 0)
  const filas = datos.map((item) => ({
    Maestro: maestro.nombre_completo,
    Grupo: item.grupo,
    Programa: item.programa,
    'Estudiantes activos': item.total,
  }))
  const anchoEje = Math.min(
    ANCHO_EJE_MAX,
    Math.max(ANCHO_EJE_MIN, ...datos.map((item) => item.grupo.length * 7 + 16)),
  )

  let mensajeVacio = 'No hay usuarios con rol Maestro registrados.'
  if (maestro) {
    mensajeVacio = esMaestro
      ? 'Todavía no tiene grupos en sus programas asignados.'
      : `${maestro.nombre_completo} todavía no tiene grupos en sus programas asignados.`
  }

  const filtros =
    maestros.status === 'ready' && maestros.datos.length > 0 ? (
      <SelectField
        id="estadistica-maestro"
        label="Maestro"
        value={String(maestroId)}
        onChange={(event) => setSeleccion(event.target.value)}
        disabled={esMaestro}
        hint={
          esMaestro
            ? 'Solo puede consultar las estadísticas de sus propios grupos.'
            : 'Grupos de los programas que el maestro tiene asignados.'
        }
        className="sm:max-w-sm"
      >
        {!esMaestro && (
          <option value="" disabled>
            Seleccione un maestro…
          </option>
        )}
        {maestros.datos.map((item) => (
          <option key={item.id} value={String(item.id)}>
            {item.nombre_completo}
            {item.activo ? '' : ' (inactivo)'}
          </option>
        ))}
      </SelectField>
    ) : null

  return (
    <EstadisticaModal
      isOpen={isOpen}
      onClose={onClose}
      titulo={esMaestro ? 'Estadísticas de ocupación de mis grupos' : 'Estadísticas de ocupación'}
      descripcion="Estudiantes activos inscritos en cada grupo del maestro."
      filtros={filtros}
      data={filas}
      onExport={() =>
        exportToCsv(`estadisticas-ocupacion-${slug(maestro.nombre_completo)}-${fechaParaArchivo()}`, filas)
      }
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
      vacio={datos.length === 0}
      mensajeVacio={mensajeVacio}
      mensajeInicial="Seleccione un maestro en la lista para ver la ocupación de sus grupos."
    >
      {total === 0 && (
        <p className="mb-3 text-sm text-slate-500">Los grupos de este maestro aún no tienen estudiantes activos.</p>
      )}
      <div style={{ height: Math.max(160, datos.length * ALTO_POR_GRUPO + 48) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid horizontal={false} {...REJILLA} />
            <XAxis type="number" allowDecimals={false} {...EJE} />
            <YAxis
              type="category"
              dataKey="grupo"
              width={anchoEje}
              interval={0}
              tickFormatter={recortar}
              {...EJE}
            />
            <Tooltip
              cursor={{ fill: '#f1f5f9' }}
              content={<TooltipGrafico unidad="estudiantes activos" detalle={(item) => item.programa} />}
            />
            <Bar dataKey="total" fill={COLOR_BARRA} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </EstadisticaModal>
  )
}
