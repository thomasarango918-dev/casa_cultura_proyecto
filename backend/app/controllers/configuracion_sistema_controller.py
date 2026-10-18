"""
Capa Controlador (MVC): configuración del sistema (Fase 3, CON token JWT, solo Administrador).

Rutas (montadas en main.py bajo /api/v1):
    GET /api/v1/admin/configuracion/sistema   Estado de las inscripciones y periodo académico.
    PUT /api/v1/admin/configuracion/sistema   Abrir/cerrar inscripciones y cambiar el periodo.

El formulario público consulta el interruptor en GET /api/v1/public/configuracion.
"""

from fastapi import APIRouter, Depends, status

from app.dependencies.usuario_dependencies import get_configuracion_sistema_service, require_administrador
from app.models.user_model import Usuario
from app.schemas.auth_schema import MensajeError
from app.schemas.configuracion_schema import ConfiguracionSistemaOut, ConfiguracionSistemaUpdate
from app.services.configuracion_sistema_service import ConfiguracionSistemaService

router = APIRouter(
    prefix="/admin/configuracion/sistema",
    tags=["Configuración del sistema"],
    dependencies=[Depends(require_administrador)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError, "description": "Solo el Administrador"},
    },
)


@router.get("", response_model=ConfiguracionSistemaOut, summary="Configuración del sistema")
def get_configuracion_sistema(
    service: ConfiguracionSistemaService = Depends(get_configuracion_sistema_service),
) -> ConfiguracionSistemaOut:
    return service.obtener()


@router.put(
    "",
    response_model=ConfiguracionSistemaOut,
    summary="Actualizar la configuración del sistema",
    description="Abre o cierra las inscripciones públicas y define el periodo académico vigente (ej. 2026-2).",
)
def update_configuracion_sistema(
    data: ConfiguracionSistemaUpdate,
    usuario: Usuario = Depends(require_administrador),
    service: ConfiguracionSistemaService = Depends(get_configuracion_sistema_service),
) -> ConfiguracionSistemaOut:
    return service.actualizar(data, usuario)
