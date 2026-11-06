"""
Capa Modelo (MVC): asistencia de estudiantes (database/fase6_asistencias.sql).

    TBL_Asistencia_Estudiante -> AsistenciaEstudiante

Un registro por (grupo, solicitud, fecha_clase): índice único que usa el UPSERT del repositorio.
El estudiante es la solicitud APROBADA, igual que en tbl_grupo_estudiante.
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base

ESTADO_PRESENTE = "PRESENTE"
ESTADO_AUSENTE = "AUSENTE"
ESTADO_EXCUSADO = "EXCUSADO"
ESTADOS_ASISTENCIA = (ESTADO_PRESENTE, ESTADO_AUSENTE, ESTADO_EXCUSADO)


class AsistenciaEstudiante(Base):
    __tablename__ = "tbl_asistencia_estudiante"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    grupo_id: Mapped[int] = mapped_column(
        "grupo_id", ForeignKey("tbl_grupos.id", ondelete="CASCADE"), nullable=False
    )
    solicitud_id: Mapped[int] = mapped_column(
        "solicitud_id", ForeignKey("tbl_solicitudinscripcion.id"), nullable=False
    )
    fecha_clase: Mapped[date] = mapped_column("fecha_clase", Date, nullable=False)
    estado: Mapped[str] = mapped_column("estado", String(15), nullable=False)
    modificado_por: Mapped[int] = mapped_column("modificado_por", ForeignKey("tbl_usuarios.id"), nullable=False)
    fecha_modificacion: Mapped[datetime] = mapped_column(
        "fecha_modificacion", DateTime, nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return (
            f"<AsistenciaEstudiante grupo={self.grupo_id} solicitud={self.solicitud_id} "
            f"fecha={self.fecha_clase} estado={self.estado}>"
        )
