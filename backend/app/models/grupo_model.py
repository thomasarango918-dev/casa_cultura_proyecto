"""
Capa Modelo (MVC): grupos de formación y sus estudiantes (database/fase5_grupos.sql).

    TBL_Grupos            -> Grupo
    TBL_Grupo_Estudiante  -> GrupoEstudiante

El estudiante es la solicitud APROBADA: los aspirantes no tienen cuenta en tbl_usuarios.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.programa_model import Programa
from app.models.solicitud_model import SolicitudInscripcion


class Grupo(Base):
    __tablename__ = "tbl_grupos"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column("nombre", String(100), nullable=False)
    programa_id: Mapped[int] = mapped_column("programa_id", ForeignKey("tbl_programas.id"), nullable=False)
    # profesor_id (casacultura.sql) no se mapea: los maestros salen de tbl_programa_maestro.

    programa: Mapped[Programa] = relationship()

    def __repr__(self) -> str:
        return f"<Grupo id={self.id} nombre={self.nombre!r} programa_id={self.programa_id}>"


class GrupoEstudiante(Base):
    """Vínculo estudiante-grupo. Desasignar no borra: deja activo=FALSE y la fecha de salida."""

    __tablename__ = "tbl_grupo_estudiante"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    grupo_id: Mapped[int] = mapped_column(
        "grupo_id", ForeignKey("tbl_grupos.id", ondelete="CASCADE"), nullable=False
    )
    solicitud_id: Mapped[int] = mapped_column(
        "solicitud_id", ForeignKey("tbl_solicitudinscripcion.id"), nullable=False
    )
    fecha_ingreso: Mapped[datetime] = mapped_column(
        "fecha_ingreso", DateTime, nullable=False, server_default=func.now()
    )
    fecha_desvinculacion: Mapped[datetime | None] = mapped_column("fecha_desvinculacion", DateTime, nullable=True)
    activo: Mapped[bool] = mapped_column("activo", Boolean, nullable=False, default=True, server_default=true())

    solicitud: Mapped[SolicitudInscripcion] = relationship()

    def __repr__(self) -> str:
        return f"<GrupoEstudiante grupo={self.grupo_id} solicitud={self.solicitud_id} activo={self.activo}>"
