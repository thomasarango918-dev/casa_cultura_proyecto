"""
Capa Controlador (MVC): autenticación.

Rutas (montadas en main.py bajo /api/v1):
    POST /api/v1/auth/login   Inicia sesión y devuelve el token JWT.
    GET  /api/v1/auth/me      Devuelve el usuario dueño del token.

El controlador no contiene reglas de negocio: delega en AuthService y convierte
las excepciones de dominio en códigos HTTP.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth_dependencies import get_auth_service, get_current_user
from app.models.user_model import Usuario
from app.schemas.auth_schema import LoginRequest, MensajeError, TokenResponse, UsuarioAutenticado
from app.services.auth_service import AuthService, to_usuario_autenticado
from app.utils.exceptions import CredencialesInvalidasError, UsuarioInactivoError

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Iniciar sesión",
    description=(
        "Valida el correo electrónico o el número de documento junto con la contraseña "
        "contra TBL_Usuarios y devuelve un token JWT de acceso."
    ),
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError, "description": "Credenciales inválidas"},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError, "description": "Cuenta inactiva"},
    },
)
def login(
    credentials: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    # FastAPI ya validó el cuerpo con LoginRequest; si faltaban datos respondió 422.
    try:
        return service.login(credentials)
    except CredencialesInvalidasError as exc:
        # 401: el cliente debe volver a intentar con otras credenciales.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.message,
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except UsuarioInactivoError as exc:
        # 403: las credenciales son correctas pero el acceso está prohibido.
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc


@router.get(
    "/me",
    response_model=UsuarioAutenticado,
    summary="Usuario de la sesión actual",
    responses={status.HTTP_401_UNAUTHORIZED: {"model": MensajeError}},
)
def read_current_user(usuario: Usuario = Depends(get_current_user)) -> UsuarioAutenticado:
    """Devuelve los datos del usuario dueño del token enviado en el encabezado Authorization.

    El frontend lo usa al recargar la página para confirmar que la sesión guardada sigue vigente.
    """
    return to_usuario_autenticado(usuario)
