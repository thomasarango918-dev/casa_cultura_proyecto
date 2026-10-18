"""
Repositorio de la configuración global (TBL_Configuracion_Sistema, una sola fila).

No confirma transacciones: el servicio decide cuándo hacer commit. La radicación
lee la configuración dentro de su propia transacción (ver SolicitudService.radicar).
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuracion_model import CONFIGURACION_ID, ConfiguracionSistema


class ConfiguracionSistemaRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get(self, *, bloquear: str | None = None) -> ConfiguracionSistema | None:
        """Devuelve la fila de configuración (o None si el script SQL no insertó la semilla).

        Args:
            bloquear: None (sin bloqueo), "compartido" (FOR SHARE: varias radicaciones
                pueden leerla a la vez, pero un cambio del Administrador espera a que
                terminen) o "exclusivo" (FOR UPDATE, para modificarla).
        """
        stmt = select(ConfiguracionSistema).where(ConfiguracionSistema.id == CONFIGURACION_ID)
        if bloquear == "compartido":
            stmt = stmt.with_for_update(read=True)
        elif bloquear == "exclusivo":
            stmt = stmt.with_for_update()
        # populate_existing: con bloqueo se quiere el valor vigente, no el de la caché de la sesión.
        return self._db.scalars(stmt.execution_options(populate_existing=True)).first()

    def add(self, configuracion: ConfiguracionSistema) -> ConfiguracionSistema:
        self._db.add(configuracion)
        self._db.flush()
        return configuracion

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def refresh(self, configuracion: ConfiguracionSistema) -> ConfiguracionSistema:
        self._db.refresh(configuracion)
        return configuracion
