"""
Dependencias de autenticación y autorización.

    get_auth_service   Construye el servicio de autenticación con su repositorio.
    get_current_user   Lee el token del encabezado y devuelve el usuario autenticado.
    require_roles      Restringe una ruta a uno o varios roles.

Ejemplo para proteger un endpoint futuro:

    @router.get("/solicitudes")
    def listar(usuario: Usuario = Depends(require_roles("Administrador", "Coordinador"))):
        ...
"""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.models.user_model import Usuario
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.utils.exceptions import PermisoDenegadoError, TokenInvalidoError, UsuarioInactivoError

# Extrae el token del encabezado "Authorization: Bearer <token>".
# auto_error=False permite responder con un mensaje propio en español cuando falta.
bearer_scheme = HTTPBearer(auto_error=False, description="Token JWT obtenido en /auth/login")


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Arma la cadena repositorio -> servicio usando la sesión de la petición actual."""
    return AuthService(UserRepository(db))


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    service: AuthService = Depends(get_auth_service),
) -> Usuario:
    """Devuelve el usuario dueño del token enviado en la petición.

    Raises:
        HTTPException 401: No se envió token, o el token es inválido o venció.
        HTTPException 403: La cuenta está inactiva.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debe iniciar sesión para acceder a este recurso.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return service.get_user_from_token(credentials.credentials)
    except TokenInvalidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except UsuarioInactivoError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc


def require_roles(*roles: str) -> Callable[[Usuario], Usuario]:
    """Fábrica de dependencias que restringe una ruta a uno o varios roles.

    Args:
        roles: Nombres de rol tal como están en TBL_Roles (sin distinguir mayúsculas).

    Returns:
        Una dependencia que devuelve el usuario si su rol está permitido,
        o responde 403 en caso contrario.
    """
    allowed = {role.lower() for role in roles}

    def _checker(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol.nom_role.lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=PermisoDenegadoError.default_message,
            )
        return usuario

    return _checker
