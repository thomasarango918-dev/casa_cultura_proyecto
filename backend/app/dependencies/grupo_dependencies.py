"""Dependencias del módulo de grupos (Fase 6)."""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.roles import ROLES_GRUPOS
from app.dependencies.auth_dependencies import require_roles
from app.models.user_model import Usuario
from app.repositories.grupo_repository import GrupoRepository
from app.services.grupo_service import GrupoService

require_grupos = require_roles(*ROLES_GRUPOS)


def get_grupo_service(db: Session = Depends(get_db), usuario: Usuario = Depends(require_grupos)) -> GrupoService:
    # El servicio necesita al usuario: los permisos de escritura dependen del rol y de sus programas.
    return GrupoService(GrupoRepository(db), usuario)
