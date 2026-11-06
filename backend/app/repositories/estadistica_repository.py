"""
Repositorio de estadísticas (Fase 7).

Solo lectura: consultas con GROUP BY y COUNT. No modifica datos ni el esquema.
"""

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.config.roles import MAESTRO, nombres_de_rol
from app.models.grupo_model import Grupo, GrupoEstudiante
from app.models.programa_model import Categoria, Programa, programa_maestro
from app.models.solicitud_model import ESTADO_APROBADO, SolicitudInscripcion
from app.models.user_model import Role, Usuario


class EstadisticaRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def solicitudes_por_estado(self) -> dict[str, int]:
        """{estado: total} de tbl_solicitudinscripcion; los estados sin solicitudes no aparecen."""
        stmt = select(SolicitudInscripcion.estado, func.count(SolicitudInscripcion.id)).group_by(
            SolicitudInscripcion.estado
        )
        return {estado: total for estado, total in self._db.execute(stmt)}

    def categorias(self) -> list[tuple[int, str, bool]]:
        """(id, nombre, activa) de todas las categorías."""
        stmt = select(Categoria.id, Categoria.nombre, Categoria.activo).order_by(Categoria.nombre)
        return [(row[0], row[1], row[2]) for row in self._db.execute(stmt)]

    def aprobados_por_programa(self) -> list[tuple[int, str, int | None, int]]:
        """(id, programa, categoria_id, aprobados) de TODOS los programas, incluidos los que tienen 0."""
        total = func.count(SolicitudInscripcion.id)
        stmt = (
            select(Programa.id, Programa.programa, Programa.categoria_id, total)
            # El filtro de estado va en el ON para no descartar los programas sin aprobados.
            .outerjoin(
                SolicitudInscripcion,
                and_(
                    SolicitudInscripcion.programa_id == Programa.id,
                    SolicitudInscripcion.estado == ESTADO_APROBADO,
                ),
            )
            .group_by(Programa.id, Programa.programa, Programa.categoria_id)
            .order_by(Programa.programa)
        )
        return [(row[0], row[1], row[2], row[3]) for row in self._db.execute(stmt)]

    def _filtro_maestro(self):
        return func.lower(Role.nom_role).in_(nombres_de_rol(frozenset({MAESTRO})))

    def maestros(self) -> list[Usuario]:
        """Usuarios con rol Maestro (alias Profesor/Docente): primero los activos, por nombre."""
        stmt = (
            select(Usuario)
            .join(Usuario.rol)
            .where(self._filtro_maestro())
            .order_by(Usuario.state.desc(), Usuario.nombre_com)
        )
        return list(self._db.scalars(stmt).unique())

    def get_maestro(self, maestro_id: int) -> Usuario | None:
        stmt = select(Usuario).join(Usuario.rol).where(Usuario.id == maestro_id, self._filtro_maestro())
        return self._db.scalars(stmt).unique().first()

    def ocupacion_grupos(self, maestro_id: int) -> list[tuple[int, str, str, int]]:
        """(id, grupo, programa, estudiantes activos) de los grupos de los programas del maestro.

        Un maestro maneja los grupos de los programas que tiene asignados en tbl_programa_maestro
        (la misma regla que aplica el módulo de grupos). Incluye los grupos vacíos.
        """
        total = func.count(GrupoEstudiante.id)
        stmt = (
            select(Grupo.id, Grupo.nombre, Programa.programa, total)
            .join(Programa, Grupo.programa_id == Programa.id)
            .join(
                programa_maestro,
                and_(programa_maestro.c.programa_id == Programa.id, programa_maestro.c.maestro_id == maestro_id),
            )
            .outerjoin(
                GrupoEstudiante,
                and_(GrupoEstudiante.grupo_id == Grupo.id, GrupoEstudiante.activo.is_(True)),
            )
            .group_by(Grupo.id, Grupo.nombre, Programa.programa)
            .order_by(total.desc(), Grupo.nombre)
        )
        return [(row[0], row[1], row[2], row[3]) for row in self._db.execute(stmt)]
