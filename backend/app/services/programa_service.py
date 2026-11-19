"""
Servicio de categorías y programas (Fase 5).

"Estudiante activo" = solicitud PENDIENTE o APROBADO. Con estudiantes activos:
    - no se deshabilita la categoría (dejarían de ver su programa en la oferta);
    - (Fase 10) los programas no se eliminan: se deshabilitan y conservan su historial.
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
    CategoriaUpdate,
    MaestroOut,
    MaestroResumenOut,
    ProgramaCreate,
    ProgramaGestionOut,
    ProgramaUpdate,
)
from app.schemas.solicitud_schema import ProgramaOut
from app.utils.exceptions import DatosInvalidosError, RecursoNoEncontradoError

logger = logging.getLogger("casacultura.programas")


def _plural(total: int, singular: str, plural: str) -> str:
    return f"{total} {singular if total == 1 else plural}"


def to_programa_out(
    programa: Programa, activos: dict[int, int], grupos: dict[int, int] | None = None
) -> ProgramaGestionOut:
    return ProgramaGestionOut(
        id=programa.id,
        nombre=programa.programa,
        categoria_id=programa.categoria_id,
        activo=programa.activo,
        maestros_ids=[maestro.id for maestro in programa.maestros],
        maestros=[MaestroResumenOut(id=m.id, nombre_completo=m.nombre_com) for m in programa.maestros],
        estudiantes_inscritos=activos.get(programa.id, 0),
        grupos_creados=(grupos or {}).get(programa.id, 0),
    )


def to_categoria_out(
    categoria: Categoria, activos: dict[int, int], grupos: dict[int, int] | None = None
) -> CategoriaOut:
    programas = [to_programa_out(programa, activos, grupos) for programa in categoria.programas]
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
        grupos = self._repository.grupos_por_programa()
        return [to_categoria_out(categoria, activos, grupos) for categoria in self._repository.list_categorias()]

    def listar_programas(self, categoria_id: int | None = None) -> list[ProgramaGestionOut]:
        programas = self._repository.list_programas(categoria_id)
        ids = [programa.id for programa in programas]
        activos = self._repository.estudiantes_activos(ids)
        grupos = self._repository.grupos_por_programa(ids)
        return [to_programa_out(programa, activos, grupos) for programa in programas]

    def listar_maestros(self) -> list[MaestroOut]:
        return [
            MaestroOut(id=u.id, nombre_completo=u.nombre_com, num_documento=u.num_documento, activo=u.state)
            for u in self._repository.list_maestros()
        ]

    def catalogo_publico(self) -> list[CategoriaPublicaOut]:
        """Categorías activas con al menos un programa activo; las vacías no le sirven al aspirante."""
        catalogo = []
        for categoria in self._repository.list_categorias(solo_activas=True):
            # Fase 10: los programas deshabilitados no se ofrecen.
            programas = [ProgramaOut.model_validate(p) for p in categoria.programas if p.activo]
            if programas:
                catalogo.append(
                    CategoriaPublicaOut(
                        id=categoria.id, nombre=categoria.nombre, descripcion=categoria.descripcion, programas=programas
                    )
                )
        return catalogo

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
        grupos = self._repository.grupos_por_programa(programa.id for programa in categoria.programas)
        return to_categoria_out(categoria, activos, grupos)

    def actualizar_categoria(self, categoria_id: int, data: CategoriaUpdate) -> CategoriaOut:
        """Fase 9: renombra la categoría. El catálogo público la lee en vivo, así que el cambio es inmediato."""
        categoria = self._repository.get_categoria(categoria_id, bloquear=True)
        if categoria is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("La categoría no existe.")
        if self._repository.categoria_nombre_en_uso(data.nombre, excluir_id=categoria.id):
            self._repository.rollback()
            raise DatosInvalidosError(f"Ya existe una categoría llamada «{data.nombre}».")

        categoria.nombre = data.nombre
        categoria.descripcion = data.descripcion
        self._commit(f"Ya existe una categoría llamada «{data.nombre}».")
        self._repository.refresh(categoria)
        logger.info("Categoría %s renombrada a %s", categoria.id, categoria.nombre)
        ids = [programa.id for programa in categoria.programas]
        return to_categoria_out(
            categoria, self._repository.estudiantes_activos(ids), self._repository.grupos_por_programa(ids)
        )

    def eliminar_categoria(self, categoria_id: int) -> None:
        """Fase 9: solo se elimina una categoría sin programas (activos o no).

        FOR UPDATE: un programa nuevo en esta categoría (su FK pide KEY SHARE) espera a que termine.
        """
        categoria = self._repository.get_categoria(categoria_id, bloquear=True)
        if categoria is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("La categoría no existe.")

        programas = self._repository.total_programas(categoria.id)
        if programas:
            self._repository.rollback()
            raise DatosInvalidosError(
                f"No se puede eliminar «{categoria.nombre}»: tiene "
                f"{_plural(programas, 'programa asociado', 'programas asociados')}. "
                "Elimine o reasigne sus programas primero."
            )

        nombre = categoria.nombre
        self._repository.delete(categoria)
        self._commit(f"No se puede eliminar «{nombre}»: tiene programas asociados.")
        logger.info("Categoría eliminada: %s (id=%s)", nombre, categoria_id)

    # ---- Programas -----------------------------------------------------------------
    def _maestros_validos(self, maestros_ids: list[int], actuales: list[Usuario] | None = None) -> list[Usuario]:
        """Usuarios de la lista, en el mismo orden. Los duplicados ya los rechazó el esquema."""
        if not maestros_ids:
            return []
        # Conservar un maestro vigente no se revalida: pudo desactivarse después de asignarlo.
        vigentes = {maestro.id for maestro in actuales or []}
        usuarios = {usuario.id: usuario for usuario in self._repository.get_usuarios(maestros_ids)}
        for maestro_id in maestros_ids:
            usuario = usuarios.get(maestro_id)
            if maestro_id in vigentes:
                continue
            if usuario is None or clave_rol(usuario.rol.nom_role) != MAESTRO:
                raise DatosInvalidosError("Uno de los maestros seleccionados no existe o no tiene el rol Maestro.")
            if not usuario.state:
                raise DatosInvalidosError(f"El maestro {usuario.nombre_com} tiene la cuenta deshabilitada.")
        return [usuarios[maestro_id] for maestro_id in maestros_ids]

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
            maestros=self._maestros_validos(data.maestros_ids),
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
        programa.maestros = self._maestros_validos(data.maestros_ids, programa.maestros)
        programa.programa = data.nombre
        self._commit(f"Ya existe un programa llamado «{data.nombre}».")
        self._repository.refresh(programa)
        return to_programa_out(
            programa,
            self._repository.estudiantes_activos([programa.id]),
            self._repository.grupos_por_programa([programa.id]),
        )

    def cambiar_estado_programa(self, programa_id: int, activo: bool) -> ProgramaGestionOut:
        """Fase 10: reemplaza la eliminación. Nunca hay DELETE: solicitudes, grupos y asistencias quedan intactos.

        FOR UPDATE: una radicación en curso (FOR SHARE) termina antes y la siguiente ya ve el estado nuevo.
        """
        programa = self._repository.get_programa(programa_id, bloquear=True)
        if programa is None:
            self._repository.rollback()
            raise RecursoNoEncontradoError("El programa no existe.")

        programa.activo = activo
        self._repository.commit()
        self._repository.refresh(programa)
        logger.info("Programa %s %s", programa.id, "habilitado" if activo else "deshabilitado")
        return to_programa_out(
            programa,
            self._repository.estudiantes_activos([programa.id]),
            self._repository.grupos_por_programa([programa.id]),
        )

    def _commit(self, mensaje_conflicto: str) -> None:
        """Una carrera con otra petición (nombre repetido, FK) llega como IntegrityError: se responde 400."""
        try:
            self._repository.commit()
        except IntegrityError as exc:
            self._repository.rollback()
            raise DatosInvalidosError(mensaje_conflicto) from exc
