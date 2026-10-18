"""
Capa Modelo (MVC): configuración global de la aplicación (Fase 3).

Mapea la tabla creada por database/fase3_configuracion_sistema.sql:

    TBL_Configuracion_Sistema  -> ConfiguracionSistema

La tabla tiene una sola fila (ID = 1, restricción ck_configuracion_registro_unico).
"""

from sqlalchemy import Boolean, Integer, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database import Base

# ID de la única fila de configuración.
CONFIGURACION_ID = 1
# Valores por defecto (iguales a los DEFAULT de la tabla).
INSCRIPCIONES_ABIERTAS_DEFECTO = True
PERIODO_ACADEMICO_DEFECTO = "2026"


class ConfiguracionSistema(Base):
    """Interruptor de inscripciones públicas y periodo académico vigente."""

    __tablename__ = "tbl_configuracion_sistema"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True, autoincrement=False)
    inscripciones_abiertas: Mapped[bool] = mapped_column(
        "inscripciones_abiertas", Boolean, nullable=False, default=INSCRIPCIONES_ABIERTAS_DEFECTO, server_default=true()
    )
    periodo_academico: Mapped[str] = mapped_column(
        "periodo_academico", String(20), nullable=False, default=PERIODO_ACADEMICO_DEFECTO
    )

    def __repr__(self) -> str:
        return (
            f"<ConfiguracionSistema abiertas={self.inscripciones_abiertas} periodo={self.periodo_academico!r}>"
        )
