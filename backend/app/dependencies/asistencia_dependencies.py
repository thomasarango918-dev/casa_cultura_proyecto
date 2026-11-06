"""Dependencias del módulo de asistencias (Fase 6)."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.roles import ROLES_ASISTENCIA
from app.dependencies.auth_dependencies import require_roles
from app.models.user_model import Usuario
from app.repositories.asistencia_repository import AsistenciaRepository
from app.repositories.grupo_repository import GrupoRepository
from app.services.asistencia_service import AsistenciaService

require_asistencia = require_roles(*ROLES_ASISTENCIA)


def get_asistencia_service(
    db: Session = Depends(get_db), usuario: Usuario = Depends(require_asistencia)
) -> AsistenciaService:
    # El Maestro solo ve los grupos de sus programas: el servicio necesita al usuario.
    return AsistenciaService(AsistenciaRepository(db), GrupoRepository(db), usuario)
