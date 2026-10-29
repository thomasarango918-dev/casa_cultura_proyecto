"""
Capa Controlador (MVC): categorías y programas (Fase 5, JWT + Administrador/Coordinador).

    GET    /api/v1/admin/categorias               Categorías con sus programas y métricas.
    POST   /api/v1/admin/categorias               Crear categoría (400 si el nombre existe).
    PATCH  /api/v1/admin/categorias/{id}/estado   Habilitar/deshabilitar (400 con estudiantes activos).
    GET    /api/v1/admin/programas                Programas con métricas (?categoria_id=).
    GET    /api/v1/admin/programas/maestros       Usuarios con rol Maestro, para asignar.
    POST   /api/v1/admin/programas                Crear programa en una categoría.
    PUT    /api/v1/admin/programas/{id}           Editar nombre y maestros (maestros_ids).
    DELETE /api/v1/admin/programas/{id}           Eliminar (400 con estudiantes activos o historial).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.dependencies.programa_dependencies import get_programa_service, require_gestion_programas
from app.schemas.auth_schema import MensajeError
from app.schemas.programa_schema import (
    CategoriaCreate,
    CategoriaEstadoRequest,
    CategoriaOut,
    MaestroOut,
    ProgramaCreate,
    ProgramaGestionOut,
    ProgramaUpdate,
)
from app.services.programa_service import ProgramaService
from app.utils.exceptions import DomainError, RecursoNoEncontradoError

_AUTH = {
    status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
    status.HTTP_403_FORBIDDEN: {"model": MensajeError},
}
_ERRORES = {
    status.HTTP_400_BAD_REQUEST: {"model": MensajeError},
    status.HTTP_404_NOT_FOUND: {"model": MensajeError},
}

categorias_router = APIRouter(
    prefix="/admin/categorias",
    tags=["Programas y categorías"],
    dependencies=[Depends(require_gestion_programas)],
    responses=_AUTH,
)
programas_router = APIRouter(
    prefix="/admin/programas",
    tags=["Programas y categorías"],
    dependencies=[Depends(require_gestion_programas)],
    responses=_AUTH,
)

CategoriaId = Annotated[int, Path(gt=0, description="Id de la categoría")]
ProgramaId = Annotated[int, Path(gt=0, description="Id del programa")]


def _http_error(exc: DomainError) -> HTTPException:
    codigo = status.HTTP_404_NOT_FOUND if isinstance(exc, RecursoNoEncontradoError) else status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=codigo, detail=exc.message)


# ---- Categorías ------------------------------------------------------------------
@categorias_router.get("", response_model=list[CategoriaOut], summary="Categorías con sus programas")
def list_categorias(service: ProgramaService = Depends(get_programa_service)) -> list[CategoriaOut]:
    return service.listar_categorias()


@categorias_router.post(
    "", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED, summary="Crear categoría", responses=_ERRORES
)
def create_categoria(
    data: CategoriaCreate, service: ProgramaService = Depends(get_programa_service)
) -> CategoriaOut:
    try:
        return service.crear_categoria(data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@categorias_router.patch(
    "/{categoria_id}/estado",
    response_model=CategoriaOut,
    summary="Habilitar o deshabilitar categoría",
    description="No se puede deshabilitar si algún programa tiene solicitudes PENDIENTE o APROBADO.",
    responses=_ERRORES,
)
def update_estado_categoria(
    categoria_id: CategoriaId,
    data: CategoriaEstadoRequest,
    service: ProgramaService = Depends(get_programa_service),
) -> CategoriaOut:
    try:
        return service.cambiar_estado_categoria(categoria_id, data.activo)
    except DomainError as exc:
        raise _http_error(exc) from exc


# ---- Programas -------------------------------------------------------------------
@programas_router.get("", response_model=list[ProgramaGestionOut], summary="Programas con métricas")
def list_programas(
    categoria_id: Annotated[int | None, Query(gt=0)] = None,
    service: ProgramaService = Depends(get_programa_service),
) -> list[ProgramaGestionOut]:
    return service.listar_programas(categoria_id)


# Declarada antes de /{programa_id} para que "maestros" no se lea como id.
@programas_router.get("/maestros", response_model=list[MaestroOut], summary="Maestros asignables")
def list_maestros(service: ProgramaService = Depends(get_programa_service)) -> list[MaestroOut]:
    return service.listar_maestros()


@programas_router.post(
    "",
    response_model=ProgramaGestionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear programa",
    responses=_ERRORES,
)
def create_programa(
    data: ProgramaCreate, service: ProgramaService = Depends(get_programa_service)
) -> ProgramaGestionOut:
    try:
        return service.crear_programa(data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@programas_router.put(
    "/{programa_id}", response_model=ProgramaGestionOut, summary="Editar nombre y maestros", responses=_ERRORES
)
def update_programa(
    programa_id: ProgramaId,
    data: ProgramaUpdate,
    service: ProgramaService = Depends(get_programa_service),
) -> ProgramaGestionOut:
    try:
        return service.actualizar_programa(programa_id, data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@programas_router.delete(
    "/{programa_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar programa", responses=_ERRORES
)
def delete_programa(programa_id: ProgramaId, service: ProgramaService = Depends(get_programa_service)) -> None:
    try:
        service.eliminar_programa(programa_id)
    except DomainError as exc:
        raise _http_error(exc) from exc
