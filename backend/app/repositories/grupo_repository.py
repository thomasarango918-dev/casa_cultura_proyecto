"""
Repositorio de grupos (Fase 6).

No hace commit por su cuenta: el servicio confirma después de validar los permisos
y las reglas que dependen de los bloqueos tomados aquí.
"""

from collections.abc import Iterable

from sqlalchemy import exists, func, select, update
from sqlalchemy.orm import Session, lazyload, selectinload

from app.models.grupo_model import Grupo, GrupoEstudiante
from app.models.programa_model import Programa, programa_maestro
from app.models.solicitud_model import ESTADO_APROBADO, SolicitudInscripcion


class GrupoRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    # ---- Alcance del maestro ------------------------------------------------------
    def programas_del_maestro(self, maestro_id: int) -> set[int]:
        stmt = select(programa_maestro.c.programa_id).where(programa_maestro.c.maestro_id == maestro_id)
        return set(self._db.scalars(stmt))

    # ---- Grupos ---------------------------------------------------------------------
    def list_grupos(self, programa_ids: Iterable[int] | None = None) -> list[Grupo]:
        stmt = (
            select(Grupo)
            .join(Grupo.programa)
            .options(selectinload(Grupo.programa).selectinload(Programa.maestros))
            .order_by(Programa.programa, Grupo.nombre)
        )
        if programa_ids is not None:
            stmt = stmt.where(Grupo.programa_id.in_(list(programa_ids)))
        return list(self._db.scalars(stmt))

    def get_grupo(self, grupo_id: int, *, bloquear: bool = False) -> Grupo | None:
        stmt = select(Grupo).options(selectinload(Grupo.programa).selectinload(Programa.maestros)).where(
            Grupo.id == grupo_id
        )
        if bloquear:
            # Serializa asignar con eliminar: así no se borra un grupo mientras recibe estudiantes.
            stmt = stmt.with_for_update(of=Grupo)
        return self._db.scalar(stmt)

    def nombre_en_uso(self, programa_id: int, nombre: str, excluir_id: int | None = None) -> bool:
        stmt = select(Grupo.id).where(Grupo.programa_id == programa_id, func.lower(Grupo.nombre) == nombre.lower())
        if excluir_id is not None:
            stmt = stmt.where(Grupo.id != excluir_id)
        return self._db.scalar(stmt.limit(1)) is not None

    def estudiantes_activos(self, grupo_ids: Iterable[int]) -> dict[int, int]:
        stmt = (
            select(GrupoEstudiante.grupo_id, func.count())
            .where(GrupoEstudiante.activo.is_(True), GrupoEstudiante.grupo_id.in_(list(grupo_ids)))
            .group_by(GrupoEstudiante.grupo_id)
        )
        return {grupo_id: total for grupo_id, total in self._db.execute(stmt)}

    # ---- Programas ------------------------------------------------------------------
    def list_programas(self, programa_ids: Iterable[int] | None = None) -> list[Programa]:
        stmt = select(Programa).options(selectinload(Programa.categoria)).order_by(Programa.programa)
        if programa_ids is not None:
            stmt = stmt.where(Programa.id.in_(list(programa_ids)))
        return list(self._db.scalars(stmt))

    def get_programa(self, programa_id: int) -> Programa | None:
        return self._db.scalar(
            select(Programa).options(selectinload(Programa.maestros)).where(Programa.id == programa_id)
        )

    # ---- Estudiantes ------------------------------------------------------------------
    def solicitudes_disponibles(self, grupo: Grupo, solicitud_ids: Iterable[int] | None = None) -> list[SolicitudInscripcion]:
        """Solicitudes APROBADAS del programa del grupo que no están activas en él."""
        ya_en_grupo = exists().where(
            GrupoEstudiante.grupo_id == grupo.id,
            GrupoEstudiante.solicitud_id == SolicitudInscripcion.id,
            GrupoEstudiante.activo.is_(True),
        )
        stmt = (
            select(SolicitudInscripcion)
            # Los listados de estudiantes no usan los adjuntos (selectin por defecto).
            .options(lazyload(SolicitudInscripcion.documentos))
            .where(
                SolicitudInscripcion.estado == ESTADO_APROBADO,
                SolicitudInscripcion.programa_id == grupo.programa_id,
                ~ya_en_grupo,
            )
            .order_by(SolicitudInscripcion.apellidos, SolicitudInscripcion.nombres)
        )
        if solicitud_ids is not None:
            stmt = stmt.where(SolicitudInscripcion.id.in_(list(solicitud_ids)))
        return list(self._db.scalars(stmt).unique())

    def estudiantes_del_grupo(self, grupo_id: int) -> list[GrupoEstudiante]:
        stmt = (
            select(GrupoEstudiante)
            .join(GrupoEstudiante.solicitud)
            .options(selectinload(GrupoEstudiante.solicitud).lazyload(SolicitudInscripcion.documentos))
            .where(GrupoEstudiante.grupo_id == grupo_id, GrupoEstudiante.activo.is_(True))
            .order_by(SolicitudInscripcion.apellidos, SolicitudInscripcion.nombres)
        )
        return list(self._db.scalars(stmt))

    def desvincular(self, grupo_id: int, solicitud_id: int) -> int:
        stmt = (
            update(GrupoEstudiante)
            .where(
                GrupoEstudiante.grupo_id == grupo_id,
                GrupoEstudiante.solicitud_id == solicitud_id,
                GrupoEstudiante.activo.is_(True),
            )
            .values(activo=False, fecha_desvinculacion=func.now())
        )
        return self._db.execute(stmt).rowcount

    # ---- Escritura y transacción ------------------------------------------------------
    def add(self, entidad: Grupo | GrupoEstudiante) -> None:
        self._db.add(entidad)

    def add_all(self, entidades: Iterable[GrupoEstudiante]) -> None:
        self._db.add_all(list(entidades))

    def delete(self, grupo: Grupo) -> None:
        self._db.delete(grupo)

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def refresh(self, entidad: Grupo) -> None:
        self._db.refresh(entidad)
