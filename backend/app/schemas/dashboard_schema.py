"""
Esquemas Pydantic v2 del panel general por rol (Fase 9).

    ResumenOperativoOut   Panel del Administrador: configuración y totales del sistema.
    PanelMaestroOut       Panel del Maestro: KPIs, horario semanal y sesiones de hoy.
"""

from datetime import date, time
from typing import Literal

from pydantic import BaseModel

from app.schemas.grupo_schema import HorarioOut

# EN_CURSO: inicio <= ahora < fin. PENDIENTE: inicio > ahora. REALIZADA: fin <= ahora.
EstadoSesion = Literal["EN_CURSO", "PENDIENTE", "REALIZADA"]


class ResumenOperativoOut(BaseModel):
    inscripciones_abiertas: bool
    periodo_academico: str
    programas_activos: int  # Programas de categorías activas.
    grupos_creados: int
    maestros_activos: int  # Usuarios activos con rol Maestro (Profesor en tbl_roles).


class MaestroKpisOut(BaseModel):
    estudiantes_asignados: int
    estudiantes_sin_asignacion: int
    asistencias_totales: int
    inasistencias_totales: int


class GrupoHorarioOut(BaseModel):
    id: int
    nombre: str
    programa_id: int
    programa_nombre: str
    horarios: list[HorarioOut]


class SesionHoyOut(BaseModel):
    grupo_id: int
    grupo_nombre: str
    programa_nombre: str
    hora_inicio: time
    hora_fin: time
    estudiantes_activos: int
    estado: EstadoSesion


class PanelMaestroOut(BaseModel):
    kpis: MaestroKpisOut
    hoy: date  # Fecha de Colombia.
    dia_semana: int  # ISO: 1 = Lunes ... 7 = Domingo.
    hora_actual: time  # Hora de Colombia (UTC-5) usada para el estado de las sesiones.
    festivo: str | None  # Nombre del festivo si hoy no hay clases.
    grupos: list[GrupoHorarioOut]
    # Orden: en curso, pendientes (por hora de inicio) y realizadas.
    sesiones_hoy: list[SesionHoyOut]
