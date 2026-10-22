"""
Servicio de categorías y programas (Fase 5).

"Estudiante activo" = solicitud PENDIENTE o APROBADO. Con estudiantes activos:
    - no se deshabilita la categoría (dejarían de ver su programa en la oferta);
    - no se elimina el programa.
"""

import logging

from sqlalchemy.exc import IntegrityError

from app.config.roles import MAESTRO, clave_rol
from app.models.programa_model import Categoria, Programa
from app.models.user_model import Usuario
from app.repositories.programa_repository import ProgramaRepository
from app.schemas.programa_schema import (
    CategoriaCreate,
    CategoriaOut,
    CategoriaPublicaOut,
    MaestroOut,
    ProgramaCreate,
    ProgramaGestionOut,
    ProgramaUpdate,
)
from app.schemas.solicitud_schema import ProgramaOut
from app.utils.exceptions import DatosInvalidosError, RecursoNoEncontradoError

logger = logging.getLogger("casacultura.programas")


def _plural(total: int, singular: str, plural: str) -> str:
    return f"{total} {singular if total == 1 else plural}"


def to_programa_out(programa: Programa, activos: dict[int, int]) -> ProgramaGestionOut:
    return ProgramaGestionOut(
        id=programa.id,
        nombre=programa.programa,
        categoria_id=programa.categoria_id,
        maestro_id=programa.maestro_id,
        maestro_nombre=programa.maestro.nombre_com if programa.maestro else None,
        estudiantes_inscritos=activos.get(programa.id, 0),
    )


def to_categoria_out(categoria: Categoria, activos: dict[int, int]) -> CategoriaOut:
    programas = [to_programa_out(programa, activos) for programa in categoria.programas]
    return CategoriaOut(
        id=categoria.id,
        nombre=categoria.nombre,
        descripcion=categoria.descripcion,
        activo=categoria.activo,
        estudiantes_inscritos=sum(programa.estudiantes_inscritos for programa in programas),
        programas=programas,
    )


class ProgramaService:
    def __init__(self, repository: ProgramaRepository) -> None:
        self._repository = repository

    # ---- Consultas ---------------------------------------------------------------
    def listar_categorias(self) -> list[CategoriaOut]:
        activos = self._repository.estudiantes_activos()
        return [to_categoria_out(categoria, activos) for categoria in self._repository.list_categorias()]

    def listar_programas(self, categoria_id: int | None = None) -> list[ProgramaGestionOut]:
        programas = self._repository.list_programas(categoria_id)
        activos = self._repository.estudiantes_activos(programa.id for programa in programas)
        return [to_programa_out(programa, activos) for programa in programas]

    def listar_maestros(self) -> list[MaestroOut]:
        return [
            MaestroOut(id=u.id, nombre_completo=u.nombre_com, num_documento=u.num_documento, activo=u.state)
            for u in self._repository.list_maestros()
        ]

    def catalogo_publico(self) -> list[CategoriaPublicaOut]:
        """Categorías activas con al menos un programa; las vacías no le sirven al aspirante."""
        return [
            CategoriaPublicaOut(
                id=categoria.id,
                nombre=categoria.nombre,
                descripcion=categoria.descripcion,
                programas=[ProgramaOut.model_validate(programa) for programa in categoria.programas],
            )
            for categoria in self._repository.list_categorias(solo_activas=True)
            if categoria.programas
        ]

    # ---- Categorías ----------------------------------------------------------------
    def crear_categoria(self, data: CategoriaCreate) -> CategoriaOut:
        if self._repository.categoria_nombre_en_uso(data.nombre):
            raise DatosInvalidosError(f"Ya existe una categoría llamada «{data.nombre}».")
        categoria = Categoria(nombre=data.nombre, descripcion=data.descripcion, activo=True)
        self._repository.add(categoria)
        self._commit(f"Ya existe una categoría llamada «{data.nombre}».")
        self._repository.refresh(categoria)
        logger.info("Categoría creada: %s (id=%s)", categoria.nombre, categoria.id)
        return to_categoria_out(categoria, {})

    def cambiar_estado_categoria(self, categoria_id: int, activo: bool) -> CategoriaOut:
        categoria = self._repository.get_categoria(categoria_id, bloquear=True)
        if categoria is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("La categoría no existe.")

        activos = self._repository.estudiantes_activos(programa.id for programa in categoria.programas)
        if not activo and categoria.activo:
            ocupados = [
                f"{programa.programa} ({activos[programa.id]})"
                for programa in categoria.programas
                if activos.get(programa.id)
            ]
            if ocupados:
                self._repository.rollback()
                raise DatosInvalidosError(
                    f"No se puede deshabilitar «{categoria.nombre}»: tiene estudiantes activos "
                    f"(solicitudes pendientes o aprobadas) en {', '.join(ocupados)}."
                )

        categoria.activo = activo
        self._repository.commit()
        self._repository.refresh(categoria)
        logger.info("Categoría %s %s", categoria.id, "habilitada" if activo else "deshabilitada")
        return to_categoria_out(categoria, activos)

    # ---- Programas -----------------------------------------------------------------
    def _maestro_valido(self, maestro_id: int | None, actual_id: int | None = None) -> int | None:
        # Conservar el maestro vigente no se revalida: pudo desactivarse después de asignarlo.
        if maestro_id is None or maestro_id == actual_id:
            return maestro_id
        usuario: Usuario | None = self._repository.get_usuario(maestro_id)
        if usuario is None or clave_rol(usuario.rol.nom_role) != MAESTRO:
            raise DatosInvalidosError("El maestro seleccionado no existe o no tiene el rol Maestro.")
        if not usuario.state:
            raise DatosInvalidosError("El maestro seleccionado tiene la cuenta deshabilitada.")
        return maestro_id

    def _nombre_programa_libre(self, nombre: str, excluir_id: int | None = None) -> None:
        existente = self._repository.programa_nombre_en_uso(nombre, excluir_id)
        if existente is not None:
            categoria = f" (categoría {existente.categoria.nombre})" if existente.categoria else ""
            raise DatosInvalidosError(f"Ya existe un programa llamado «{existente.programa}»{categoria}.")

    def crear_programa(self, data: ProgramaCreate) -> ProgramaGestionOut:
        if self._repository.get_categoria(data.categoria_id) is None:
            raise DatosInvalidosError("La categoría seleccionada no existe.")
        self._nombre_programa_libre(data.nombre)
        programa = Programa(
            programa=data.nombre,
            categoria_id=data.categoria_id,
            maestro_id=self._maestro_valido(data.maestro_id),
        )
        self._repository.add(programa)
        self._commit(f"Ya existe un programa llamado «{data.nombre}».")
        self._repository.refresh(programa)
        logger.info("Programa creado: %s (id=%s)", programa.programa, programa.id)
        return to_programa_out(programa, {})

    def actualizar_programa(self, programa_id: int, data: ProgramaUpdate) -> ProgramaGestionOut:
        programa = self._repository.get_programa(programa_id)
        if programa is None:
            raise RecursoNoEncontradoError("El programa no existe.")
        self._nombre_programa_libre(data.nombre, excluir_id=programa.id)
        programa.maestro_id = self._maestro_valido(data.maestro_id, programa.maestro_id)
        programa.programa = data.nombre
        self._commit(f"Ya existe un programa llamado «{data.nombre}».")
        self._repository.refresh(programa)
        return to_programa_out(programa, self._repository.estudiantes_activos([programa.id]))

    def eliminar_programa(self, programa_id: int) -> None:
        # El bloqueo hace esperar a una radicación en curso sobre este programa.
        programa = self._repository.get_programa(programa_id, bloquear=True)
        if programa is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("El programa no existe.")

        activos = self._repository.estudiantes_activos([programa.id]).get(programa.id, 0)
        if activos:
            self._repository.rollback()
            raise DatosInvalidosError(
                f"No se puede eliminar «{programa.programa}»: tiene "
                f"{_plural(activos, 'estudiante activo', 'estudiantes activos')} (solicitudes pendientes o aprobadas)."
            )
        # Las solicitudes rechazadas son historial: borrarlas no es opción y la FK lo impediría.
        historial = self._repository.total_solicitudes(programa.id)
        if historial:
            self._repository.rollback()
            raise DatosInvalidosError(
                f"No se puede eliminar «{programa.programa}»: conserva "
                f"{_plural(historial, 'solicitud rechazada', 'solicitudes rechazadas')} en el historial."
            )

        nombre = programa.programa
        self._repository.delete(programa)
        self._commit(f"No se puede eliminar «{nombre}»: tiene registros asociados (por ejemplo, grupos).")
        logger.info("Programa eliminado: %s (id=%s)", nombre, programa_id)

    def _commit(self, mensaje_conflicto: str) -> None:
        """Una carrera con otra petición (nombre repetido, FK) llega como IntegrityError: se responde 400."""
        try:
            self._repository.commit()
        except IntegrityError as exc:
            self._repository.rollback()
            raise DatosInvalidosError(mensaje_conflicto) from exc
