"""Dependencias del módulo de programas y categorías (Fase 5)."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.roles import ROLES_GESTION_PROGRAMAS
from app.dependencies.auth_dependencies import require_roles
from app.repositories.programa_repository import ProgramaRepository
from app.services.programa_service import ProgramaService

require_gestion_programas = require_roles(*ROLES_GESTION_PROGRAMAS)


def get_programa_service(db: Session = Depends(get_db)) -> ProgramaService:
    return ProgramaService(ProgramaRepository(db))
