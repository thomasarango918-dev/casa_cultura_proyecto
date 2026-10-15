"""
Capa Modelo (MVC): catálogos del formulario de inscripción.

Mapea las tablas creadas por database/fase2_ajustes_inscripcion.sql:

    TBL_Parentesco          -> Parentesco
    TBL_RequisitoDocumento  -> RequisitoDocumento
"""

from sqlalchemy import Boolean, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class Parentesco(Base):
    """Parentesco del acudiente con el aspirante (Madre, Padre, Tutor(a) legal...)."""

    __tablename__ = "tbl_parentesco"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    parentesco: Mapped[str] = mapped_column("parentesco", String(30), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column("orden", Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<Parentesco id={self.id} parentesco={self.parentesco!r}>"


class RequisitoDocumento(Base):
    """Documento que el aspirante debe adjuntar (documento de identidad, certificado de EPS...)."""

    __tablename__ = "tbl_requisitodocumento"

    codigo: Mapped[str] = mapped_column("codigo", String(40), primary_key=True)
    nombre: Mapped[str] = mapped_column("nombre", String(100), nullable=False)
    descripcion: Mapped[str | None] = mapped_column("descripcion", String(255), nullable=True)
    orden: Mapped[int] = mapped_column("orden", Integer, nullable=False, default=0)
    obligatorio: Mapped[bool] = mapped_column(
        "obligatorio", Boolean, nullable=False, default=True, server_default=true()
    )

    def __repr__(self) -> str:
        return f"<RequisitoDocumento codigo={self.codigo!r}>"
