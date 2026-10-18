"""
Esquemas Pydantic v2 del módulo de usuarios y roles (Fase 3).

    RolOut                Rol que el usuario actual puede asignar (lista desplegable).
    CatalogosUsuario      Roles asignables y tipos de documento para el formulario.
    UsuarioOut            Fila de la tabla de usuarios (nunca incluye el hash de la contraseña).
    UsuarioListResponse   Listado con el total de resultados.
    UsuarioCreate         Datos para crear un usuario (incluye la contraseña inicial).
    UsuarioUpdate         Datos editables. El número de documento es inmutable.
    EstadoUsuarioRequest  Habilitar o deshabilitar una cuenta.

También define las normas compartidas con el módulo de configuración:
nombre, correo y política de contraseñas.
"""

import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field, field_validator

from app.schemas.solicitud_schema import TipoDocumentoOut
from app.services.auth_service import normalizar_documento

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

PASSWORD_MIN = 8
# bcrypt solo considera los primeros 72 bytes de la contraseña; más allá se rechaza
# para que dos contraseñas distintas nunca produzcan el mismo hash.
PASSWORD_MAX_BYTES = 72


# --------------------------------------------------------------------------- #
# Normas compartidas
# --------------------------------------------------------------------------- #
def limpiar_nombre(value: object) -> object:
    """Quita espacios sobrantes: '  ana   maría ' -> 'ana maría'."""
    return " ".join(value.split()) if isinstance(value, str) else value


def normalizar_correo(value: object) -> object:
    return value.strip().lower() if isinstance(value, str) else value


def validar_correo(value: str) -> str:
    if not _EMAIL_PATTERN.match(value):
        raise ValueError("El correo electrónico no tiene un formato válido.")
    return value


def validar_password(value: str) -> str:
    """Política de contraseñas: 8 caracteres o más (máx. 72 bytes), con letras y números."""
    if len(value) < PASSWORD_MIN:
        raise ValueError(f"La contraseña debe tener al menos {PASSWORD_MIN} caracteres.")
    if len(value.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError("La contraseña es demasiado larga (máximo 72 caracteres).")
    if value != value.strip():
        raise ValueError("La contraseña no puede empezar ni terminar con espacios.")
    if not re.search(r"[^\W\d_]", value) or not re.search(r"\d", value):
        raise ValueError("La contraseña debe combinar letras y números.")
    return value


# Tipos reutilizables: normalizan antes de validar la longitud y el formato.
NombreCompleto = Annotated[str, Field(min_length=3, max_length=100), BeforeValidator(limpiar_nombre)]
Correo = Annotated[
    str, Field(min_length=5, max_length=150), BeforeValidator(normalizar_correo), AfterValidator(validar_correo)
]
Password = Annotated[str, Field(max_length=128), AfterValidator(validar_password)]


class _DatosPersonales(BaseModel):
    """Nombre y correo, comunes a la creación y la edición."""

    nombre_completo: NombreCompleto
    email: Correo


# --------------------------------------------------------------------------- #
# Salidas
# --------------------------------------------------------------------------- #
class RolOut(BaseModel):
    """Rol de TBL_Roles. `nombre` es el valor guardado; `etiqueta`, el que se muestra."""

    id: int
    nombre: str
    etiqueta: str
    clave: str | None


class CatalogosUsuario(BaseModel):
    roles: list[RolOut]
    tipos_documento: list[TipoDocumentoOut]


class UsuarioOut(BaseModel):
    id: int
    nombre_completo: str
    email: str
    tipo_documento_id: int
    tipo_documento: str  # Sigla: CC, TI...
    num_documento: str
    rol_id: int
    rol: str
    rol_etiqueta: str
    activo: bool


class UsuarioListResponse(BaseModel):
    total: int
    items: list[UsuarioOut]


# --------------------------------------------------------------------------- #
# Entradas
# --------------------------------------------------------------------------- #
class UsuarioCreate(_DatosPersonales):
    tipo_documento_id: int = Field(..., gt=0)
    num_documento: str = Field(..., min_length=3, max_length=20)
    rol_id: int = Field(..., gt=0)
    password: Password

    @field_validator("num_documento", mode="before")
    @classmethod
    def _normalizar_documento(cls, value: object) -> object:
        """Elimina puntos, guiones y espacios (mismo criterio que el login)."""
        return normalizar_documento(value.strip()) if isinstance(value, str) else value

    @field_validator("num_documento")
    @classmethod
    def _validar_documento(cls, value: str) -> str:
        if not value.isalnum():
            raise ValueError("El número de documento solo puede contener letras y números.")
        return value


class UsuarioUpdate(_DatosPersonales):
    """Datos editables de un usuario.

    `num_documento` no se puede modificar: si llega con un valor distinto al guardado,
    el servicio responde 400. Se declara solo para detectar ese intento.
    """

    tipo_documento_id: int = Field(..., gt=0)
    rol_id: int = Field(..., gt=0)
    num_documento: str | None = Field(default=None, max_length=20)


class EstadoUsuarioRequest(BaseModel):
    """Estado deseado. Si se omite el cuerpo, el endpoint alterna el estado actual."""

    activo: bool
