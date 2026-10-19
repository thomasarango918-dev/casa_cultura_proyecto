"""
Dependencias de la recuperación de contraseña (Fase 4).

    get_recuperacion_service  Construye el servicio con el repositorio de usuarios de la Fase 1.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.repositories.user_repository import UserRepository
from app.services.recuperacion_service import RecuperacionService


def get_recuperacion_service(db: Session = Depends(get_db)) -> RecuperacionService:
    """Arma la cadena repositorio -> servicio usando la sesión de la petición actual."""
    return RecuperacionService(UserRepository(db))
