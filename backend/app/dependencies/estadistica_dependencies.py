"""Dependencias del módulo de estadísticas (Fase 7)."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.roles import ROLES_ESTADISTICAS, ROLES_ESTADISTICAS_GRUPOS
from app.dependencies.auth_dependencies import require_roles
from app.repositories.estadistica_repository import EstadisticaRepository
from app.services.estadistica_service import EstadisticaService

# Solicitudes y categorías: Administrador y Coordinador.
require_estadisticas = require_roles(*ROLES_ESTADISTICAS)
# Ocupación de grupos: también el Maestro (solo sus propios grupos, lo valida el servicio).
require_estadisticas_grupos = require_roles(*ROLES_ESTADISTICAS_GRUPOS)


def get_estadistica_service(db: Session = Depends(get_db)) -> EstadisticaService:
    return EstadisticaService(EstadisticaRepository(db))
