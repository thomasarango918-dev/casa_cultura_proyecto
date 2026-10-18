"""
Capa Controlador (MVC): configuración de la cuenta propia (Fase 3, CON token JWT).

Rutas (montadas en main.py bajo /api/v1). Disponibles para TODOS los roles autenticados:
    GET /api/v1/admin/configuracion/me           Datos de la cuenta.
    PUT /api/v1/admin/configuracion/me           Actualizar nombre y correo.
    PUT /api/v1/admin/configuracion/me/password  Cambiar la contraseña.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth_dependencies import get_current_user
from app.dependencies.usuario_dependencies import get_configuracion_service
from app.models.user_model import Usuario
from app.schemas.auth_schema import MensajeError
from app.schemas.configuracion_schema import CambioPasswordRequest, PerfilOut, PerfilUpdate
from app.services.configuracion_service import ConfiguracionService
from app.utils.exceptions import DatosInvalidosError, RegistroDuplicadoError

router = APIRouter(
    prefix="/admin/configuracion",
    tags=["Configuración de la cuenta"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError, "description": "Cuenta inactiva"},
    },
)


@router.get("/me", response_model=PerfilOut, summary="Mi cuenta")
def get_me(
    usuario: Usuario = Depends(get_current_user),
    service: ConfiguracionService = Depends(get_configuracion_service),
) -> PerfilOut:
    return service.perfil(usuario)


@router.put(
    "/me",
    response_model=PerfilOut,
    summary="Actualizar mis datos personales",
    responses={status.HTTP_409_CONFLICT: {"model": MensajeError, "description": "Correo ya registrado"}},
)
def update_me(
    data: PerfilUpdate,
    usuario: Usuario = Depends(get_current_user),
    service: ConfiguracionService = Depends(get_configuracion_service),
) -> PerfilOut:
    try:
        return service.actualizar_perfil(usuario, data)
    except RegistroDuplicadoError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cambiar mi contraseña",
    description="Mínimo 8 caracteres, con letras y números, y diferente de la actual.",
    responses={status.HTTP_400_BAD_REQUEST: {"model": MensajeError}},
)
def update_my_password(
    data: CambioPasswordRequest,
    usuario: Usuario = Depends(get_current_user),
    service: ConfiguracionService = Depends(get_configuracion_service),
) -> None:
    try:
        service.cambiar_password(usuario, data)
    except DatosInvalidosError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
