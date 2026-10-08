"""
Esquemas Pydantic v2 del módulo de autenticación.

    LoginRequest        Cuerpo que envía el frontend al iniciar sesión.
    UsuarioAutenticado  Datos públicos del usuario que la API devuelve.
    TokenResponse       Respuesta completa del login (token + usuario).
    TokenPayload        Contenido (claims) esperado dentro del JWT.
    MensajeError        Formato estándar de los errores de la API.

Estos esquemas separan lo que expone la API de cómo se guardan los datos en la
base: por ejemplo, el hash de la contraseña nunca forma parte de una respuesta.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    """Credenciales de acceso: correo electrónico o número de documento, y contraseña."""

    # Ejemplos que se muestran en la documentación interactiva (/docs).
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"identificador": "admin@casacultura.local", "password": "CasaCultura2026*"},
                {"identificador": "1000000000", "password": "CasaCultura2026*"},
            ]
        },
    )

    identificador: str = Field(
        ...,
        min_length=3,
        max_length=150,
        description="Correo electrónico o número de documento del usuario.",
    )
    password: str = Field(..., min_length=1, max_length=128, description="Contraseña del usuario.")

    @field_validator("identificador", mode="before")
    @classmethod
    def _limpiar_identificador(cls, value: object) -> object:
        """Elimina espacios al inicio y al final del identificador antes de validarlo."""
        # Solo se recortan espacios del identificador; la contraseña se respeta tal cual.
        return value.strip() if isinstance(value, str) else value


class UsuarioAutenticado(BaseModel):
    """Datos públicos del usuario que se devuelven al cliente tras autenticarse."""

    id: int
    nombre_completo: str
    email: str
    tipo_documento: str  # Sigla del tipo de documento, por ejemplo "CC".
    num_documento: str
    rol_id: int
    rol: str  # Nombre del rol, por ejemplo "Administrador".
    activo: bool


class TokenResponse(BaseModel):
    """Respuesta del inicio de sesión con el token JWT de acceso."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"  # El cliente lo envía como "Authorization: Bearer <token>".
    expires_in: int = Field(..., description="Vigencia del token en segundos.")
    usuario: UsuarioAutenticado


class TokenPayload(BaseModel):
    """Claims esperados dentro del JWT de acceso.

    sub: ID del usuario (como texto, según el estándar JWT).
    rol, nombre: datos del usuario para mostrarlos sin consultar la API.
    iat, exp: fecha de emisión y de vencimiento (segundos desde 1970).
    iss: emisor del token.
    type: tipo de token; en esta fase solo existe "access".
    """

    sub: str
    rol: str
    nombre: str
    iat: int
    exp: int
    iss: str
    type: Literal["access"]


class MensajeError(BaseModel):
    """Formato estándar de error que devuelve la API."""

    detail: str
