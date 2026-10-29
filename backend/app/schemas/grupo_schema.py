"""Esquemas Pydantic v2 del módulo de grupos (Fase 6)."""

from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field

from app.schemas.programa_schema import MaestroResumenOut

GRUPO_NOMBRE_MIN = 2
GRUPO_NOMBRE_MAX = 100


def _limpiar_texto(value: object) -> object:
    return " ".join(value.split()) if isinstance(value, str) else value


def _validar_nombre(value: str) -> str:
    if len(value) < GRUPO_NOMBRE_MIN:
        raise ValueError(f"El nombre debe tener al menos {GRUPO_NOMBRE_MIN} caracteres.")
    if len(value) > GRUPO_NOMBRE_MAX:
        raise ValueError(f"El nombre no puede superar los {GRUPO_NOMBRE_MAX} caracteres.")
    return value


def _validar_ids(value: list[int]) -> list[int]:
    if not value:
        raise ValueError("Seleccione al menos un estudiante.")
    if len(set(value)) != len(value):
        raise ValueError("La lista de estudiantes tiene elementos repetidos.")
    return value


NombreGrupo = Annotated[str, BeforeValidator(_limpiar_texto), AfterValidator(_validar_nombre)]


# ---- Entradas -----------------------------------------------------------------
class GrupoCreate(BaseModel):
    programa_id: int = Field(..., gt=0)
    nombre: NombreGrupo


class GrupoUpdate(BaseModel):
    nombre: NombreGrupo


class AsignarEstudiantesRequest(BaseModel):
    solicitudes_ids: Annotated[list[Annotated[int, Field(gt=0)]], AfterValidator(_validar_ids)]


# ---- Salidas -------------------------------------------------------------------
class GrupoOut(BaseModel):
    id: int
    nombre: str
    programa_id: int
    programa_nombre: str
    maestros: list[MaestroResumenOut]
    estudiantes_activos: int


class ProgramaGrupoOut(BaseModel):
    """Programa en el que el usuario puede crear grupos."""

    id: int
    nombre: str
    categoria_nombre: str | None


class EstudianteDisponibleOut(BaseModel):
    solicitud_id: int
    nombre_completo: str
    tipo_documento: str
    numero_documento: str
    numero_radicado: str


class EstudianteGrupoOut(BaseModel):
    solicitud_id: int
    nombre_completo: str
    tipo_documento: str
    numero_documento: str
    fecha_ingreso: datetime


class AsignacionOut(BaseModel):
    asignados: int
