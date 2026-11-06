"""Capa Servicio (MVC): estadísticas contextuales del BackOffice (Fase 7, solo lectura)."""

from app.config.roles import MAESTRO, clave_rol
from app.models.solicitud_model import ESTADO_APROBADO, ESTADO_PENDIENTE, ESTADO_RECHAZADO
from app.models.user_model import Usuario
from app.repositories.estadistica_repository import EstadisticaRepository
from app.schemas.estadistica_schema import (
    AprobadosPorProgramaOut,
    EstudiantesPorCategoriaOut,
    MaestroEstadisticaOut,
    OcupacionGrupoOut,
    SolicitudesPorEstadoOut,
)
from app.utils.exceptions import PermisoDenegadoError, RecursoNoEncontradoError

# Orden fijo de los estados en la respuesta (y en la leyenda del gráfico).
_ORDEN_ESTADOS = (ESTADO_APROBADO, ESTADO_PENDIENTE, ESTADO_RECHAZADO)

SIN_CATEGORIA = "Sin categoría"


def _to_maestro_out(usuario: Usuario) -> MaestroEstadisticaOut:
    return MaestroEstadisticaOut(id=usuario.id, nombre_completo=usuario.nombre_com, activo=usuario.state)


class EstadisticaService:
    def __init__(self, repository: EstadisticaRepository) -> None:
        self._repository = repository

    def solicitudes(self) -> list[SolicitudesPorEstadoOut]:
        conteos = self._repository.solicitudes_por_estado()
        return [SolicitudesPorEstadoOut(estado=estado, total=conteos.get(estado, 0)) for estado in _ORDEN_ESTADOS]

    def categorias(self) -> list[EstudiantesPorCategoriaOut]:
        """Una columna por categoría con todos sus programas (los nuevos aparecen en 0 hasta tener aprobados)."""
        programas_por_categoria: dict[int | None, list[AprobadosPorProgramaOut]] = {}
        for programa_id, programa, categoria_id, total in self._repository.aprobados_por_programa():
            programas_por_categoria.setdefault(categoria_id, []).append(
                AprobadosPorProgramaOut(programa_id=programa_id, programa=programa, total=total)
            )

        columnas = [
            (categoria_id, nombre, activa, programas_por_categoria.get(categoria_id, []))
            for categoria_id, nombre, activa in self._repository.categorias()
        ]
        # Programas con categoria_id NULL: se muestran aparte para no perder estudiantes.
        if None in programas_por_categoria:
            columnas.append((None, SIN_CATEGORIA, True, programas_por_categoria[None]))

        filas = [
            EstudiantesPorCategoriaOut(
                categoria_id=categoria_id,
                categoria=nombre,
                activa=activa,
                total=sum(programa.total for programa in programas),
                programas=programas,
            )
            for categoria_id, nombre, activa, programas in columnas
        ]
        return sorted(filas, key=lambda fila: (-fila.total, fila.categoria))

    def maestros(self, usuario: Usuario) -> list[MaestroEstadisticaOut]:
        """Opciones del filtro: el Maestro solo se ve a sí mismo; Administrador y Coordinador ven a todos."""
        if clave_rol(usuario.rol.nom_role) == MAESTRO:
            return [_to_maestro_out(usuario)]
        return [_to_maestro_out(maestro) for maestro in self._repository.maestros()]

    def ocupacion_grupos(self, maestro_id: int, usuario: Usuario) -> list[OcupacionGrupoOut]:
        if clave_rol(usuario.rol.nom_role) == MAESTRO and maestro_id != usuario.id:
            raise PermisoDenegadoError("Solo puede consultar las estadísticas de sus propios grupos.")
        if self._repository.get_maestro(maestro_id) is None:
            raise RecursoNoEncontradoError("El maestro seleccionado no existe.")
        return [
            OcupacionGrupoOut(grupo_id=grupo_id, grupo=grupo, programa=programa, total=total)
            for grupo_id, grupo, programa, total in self._repository.ocupacion_grupos(maestro_id)
        ]
