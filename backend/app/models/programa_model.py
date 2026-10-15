"""
Capa Modelo (MVC): catálogo de programas formativos.

    TBL_Programas -> Programa
"""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base


class Programa(Base):
    """Programa o taller ofrecido por la Casa de la Cultura (Música, Danza, Teatro...)."""

    __tablename__ = "tbl_programas"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    programa: Mapped[str] = mapped_column("programa", String(100), unique=True, nullable=False)

    def __repr__(self) -> str:
        return f"<Programa id={self.id} programa={self.programa!r}>"
