"""
Servicio del panel general por rol (Fase 9).

    resumen_operativo()   Administrador: inscripciones, periodo y totales del sistema.
    panel_maestro()       Maestro: KPIs, horario y sesiones de hoy de sus programas.

Fecha y hora siempre de Colombia (UTC-5 fijo, ver utils/festivos_colombia.py).
"""

from datetime import time

from app.models.asistencia_model import ESTADO_AUSENTE, ESTADO_PRESENTE
from app.models.user_model import Usuario
from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard_schema import (
    GrupoHorarioOut,
    MaestroKpisOut,
    PanelMaestroOut,
    ResumenOperativoOut,
    SesionHoyOut,
)
from app.schemas.grupo_schema import HorarioOut
from app.services.configuracion_sistema_service import ConfiguracionSistemaService
from app.utils.festivos_colombia import ahora_colombia, nombre_festivo

# Orden de la tabla de sesiones: en curso, pendientes y realizadas.
_ORDEN_ESTADO = {"EN_CURSO": 0, "PENDIENTE": 1, "REALIZADA": 2}


def estado_sesion(hora_inicio: time, hora_fin: time, ahora: time) -> str:
    if hora_fin <= ahora:
        return "REALIZADA"
    if hora_inicio <= ahora:
        return "EN_CURSO"
    return "PENDIENTE"


class DashboardService:
    def __init__(self, repository: DashboardRepository, configuracion: ConfiguracionSistemaService) -> None:
        self._repository = repository
        self._configuracion = configuracion

    def resumen_operativo(self) -> ResumenOperativoOut:
        configuracion = self._configuracion.obtener()
        return ResumenOperativoOut(
            inscripciones_abiertas=configuracion.inscripciones_abiertas,
            periodo_academico=configuracion.periodo_academico,
            programas_activos=self._repository.programas_activos(),
            grupos_creados=self._repository.total_grupos(),
            maestros_activos=self._repository.maestros_activos(),
        )

    def panel_maestro(self, maestro: Usuario) -> PanelMaestroOut:
        asistencias = self._repository.asistencias_por_estado(maestro.id)
        kpis = MaestroKpisOut(
            estudiantes_asignados=self._repository.estudiantes_asignados(maestro.id),
            estudiantes_sin_asignacion=self._repository.estudiantes_sin_asignacion(maestro.id),
            asistencias_totales=asistencias.get(ESTADO_PRESENTE, 0),
            inasistencias_totales=asistencias.get(ESTADO_AUSENTE, 0),
        )

        ahora = ahora_colombia()
        hoy = ahora.date()
        hora_actual = ahora.time().replace(second=0, microsecond=0)
        dia = hoy.isoweekday()
        festivo = nombre_festivo(hoy)

        grupos = self._repository.grupos_con_horario(maestro.id)
        # En festivo no hay sesiones, igual que en el cálculo de sesiones de clase de la Fase 6.
        bloques_hoy = [] if festivo else [(g, h) for g in grupos for h in g.horarios if h.dia_semana == dia]
        activos = self._repository.estudiantes_por_grupo(list({g.id for g, _ in bloques_hoy}))
        sesiones = [
            SesionHoyOut(
                grupo_id=grupo.id,
                grupo_nombre=grupo.nombre,
                programa_nombre=grupo.programa.programa,
                hora_inicio=bloque.hora_inicio,
                hora_fin=bloque.hora_fin,
                estudiantes_activos=activos.get(grupo.id, 0),
                estado=estado_sesion(bloque.hora_inicio, bloque.hora_fin, hora_actual),
            )
            for grupo, bloque in bloques_hoy
        ]
        sesiones.sort(key=lambda s: (_ORDEN_ESTADO[s.estado], s.hora_inicio, s.grupo_nombre))

        return PanelMaestroOut(
            kpis=kpis,
            hoy=hoy,
            dia_semana=dia,
            hora_actual=hora_actual,
            festivo=festivo,
            grupos=[
                GrupoHorarioOut(
                    id=grupo.id,
                    nombre=grupo.nombre,
                    programa_id=grupo.programa_id,
                    programa_nombre=grupo.programa.programa,
                    horarios=[
                        HorarioOut(dia_semana=h.dia_semana, hora_inicio=h.hora_inicio, hora_fin=h.hora_fin)
                        for h in grupo.horarios
                    ],
                )
                for grupo in grupos
            ],
            sesiones_hoy=sesiones,
        )
