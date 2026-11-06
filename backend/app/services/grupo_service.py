"""
Servicio de grupos (Fase 6).

Permisos (el servicio recibe al usuario autenticado):
    Administrador  ve y gestiona todos los grupos.
    Coordinador    solo consulta; cualquier escritura -> 403.
    Maestro        ve y gestiona solo los grupos de sus programas (tbl_programa_maestro);
                   un grupo de otro programa -> 403.

Fase 6 (asistencias): el grupo guarda su horario semanal y las sesiones de clase se
calculan desde su creación hasta hoy, sin los festivos de Colombia.
"""

import logging
from collections.abc import Iterable
from datetime import date

from sqlalchemy.exc import IntegrityError

from app.config.roles import ADMINISTRADOR, MAESTRO, clave_rol
from app.models.grupo_model import Grupo, GrupoEstudiante, GrupoHorario
from app.models.user_model import Usuario
from app.repositories.grupo_repository import GrupoRepository
from app.schemas.grupo_schema import (
    AsignacionOut,
    EstudianteDisponibleOut,
    EstudianteGrupoOut,
    FestivoOut,
    GrupoCreate,
    GrupoOut,
    GrupoUpdate,
    HorarioIn,
    HorarioOut,
    ProgramaGrupoOut,
    SesionesClaseOut,
)
from app.schemas.programa_schema import MaestroResumenOut
from app.utils.exceptions import DatosInvalidosError, PermisoDenegadoError, RecursoNoEncontradoError
from app.utils.festivos_colombia import fechas_de_clase, hoy_colombia

logger = logging.getLogger("casacultura.grupos")

_SIN_PERMISO_GRUPO = "Solo puede gestionar los grupos de los programas que tiene asignados."


def _to_grupo_out(grupo: Grupo, activos: dict[int, int]) -> GrupoOut:
    return GrupoOut(
        id=grupo.id,
        nombre=grupo.nombre,
        programa_id=grupo.programa_id,
        programa_nombre=grupo.programa.programa,
        maestros=[MaestroResumenOut(id=m.id, nombre_completo=m.nombre_com) for m in grupo.programa.maestros],
        estudiantes_activos=activos.get(grupo.id, 0),
        fecha_creacion=grupo.fecha_creacion,
        horarios=[
            HorarioOut(dia_semana=h.dia_semana, hora_inicio=h.hora_inicio, hora_fin=h.hora_fin) for h in grupo.horarios
        ],
    )


def _bloques(horarios: Iterable[HorarioIn]) -> list[GrupoHorario]:
    return [GrupoHorario(dia_semana=h.dia_semana, hora_inicio=h.hora_inicio, hora_fin=h.hora_fin) for h in horarios]


def sesiones_de_clase(grupo: Grupo) -> SesionesClaseOut:
    """Fechas de clase del grupo desde su creación hasta hoy (Colombia), omitiendo los festivos.

    También la usa el módulo de asistencias para armar las columnas de la matriz.
    """
    desde, hasta = grupo.fecha_creacion.date(), hoy_colombia()
    sesiones, festivos = fechas_de_clase(desde, hasta, (h.dia_semana for h in grupo.horarios))
    return SesionesClaseOut(
        grupo_id=grupo.id,
        desde=desde,
        hasta=hasta,
        sesiones=sesiones,
        festivos_omitidos=[FestivoOut(fecha=fecha, nombre=nombre) for fecha, nombre in festivos],
    )


class GrupoService:
    def __init__(self, repository: GrupoRepository, usuario: Usuario) -> None:
        self._repository = repository
        self._usuario = usuario
        self._rol = clave_rol(usuario.rol.nom_role)
        self._programas_maestro: set[int] | None = None

    # ---- Permisos -----------------------------------------------------------------
    def _alcance(self) -> set[int] | None:
        """Programas visibles: None = todos (Administrador y Coordinador)."""
        if self._rol != MAESTRO:
            return None
        if self._programas_maestro is None:
            self._programas_maestro = self._repository.programas_del_maestro(self._usuario.id)
        return self._programas_maestro

    def _exigir_gestion(self, programa_id: int) -> None:
        if self._rol not in (ADMINISTRADOR, MAESTRO):
            raise PermisoDenegadoError("Su rol solo permite consultar los grupos.")
        alcance = self._alcance()
        if alcance is not None and programa_id not in alcance:
            raise PermisoDenegadoError(_SIN_PERMISO_GRUPO)

    def _grupo(self, grupo_id: int, *, gestionar: bool, bloquear: bool = False) -> Grupo:
        grupo = self._repository.get_grupo(grupo_id, bloquear=bloquear)
        if grupo is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("El grupo no existe.")
        try:
            if gestionar:
                self._exigir_gestion(grupo.programa_id)
            elif (alcance := self._alcance()) is not None and grupo.programa_id not in alcance:
                raise PermisoDenegadoError(_SIN_PERMISO_GRUPO)
        except PermisoDenegadoError:
            self._repository.rollback()
            raise
        return grupo

    # ---- Consultas --------------------------------------------------------------------
    def listar(self) -> list[GrupoOut]:
        grupos = self._repository.list_grupos(self._alcance())
        activos = self._repository.estudiantes_activos(grupo.id for grupo in grupos)
        return [_to_grupo_out(grupo, activos) for grupo in grupos]

    def programas_disponibles(self) -> list[ProgramaGrupoOut]:
        if self._rol not in (ADMINISTRADOR, MAESTRO):
            raise PermisoDenegadoError("Su rol solo permite consultar los grupos.")
        return [
            ProgramaGrupoOut(
                id=programa.id,
                nombre=programa.programa,
                categoria_nombre=programa.categoria.nombre if programa.categoria else None,
            )
            for programa in self._repository.list_programas(self._alcance())
        ]

    def estudiantes_disponibles(self, grupo_id: int) -> list[EstudianteDisponibleOut]:
        grupo = self._grupo(grupo_id, gestionar=True)
        return [
            EstudianteDisponibleOut(
                solicitud_id=solicitud.id,
                nombre_completo=solicitud.nombre_completo,
                tipo_documento=solicitud.tipo_documento,
                numero_documento=solicitud.numero_documento,
                numero_radicado=solicitud.numero_radicado,
            )
            for solicitud in self._repository.solicitudes_disponibles(grupo)
        ]

    def estudiantes(self, grupo_id: int) -> list[EstudianteGrupoOut]:
        self._grupo(grupo_id, gestionar=False)
        return [
            EstudianteGrupoOut(
                solicitud_id=vinculo.solicitud_id,
                nombre_completo=vinculo.solicitud.nombre_completo,
                tipo_documento=vinculo.solicitud.tipo_documento,
                numero_documento=vinculo.solicitud.numero_documento,
                fecha_ingreso=vinculo.fecha_ingreso,
            )
            for vinculo in self._repository.estudiantes_del_grupo(grupo_id)
        ]

    def sesiones_clase(self, grupo_id: int) -> SesionesClaseOut:
        return sesiones_de_clase(self._grupo(grupo_id, gestionar=False))

    # ---- Grupos -------------------------------------------------------------------------
    def crear(self, data: GrupoCreate) -> GrupoOut:
        programa = self._repository.get_programa(data.programa_id)
        if programa is None:
            raise DatosInvalidosError("El programa seleccionado no existe.")
        self._exigir_gestion(programa.id)
        self._nombre_libre(programa.id, data.nombre)

        grupo = Grupo(nombre=data.nombre, programa_id=programa.id, horarios=_bloques(data.horarios))
        self._repository.add(grupo)
        self._commit(f"Ya existe un grupo llamado «{data.nombre}» en {programa.programa}.")
        self._repository.refresh(grupo)
        logger.info("Grupo creado: %s (id=%s, programa=%s)", grupo.nombre, grupo.id, programa.id)
        return _to_grupo_out(grupo, {})

    def actualizar(self, grupo_id: int, data: GrupoUpdate) -> GrupoOut:
        grupo = self._grupo(grupo_id, gestionar=True)
        self._nombre_libre(grupo.programa_id, data.nombre, excluir_id=grupo.id)
        grupo.nombre = data.nombre
        if data.horarios is not None:
            # delete-orphan borra los bloques anteriores; el horario se reemplaza completo.
            grupo.horarios = _bloques(data.horarios)
        self._commit(f"Ya existe un grupo llamado «{data.nombre}» en {grupo.programa.programa}.")
        self._repository.refresh(grupo)
        return _to_grupo_out(grupo, self._repository.estudiantes_activos([grupo.id]))

    def eliminar(self, grupo_id: int) -> None:
        grupo = self._grupo(grupo_id, gestionar=True, bloquear=True)
        activos = self._repository.estudiantes_activos([grupo.id]).get(grupo.id, 0)
        if activos:
            self._repository.rollback()
            raise DatosInvalidosError(
                f"No se puede eliminar «{grupo.nombre}»: tiene {activos} "
                f"estudiante{'' if activos == 1 else 's'} asignado{'' if activos == 1 else 's'}."
            )
        nombre = grupo.nombre
        self._repository.delete(grupo)
        self._commit(f"No se puede eliminar «{nombre}»: tiene registros asociados (por ejemplo, sesiones de clase).")
        logger.info("Grupo eliminado: %s (id=%s)", nombre, grupo_id)

    # ---- Estudiantes ----------------------------------------------------------------------
    def asignar(self, grupo_id: int, solicitudes_ids: list[int]) -> AsignacionOut:
        grupo = self._grupo(grupo_id, gestionar=True, bloquear=True)
        disponibles = self._repository.solicitudes_disponibles(grupo, solicitudes_ids)
        if len(disponibles) != len(solicitudes_ids):
            self._repository.rollback()
            faltan = len(solicitudes_ids) - len(disponibles)
            raise DatosInvalidosError(
                f"{faltan} de los estudiantes seleccionados ya no se puede{'' if faltan == 1 else 'n'} asignar: "
                "ya están en el grupo o su solicitud no está aprobada en este programa. Recargue la lista."
            )
        self._repository.add_all(GrupoEstudiante(grupo_id=grupo.id, solicitud_id=s.id) for s in disponibles)
        self._commit("Alguno de los estudiantes ya fue asignado a este grupo. Recargue la lista.")
        logger.info("Grupo %s: %s estudiante(s) asignado(s)", grupo.id, len(disponibles))
        return AsignacionOut(asignados=len(disponibles))

    def desasignar(self, grupo_id: int, solicitud_id: int) -> None:
        grupo = self._grupo(grupo_id, gestionar=True)
        if not self._repository.desvincular(grupo.id, solicitud_id):
            self._repository.rollback()
            raise RecursoNoEncontradoError("El estudiante no está asignado a este grupo.")
        self._repository.commit()
        logger.info("Grupo %s: solicitud %s desvinculada", grupo.id, solicitud_id)

    # ---- Utilidades -------------------------------------------------------------------------
    def _nombre_libre(self, programa_id: int, nombre: str, excluir_id: int | None = None) -> None:
        if self._repository.nombre_en_uso(programa_id, nombre, excluir_id):
            raise DatosInvalidosError(f"Ya existe un grupo llamado «{nombre}» en este programa.")

    def _commit(self, mensaje_conflicto: str) -> None:
        """Una carrera (nombre repetido, asignación doble, FK) llega como IntegrityError: se responde 400."""
        try:
            self._repository.commit()
        except IntegrityError as exc:
            self._repository.rollback()
            raise DatosInvalidosError(mensaje_conflicto) from exc
