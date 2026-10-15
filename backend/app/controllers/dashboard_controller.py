"""
Capa Controlador (MVC): indicadores del panel general (CON token JWT).

Rutas (montadas en main.py bajo /api/v1):
    GET /api/v1/admin/dashboard/kpis   Conteo de solicitudes totales y por estado.
"""

from fastapi import APIRouter, Depends, status

from app.dependencies.solicitud_dependencies import get_solicitud_service, require_backoffice
from app.schemas.auth_schema import MensajeError
from app.schemas.solicitud_schema import DashboardKpis
from app.services.solicitud_service import SolicitudService

router = APIRouter(
    prefix="/admin/dashboard",
    tags=["Panel general"],
    dependencies=[Depends(require_backoffice)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)


@router.get("/kpis", response_model=DashboardKpis, summary="Indicadores de solicitudes")
def get_kpis(service: SolicitudService = Depends(get_solicitud_service)) -> DashboardKpis:
    return service.kpis()
