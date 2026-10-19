"""
Capa Controlador (MVC): recuperación de contraseña (Fase 4, SIN token de sesión).

Rutas (montadas en main.py bajo /api/v1):
    POST /api/v1/auth/forgot-password   Envía el enlace de recuperación al correo del usuario.
    POST /api/v1/auth/reset-password    Cambia la contraseña con el token del enlace.

No modifica el login de la Fase 1: solo agrega estas dos rutas al mismo prefijo /auth.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.dependencies.recuperacion_dependencies import get_recuperacion_service
from app.schemas.auth_schema import MensajeError
from app.schemas.recuperacion_schema import ForgotPasswordRequest, MensajeOut, ResetPasswordRequest
from app.services.email_service import notificar_recuperacion_password
from app.services.recuperacion_service import MENSAJE_SOLICITUD, RecuperacionService
from app.utils.exceptions import DatosInvalidosError, TokenInvalidoError

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post(
    "/forgot-password",
    response_model=MensajeOut,
    summary="Solicitar recuperación de contraseña",
    description=(
        "Recibe el número de documento. Responde SIEMPRE 200 con el mismo mensaje, exista o no el "
        "documento (protección contra enumeración). Si el usuario existe y está activo, envía en "
        "segundo plano un enlace con vigencia de 15 minutos a su correo registrado."
    ),
)
def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    service: RecuperacionService = Depends(get_recuperacion_service),
) -> MensajeOut:
    correo = service.solicitar(data.numero_documento)
    if correo is not None:
        # El correo sale después de responder: el tiempo de respuesta no revela si el documento existe.
        background_tasks.add_task(notificar_recuperacion_password, correo.correo, correo.nombre, correo.enlace)
    return MensajeOut(mensaje=MENSAJE_SOLICITUD)


@router.post(
    "/reset-password",
    response_model=MensajeOut,
    summary="Restablecer contraseña",
    description="Recibe el token del enlace y la nueva contraseña. 400 si el enlace venció, ya se usó o es inválido.",
    responses={status.HTTP_400_BAD_REQUEST: {"model": MensajeError, "description": "Enlace inválido o vencido"}},
)
def reset_password(
    data: ResetPasswordRequest,
    service: RecuperacionService = Depends(get_recuperacion_service),
) -> MensajeOut:
    try:
        service.restablecer(data.token, data.nueva_contrasena)
    except (TokenInvalidoError, DatosInvalidosError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    return MensajeOut(mensaje="Tu contraseña fue actualizada. Ya puedes iniciar sesión.")
