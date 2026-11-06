"""Esquemas Pydantic v2 del módulo de estadísticas (Fase 7, solo lectura)."""

from typing import Literal

from pydantic import BaseModel


class SolicitudesPorEstadoOut(BaseModel):
    """Solicitudes radicadas en un estado. Siempre llegan los tres estados, aunque sea con 0."""

    estado: Literal["APROBADO", "PENDIENTE", "RECHAZADO"]
    total: int


class AprobadosPorProgramaOut(BaseModel):
    """Solicitudes APROBADAS de un programa (segmento de la columna apilada)."""

    programa_id: int
    programa: str
    total: int


class EstudiantesPorCategoriaOut(BaseModel):
    """Columna de una categoría: total de aprobados y su desglose por programa (incluye programas en 0).

    `categoria_id` es None en "Sin categoría" (programas con categoria_id NULL).
    """

    categoria_id: int | None
    categoria: str
    activa: bool
    total: int
    programas: list[AprobadosPorProgramaOut]


class MaestroEstadisticaOut(BaseModel):
    """Maestro elegible en el filtro de ocupación de grupos."""

    id: int
    nombre_completo: str
    activo: bool


class OcupacionGrupoOut(BaseModel):
    """Estudiantes activos (tbl_grupo_estudiante.activo = TRUE) de un grupo."""

    grupo_id: int
    grupo: str
    programa: str
    total: int
