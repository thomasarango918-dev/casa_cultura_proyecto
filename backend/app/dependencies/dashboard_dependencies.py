"""Dependencias del panel general por rol (Fase 9)."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.roles import ROL_ADMINISTRADOR, ROLES_PANEL_MAESTRO
from app.dependencies.auth_dependencies import require_roles
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.repositories.dashboard_repository import DashboardRepository
from app.services.configuracion_sistema_service import ConfiguracionSistemaService
from app.services.dashboard_service import DashboardService

require_panel_administrador = require_roles(ROL_ADMINISTRADOR)
# Alias del Maestro en tbl_roles (Profesor, Maestro, Docente).
require_panel_maestro = require_roles(*ROLES_PANEL_MAESTRO)


def get_dashboard_service(db: Session = Depends(get_db)) -> DashboardService:
    return DashboardService(
        DashboardRepository(db),
        ConfiguracionSistemaService(ConfiguracionSistemaRepository(db)),
    )
