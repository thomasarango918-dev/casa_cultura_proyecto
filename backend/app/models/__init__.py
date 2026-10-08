"""
Capa Modelo (MVC): entidades ORM de SQLAlchemy.

Cada clase representa una tabla de PostgreSQL definida en database/schema.sql.
Se reexportan aquí para poder importarlas con `from app.models import Usuario`.
"""

from app.models.user_model import Role, TipoDocumento, Usuario

__all__ = ["Role", "TipoDocumento", "Usuario"]
