"""
Servicio de autenticación: reglas de negocio del inicio de sesión.

Flujo de un login:
    1. Identificar si el usuario escribió un correo o un número de documento.
    2. Buscar el usuario mediante el repositorio.
    3. Verificar la contraseña contra el hash bcrypt.
    4. Verificar que la cuenta esté activa.
    5. Emitir el token JWT y armar la respuesta.

Los errores se comunican con excepciones de dominio (app.utils.exceptions);
el controlador decide qué código HTTP corresponde a cada una.
"""

import re

from pydantic import ValidationError

from app.models.user_model import Usuario
from app.repositories.user_repository import UserRepository
from app.schemas.auth_schema import LoginRequest, TokenPayload, TokenResponse, UsuarioAutenticado
from app.utils.exceptions import CredencialesInvalidasError, TokenInvalidoError, UsuarioInactivoError
from app.utils.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    password_needs_rehash,
    verify_password,
    verify_password_dummy,
)

# Caracteres que la gente suele escribir dentro de un número de documento.
_DOCUMENT_SEPARATORS = re.compile(r"[\s.\-]")


def normalizar_documento(valor: str) -> str:
    """Elimina puntos, guiones y espacios: '1.036.123.456' -> '1036123456'.

    Se pasa a mayúsculas para documentos alfanuméricos como los pasaportes.
    """
    return _DOCUMENT_SEPARATORS.sub("", valor).upper()


def to_usuario_autenticado(usuario: Usuario) -> UsuarioAutenticado:
    """Convierte el modelo ORM en el esquema público que se envía al frontend.

    Este paso evita exponer campos internos como password_hash.
    """
    return UsuarioAutenticado(
        id=usuario.id,
        nombre_completo=usuario.nombre_com,
        email=usuario.email,
        tipo_documento=usuario.tipo_doc.tipo_doc,
        num_documento=usuario.num_documento,
        rol_id=usuario.rol.id,
        rol=usuario.rol.nom_role,
        activo=usuario.state,
    )


class AuthService:
    """Casos de uso de autenticación: iniciar sesión y resolver el usuario de un token."""

    def __init__(self, repository: UserRepository) -> None:
        """Recibe el repositorio por inyección de dependencias (ver auth_dependencies.py)."""
        self._repository = repository

    def _find_by_identifier(self, identificador: str) -> Usuario | None:
        """Busca por correo si el identificador contiene '@'; de lo contrario, por documento."""
        if "@" in identificador:
            return self._repository.get_by_email(identificador)
        return self._repository.get_by_documento(normalizar_documento(identificador))

    def authenticate(self, identificador: str, password: str) -> Usuario:
        """Valida las credenciales y el estado de la cuenta.

        Args:
            identificador: Correo electrónico o número de documento.
            password: Contraseña en texto plano.

        Returns:
            El usuario autenticado.

        Raises:
            CredencialesInvalidasError: El usuario no existe o la contraseña no coincide.
            UsuarioInactivoError: La contraseña es correcta pero la cuenta está inhabilitada.
        """
        usuario = self._find_by_identifier(identificador)

        if usuario is None:
            # Se gasta el mismo tiempo que con un usuario real (ver security.py).
            verify_password_dummy(password)
            raise CredencialesInvalidasError()

        if not verify_password(password, usuario.password_hash):
            raise CredencialesInvalidasError()

        # El estado se revisa después de validar la contraseña para no revelar
        # a terceros si una cuenta existe o está inhabilitada.
        if not usuario.state:
            raise UsuarioInactivoError()

        # Si el hash fue generado con parámetros antiguos, se actualiza de forma transparente.
        if password_needs_rehash(usuario.password_hash):
            self._repository.update_password_hash(usuario, hash_password(password))

        return usuario

    def login(self, credentials: LoginRequest) -> TokenResponse:
        """Autentica al usuario y construye la respuesta con su token de acceso.

        El rol y el nombre se incluyen en el token para que el frontend pueda
        mostrarlos sin hacer una consulta adicional.
        """
        usuario = self.authenticate(credentials.identificador, credentials.password)
        token, expires_in = create_access_token(
            subject=usuario.id,
            extra_claims={"rol": usuario.rol.nom_role, "nombre": usuario.nombre_com},
        )
        return TokenResponse(
            access_token=token,
            expires_in=expires_in,
            usuario=to_usuario_autenticado(usuario),
        )

    def get_user_from_token(self, token: str) -> Usuario:
        """Resuelve el usuario dueño de un token y verifica que siga activo.

        Se consulta la base en cada petición protegida para que una cuenta
        inhabilitada pierda el acceso de inmediato, aunque su token siga vigente.

        Raises:
            TokenInvalidoError: El token es inválido o el usuario ya no existe.
            UsuarioInactivoError: La cuenta fue inhabilitada después de emitir el token.
        """
        try:
            claims = TokenPayload.model_validate(decode_access_token(token))
            user_id = int(claims.sub)
        except (ValidationError, ValueError) as exc:
            # El token tiene una firma válida pero su contenido no es el esperado.
            raise TokenInvalidoError() from exc

        usuario = self._repository.get_by_id(user_id)
        if usuario is None:
            raise TokenInvalidoError()
        if not usuario.state:
            raise UsuarioInactivoError()
        return usuario
