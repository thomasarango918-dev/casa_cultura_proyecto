"""
Capa Controlador (MVC): grupos (Fase 6, JWT + Administrador/Coordinador/Maestro).

    GET    /api/v1/admin/grupos                                    Grupos visibles para el rol.
    GET    /api/v1/admin/grupos/programas                          Programas donde puede crear grupos.
    POST   /api/v1/admin/grupos                                    Crear grupo.
    PUT    /api/v1/admin/grupos/{id}                               Renombrar grupo.
    DELETE /api/v1/admin/grupos/{id}                               Eliminar (400 con estudiantes activos).
    GET    /api/v1/admin/grupos/{id}/estudiantes                   Estudiantes activos del grupo.
    GET    /api/v1/admin/grupos/{id}/estudiantes-disponibles       Aprobados del programa que no están en el grupo.
    POST   /api/v1/admin/grupos/{id}/estudiantes                   Asignación masiva (solicitudes_ids).
    DELETE /api/v1/admin/grupos/{id}/estudiantes/{solicitud_id}    Desvincular (soft delete).

El Coordinador solo consulta; el Maestro recibe 403 fuera de sus programas.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.dependencies.grupo_dependencies import get_grupo_service, require_grupos
from app.schemas.auth_schema import MensajeError
from app.schemas.grupo_schema import (
    AsignacionOut,
    AsignarEstudiantesRequest,
    EstudianteDisponibleOut,
    EstudianteGrupoOut,
    GrupoCreate,
    GrupoOut,
    GrupoUpdate,
    ProgramaGrupoOut,
)
from app.services.grupo_service import GrupoService
from app.utils.exceptions import DomainError, PermisoDenegadoError, RecursoNoEncontradoError

_ERRORES = {
    status.HTTP_400_BAD_REQUEST: {"model": MensajeError},
    status.HTTP_404_NOT_FOUND: {"model": MensajeError},
}

router = APIRouter(
    prefix="/admin/grupos",
    tags=["Grupos"],
    dependencies=[Depends(require_grupos)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)

GrupoId = Annotated[int, Path(gt=0, description="Id del grupo")]
SolicitudId = Annotated[int, Path(gt=0, description="Id de la solicitud aprobada del estudiante")]
Service = Annotated[GrupoService, Depends(get_grupo_service)]


def _http_error(exc: DomainError) -> HTTPException:
    if isinstance(exc, RecursoNoEncontradoError):
        codigo = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, PermisoDenegadoError):
        codigo = status.HTTP_403_FORBIDDEN
    else:
        codigo = status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=codigo, detail=exc.message)


@router.get("", response_model=list[GrupoOut], summary="Grupos visibles para el rol")
def list_grupos(service: Service) -> list[GrupoOut]:
    return service.listar()


# Declarada antes de /{grupo_id} para que "programas" no se lea como id.
@router.get("/programas", response_model=list[ProgramaGrupoOut], summary="Programas donde puede crear grupos")
def list_programas(service: Service) -> list[ProgramaGrupoOut]:
    try:
        return service.programas_disponibles()
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.post("", response_model=GrupoOut, status_code=status.HTTP_201_CREATED, summary="Crear grupo", responses=_ERRORES)
def create_grupo(data: GrupoCreate, service: Service) -> GrupoOut:
    try:
        return service.crear(data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.put("/{grupo_id}", response_model=GrupoOut, summary="Renombrar grupo", responses=_ERRORES)
def update_grupo(grupo_id: GrupoId, data: GrupoUpdate, service: Service) -> GrupoOut:
    try:
        return service.actualizar(grupo_id, data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.delete("/{grupo_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Eliminar grupo", responses=_ERRORES)
def delete_grupo(grupo_id: GrupoId, service: Service) -> None:
    try:
        service.eliminar(grupo_id)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.get(
    "/{grupo_id}/estudiantes", response_model=list[EstudianteGrupoOut], summary="Estudiantes activos", responses=_ERRORES
)
def list_estudiantes(grupo_id: GrupoId, service: Service) -> list[EstudianteGrupoOut]:
    try:
        return service.estudiantes(grupo_id)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.get(
    "/{grupo_id}/estudiantes-disponibles",
    response_model=list[EstudianteDisponibleOut],
    summary="Estudiantes aprobados que se pueden asignar",
    responses=_ERRORES,
)
def list_disponibles(grupo_id: GrupoId, service: Service) -> list[EstudianteDisponibleOut]:
    try:
        return service.estudiantes_disponibles(grupo_id)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.post(
    "/{grupo_id}/estudiantes",
    response_model=AsignacionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Asignar estudiantes",
    responses=_ERRORES,
)
def asignar_estudiantes(grupo_id: GrupoId, data: AsignarEstudiantesRequest, service: Service) -> AsignacionOut:
    try:
        return service.asignar(grupo_id, data.solicitudes_ids)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.delete(
    "/{grupo_id}/estudiantes/{solicitud_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desvincular estudiante (soft delete)",
    responses=_ERRORES,
)
def desasignar_estudiante(grupo_id: GrupoId, solicitud_id: SolicitudId, service: Service) -> None:
    try:
        service.desasignar(grupo_id, solicitud_id)
    except DomainError as exc:
        raise _http_error(exc) from exc
