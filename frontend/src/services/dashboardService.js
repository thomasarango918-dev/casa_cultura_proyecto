/**
 * Servicio del panel general por rol (Fase 9): /admin/dashboard.
 * Los KPIs de solicitudes siguen en solicitudesService.getDashboardKpis.
 */
import apiClient from './apiClient'

/** Administrador: inscripciones, periodo, programas activos, grupos y maestros activos. */
export async function getResumenOperativo() {
  const { data } = await apiClient.get('/admin/dashboard/resumen-operativo')
  return data
}

/** Maestro: KPIs, grupos con horario y sesiones de hoy de sus programas asignados. */
export async function getPanelMaestro() {
  const { data } = await apiClient.get('/admin/dashboard/maestro')
  return data
}
