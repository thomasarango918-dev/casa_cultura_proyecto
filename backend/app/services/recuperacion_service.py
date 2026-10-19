"""
Servicio de recuperación de contraseña por número de documento (Fase 4).

Flujo:
    1. solicitar(): busca al usuario por documento. Si existe y está activo, genera
       un token JWT de 15 minutos y arma el enlace que se le enviará por correo.
       El controlador responde SIEMPRE el mismo mensaje, exista o no el documento,
       para que nadie pueda averiguar qué documentos están registrados.
    2. restablecer(): valida el token, busca al usuario y guarda el hash de la nueva contraseña.

El token lleva una huella del hash actual de la contraseña: después de usarlo
la huella cambia y el mismo enlace ya no funciona (un solo uso).
"""

import logging
from dataclasses import dataclass
from hmac import compare_digest
from urllib.parse import quote

from app.config.settings import settings
from app.repositories.user_repository import UserRepository
from app.services.auth_service import normalizar_documento
from app.utils.exceptions import DatosInvalidosError, TokenInvalidoError
from app.utils.security import (
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    password_fingerprint,
    verify_password,
)

logger = logging.getLogger("casacultura.recuperacion")

# Mensaje genérico de la solicitud (no revela si el documento existe).
MENSAJE_SOLICITUD = "Si el documento existe en el sistema, hemos enviado las instrucciones al correo asociado."
MENSAJE_TOKEN_INVALIDO = "El enlace de recuperación no es válido o ya expiró. Solicite uno nuevo."


@dataclass(frozen=True)
class CorreoRecuperacion:
    """Datos necesarios para enviar el correo de recuperación (en segundo plano)."""

    correo: str
    nombre: str
    enlace: str


class RecuperacionService:
    """Casos de uso: solicitar el enlace y restablecer la contraseña."""

    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def solicitar(self, numero_documento: str) -> CorreoRecuperacion | None:
        """Prepara el correo de recuperación si el usuario existe y está activo.

        Returns:
            Los datos del correo, o None si no hay que enviar nada.
        """
        usuario = self._repository.get_by_documento(normalizar_documento(numero_documento))
        if usuario is None or not usuario.state:
            return None

        token = create_password_reset_token(usuario.num_documento, usuario.password_hash)
        enlace = f"{settings.FRONTEND_URL}/reset-password?token={quote(token)}"
        logger.info("Enlace de recuperación generado para el usuario %s.", usuario.id)
        return CorreoRecuperacion(correo=usuario.email, nombre=usuario.nombre_com, enlace=enlace)

    def restablecer(self, token: str, nueva_contrasena: str) -> None:
        """Cambia la contraseña del dueño del token.

        Raises:
            TokenInvalidoError: Token vencido, alterado, ya usado, o usuario inexistente/inactivo.
            DatosInvalidosError: La nueva contraseña es igual a la actual.
        """
        claims = decode_password_reset_token(token)
        usuario = self._repository.get_by_documento(str(claims["sub"]))
        if usuario is None or not usuario.state:
            raise TokenInvalidoError(MENSAJE_TOKEN_INVALIDO)

        # Si la contraseña ya cambió desde que se emitió el enlace, el enlace ya no sirve.
        if not compare_digest(str(claims["pwd"]), password_fingerprint(usuario.password_hash)):
            raise TokenInvalidoError(MENSAJE_TOKEN_INVALIDO)

        if verify_password(nueva_contrasena, usuario.password_hash):
            raise DatosInvalidosError("La nueva contraseña debe ser diferente a la actual.")

        # Se guarda el hash bcrypt (passlib); el repositorio confirma el cambio.
        self._repository.update_password_hash(usuario, hash_password(nueva_contrasena))
        logger.info("Contraseña restablecida por enlace de recuperación para el usuario %s.", usuario.id)
