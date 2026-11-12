"""
Repositorio de asistencias (Fase 6).

No hace commit por su cuenta: el servicio confirma después de validar la fecha y los estudiantes.
"""

from collections.abc import Iterable
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.asistencia_model import AsistenciaEstudiante


class AsistenciaRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def registros(self, grupo_id: int, desde: date, hasta: date) -> list[AsistenciaEstudiante]:
        stmt = select(AsistenciaEstudiante).where(
            AsistenciaEstudiante.grupo_id == grupo_id,
            AsistenciaEstudiante.fecha_clase.between(desde, hasta),
        )
        return list(self._db.scalars(stmt))

    def guardar(self, grupo_id: int, fecha_clase: date, estados: Iterable[tuple[int, str]], usuario_id: int) -> int:
        """UPSERT idempotente sobre el índice único (grupo_id, solicitud_id, fecha_clase).

        SQL generado (una sola sentencia para todos los estudiantes):

            INSERT INTO tbl_asistencia_estudiante (grupo_id, solicitud_id, fecha_clase, estado, modificado_por)
            VALUES (...), (...)
            ON CONFLICT (grupo_id, solicitud_id, fecha_clase)
            DO UPDATE SET estado = EXCLUDED.estado,
                          modificado_por = EXCLUDED.modificado_por,
                          fecha_modificacion = now();

        Fase 8: reenviar la misma toma (reintento de la sincronización offline, doble clic, dos
        pestañas) nunca duplica filas; la última escritura deja el estado vigente.
        """
        filas = [
            {
                "grupo_id": grupo_id,
                "solicitud_id": solicitud_id,
                "fecha_clase": fecha_clase,
                "estado": estado,
                "modificado_por": usuario_id,
            }
            for solicitud_id, estado in estados
        ]
        if not filas:
            return 0
        stmt = insert(AsistenciaEstudiante).values(filas)
        stmt = stmt.on_conflict_do_update(
            index_elements=[
                AsistenciaEstudiante.grupo_id,
                AsistenciaEstudiante.solicitud_id,
                AsistenciaEstudiante.fecha_clase,
            ],
            set_={
                "estado": stmt.excluded.estado,
                "modificado_por": stmt.excluded.modificado_por,
                "fecha_modificacion": func.now(),
            },
        )
        self._db.execute(stmt)
        return len(filas)

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()
