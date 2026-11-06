"""Esquemas Pydantic v2 del módulo de asistencias (Fase 6)."""

from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field

from app.schemas.grupo_schema import FestivoOut

EstadoAsistencia = Literal["PRESENTE", "AUSENTE", "EXCUSADO"]


# ---- Entradas -----------------------------------------------------------------
class RegistroAsistenciaIn(BaseModel):
    solicitud_id: int = Field(..., gt=0)
    estado: EstadoAsistencia


def _validar_registros(value: list[RegistroAsistenciaIn]) -> list[RegistroAsistenciaIn]:
    if not value:
        raise ValueError("Envíe la asistencia de al menos un estudiante.")
    ids = [registro.solicitud_id for registro in value]
    if len(set(ids)) != len(ids):
        raise ValueError("Un estudiante aparece más de una vez en la lista.")
    return value


class GuardarAsistenciaRequest(BaseModel):
    fecha_clase: date
    registros: Annotated[list[RegistroAsistenciaIn], AfterValidator(_validar_registros)]


# ---- Salidas -------------------------------------------------------------------
class EstudianteAsistenciaOut(BaseModel):
    solicitud_id: int
    nombre_completo: str
    tipo_documento: str
    numero_documento: str
    # Fecha ISO -> estado. Una fecha sin registro no aparece.
    asistencias: dict[date, EstadoAsistencia]


class MatrizAsistenciaOut(BaseModel):
    grupo_id: int
    grupo_nombre: str
    programa_nombre: str
    hoy: date
    # True si hoy es una de las sesiones: la única columna que se puede editar.
    es_dia_de_clase: bool
    sesiones: list[date]
    festivos_omitidos: list[FestivoOut]
    estudiantes: list[EstudianteAsistenciaOut]


class AsistenciaGuardadaOut(BaseModel):
    fecha_clase: date
    guardados: int
