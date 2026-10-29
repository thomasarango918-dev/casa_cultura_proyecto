"""
Esquemas Pydantic v2 del módulo de programas y categorías (Fase 5).

BackOffice: CategoriaCreate, CategoriaEstadoRequest, ProgramaCreate, ProgramaUpdate,
            CategoriaOut, ProgramaGestionOut, MaestroOut, MaestroResumenOut.
Público:    CategoriaPublicaOut (programas agrupados para el paso 2 de la inscripción).
"""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field

from app.schemas.solicitud_schema import ProgramaOut

NOMBRE_MIN = 3
NOMBRE_MAX = 100
DESCRIPCION_MAX = 500


def _limpiar_texto(value: object) -> object:
    return " ".join(value.split()) if isinstance(value, str) else value


def _vacio_a_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


# Validadores propios en vez de min_length/max_length: Pydantic respondería en inglés.
def _validar_nombre(value: str) -> str:
    if len(value) < NOMBRE_MIN:
        raise ValueError(f"El nombre debe tener al menos {NOMBRE_MIN} caracteres.")
    if len(value) > NOMBRE_MAX:
        raise ValueError(f"El nombre no puede superar los {NOMBRE_MAX} caracteres.")
    return value


def _validar_descripcion(value: str | None) -> str | None:
    if value is not None and len(value) > DESCRIPCION_MAX:
        raise ValueError(f"La descripción no puede superar los {DESCRIPCION_MAX} caracteres.")
    return value


Nombre = Annotated[str, BeforeValidator(_limpiar_texto), AfterValidator(_validar_nombre)]
Descripcion = Annotated[str | None, BeforeValidator(_vacio_a_none), AfterValidator(_validar_descripcion)]


# Debe coincidir con MAESTROS_MAX en frontend/src/components/programas/ProgramaFormModal.jsx.
MAESTROS_MAX = 3


def _validar_maestros(value: list[int]) -> list[int]:
    if len(value) > MAESTROS_MAX:
        raise ValueError(f"Un programa admite como máximo {MAESTROS_MAX} maestros.")
    if len(set(value)) != len(value):
        raise ValueError("Un mismo maestro no se puede asignar dos veces al programa.")
    return value


MaestrosIds = Annotated[list[Annotated[int, Field(gt=0)]], AfterValidator(_validar_maestros)]


# --------------------------------------------------------------------------- #
# Entradas
# --------------------------------------------------------------------------- #
class CategoriaCreate(BaseModel):
    nombre: Nombre
    descripcion: Descripcion = None


class CategoriaEstadoRequest(BaseModel):
    activo: bool


class ProgramaCreate(BaseModel):
    categoria_id: int = Field(..., gt=0)
    nombre: Nombre
    maestros_ids: MaestrosIds = Field(default_factory=list)


class ProgramaUpdate(BaseModel):
    nombre: Nombre
    # Reemplaza la lista completa; [] = sin maestros.
    maestros_ids: MaestrosIds = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Salidas
# --------------------------------------------------------------------------- #
class MaestroOut(BaseModel):
    id: int
    nombre_completo: str
    num_documento: str
    activo: bool


class MaestroResumenOut(BaseModel):
    id: int
    nombre_completo: str


class ProgramaGestionOut(BaseModel):
    id: int
    nombre: str
    categoria_id: int | None
    maestros_ids: list[int]
    maestros: list[MaestroResumenOut]
    # Solicitudes PENDIENTE + APROBADO: las que bloquean borrar el programa o cerrar la categoría.
    estudiantes_inscritos: int
    grupos_creados: int = 0


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    activo: bool
    estudiantes_inscritos: int
    programas: list[ProgramaGestionOut]


class CategoriaPublicaOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    programas: list[ProgramaOut]
