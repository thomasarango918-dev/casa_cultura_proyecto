"""
Repositorio de usuarios: consultas y actualizaciones sobre TBL_Usuarios.

Esta clase es la única que conoce cómo buscar usuarios en la base de datos.
El servicio de autenticación la usa sin preocuparse por SQL ni por SQLAlchemy.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user_model import Usuario


class UserRepository:
    """Acceso a datos de la entidad Usuario."""

    def __init__(self, db: Session) -> None:
        """Recibe la sesión de base de datos abierta para la petición actual."""
        self._db = db

    def get_by_id(self, user_id: int) -> Usuario | None:
        """Busca un usuario por su llave primaria. Devuelve None si no existe."""
        return self._db.get(Usuario, user_id)

    def get_by_email(self, email: str) -> Usuario | None:
        """Busca un usuario por correo electrónico.

        El correo se normaliza a minúsculas porque así se guarda en la base
        (restricción ck_usuarios_email_min en schema.sql).
        """
        stmt = select(Usuario).where(Usuario.email == email.strip().lower())
        # unique() es obligatorio con relaciones de carga "joined" en SQLAlchemy 2.0.
        return self._db.scalars(stmt).unique().first()

    def get_by_documento(self, num_documento: str) -> Usuario | None:
        """Busca un usuario por número de documento (ya normalizado, sin puntos ni espacios)."""
        stmt = select(Usuario).where(Usuario.num_documento == num_documento)
        return self._db.scalars(stmt).unique().first()

    def update_password_hash(self, usuario: Usuario, new_hash: str) -> None:
        """Reemplaza el hash de la contraseña de un usuario y confirma el cambio."""
        usuario.password_hash = new_hash
        self._db.add(usuario)
        self._db.commit()
