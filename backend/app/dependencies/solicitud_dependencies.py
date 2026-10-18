"""
Dependencias del módulo de radicación.

    get_solicitud_service  Construye el servicio con su repositorio y la sesión de la petición.
    require_backoffice     Restringe una ruta a los roles que gestionan solicitudes.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.dependencies.auth_dependencies import require_roles
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.repositories.solicitud_repository import SolicitudRepository
from app.services.configuracion_sistema_service import ConfiguracionSistemaService
from app.services.solicitud_service import SolicitudService

# Roles (TBL_Roles) que pueden consultar y evaluar solicitudes en el BackOffice.
ROLES_BACKOFFICE = ("Administrador", "Coordinador")

require_backoffice = require_roles(*ROLES_BACKOFFICE)


def get_solicitud_service(db: Session = Depends(get_db)) -> SolicitudService:
    """Arma la cadena repositorio -> servicio usando la sesión de la petición actual."""
    return SolicitudService(
        SolicitudRepository(db),
        ConfiguracionSistemaService(ConfiguracionSistemaRepository(db)),
    )
