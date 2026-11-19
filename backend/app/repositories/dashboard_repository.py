"""
Repositorio del panel general por rol (Fase 9).

Solo lectura. Las métricas del Maestro se filtran por sus programas en tbl_programa_maestro.
"""

from sqlalchemy import Select, exists, func, select
from sqlalchemy.orm import Session, selectinload

from app.config.roles import MAESTRO, nombres_de_rol
from app.models.asistencia_model import ESTADO_AUSENTE, ESTADO_PRESENTE, AsistenciaEstudiante
from app.models.grupo_model import Grupo, GrupoEstudiante
from app.models.programa_model import Categoria, Programa, programa_maestro
from app.models.solicitud_model import ESTADO_APROBADO, SolicitudInscripcion
from app.models.user_model import Role, Usuario


def _programas_del_maestro(maestro_id: int) -> Select:
    return select(programa_maestro.c.programa_id).where(programa_maestro.c.maestro_id == maestro_id)


def _grupos_del_maestro(maestro_id: int) -> Select:
    return select(Grupo.id).where(Grupo.programa_id.in_(_programas_del_maestro(maestro_id)))


class DashboardRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    # ---- Administrador ----------------------------------------------------------
    def programas_activos(self) -> int:
        """Programas cuya categoría está activa (los que ofrece el formulario público)."""
        stmt = (
            select(func.count(Programa.id))
            .join(Categoria, Categoria.id == Programa.categoria_id)
            .where(Categoria.activo.is_(True))
        )
        return self._db.scalar(stmt) or 0

    def total_grupos(self) -> int:
        return self._db.scalar(select(func.count(Grupo.id))) or 0

    def maestros_activos(self) -> int:
        stmt = (
            select(func.count(Usuario.id))
            .join(Role, Role.id == Usuario.tipo_role)
            .where(func.lower(Role.nom_role).in_(nombres_de_rol(frozenset({MAESTRO}))), Usuario.state.is_(True))
        )
        return self._db.scalar(stmt) or 0

    # ---- Maestro ------------------------------------------------------------------
    def estudiantes_asignados(self, maestro_id: int) -> int:
        """Estudiantes distintos con vínculo activo en los grupos de sus programas."""
        stmt = select(func.count(func.distinct(GrupoEstudiante.solicitud_id))).where(
            GrupoEstudiante.activo.is_(True),
            GrupoEstudiante.grupo_id.in_(_grupos_del_maestro(maestro_id)),
        )
        return self._db.scalar(stmt) or 0

    def estudiantes_sin_asignacion(self, maestro_id: int) -> int:
        """Solicitudes APROBADO de sus programas sin vínculo activo en ningún grupo."""
        vinculo_activo = exists().where(
            GrupoEstudiante.solicitud_id == SolicitudInscripcion.id, GrupoEstudiante.activo.is_(True)
        )
        stmt = select(func.count(SolicitudInscripcion.id)).where(
            SolicitudInscripcion.estado == ESTADO_APROBADO,
            SolicitudInscripcion.programa_id.in_(_programas_del_maestro(maestro_id)),
            ~vinculo_activo,
        )
        return self._db.scalar(stmt) or 0

    def asistencias_por_estado(self, maestro_id: int) -> dict[str, int]:
        """{estado: registros} de PRESENTE y AUSENTE en sus grupos."""
        stmt = (
            select(AsistenciaEstudiante.estado, func.count(AsistenciaEstudiante.id))
            .where(
                AsistenciaEstudiante.grupo_id.in_(_grupos_del_maestro(maestro_id)),
                AsistenciaEstudiante.estado.in_((ESTADO_PRESENTE, ESTADO_AUSENTE)),
            )
            .group_by(AsistenciaEstudiante.estado)
        )
        return {estado: total for estado, total in self._db.execute(stmt)}

    def grupos_con_horario(self, maestro_id: int) -> list[Grupo]:
        stmt = (
            select(Grupo)
            .options(selectinload(Grupo.programa), selectinload(Grupo.horarios))
            .where(Grupo.programa_id.in_(_programas_del_maestro(maestro_id)))
            .order_by(Grupo.nombre)
        )
        return list(self._db.scalars(stmt))

    def estudiantes_por_grupo(self, grupo_ids: list[int]) -> dict[int, int]:
        if not grupo_ids:
            return {}
        stmt = (
            select(GrupoEstudiante.grupo_id, func.count())
            .where(GrupoEstudiante.grupo_id.in_(grupo_ids), GrupoEstudiante.activo.is_(True))
            .group_by(GrupoEstudiante.grupo_id)
        )
        return {grupo_id: total for grupo_id, total in self._db.execute(stmt)}
