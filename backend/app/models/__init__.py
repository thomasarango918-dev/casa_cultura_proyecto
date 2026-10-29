"""
Capa Modelo (MVC): entidades ORM de SQLAlchemy.

Cada clase representa una tabla de PostgreSQL definida en database/casacultura.sql
y en los scripts de actualización (database/fase2_solicitudes.sql y
database/fase2_ajustes_inscripcion.sql, database/fase3_configuracion_sistema.sql y
database/fase4_categorias_programas.sql, database/fase5_grupos.sql).
Se reexportan aquí para poder importarlas con `from app.models import Usuario`.
"""

from app.models.catalogo_model import Parentesco, RequisitoDocumento
from app.models.configuracion_model import ConfiguracionSistema
from app.models.grupo_model import Grupo, GrupoEstudiante
from app.models.programa_model import Categoria, Programa
from app.models.solicitud_model import ConsecutivoRadicado, DocumentoInscripcion, SolicitudInscripcion
from app.models.user_model import Role, TipoDocumento, Usuario

__all__ = [
    "Categoria",
    "ConfiguracionSistema",
    "ConsecutivoRadicado",
    "DocumentoInscripcion",
    "Grupo",
    "GrupoEstudiante",
    "Parentesco",
    "Programa",
    "RequisitoDocumento",
    "Role",
    "SolicitudInscripcion",
    "TipoDocumento",
    "Usuario",
]
