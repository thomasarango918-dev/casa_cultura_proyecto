"""
Servicio de configuración de la cuenta (Fase 3): el usuario que inició sesión
consulta y actualiza sus propios datos y cambia su contraseña.

Disponible para todos los roles. No permite cambiar el número de documento ni el rol;
eso lo hace un Administrador o un Coordinador desde el módulo de usuarios.
"""

import logging

from sqlalchemy.exc import IntegrityError

from app.config.roles import etiqueta_rol
from app.models.user_model import Usuario
from app.repositories.usuario_admin_repository import UsuarioAdminRepository
from app.schemas.configuracion_schema import CambioPasswordRequest, PerfilOut, PerfilUpdate
from app.services.auth_service import to_usuario_autenticado
from app.utils.exceptions import DatosInvalidosError, RegistroDuplicadoError
from app.utils.security import hash_password, verify_password

logger = logging.getLogger("casacultura.configuracion")

_EMAIL_DUPLICADO = "Ya existe otro usuario registrado con ese correo electrónico."


def to_perfil(usuario: Usuario) -> PerfilOut:
    return PerfilOut(
        **to_usuario_autenticado(usuario).model_dump(),
        rol_etiqueta=etiqueta_rol(usuario.rol.nom_role),
    )


class ConfiguracionService:
    def __init__(self, repository: UsuarioAdminRepository) -> None:
        self._repository = repository

    def perfil(self, usuario: Usuario) -> PerfilOut:
        return to_perfil(usuario)

    def actualizar_perfil(self, usuario: Usuario, data: PerfilUpdate) -> PerfilOut:
        if self._repository.email_en_uso(data.email, excluir_id=usuario.id):
            raise RegistroDuplicadoError(_EMAIL_DUPLICADO)
        usuario.nombre_com = data.nombre_completo
        usuario.email = data.email
        try:
            self._repository.commit()
        except IntegrityError as exc:
            # Otra petición registró el mismo correo entre la verificación y el guardado.
            self._repository.rollback()
            raise RegistroDuplicadoError(_EMAIL_DUPLICADO) from exc
        self._repository.refresh(usuario)
        logger.info("El usuario %s actualizó su perfil.", usuario.id)
        return to_perfil(usuario)

    def cambiar_password(self, usuario: Usuario, data: CambioPasswordRequest) -> None:
        """Valida la nueva contraseña con passlib (no puede ser igual a la actual) y guarda su hash bcrypt."""
        if verify_password(data.password_nueva, usuario.password_hash):
            raise DatosInvalidosError("La nueva contraseña debe ser diferente de la actual.")
        usuario.password_hash = hash_password(data.password_nueva)
        self._repository.commit()
        logger.info("El usuario %s cambió su contraseña.", usuario.id)
