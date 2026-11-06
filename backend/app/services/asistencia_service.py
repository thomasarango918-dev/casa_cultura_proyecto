"""
Servicio de asistencias (Fase 6).

Permisos (el servicio recibe al usuario autenticado):
    Administrador  toma y consulta la asistencia de todos los grupos.
    Maestro        solo la de los grupos de sus programas (tbl_programa_maestro); otro -> 403.
    (El Coordinador y el Estudiante no entran: la dependencia responde 403.)

Regla crítica: solo se guarda la asistencia de HOY (fecha de Colombia) y solo si hoy
es una sesión del grupo (día de su horario y no festivo). Cualquier otra fecha -> 400.
"""

import logging
from datetime import date

from app.config.roles import ADMINISTRADOR, MAESTRO, clave_rol
from app.models.grupo_model import Grupo
from app.models.user_model import Usuario
from app.repositories.asistencia_repository import AsistenciaRepository
from app.repositories.grupo_repository import GrupoRepository
from app.schemas.asistencia_schema import (
    AsistenciaGuardadaOut,
    EstudianteAsistenciaOut,
    GuardarAsistenciaRequest,
    MatrizAsistenciaOut,
)
from app.services.grupo_service import sesiones_de_clase
from app.utils.exceptions import DatosInvalidosError, PermisoDenegadoError, RecursoNoEncontradoError
from app.utils.festivos_colombia import hoy_colombia, nombre_festivo

logger = logging.getLogger("casacultura.asistencias")


class AsistenciaService:
    def __init__(self, repository: AsistenciaRepository, grupos: GrupoRepository, usuario: Usuario) -> None:
        self._repository = repository
        self._grupos = grupos
        self._usuario = usuario
        self._rol = clave_rol(usuario.rol.nom_role)

    # ---- Permisos -----------------------------------------------------------------
    def _grupo(self, grupo_id: int, *, bloquear: bool = False) -> Grupo:
        grupo = self._grupos.get_grupo(grupo_id, bloquear=bloquear)
        if grupo is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("El grupo no existe.")
        permitido = self._rol == ADMINISTRADOR or (
            self._rol == MAESTRO and grupo.programa_id in self._grupos.programas_del_maestro(self._usuario.id)
        )
        if not permitido:
            self._repository.rollback()
            raise PermisoDenegadoError("Solo puede tomar asistencia en los grupos de los programas que tiene asignados.")
        return grupo

    # ---- Consultas --------------------------------------------------------------------
    def matriz(self, grupo_id: int) -> MatrizAsistenciaOut:
        grupo = self._grupo(grupo_id)
        calendario = sesiones_de_clase(grupo)
        sesiones = set(calendario.sesiones)
        vinculos = self._grupos.estudiantes_del_grupo(grupo.id)

        estados: dict[int, dict[date, str]] = {vinculo.solicitud_id: {} for vinculo in vinculos}
        for registro in self._repository.registros(grupo.id, calendario.desde, calendario.hasta):
            # Solo estudiantes activos y fechas que siguen siendo sesiones (el horario pudo cambiar).
            if registro.solicitud_id in estados and registro.fecha_clase in sesiones:
                estados[registro.solicitud_id][registro.fecha_clase] = registro.estado

        return MatrizAsistenciaOut(
            grupo_id=grupo.id,
            grupo_nombre=grupo.nombre,
            programa_nombre=grupo.programa.programa,
            hoy=calendario.hasta,
            es_dia_de_clase=calendario.hasta in sesiones,
            sesiones=calendario.sesiones,
            festivos_omitidos=calendario.festivos_omitidos,
            estudiantes=[
                EstudianteAsistenciaOut(
                    solicitud_id=vinculo.solicitud_id,
                    nombre_completo=vinculo.solicitud.nombre_completo,
                    tipo_documento=vinculo.solicitud.tipo_documento,
                    numero_documento=vinculo.solicitud.numero_documento,
                    asistencias=estados[vinculo.solicitud_id],
                )
                for vinculo in vinculos
            ],
        )

    # ---- Registro -----------------------------------------------------------------------
    def guardar(self, grupo_id: int, data: GuardarAsistenciaRequest) -> AsistenciaGuardadaOut:
        hoy = hoy_colombia()
        if data.fecha_clase != hoy:
            raise DatosInvalidosError(
                f"Solo se puede registrar o modificar la asistencia del día de hoy ({hoy:%d/%m/%Y}). "
                "Las fechas pasadas y futuras son de solo lectura."
            )

        # El bloqueo serializa el guardado con la eliminación del grupo y la asignación de estudiantes.
        grupo = self._grupo(grupo_id, bloquear=True)
        if (festivo := nombre_festivo(hoy)) is not None:
            self._repository.rollback()
            raise DatosInvalidosError(f"Hoy es festivo ({festivo}): no hay clase.")
        if hoy.isoweekday() not in {h.dia_semana for h in grupo.horarios} or hoy < grupo.fecha_creacion.date():
            self._repository.rollback()
            raise DatosInvalidosError("Hoy no hay clase programada en el horario de este grupo.")

        activos = {vinculo.solicitud_id for vinculo in self._grupos.estudiantes_del_grupo(grupo.id)}
        ajenos = sum(1 for registro in data.registros if registro.solicitud_id not in activos)
        if ajenos:
            self._repository.rollback()
            plural = "" if ajenos == 1 else "n"
            raise DatosInvalidosError(
                f"{ajenos} de los estudiantes enviados ya no pertenece{plural} al grupo. Recargue la lista."
            )

        guardados = self._repository.guardar(
            grupo.id, hoy, ((r.solicitud_id, r.estado) for r in data.registros), self._usuario.id
        )
        self._repository.commit()
        logger.info("Asistencia guardada: grupo=%s fecha=%s registros=%s", grupo.id, hoy, guardados)
        return AsistenciaGuardadaOut(fecha_clase=hoy, guardados=guardados)
