"""
Capa Modelo (MVC): catálogo de programas formativos y sus categorías.

    TBL_Categorias -> Categoria   (database/fase4_categorias_programas.sql)
    TBL_Programas  -> Programa
"""

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.user_model import Usuario


class Categoria(Base):
    """Agrupación de programas (Música, Danza...). Inactiva = oculta en el formulario público."""

    __tablename__ = "tbl_categorias"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column("nombre", String(100), unique=True, nullable=False)
    descripcion: Mapped[str | None] = mapped_column("descripcion", Text, nullable=True)
    activo: Mapped[bool] = mapped_column("activo", Boolean, nullable=False, default=True, server_default=true())

    programas: Mapped[list["Programa"]] = relationship(
        back_populates="categoria", order_by="Programa.programa", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Categoria id={self.id} nombre={self.nombre!r} activo={self.activo}>"


class Programa(Base):
    """Programa o taller ofrecido por la Casa de la Cultura (Piano, Danza Tropical...)."""

    __tablename__ = "tbl_programas"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    programa: Mapped[str] = mapped_column("programa", String(100), unique=True, nullable=False)
    # NULL solo si el script de la Fase 5 encontró programas sin categoría conocida.
    categoria_id: Mapped[int | None] = mapped_column("categoria_id", ForeignKey("tbl_categorias.id"), nullable=True)
    maestro_id: Mapped[int | None] = mapped_column("maestro_id", ForeignKey("tbl_usuarios.id"), nullable=True)

    # Carga diferida: Programa viaja "joined" en cada solicitud y no debe arrastrar más tablas.
    categoria: Mapped[Categoria | None] = relationship(back_populates="programas")
    maestro: Mapped[Usuario | None] = relationship()

    def __repr__(self) -> str:
        return f"<Programa id={self.id} programa={self.programa!r}>"
