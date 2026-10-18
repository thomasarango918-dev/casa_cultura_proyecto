"""
Dependencias de los módulos de usuarios y de configuración (Fase 3).

    get_usuario_service        Servicio de administración de usuarios.
    get_configuracion_service  Servicio de la cuenta propia.
    get_configuracion_sistema_service  Servicio de la configuración global (inscripciones y periodo).
    require_gestion_usuarios   Solo Administrador y Coordinador (403 para los demás roles).
    require_administrador      Solo Administrador (configuración del sistema).
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.config.roles import ROL_ADMINISTRADOR, ROLES_GESTION_USUARIOS
from app.dependencies.auth_dependencies import require_roles
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.repositories.usuario_admin_repository import UsuarioAdminRepository
from app.services.configuracion_service import ConfiguracionService
from app.services.configuracion_sistema_service import ConfiguracionSistemaService
from app.services.usuario_service import UsuarioService

require_gestion_usuarios = require_roles(*ROLES_GESTION_USUARIOS)
require_administrador = require_roles(ROL_ADMINISTRADOR)


def get_usuario_service(db: Session = Depends(get_db)) -> UsuarioService:
    return UsuarioService(UsuarioAdminRepository(db))


def get_configuracion_service(db: Session = Depends(get_db)) -> ConfiguracionService:
    return ConfiguracionService(UsuarioAdminRepository(db))


def get_configuracion_sistema_service(db: Session = Depends(get_db)) -> ConfiguracionSistemaService:
    return ConfiguracionSistemaService(ConfiguracionSistemaRepository(db))
