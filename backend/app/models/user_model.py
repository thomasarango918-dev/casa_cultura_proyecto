"""
Capa Modelo (MVC): identidad y acceso.

Mapea tres tablas de la base de datos a clases de Python:

    TBL_Roles          -> Role
    TBL_TipoDocumento  -> TipoDocumento
    TBL_Usuarios       -> Usuario

Nota: PostgreSQL guarda en minúsculas los nombres escritos sin comillas en el
script SQL (TBL_Usuarios se almacena como tbl_usuarios). Por eso las tablas y
columnas se declaran aquí en minúsculas.

Las tablas y restricciones se crean con database/schema.sql; estos modelos solo
las describen para poder consultarlas desde Python.
"""

from sqlalchemy import Boolean, ForeignKey, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class Role(Base):
    """Rol de acceso al sistema (Administrador, Coordinador, Profesor, Estudiante)."""

    __tablename__ = "tbl_roles"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    nom_role: Mapped[str] = mapped_column("nom_role", String(30), unique=True, nullable=False)

    # Relación inversa: lista de usuarios que tienen este rol.
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="rol")

    def __repr__(self) -> str:
        return f"<Role id={self.id} nom_role={self.nom_role!r}>"


class TipoDocumento(Base):
    """Tipo de documento de identidad (CC, TI, CE, PA, PPT, RC)."""

    __tablename__ = "tbl_tipodocumento"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    tipo_doc: Mapped[str] = mapped_column("tipo_doc", String(20), unique=True, nullable=False)

    # Relación inversa: usuarios registrados con este tipo de documento.
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="tipo_doc")

    def __repr__(self) -> str:
        return f"<TipoDocumento id={self.id} tipo_doc={self.tipo_doc!r}>"


class Usuario(Base):
    """Usuario con acceso al sistema.

    Puede iniciar sesión con su correo electrónico o con su número de documento.
    La contraseña nunca se guarda en texto plano: solo su hash bcrypt.
    """

    __tablename__ = "tbl_usuarios"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    # Llave foránea hacia TBL_TipoDocumento.
    tipo_documento: Mapped[int] = mapped_column(
        "tipo_documento", ForeignKey("tbl_tipodocumento.id"), nullable=False
    )
    num_documento: Mapped[str] = mapped_column(
        "num_documento", String(20), unique=True, nullable=False
    )
    nombre_com: Mapped[str] = mapped_column("nombre_com", String(100), nullable=False)
    email: Mapped[str] = mapped_column("email", String(150), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column("password_hash", String(255), nullable=False)
    # Llave foránea hacia TBL_Roles.
    tipo_role: Mapped[int] = mapped_column("tipo_role", ForeignKey("tbl_roles.id"), nullable=False)
    # TRUE = cuenta activa; FALSE = cuenta inhabilitada (no puede iniciar sesión).
    state: Mapped[bool] = mapped_column(
        "state", Boolean, nullable=False, default=True, server_default=true()
    )

    # Relaciones con carga "joined": al consultar un usuario se traen en la misma
    # consulta su rol y su tipo de documento, porque el login siempre los necesita.
    rol: Mapped[Role] = relationship(back_populates="usuarios", lazy="joined")
    tipo_doc: Mapped[TipoDocumento] = relationship(back_populates="usuarios", lazy="joined")

    def __repr__(self) -> str:
        return f"<Usuario id={self.id} email={self.email!r} activo={self.state}>"
