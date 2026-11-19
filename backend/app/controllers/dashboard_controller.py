"""
Capa Controlador (MVC): indicadores del panel general (CON token JWT).

Rutas (montadas en main.py bajo /api/v1):
    GET /api/v1/admin/dashboard/kpis                Conteo de solicitudes (Administrador y Coordinador).
    GET /api/v1/admin/dashboard/resumen-operativo   Fase 9: configuración y totales (Administrador).
    GET /api/v1/admin/dashboard/maestro             Fase 9: KPIs, horario y sesiones de hoy (Maestro).
"""

from fastapi import APIRouter, Depends, status

from app.dependencies.dashboard_dependencies import (
    get_dashboard_service,
    require_panel_administrador,
    require_panel_maestro,
)
from app.dependencies.solicitud_dependencies import get_solicitud_service, require_backoffice
from app.models.user_model import Usuario
from app.schemas.auth_schema import MensajeError
from app.schemas.dashboard_schema import PanelMaestroOut, ResumenOperativoOut
from app.schemas.solicitud_schema import DashboardKpis
from app.services.dashboard_service import DashboardService
from app.services.solicitud_service import SolicitudService

# Fase 9: cada ruta declara su rol; el router ya no exige uno común.
router = APIRouter(
    prefix="/admin/dashboard",
    tags=["Panel general"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)


@router.get(
    "/kpis",
    response_model=DashboardKpis,
    summary="Indicadores de solicitudes",
    dependencies=[Depends(require_backoffice)],
)
def get_kpis(service: SolicitudService = Depends(get_solicitud_service)) -> DashboardKpis:
    return service.kpis()


@router.get(
    "/resumen-operativo",
    response_model=ResumenOperativoOut,
    summary="Resumen operativo del sistema",
    dependencies=[Depends(require_panel_administrador)],
)
def get_resumen_operativo(service: DashboardService = Depends(get_dashboard_service)) -> ResumenOperativoOut:
    return service.resumen_operativo()


@router.get(
    "/maestro",
    response_model=PanelMaestroOut,
    summary="Panel del maestro",
    description="Métricas, horario y sesiones de hoy, solo de los programas asignados en tbl_programa_maestro.",
)
def get_panel_maestro(
    usuario: Usuario = Depends(require_panel_maestro),
    service: DashboardService = Depends(get_dashboard_service),
) -> PanelMaestroOut:
    return service.panel_maestro(usuario)
