"""
Servicio de usuarios y roles (Fase 3): reglas de negocio del módulo de administración.

Alcance según el rol de quien opera (ver app/config/roles.py):
    Administrador  Ve, crea y edita usuarios de cualquier rol.
    Coordinador    Solo ve, crea y edita Maestros y Estudiantes, y solo asigna esos roles.
    Otros roles    Sin acceso (la dependencia responde 403 antes de llegar aquí).

Reglas adicionales:
    - El número de documento es inmutable después de crear la cuenta.
    - Nadie puede cambiar su propio rol ni deshabilitar su propia cuenta,
      para no quedarse sin acceso por error.
    - Correo y número de documento son únicos (409 si ya están registrados).
"""

import logging

from sqlalchemy.exc import IntegrityError

from app.config.roles import ADMINISTRADOR, clave_rol, etiqueta_rol, nombres_de_rol, roles_administrables
from app.models.user_model import Role, Usuario
from app.repositories.usuario_admin_repository import UsuarioAdminRepository
from app.schemas.solicitud_schema import TipoDocumentoOut
from app.schemas.usuario_schema import (
    CatalogosUsuario,
    RolOut,
    UsuarioCreate,
    UsuarioListResponse,
    UsuarioOut,
    UsuarioUpdate,
)
from app.services.auth_service import normalizar_documento
from app.utils.exceptions import (
    DatosInvalidosError,
    PermisoDenegadoError,
    RecursoNoEncontradoError,
    RegistroDuplicadoError,
)
from app.utils.security import hash_password

logger = logging.getLogger("casacultura.usuarios")

_EMAIL_DUPLICADO = "Ya existe un usuario registrado con ese correo electrónico."
_DOCUMENTO_DUPLICADO = "Ya existe un usuario registrado con ese número de documento."


def to_rol_out(rol: Role) -> RolOut:
    return RolOut(id=rol.id, nombre=rol.nom_role, etiqueta=etiqueta_rol(rol.nom_role), clave=clave_rol(rol.nom_role))


def to_usuario_out(usuario: Usuario) -> UsuarioOut:
    """Convierte el modelo ORM en la respuesta pública (sin el hash de la contraseña)."""
    return UsuarioOut(
        id=usuario.id,
        nombre_completo=usuario.nombre_com,
        email=usuario.email,
        tipo_documento_id=usuario.tipo_doc.id,
        tipo_documento=usuario.tipo_doc.tipo_doc,
        num_documento=usuario.num_documento,
        rol_id=usuario.rol.id,
        rol=usuario.rol.nom_role,
        rol_etiqueta=etiqueta_rol(usuario.rol.nom_role),
        activo=usuario.state,
    )


class UsuarioService:
    """Casos de uso del módulo de usuarios."""

    def __init__(self, repository: UsuarioAdminRepository) -> None:
        self._repository = repository

    # ------------------------------------------------------------------ #
    # Permisos
    # ------------------------------------------------------------------ #
    @staticmethod
    def _alcance(actor: Usuario) -> frozenset[str]:
        """Claves de rol que el actor puede gestionar. Defensa adicional a la dependencia de rol."""
        alcance = roles_administrables(actor.rol.nom_role)
        if not alcance:
            raise PermisoDenegadoError()
        return alcance

    def _usuario_gestionable(self, actor: Usuario, usuario_id: int) -> Usuario:
        usuario = self._repository.get(usuario_id)
        if usuario is None:
            raise RecursoNoEncontradoError("El usuario no existe.")
        if clave_rol(usuario.rol.nom_role) not in self._alcance(actor):
            raise PermisoDenegadoError("No tiene permisos para gestionar este usuario.")
        return usuario

    def _rol_asignable(self, actor: Usuario, rol_id: int) -> Role:
        rol = self._repository.get_rol(rol_id)
        if rol is None:
            raise DatosInvalidosError("El rol seleccionado no existe.")
        if clave_rol(rol.nom_role) not in self._alcance(actor):
            raise PermisoDenegadoError(
                f"Su rol no le permite asignar el rol «{etiqueta_rol(rol.nom_role)}»."
            )
        return rol

    def _tipo_documento(self, tipo_id: int):
        tipo = self._repository.get_tipo_documento(tipo_id)
        if tipo is None:
            raise DatosInvalidosError("El tipo de documento seleccionado no existe.")
        return tipo

    def _commit(self) -> None:
        """Confirma; si otra petición registró el mismo correo o documento al mismo tiempo, responde 409."""
        try:
            self._repository.commit()
        except IntegrityError as exc:
            self._repository.rollback()
            detalle = str(exc.orig).lower()
            if "email" in detalle:
                raise RegistroDuplicadoError(_EMAIL_DUPLICADO) from exc
            if "documento" in detalle:
                raise RegistroDuplicadoError(_DOCUMENTO_DUPLICADO) from exc
            raise

    # ------------------------------------------------------------------ #
    # Consultas
    # ------------------------------------------------------------------ #
    def catalogos(self, actor: Usuario) -> CatalogosUsuario:
        """Roles que el actor puede asignar y tipos de documento, para el formulario."""
        alcance = self._alcance(actor)
        roles = [to_rol_out(rol) for rol in self._repository.list_roles() if clave_rol(rol.nom_role) in alcance]
        tipos = [TipoDocumentoOut.model_validate(tipo) for tipo in self._repository.list_tipos_documento()]
        return CatalogosUsuario(roles=roles, tipos_documento=tipos)

    def listar(self, actor: Usuario, *, documento: str | None, limit: int, offset: int) -> UsuarioListResponse:
        alcance = self._alcance(actor)
        # El Administrador ve todos los usuarios, incluso los de roles que se agreguen después.
        nombres_rol = None if clave_rol(actor.rol.nom_role) == ADMINISTRADOR else nombres_de_rol(alcance)
        buscado = normalizar_documento(documento.strip()) if documento else None
        total, usuarios = self._repository.search(
            nombres_rol=nombres_rol, documento=buscado, limit=limit, offset=offset
        )
        return UsuarioListResponse(total=total, items=[to_usuario_out(usuario) for usuario in usuarios])

    def detalle(self, actor: Usuario, usuario_id: int) -> UsuarioOut:
        return to_usuario_out(self._usuario_gestionable(actor, usuario_id))

    # ------------------------------------------------------------------ #
    # Escrituras
    # ------------------------------------------------------------------ #
    def crear(self, actor: Usuario, data: UsuarioCreate) -> UsuarioOut:
        rol = self._rol_asignable(actor, data.rol_id)
        tipo = self._tipo_documento(data.tipo_documento_id)
        if self._repository.documento_en_uso(data.num_documento):
            raise RegistroDuplicadoError(_DOCUMENTO_DUPLICADO)
        if self._repository.email_en_uso(data.email):
            raise RegistroDuplicadoError(_EMAIL_DUPLICADO)

        usuario = Usuario(
            num_documento=data.num_documento,
            nombre_com=data.nombre_completo,
            email=data.email,
            password_hash=hash_password(data.password),
            state=True,
        )
        usuario.tipo_doc = tipo
        usuario.rol = rol
        self._repository.add(usuario)
        self._commit()
        self._repository.refresh(usuario)
        logger.info("Usuario %s creado por el usuario %s.", usuario.id, actor.id)
        return to_usuario_out(usuario)

    def actualizar(self, actor: Usuario, usuario_id: int, data: UsuarioUpdate) -> UsuarioOut:
        usuario = self._usuario_gestionable(actor, usuario_id)

        if data.num_documento is not None and normalizar_documento(data.num_documento.strip()) != usuario.num_documento:
            raise DatosInvalidosError("El número de documento no se puede modificar.")

        rol = self._rol_asignable(actor, data.rol_id)
        if usuario.id == actor.id and rol.id != usuario.rol.id:
            raise DatosInvalidosError("No puede cambiar su propio rol.")
        tipo = self._tipo_documento(data.tipo_documento_id)
        if self._repository.email_en_uso(data.email, excluir_id=usuario.id):
            raise RegistroDuplicadoError(_EMAIL_DUPLICADO)

        usuario.nombre_com = data.nombre_completo
        usuario.email = data.email
        usuario.tipo_doc = tipo
        usuario.rol = rol
        self._commit()
        self._repository.refresh(usuario)
        logger.info("Usuario %s actualizado por el usuario %s.", usuario.id, actor.id)
        return to_usuario_out(usuario)

    def cambiar_estado(self, actor: Usuario, usuario_id: int, activo: bool | None) -> UsuarioOut:
        """Habilita o deshabilita la cuenta. Con `activo=None` alterna el estado actual."""
        usuario = self._usuario_gestionable(actor, usuario_id)
        nuevo_estado = (not usuario.state) if activo is None else activo
        if usuario.id == actor.id and not nuevo_estado:
            raise DatosInvalidosError("No puede deshabilitar su propia cuenta.")

        usuario.state = nuevo_estado
        self._commit()
        self._repository.refresh(usuario)
        logger.info(
            "Usuario %s %s por el usuario %s.", usuario.id, "habilitado" if nuevo_estado else "deshabilitado", actor.id
        )
        return to_usuario_out(usuario)
