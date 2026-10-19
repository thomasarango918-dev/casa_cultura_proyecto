"""
Esquemas Pydantic de la recuperación de contraseña (Fase 4).

    ForgotPasswordRequest  Documento del usuario que olvidó su contraseña.
    ResetPasswordRequest   Token recibido por correo y la contraseña nueva.
    MensajeOut             Respuesta con un mensaje para mostrar al usuario.
"""

from pydantic import BaseModel, Field, field_validator

from app.schemas.usuario_schema import Password


class ForgotPasswordRequest(BaseModel):
    """Paso 1: el usuario escribe su número de documento."""

    numero_documento: str = Field(..., min_length=3, max_length=30, description="Número de documento del usuario.")

    @field_validator("numero_documento", mode="before")
    @classmethod
    def _limpiar(cls, value: object) -> object:
        """Quita espacios al inicio y al final antes de validar."""
        return value.strip() if isinstance(value, str) else value


class ResetPasswordRequest(BaseModel):
    """Paso 2: el usuario abre el enlace del correo y escribe su contraseña nueva."""

    token: str = Field(..., min_length=10, max_length=2000, description="Token JWT recibido en el enlace del correo.")
    # Misma política de la Fase 3: 8+ caracteres, letras y números, máx. 72 bytes.
    nueva_contrasena: Password


class MensajeOut(BaseModel):
    """Respuesta simple con un mensaje legible."""

    mensaje: str
