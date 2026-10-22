"""
Repositorio de categorías y programas (Fase 5).

No hace commit por su cuenta: el servicio confirma después de validar las reglas
que dependen de los bloqueos tomados aquí.
"""

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config.roles import MAESTRO, nombres_de_rol
from app.models.programa_model import Categoria, Programa
from app.models.solicitud_model import ESTADO_APROBADO, ESTADO_PENDIENTE, SolicitudInscripcion
from app.models.user_model import Role, Usuario

# Estados que cuentan como estudiante activo en un programa.
ESTADOS_ACTIVOS = (ESTADO_PENDIENTE, ESTADO_APROBADO)


class ProgramaRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    # ---- Categorías ------------------------------------------------------------
    def list_categorias(self, *, solo_activas: bool = False) -> list[Categoria]:
        stmt = (
            select(Categoria)
            .options(selectinload(Categoria.programas).selectinload(Programa.maestro))
            .order_by(Categoria.nombre)
        )
        if solo_activas:
            stmt = stmt.where(Categoria.activo.is_(True))
        return list(self._db.scalars(stmt))

    def get_categoria(self, categoria_id: int, *, bloquear: bool = False) -> Categoria | None:
        stmt = select(Categoria).where(Categoria.id == categoria_id)
        if bloquear:
            # Serializa con las radicaciones (FOR SHARE en SolicitudRepository) y con otros cambios de estado.
            stmt = stmt.with_for_update()
        return self._db.scalar(stmt)

    def categoria_nombre_en_uso(self, nombre: str) -> bool:
        stmt = select(Categoria.id).where(func.lower(Categoria.nombre) == nombre.lower()).limit(1)
        return self._db.scalar(stmt) is not None

    # ---- Programas -------------------------------------------------------------
    def list_programas(self, categoria_id: int | None = None) -> list[Programa]:
        stmt = select(Programa).options(selectinload(Programa.maestro)).order_by(Programa.programa)
        if categoria_id is not None:
            stmt = stmt.where(Programa.categoria_id == categoria_id)
        return list(self._db.scalars(stmt))

    def get_programa(self, programa_id: int, *, bloquear: bool = False) -> Programa | None:
        stmt = select(Programa).where(Programa.id == programa_id)
        if bloquear:
            stmt = stmt.with_for_update()
        return self._db.scalar(stmt)

    def programa_nombre_en_uso(self, nombre: str, excluir_id: int | None = None) -> Programa | None:
        stmt = select(Programa).where(func.lower(Programa.programa) == nombre.lower())
        if excluir_id is not None:
            stmt = stmt.where(Programa.id != excluir_id)
        return self._db.scalar(stmt.limit(1))

    # ---- Métricas ---------------------------------------------------------------
    def estudiantes_activos(self, programa_ids: Iterable[int] | None = None) -> dict[int, int]:
        """{programa_id: solicitudes PENDIENTE/APROBADO}. Sin ids, cuenta todos los programas."""
        stmt = (
            select(SolicitudInscripcion.programa_id, func.count())
            .where(SolicitudInscripcion.estado.in_(ESTADOS_ACTIVOS))
            .group_by(SolicitudInscripcion.programa_id)
        )
        if programa_ids is not None:
            stmt = stmt.where(SolicitudInscripcion.programa_id.in_(list(programa_ids)))
        return {programa_id: total for programa_id, total in self._db.execute(stmt)}

    def total_solicitudes(self, programa_id: int) -> int:
        stmt = select(func.count()).where(SolicitudInscripcion.programa_id == programa_id)
        return self._db.scalar(stmt) or 0

    # ---- Maestros ---------------------------------------------------------------
    def list_maestros(self) -> list[Usuario]:
        stmt = (
            select(Usuario)
            .join(Usuario.rol)
            .where(func.lower(Role.nom_role).in_(nombres_de_rol(frozenset({MAESTRO}))))
            .order_by(Usuario.state.desc(), Usuario.nombre_com)
        )
        return list(self._db.scalars(stmt).unique())

    def get_usuario(self, usuario_id: int) -> Usuario | None:
        return self._db.get(Usuario, usuario_id)

    # ---- Escritura y transacción --------------------------------------------------
    def add(self, entidad: Categoria | Programa) -> None:
        self._db.add(entidad)

    def delete(self, programa: Programa) -> None:
        self._db.delete(programa)

    def flush(self) -> None:
        self._db.flush()

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def refresh(self, entidad: Categoria | Programa) -> None:
        self._db.refresh(entidad)
