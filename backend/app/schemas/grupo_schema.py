"""Esquemas Pydantic v2 del módulo de grupos (Fase 6) y de sus horarios (asistencias)."""

from datetime import date, datetime, time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, model_validator

from app.schemas.programa_schema import MaestroResumenOut

GRUPO_NOMBRE_MIN = 2
GRUPO_NOMBRE_MAX = 100

# Horario permitido para las clases y tamaño de los bloques (el calendario usa medias horas).
HORA_MINIMA = time(8, 0)
HORA_MAXIMA = time(22, 0)
MINUTOS_PERMITIDOS = (0, 30)
HORARIOS_MAX = 21
DIAS_SEMANA = ("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")


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


def _validar_hora(value: time) -> time:
    if value.tzinfo is not None or value.second or value.microsecond:
        raise ValueError("Use el formato HH:MM, sin segundos.")
    if value.minute not in MINUTOS_PERMITIDOS:
        raise ValueError("Las horas deben ser en punto o y media (por ejemplo, 08:00 u 08:30).")
    if not HORA_MINIMA <= value <= HORA_MAXIMA:
        raise ValueError("El horario permitido es de 08:00 a 22:00.")
    return value


def _hhmm(value: time) -> str:
    return value.strftime("%H:%M")


def _validar_horarios(value: list["HorarioIn"]) -> list["HorarioIn"]:
    if len(value) > HORARIOS_MAX:
        raise ValueError(f"Un grupo puede tener como máximo {HORARIOS_MAX} bloques de horario.")
    por_dia = sorted(value, key=lambda h: (h.dia_semana, h.hora_inicio))
    for anterior, actual in zip(por_dia, por_dia[1:]):
        if anterior.dia_semana == actual.dia_semana and actual.hora_inicio < anterior.hora_fin:
            raise ValueError(
                f"Los bloques del {DIAS_SEMANA[actual.dia_semana - 1]} se cruzan "
                f"({_hhmm(anterior.hora_inicio)}-{_hhmm(anterior.hora_fin)} y "
                f"{_hhmm(actual.hora_inicio)}-{_hhmm(actual.hora_fin)})."
            )
    return por_dia


NombreGrupo = Annotated[str, BeforeValidator(_limpiar_texto), AfterValidator(_validar_nombre)]
HoraClase = Annotated[time, AfterValidator(_validar_hora)]


# ---- Horarios -------------------------------------------------------------------
class HorarioIn(BaseModel):
    dia_semana: int = Field(..., ge=1, le=7, description="1 = Lunes ... 7 = Domingo")
    hora_inicio: HoraClase
    hora_fin: HoraClase

    @model_validator(mode="after")
    def _inicio_antes_de_fin(self) -> "HorarioIn":
        if self.hora_inicio >= self.hora_fin:
            raise ValueError("La hora de fin debe ser posterior a la hora de inicio.")
        return self


class HorarioOut(BaseModel):
    dia_semana: int
    hora_inicio: time
    hora_fin: time


ListaHorarios = Annotated[list[HorarioIn], AfterValidator(_validar_horarios)]


# ---- Entradas -----------------------------------------------------------------
class GrupoCreate(BaseModel):
    programa_id: int = Field(..., gt=0)
    nombre: NombreGrupo
    horarios: ListaHorarios = []


class GrupoUpdate(BaseModel):
    nombre: NombreGrupo
    # None conserva el horario actual; una lista (incluso vacía) lo reemplaza.
    horarios: ListaHorarios | None = None


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
    fecha_creacion: datetime
    horarios: list[HorarioOut]


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


class FestivoOut(BaseModel):
    fecha: date
    nombre: str


class SesionesClaseOut(BaseModel):
    """Fechas de clase desde la creación del grupo hasta hoy (Colombia), sin festivos."""

    grupo_id: int
    desde: date
    hasta: date
    sesiones: list[date]
    festivos_omitidos: list[FestivoOut]
