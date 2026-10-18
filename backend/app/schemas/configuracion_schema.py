"""
Esquemas Pydantic v2 del módulo de configuración de la cuenta (Fase 3).

    PerfilOut              Datos de la cuenta del usuario que inició sesión.
    PerfilUpdate           Datos personales que el usuario puede cambiar por sí mismo.
    CambioPasswordRequest  Nueva contraseña y su confirmación.

El usuario no puede cambiar aquí su número de documento ni su rol.

Configuración del sistema (solo Administrador):
    ConfiguracionSistemaOut     Estado de TBL_Configuracion_Sistema.
    ConfiguracionSistemaUpdate  Interruptor de inscripciones y periodo académico.
    ConfiguracionPublicaOut     Lo único que ve el formulario público: si hay inscripciones.
"""

import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, ValidationInfo, field_validator

from app.schemas.auth_schema import UsuarioAutenticado
from app.schemas.usuario_schema import Correo, NombreCompleto, Password


class PerfilOut(UsuarioAutenticado):
    """Mismos datos que /auth/me, más el nombre del rol para mostrar ('Profesor' -> 'Maestro')."""

    rol_etiqueta: str


class PerfilUpdate(BaseModel):
    nombre_completo: NombreCompleto
    email: Correo


class CambioPasswordRequest(BaseModel):
    password_nueva: Password
    password_confirmacion: str = Field(..., max_length=128)

    @field_validator("password_confirmacion")
    @classmethod
    def _confirmacion_coincide(cls, value: str, info: ValidationInfo) -> str:
        """Se valida en este campo para que el error 422 señale `password_confirmacion`."""
        nueva = info.data.get("password_nueva")
        if nueva is not None and value != nueva:
            raise ValueError("La confirmación no coincide con la nueva contraseña.")
        return value


# --------------------------------------------------------------------------- #
# Configuración del sistema
# --------------------------------------------------------------------------- #
PERIODO_MAX = 20  # Igual a VARCHAR(20) de Periodo_Academico y de TBL_SolicitudInscripcion.Periodo.

# Letras y números separados por un guion o un espacio: "2026", "2026-2", "2026 II".
_PERIODO_PATTERN = re.compile(r"^[0-9A-Z]+(?:[- ][0-9A-Z]+)*$")


def _normalizar_periodo(value: object) -> object:
    """Quita espacios sobrantes y pasa a mayúsculas: ' 2026 - 2 ' -> '2026-2'."""
    if not isinstance(value, str):
        return value
    value = " ".join(value.split()).upper()
    return re.sub(r"\s*-\s*", "-", value)


def _validar_periodo(value: str) -> str:
    if not value:
        raise ValueError("Escriba el periodo académico. Ejemplo: 2026-2.")
    if len(value) > PERIODO_MAX:
        raise ValueError(f"El periodo académico admite máximo {PERIODO_MAX} caracteres.")
    if not _PERIODO_PATTERN.fullmatch(value):
        raise ValueError("Use solo letras y números, separados por un guion. Ejemplo: 2026-2.")
    return value


# Validación propia (no min_length/max_length) para que todos los mensajes salgan en español.
PeriodoAcademico = Annotated[str, BeforeValidator(_normalizar_periodo), AfterValidator(_validar_periodo)]


class ConfiguracionSistemaOut(BaseModel):
    inscripciones_abiertas: bool
    periodo_academico: str


class ConfiguracionSistemaUpdate(BaseModel):
    inscripciones_abiertas: bool
    periodo_academico: PeriodoAcademico


class ConfiguracionPublicaOut(BaseModel):
    inscripciones_abiertas: bool
